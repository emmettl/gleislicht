import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { distanceMetres, sliceShape } from './enrich-postbus-roads.mjs'
import { projectRailStop } from './lausanne-rail-geometry.mjs'
import { BASEL_CORE_RAIL_LIMITS, coreEdgePaths } from './basel-core-geometry.mjs'
import { BASEL_DIVERSION_LIMITS } from './basel-tram-diversions.mjs'
import { BASEL_PATH_LIMITS } from './basel-line-geometry.mjs'
import { lv95ToWgs84 } from './ingest-national-road-topology.mjs'

const measure = points => {
  let distance = 0
  return points.map((point, i) => {
    if (i) distance += distanceMetres(points[i - 1], point)
    return [...point, distance]
  })
}
const key = (route, from, to) => JSON.stringify([route, from, to])

export function baselPlatformPatternHash(train, stops) {
  const platforms = train.stops.map(([index]) => [stops[index][4], ...stops[index].slice(0, 2)])
  return createHash('sha256').update(JSON.stringify(platforms)).digest('hex')
}

// Reviewed source parts are an ordered physical corridor, not a general
// shortest-path graph. This prevents a closed street or an earlier side road
// from becoming a numerically attractive substitute for a dated diversion.
export function reviewedBaselPath(rule, bundle, from, to) {
  assert.deepEqual(from.slice(0, 2), rule.fromCoordinate, 'Reviewed Basel departure platform moved')
  assert.deepEqual(to.slice(0, 2), rule.toCoordinate, 'Reviewed Basel arrival platform moved')
  assert(rule.parts.length > 0, 'Empty reviewed Basel corridor')
  const parts = rule.parts.map(part => {
    const feature = bundle.features[part.featureId]
    assert(feature && bundle.provenance[feature.source], 'Unknown reviewed geometry source')
    const points = feature.points
    assert(points.length >= 2 && points.every(p => p.length === 2 && p.every(Number.isFinite)), 'Invalid reviewed geometry coordinates')
    assert([part.from, part.to].every(i => Number.isInteger(i) && i >= 0 && i < points.length) && part.from !== part.to, 'Invalid reviewed source range')
    const reverse = part.from > part.to
    if (feature.source === 'tlmRoad') {
      assert(/^\d+m Strasse$/.test(feature.properties.OBJEKTART), 'Reviewed TLM bus corridor is not a road')
      assert.equal(feature.properties.VERKEHRSBE, 'Keine', 'Reviewed TLM road has a traffic restriction')
      assert.equal(feature.properties.RICHTUNGSG, 'Falsch', 'Review direction-specific TLM road before use')
      assert.deepEqual(points, feature.sourceCoordinates.map(lv95ToWgs84), 'Reviewed TLM road differs from source coordinates')
    }
    if (feature.source === 'osm') {
      assert(!['yes', '1'].includes(feature.properties.oneway) || !reverse, 'Reviewed road runs against one-way source')
      assert(feature.properties.oneway !== '-1' || reverse, 'Reviewed road runs against reverse one-way source')
      assert(!['platform', 'footway', 'path', 'cycleway', 'steps'].includes(feature.properties.highway), 'Reviewed bus corridor is not a road')
    }
    const selected = points.slice(Math.min(part.from, part.to), Math.max(part.from, part.to) + 1)
    return reverse ? selected.reverse() : selected
  })
  const points = [...parts[0]]
  for (const part of parts.slice(1)) {
    assert.deepEqual(points.at(-1), part[0], 'Disconnected reviewed source parts; synthetic joins are forbidden')
    points.push(...part.slice(1))
  }
  const limits = rule.mode === 'rail' ? BASEL_CORE_RAIL_LIMITS : rule.mode === 'tram' ? BASEL_DIVERSION_LIMITS : BASEL_PATH_LIMITS
  const shape = measure(points), first = measure(parts[0]), last = measure(parts.at(-1))
  // Pin endpoint projections to the reviewed entry/exit parts. A loop passing
  // close to the departure later must not erase its required initial movement.
  const a = projectRailStop(from, [{ id: 'entry', shape: first }], limits.snapMetres)
  const b = projectRailStop(to, [{ id: 'exit', shape: last }], limits.snapMetres)
  assert(a && b, 'Reviewed Basel path exceeds endpoint snap guard')
  const end = shape.at(-1)[2] - last.at(-1)[2] + b.distance
  const pathMetres = end - a.distance, direct = distanceMetres(from, to)
  assert(pathMetres >= Math.max(1, direct > 30 ? direct * 0.5 : 1), 'Collapsed or reversed reviewed Basel path')
  const maximum = Math.max(limits.detourFloorMetres, direct * limits.detourRatio)
  const interior = sliceShape(shape, a.distance, end)
  assert(interior?.length >= 2, 'Empty reviewed Basel path')
  const path = [from.slice(0, 2), ...interior, to.slice(0, 2)]
    .map(p => p.map(x => Number(x.toFixed(7))))
    .filter((p, i, all) => !i || distanceMetres(all[i - 1], p) > 0.01)
  assert(measure(path).at(-1)[2] <= maximum, 'Reviewed Basel path exceeds detour guard')
  return { path, pathMetres, maximumSnapMetres: Math.max(a.snapMetres, b.snapMetres) }
}

