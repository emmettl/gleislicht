import { expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
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
    expect(await preserveOrbitalWeekdays(root)).toHaveLength(6)
    for (const id of ids) await writeFile(join(root, `${id}-day-manifest.json`), JSON.stringify(manifest('2026-09-13')))
    await mkdir(join(root, 'calendar/2026-09-14'), { recursive: true })
    await writeFile(join(root, 'calendar/2026-09-14/swiss-rail-day-manifest.json'), JSON.stringify(manifest('2026-09-14')))
    const sources = [{ id: 'national', file: 'swiss-rail-day-manifest.json' }]
    const coverage = await discoverOrbitalSources(root, sources)
    expect(coverage.selected.find(source => source.id === 'national')?.file).toBe('weekday/2026-09-04/swiss-rail-day-manifest.json')
    await writeFile(join(root, 'swiss-rail-day-manifest.json'), JSON.stringify(manifest('2026-09-14')))
    expect((await discoverOrbitalSources(root, sources)).selected.find(source => source.id === 'national')?.file).toBe('swiss-rail-day-manifest.json')
  } finally { await rm(root, { recursive: true, force: true }) }
})
