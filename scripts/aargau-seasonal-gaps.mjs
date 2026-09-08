import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { aargauRailMatcher } from './aargau-rail-geometry.mjs'
import { aargauGapMatcher } from './aargau-gap-geometry.mjs'
import { aargauPlatformMatcher } from './aargau-platform-geometry.mjs'
import { assertGeometryMeasurementsEqual } from './compare-geometry-measurements.mjs'

const read = async file => JSON.parse(await readFile(file, 'utf8'))
export const SEASONAL_GAP_POLICY = 'data/aargau-seasonal-gap-policy.json'
export const NEW_RAIL_ROUTES = [
  { routeId: '91-26-E-j26-1', agencyId: '11', line: 'RE26' },
  { routeId: '91-2H-Y-j26-1', agencyId: '11', line: 'IC' },
  { routeId: '91-5F-Y-j26-1', agencyId: '11', line: 'IC' },
  { routeId: '91-AP-Y-j26-1', agencyId: '11', line: 'EXT' },
]
export const isWaldshutClosure = date => date >= '2026-09-14' && date <= '2026-10-02'

export async function seasonalGapSources() {
  return {
    collection: JSON.parse(gunzipSync(await readFile('data/aargau-sources/lines.json.gz'))),
    crosswalk: await read('data/aargau-line-crosswalk.json'),
    relation: await read('data/aargau-platform-sources/brugg-relation.json'),
    network: parseRailNetworkXtf(gunzipSync(await readFile('data/aargau-rail-sources/network.xtf.gz')).toString(), 5),
    railPolicy: await read('data/aargau-rail-policy.json'),
  }
}

// This evaluator uses the original distance/topology guards. Admission below
// additionally pins each date, full platform-coordinate chain and path digest.
export function seasonalGapEvaluator(policy, sources, date) {
  const platforms = aargauPlatformMatcher({ patterns: policy.rules.filter(r => ['brugg-service-loop', 'bern-platform-49'].includes(r.kind)).map(r => ({ ...r, fix: r.kind })) }, sources.relation, sources.network, sources.railPolicy, date)
  const original = sources.crosswalk.gapMappings.find(r => r.id === 'thurbo-s36-waldshut'); assert(original)
  const gaps = aargauGapMatcher(sources.collection, [{ ...original, id: 'seasonal-thurbo-s36-waldshut', serviceDates: isWaldshutClosure(date) ? [] : [date] }], date)
  const rail = aargauRailMatcher(sources.network, { routes: NEW_RAIL_ROUTES })
  return (rule, train, stops) => {
    if (rule.kind === 'waldshut') return gaps.matchPattern(train, stops)
    if (rule.kind === 'seasonal-rail') return rail.matchPattern({ ...train, stops: stops.map((_, i) => [i, 0, 0]) }, stops)
    return platforms.matchPattern(train, stops)
  }
}

export function seasonalGapMatcher(policy, sources, date) {
  const evaluate = seasonalGapEvaluator(policy, sources, date)
  const rules = policy.rules.filter(r => r.date === date)
  return { matchPattern(train, stops) {
    const approved = rules.filter(r => r.agencyId === train.agencyId && r.mode === train.category && r.routeId === train.routeId && r.line === train.route && r.directionId === train.directionId && JSON.stringify(r.stops) === JSON.stringify(stops))
    assert(approved.length <= 1, 'Ambiguous seasonal gap policy')
    const rule = approved[0]
    if (!rule || (rule.kind === 'waldshut' && isWaldshutClosure(date))) return undefined
    assert.deepEqual(train.calls.map(c => c[0]), stops.map(s => s[4]))
    const segments = evaluate(rule, train, stops)
    const output = stops.slice(1).map(() => undefined)
    for (const expected of rule.segments) {
      const segment = segments?.[expected.index]
      assert(segment?.path, `Reviewed seasonal path no longer matches: ${rule.id}`)
      const { path, ...evidence } = segment
      assert.equal(geometryDigest(path), expected.pathSha256, 'Changed reviewed seasonal path')
      assert.doesNotThrow(() => assertGeometryMeasurementsEqual(evidence, expected.evidence), 'Changed reviewed seasonal source evidence')
      output[expected.index] = { ...segment, seasonalGapRuleId: rule.id }
    }
    return output
  } }
}

export async function loadSeasonalGaps() {
  const policy = await read(SEASONAL_GAP_POLICY)
  for (const [file, sha] of Object.entries(policy.files)) assert.equal(await hashFile(file), sha, `Changed seasonal gap evidence: ${file}`)
  for (const [date, sha] of Object.entries(policy.inputTimetableHashes)) assert.equal(await hashFile(`data/aargau-seasonal/input/${date}-timetable.json.gz`), sha)
  assert(policy.rules.every(r => !['2026-09-04', '2026-09-06'].includes(r.date)))
  const sources = await seasonalGapSources(), matchers = new Map()
  return { policy, forDate(date) {
    if (!matchers.has(date)) matchers.set(date, seasonalGapMatcher(policy, sources, date))
    return matchers.get(date)
  } }
}
