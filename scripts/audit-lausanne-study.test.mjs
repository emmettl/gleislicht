import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assessLausannePath, LAUSANNE_AGENCY, lausanneGroup, lausanneTechnicalGate, selectLausanneSnapshot, summarizeLausanneGeometry } from './audit-lausanne-study.mjs'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'

const stops = [[6.62, 46.52, 'A', '', 'a'], [6.63, 46.52, 'B', '', 'b'], [6.64, 46.52, 'Lake', '', 'lake']]
const train = { id: 'one', routeId: 'tl-1', route: '1', category: 'bus', start: 100, end: 300, stops: [[0, 100, 100], [1, 300, 300]] }
const routes = new Map([
  ['tl-1', { agencyId: '151' }], ['other-1', { agencyId: '801' }],
  ['tl-m2', { agencyId: '151' }], ['leb-r20', { agencyId: '55' }], ['cgn', { agencyId: '74' }],
])

describe('Lausanne source and geometry audit', () => {
  it('scopes local modes by source agency, keeps LEB distinct and excludes lake services', () => {
    expect(lausanneGroup(train, routes)).toBe('tl-bus')
    expect(lausanneGroup({ ...train, routeId: 'other-1' }, routes)).toBeUndefined()
    expect(lausanneGroup({ ...train, category: 'metro', routeId: 'tl-m2', route: 'm2' }, routes)).toBe('m2')
    expect(lausanneGroup({ ...train, category: 'regional', routeId: 'leb-r20', route: 'R20' }, routes)).toBe('leb')
    expect(lausanneGroup({ ...train, category: 'ferry', routeId: 'cgn' }, routes)).toBeUndefined()
    expect(() => lausanneGroup({ ...train, routeId: 'unknown' }, routes)).toThrow('Unknown source route')
  })

  it('removes unused topology without changing trip identities, ordered platforms or times', () => {
    const boat = { ...train, id: 'boat', category: 'ferry', routeId: 'cgn', stops: [[1, 10, 10], [2, 30, 30]] }
    const raw = { metadata: {}, stops: [stops[2], stops[0], stops[1]], trains: [{ ...train, stops: [[1, 100, 100], [2, 300, 300]], pathSegments: [99] }, boat] }
    const candidate = selectLausanneSnapshot(raw, routes)
    expect(candidate.stops).toEqual(stops.slice(0, 2))
    expect(candidate.trains).toEqual([train])
    expect(candidate.edges).toEqual([[0, 1]])
    expect(candidate.metadata.modes).toEqual(['rail', 'metro', 'bus'])
  })

  it('accepts reversed FOT paths but rejects collapsed and distant station matches', () => {
    const path = stops.slice(0, 2).map(stop => stop.slice(0, 2))
    expect(assessLausannePath([...path].reverse(), stops[0], stops[1]).accepted).toBe(true)
    expect(assessLausannePath([path[0]], stops[0], stops[1]).accepted).toBe(false)
    expect(assessLausannePath([path[0], [6.625, 46.52]], stops[0], stops[1]).reason).toBe('endpoint-gap')
  })

  it('counts scheduled movements separately from path indices and retains platform-specific failures', () => {
    const path = [stops[0].slice(0, 2), [6.625, 46.52]]
    const s = { stops, paths: [path], trains: [{ ...train, pathSegments: [0] }, { ...train, id: 'two', pathSegments: [0] }] }
    const group = summarizeLausanneGeometry(s, routes)[0]
    expect(group).toMatchObject({ trips: 2, totalSegments: 2, indexedSegments: 2, acceptedSegments: 0, coverage: 0 })
    expect(group.issues).toEqual([expect.objectContaining({ fromId: 'a', toId: 'b', occurrences: 2, reason: 'endpoint-gap' })])
    expect(() => summarizeLausanneGeometry({ ...s, trains: [{ ...train, pathSegments: [99] }] }, routes)).toThrow('Invalid path reference')
  })

  it('cannot conceal a missing métro behind the much larger bus fleet or grow existing payload limits', () => {
    const groups = [{ id: 'tl-bus', trips: 6000, coverage: 1 }, { id: 'm2', trips: 700, coverage: 0.7 }]
    const payload = { manifestGzipBytes: 650 * 1024, morningGzipBytes: 1600 * 1024, chunks: [{ id: '06-08', gzipBytes: 450 * 1024 }] }
    expect(lausanneTechnicalGate(groups, payload)).toHaveLength(1)
    expect(lausanneTechnicalGate(groups, { ...payload, chunks: [{ id: '06-08', gzipBytes: 450 * 1024 + 1 }] })).toHaveLength(2)
    expect(lausanneTechnicalGate([{ id: 'leb', trips: 0, coverage: 1 }], payload)).toHaveLength(1)
  })

  it('reuses the matcher feed builder with tl identity and French feed metadata', async () => {
    const output = await mkdtemp(join(tmpdir(), 'lausanne-feed-test-'))
    try {
      await prepareRoadFeed({ manifest: { stops, metadata: { serviceDate: '2026-09-08', feedVersion: 'test', sourceUrl: 'https://opentransportdata.swiss' } }, trains: [train], output, agency: LAUSANNE_AGENCY })
      expect(await readFile(join(output, 'routes.txt'), 'utf8')).toContain('"tl-1","151","1"')
      expect(await readFile(join(output, 'agency.txt'), 'utf8')).toContain('Transports publics de la région lausannoise')
      expect(await readFile(join(output, 'feed_info.txt'), 'utf8')).toContain('"fr","test"')
    } finally { await rm(output, { recursive: true, force: true }) }
  })
})
