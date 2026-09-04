import type {
  NetworkSnapshot,
  NetworkStop,
  ServiceCategory,
} from './network.ts'

export type HubId = 'zurich' | 'bern' | 'basel' | 'geneva'

export interface HubDefinition {
  readonly id: HubId
  readonly name: string
  readonly displayName: string
  readonly character: string
}

export const HUBS: readonly HubDefinition[] = [
  {
    id: 'zurich',
    name: 'Zürich HB',
    displayName: 'Zürich HB',
    character: "Switzerland's busiest station",
  },
  {
    id: 'bern',
    name: 'Bern',
    displayName: 'Bern',
    character: 'the national interchange',
  },
  {
    id: 'basel',
    name: 'Basel SBB',
    displayName: 'Basel SBB',
    character: 'the tri-national gateway',
  },
  {
    id: 'geneva',
    name: 'Genève',
    displayName: 'Genève',
    character: 'the western gateway',
  },
]

export interface HubCall {
  readonly id: string
  readonly train: {
    readonly id: string
    readonly route: string
    readonly headsign: string
    readonly shortName: string
    readonly category: ServiceCategory
  }
  readonly arrival: number
  readonly departure: number
  readonly hubStop: NetworkStop
  readonly previousStop?: NetworkStop
  readonly nextStop?: NetworkStop
}

export interface HubDaySnapshot {
  readonly metadata: NetworkSnapshot['metadata']
  readonly hubs: Readonly<Record<HubId, readonly HubCall[]>>
}

export function callsAtHub(
  snapshot: NetworkSnapshot,
  hub: HubDefinition,
): readonly HubCall[] {
  const hubStopIndexes = new Set<number>()
  snapshot.stops.forEach((stop, index) => {
    if (stop[2] === hub.name) hubStopIndexes.add(index)
  })

  const calls: HubCall[] = []
  for (const train of snapshot.trains) {
    const callIndex = train.stops.findIndex(([stopIndex]) =>
      hubStopIndexes.has(stopIndex),
    )
    if (callIndex < 0) continue
    const stop = train.stops[callIndex]
    const hubStop = snapshot.stops[stop[0]]
    if (!hubStop) continue
    calls.push({
      id: `${train.id}:${stop[0]}`,
      train,
      arrival: stop[1],
      departure: stop[2],
      hubStop,
      previousStop: snapshot.stops[train.stops[callIndex - 1]?.[0]],
      nextStop: snapshot.stops[train.stops[callIndex + 1]?.[0]],
    })
  }

  return calls.sort((first, second) => first.arrival - second.arrival)
}

export function callsNearTime(
  calls: readonly HubCall[],
  time: number,
  horizon = 15 * 60,
  cycle = 24 * 3600,
): readonly HubCall[] {
  return calls.filter((call) => {
    const midpoint = (call.arrival + call.departure) / 2
    const cycleOffset = Math.round((time - midpoint) / cycle) * cycle
    return (
      time >= call.arrival + cycleOffset - horizon &&
      time <= call.departure + cycleOffset + horizon
    )
  })
}

export function nextHubCall(
  calls: readonly HubCall[],
  time: number,
): HubCall | undefined {
  return calls.find((call) => call.arrival >= time) ?? calls[0]
}
