import type { NetworkSnapshot, NetworkTrain, TrainStop } from './network.ts'

export type RealtimeTripRelationship =
  | 'scheduled'
  | 'cancelled'
  | 'deleted'
  | 'added'

export interface RealtimeStopUpdate {
  readonly stopPosition?: number
  readonly stopId?: string
  readonly stopSequence?: number
  readonly scheduleRelationship?: 'scheduled' | 'skipped' | 'no-data'
  readonly arrivalDelay?: number
  readonly departureDelay?: number
}

export interface RealtimeTripUpdate {
  readonly tripId: string
  readonly startDate?: string
  readonly scheduleRelationship?: RealtimeTripRelationship
  readonly delaySeconds?: number
  readonly stopTimeUpdates?: readonly RealtimeStopUpdate[]
}

export interface RealtimeSnapshot {
  readonly metadata: {
    readonly kind: 'fixture' | 'live'
    readonly generatedAt: string
    readonly receivedAt?: string
    readonly staticFeedVersion: string
    readonly serviceDate: string
    readonly sourceUrl: string
    readonly model: string
  }
  readonly updates: readonly RealtimeTripUpdate[]
}

export interface RealtimeApplication {
  readonly network: NetworkSnapshot
  readonly compatible: boolean
  readonly reason?: 'feed-version' | 'service-date'
  readonly summary: {
    readonly adjusted: number
    readonly cancelled: number
    readonly skippedStops: number
    readonly unmatched: number
  }
}

const emptySummary = () => ({
  adjusted: 0,
  cancelled: 0,
  skippedStops: 0,
  unmatched: 0,
})

function exactStopPosition(
  network: NetworkSnapshot,
  train: NetworkTrain,
  update: RealtimeStopUpdate,
): number | undefined {
  if (
    update.stopPosition !== undefined &&
    Number.isInteger(update.stopPosition) &&
    update.stopPosition >= 0 &&
    update.stopPosition < train.stops.length
  ) {
    return update.stopPosition
  }
  if (!update.stopId) return undefined
  const position = train.stops.findIndex(
    ([stopIndex]) => network.stops[stopIndex]?.[4] === update.stopId,
  )
  return position < 0 ? undefined : position
}

function adjustTrain(
  network: NetworkSnapshot,
  train: NetworkTrain,
  update: RealtimeTripUpdate,
  generatedAt: string,
): NetworkTrain {
  if (
    update.scheduleRelationship === 'cancelled' ||
    update.scheduleRelationship === 'deleted'
  ) {
    return {
      ...train,
      realtime: {
        status: 'cancelled',
        delaySeconds: update.delaySeconds ?? 0,
        skippedStops: 0,
        generatedAt,
      },
    }
  }

  const updatesByPosition = new Map<number, RealtimeStopUpdate>()
  for (const stopUpdate of update.stopTimeUpdates ?? []) {
    const position = exactStopPosition(network, train, stopUpdate)
    if (position !== undefined) updatesByPosition.set(position, stopUpdate)
  }

  let carriedDelay = update.delaySeconds ?? 0
  const retainedOriginalPositions: number[] = []
  const stops: TrainStop[] = []
  let skippedStops = 0
  train.stops.forEach((stop, position) => {
    const stopUpdate = updatesByPosition.get(position)
    if (stopUpdate?.scheduleRelationship === 'skipped') {
      skippedStops += 1
      return
    }
    const arrivalDelay = stopUpdate?.arrivalDelay ?? carriedDelay
    const departureDelay = stopUpdate?.departureDelay ?? arrivalDelay
    carriedDelay = departureDelay
    retainedOriginalPositions.push(position)
    stops.push([stop[0], stop[1] + arrivalDelay, stop[2] + departureDelay])
  })

  const pathSegments = train.pathSegments
    ? retainedOriginalPositions.slice(1).map((position, index) => {
        const previousPosition = retainedOriginalPositions[index]
        return position === previousPosition + 1
          ? (train.pathSegments?.[previousPosition] ?? null)
          : null
      })
    : undefined
  const delaySeconds = carriedDelay
  return {
    ...train,
    start: stops[0]?.[1] ?? train.start + delaySeconds,
    end: stops.at(-1)?.[2] ?? train.end + delaySeconds,
    stops,
    pathSegments,
    realtime: {
      status: 'adjusted',
      delaySeconds,
      skippedStops,
      generatedAt,
    },
  }
}

export function applyRealtimeSnapshot(
  network: NetworkSnapshot,
  realtime: RealtimeSnapshot,
): RealtimeApplication {
  if (realtime.metadata.staticFeedVersion !== network.metadata.feedVersion) {
    return {
      network,
      compatible: false,
      reason: 'feed-version',
      summary: emptySummary(),
    }
  }
  if (realtime.metadata.serviceDate !== network.metadata.serviceDate) {
    return {
      network,
      compatible: false,
      reason: 'service-date',
      summary: emptySummary(),
    }
  }

  const updates = new Map(realtime.updates.map((update) => [update.tripId, update]))
  const matched = new Set<string>()
  const summary = emptySummary()
  const trains = network.trains.map((train) => {
    const update = updates.get(train.id)
    if (!update || update.scheduleRelationship === 'added') return train
    matched.add(train.id)
    const adjusted = adjustTrain(
      network,
      train,
      update,
      realtime.metadata.generatedAt,
    )
    if (adjusted.realtime?.status === 'cancelled') summary.cancelled += 1
    else summary.adjusted += 1
    summary.skippedStops += adjusted.realtime?.skippedStops ?? 0
    return adjusted
  })
  summary.unmatched = realtime.updates.length - matched.size
  return {
    network: { ...network, trains },
    compatible: true,
    summary,
  }
}
