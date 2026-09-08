import assert from 'node:assert/strict'
import { loadLuzernOsmBoats } from './luzern-osm-boats.mjs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { lineGraph, directedPatternKey } from './luzern-line-geometry.mjs'
import { luzernRailInputs } from './luzern-rail-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { auditZugBoatWater } from './zug-boat-geometry.mjs'
import { inWater, distanceMetres } from './water-paths.mjs'

export const LUZERN_LAKE_GRIDS = [
  { id: 'lucerne', xs: [8.25, 8.35, 8.45, 8.55, 8.65], ys: [46.85, 46.94, 47.03, 47.12], shorelineId: 93, waterNumber: 9179, agencyId: '185' },
  { id: 'hallwil', xs: [8.18, 8.26], ys: [47.23, 47.28, 47.33], shorelineId: 90, waterNumber: 9172, agencyId: '181' },
]
const shipping = rows => rows.filter(f => f.properties.objval?.trim() === 'Kursschiff_Linie')
export function luzernBoatInputs(raw) {
  const routes = raw.inventory.filter(r => r.mode === 'boat'), inputs = luzernRailInputs(raw, { routes })
  inputs.inventory = routes.map(({ routeId, agencyId, line, mode, routeType }) => ({ routeId, agencyId, line, mode, routeType }))
  return inputs
}

export function luzernBoatSources(pages, requests, policy) {
  const lakePage = pages.get('lakes.json.gz'), features = new Map(), lakes = new Map(), memberships = new Map()
  assert.equal(lakePage.results.length, requests.find(r => r.file === 'lakes.json.gz')?.count)
  assert(lakePage.results.length < 200, 'Capped lake response')
  assert.equal(requests.length, 15, 'Missing or extra source request')
  for (const grid of LUZERN_LAKE_GRIDS) {
    const water = lakePage.results.filter(f => f.id === grid.shorelineId)
    assert.equal(water.length, 1, 'Missing/duplicate shoreline')
    assert.equal(water[0].properties.gewaesserkennzahl, grid.waterNumber)
    assert.equal(water[0].geometry.type, 'MultiPolygon'); assert.equal(water[0].layerBodId, 'ch.bafu.vec25-seen')
    const polygons = water[0].geometry.coordinates, candidates = new Map()
    for (let x = 0; x < grid.xs.length - 1; x++) for (let y = 0; y < grid.ys.length - 1; y++) {
      const file = `${grid.id}-${x}-${y}.json.gz`, request = requests.find(r => r.file === file), page = pages.get(file)
      assert(request && page, 'Missing shipping tile')
      assert.deepEqual(request.bounds, [grid.xs[x], grid.ys[y], grid.xs[x + 1], grid.ys[y + 1]])
      const url = new URL(request.url)
      assert.equal(url.searchParams.get('geometry'), request.bounds.join(',')); assert.equal(url.searchParams.get('limit'), '200')
      assert.equal(page.results.length, request.count); assert(request.count < 200, 'Capped shipping tile')
      for (const f of shipping(page.results)) {
        assert.equal(f.layerBodId, 'ch.swisstopo.vec200-transportation-oeffentliche-verkehr'); assert.equal(f.geometry.type, 'LineString')
        if (features.has(f.id)) assert.deepEqual(features.get(f.id), f, 'Conflicting source duplicate')
        features.set(f.id, f); candidates.set(f.id, f)
      }
    }
    // Select only source curves with a vertex in this retained lake polygon.
    // Every other regional shipping feature remains in the inventory.
    const selected = [...candidates.values()].filter(f => f.geometry.coordinates.some(p => polygons.some(poly => inWater(p, poly))))
    assert.deepEqual(selected.map(f => f.id).sort(), policy.lakes.find(l => l.id === grid.id)?.featureIds, 'Changed lake feature membership')
    for (const f of selected) { const ids = memberships.get(f.id) ?? []; ids.push(grid.id); memberships.set(f.id, ids) }
    lakes.set(grid.id, { polygons, features: selected, graph: lineGraph(selected) })
  }
  assert.deepEqual([...features.keys()].sort(), policy.sourceFeatureIds, 'Changed regional shipping inventory')
  return { lakes, inventory: [...features.values()].map(f => ({ id: f.id, properties: f.properties, vertices: f.geometry.coordinates.length,
    sourceSha256: sha256(JSON.stringify(f)), lakes: memberships.get(f.id) ?? [], status: memberships.has(f.id) ? 'candidate-lake-line' : 'outside-reviewed-lakes' })) }
}

export function luzernBoatMatcher(lakes, policy) {
  return { match(train, stops, route) {
    const identity = policy.routes.find(r => r.routeId === train.routeId)
    assert(identity && ['agencyId', 'line', 'mode', 'routeType'].every(k => identity[k] === route[k]), 'Unreviewed boat route identity')
    const grid = LUZERN_LAKE_GRIDS.find(g => g.agencyId === route.agencyId), lake = lakes.get(grid?.id)
    assert(lake, 'Unreviewed boat agency/lake')
    return train.calls.slice(1).map((call, i) => {
      const a = stops.get(train.calls[i].id), b = stops.get(call.id)
      assert([a, b].every(s => s && identity.stopIds.includes(s.stop_id)), 'Unreviewed boat dock identity')
      const from = [Number(a.stop_lon), Number(a.stop_lat)], to = [Number(b.stop_lon), Number(b.stop_lat)]
      assert([from, to].every(p => p.every(Number.isFinite)), 'Invalid boat dock coordinate')
      const result = matchBaselSegment(lake.graph, from, to, policy.limits)
      const evidence = { geometrySource: 'swisstopo-boat-inference', lake: grid.id, shorelineFeatureIds: [grid.shorelineId], candidateSourceFeatures: lake.features.map(f => f.id).sort() }
      if (!result.path) return { ...evidence, ...result }
      const { path, ...assessment } = result, pathMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
      if (pathMetres > Math.max(policy.limits.detourFloorMetres, distanceMetres(from, to) * policy.limits.detourRatio)) return { ...evidence, ...assessment, reason: 'boat-detour-with-dock-attachments' }
      const water = auditZugBoatWater(path, lake.polygons, [from, to], policy.dockZoneMetres)
      return water.landCrossing ? { ...evidence, ...assessment, pathMetres, water, rejectedGeometrySha256: sha256(JSON.stringify(path)), reason: 'boat-land-crossing' } : { ...evidence, ...result, pathMetres, water }
    })
  } }
}

