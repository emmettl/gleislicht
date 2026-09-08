import { describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { assertCompleteMbcCalls, combineRoadCaches, mergeLausanneMbc } from './lausanne-mbc.mjs'
import { routesForModes } from './ingest-gtfs.mjs'
import { lausanneGroup, selectLausanneSnapshot, summarizeLausanneGeometry } from './audit-lausanne-study.mjs'

const metadata = { serviceDate: '2026-09-08', feedVersion: '20260905', dayModel: 'civil day with preceding service-day spillover', sourceServiceDates: ['2026-09-07', '2026-09-08'], windowStart: 0, windowEnd: 86400 }
const stops = [[6.49, 46.51, 'Morges', '', 'a'], [6.48, 46.52, 'La Gottaz', '', 'b'], [6.33, 46.54, 'Bière', '', 'c']]
const routes = new Map([['rail', { agencyId: '29' }], ['bus', { agencyId: '764' }], ['tl', { agencyId: '151' }], ['funi', { agencyId: '344' }]])
const train = (id, routeId, category, ids) => ({ id, sourceTripId: id, sourceServiceDate: '2026-09-08', routeId, route: routeId, category, start: 100, end: 300, stops: ids.map((i, n) => [i, 100 + n * 100, 100 + n * 100]) })
const base = { metadata, stops, trains: [train('rail-trip', 'rail', 'regional', [0, 1]), train('tl-trip', 'tl', 'bus', [0, 1])] }
const mbc = { metadata: { ...metadata, agencyIds: ['29', '764', '344'], modes: ['rail', 'bus', 'funicular'] }, stops, trains: [train('rail-trip', 'rail', 'regional', [0, 1, 2]), train('bus-trip', 'bus', 'bus', [2, 1, 0]), train('funi-trip', 'funi', 'funicular', [0, 1])] }

describe('Lausanne–MBC integration', () => {
  it('replaces clipped rail chains, preserves tl, admits MBC bus and separates its gates', () => {
    const merged = mergeLausanneMbc(base, mbc, routes)
    const selected = selectLausanneSnapshot(merged, routes, true)
    expect(selected.trains).toHaveLength(4)
    expect(selected.trains.find(t => t.id === 'rail-trip')?.stops).toEqual(mbc.trains[0].stops)
    expect(selected.trains.find(t => t.id === 'tl-trip')).toEqual(base.trains[1])
    expect(lausanneGroup(mbc.trains[1], routes, true)).toBe('mbc-bus')
    expect(lausanneGroup(mbc.trains[0], routes, true)).toBe('mbc-rail')
    expect(lausanneGroup(mbc.trains[1], routes)).toBeUndefined()
    expect(lausanneGroup(mbc.trains[2], routes, true)).toBe('cossonay-funicular')
    const groups = summarizeLausanneGeometry({ ...selected, paths: [] }, routes, true)
    expect(groups.find(g => g.id === 'mbc-bus')).toMatchObject({ trips: 1, totalSegments: 2, acceptedSegments: 0 })
    expect(groups.find(g => g.id === 'mbc-rail')).toMatchObject({ trips: 1, totalSegments: 2 })
    expect(() => mergeLausanneMbc(base, { ...mbc, metadata: { ...mbc.metadata, serviceDate: '2026-09-13' } }, routes)).toThrow('serviceDate mismatch')
    expect(() => mergeLausanneMbc(base, { ...mbc, stops: [[7, ...stops[0].slice(1)], ...stops.slice(1)] }, routes)).toThrow('Changed platform')
  })

  it('requires complete source calls and original timing, including negative overnight times', () => {
    const calls = [{ id: 'a', arrival: 86300, departure: 86300 }, { id: 'b', arrival: 86500, departure: 86500 }]
    const t = { id: 'overnight', sourceServiceDate: '2026-09-07', stops: [[0, -100, -100], [1, 100, 100]] }
    expect(() => assertCompleteMbcCalls(t, stops, calls, '2026-09-08')).not.toThrow()
    expect(() => assertCompleteMbcCalls(t, stops, [...calls, { id: 'c', arrival: 86700, departure: 86700 }], '2026-09-08')).toThrow('Clipped MBC')
    expect(() => assertCompleteMbcCalls({ ...t, stops: [[0, 0, 0], [1, 200, 200]] }, stops, calls, '2026-09-08')).toThrow('service-day offset')
    expect(() => assertCompleteMbcCalls({ ...t, stops: [[0, -100, -100], [1, 101, 101]] }, stops, calls, '2026-09-08')).toThrow('Changed MBC source times')
  })

  it('remaps distinct dated patterns without converting rejected segments to geometry', () => {
    const cache = { schemaVersion: 1, metadata: { license: 'ODbL-1.0', sourceSha256: 'a'.repeat(64) }, paths: [[[6, 46], [6.01, 46]]], patterns: { weekday: [0, null] } }
    const merged = combineRoadCaches([cache, { ...cache, patterns: { weekday: [0, 0], sunday: [null, 0] } }])
    expect(merged.patterns).toEqual({ weekday: [0, null], sunday: [null, 1] })
    expect(merged.metadata.sources).toHaveLength(2)
    expect(() => combineRoadCaches([{ ...cache, patterns: { broken: [99] } }])).toThrow('Invalid cached path')
  })

  it('filters all modes by agency without changing the existing unfiltered importer', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mbc-agency-test-'))
    try {
      await writeFile(join(directory, 'routes.txt'), 'route_id,agency_id,route_short_name,route_type\nrail,29,R56,106\nbus,764,701,700\nother,11,IC1,101\nfunicular,344,FUN,1400\n')
      execFileSync('zip', ['-q', 'fixture.zip', 'routes.txt'], { cwd: directory })
      const archive = join(directory, 'fixture.zip'), modes = new Set(['rail', 'bus'])
      expect([...(await routesForModes(archive, modes, new Set(['29', '764']))).keys()]).toEqual(['rail', 'bus'])
      expect([...(await routesForModes(archive, modes)).keys()]).toEqual(['rail', 'bus', 'other'])
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
