export type NetworkStop = readonly [
  longitude: number,
  latitude: number,
  name: string,
  platformCode?: string,
  sourceId?: string,
  labelRank?: number,
]

export type NetworkEdge = readonly [from: number, to: number]
export type NetworkPathPoint = readonly [longitude: number, latitude: number]
export type NetworkPath = readonly NetworkPathPoint[]
export type TrainStop = readonly [stopIndex: number, arrival: number, departure: number]

export type ServiceCategory =
  | 'international'
  | 'intercity'
  | 'interregio'
  | 'regional-express'
  | 's-bahn'
  | 'regional'
  | 'tram'
  | 'metro'
  | 'bus'
  | 'ferry'
  | 'cableway'
  | 'funicular'
  | 'other'

export interface NetworkTrain {
  readonly id: string
  readonly route: string
  readonly headsign: string
  readonly shortName: string
  readonly category: ServiceCategory
  readonly mode?: string
  readonly start: number
  readonly end: number
  readonly stops: readonly TrainStop[]
  readonly pathSegments?: readonly (number | null)[]
  readonly realtime?: RealtimeTrainState
}

export interface RealtimeTrainState {
  readonly status: 'adjusted' | 'cancelled'
  readonly delaySeconds: number
  readonly skippedStops: number
  readonly generatedAt: string
}

export interface NetworkSnapshot {
  readonly metadata: {
    readonly publisher: string
    readonly feedVersion: string
    readonly serviceDate: string
    readonly windowStart: number
    readonly windowEnd: number
    readonly focusTime: number
    readonly sourceUrl: string
    readonly sourceSha256?: string
    readonly retrievedAt?: string
    readonly license?: string
    readonly licenseUrl?: string
    readonly model: string
    readonly note: string
    readonly modes?: readonly string[]
    readonly labelHierarchy?: {
      readonly model: string
      readonly stationCount: number
    }
    readonly localAgencyIds?: readonly string[]
    readonly localRouteIds?: readonly string[]
    readonly geometry?: {
      readonly publisher: string
      readonly feedVersion: string
      readonly sourceUrl: string
      readonly sourceSha256?: string
      readonly productUrl?: string
      readonly model: string
      readonly matchedSegments: number
      readonly totalSegments: number
      readonly resolvedStops?: number
      readonly totalStops?: number
      readonly simplificationToleranceMetres?: number
    }
  }
  readonly bounds: {
    readonly minLongitude: number
    readonly minLatitude: number
    readonly maxLongitude: number
    readonly maxLatitude: number
  }
  readonly stops: readonly NetworkStop[]
  readonly edges: readonly NetworkEdge[]
  readonly paths?: readonly NetworkPath[]
  readonly edgePaths?: readonly (number | null)[]
  readonly trains: readonly NetworkTrain[]
}

export interface NetworkDayChunkDescriptor {
  readonly id: string
  readonly windowStart: number
  readonly windowEnd: number
  readonly path: string
  readonly tripCount: number
}

export interface NetworkDayManifest {
  readonly metadata: NetworkSnapshot['metadata']
  readonly bounds: NetworkSnapshot['bounds']
  readonly stops: NetworkSnapshot['stops']
  readonly edges: NetworkSnapshot['edges']
  readonly paths?: NetworkSnapshot['paths']
  readonly edgePaths?: NetworkSnapshot['edgePaths']
  readonly tripCount: number
  readonly chunks: readonly NetworkDayChunkDescriptor[]
}

export interface NetworkDayChunk {
  readonly windowStart: number
  readonly windowEnd: number
  readonly trains: readonly NetworkTrain[]
}

export interface StationRoute {
  readonly name: string
  readonly category: ServiceCategory
}

export interface StationIndexEntry {
  readonly name: string
  readonly labelRank?: number
  readonly stopIndexes: readonly number[]
  readonly trainIds: readonly string[]
  readonly routes: readonly StationRoute[]
}

export interface NetworkRouteIndexEntry {
  readonly id: string
  readonly name: string
  readonly category: ServiceCategory
  readonly trainIds: readonly string[]
  readonly stopIndexes: readonly number[]
  readonly headsigns: readonly string[]
}

