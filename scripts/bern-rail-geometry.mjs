import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { parseZugRail, zugRailMatcher, operatingPointNumber } from './zug-rail-geometry.mjs'
import { bernPatternId, bernAdmission, BERN_LIMITS } from './bern-line-geometry.mjs'
import { previousServiceDate } from './civil-day.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const key = (routeId, fromId, toId) => JSON.stringify([routeId, fromId, toId])
export const BERN_RAIL_ROUTES = ['91-36-D-j26-1', '91-4-C-j26-1']
export async function loadBernRail({ policyPath = 'data/bern-rail-policy.json', scope = BERN_RAIL_ROUTES,
  infrastructureOperators = ['SBB CFF FFS'] } = {}) {
  const bytes = await readFile(policyPath), policy = JSON.parse(bytes)
  assert.deepEqual(policy.routes.map(r => r.routeId), scope)
  assert.deepEqual(policy.dates, ['2026-09-04', '2026-09-06'])
  assert.equal(policy.limits.stationAttachmentMetres, BERN_LIMITS.rail.snapMetres)
  assert.equal(policy.limits.topologyAttachmentMetres, 120)
  assert.equal(policy.limits.detourRatio, BERN_LIMITS.rail.detourRatio)
  assert.equal(policy.limits.detourFloorMetres, BERN_LIMITS.rail.detourFloorMetres)
  assert.equal(policy.limits.simplificationMetres, 0)
  assert.deepEqual(policy.gauges, ['mm1435']); assert.deepEqual(policy.infrastructureOperators, infrastructureOperators)
  const sourceBytes = await readFile(join(policy.sourceDirectory, 'source.json')), source = JSON.parse(sourceBytes)
  assert.equal(sha(sourceBytes), policy.sourceMetadataSha256)
  for (const [file, hash] of Object.entries(source.files)) assert.equal(sha(await readFile(join(policy.sourceDirectory, file))), hash, `Changed Bern rail source ${file}`)
  const xml = gunzipSync(await readFile(join(policy.sourceDirectory, 'network.xtf.gz')))
  assert.equal(sha(xml), policy.sourceSha256)
  for (const file of ['catalogue.json', 'catalogue-check-20260908.json']) {
    const catalogue = JSON.parse(await readFile(join(policy.sourceDirectory, file)))
    assert.equal(catalogue.assets['schienennetz_2056_de.xtf']['file:checksum'], `1220${sha(xml)}`)
  }
  const network = parseZugRail(xml.toString(), 0)
  assert.equal(network.nodes.size, source.nodes); assert.equal(network.segments.length, source.segments)
  const selected = new Set(policy.routes.flatMap(r => (r.pairs ?? [r]).flatMap(p => p.sourceSegments)))
  const segments = network.segments.filter(s => selected.has(s.id))
  assert.equal(segments.length, selected.size, 'Missing reviewed federal segment')
  const matcher = zugRailMatcher({ ...network, segments }, policy, [previousServiceDate(policy.dates[0]), policy.dates.at(-1)])
  assert(matcher.sourceInventory.every(s => !s.reason), 'Reviewed federal segment fails source policy')
  return { policy, matcher, metadata: { policySha256: sha(bytes), policy, source, sourceSegments: matcher.sourceInventory } }
}

export function bernRailConsensus(contexts) {
  const failed = contexts.find(c => !c.assessment.path)
  if (failed) return { reason: 'rejected-full-pattern-context', contextReason: failed.assessment.reason }
  const paths = new Set(contexts.map(c => JSON.stringify(c.assessment.path)))
  if (paths.size !== 1) return { reason: 'different-full-pattern-paths' }
  return { ...contexts[0].assessment, railPatternIds: [...new Set(contexts.map(c => c.patternId))].sort() }
}

