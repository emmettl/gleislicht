import type {
  NetworkSnapshot,
  NetworkStop,
  ServiceCategory,
} from './network.ts'

export interface HubDefinition<HubId extends string = string> {
  readonly id: HubId
  readonly name: string
  readonly aliases?: readonly string[]
  readonly displayName: string
  readonly character: string
}

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

export type HubFlowOrientation = 'radial' | 'orbital'
export type HubFlowLens = 'all' | HubFlowOrientation

export interface HubFlowSummary {
  readonly all: number
  readonly radial: number
  readonly orbital: number
}

export interface HubDaySnapshot<HubId extends string = string> {
  readonly metadata: NetworkSnapshot['metadata']
  readonly hubs: Readonly<Record<HubId, readonly HubCall[]>>
}

export const UNASSIGNED_PLATFORM = '—'

export type StationMotionPhase = 'approaching' | 'dwelling' | 'departing'

export interface StationMotion {
  readonly phase: StationMotionPhase
  readonly progress: number
}

export function platformCodeForCall(call: HubCall): string {
  return call.hubStop[3]?.trim() || UNASSIGNED_PLATFORM
}

export function platformTrackForCall(call: HubCall): string {
  const code = platformCodeForCall(call)
  if (code === UNASSIGNED_PLATFORM || code.includes('/')) return code
  return /^\d+/.exec(code)?.[0] ?? code
}

export function platformsForCalls(calls: readonly HubCall[]): readonly string[] {
  return [...new Set(calls.map(platformTrackForCall))].sort((first, second) => {
    if (first === UNASSIGNED_PLATFORM) return 1
    if (second === UNASSIGNED_PLATFORM) return -1
    return first.localeCompare(second, 'de-CH', {
      numeric: true,
      sensitivity: 'base',
    })
  })
}

export function stationMotionForCall(
  call: HubCall,
  time: number,
  horizon = 6 * 60,
  cycle = 24 * 3600,
): StationMotion | undefined {
  const midpoint = (call.arrival + call.departure) / 2
  const cycleOffset = Math.round((time - midpoint) / cycle) * cycle
  const arrival = call.arrival + cycleOffset
  const departure = call.departure + cycleOffset

  if (time < arrival - horizon || time > departure + horizon) return undefined
  if (time < arrival) {
    return {
      phase: 'approaching',
      progress: (time - (arrival - horizon)) / horizon,
    }
  }
  if (time <= departure) return { phase: 'dwelling', progress: 1 }
  return {
    phase: 'departing',
    progress: (time - departure) / horizon,
  }
}

export function callsAtHub(
  snapshot: NetworkSnapshot,
  hub: HubDefinition,
): readonly HubCall[] {
  const hubNames = new Set([hub.name, ...(hub.aliases ?? [])])
  const hubStopIndexes = new Set<number>()
  snapshot.stops.forEach((stop, index) => {
    if (hubNames.has(stop[2])) hubStopIndexes.add(index)
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

function projectedVector(
  from: Readonly<{ 0: number; 1: number }>,
  to: Readonly<{ 0: number; 1: number }>,
  latitude: number,
): readonly [number, number] {
  const longitudeScale = Math.cos((latitude * Math.PI) / 180)
  return [(to[0] - from[0]) * longitudeScale, to[1] - from[1]]
}

/**
 * Classify a movement by comparing its local path through a hub with the line
 * from a study centre to that hub. The absolute dot product makes the result
 * independent of service direction: inbound and outbound calls share a lens.
 */
export function hubFlowOrientation(
  call: HubCall,
  centre: readonly [longitude: number, latitude: number],
  radialThreshold = Math.SQRT1_2,
): HubFlowOrientation {
  const routeStart = call.previousStop ?? call.hubStop
  const routeEnd = call.nextStop ?? call.hubStop
  const route = projectedVector(routeStart, routeEnd, call.hubStop[1])
  const radial = projectedVector(centre, call.hubStop, call.hubStop[1])
  const routeLength = Math.hypot(route[0], route[1])
  const radialLength = Math.hypot(radial[0], radial[1])

  if (routeLength < 1e-8 || radialLength < 1e-8) return 'radial'
  const alignment = Math.abs(
    (route[0] * radial[0] + route[1] * radial[1]) /
      (routeLength * radialLength),
  )
  return alignment >= radialThreshold ? 'radial' : 'orbital'
}

export function callsForHubFlowLens(
  calls: readonly HubCall[],
  lens: HubFlowLens,
  centre: readonly [longitude: number, latitude: number],
): readonly HubCall[] {
  if (lens === 'all') return calls
  return calls.filter((call) => hubFlowOrientation(call, centre) === lens)
}

export function hubFlowSummary(
  calls: readonly HubCall[],
  centre: readonly [longitude: number, latitude: number],
): HubFlowSummary {
  let radial = 0
  for (const call of calls) {
    if (hubFlowOrientation(call, centre) === 'radial') radial += 1
  }
  return {
    all: calls.length,
    radial,
    orbital: calls.length - radial,
  }
}

/** A soft day/night envelope with transitions around 22:00 and 06:30. */
export function hubNightSignalMix(time: number): number {
  const timeOfDay = ((time % 86_400) + 86_400) % 86_400
  const eveningStart = 22 * 3_600
  const eveningEnd = 23 * 3_600
  const morningStart = 5 * 3_600
  const morningEnd = 6.5 * 3_600
  if (timeOfDay >= eveningStart) {
    return Math.min(1, (timeOfDay - eveningStart) / (eveningEnd - eveningStart))
  }
  if (timeOfDay < morningStart) return 1
  if (timeOfDay < morningEnd) {
    return 1 - (timeOfDay - morningStart) / (morningEnd - morningStart)
  }
  return 0
}
