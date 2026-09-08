import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { auditZugBoatWater } from './zug-boat-geometry.mjs'
import { reconcileThurgauGeometry } from './thurgau-regional-roads.mjs'

const sha = b => createHash('sha256').update(b).digest('hex')
const identity = (train, raw) => JSON.stringify([train.routeId, train.directionId, train.stops.map(([i]) => raw.stops[i])])

export function thurgauBoatGeometry(features, polygons, policy) {
  assert.deepEqual(features.map(f => f.id).sort(), policy.sourceFeatureIds)
  assert.equal(new Set(features.map(f => f.id)).size, features.length)
  for (const f of features) {
    assert.equal(f.layerBodId, 'ch.swisstopo.vec200-transportation-oeffentliche-verkehr')
    assert.equal(f.properties.objval.trim(), 'Kursschiff_Linie'); assert.equal(f.geometry.type, 'LineString')
  }
  const graph = lineGraph(features)
  return (from, to) => {
    const result = matchBaselSegment(graph, from, to, policy.limits)
    if (!result.path) return result
    const { path, ...evidence } = result, water = auditZugBoatWater(path, polygons, [from, to], policy.dockZoneMetres)
    if (water.landCrossing) return { ...evidence, water, reason: 'boat-outside-reviewed-water', rejectedGeometrySha256: sha(JSON.stringify(path)) }
    return { ...result, water }
  }
}

export async function loadThurgauBoats(timetable) {
  const dir = 'data/thurgau-boat-sources', policyBytes = await readFile('data/thurgau-boat-policy.json'), policy = JSON.parse(policyBytes)
  const sourceBytes = await readFile(`${dir}/sources.json`), source = JSON.parse(sourceBytes)
  assert.equal(sha(sourceBytes), policy.sourceSha256)
  const timetableBytes = await readFile('data/thurgau-audit/timetable-cache.json.gz')
  assert.equal(sha(timetableBytes), policy.timetableSha256)
  assert.deepEqual(timetable, JSON.parse(gunzipSync(timetableBytes)), 'Changed boat timetable')
  assert.deepEqual(policy.dates, timetable.snapshots.map(d => d.metadata.serviceDate))
  assert.deepEqual(policy.routes, timetable.routes.filter(r => r.mode === 'ferry').map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, type: r.type })))
  for (const f of source.files) assert.equal(sha(await readFile(`${dir}/${f.file}`)), f.sha256, `Changed boat source ${f.file}`)
  const requests = JSON.parse(await readFile(`${dir}/requests.json`)), features = new Map()
  assert.equal(requests.length, 30)
  for (let x = 0; x < 10; x++) for (let y = 0; y < 3; y++) {
    const r = requests.find(r => r.file === `tile-${x}-${y}.json.gz`)
    assert(r, 'Missing shipping tile')
    assert.deepEqual(r.bounds, [8.6 + x * .1, 47.45 + y * .11, 8.7 + x * .1, 47.56 + y * .11].map(n => Number(n.toFixed(4))))
    const bytes = gunzipSync(await readFile(`${dir}/${r.file}`)), rows = JSON.parse(bytes).results
    assert.equal(sha(bytes), r.rawSha256); assert.equal(rows.length, r.count); assert(r.count < 200)
    for (const f of rows.filter(f => f.properties.objval?.trim() === 'Kursschiff_Linie')) {
      if (features.has(f.id)) assert.deepEqual(f, features.get(f.id))
      features.set(f.id, f)
    }
  }
  const lakes = JSON.parse(gunzipSync(await readFile(`${dir}/lakes.json.gz`))).results
  const polygons = policy.shorelineFeatureIds.flatMap(id => {
    const fs = lakes.filter(f => f.id === id); assert.equal(fs.length, 1)
    assert.equal(fs[0].layerBodId, 'ch.bafu.vec25-seen'); assert.equal(fs[0].geometry.type, 'MultiPolygon')
    return fs[0].geometry.coordinates
  })
  const routeIds = new Set(policy.routes.map(r => r.routeId))
  const patterns = new Set(timetable.snapshots.flatMap(d => d.trains.filter(t => routeIds.has(t.routeId)).map(t => identity(t, d))))
  const match = thurgauBoatGeometry([...features.values()], polygons, policy), cache = new Map()
  return { policy, source, policySha256: sha(policyBytes), polygons, features: [...features.values()],
    inventory: [...features.values()].map(f => ({ id: f.id, properties: f.properties, vertices: f.geometry.coordinates.length, featureSha256: sha(JSON.stringify(f)), status: 'candidate-cartographic-shipping-line' })),
    matchPattern(train, raw, route) {
      assert(policy.routes.some(r => r.routeId === train.routeId && r.agencyId === train.agencyId && r.line === train.route && r.type === route.type), 'Changed boat route identity')
      assert(patterns.has(identity(train, raw)), 'Unreviewed boat dock chain or coordinates')
      return train.stops.slice(1).map(([to], i) => {
        const a = raw.stops[train.stops[i][0]], b = raw.stops[to], key = JSON.stringify([a, b])
        if (!cache.has(key)) cache.set(key, match(a, b))
        return cache.get(key)
      })
    } }
}

export function applyThurgauBoats(raw, result, boats, routes) {
  if (!boats) return result
  const patterns = new Map(result.patterns.map(p => [p.id, p])), seen = new Set()
  const indexes = new Map(result.paths.map((p, i) => [JSON.stringify(p), i]))
  for (const train of result.trains) {
    const route = routes.get(train.routeId), pattern = patterns.get(train.patternId)
    if (route.mode !== 'ferry' || train.reservationRequired) continue
    if (pattern.matchedSegments === pattern.segmentCount && pattern.geometrySource !== 'swisstopo-boat-inference') continue
    if (!seen.has(pattern.id)) {
      seen.add(pattern.id)
      const segments = boats.matchPattern(train, raw, route), complete = segments.every(s => s.path)
      pattern.boatSupplement = { status: complete ? 'admitted' : 'rejected-incomplete-pattern',
        segments: segments.map(({ path, ...s }) => ({ ...s, geometrySha256: path ? sha(JSON.stringify(path)) : null })) }
      if (complete) {
        pattern.officialMatchedSegments = pattern.matchedSegments; pattern.geometrySource = 'swisstopo-boat-inference'
        pattern.pathSegments = segments.map(s => {
          const key = JSON.stringify(s.path)
          if (!indexes.has(key)) { indexes.set(key, result.paths.length); result.paths.push(s.path) }
          return indexes.get(key)
        })
        pattern.matchedSegments = pattern.segmentCount
      }
    }
    if (pattern.geometrySource === 'swisstopo-boat-inference') {
      train.pathSegments = pattern.pathSegments; train.admission = 'admitted'; train.geometrySource = pattern.geometrySource
    } else train.admission = 'incomplete-boat-pattern'
  }
  return reconcileThurgauGeometry(raw, result)
}
