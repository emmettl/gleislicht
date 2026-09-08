import type { NetworkSnapshot, NetworkTrain } from '@motionstudies/core/domain/network'
import evidence from '../../data/jungfrau-ascent-source.json'

export const sourceRoot = (id: string | undefined) => id?.match(/^ch:1:sloid:\d+/)?.[0]
export type AscentLeg = { train: NetworkTrain; operator: string; from: string; to: string; departure: number; arrival: number; fromId: string; toId: string }
export type JungfrauAscent = { id: string; start: number; end: number; legs: AscentLeg[]; waits: { start: number; end: number; minimum: number; published: boolean }[] }
export type AscentPhase = 'before' | 'complete' | `leg-${number}` | `wait-${number}`
export function jungfrauAscents(network: NetworkSnapshot): JungfrauAscent[] {
  const metadata = network.metadata as NetworkSnapshot['metadata'] & { sources?: { timetable?: { sha256?: string } } }
  if (metadata.serviceDate !== evidence.serviceDate || metadata.feedVersion !== evidence.feedVersion || metadata.sources?.timetable?.sha256 !== evidence.sha256) return []
  if (new Set(network.trains.map(t => t.id)).size !== network.trains.length) return []
  const sourceTrips = evidence.trips as Record<string, typeof evidence.trips[keyof typeof evidence.trips]>
  const legs = network.trains.flatMap(train => {
    const source = sourceTrips[train.id], actual = train as NetworkTrain & { agencyId?: string; routeId?: string; routeType?: number; frequency?: unknown; operator?: string }
    if (!source || actual.frequency || actual.agencyId !== source.agencyId || actual.routeId !== source.routeId || actual.routeType !== source.routeType || train.stops.length !== source.calls.length) return []
    if (train.stops.some((s, i) => network.stops[s[0]]?.[4] !== source.calls[i].stopId || s[1] !== source.calls[i].arrival || s[2] !== source.calls[i].departure || s[2] < s[1] || (i > 0 && s[1] < train.stops[i-1][2]))) return []
    if (source.calls[0].pickup !== '0' || source.calls.at(-1)!.dropOff !== '0' || train.pathSegments?.length !== train.stops.length-1 || train.pathSegments.some(p => p === null || !network.paths?.[p] || network.paths[p].length < 2 || network.paths[p].some(point => !point.every(Number.isFinite)))) return []
    const first = train.stops[0], last = train.stops.at(-1)!
    return [{ train, operator: actual.operator ?? train.route, from: network.stops[first[0]][2], to: network.stops[last[0]][2], fromId: source.calls[0].stopId, toId: source.calls.at(-1)!.stopId, departure: first[2], arrival: last[1] }]
  }).sort((a,b) => a.departure-b.departure || a.train.id.localeCompare(b.train.id))
  const byRoute = (route: string) => legs.filter(l => sourceTrips[l.train.id].routeId === route)
  const minimum = (from: AscentLeg, to: AscentLeg) => {
    const rows = evidence.transfers.filter(r => r.from_stop_id === from.toId && r.to_stop_id === to.fromId)
    if (rows.length !== 1) return Infinity
    const row = rows[0]
    if (row.transfer_type !== '2' || row.from_trip_id || row.to_trip_id || row.from_route_id || row.to_route_id || row.service_id) return Infinity
    return Number(row.min_transfer_time) + evidence.operator.boardingLeadSeconds
  }
  // Absence was audited. Any newly supplied internal rule requires a fresh review.
  if (evidence.transfers.some(r => sourceRoot(r.from_stop_id) === 'ch:1:sloid:7384')) return []
  const wab = byRoute('93-63-j26-1'), jb = byRoute('93-65-j26-1')
  return byRoute('91-62-j26-1').flatMap(bob => {
    const mountain = wab.find(l => l.departure >= bob.arrival + evidence.editorial.lauterbrunnenMinimumSeconds)
    if (!mountain || mountain.departure-bob.arrival > evidence.editorial.maximumWaitSeconds) return []
    const summit = jb.find(l => l.departure >= mountain.arrival + minimum(mountain,l))
    if (!summit || summit.departure-mountain.arrival > evidence.editorial.maximumWaitSeconds || summit.arrival > 86400) return []
    return [{ id: bob.train.id, start: bob.departure, end: summit.arrival, legs: [bob,mountain,summit], waits: [
      { start: bob.arrival, end: mountain.departure, minimum: evidence.editorial.lauterbrunnenMinimumSeconds, published: false },
      { start: mountain.arrival, end: summit.departure, minimum: minimum(mountain,summit), published: true },
    ] }]
  })
}
export function ascentPhase(sequence: JungfrauAscent, time: number): AscentPhase {
  if (time < sequence.start) return 'before'
  for (let i=0; i<sequence.legs.length; i++) {
    if (time < sequence.legs[i].arrival) return `leg-${i}`
    if (sequence.waits[i] && time < sequence.waits[i].end) return `wait-${i}`
  }
  return 'complete'
}
export function ascentFocus(sequence: JungfrauAscent, phase: AscentPhase) {
  if (phase.startsWith('leg-')) return { trainId: sequence.legs[Number(phase.slice(4))].train.id, station: undefined }
  return { trainId: undefined, station: phase === 'before' ? sequence.legs[0].from : phase === 'complete' ? sequence.legs.at(-1)!.to : sequence.legs[Number(phase.slice(5))].to }
}
