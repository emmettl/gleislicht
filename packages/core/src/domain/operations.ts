export interface ObservedStopPrediction {
  readonly stopId: string
  readonly stopName: string
  readonly platformName?: string
  readonly expectedArrival: string
  readonly secondsToStop: number
}

export interface ObservedTransitVehicle {
  readonly id: string
  readonly lineId: string
  readonly lineName: string
  readonly modeName?: string
  readonly destinationStopId?: string
  readonly destinationName?: string
  readonly direction?: string
  readonly currentLocation?: string
  readonly towards?: string
  readonly observedAt: string
  readonly predictions: readonly ObservedStopPrediction[]
}

export interface ObservedLineStatus {
  readonly lineId: string
  readonly lineName: string
  readonly severity: number
  readonly severityDescription: string
  readonly reason?: string
}

export interface TransitOperationsSnapshot {
  readonly metadata: {
    readonly kind: 'observed-operations'
    readonly publisher: string
    readonly sourceUrl: string
    readonly collectedAt: string
    readonly scheduledAt: string
    readonly lineIds: readonly string[]
    readonly model: string
  }
  readonly vehicles: readonly ObservedTransitVehicle[]
  readonly lineStatuses: readonly ObservedLineStatus[]
}

export interface TransitOperationsDayFrame {
  readonly time: number
  readonly observedAt: string
  readonly vehicles: readonly ObservedTransitVehicle[]
  readonly lineStatuses: readonly ObservedLineStatus[]
}

export interface TransitOperationsDayChunk {
  readonly windowStart: number
  readonly windowEnd: number
  readonly frames: readonly TransitOperationsDayFrame[]
}

export interface TransitOperationsDayChunkDescriptor {
  readonly id: string
  readonly windowStart: number
  readonly windowEnd: number
  readonly path: string
  readonly frameCount: number
  readonly bytes: number
  readonly sha256: string
}

export interface TransitOperationsDayManifest {
  readonly metadata: {
    readonly kind: 'observed-operations-day'
    readonly publisher: string
    readonly serviceDate: string
    readonly timezone: string
    readonly sourceUrl: string
    readonly model: string
    readonly note: string
    readonly sampleIntervalSeconds: number
    readonly completeMinutes: number
    readonly longestGapSeconds: number
    readonly lineIds: readonly string[]
  }
  readonly chunks: readonly TransitOperationsDayChunkDescriptor[]
}

export interface ObservedNetworkProjection {
  readonly snapshot: import('./network.ts').NetworkSnapshot
  readonly serviceTime: number
  readonly matchedVehicleCount: number
  readonly unmatchedVehicleCount: number
}

