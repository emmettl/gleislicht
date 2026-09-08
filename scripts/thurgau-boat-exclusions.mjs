import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { auditZugBoatWater } from './zug-boat-geometry.mjs'
import { distanceMetres, inWater } from './water-paths.mjs'

const sha = b => createHash('sha256').update(b).digest('hex')
const identity = p => JSON.stringify([p.routeId, p.agencyId, p.line, p.directionId, p.calls])
const pairKey = (a, b) => JSON.stringify([a[4], b[4]].sort())
const definitions = [
  ['ch:1:sloid:6165', '8099992', [1255999697]],
  ['ch:1:sloid:6112', '8014614', [1349934339]],
  ['ch:1:sloid:6153', 'ch:1:sloid:1101745', [25489346]],
  ['ch:1:sloid:1101477', 'ch:1:sloid:6157', [25489405]],
  ['ch:1:sloid:6162', 'ch:1:sloid:6163', [25490099]],
  ['ch:1:sloid:6163', '8014587', [1332894191, 1385573014]],
  ['8014587', 'ch:1:sloid:6165', [1385573015, 377312186]],
]
function elements(response, snapshot) {
  assert(!response.remark, 'Incomplete exclusion-review response')
  const result = new Map()
  for (const e of response.elements) {
    assert(e.timestamp <= snapshot, 'Unreviewed exclusion source date')
    const key = `${e.type}:${e.id}`
    if (result.has(key)) assert.deepEqual(e, result.get(key), 'Conflicting exclusion source duplicates')
    result.set(key, e)
  }
  return result
}

