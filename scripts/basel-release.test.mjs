import { describe, expect, it, vi } from 'vitest'
import { readFile, mkdir, mkdtemp, readdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readRegionalArtifacts, readRegionalDirectory } from './regional-artifacts.mjs'
import { refreshBaselDay } from './refresh-basel-day.mjs'
import { restorePublishedRegionalData } from './restore-published-regional-data.mjs'

describe('Basel release and dated recovery', () => {
  it('validates the delivered full day and rejects a changed date, group, or morning path', async () => {
    const { files } = await readRegionalDirectory('public/data', ['basel-core'])
    for (const [filename, change, message] of [
      ['basel-core-day-manifest.json', value => { value.metadata.scope.serviceDates = [] }, 'unreviewed study date'],
      ['basel-core-day-manifest.json', value => { value.metadata.baselGeometry[0].matched-- }, 'mixed baselGeometry'],
      ['basel-core-morning.json', value => { value.paths[0][0][0] += .01 }, 'mixed paths'],
    ]) {
      const changed = new Map(files), value = JSON.parse(changed.get(filename)); change(value)
      changed.set(filename, Buffer.from(JSON.stringify(value)))
      await expect(readRegionalArtifacts(name => changed.get(name), ['basel-core'])).rejects.toThrow(message)
    }
  })

  it('retains the verified original date without acquiring sources for an unreviewed date', async () => {
    const build = vi.fn(), download = vi.fn(), restore = vi.fn(async () => ({ dates: { 'basel-core': '2026-09-08' } }))
    const result = await refreshBaselDay({ date: '2026-09-09', output: '/unused' }, { build, download, restore })
    expect(result).toEqual({ retained: true, date: '2026-09-08' })
    expect(build).not.toHaveBeenCalled(); expect(download).not.toHaveBeenCalled()
    expect(restore).toHaveBeenCalledWith('/unused', undefined, 'public/data', ['basel-core'])
  })

  it('builds approved dates and retains verified data if rebuilding fails validation', async () => {
    const restore = vi.fn(async () => ({ dates: { 'basel-core': '2026-09-08' } }))
    const build = vi.fn(async () => ({ date: '2026-09-13' }))
    const options = { date: '2026-09-13', sourceDirectory: '/retained-sources', output: '/unused' }
    expect(await refreshBaselDay(options, { build, restore })).toEqual({ retained: false, date: '2026-09-13' })
    expect(restore).not.toHaveBeenCalled()
    build.mockRejectedValueOnce(new Error('geometry below gate'))
    expect(await refreshBaselDay(options, { build, restore })).toEqual({ retained: true, date: '2026-09-08' })
  })

  it('bootstraps only a missing published manifest and never mixes a damaged published set', async () => {
    const output = await mkdtemp(join(tmpdir(), 'basel-recovery-test-'))
    try {
      await mkdir(join(output, 'complete'))
      const result = await restorePublishedRegionalData(join(output, 'complete'), async () => new Response('', { status: 404 }), 'public/data', ['basel-core'])
      expect(result.dates['basel-core']).toBe('2026-09-08')
      const sentinel = join(output, 'untouched'); await mkdir(sentinel); await writeFile(join(sentinel, 'keep'), 'before')
      await expect(restorePublishedRegionalData(sentinel, async url => {
        const path = url.pathname.replace('/gleislicht/data/', '')
        if (path.endsWith('22-24.json')) return new Response('', { status: 404 })
        return new Response(await readFile(join('public/data', path)))
      }, 'public/data', ['basel-core'])).rejects.toThrow('returned 404')
      expect(await readdir(sentinel)).toEqual(['keep'])
    } finally { await rm(output, { recursive: true, force: true }) }
  })
})