function canonicalLineName(value: string): string {
  return value
    .toLocaleLowerCase('en-GB')
    .replace(/\bline\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function canonicalDestination(value: string): string {
  return value
    .toLocaleLowerCase('en-GB')
    .replace(/\b(?:underground|rail|dlr|tram) station\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

export function operationsServiceTime(
  snapshot: TransitOperationsSnapshot,
  timeZone: string,
): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(snapshot.metadata.scheduledAt))
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  return value('hour') * 3600 + value('minute') * 60 + value('second')
}

export function operationsAgeSeconds(
  snapshot: TransitOperationsSnapshot,
  now = Date.now(),
): number {
  return Math.max(
    0,
    Math.round((now - Date.parse(snapshot.metadata.collectedAt)) / 1000),
  )
}

interface TemplateAnchor {
  readonly position: number
  readonly secondsToStop: number
}

interface TemplateMatch {
  readonly train: import('./network.ts').NetworkTrain
  readonly anchors: readonly TemplateAnchor[]
  readonly score: number
}

function templateMatch(
  train: import('./network.ts').NetworkTrain,
  vehicle: ObservedTransitVehicle,
  stopIndexes: ReadonlyMap<string, number>,
): TemplateMatch | undefined {
  if (
    canonicalLineName(train.route) !== canonicalLineName(vehicle.lineId) &&
    canonicalLineName(train.route) !== canonicalLineName(vehicle.lineName)
  ) {
    return undefined
  }

  const anchors: TemplateAnchor[] = []
  let afterPosition = -1
  for (const prediction of vehicle.predictions) {
    const stopIndex = stopIndexes.get(prediction.stopId.toLocaleUpperCase('en-GB'))
    if (stopIndex === undefined) continue
    const position = train.stops.findIndex(
      ([candidate], index) => index > afterPosition && candidate === stopIndex,
    )
    if (position < 0) continue
    anchors.push({ position, secondsToStop: prediction.secondsToStop })
    afterPosition = position
  }
  if (!anchors.length) return undefined

  const destination = canonicalDestination(vehicle.destinationName ?? '')
  const headsign = canonicalDestination(train.headsign)
  const destinationScore =
    destination && headsign &&
    (destination === headsign || destination.includes(headsign) || headsign.includes(destination))
      ? 25
      : 0
  return {
    train,
    anchors,
    score: anchors.length * 100 + destinationScore,
  }
}

function timeBetweenAnchors(
  train: import('./network.ts').NetworkTrain,
  from: TemplateAnchor,
  to: TemplateAnchor,
  position: number,
  serviceTime: number,
): number {
  if (from.position === to.position) return serviceTime + from.secondsToStop
  const scheduledFrom = train.stops[from.position]?.[1] ?? from.position
  const scheduledTo = train.stops[to.position]?.[1] ?? to.position
  const scheduledAt = train.stops[position]?.[1] ?? position
  const scheduledDuration = scheduledTo - scheduledFrom
  const ratio = scheduledDuration > 0
    ? (scheduledAt - scheduledFrom) / scheduledDuration
    : (position - from.position) / (to.position - from.position)
  return Math.round(
    serviceTime +
      from.secondsToStop +
      (to.secondsToStop - from.secondsToStop) * Math.max(0, Math.min(1, ratio)),
  )
}

function observedTrain(
  match: TemplateMatch,
  vehicle: ObservedTransitVehicle,
  serviceTime: number,
): import('./network.ts').NetworkTrain | undefined {
  const { train, anchors } = match
  const first = anchors[0]
  const last = anchors.at(-1)!
  const startPosition = Math.max(0, first.position - 1)
  let endPosition = last.position
  if (endPosition === startPosition) {
    endPosition = Math.min(train.stops.length - 1, startPosition + 1)
  }
  if (endPosition <= startPosition) return undefined

  const anchorByPosition = new Map(anchors.map((anchor) => [anchor.position, anchor]))
  if (startPosition < first.position) {
    const scheduledDuration = Math.max(
      30,
      (train.stops[first.position]?.[1] ?? 0) -
        (train.stops[startPosition]?.[2] ?? 0),
    )
    anchorByPosition.set(startPosition, {
      position: startPosition,
      secondsToStop: Math.min(0, first.secondsToStop - scheduledDuration),
    })
  }
  if (!anchorByPosition.has(endPosition)) {
    const scheduledDuration = Math.max(
      30,
      (train.stops[endPosition]?.[1] ?? 0) -
        (train.stops[first.position]?.[1] ?? 0),
    )
    anchorByPosition.set(endPosition, {
      position: endPosition,
      secondsToStop: first.secondsToStop + scheduledDuration,
    })
  }

  const sortedAnchors = [...anchorByPosition.values()].sort(
    (left, right) => left.position - right.position,
  )
  const stops = train.stops
    .slice(startPosition, endPosition + 1)
    .map(([stopIndex], offset) => {
      const position = startPosition + offset
      const exact = anchorByPosition.get(position)
      let seconds = exact ? serviceTime + exact.secondsToStop : serviceTime
      if (!exact) {
        const nextAnchorIndex = sortedAnchors.findIndex(
          (anchor) => anchor.position > position,
        )
        const nextAnchor = sortedAnchors[nextAnchorIndex]
        const previousAnchor = sortedAnchors[nextAnchorIndex - 1]
        if (previousAnchor && nextAnchor) {
          seconds = timeBetweenAnchors(
            train,
            previousAnchor,
            nextAnchor,
            position,
            serviceTime,
          )
        }
      }
      return [stopIndex, seconds, seconds] as const
    })
  if (stops.length < 2) return undefined

  return {
    id: `observed:${vehicle.id}`,
    route: train.route,
    headsign: vehicle.destinationName?.trim() || train.headsign,
    shortName: vehicle.lineName,
    category: train.category,
    mode: vehicle.modeName || train.mode,
    start: stops[0][1],
    end: stops.at(-1)![2],
    stops,
    pathSegments: train.pathSegments?.slice(startPosition, endPosition),
    operations: {
      kind: 'prediction-derived',
      observedAt: vehicle.observedAt,
      vehicleId: vehicle.id,
    },
  }
}

export function projectOperationsOntoNetwork(
  reference: import('./network.ts').NetworkSnapshot,
  operations: TransitOperationsSnapshot,
  serviceTime: number,
): ObservedNetworkProjection {
  const stopIndexes = new Map<string, number>()
  reference.stops.forEach((stop, index) => {
    if (stop[4]) stopIndexes.set(stop[4].toLocaleUpperCase('en-GB'), index)
  })

  const trains: import('./network.ts').NetworkTrain[] = []
  for (const vehicle of operations.vehicles) {
    const match = reference.trains
      .map((train) => templateMatch(train, vehicle, stopIndexes))
      .filter((candidate): candidate is TemplateMatch => Boolean(candidate))
      .sort((left, right) => right.score - left.score)[0]
    if (!match) continue
    const train = observedTrain(match, vehicle, serviceTime)
    if (train) trains.push(train)
  }

  return {
    serviceTime,
    matchedVehicleCount: trains.length,
    unmatchedVehicleCount: operations.vehicles.length - trains.length,
    snapshot: {
      ...reference,
      metadata: {
        ...reference.metadata,
        windowStart: 0,
        windowEnd: 86_400,
        focusTime: serviceTime,
        retrievedAt: operations.metadata.collectedAt,
        model: operations.metadata.model,
        note: 'Observed arrival predictions projected between matched stops on the static route geometry; not GPS.',
      },
      trains,
    },
  }
}
