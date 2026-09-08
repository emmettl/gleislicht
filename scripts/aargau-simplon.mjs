import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { simplonGraph } from './aargau-simplon-graph.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export const SIMPLON_POLICY = 'data/aargau-simplon-policy.json'
const root = 'data/aargau-simplon-sources'
const read = async file => JSON.parse(await readFile(file, 'utf8'))

export async function simplonGeometry(policy) {
  const osm = JSON.parse(gunzipSync(await readFile(`${root}/osm.json.gz`)))
  const stations = await read(`${root}/sbb-domodossola-stations.json`)
  const record = stations.results.filter(r => r.number === 8501607)
  assert.equal(record.length, 1)
  assert.equal(record[0].designationofficial, 'Domodossola')
  assert.equal(record[0].fotcomment, 'Fahrplan unter 8301003 (Ausland)')
  assert.equal(record[0].operatingpointtechnicaltimetabletype, 'ASSIGNED_OPERATING_POINT')
  assert((await readFile(`${root}/rail.overpass`, 'utf8')).includes(`[date:"${policy.graph.snapshot}"]`))
  const crossing = osm.elements.find(e => e.type === 'way' && e.id === 643956810)
  assert.equal(crossing?.tags.service, 'crossover')
  assert.equal(crossing.tags.gauge, '1435')
  assert.equal(crossing.tags.passenger_lines, '2')
  assert.equal(crossing.tags['tunnel:name'], 'Simplontunnel')
  const graph = simplonGraph(osm, policy.graph)
  const [from, to] = policy.pair
  assert.equal(from[4], 'ch:1:sloid:1609:3:6'); assert.equal(to[4], '8301003')
  // The official FOT comment establishes this exact station-code association.
  // Use it only at the internal graph boundary; the GTFS destination is retained.
  const result = graph.match({ stop_id: from[4], stop_lon: from[0], stop_lat: from[1] }, { stop_id: '8501607', stop_lon: to[0], stop_lat: to[1] })
  assert(result.path, result.reason)
  result.path[0] = from.slice(0, 2); result.path[result.path.length - 1] = to.slice(0, 2)
  result.pathMetres = result.path.slice(1).reduce((n, p, i) => n + distanceMetres(result.path[i], p), 0)
  assert(result.pathMetres <= policy.graph.limits.maximumPathMetres)
  assert(result.directedSourceSegments.some(s => s.id === 'osm-way:643956810'))
  return { ...result, geometrySource: 'osm-rail', toOperatingPoint: '8301003', osmStationNumber: '8501607',
    identityEvidence: { recordNumber: record[0].number, comment: record[0].fotcomment, editionDate: record[0].editiondate },
    reviewedCrossoverWayId: crossing.id }
}

export function simplonMatcher(policy, geometry, date) {
  return { overrideSegment(train, stops, index, previous) {
    if (previous.path) return previous
    const r = policy.rules.find(r => r.date === date && r.sourceTripId === train.sourceTripId && r.routeId === train.routeId && r.agencyId === train.agencyId && r.mode === train.category && r.line === train.route && r.directionId === train.directionId && r.shortName === train.shortName && r.segmentIndex === index && JSON.stringify(r.stops) === JSON.stringify(stops) && JSON.stringify(r.calls) === JSON.stringify(train.calls))
    if (!r) return previous
    assert.equal(previous.railFailure, 'no-exact-operating-point')
    assert.equal(geometryDigest(geometry.path), policy.pathSha256, 'Changed Simplon geometry')
    const { path: _path, ...evidence } = geometry
    assert.deepEqual(evidence, policy.geometryEvidence)
    return { ...geometry, agisRejection: previous.reason, railRejection: previous.railFailure, simplonRuleId: r.id }
  } }
}

export async function loadSimplon() {
  const policy = await read(SIMPLON_POLICY)
  for (const [file, sha] of Object.entries(policy.files)) assert.equal(await hashFile(file), sha, `Changed Simplon evidence: ${file}`)
  const geometry = await simplonGeometry(policy)
  return { policy, geometry, forDate: date => simplonMatcher(policy, geometry, date) }
}