export function bernRailCandidates(raw, routes, rail) {
  assert(rail.policy.dates.includes(raw.metadata.serviceDate), 'Unreviewed Bern rail date')
  const stops = new Map(raw.stops.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
  const seen = new Set(), candidates = new Map()
  for (const t of raw.trains) {
    const config = rail.policy.routes.find(r => r.routeId === t.routeId)
    if (!config) continue
    const route = routes.get(t.routeId)
    assert.equal(route.agencyId, config.agencyId); assert.equal(route.name, config.line); assert.equal(route.mode, config.mode)
    const patternId = bernPatternId(t, raw.stops)
    if (seen.has(patternId)) continue
    seen.add(patternId)
    const calls = t.stops.map(([i]) => ({ id: raw.stops[i][4] }))
    // All called stations remain blocked as interior nodes, including calls on
    // already accepted cantonal legs. A pair-only search would lose this guard.
    const results = rail.matcher.matchPattern({ ...t, calls }, stops, { ...route, line: route.name })
    for (let i = 1; i < calls.length; i++) {
      const numbers = [calls[i - 1].id, calls[i].id].map(operatingPointNumber)
      const bindings = (config.pairs ?? [config]).flatMap(binding => {
        // New reviews bind exact directed platform IDs. Legacy station-pair
        // bindings retain their explicitly bidirectional behaviour.
        if (binding.fromId && (binding.fromId !== calls[i - 1].id || binding.toId !== calls[i].id)) return []
        const forward = JSON.stringify(numbers) === JSON.stringify(binding.operatingPointPair)
        const reverse = !binding.fromId && JSON.stringify(numbers) === JSON.stringify([...binding.operatingPointPair].reverse())
        return forward || reverse ? [{ binding, forward }] : []
      })
      assert(bindings.length <= 1, 'Ambiguous reviewed rail pair')
      if (!bindings.length) continue
      const { binding, forward } = bindings[0]
      const assessment = { ...results[i - 1] }
      if (assessment.path) {
        assert.deepEqual(assessment.directedSourceSegments.map(s => s.id), forward ? binding.sourceSegments : [...binding.sourceSegments].reverse(), 'Unreviewed federal routing')
        assessment.path = assessment.path.map((p, j, all) => j === 0 || j === all.length - 1 ? p.map(v => Number(v.toFixed(7))) : p)
        assessment.maximumSnapMetres = Math.max(...assessment.stationAttachmentsMetres)
      }
      const pairKey = key(t.routeId, calls[i - 1].id, calls[i].id), contexts = candidates.get(pairKey) ?? []
      contexts.push({ patternId, assessment }); candidates.set(pairKey, contexts)
    }
  }
  return new Map([...candidates].map(([k, contexts]) => [k, { ...bernRailConsensus(contexts), contexts }]))
}

export function applyBernRail(raw, result, routes, rail) {
  const candidates = bernRailCandidates(raw, routes, rail), changed = new Map()
  const signatures = new Map(result.paths.map((p, i) => [JSON.stringify(p), i]))
  for (const pair of result.pairs) {
    if (pair.pathIndex !== null) continue
    const pairKey = key(pair.routeId, pair.fromId, pair.toId), candidate = candidates.get(pairKey)
    if (!candidate?.path) {
      if (candidate) pair.railSupplementRejection = { reason: candidate.reason, contexts: candidate.contexts }
      continue
    }
    const { path, contexts: _contexts, ...assessment } = candidate, signature = JSON.stringify(path)
    if (!signatures.has(signature)) { signatures.set(signature, result.paths.length); result.paths.push(path) }
    const { pathIndex: _index, occurrences: _occurrences, admittedOccurrences: _admitted, ...original } = pair
    Object.assign(pair, assessment, { sourceKind: 'fot-rail-topology', sourceId: rail.policy.sourceId,
      originalAssessment: original, pathIndex: signatures.get(signature) })
    delete pair.reason; changed.set(pairKey, pair)
  }
  const patterns = new Map(), pairs = new Map(result.pairs.map(p => [key(p.routeId, p.fromId, p.toId), p]))
  for (const p of result.patterns) {
    const changes = p.stopIds.slice(1).map((id, i) => changed.get(key(p.routeId, p.stopIds[i], id)))
    if (!changes.some(Boolean)) continue
    p.pathSegments = p.pathSegments.map((index, i) => changes[i]?.pathIndex ?? index)
    p.matchedSegments = p.pathSegments.filter(i => i !== null).length
    p.supplementalSources = [...new Set([...(p.supplementalSources ?? []), rail.policy.sourceId])].sort()
    p.admittedTrips = 0; p.decisions = {}; patterns.set(p.id, p)
  }
  // Recount route-level pair occurrences, including already admitted movements
  // on the same route, while leaving unrelated supplements untouched.
  const affectedRoutes = new Set([...patterns.values()].map(p => p.routeId))
  for (const p of result.pairs) if (affectedRoutes.has(p.routeId)) p.admittedOccurrences = 0
  for (const t of result.trains) {
    const p = patterns.get(t.patternId)
    if (p) {
      t.pathSegments = p.pathSegments; t.admission = bernAdmission(t, p)
      p.decisions[t.admission] = (p.decisions[t.admission] ?? 0) + 1
      p.admittedTrips += Number(t.admission === 'admitted')
    }
    if (t.admission === 'admitted' && affectedRoutes.has(t.routeId)) {
      for (let i = 1; i < t.stops.length; i++) pairs.get(key(t.routeId, raw.stops[t.stops[i - 1][0]][4], raw.stops[t.stops[i][0]][4])).admittedOccurrences++
    }
  }
  return result
}