export function buildRouteIndex(
  snapshot: NetworkSnapshot,
): readonly NetworkRouteIndexEntry[] {
  const records = new Map<
    string,
    {
      name: string
      category: ServiceCategory
      trainIds: Set<string>
      stopIndexes: Set<number>
      headsigns: Set<string>
    }
  >()

  for (const train of snapshot.trains) {
    const id = `${train.category}:${train.route}`
    const record = records.get(id) ?? {
      name: train.route,
      category: train.category,
      trainIds: new Set<string>(),
      stopIndexes: new Set<number>(),
      headsigns: new Set<string>(),
    }
    record.trainIds.add(train.id)
    train.stops.forEach(([stopIndex]) => record.stopIndexes.add(stopIndex))
    if (train.headsign) record.headsigns.add(train.headsign)
    records.set(id, record)
  }

  return [...records.entries()]
    .map(([id, record]) => ({
      id,
      name: record.name,
      category: record.category,
      trainIds: [...record.trainIds],
      stopIndexes: [...record.stopIndexes],
      headsigns: [...record.headsigns].sort((first, second) =>
        first.localeCompare(second, 'de-CH'),
      ),
    }))
    .sort(
      (first, second) =>
        first.category.localeCompare(second.category, 'en') ||
        first.name.localeCompare(second.name, 'de-CH', { numeric: true }),
    )
}

export function buildStationIndex(
  snapshot: NetworkSnapshot,
): readonly StationIndexEntry[] {
  const records = new Map<
    string,
    {
      stopIndexes: number[]
      trainIds: Set<string>
      routes: Map<string, StationRoute>
      labelRank?: number
    }
  >()

  snapshot.stops.forEach((stop, index) => {
    const record = records.get(stop[2]) ?? {
      stopIndexes: [],
      trainIds: new Set<string>(),
      routes: new Map<string, StationRoute>(),
      labelRank: stop[5],
    }
    record.stopIndexes.push(index)
    if (stop[5] !== undefined) {
      record.labelRank = Math.min(record.labelRank ?? Number.POSITIVE_INFINITY, stop[5])
    }
    records.set(stop[2], record)
  })

  for (const train of snapshot.trains) {
    const visitedNames = new Set<string>()
    for (const [stopIndex] of train.stops) {
      const name = snapshot.stops[stopIndex]?.[2]
      if (!name || visitedNames.has(name)) continue
      visitedNames.add(name)
      const record = records.get(name)
      if (!record) continue
      record.trainIds.add(train.id)
      record.routes.set(`${train.category}:${train.route}`, {
        name: train.route,
        category: train.category,
      })
    }
  }

  return [...records.entries()]
    .filter(([, record]) => record.trainIds.size > 0)
    .map(([name, record]) => ({
      name,
      labelRank: record.labelRank,
      stopIndexes: record.stopIndexes,
      trainIds: [...record.trainIds],
      routes: [...record.routes.values()].sort((first, second) =>
        first.name.localeCompare(second.name, 'de-CH'),
      ),
    }))
}

export interface TrainPosition {
  readonly fromStop: number
  readonly toStop: number
  readonly progress: number
  readonly segmentIndex?: number
}

export function positionForTrain(
  train: NetworkTrain,
  time: number,
): TrainPosition | undefined {
  if (
    train.realtime?.status === 'cancelled' ||
    time < train.start ||
    time > train.end ||
    train.stops.length < 2
  ) {
    return undefined
  }

  for (let index = 1; index < train.stops.length; index += 1) {
    const previous = train.stops[index - 1]
    const next = train.stops[index]
    if (time <= previous[2]) {
      return { fromStop: previous[0], toStop: previous[0], progress: 0 }
    }
    if (time <= next[1]) {
      const duration = Math.max(1, next[1] - previous[2])
      return {
        fromStop: previous[0],
        toStop: next[0],
        progress: Math.min(1, Math.max(0, (time - previous[2]) / duration)),
        segmentIndex: index - 1,
      }
    }
    if (time <= next[2]) {
      return { fromStop: next[0], toStop: next[0], progress: 0 }
    }
  }

  const last = train.stops.at(-1)!
  return { fromStop: last[0], toStop: last[0], progress: 0 }
}

export function formatServiceTime(totalSeconds: number): string {
  const normalized = ((Math.round(totalSeconds) % 86400) + 86400) % 86400
  const hours = Math.floor(normalized / 3600)
  const minutes = Math.floor((normalized % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
