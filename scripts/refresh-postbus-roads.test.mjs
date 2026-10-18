import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { refreshPostbusRoads } from './refresh-postbus-roads.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'

const roots = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'auto-postbus-test-')); roots.push(root)
  const stops = [[8, 47, 'A', '', 'a'], [8.01, 47, 'B', '', 'b']]
  const train = { id: 'bus', routeId: '801-1', stops: [[0, 0, 0], [1, 100, 100]] }
  const payload = JSON.stringify({ windowStart: 0, windowEnd: 86400, trains: [train] })
  const path = 'postbus-national-day-chunks/00-24.json'
  const descriptor = { path, bytes: Buffer.byteLength(payload), sha256: createHash('sha256').update(payload).digest('hex') }
  const manifest = { metadata: { serviceDate: '2026-09-30', feedVersion: '20260928' }, stops, edges: [[0, 1]], chunks: [descriptor] }
  const cache = { schemaVersion: 1, metadata: { matcher: { matcherVersion: 'test' } },
    patterns: { [roadPatternId(train, stops)]: [0] }, paths: [stops.map(s => s.slice(0, 2))] }
  const options = { snapshotPath: join(root, 'manifest.json'), cachePath: join(root, 'committed-cache.json'),
    reusableCachePath: join(root, 'reuse/cache.json'), workDirectory: join(root, 'work') }
  await mkdir(join(root, 'postbus-national-day-chunks'))
  await writeFile(options.snapshotPath, JSON.stringify(manifest))
  await writeFile(join(root, path), payload)
  await writeFile(options.cachePath, JSON.stringify(cache))
  const audit = vi.fn(async snapshot => {
    const enriched = JSON.parse(await readFile(snapshot))
    expect(enriched.metadata.serviceDate).toBe(manifest.metadata.serviceDate)
    const bytes = await readFile(join(snapshot, '..', path))
    expect(enriched.chunks[0].sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    expect(JSON.parse(bytes).trains[0].pathSegments).toEqual([0])
    return { roadCoverage: 1 }
  })
  const build = vi.fn(async () => cache)
  const before = async () => Promise.all([options.snapshotPath, join(root, path), options.cachePath].map(p => readFile(p)))
  return { root, options: { ...options, audit, build }, cache, before, audit, build }
}

describe('automatic PostBus road refresh', () => {
  it('uses sufficient committed geometry without native builds and audits staged bytes', async () => {
    const f = await fixture()
    expect(await refreshPostbusRoads(f.options)).toEqual({ source: 'committed', roadCoverage: 1 })
    expect(f.build).not.toHaveBeenCalled()
    expect(f.audit).toHaveBeenCalledOnce()
    expect(f.audit.mock.calls[0][0]).not.toBe(f.options.snapshotPath)
    expect(JSON.parse(await readFile(f.options.reusableCachePath))).toEqual(f.cache)
    expect(await readdir(f.options.workDirectory)).toEqual([])
  })
  it('rebuilds missing patterns from the current complete day, then validates and saves reuse', async () => {
    const f = await fixture()
    await writeFile(f.options.cachePath, JSON.stringify({ ...f.cache, patterns: {} }))
    expect((await refreshPostbusRoads(f.options)).source).toBe('rebuilt')
    expect(f.build).toHaveBeenCalledOnce()
    expect(f.build.mock.calls[0][0].manifest.metadata.serviceDate).toBe('2026-09-30')
    expect(f.build.mock.calls[0][0].trains).toHaveLength(1)
    expect(f.audit).toHaveBeenCalledOnce()
    expect(JSON.parse(await readFile(f.options.reusableCachePath))).toEqual(f.cache)
    f.build.mockClear()
    expect((await refreshPostbusRoads(f.options)).source).toBe('reused')
    expect(f.build).not.toHaveBeenCalled()
  })
  it.each(['malformed', 'bad-reference', 'stale-pattern'])('discards a %s reusable cache without weakening validation', async kind => {
    const f = await fixture()
    await mkdir(join(f.root, 'reuse'))
    const broken = structuredClone(f.cache)
    if (kind === 'bad-reference') broken.patterns[Object.keys(broken.patterns)[0]] = [999]
    if (kind === 'stale-pattern') broken.patterns = {}
    await writeFile(f.options.reusableCachePath, kind === 'malformed' ? '{' : JSON.stringify(broken))
    expect((await refreshPostbusRoads(f.options)).source).toBe('committed')
    expect(f.build).not.toHaveBeenCalled()
  })
  it.each(['build-fails', 'coverage-fails', 'audit-fails'])('preserves all originals and last reusable cache when %s', async kind => {
    const f = await fixture()
    const insufficient = { ...f.cache, patterns: {} }
    await writeFile(f.options.cachePath, JSON.stringify(insufficient))
    await mkdir(join(f.root, 'reuse'))
    const saved = JSON.stringify(insufficient)
    await writeFile(f.options.reusableCachePath, saved)
    if (kind === 'build-fails') f.build.mockRejectedValue(new Error('download unavailable'))
    if (kind === 'coverage-fails') f.build.mockResolvedValue(insufficient)
    if (kind === 'audit-fails') f.audit.mockRejectedValue(new Error('geometry budget failed'))
    const before = await f.before()
    await expect(refreshPostbusRoads(f.options)).rejects.toThrow()
    expect(await f.before()).toEqual(before)
    expect(await readFile(f.options.reusableCachePath, 'utf8')).toBe(saved)
    expect(await readdir(f.options.workDirectory)).toEqual([])
  })
  it('does not hide invalid committed geometry as an upstream coverage change', async () => {
    const f = await fixture()
    f.cache.paths = []
    await writeFile(f.options.cachePath, JSON.stringify(f.cache))
    await expect(refreshPostbusRoads(f.options)).rejects.toThrow('Invalid cached path reference')
    expect(f.build).not.toHaveBeenCalled()
  })
})