export function luzernBoatConsensus(inputs, matcher) {
  const stops = new Map(inputs.stops.map(s => [s.stop_id, s])), routes = new Map(inputs.inventory.map(r => [r.routeId, r])), patterns = new Map(), pairs = new Map()
  for (const day of inputs.snapshots) for (const train of day.trains) {
    const key = directedPatternKey(train); if (patterns.has(key)) continue
    const id = sha256(key).slice(0, 20), results = matcher.match(train, stops, routes.get(train.routeId))
    patterns.set(key, { id, routeId: train.routeId, directionId: train.directionId, stopIds: train.calls.map(c => c.id),
      results: results.map(({ path, ...r }) => ({ ...r, geometrySha256: path ? sha256(JSON.stringify(path)) : null })) })
    for (let i = 0; i < results.length; i++) {
      const pairKey = JSON.stringify([train.routeId, train.calls[i].id, train.calls[i + 1].id]), p = pairs.get(pairKey) ?? { ids: new Set(), results: [] }
      p.ids.add(id); p.results.push(results[i]); pairs.set(pairKey, p)
    }
  }
  return { patterns: [...patterns.values()], pairs: new Map([...pairs].map(([key, p]) => {
    const signatures = new Set(p.results.filter(r => r.path).map(r => sha256(JSON.stringify(r.path))))
    const reasons = [...new Set(p.results.filter(r => !r.path).map(r => r.reason)), ...(signatures.size > 1 ? ['boat-pattern-dependent-path'] : [])]
    const { path: _path, ...failedEvidence } = p.results.find(r => !r.path) ?? p.results[0]
    return [key, { ...(reasons.length ? { ...failedEvidence, reason: reasons.join(';') } : p.results[0]), boatPatternIds: [...p.ids].sort() }]
  })) }
}

export async function loadLuzernBoats(config, raw) {
  const bytes = await readFile(config.policyPath), policy = JSON.parse(bytes); assert.equal(sha256(bytes), config.sha256)
  const dir = policy.sourceDirectory, sourceBytes = await readFile(join(dir, 'sources.json')), source = JSON.parse(sourceBytes)
  assert.equal(sha256(sourceBytes), policy.sourceSha256)
  const pages = new Map()
  for (const f of source.files) {
    const b = await readFile(join(dir, f.file)); assert.equal(sha256(b), f.sha256, `Changed boat source ${f.file}`)
    const raw = f.file.endsWith('.gz') ? gunzipSync(b) : b
    if (f.rawSha256) assert.equal(sha256(raw), f.rawSha256)
    if (f.file.endsWith('.json.gz')) pages.set(f.file, JSON.parse(raw))
  }
  const requests = JSON.parse(await readFile(join(dir, 'requests.json')))
  for (const r of requests) assert.equal(r.rawSha256, source.files.find(f => f.file === r.file)?.rawSha256)
  const inputBytes = await readFile(policy.inputs), inputs = JSON.parse(inputBytes); assert.equal(sha256(inputBytes), policy.inputsSha256)
  if (raw) assert.deepEqual(inputs, luzernBoatInputs(raw), 'Boat inputs must cover every complete fixture boat pattern and original dock')
  assert.deepEqual(inputs.dates, policy.dates)
  assert.deepEqual(inputs.inventory, policy.routes.map(({ stopIds: _stopIds, ...r }) => r))
  for (const route of policy.routes) assert.deepEqual(route.stopIds, [...new Set(inputs.snapshots.flatMap(d => d.trains.filter(t => t.routeId === route.routeId).flatMap(t => t.calls.map(c => c.id))))].sort())
  const collection = pages.get('collection.json.gz')
  assert.equal(source.license, collection.license); assert.equal(source.collectionUpdated, collection.updated)
  assert.deepEqual(source.collectionTemporalExtent, collection.extent.temporal.interval)
  for (const route of policy.routes) {
    const grid = LUZERN_LAKE_GRIDS.find(g => g.agencyId === route.agencyId); assert(grid)
    for (const id of route.stopIds) {
      const s = inputs.stops.find(s => s.stop_id === id); assert(s)
      assert(Number(s.stop_lon) >= grid.xs[0] && Number(s.stop_lon) <= grid.xs.at(-1) && Number(s.stop_lat) >= grid.ys[0] && Number(s.stop_lat) <= grid.ys.at(-1), 'Source grid must cover every original dock')
    }
  }
  const sources = luzernBoatSources(pages, requests, policy)
  const consensus = luzernBoatConsensus(inputs, luzernBoatMatcher(sources.lakes, policy))
  const osm = policy.osmSupplement ? await loadLuzernOsmBoats(policy.osmSupplement, inputs, sources.lakes, consensus.pairs, raw) : undefined
  if (osm) {
    assert.equal(osm.audit.policy.shorelineSourceSha256, policy.sourceSha256)
    for (const [key, pair] of osm.pairs) consensus.pairs.set(key, pair)
  }
  return { source, policy, inputs, ...sources, ...consensus, ...(osm ? { osm: osm.audit } : {}) }
}
