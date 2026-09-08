import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AargauStatisticDetail } from '../src/studies/AargauRoadStatistics.tsx'
import { AARGAU_STATISTIC_COPY } from '../src/studies/aargau-road-statistics-copy.ts'
import { defaultStatisticRecord, loadStatisticIndex, loadStatisticShard, validateStatisticIndex, validateStatisticShard, type StatisticRecord } from '../src/studies/aargau-road-statistics.ts'
import type { UiLanguage } from '../src/i18n.ts'

const root = 'public/data/aargau-road-statistics/'
const index = validateStatisticIndex(JSON.parse(readFileSync(root + 'index.json', 'utf8')))
const shards = Object.fromEntries(Object.keys(index.files).map(key => [key, JSON.parse(readFileSync(root + index.files[key].path, 'utf8'))]))
const station = index.stations.find(s => s.id === 'AG1000')!
const records = validateStatisticShard(shards[station.shard], station.shard, index)[station.id]
const record = defaultStatisticRecord(records)
afterEach(() => vi.unstubAllGlobals())

describe('Aargau survey explorer', () => {
  it('validates all public records against the source and checks file integrity', () => {
    const source = JSON.parse(gunzipSync(readFileSync('data/aargau-road-statistics.json.gz')).toString()).records as { id: string; metrics: StatisticRecord['metrics']; period: StatisticRecord['period'] }[]
    const originals = new Map(source.map(row => [row.id, row]))
    expect(index.stations).toHaveLength(911)
    let total = 0
    for (const [key, file] of Object.entries(index.files)) {
      const body = readFileSync(root + file.path)
      expect(body.length).toBe(file.bytes)
      expect(createHash('sha256').update(body).digest('hex')).toBe(file.sha256)
      for (const rows of Object.values(validateStatisticShard(shards[key], key, index))) for (const row of rows) {
        expect(row.metrics).toEqual(originals.get(row.id)!.metrics)
        expect(row.period).toEqual(originals.get(row.id)!.period)
        total++
      }
    }
    expect(total).toBe(10093)
  })
  it('defaults to the latest plausible both-direction record without summing surveys', () => {
    expect(record.direction.scope).toBe('both')
    expect(record.metrics.DTV).toBe(7473)
    expect(record.metrics.DTV24).toBe(7832)
    expect(record.substitution).toEqual({ date: '2026-05-01', replacement: '2026-05-08' })
  })
  it('renders qualified means and source reports in all interface languages', () => {
    for (const language of ['en', 'de', 'fr', 'it'] as UiLanguage[]) {
      const copy = AARGAU_STATISTIC_COPY[language]
      const html = renderToStaticMarkup(createElement(AargauStatisticDetail, { record, language }))
      expect(html).toContain(copy.annual)
      expect(html).toContain(copy.period)
      expect(html).toContain(copy.exclusive)
      expect(html).toContain(copy.substitution.split('{date}')[0])
      expect(html).toContain('https://www.ag.ch/')
      expect(html).not.toContain('<svg')
    }
  })
  it('withholds invalid-period means but preserves the annual estimate', () => {
    const invalid: StatisticRecord = { ...record, period: { ...record.period, status: 'invalid', startLocal: record.period.endExclusiveLocal }, metrics: { ...record.metrics, DTV: 12345, DTV24: 98765 } }
    const html = renderToStaticMarkup(createElement(AargauStatisticDetail, { record: invalid, language: 'en' }))
    expect(html).toContain(AARGAU_STATISTIC_COPY.en.invalidPeriod)
    expect(html).not.toContain('98&#x27;765')
    expect(html).toContain('12&#x27;345')
    expect(html).toContain(AARGAU_STATISTIC_COPY.en.withheld)
  })
  it('keeps unreviewed reports and missing values distinct from zero', () => {
    const missing: StatisticRecord = { ...record, substitution: null, quality: 'report-unreviewed', period: { ...record.period, status: 'missing', startLocal: null, endExclusiveLocal: null }, metrics: { ...record.metrics, DTV24: null, DWV24: 0 } }
    const html = renderToStaticMarkup(createElement(AargauStatisticDetail, { record: missing, language: 'en' }))
    expect(html).toContain(AARGAU_STATISTIC_COPY.en.missingPeriod)
    expect(html).toContain(AARGAU_STATISTIC_COPY.en.unreviewed)
    expect(html).toContain('<dd>Not reported<span>')
    expect(html).toContain('<td>0</td>')
  })
  it('rejects missing rows, unsafe URLs and hidden period/report issues', () => {
    for (const change of [
      (rows: StatisticRecord[]) => { rows.pop() },
      (rows: StatisticRecord[]) => { rows[0].reportUrl = 'https://example.com/' },
      (rows: StatisticRecord[]) => { rows[0].period.status = 'missing'; rows[0].period.startLocal = '2026-01-01T00:00:00' },
      (rows: StatisticRecord[]) => { rows[0].quality = 'report-reviewed-with-substitution'; rows[0].substitution = null },
    ]) {
      const changed = structuredClone(shards[station.shard]); change(changed.stations[station.id])
      expect(() => validateStatisticShard(changed, station.shard, index)).toThrow()
    }
    const bad = structuredClone(index); bad.files[station.shard].path = '../other.json'
    expect(() => validateStatisticIndex(bad)).toThrow()
  })
  it('verifies downloaded bytes before showing statistics', async () => {
    const body = readFileSync(root + index.files[station.shard].path)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
    expect(await loadStatisticShard('/data/', station, index, new AbortController().signal)).toEqual(records)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body.toString() + ' ')))
    await expect(loadStatisticShard('/data/', station, index, new AbortController().signal)).rejects.toThrow('integrity')
  })
  it('handles request failure and cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    await expect(loadStatisticIndex('/data/', new AbortController().signal)).rejects.toThrow('unavailable')
    const controller = new AbortController(); controller.abort()
    vi.stubGlobal('fetch', vi.fn((_url, options) => { options.signal.throwIfAborted() }))
    await expect(loadStatisticShard('/data/', station, index, controller.signal)).rejects.toThrow()
  })
})
