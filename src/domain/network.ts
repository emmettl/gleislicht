export type NetworkStop = readonly [
  longitude: number,
  latitude: number,
  name: string,
]

export type NetworkEdge = readonly [from: number, to: number]
export type TrainStop = readonly [stopIndex: number, arrival: number, departure: number]

export type ServiceCategory =
  | 'international'
  | 'intercity'
  | 'interregio'
  | 'regional-express'
  | 's-bahn'
  | 'regional'
  | 'other'

export const SERVICE_CATEGORIES: ReadonlyArray<{
  readonly id: ServiceCategory
  readonly label: string
  readonly color: string
}> = [
  { id: 'international', label: 'International', color: '#ffd166' },
  { id: 'intercity', label: 'IC', color: '#ff4fd8' },
  { id: 'interregio', label: 'IR', color: '#9d7bff' },
  { id: 'regional-express', label: 'RE', color: '#4fc3ff' },
  { id: 's-bahn', label: 'S-Bahn', color: '#7dffbb' },
  { id: 'regional', label: 'Regional', color: '#fff3a6' },
  { id: 'other', label: 'Other', color: '#b9c1da' },
]

export const SERVICE_COLORS: Readonly<Record<ServiceCategory, string>> =
  Object.fromEntries(
    SERVICE_CATEGORIES.map((category) => [category.id, category.color]),
  ) as Record<ServiceCategory, string>

export interface NetworkTrain {
  readonly id: string
  readonly route: string
  readonly headsign: string
  readonly shortName: string
  readonly category: ServiceCategory
  readonly start: number
  readonly end: number
  readonly stops: readonly TrainStop[]
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
    readonly model: string
    readonly note: string
  }
  readonly bounds: {
    readonly minLongitude: number
    readonly minLatitude: number
    readonly maxLongitude: number
    readonly maxLatitude: number
  }
  readonly stops: readonly NetworkStop[]
  readonly edges: readonly NetworkEdge[]
  readonly trains: readonly NetworkTrain[]
}

export interface StationRoute {
  readonly name: string
  readonly category: ServiceCategory
}

export interface StationIndexEntry {
  readonly name: string
  readonly stopIndexes: readonly number[]
  readonly trainIds: readonly string[]
  readonly routes: readonly StationRoute[]
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
    }
  >()

  snapshot.stops.forEach((stop, index) => {
    const record = records.get(stop[2]) ?? {
      stopIndexes: [],
      trainIds: new Set<string>(),
      routes: new Map<string, StationRoute>(),
    }
    record.stopIndexes.push(index)
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
}

export function positionForTrain(
  train: NetworkTrain,
  time: number,
): TrainPosition | undefined {
  if (time < train.start || time > train.end || train.stops.length < 2) {
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