export function applyReviewedBaselGeometry(snapshot, routes, bundle) {
  assert.equal(bundle.schemaVersion, 1)
  assert.equal(snapshot.metadata.feedVersion, bundle.feedVersion, 'Reviewed Basel feed changed')
  assert(bundle.serviceDates.includes(snapshot.metadata.serviceDate), 'Unreviewed Basel repair date')
  assert(snapshot.metadata.sourceServiceDates.every(date => bundle.sourceServiceDates.includes(date)), 'Unreviewed Basel repair source date')
  const rules = new Map()
  for (const rule of bundle.rules) {
    const id = key(rule.routeId, rule.fromId, rule.toId)
    assert(!rules.has(id), 'Duplicate reviewed Basel pair')
    assert(bundle.evidence[rule.evidence] || bundle.provenance[rule.evidence], 'Missing Basel corridor evidence')
    if (rule.patternSha256) assert(rule.patternSha256.length > 0 && rule.patternSha256.every(hash => /^[a-f0-9]{64}$/.test(hash)), 'Invalid reviewed Basel pattern hashes')
    rules.set(id, rule)
  }
  const paths = [...snapshot.paths], pathIndices = new Map(paths.map((path, i) => [JSON.stringify(path), i])), decisions = new Map()
  const patternHashes = new Map()
  const trains = snapshot.trains.map(train => ({ ...train, pathSegments: train.pathSegments.map((existing, i) => {
    if (existing !== null) return existing
    const from = snapshot.stops[train.stops[i][0]], to = snapshot.stops[train.stops[i + 1][0]]
    const rule = rules.get(key(train.routeId, from[4], to[4]))
    if (!rule) return null
    // Depot turns are reviewed in their complete ordered platform context.
    // The same adjacent pair in a new pattern does not inherit that review.
    if (rule.patternSha256) {
      if (!patternHashes.has(train)) patternHashes.set(train, baselPlatformPatternHash(train, snapshot.stops))
      if (!rule.patternSha256.includes(patternHashes.get(train))) return null
    }
    const route = routes.get(train.routeId)
    assert(route.agencyId === rule.agencyId && route.mode === rule.mode && train.route === rule.line, 'Reviewed Basel operator/line/mode changed')
    let decision = decisions.get(rule.id)
    if (!decision) {
      const { path, ...metrics } = reviewedBaselPath(rule, bundle, from, to)
      const signature = JSON.stringify(path)
      if (!pathIndices.has(signature)) { pathIndices.set(signature, paths.length); paths.push(path) }
      decision = { ruleId: rule.id, routeId: rule.routeId, mode: rule.mode, line: rule.line, fromId: rule.fromId, toId: rule.toId,
        pathIndex: pathIndices.get(signature), sourceFeatureIds: [...new Set(rule.parts.map(part => part.featureId))], ...metrics, occurrences: 0 }
      decisions.set(rule.id, decision)
    }
    decision.occurrences++
    return decision.pathIndex
  }) }))
  const updated = { ...snapshot, paths, trains }
  updated.edgePaths = coreEdgePaths(updated)
  return { snapshot: updated, review: { reviewedOn: bundle.reviewedOn, sources: bundle.provenance, evidence: bundle.evidence,
    addedMovements: [...decisions.values()].reduce((sum, item) => sum + item.occurrences, 0), decisions: [...decisions.values()] } }
}
