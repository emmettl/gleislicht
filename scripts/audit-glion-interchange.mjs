import {createHash} from 'node:crypto'
import {readFileSync, writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

export const GLION = {funicular: 'ch:1:sloid:30031', railway: 'ch:1:sloid:1370', territet: 'ch:1:sloid:30673', summit: 'ch:1:sloid:1369'}
const sha = value => createHash('sha256').update(value).digest('hex')
const archiveSha = 'd325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e'
const assert = (condition, message) => { if (!condition) throw new Error(message) }

// Type 2 is a minimum timetable interval, not a timed/waiting guarantee.
export function eligibleGlionTransfer(arrival, departure, minimumSeconds) {
  return Number.isInteger(minimumSeconds) && minimumSeconds >= 0
    && arrival.dropOff === '0' && departure.pickup === '0'
    && Number.isInteger(arrival.arrival) && Number.isInteger(departure.departure)
    && departure.departure - arrival.arrival >= minimumSeconds
}

export function auditGlionInterchange(source, territet, rochers) {
  assert(source.archiveSha256 === archiveSha && source.serviceDate === '2026-09-04' && source.feedVersion === '20260902', 'Unreviewed transfer source')
  for (const study of [territet, rochers]) {
    assert(study.metadata.serviceDate === source.serviceDate && study.metadata.feedVersion === source.feedVersion && study.metadata.sources.timetable.sha256 === archiveSha, 'Mismatched dated journey source')
  }
  assert(source.pathwaysPresent === false, 'Pathway evidence changed; review required')
  const stops = source.files['stops.txt'].rows
  const funi = stops.find(s => s.stop_id === GLION.funicular), rail = stops.find(s => s.stop_id === GLION.railway)
  assert(stops.length === 4 && funi?.parent_station && rail?.parent_station && funi.parent_station !== rail.parent_station, 'Glion stop families changed')
  const family = new Set(stops.map(s => s.stop_id))
  const direct = source.files['transfers.txt'].rows.filter(r => family.has(r.from_stop_id) && family.has(r.to_stop_id))
  assert(direct.length === 2, 'Glion transfer precedence changed')
  for (const [from, to] of [[GLION.funicular, GLION.railway], [GLION.railway, GLION.funicular]]) {
    assert(direct.some(r => r.from_stop_id === from && r.to_stop_id === to && r.transfer_type === '2' && r.min_transfer_time === '60' && ['from_route_id', 'to_route_id', 'from_trip_id', 'to_trip_id', 'service_id'].every(k => r[k] === '')), 'Glion minimum or transfer scope changed')
  }
  const connections = []
  const funicular = Object.entries(territet.trips)
  for (const [railwayTripId, trip] of Object.entries(rochers.trips)) {
    const calls = trip.calls, at = calls.findIndex(c => c.stopId === GLION.railway)
    const ascent = calls.at(-1).stopId === GLION.summit
    if (!ascent && calls[0].stopId !== GLION.summit) continue
    assert(at > 0 && at < calls.length - 1, 'Missing intermediate Glion call')
    const railCall = calls[at]
    const railLeg = ascent ? calls.slice(at) : calls.slice(0, at + 1)
    if ((ascent ? railLeg.at(-1).dropOff : railLeg[0].pickup) !== '0') continue
    const candidates = funicular.filter(([, f]) => {
      const first = f.calls[0], last = f.calls.at(-1)
      return ascent
        ? first.stopId === GLION.territet && first.pickup === '0' && last.stopId === GLION.funicular && eligibleGlionTransfer(last, railCall, 60)
        : first.stopId === GLION.funicular && last.stopId === GLION.territet && last.dropOff === '0' && eligibleGlionTransfer(railCall, first, 60)
    }).sort((a, b) => ascent ? b[1].calls.at(-1).arrival - a[1].calls.at(-1).arrival : a[1].calls[0].departure - b[1].calls[0].departure)
    if (!candidates.length) continue
    const [funicularTripId, funicularTrip] = candidates[0]
    const arrival = ascent ? funicularTrip.calls.at(-1).arrival : railCall.arrival
    const departure = ascent ? railCall.departure : funicularTrip.calls[0].departure
    connections.push({direction: ascent ? 'ascent' : 'descent', railwayTripId, funicularTripId,
      start: ascent ? funicularTrip.calls[0].departure : railLeg[0].departure,
      end: ascent ? railLeg.at(-1).arrival : funicularTrip.calls.at(-1).arrival,
      transfer: {fromStopId: ascent ? GLION.funicular : GLION.railway, toStopId: ascent ? GLION.railway : GLION.funicular, arrival, departure, minimumSeconds: 60, intervalSeconds: departure - arrival, spareSeconds: departure - arrival - 60, guaranteed: false, path: null},
      legs: ascent ? [{tripId: funicularTripId, calls: funicularTrip.calls}, {tripId: railwayTripId, calls: railLeg}] : [{tripId: railwayTripId, calls: railLeg}, {tripId: funicularTripId, calls: funicularTrip.calls}]})
  }
  connections.sort((a, b) => a.start - b.start || a.railwayTripId.localeCompare(b.railwayTripId))
  return {serviceDate: source.serviceDate, feedVersion: source.feedVersion, archiveSha256: archiveSha,
    policy: 'Latest qualifying funicular arrival per summit ascent; earliest qualifying funicular departure per summit descent. Ordinary public boarding/alighting only. No arbitrary maximum wait.',
    summary: {ascents: connections.filter(c => c.direction === 'ascent').length, descents: connections.filter(c => c.direction === 'descent').length},
    walkingGeometryEstablished: false, connections}
}

export function buildGlionAudit(root = new URL('../', import.meta.url)) {
  const read = name => readFileSync(new URL(name, root))
  const source = JSON.parse(read('data/glion-transfer-source.json'))
  const datasets = ['territet', 'rochers'].map(name => {
    const bytes = read(`data/${name}-journey-source.json`)
    assert(sha(bytes) === source[`${name}SourceSha256`], 'Journey calls changed; re-extract and review')
    return JSON.parse(bytes)
  })
  const result = auditGlionInterchange(source, ...datasets)
  assert(result.summary.ascents === 10 && result.summary.descents === 10, 'Summit coverage changed')
  return result
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = buildGlionAudit()
  writeFileSync(new URL('../data/glion-interchange-audit.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result.summary))
}
