import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { loadBernUrban, applyBernUrban, BERN_ROAD_LIMITS } from './bern-urban-geometry.mjs'
import { loadBernMountains, matchBernMountain } from './bern-mountain-geometry.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
import { BERN_LIMITS } from './bern-line-geometry.mjs'
const urban = await loadBernUrban(), mountain = await loadBernMountains()
const routes = JSON.parse(await readFile('data/bern-audit/routes.json'))
const route = id => routes.find(r => r.id === id)

describe('Bern supplement evidence and exclusion gates', () => {
  it('reimports every retained matcher output using Bern’s stricter limits', () => {
    for (const agency of Object.values(urban.cache.agencies)) expect(agency.cache.metadata.limits).toEqual(BERN_ROAD_LIMITS)
    const rejected = urban.cache.agencies['146'].cache.report.issues
    expect(rejected).toHaveLength(8)
    expect(rejected.every(p => p.reason === 'stop-too-far' && p.snap > 80)).toBe(true)
    expect(urban.policy.roadRouteIds).not.toContain('92-7A-j26-1')
    expect(urban.policy.roadRouteIds).not.toContain('92-8A-j26-1')
  })
  it('rejects a successful directed pair when another full pattern reports a failure', () => {
    const cache = structuredClone(urban.cache), agency = cache.agencies['889']
    const contexts = new Map()
    for (const [id, identity] of Object.entries(agency.identities)) for (let i = 1; i < identity.stops.length; i++) {
      const key = JSON.stringify([identity.routeId, identity.stops[i - 1][4], identity.stops[i][4]])
      const list = contexts.get(key) ?? []; list.push([id, i - 1]); contexts.set(key, list)
    }
    const [key, occurrences] = [...contexts].find(([key, v]) => v.length > 1 && urban.roads.get(key)?.path)
    const [id, i] = occurrences[0]; agency.cache.patterns[id][i] = null
    const candidate = roadConsensus(cache, BERN_LIMITS.bus).get(key)
    expect(candidate.path).toBeUndefined(); expect(candidate.reason).toContain('road-matcher-rejected')
  })
  it('does not apply September construction or road contexts to a winter date', () => {
    const result = { marker: 'untouched' }
    expect(applyBernUrban({ metadata: { serviceDate: '2026-01-16' } }, result, {}, urban)).toBe(result)
  })
  it('matches Wiriehorn’s actual installation in both directions without moving GTFS stops', () => {
    const from = [7.53179874, 46.61211746, 'Diemtigen Riedli', '', 'ch:1:sloid:31438']
    const to = [7.53549979, 46.6001509, 'Diemtigen Nüegg', '', 'ch:1:sloid:31439']
    for (const [a, b] of [[from, to], [to, from]]) {
      const match = matchBernMountain(a, b, route('93-236-5-j26-1'), '2026-09-04', mountain)
      expect(match.sourceId).toBe('73.213'); expect(match.maximumSnapMetres).toBeLessThan(1)
      expect(match.path[0]).toEqual(a.slice(0, 2).map(n => Number(n.toFixed(7))))
      expect(match.path.at(-1)).toEqual(b.slice(0, 2).map(n => Number(n.toFixed(7))))
    }
    expect(() => matchBernMountain(from, to, { ...route('93-236-5-j26-1'), agencyId: 'wrong' }, '2026-09-04', mountain)).toThrow()
    expect(matchBernMountain(from, to, route('93-236-5-j26-1'), '2006-01-01', mountain).reason).toBe('mountain-source-validity')
  })
  it('keeps Eiger and Männlichen shared-platform conflicts outside the 80 m gate', () => {
    const terminal = [8.01710458, 46.62550651, 'Grindelwald Terminal', '', 'ch:1:sloid:5226']
    for (const [id, destination] of [
      ['93-244-4-j26-1', [7.97407528, 46.57480811, 'Eigergletscher', '', 'ch:1:sloid:7361']],
      ['93-GGM-j26-1', [7.97900703, 46.62132973, 'Holenstein', '', 'ch:1:sloid:7391']],
    ]) {
      const match = matchBernMountain(terminal, destination, route(id), '2026-09-04', mountain)
      expect(match.reason).toBe('mountain-endpoint-gap'); expect(match.maximumSnapMetres).toBeGreaterThan(80)
      expect(match.path).toBeUndefined()
    }
  })
})
