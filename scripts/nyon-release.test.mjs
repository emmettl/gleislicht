import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { buildNyonDay } from './build-nyon-day.mjs'
import { refreshNyonDay } from './refresh-nyon-day.mjs'
import { readRegionalDirectory, readRegionalArtifacts } from './regional-artifacts.mjs'
import { restorePublishedRegionalData } from './restore-published-regional-data.mjs'
import { validateNyonRelease } from './nyon-release-validation.mjs'

describe('Nyon dated release', () => {
  it.each([['2026-09-08', 955], ['2026-09-13', 421]])('releases the complete reviewed civil day %s', async (date, trips) => {
    const output = await mkdtemp(join(tmpdir(), 'nyon-release-test-'))
    try {
      expect(await buildNyonDay({ date, output })).toMatchObject({ date, trips, artifacts: 14 })
      const result = await readRegionalDirectory(output, ['nyon-region'], date)
      expect(result.files.size).toBe(14)
      const day = JSON.parse(result.files.get('nyon-region-day-manifest.json'))
      const morning = JSON.parse(result.files.get('nyon-region-morning.json'))
      const trains = [...new Map(day.chunks.flatMap(d => JSON.parse(result.files.get(d.path)).trains).map(t => [t.id, t])).values()]
      expect(trains.some(t => t.start < 0)).toBe(true)
      expect(trains.every(t => t.pathSegments.every(i => i !== null))).toBe(true)
      const changed = structuredClone(trains); changed[0].stops[0][2]++
      expect(() => validateNyonRelease(day, morning, changed)).toThrow('changed reviewed journey')
      const wrongPath = structuredClone(day); wrongPath.paths[0][0][0] += .001
      expect(() => validateNyonRelease(wrongPath, morning, trains)).toThrow('changed reviewed paths')
      const mixed = structuredClone(morning); mixed.metadata.sourceHashes.archive = 'a'.repeat(64)
      expect(() => validateNyonRelease(day, mixed, trains)).toThrow('mixed sourceHashes')
      const corrupted = new Map(result.files); corrupted.set(day.chunks[0].path, Buffer.from('{}'))
      await expect(readRegionalArtifacts(p => corrupted.get(p), ['nyon-region'])).rejects.toThrow('integrity mismatch')
    } finally { await rm(output, { recursive: true, force: true }) }
  })
  it('retains the actual reviewed date after an unreviewed date or build failure', async () => {
    const build = vi.fn().mockRejectedValue(new Error('changed geometry'))
    const restore = vi.fn().mockResolvedValue({ dates: { 'nyon-region': '2026-09-08' } })
    expect(await refreshNyonDay({ date: '2026-09-09', output: '/unused' }, { build, restore })).toEqual({ retained: true, date: '2026-09-08' })
    expect(build).not.toHaveBeenCalled()
    expect(await refreshNyonDay({ date: '2026-09-13', output: '/unused' }, { build, restore })).toEqual({ retained: true, date: '2026-09-08' })
    expect(restore).toHaveBeenLastCalledWith('/unused', undefined, 'public/data', ['nyon-region'])
  })
  it('bootstraps only a missing manifest and never mixes damaged published chunks', async () => {
    const output = await mkdtemp(join(tmpdir(), 'nyon-recovery-test-'))
    try {
      const result = await restorePublishedRegionalData(output, async () => new Response('', { status: 404 }), 'public/data', ['nyon-region'])
      expect(result.dates['nyon-region']).toBe('2026-09-08')
      await rm(output, { recursive: true }); await mkdir(output)
      await writeFile(join(output, 'keep'), 'unchanged')
      const files = new Map(result.files); files.delete('nyon-region-day-chunks/22-24.json')
      await expect(restorePublishedRegionalData(output, async url => {
        const bytes = files.get(url.pathname.replace('/gleislicht/data/', ''))
        return new Response(bytes ?? '', { status: bytes ? 200 : 404 })
      }, 'public/data', ['nyon-region'])).rejects.toThrow('returned 404')
      expect(await readdir(output)).toEqual(['keep'])
      expect(await readFile(join(output, 'keep'), 'utf8')).toBe('unchanged')
    } finally { await rm(output, { recursive: true, force: true }) }
  })
})
