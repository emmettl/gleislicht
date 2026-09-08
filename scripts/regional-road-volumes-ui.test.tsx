import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { RegionalVolumeDetail } from '../src/studies/RegionalRoadVolumes.tsx'
import { defaultVolumeCounter, loadVolumeDay, loadVolumeIndex, validateVolumeDay, validateVolumeIndex, type VolumeDay } from '../src/studies/regional-road-volumes.ts'
import { REGIONAL_VOLUME_COPY, volumeQuality } from '../src/studies/regional-road-volume-copy.ts'
import type { UiLanguage } from '../src/i18n.ts'

const root = 'public/data/regional-road-volumes/'
const index = validateVolumeIndex(JSON.parse(readFileSync(`${root}index.json`, 'utf8')))
const file = index.files[0]
const day = JSON.parse(readFileSync(root + file.path, 'utf8')) as VolumeDay
afterEach(() => vi.unstubAllGlobals())

describe('regional hourly counter interface data', () => {
  it('validates every published region/day and chooses reviewed counter directions by default', () => {
    expect(index.series).toHaveLength(620)
    for (const f of index.files) expect(validateVolumeDay(JSON.parse(readFileSync(root + f.path, 'utf8')), f, index).series).toHaveLength(f.series)
    const basel = index.series.filter(c => c.source === 'basel')
    expect(basel.find(c => c.id === defaultVolumeCounter(basel))?.orientation).not.toBeNull()
    expect(defaultVolumeCounter([])).toBe('')
  })
  it('rejects mismatched region/date, duplicate counters and hidden gaps', () => {
    const wrong = structuredClone(day); wrong.metadata.source = 'thurgau'
    expect(() => validateVolumeDay(wrong, file, index)).toThrow('identity')
    const duplicate = structuredClone(day); duplicate.series[1] = duplicate.series[0]
    expect(() => validateVolumeDay(duplicate, file, index)).toThrow('counter hours')
    const gap = structuredClone(day); gap.series[0].hours.pop()
    expect(() => validateVolumeDay(gap, file, index)).toThrow('counter hours')
  })
  it('rejects an imputed reading shown as measured and partial days labelled complete', () => {
    const imputed = structuredClone(day); imputed.series[0].hours[0].quality.status = 'imputed'
    expect(() => validateVolumeDay(imputed, file, index)).toThrow('Unmeasured')
    const partial = structuredClone(day); partial.series[0].hours[0].value = null; partial.series[0].hours[0].quality.status = 'missing'
    expect(() => validateVolumeDay(partial, file, index)).toThrow('total or coverage')
  })
  it('does not permit unresolved orientation arrows or foreign asset paths', () => {
    const arrow = structuredClone(index); arrow.series[0].orientation = { bearingDegrees: 180, method: '', evidence: '', pathId: '' }
    expect(() => validateVolumeIndex(arrow)).toThrow('orientation')
    const path = structuredClone(index); path.files[0].path = 'https://example.com/counts.json'
    expect(() => validateVolumeIndex(path)).toThrow('file identity')
  })
  it('verifies exact bytes before presenting a fetched day', async () => {
    const bytes = readFileSync(root + file.path)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes)))
    expect((await loadVolumeDay('/data/', file, index, new AbortController().signal)).series).toHaveLength(63)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes.toString().replace('"value":167', '"value":168'))))
    await expect(loadVolumeDay('/data/', file, index, new AbortController().signal)).rejects.toThrow('integrity')
  })
  it('reports request failures and propagates cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    await expect(loadVolumeIndex('/data/', new AbortController().signal)).rejects.toThrow('unavailable')
    const controller = new AbortController(); controller.abort()
    vi.stubGlobal('fetch', vi.fn((_url, options) => { options.signal.throwIfAborted() }))
    await expect(loadVolumeIndex('/data/', controller.signal)).rejects.toThrow()
  })
})

describe('counter volume presentation', () => {
  it('renders a reviewed local compass and keeps unknown direction arrowless', () => {
    const counter = index.series.find(c => c.id === defaultVolumeCounter(index.series.filter(c => c.source === 'basel')))!
    const values = day.series.find(s => s.detectorId === counter.id)!
    const html = renderToStaticMarkup(createElement(RegionalVolumeDetail, { counter, values, day, language: 'en' }))
    expect(html).toContain('<svg')
    expect(html).toContain('Complete day total')
    const unknown = renderToStaticMarkup(createElement(RegionalVolumeDetail, { counter: { ...counter, orientation: null }, values, day, language: 'en' }))
    expect(unknown).not.toContain('<svg')
    expect(unknown).toContain('Travel direction not reviewed')
  })
  it('renders measured zeros separately from source gaps and localizes all four languages', () => {
    const f = index.files.find(f => f.source === 'zurich-city')!
    const localDay = validateVolumeDay(JSON.parse(readFileSync(root + f.path, 'utf8')), f, index)
    const missing = localDay.series.find(s => s.hours.every(h => h.value === null))!
    const counter = index.series.find(c => c.id === missing.detectorId)!
    for (const language of ['en', 'de', 'fr', 'it'] as UiLanguage[]) {
      const html = renderToStaticMarkup(createElement(RegionalVolumeDetail, { counter, values: missing, day: localDay, language }))
      expect(html).toContain(REGIONAL_VOLUME_COPY[language].noValue)
      expect(html).toContain('is-missing')
      expect(html).not.toContain(REGIONAL_VOLUME_COPY[language].total)
    }
    const zeroSeries = day.series.find(s => s.hours.some(h => h.value === 0))!
    const zeroCounter = index.series.find(c => c.id === zeroSeries.detectorId)!
    expect(renderToStaticMarkup(createElement(RegionalVolumeDetail, { counter: zeroCounter, values: zeroSeries, day, language: 'en' }))).toContain('is-zero')
    expect(volumeQuality(missing.hours[0], REGIONAL_VOLUME_COPY.en)).toBe('Source reports a missing measurement')
  })
})
