import { expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { preserveOrbitalWeekdays } from './preserve-orbital-weekdays.mjs'
import { discoverOrbitalSources } from './orbital-sources.mjs'

it('retains a real weekday source through a Sunday/Monday calendar release without selecting tomorrow early', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orbital-weekday-test-'))
  try {
    const ids = ['swiss-rail', 'postbus-national', 'zurich-city', 'zvv-region', 'geneva-tpg', 'lausanne-region']
    const manifest = date => ({ metadata: { serviceDate: date, windowStart: 0, windowEnd: 86400 }, stops: [], edges: [], chunks: [] })
    for (const id of ids) await writeFile(join(root, `${id}-day-manifest.json`), JSON.stringify(manifest('2026-09-04')))
    const nyon = { ...manifest('2026-09-04'), chunks: [{ path: 'nyon-region-day-chunks/00-24.json' }] }
    await mkdir(join(root, 'nyon-region-day-chunks'))
    await writeFile(join(root, 'nyon-region-day-chunks/00-24.json'), '{"trains":[]}')
    await writeFile(join(root, 'nyon-region-day-manifest.json'), JSON.stringify(nyon))
    const inline = { ...manifest('2026-09-04'), trains: [] }
    delete inline.chunks
    await writeFile(join(root, 'new-network-day.json'), JSON.stringify(inline))
    expect(await preserveOrbitalWeekdays(root)).toHaveLength(8)
    for (const id of ids) await writeFile(join(root, `${id}-day-manifest.json`), JSON.stringify(manifest('2026-09-13')))
    await writeFile(join(root, 'nyon-region-day-manifest.json'), JSON.stringify(manifest('2026-09-13')))
    await writeFile(join(root, 'nyon-region-day-chunks/00-24.json'), '{"trains":["sunday"]}')
    await writeFile(join(root, 'new-network-day.json'), JSON.stringify({ ...inline, metadata: manifest('2026-09-13').metadata }))
    await mkdir(join(root, 'calendar/2026-09-14'), { recursive: true })
    await writeFile(join(root, 'calendar/2026-09-14/swiss-rail-day-manifest.json'), JSON.stringify(manifest('2026-09-14')))
    const sources = [{ id: 'national', file: 'swiss-rail-day-manifest.json' }, { id: 'nyon-region', file: 'nyon-region-day-manifest.json' }]
    const coverage = await discoverOrbitalSources(root, sources)
    expect(coverage.selected.find(source => source.id === 'national')?.file).toBe('weekday/2026-09-04/swiss-rail-day-manifest.json')
    expect(coverage.selected.find(source => source.id === 'nyon-region')?.file).toBe('weekday/2026-09-04/nyon-region-day-manifest.json')
    expect(coverage.selected.find(source => source.id === 'new-network')?.file).toBe('weekday/2026-09-04/new-network-day.json')
    expect(await readFile(join(root, 'weekday/2026-09-04/nyon-region-day-chunks/00-24.json'), 'utf8')).toBe('{"trains":[]}')
    expect(await preserveOrbitalWeekdays(root)).toEqual([])
    await writeFile(join(root, 'swiss-rail-day-manifest.json'), JSON.stringify(manifest('2026-09-14')))
    expect((await discoverOrbitalSources(root, sources)).selected.find(source => source.id === 'national')?.file).toBe('swiss-rail-day-manifest.json')
  } finally { await rm(root, { recursive: true, force: true }) }
})
