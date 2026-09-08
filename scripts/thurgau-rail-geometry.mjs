import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { parseLuzernRail, luzernRailMatcher, luzernOperatingPoint } from './luzern-rail-geometry.mjs'
import { reconcileThurgauGeometry } from './thurgau-regional-roads.mjs'
import { loadThurgauBorderRail } from './thurgau-border-rail.mjs'
import { loadThurgauSbbRail } from './thurgau-sbb-rail.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
export const isThurgauRailSource = source => ['fot-rail-inference', 'fot-sbb-rail-inference', 'fot-osm-border-rail-inference'].includes(source)
export async function loadThurgauRail(timetable, { sbb = true, border = true } = {}) {
  const directory = 'data/thurgau-rail-sources'
  const policyBytes = await readFile('data/thurgau-rail-policy.json'), policy = JSON.parse(policyBytes)
  const sourceBytes = await readFile(`${directory}/source.json`), source = JSON.parse(sourceBytes)
  assert.equal(sha(sourceBytes), policy.sourceMetadataSha256)
  const bytes = await readFile('data/thurgau-audit/timetable-cache.json.gz')
  assert.equal(sha(bytes), policy.timetableSha256, 'Changed Thurgau rail timetable')
  const raw = JSON.parse(gunzipSync(bytes))
  if (timetable) assert.deepEqual(timetable, raw, 'Rail policy must match the full timetable fixture')
  assert.deepEqual(policy.dates, raw.snapshots.map(s => s.metadata.serviceDate))
  assert.deepEqual(policy.routes, raw.routes.filter(r => r.mode === 'rail' && ['11', '65'].includes(r.agencyId))
    .map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, gauge: 'mm1435' })).sort((a, b) => a.routeId.localeCompare(b.routeId)))
  for (const [file, hash] of Object.entries(source.files)) assert.equal(sha(await readFile(`${directory}/${file}`)), hash, `Changed FOT source ${file}`)
  const xml = gunzipSync(await readFile(`${directory}/network.xtf.gz`)), catalogue = JSON.parse(await readFile(`${directory}/catalogue.json`))
  assert.equal(sha(xml), source.sha256)
  assert.equal(catalogue.assets['schienennetz_2056_de.xtf']['file:checksum'], `1220${sha(xml)}`)
  assert.equal(catalogue.properties.datetime, source.catalogueDate)
  assert.equal(catalogue.assets['schienennetz_2056_de.xtf'].updated, source.assetUpdated)
  const network = parseLuzernRail(xml.toString(), policy.limits.simplificationMetres)
  assert.equal(network.nodes.size, source.nodes); assert.equal(network.segments.length, source.segments)
  const matcher = luzernRailMatcher(network, policy, policy.dates)
  for (const override of policy.operatingPointOverrides) {
    const candidates = [...network.nodes.values()].filter(n => n.number === override.targetNumber)
    assert.equal(candidates.length, 1); assert.equal(candidates[0].name, override.expectedName)
    assert(matcher.sourceInventory.some(s => !s.reason && (s.from === candidates[0].id || s.to === candidates[0].id)))
    assert(policy.routes.some(r => r.routeId === override.routeId && r.gauge === 'mm1435'))
    const stops = raw.snapshots.flatMap(s => s.stops.filter(p => p[4] === override.stopId))
    assert(stops.length > 0)
    assert(stops.every(s => s[2] === 'Interlaken Ost' && s[3] === override.platform && luzernOperatingPoint({ stop_id: s[4] }) === override.sourceNumber))
  }
  const supplement = sbb ? await loadThurgauSbbRail(network, policy, raw, matcher) : undefined
  const borderRail = border ? await loadThurgauBorderRail(raw) : undefined
  const match = supplement?.match ?? matcher.match
  return { ...matcher, match: (...args) => borderRail ? borderRail.supplement(...args, match(...args)) : match(...args), border: borderRail, sbb: supplement, policy, policySha256: sha(policyBytes), source }
}

export function applyThurgauRail(raw, result, rail) {
  if (!rail) return result
  const routes = new Map(rail.policy.routes.map(r => [r.routeId, r]))
  const stops = new Map(raw.stops.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
  const patterns = new Map(result.patterns.map(p => [p.id, p]))
  const indexes = new Map(result.paths.map((p, i) => [JSON.stringify(p), i])), seen = new Set()
  for (const train of result.trains) {
    const route = routes.get(train.routeId), pattern = patterns.get(train.patternId)
    if (!route || pattern.mode !== 'rail' || train.reservationRequired) continue
    assert.equal(train.agencyId, route.agencyId); assert.equal(train.route, route.line)
    if (pattern.matchedSegments === pattern.segmentCount && !isThurgauRailSource(pattern.geometrySource)) continue
    if (!seen.has(pattern.id)) {
      seen.add(pattern.id)
      const overrides = rail.policy.operatingPointOverrides.filter(o => o.routeId === train.routeId && train.stops.some(([i]) => raw.stops[i][4] === o.stopId))
      const selectedStops = new Map(stops)
      for (const override of overrides) {
        const original = raw.stops.find(s => s[4] === override.stopId)
        assert.equal(original[3], override.platform, 'Changed reviewed Interlaken platform')
        selectedStops.set(override.stopId, { ...stops.get(override.stopId), didok: override.targetNumber })
      }
      const segments = rail.match({ ...train, calls: train.stops.map(([i]) => ({ id: raw.stops[i][4] })) }, selectedStops, route)
      assert.equal(segments.length, train.stops.length - 1)
      const complete = segments.every(s => s.path)
      pattern.railSupplement = { operatingPointOverrides: overrides, status: complete ? 'admitted' : 'rejected-incomplete-pattern',
        segments: segments.map(({ path, ...evidence }) => ({ ...evidence, geometrySha256: path ? sha(JSON.stringify(path)) : null })) }
      if (complete) {
        pattern.officialMatchedSegments = pattern.matchedSegments
        pattern.geometrySource = segments.some(s => s.geometrySource === 'fot-osm-border-rail-inference') ? 'fot-osm-border-rail-inference' : segments.some(s => s.geometrySource === 'fot-sbb-rail-inference') ? 'fot-sbb-rail-inference' : 'fot-rail-inference'
        pattern.pathSegments = segments.map(s => {
          const signature = JSON.stringify(s.path)
          if (!indexes.has(signature)) { indexes.set(signature, result.paths.length); result.paths.push(s.path) }
          return indexes.get(signature)
        })
        pattern.matchedSegments = pattern.segmentCount
      }
    }
    if (isThurgauRailSource(pattern.geometrySource)) {
      train.pathSegments = pattern.pathSegments; train.admission = 'admitted'; train.geometrySource = pattern.geometrySource
    }
  }
  return reconcileThurgauGeometry(raw, result)
}
