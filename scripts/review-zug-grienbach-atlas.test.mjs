import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { atlasCsvRecords, selectAtlasPlatforms, compareAtlasPlatforms, reviewZugGrienbachAtlas } from './review-zug-grienbach-atlas.mjs'
const json = path => JSON.parse(readFileSync(path)), policy = json('data/zug-policy.json'), bytes = readFileSync('data/zug-timetable.json.gz'), raw = JSON.parse(gunzipSync(bytes))
const source = json('data/zug-grienbach-atlas-sources/sources.json'), rows = json('data/zug-grienbach-atlas-sources/platform-rows.json')
const review = (p = policy.grienbachAtlasReview, hash = sha256(bytes)) => reviewZugGrienbachAtlas(p, policy.grienbachReview, raw, hash)
describe('Grienbach date-valid atlas platform review', () => {
  it('parses quoted delimiters, escaped quotes, line breaks and rejects truncated records', () => {
    expect([...atlasCsvRecords('\uFEFFa;b\r\n"x;y";"one\n""two"""\r\n')]).toEqual([['a', 'b'], ['x;y', 'one\n"two"']])
    expect(() => [...atlasCsvRecords('a;"truncated')]).toThrow('Unterminated')
    expect(() => [...atlasCsvRecords('"a"bad;b')]).toThrow('closing')
    expect(() => selectAtlasPlatforms('number;sloid\n1;a\n2;b', { fields: ['number', 'sloid'], stationNumbers: ['1'], rowCount: 3, selectedRows: 1 })).toThrow('national atlas inventory')
    expect(() => selectAtlasPlatforms('number;sloid\n1', { fields: ['number', 'sloid'], stationNumbers: ['1'], rowCount: 1, selectedRows: 1 })).toThrow('CSV record')
  })
  it('re-extracts all 12 selected versions from the complete export and retains the unresolved calls', async () => {
    const result = await review()
    expect(result.source.rowCount).toBe(155869)
    expect(result.platforms).toHaveLength(6)
    expect(result.maximumGapMetres).toBeLessThan(0.4)
    expect(result.platforms.every(p => p.versions.length === 2 && p.unchangedCoordinatesAcrossVersions)).toBe(true)
    expect(result.platforms.flatMap(p => p.days).every(d => d.validFrom === '2026-03-27' && d.validTo === '9999-12-31' && d.compassDirection === null && d.editedBeforeFixture)).toBe(true)
    expect(result.affected).toEqual([{ date: '2026-09-04', trips: 67 }, { date: '2026-09-06', trips: 38 }])
    expect(result.admittedFromReview).toBe(0); expect(result.coordinateCorrections).toBe(0); expect(result.matchPair).toBeUndefined()
  }, 30_000) // Re-extracts the complete 155,869-row national export.
  it('refuses ambiguous validity, missing date coverage, wrong owners and coordinate substitutions', () => {
    const overlap = structuredClone(rows); overlap[0].validTo = '2026-09-06'
    expect(() => compareAtlasPlatforms(overlap, source, raw)).toThrow('Ambiguous')
    const absent = structuredClone(rows); absent.find(r => r.sloid === rows[0].sloid && r.validFrom === '2026-03-27').validFrom = '2026-09-07'
    expect(() => compareAtlasPlatforms(absent, source, raw)).toThrow('absent')
    const changed = structuredClone(rows); changed[0].servicePointBusinessOrganisationNumber = '11'
    expect(() => compareAtlasPlatforms(changed, source, raw)).toThrow('owner')
    const moved = structuredClone(raw); moved.stops.find(s => s.stop_id === 'ch:1:sloid:93448:0:1').stop_lat = '47.1832'
    expect(() => compareAtlasPlatforms(rows, source, moved)).toThrow('coordinate agreement')
  })
  it('pins the catalogue, timetable and preceding review', async () => {
    await expect(review({ ...policy.grienbachAtlasReview, sourceSha256: 'changed' })).rejects.toThrow('catalogue')
    await expect(review(policy.grienbachAtlasReview, 'changed')).rejects.toThrow('timetable')
    await expect(reviewZugGrienbachAtlas(policy.grienbachAtlasReview, { sourceSha256: 'changed' }, raw, sha256(bytes))).rejects.toThrow('preceding')
  })
})
