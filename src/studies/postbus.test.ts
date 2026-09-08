import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot, NetworkTrain } from '@motionstudies/core/domain/network'
import { postbusRouteIndex, postbusRouteSnapshot, postbusTickFollowsSeek } from './postbus.ts'

describe('nationwide PostBus route selection', () => {
  it('rejects stale evening frames after a morning seek and accepts the midnight wrap', () => {
    expect(postbusTickFollowsSeek(62110, 3600, 0.2, 120)).toBe(false)
    expect(postbusTickFollowsSeek(3620, 3600, 0.2, 120)).toBe(true)
    expect(postbusTickFollowsSeek(5, 86400, 0.2, 120)).toBe(true)
    expect(postbusTickFollowsSeek(4200, 3600, 5, 120)).toBe(true)
  })
  it('keeps unrelated line 220s separate while combining directions of the same source route', () => {
    const train = (id: string, routeId: string, headsign: string, stops: number[]): NetworkTrain & { routeId: string } => ({
      id, routeId, route: '220', category: 'bus', headsign, shortName: '', start: 0, end: 100,
      stops: stops.map(stop => [stop, 0, 100]),
    })
    const snapshot = { trains: [
      train('k1', 'kiental', 'Griesalp', [0, 1]),
      train('k2', 'kiental', 'Reichenbach', [1, 0]),
      train('v1', 'vaud', 'Lausanne', [2, 3]),
    ] } as unknown as NetworkSnapshot
    const routes = postbusRouteIndex(snapshot)
    expect(routes).toHaveLength(2)
    expect(routes.find(route => route.id === 'postbus:kiental')).toMatchObject({
      name: '220', trainIds: ['k1', 'k2'], stopIndexes: [0, 1], headsigns: ['Griesalp', 'Reichenbach'],
    })
    expect(routes.find(route => route.id === 'postbus:vaud')?.trainIds).toEqual(['v1'])
    expect(postbusRouteSnapshot(snapshot, routes.find(route => route.id === 'postbus:kiental')).trains.map(train => train.id)).toEqual(['k1', 'k2'])
  })
})
