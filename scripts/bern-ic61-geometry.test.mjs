import { it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadBernIc61, bernIc61Crosswalk } from './bern-ic61-geometry.mjs'
import { bernFeatureMatch } from './bern-line-geometry.mjs'
import { bernRailCandidates } from './bern-rail-geometry.mjs'
const rail = await loadBernIc61(), policy = rail.policy
const route = { id: '91-61-A-j26-1', agencyId: '11', name: 'IC61', line: 'IC61', mode: 'rail' }
const crosswalk = JSON.parse(await readFile('data/bern-operator-crosswalk.json'))
const reviewed = bernIc61Crosswalk(crosswalk, policy, policy.dates)
const source = JSON.parse(gunzipSync(await readFile('data/bern-sources/decoded.json.gz')))
const feature = source.lines.find(f => f.properties.liniencode === '310_IC')
const stops = new Map(policy.originalStops.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
const train = p => ({ routeId: route.id, directionId: p.directionId, calls: p.stopIds.map(id => ({ id })) })
it('adds exactly one dated identity while preserving generic IC and other feature decisions', () => {
  expect(bernFeatureMatch(route, feature, crosswalk)).toBe(false)
  expect(bernFeatureMatch(route, feature, reviewed)).toBe(true)
  for (const change of [{ id: '91-6-H-j26-1', name: 'IC6' }, { name: 'ICE' }, { agencyId: '33' }, { mode: 'bus' }]) expect(bernFeatureMatch({ ...route, ...change }, feature, reviewed)).toBe(false)
  expect(bernFeatureMatch({ ...route, id: '91-4R-Y-j26-1', name: 'IC' }, feature, reviewed)).toBe(true)
  for (const f of source.lines.filter(f => f !== feature)) expect(bernFeatureMatch(route, f, reviewed)).toBe(bernFeatureMatch(route, f, crosswalk))
  expect(crosswalk.featureOverrides['310_IC']).toBeUndefined()
  expect(() => bernIc61Crosswalk(crosswalk, policy, ['2026-12-06'])).toThrow('Unreviewed IC61 crosswalk dates')
  expect(() => bernFeatureMatch(route, feature, { ...reviewed, supportingDocuments: [] })).toThrow('Missing route identity evidence')
})
it('pins the exact source corridor, dated PDF, full contexts and original standard-gauge curves', () => {
  expect(policy.cantonalFeatureProperties).toMatchObject({ liniencode: '310_IC', liniennr: 'IC', tucode: 'SBB', kubunr: '310/450' })
  expect(policy.documents[0]).toMatchObject({ documentDate: '2026-03-16', sha256: 'fccf70b01af2cdde869eb814fba06e3203a19da7108d9b50306e95052184fb93' })
  expect(policy.originalPatterns).toHaveLength(59); expect(policy.originalStops).toHaveLength(37)
  expect(policy.routes[0].pairs).toHaveLength(71); expect(rail.metadata.sourceSegments).toHaveLength(56)
  expect(rail.metadata.sourceSegments.every(s => !s.reason && s.gauge === 'mm1435')).toBe(true)
  expect(rail.metadata.sourceSegments.some(s => s.id === 'ch14uvag00087490')).toBe(false)
  expect(policy.limits.stationAttachmentMetres).toBe(120)
})
it('resolves original Ost platforms 5 and 7 while retaining failed Bern/Basel attachments', () => {
  let ost = 0, failed = 0
  for (const p of policy.originalPatterns) {
    const results = rail.matcher.matchPattern(train(p), stops, route)
    results.forEach((r, i) => {
      if (r.path) {
        expect(r.path[0]).toEqual(policy.originalStops.find(s => s[4] === p.stopIds[i]).slice(0, 2))
        expect(r.path.at(-1)).toEqual(policy.originalStops.find(s => s[4] === p.stopIds[i + 1]).slice(0, 2))
      }
      if ([p.stopIds[i], p.stopIds[i + 1]].some(id => id.includes(':7492:'))) { expect(r.path).toBeDefined(); expect(r.directedSourceSegments.map(s => s.id)).toEqual(['ch14uvag00087489']); ost++ }
      if (r.reason === 'rail-station-attachment-too-far') failed++
    })
  }
  expect(ost).toBeGreaterThan(20); expect(failed).toBeGreaterThan(20)
})
it('rejects unreviewed route, platform, cropped context and source coordinates before cache reuse', () => {
  const t = train(policy.originalPatterns[0]); rail.matcher.matchPattern(t, stops, route)
  for (const calls of [t.calls.slice(-2), [...t.calls, t.calls.at(-1)], t.calls.map((c, i) => i ? c : { id: 'unknown-platform' })]) expect(rail.matcher.matchPattern({ ...t, calls }, stops, route).every(r => !r.path)).toBe(true)
  expect(() => rail.matcher.matchPattern({ ...t, routeId: '91-8-L-j26-1' }, stops, route)).toThrow()
  for (const id of t.calls.map(c => c.id)) {
    const changed = new Map(stops); changed.set(id, { ...changed.get(id), stop_lon: changed.get(id).stop_lon + .001 })
    expect(() => rail.matcher.matchPattern(t, changed, route)).toThrow('Changed reviewed IC61 source coordinates')
  }
  expect(() => bernRailCandidates({ metadata: { serviceDate: '2026-12-06' }, stops: [], trains: [] }, new Map(), rail)).toThrow('Unreviewed Bern rail date')
})
