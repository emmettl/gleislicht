import { afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GenevaSummaryDetail, LuzernProfile } from '../src/studies/GenevaLuzernStatistics.tsx'
import { SUMMARY_COPY } from '../src/studies/geneva-luzern-statistic-copy.ts'
import { loadSummary, validateSummary, validateSummaryIndex, type GenevaData, type LuzernData } from '../src/studies/geneva-luzern-statistics.ts'
import type { UiLanguage } from '../src/i18n.ts'

const base = 'public/data/geneva-luzern-statistics/'
const index = validateSummaryIndex(JSON.parse(readFileSync(base + 'index.json', 'utf8')))
const geneva = validateSummary(JSON.parse(readFileSync(base + 'geneva.json', 'utf8')), 'geneva') as GenevaData
const luzern = validateSummary(JSON.parse(readFileSync(base + 'luzern.json', 'utf8')), 'luzern') as LuzernData
afterEach(() => vi.unstubAllGlobals())

it('validates both products without treating their statistics as playback', () => {
  expect(geneva.records).toHaveLength(694)
  expect(luzern.profile.hours.QS).toHaveLength(24)
  expect(luzern.reviewedProfiles).toBe(1)
  expect(luzern.playbackEligible).toBe(false)
})
it('localizes missing years, availability and peak-period limits', () => {
  const record = geneva.records.find(r => r.dailyMean.value === null)!
  for (const language of ['en', 'de', 'fr', 'it'] as UiLanguage[]) {
    const html = renderToStaticMarkup(createElement(GenevaSummaryDetail, { record, language }))
    expect(html).toContain(SUMMARY_COPY[language].unknownYear)
    expect(html).toContain(SUMMARY_COPY[language].missing)
    expect(html).toContain(SUMMARY_COPY[language].peakNote)
  }
})
it('shows independent reference years and preserves reported zero peaks', () => {
  const record = { ...geneva.records[0], dailyMean: { value: 100, referenceYear: 2024 }, workingDayMean: { value: 120, referenceYear: 2025 }, morningPeak: 0 }
  const html = renderToStaticMarkup(createElement(GenevaSummaryDetail, { record, language: 'en' }))
  expect(html).toContain('Reference year 2024'); expect(html).toContain('Reference year 2025')
  expect(html).toContain('<dd>0</dd>')
})
it('renders the limited typical profile with the unresolved source discrepancy in every language', () => {
  for (const language of ['en', 'de', 'fr', 'it'] as UiLanguage[]) {
    const html = renderToStaticMarkup(createElement(LuzernProfile, { data: luzern, language }))
    expect(html).toContain(SUMMARY_COPY[language].profile)
    expect(html).toContain(SUMMARY_COPY[language].scope)
    expect(html).toContain(SUMMARY_COPY[language].rounded)
    expect(html).toContain('23:00–24:00')
    expect(html).toContain(SUMMARY_COPY[language].discrepancy.split('{map}')[0])
  }
})
it('rejects duplicate measurement points, changed semantics and hidden discrepancy', () => {
  const duplicate = structuredClone(geneva); duplicate.records[1] = duplicate.records[0]
  expect(() => validateSummary(duplicate, 'geneva')).toThrow()
  expect(() => validateSummary({ ...luzern, basis: 'measured-day' }, 'luzern')).toThrow()
  expect(() => validateSummary({ ...luzern, catalogueDiscrepancy: false }, 'luzern')).toThrow()
  const short = structuredClone(luzern); short.profile.hours.R1.pop()
  expect(() => validateSummary(short, 'luzern')).toThrow()
})
it('rejects foreign asset paths and checks fetched bytes before presenting data', async () => {
  const bad = structuredClone(index); bad.files.luzern.path = '../other.json'
  expect(() => validateSummaryIndex(bad)).toThrow()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(index))).mockResolvedValueOnce(new Response(readFileSync(base + 'luzern.json'))))
  expect(await loadSummary('/data/', 'luzern', new AbortController().signal)).toEqual(luzern)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(index))).mockResolvedValueOnce(new Response(readFileSync(base + 'luzern.json', 'utf8') + ' ')))
  await expect(loadSummary('/data/', 'luzern', new AbortController().signal)).rejects.toThrow('integrity')
})
it('propagates unavailable responses and cancellation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
  await expect(loadSummary('/data/', 'geneva', new AbortController().signal)).rejects.toThrow('unavailable')
  const controller = new AbortController(); controller.abort()
  vi.stubGlobal('fetch', vi.fn((_url, options) => options.signal.throwIfAborted()))
  await expect(loadSummary('/data/', 'geneva', controller.signal)).rejects.toThrow()
})
