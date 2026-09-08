import type {NetworkSnapshot} from '@motionstudies/core/domain/network'
import audit from '../../data/glion-interchange-audit.json'
import {territetJourneys, type TerritetDirection} from './territet.ts'
import {rochersJourneys} from './rochers.ts'

type Connection = typeof audit.connections[number]
export type GlionJourney = {connection: Connection; network: NetworkSnapshot}
export const glionDirection = (id: string | undefined) => audit.connections.find(c => c.railwayTripId === id)?.direction as TerritetDirection | undefined
export function glionPhase(c: Connection, time: number) {
  return time < c.start ? 'before' : time >= c.end ? 'complete' : time < c.transfer.arrival ? 'first-leg' : time < c.transfer.departure ? 'interchange' : 'second-leg'
}

// Keep the two Glion source places and each leg's geometry separate. There is no walking edge.
function bindPair(c: Connection, funicular: NetworkSnapshot, railway: NetworkSnapshot): GlionJourney | undefined {
  const direction = c.direction as TerritetDirection
  const f = territetJourneys(funicular, direction).find(t => t.id === c.funicularTripId)
  const r = rochersJourneys(railway, direction).find(t => t.id === c.railwayTripId)
  if (!f || !r || c.transfer.minimumSeconds !== 60 || c.transfer.departure - c.transfer.arrival < 60) return
  const stops: NetworkSnapshot['stops'][number][] = [], paths: NonNullable<NetworkSnapshot['paths']>[number][] = [], edges: NetworkSnapshot['edges'][number][] = [], edgePaths: number[] = []
  const trains: NetworkSnapshot['trains'][number][] = []
  for (const leg of c.legs) {
    const source = leg.tripId === f.id ? funicular : railway
    const train = leg.tripId === f.id ? f : r
    const first = train.stops.findIndex(([i]) => source.stops[i][4] === leg.calls[0].stopId)
    if (first < 0) return
    const calls = train.stops.slice(first, first + leg.calls.length)
    if (calls.length !== leg.calls.length || !calls.every(([index, a, d], i) => source.stops[index][4] === leg.calls[i].stopId && a === leg.calls[i].arrival && d === leg.calls[i].departure)) return
    const offset = stops.length, pathOffset = paths.length
    stops.push(...calls.map(([i]) => source.stops[i]))
    for (let i = 0; i < calls.length - 1; i++) {
      const path = source.paths?.[train.pathSegments?.[first + i] ?? -1]
      if (!path || path.length < 2 || !path.every(p => p.length === 2 && p.every(Number.isFinite))) return
      paths.push(path); edges.push([offset + i, offset + i + 1]); edgePaths.push(paths.length - 1)
    }
    trains.push({...train, start: calls[0][2], end: calls.at(-1)![1], stops: calls.map(([, a, d], i) => [offset + i, a, d]), pathSegments: calls.slice(1).map((_, i) => pathOffset + i)})
  }
  const coordinates = [...stops.map(s => [s[0], s[1]]), ...paths.flat()]
  if (!coordinates.every(p => p.every(Number.isFinite))) return
  return {connection: c, network: {...funicular, stops, paths, edges, edgePaths, trains,
    bounds: {minLongitude: Math.min(...coordinates.map(p => p[0])), maxLongitude: Math.max(...coordinates.map(p => p[0])), minLatitude: Math.min(...coordinates.map(p => p[1])), maxLatitude: Math.max(...coordinates.map(p => p[1]))}}}
}

export function glionJourneys(funicular: NetworkSnapshot, railway: NetworkSnapshot, direction: TerritetDirection): GlionJourney[] {
  try {
    return audit.connections.filter(c => c.direction === direction).flatMap(c => {
      const bound = bindPair(c, funicular, railway)
      return bound ? [bound] : []
    })
  } catch { return [] }
}