// These candidates are diagnostics, never inputs to the admission adapter.
export function reviewThurgauBoatExclusions(timetable, shipping, boats, osm, dockResponse, source) {
  const ferryElements = elements(osm, source.snapshot), docks = elements(dockResponse, source.snapshot)
  const remaining = shipping.patterns.filter(p => !p.admitted)
  assert.equal(remaining.length, 6, 'Changed remaining boat-pattern scope')
  const stops = new Map(remaining.flatMap(p => p.calls).map(s => [s[4], s]))
  const candidates = new Map(definitions.map(([a, b, ids]) => {
    const ways = ids.map(id => { const w = ferryElements.get(`way:${id}`); assert.equal(w?.tags.route, 'ferry'); return w })
    if (ways.length === 2) assert(ways[0].nodes.some(n => ways[1].nodes.includes(n)), 'Disconnected exact candidate ways')
    const features = ways.map(w => ({ id: String(w.id), geometry: { type: 'LineString', coordinates: w.nodes.map(id => {
      const n = ferryElements.get(`node:${id}`); assert(n, 'Missing candidate node'); return [n.lon, n.lat]
    }) } }))
    return [pairKey(stops.get(a), stops.get(b)), { graph: lineGraph(features), ways, features }]
  }))
  const diagnosticLimits = { ...boats.policy.limits, alternativeSnapMetres: 0 }
  assert.equal(diagnosticLimits.snapMetres, 150)
  const pairs = new Map()
  const patterns = remaining.map(p => {
    const failures = []
    for (const [i, segment] of p.segments.entries()) {
      if (segment.path) continue
      const a = p.calls[i], b = p.calls[i + 1], key = JSON.stringify([a, b])
      if (!pairs.has(key)) {
        const candidate = candidates.get(pairKey(a, b)); assert(candidate, 'Missing remaining-pair review')
        const result = matchBaselSegment(candidate.graph, a, b, diagnosticLimits)
        const water = result.path ? auditZugBoatWater(result.path, [...boats.polygons, shipping.riverPolygon], [a, b], boats.policy.dockZoneMetres) : null
        const { path, ...metrics } = result
        pairs.set(key, { key, from: a, to: b, originalFailure: segment, candidateWays: candidate.ways,
          candidateGeometry: candidate.features, ...metrics, water,
          candidatePathSha256: path ? sha(JSON.stringify(path)) : null,
          diagnosticResult: result.reason ?? (water.landCrossing ? 'outside-reviewed-water' : 'geometry-screen-passed-only'),
          operatingCaveat: candidate.ways.some(w => w.id === 25489346) ? source.operatorContext[1] : null,
          admission: 'excluded-full-pattern', diagnosticOnly: true })
      }
      failures.push({ segmentIndex: i, pairKey: key })
    }
    assert(failures.length, 'Excluded pattern without a failed segment')
    return { routeId: p.routeId, agencyId: p.agencyId, line: p.line, directionId: p.directionId, calls: p.calls, days: p.days, failures, key: identity(p) }
  })
  const dockIdentities = [['8099992', 290061019], ['8014614', 3812445457], ['ch:1:sloid:1101477', 277746593]].map(([stopId, nodeId]) => {
    const stop = stops.get(stopId), node = docks.get(`node:${nodeId}`)
    assert.equal(node?.tags.amenity, 'ferry_terminal')
    assert.deepEqual(node, ferryElements.get(`node:${nodeId}`), 'Dock and ferry snapshots disagree')
    return { stop, node, distanceMetres: distanceMetres(stop, [node.lon, node.lat]),
      gtfsInReviewedWater: boats.polygons.some(p => inWater(stop, p)), osmInReviewedWater: boats.polygons.some(p => inWater([node.lon, node.lat], p)),
      identityEvidence: stopId === '8099992' ? 'Exact OSM uic_ref 8099992; coordinates still disagree.' : stopId === '8014614' ? 'Named Immenstaad BSB terminal; no exact GTFS identifier in its tags.' : 'Named URh Hemmenhofen terminal; historical uic_ref 8506189 differs from the selected GTFS stop identity.',
      pierWays: [...docks.values()].filter(e => e.type === 'way' && e.tags?.man_made === 'pier' && e.nodes.includes(nodeId)).map(w => w.id) }
  })
  assert.equal(dockIdentities[0].node.tags.uic_ref, '8099992')
  const days = timetable.snapshots.map(raw => {
    const journeys = raw.trains.filter(t => patterns.some(p => p.key === identity({ routeId: t.routeId, agencyId: t.agencyId, line: t.route, directionId: t.directionId, calls: t.stops.map(([i]) => raw.stops[i]) })))
      .map(t => ({ ...t, stops: t.stops.map(([i, ...times]) => [raw.stops[i], ...times]) }))
    const date = raw.metadata.serviceDate
    for (const p of patterns) assert.equal(journeys.filter(t => identity({ routeId: t.routeId, agencyId: t.agencyId, line: t.route, directionId: t.directionId, calls: t.stops.map(([s]) => s) }) === p.key).length, p.days[date] ?? 0)
    assert.equal(journeys.length, 12, 'Changed dated boat exclusions')
    return { date, excludedJourneys: journeys.length, journeys }
  })
  return { source, diagnosticLimits, dockZoneMetres: boats.policy.dockZoneMetres,
    method: 'Exact named ferry-way candidates, keeping both GTFS endpoints and original full patterns. Two-way candidates use existing shared source nodes only. Screen against the original 150 m boat limits and both original lakes plus the already-reviewed Rhine polygon. Geometry-screen success is not admission; docks, operator context and all other segments still require review.',
    nextEvidence: 'Resolve the three dock-coordinate discrepancies with authoritative stop/berth evidence; acquire and review missing Seerhein water; establish the mode and geometry of the published Stein–Öhningen replacement before considering its GTFS boat chain. No source-based coordinate correction is applied here.',
    pairs: [...pairs.values()], patterns, days, dockIdentities,
    dockInventory: [...docks.values()].filter(e => e.type !== 'node' || e.tags).map(e => ({ ...e, status: dockIdentities.some(d => e.type === 'node' && d.node.id === e.id) ? 'reviewed-terminal-coordinate-conflict' : 'context-only-not-routing-geometry' })),
    dockResponseElements: dockResponse.elements.length, dockUniqueElements: docks.size }
}

export async function loadThurgauBoatExclusions(timetable, shipping, boats) {
  const dir = 'data/thurgau-boat-exclusion-sources', bytes = await readFile(`${dir}/sources.json`), source = JSON.parse(bytes)
  for (const f of source.files) assert.equal(sha(await readFile(`${dir}/${f.file}`)), f.sha256, 'Changed boat-exclusion source')
  for (const f of source.inputs) assert.equal(sha(await readFile(f.file)), f.sha256, 'Changed boat-exclusion baseline')
  assert((await readFile(`${dir}/query.txt`, 'utf8')).includes(`[date:"${source.snapshot}"]`))
  const osm = JSON.parse(gunzipSync(await readFile('data/thurgau-shipping-sources/osm.json.gz')))
  const docks = JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`)))
  return { ...reviewThurgauBoatExclusions(timetable, shipping, boats, osm, docks, source), sourceSha256: sha(bytes) }
}
