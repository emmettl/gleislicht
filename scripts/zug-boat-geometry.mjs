import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { distanceMetres, inWater } from './water-paths.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const cross = (a, b) => a[0] * b[1] - a[1] * b[0]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const shipping = response => response.results.filter(f => f.properties.objval?.trim() === 'Kursschiff_Linie')

// Check every open interval between shoreline intersections, including holes
// and disjoint polygon parts. Never use fixed-step sampling that skips islands.
// Generalized source linework and old shorelines can disagree at a dock. Only
// intervals entirely inside ONE actual endpoint's small dock zone may survive.
export function auditZugBoatWater(path, polygons, docks, dockZoneMetres) {
  const outside = []
  for (let segment = 0; segment < path.length - 1; segment++) {
    const a = path[segment], b = path[segment + 1], d = sub(b, a), cuts = [0, 1]
    for (const polygon of polygons) for (const ring of polygon) for (let i = 0; i < ring.length; i++) {
      const c = ring[i], e = sub(ring[(i + 1) % ring.length], c), q = sub(c, a), denominator = cross(d, e)
      if (Math.abs(denominator) < 1e-15) continue
      const t = cross(q, e) / denominator, u = cross(q, d) / denominator
      if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t)
    }
    cuts.sort((a, b) => a - b)
    for (let i = 1; i < cuts.length; i++) {
      const lo = cuts[i - 1], hi = cuts[i]
      if (hi - lo < 1e-12 || polygons.some(p => inWater(lerp(a, b, (lo + hi) / 2), p))) continue
      const endpoints = [lerp(a, b, lo), lerp(a, b, hi)]
      const dock = docks.findIndex(p => endpoints.every(e => distanceMetres(p, e) <= dockZoneMetres))
      outside.push({ segment, endpoints, lengthMetres: distanceMetres(...endpoints), dock: dock < 0 ? null : dock })
    }
  }
  return { outsideIntervals: outside, dockZoneMetres, landCrossing: outside.some(i => i.dock === null) }
}

export function zugBoatGeometry(pages, lakeResponse, policy) {
  const wide = shipping(pages.wide), byId = new Map(wide.map(f => [f.id, f]))
  assert.equal(wide.length, policy.wideShippingCount, 'Changed regional shipping inventory')
  assert.equal(byId.size, wide.length, 'Duplicate shipping feature')
  const inventory = wide.map(f => ({ id: f.id, properties: f.properties, vertices: f.geometry.coordinates.length, lakes: [] }))
  const candidates = new Map()
  for (const lake of policy.lakes) {
    const features = shipping(pages[lake.id])
    assert.deepEqual(features.map(f => f.id).sort(), [...lake.shippingFeatureIds].sort(), 'Changed lake shipping membership')
    assert.equal(new Set(features.map(f => f.id)).size, features.length)
    for (const f of features) {
      assert.deepEqual(f, byId.get(f.id), 'Lake query differs from regional source')
      assert.equal(f.layerBodId, 'ch.swisstopo.vec200-transportation-oeffentliche-verkehr')
      assert.equal(f.geometry.type, 'LineString')
      inventory.find(i => i.id === f.id).lakes.push(lake.id)
    }
    const polygons = lake.shorelineFeatureIds.flatMap(id => {
      const matches = lakeResponse.results.filter(f => String(f.id) === String(id))
      assert.equal(matches.length, 1, 'Missing or duplicate shoreline part')
      const f = matches[0]
      assert.equal(f.properties.gewaesserkennzahl, lake.gewaesserkennzahl)
      assert.equal(f.geometry.type, 'MultiPolygon')
      return f.geometry.coordinates
    })
    candidates.set(lake.id, { graph: lineGraph(features), polygons, lake })
  }
  return {
    inventory,
    matchPair(route, from, to) {
      const mapping = policy.routes.find(r => ['routeId', 'agencyId', 'line', 'routeType'].every(k => r[k] === route[k]))
      if (!mapping || route.mode !== 'boat') return { reason: 'no-reviewed-boat-geometry' }
      if (![from, to].every(s => mapping.stopIds.includes(s.stop_id))) return { reason: 'boat-dock-identity' }
      const { graph, polygons, lake } = candidates.get(mapping.lake)
      const a = [Number(from.stop_lon), Number(from.stop_lat)], b = [Number(to.stop_lon), Number(to.stop_lat)]
      const result = matchBaselSegment(graph, a, b, policy.limits)
      const evidence = { geometrySource: 'swisstopo-boat-inference', lake: lake.id,
        candidateSourceFeatures: lake.shippingFeatureIds, shorelineFeatureIds: lake.shorelineFeatureIds }
      if (!result.path) return { ...evidence, ...result }
      const water = auditZugBoatWater(result.path, polygons, [a, b], policy.dockZoneMetres)
      const { path, ...assessment } = result
      return water.landCrossing ? { ...evidence, ...assessment, water, rejectedGeometrySha256: sha256(JSON.stringify(path)), reason: 'boat-land-crossing' } : { ...evidence, ...result, water }
    },
  }
}

export async function loadZugBoats(policy) {
  const bytes = await readFile(join(policy.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), policy.sourceSha256, 'Changed boat source catalogue')
  const source = JSON.parse(bytes), pages = {}
  for (const f of source.files) assert.equal(sha256(await readFile(join(policy.sourceDirectory, f.file))), f.sha256, `Changed boat source ${f.file}`)
  for (const id of ['wide', ...policy.lakes.map(l => l.id)]) pages[id] = JSON.parse(await readFile(join(policy.sourceDirectory, `${id}.json`)))
  const lakes = JSON.parse(await readFile(join(policy.sourceDirectory, 'lakes.json')))
  return { ...zugBoatGeometry(pages, lakes, policy), source }
}
