import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { bernGraph } from './bern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { operatingPointNumber } from './zug-rail-geometry.mjs'
import { loadZugSbbRailSupplement } from './zug-sbb-rail-supplement.mjs'
import { hashFile } from './solothurn-timetable.mjs'

export function solothurnBernRailMatcher(feature, policy) {
  assert.equal(feature.properties.liniencode, policy.sourceLine)
  assert.equal(feature.properties.tucode, policy.sourceOperator)
  assert.equal(feature.properties.liniennr, policy.line)
  assert.equal(feature.properties.vkmtyp, 1)
  const graph = bernGraph([feature])
  return (route, from, to) => {
    if (route.id !== policy.routeId || route.agencyId !== policy.agencyId || route.name !== policy.line || route.mode !== policy.mode) return undefined
    return { ...matchBaselSegment(graph, from, to, policy.limits), geometrySource: `bern-official-${policy.sourceLine}`, sourceFeature: feature.properties.liniencode }
  }
}

export async function loadSolothurnCorridors() {
  const path = 'data/solothurn-corridor-policy.json', policy = JSON.parse(await readFile(path))
  const matchers = []
  for (const config of [policy.asm, policy.s29]) {
    assert.equal(await hashFile(config.sourceFile), config.sha256)
    matchers.push(solothurnBernRailMatcher(JSON.parse(await readFile(config.sourceFile)), config))
  }
  const sbb = await loadZugSbbRailSupplement(policy.sbb)
  const stop = s => ({ didok: operatingPointNumber(s[4]), stop_lon: s[0], stop_lat: s[1] })
  return { metadata: { policySha256: await hashFile(path), asm: policy.asm, s29: policy.s29, sbb: { ...policy.sbb, source: sbb.source } },
    match(route, from, to, original = { reason: 'no-compatible-rail-supplement' }) {
      if (original.path || route.mode !== 'rail') return original
      const branch = matchers.map(match => match(route, from, to)).find(Boolean)
      if (branch?.path) return branch
      return sbb.matchPair(branch ?? original, { routeId: route.id, agencyId: route.agencyId, line: route.name }, stop(from), stop(to))
    } }
}
