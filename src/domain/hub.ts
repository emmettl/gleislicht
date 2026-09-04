import type { NetworkSnapshot, NetworkTrain, TrainStop } from './network.ts'

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
  readonly train: NetworkTrain
  readonly stop: TrainStop
  readonly previousStop?: number
  readonly nextStop?: number
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
    calls.push({
      id: `${train.id}:${stop[0]}`,
      train,
      stop,
      previousStop: train.stops[callIndex - 1]?.[0],
      nextStop: train.stops[callIndex + 1]?.[0],
    })
  }

  return calls.sort((first, second) => first.stop[1] - second.stop[1])
}

export function callsNearTime(
  calls: readonly HubCall[],
  time: number,
  horizon = 15 * 60,
): readonly HubCall[] {
  return calls.filter(
    (call) => time >= call.stop[1] - horizon && time <= call.stop[2] + horizon,
  )
}

export function nextHubCall(
  calls: readonly HubCall[],
  time: number,
): HubCall | undefined {
  return calls.find((call) => call.stop[1] >= time)
}
