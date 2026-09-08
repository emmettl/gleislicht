import { assertGeometryMeasurementsEqual } from './compare-geometry-measurements.mjs'
import assert from 'node:assert/strict'
import { hashFile } from './inventory-aargau.mjs'
import { readJson } from './aargau-seasonal.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { loadAargauRail, AARGAU_RAIL_LIMITS } from './aargau-rail-geometry.mjs'
export const WITNESS_RAIL_POLICY = 'data/aargau-witness-rail-policy.json'
export const witnessTemplateDigest = t => geometryDigest([t.sourceTripId,t.serviceId,t.agencyId,t.routeId,t.route,t.category,t.directionId,t.headsign,t.shortName,t.start,t.end,t.calls,t.activeServiceDates])
const patternKey = (t, stops) => JSON.stringify([t.agencyId,t.routeId,t.route,t.category,t.directionId,stops])
export function witnessRailMatcher(policy, rail) {
  assert.equal(policy.schemaVersion, 1)
  assert.deepEqual(policy.limits, AARGAU_RAIL_LIMITS)
  const rules = new Map(policy.patterns.map(r => [patternKey({ agencyId:r.agencyId,routeId:r.routeId,route:r.line,category:'rail',directionId:r.directionId },r.stops),r]))
  assert.equal(rules.size, policy.patterns.length)
  const locate = (t, stops) => rules.get(patternKey(t, stops))
  const approved = (r,t) => t.sourceServiceDate === undefined && t.serviceOffset === undefined && r.templates.some(j => j.sourceTripId === t.sourceTripId && j.sha256 === witnessTemplateDigest(t))
  return { policy,
    assertTemplate(t, stops) {
      const r = locate(t,stops)
      if (t.category === 'rail') assert(r && approved(r,t), 'Unreviewed witness rail template or platform pattern')
    },
    matchPattern(t, allStops) {
      const stops = t.stops.map(([i]) => allStops[i]), r = locate(t,stops)
      if (!r || !approved(r,t)) return undefined
      assert.deepEqual(t.calls.map(c=>c[0]),stops.map(s=>s[4]))
      const segments = rail.matchPattern(t,allStops)
      return r.segments.map((expected,i) => {
        if (expected.preserveExistingGeometry) return undefined
        const actual = segments?.[i]; assert(actual, 'Missing reviewed witness rail assessment')
        const { path, ...evidence } = actual
        assert.doesNotThrow(() => assertGeometryMeasurementsEqual(evidence, expected.evidence), 'Changed witness rail source evidence')
        if (!expected.pathSha256) { assert(!path, 'Previously rejected witness rail segment changed'); return actual }
        assert(path)
        assert.equal(geometryDigest(path),expected.pathSha256,'Changed witness rail path')
        return { ...actual,witnessRailPatternId:r.id }
      })
    }
  }
}
export async function loadWitnessRail() {
  const policy = await readJson(WITNESS_RAIL_POLICY)
  for (const [file,sha] of Object.entries(policy.files)) assert.equal(await hashFile(file),sha,`Changed witness rail input: ${file}`)
  const rail = await loadAargauRail('data/aargau-rail-sources',WITNESS_RAIL_POLICY)
  return { ...witnessRailMatcher(policy,rail),source:rail.source }
}
