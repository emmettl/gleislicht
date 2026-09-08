import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { buildRivieraDay } from './build-riviera-day.mjs'
import { refreshRivieraDay } from './refresh-riviera-day.mjs'
import { readRegionalDirectory, readRegionalArtifacts } from './regional-artifacts.mjs'
import { restorePublishedRegionalData } from './restore-published-regional-data.mjs'
import { validateRivieraRelease } from './riviera-release-validation.mjs'

describe('Riviera dated release', () => {
  it.each([['2026-09-08', 1907], ['2026-09-13', 1334]])('releases the complete reviewed civil day %s', async (date, trips) => {
    const output = await mkdtemp(join(tmpdir(), 'riviera-release-test-'))
    try {
      expect(await buildRivieraDay({ date, output })).toMatchObject({ date, trips, artifacts: 14 })
      const result = await readRegionalDirectory(output, ['riviera-region'], date)
      expect(result.files.size).toBe(14)
      const day = JSON.parse(result.files.get('riviera-region-day-manifest.json'))
      const morning = JSON.parse(result.files.get('riviera-region-morning.json'))
      const trains = [...new Map(day.chunks.flatMap(d => JSON.parse(result.files.get(d.path)).trains).map(t => [t.id, t])).values()]
      expect(trains.some(t => t.start < 0)).toBe(true)
      expect(trains.every(t => t.pathSegments.every(i => i !== null))).toBe(true)
      const changed = structuredClone(trains); changed[0].stops[0][2]++
      expect(() => validateRivieraRelease(day, morning, changed)).toThrow('changed reviewed journey')
      const wrongPath = structuredClone(day); wrongPath.paths[0][0][0] += .001
      expect(() => validateRivieraRelease(wrongPath, morning, trains)).toThrow('changed reviewed paths')
      const mixed = structuredClone(morning); mixed.metadata.sourceHashes.archive = 'a'.repeat(64)
      expect(() => validateRivieraRelease(day, mixed, trains)).toThrow('mixed sourceHashes')
      const corrupted = new Map(result.files); corrupted.set(day.chunks[0].path, Buffer.from('{}'))
      await expect(readRegionalArtifacts(p => corrupted.get(p), ['riviera-region'])).rejects.toThrow('integrity mismatch')
    } finally { await rm(output, { recursive: true, force: true }) }
  })
  it('retains the actual reviewed date after an unreviewed date or build failure', async () => {
    const build = vi.fn().mockRejectedValue(new Error('changed geometry'))
    const restore = vi.fn().mockResolvedValue({ dates: { 'riviera-region': '2026-09-08' } })
    expect(await refreshRivieraDay({ date: '2026-09-09', output: '/unused' }, { build, restore })).toEqual({ retained: true, date: '2026-09-08' })
    expect(build).not.toHaveBeenCalled()
    expect(await refreshRivieraDay({ date: '2026-09-13', output: '/unused' }, { build, restore })).toEqual({ retained: true, date: '2026-09-08' })
    expect(restore).toHaveBeenLastCalledWith('/unused', undefined, 'public/data', ['riviera-region'])
  })
  it('bootstraps only a missing manifest and never mixes damaged published chunks', async () => {
    const output = await mkdtemp(join(tmpdir(), 'riviera-recovery-test-'))
    try {
      const result = await restorePublishedRegionalData(output, async () => new Response('', { status: 404 }), 'public/data', ['riviera-region'])
      expect(result.dates['riviera-region']).toBe('2026-09-08')
      await rm(output, { recursive: true }); await mkdir(output)
      await writeFile(join(output, 'keep'), 'unchanged')
      const files = new Map(result.files); files.delete('riviera-region-day-chunks/22-24.json')
      await expect(restorePublishedRegionalData(output, async url => {
        const bytes = files.get(url.pathname.replace('/gleislicht/data/', ''))
        return new Response(bytes ?? '', { status: bytes ? 200 : 404 })
      }, 'public/data', ['riviera-region'])).rejects.toThrow('returned 404')
      expect(await readdir(output)).toEqual(['keep'])
      expect(await readFile(join(output, 'keep'), 'utf8')).toBe('unchanged')
    } finally { await rm(output, { recursive: true, force: true }) }
  })
})
