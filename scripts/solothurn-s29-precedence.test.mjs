import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadSolothurnCorridors } from './solothurn-corridor-geometry.mjs'
import { loadSolothurnS29Precedence } from './solothurn-s29-precedence.mjs'
import { loadSolothurnSupplements, supplementConsensus } from './solothurn-supplement-geometry.mjs'
const context = JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz')))
const route = context.routes.find(r => r.id === '91-29-j26-1')

describe('reviewed S29 source precedence', () => {
  it('resolves both formerly conflicting pairs across all retained full contexts and retains their alternatives', async () => {
    const supplements = await loadSolothurnSupplements(context, { roads: false })
    expect(supplements.s29PrecedenceReview).toHaveLength(2)
    for (const row of supplements.s29PrecedenceReview) {
      const selected = supplements.pairs.get(row.key)
      expect(selected.path).toBeDefined(); expect(selected.sourceFeature).toBe('450_S_b')
      expect(selected.contextCount).toBe(row.contexts.length)
      expect(row.contexts.length).toBeGreaterThan(1)
      expect(new Set(row.contexts.map(c => c.selectedPathSha256))).toEqual(new Set([row.selectedPathSha256]))
      expect(row.selectedPathMetres).toBeGreaterThan(13000); expect(row.selectedPathMetres).toBeLessThan(14000)
      expect(row.maximumSnapMetres).toBeLessThan(11)
      expect(row.contexts.some(c => c.previous.source === 'fot' && c.previous.pathMetres > 45000)).toBe(true)
      expect(row.contexts.every(c => c.stopIds.some((id, i) => id === row.from[4] && c.stopIds[i + 1] === row.to[4]))).toBe(true)
      expect(selected.path[0]).toEqual(row.from.slice(0, 2).map(n => +n.toFixed(7)))
      expect(selected.path.at(-1)).toEqual(row.to.slice(0, 2).map(n => +n.toFixed(7)))
    }
    // General consensus still rejects different paths; only the explicit line
    // crosswalk changes the candidate source for the two reviewed pairs.
    expect(supplementConsensus(new Map([['other', [{ path: [[0, 0], [1, 1]] }, { path: [[0, 0], [2, 2]] }]]])).get('other').reason).toBe('supplement-pattern-dependent-path')
  })
  it('does not extend precedence to reverse pairs, other platforms, lines, modes or operators', async () => {
    const review = await loadSolothurnS29Precedence(await loadSolothurnCorridors()), pair = review.metadata.policy.pairs[0]
    const original = { reason: 'existing-failure' }, c = { patternId: 'scope-test', stopIds: [pair.from[4], pair.to[4]] }
    for (const r of [{ ...route, id: 'other' }, { ...route, agencyId: '33' }, { ...route, name: 'S26' }, { ...route, mode: 'bus' }]) expect(review.select(r, pair.from, pair.to, original, c)).toBe(original)
    expect(review.select(route, pair.to, pair.from, original, c)).toBe(original)
    expect(review.select(route, [...pair.from.slice(0, 4), 'ch:1:sloid:218:5:9'], pair.to, original, c)).toBe(original)
    expect(() => review.select(route, [pair.from[0] + .001, ...pair.from.slice(1)], pair.to, original, c)).toThrow('Changed reviewed S29 platform')
  })
})
