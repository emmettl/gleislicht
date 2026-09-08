import type { NetworkSnapshot, NetworkRouteIndexEntry, NetworkTrain } from '@motionstudies/core/domain/network'

/** PostBus reuses display numbers across Switzerland; selection follows source identity. */
export function postbusRouteIndex(snapshot: NetworkSnapshot): readonly NetworkRouteIndexEntry[] {
  const routes = new Map<string, { name: string; trains: string[]; stops: Set<number>; destinations: Set<string> }>()
  for (const train of snapshot.trains) {
    const sourceId = (train as NetworkTrain & { routeId?: string }).routeId
    if (!sourceId) throw new Error(`Missing PostBus route identity: ${train.id}`)
    const record = routes.get(sourceId) ?? { name: train.route, trains: [], stops: new Set<number>(), destinations: new Set<string>() }
    record.trains.push(train.id)
    train.stops.forEach(([index]) => record.stops.add(index))
    if (train.headsign) record.destinations.add(train.headsign)
    routes.set(sourceId, record)
  }
  return [...routes].map(([id, record]) => ({
    id: `postbus:${id}`, name: record.name, category: 'bus' as const,
    trainIds: record.trains, stopIndexes: [...record.stops], headsigns: [...record.destinations].sort(),
  })).sort((a, b) => a.name.localeCompare(b.name, 'de-CH', { numeric: true }) || a.id.localeCompare(b.id))
}

/** The shared label renderer joins display numbers, so isolate a selected Swiss source route. */
export function postbusRouteSnapshot(snapshot: NetworkSnapshot, route?: NetworkRouteIndexEntry): NetworkSnapshot {
  if (!route) return snapshot
  const ids = new Set(route.trainIds)
  return { ...snapshot, trains: snapshot.trains.filter(train => ids.has(train.id)) }
}

/** Ignore a frame from before a seek until the scene has adopted the new clock. */
export function postbusTickFollowsSeek(time: number, target: number, elapsedSeconds: number, playbackRate: number): boolean {
  const forwardSeconds = ((time - target) % 86400 + 86400) % 86400
  return forwardSeconds <= Math.max(1, elapsedSeconds + 1) * playbackRate
}
