import { spawnSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { writeFile } from 'node:fs/promises'
import { describe, it, expect } from 'vitest'
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { simplifyBernPath, bernDisplayDeviation } from './bern-display-geometry.mjs'
import { bernWgs84 } from './bern-spatial.mjs'
import { buildSolothurnDay } from './build-solothurn-day.mjs'
import { readRegionalDirectory, readRegionalArtifacts } from './regional-artifacts.mjs'
import { refreshSolothurnDay } from './refresh-solothurn-day.mjs'
import { restorePublishedRegionalData } from './restore-published-regional-data.mjs'

const edit = (files, path, change) => { const data = JSON.parse(files.get(path)); change(data); files.set(path, Buffer.from(JSON.stringify(data))) }
describe('Solothurn display release', () => {
  it('bounds curved and reversing paths in metres while retaining every endpoint', () => {
    const points = [[0, 0], [10, 2], [20, 0], [20, 20], [10, 20], [0, 0]].map(([x, y]) => bernWgs84([2600000 + x, 1200000 + y]))
    const simplified = simplifyBernPath(points, 5)
    expect(simplified.length).toBeLessThan(points.length)
    expect(bernDisplayDeviation(points, simplified)).toBeLessThanOrEqual(5)
    expect(simplified[0]).toEqual(points[0]); expect(simplified.at(-1)).toEqual(points.at(-1))
    expect(() => bernDisplayDeviation(points, [points[0], points[2], points[1], points.at(-1)])).toThrow()
    expect(bernDisplayDeviation(points, [points[0], points.at(-1)])).toBeGreaterThan(5)
  })
  it('reproduces both audited dates within budgets without changing any movement or call', async () => {
    const output = await mkdtemp(join(tmpdir(), 'solothurn-display-test-'))
    try {
      for (const date of ['2026-09-04', '2026-09-06']) {
        const report = await buildSolothurnDay({ date, output })
        expect(report.movements.total).toBe(date.endsWith('04') ? 7033 : 5695)
        const { files } = await readRegionalDirectory(output, ['solothurn-region'], date)
        const archive = JSON.parse(await readFile(`public/data/solothurn-region/${date}/solothurn-region-day-manifest.json`))
        for (const chunk of archive.chunks) expect(files.get(`solothurn-region-${chunk.path}`).equals(await readFile(`public/data/solothurn-region/${date}/${chunk.path}`))).toBe(true)
        if (date.endsWith('04')) for (const [path, bytes] of files) {
          const committedBytes = await readFile(join('public/data', path))
          if (path === 'solothurn-region-day-manifest.json' || path === 'solothurn-region-morning.json') {
            const actual = JSON.parse(bytes), committed = JSON.parse(committedBytes)
            const measured = actual.metadata.solothurnRelease.simplification
            const expected = committed.metadata.solothurnRelease.simplification
            expect(measured.maximumDeviationMetres).toBeCloseTo(expected.maximumDeviationMetres, 9)
            // All source coordinates, retained vertices, identities and calls
            // still compare exactly; only the derived diagnostic can round.
            measured.maximumDeviationMetres = expected.maximumDeviationMetres
            expect(actual).toEqual(committed)
          } else expect(bytes.equals(committedBytes), path).toBe(true)
        }
      }
    } finally { await rm(output, { recursive: true, force: true }) }
  }, 30000)
  it('rejects mixed geometry, missing credit, false counts, unsafe deviation and unreviewed dates', async () => {
    const release = await readRegionalDirectory('public/data', ['solothurn-region'])
    for (const mutate of [
      d => { d.metadata.solothurnRelease.simplification.maximumDeviationMetres = 6 },
      d => { d.metadata.geometry.attribution = '' },
      d => { d.metadata.solothurnRelease.movements.scheduled++ },
      d => { d.metadata.serviceDate = '2026-09-08' },
    ]) {
      const files = new Map(release.files)
      for (const path of ['solothurn-region-day-manifest.json', 'solothurn-region-morning.json']) edit(files, path, mutate)
      await expect(readRegionalArtifacts(path => files.get(path), ['solothurn-region'])).rejects.toThrow()
    }
    const files = new Map(release.files)
    edit(files, 'solothurn-region-morning.json', d => { d.paths[0][0][0] += .0001 })
    await expect(readRegionalArtifacts(path => files.get(path), ['solothurn-region'])).rejects.toThrow('mixed paths')
  }, 30000)
  it('retains the reviewed date on unreviewed dates and on build failures', async () => {
    let calls = 0
    const restore = async (_output, _fetch, _bootstrap, ids) => { expect(ids).toEqual(['solothurn-region']); return { dates: { 'solothurn-region': '2026-09-04' } } }
    const build = async () => { calls++; throw new Error('damaged candidate') }
    expect(await refreshSolothurnDay({ date: '2026-09-08' }, { build, restore })).toEqual({ retained: true, date: '2026-09-04' }); expect(calls).toBe(0)
    expect(await refreshSolothurnDay({ date: '2026-09-06' }, { build, restore })).toEqual({ retained: true, date: '2026-09-04' }); expect(calls).toBe(1)
    expect(await refreshSolothurnDay({ date: '2026-09-06' }, { build: async () => ({ date: '2026-09-06' }), restore })).toEqual({ retained: false, date: '2026-09-06' })
  })
  it('bootstraps a missing first release but never fills in a damaged published chunk', async () => {
    const output = await mkdtemp(join(tmpdir(), 'solothurn-recovery-test-'))
    try {
      const result = await restorePublishedRegionalData(output, async () => new Response('', { status: 404 }), 'public/data', ['solothurn-region'])
      expect(result.dates['solothurn-region']).toBe('2026-09-04')
      await rm(output, { recursive: true, force: true })
      const release = await readRegionalDirectory('public/data', ['solothurn-region'])
      await expect(restorePublishedRegionalData(output, async url => {
        const path = url.pathname.split('/data/')[1]
        return path.includes('day-chunks') ? new Response('', { status: 404 }) : new Response(release.files.get(path))
      }, 'public/data', ['solothurn-region'])).rejects.toThrow('returned 404')
      await expect(readdir(output)).rejects.toThrow()
    } finally { await rm(output, { recursive: true, force: true }) }
  }, 30000)
})


it('refreshes Solothurn and Nyon independently through the regional CLI', async () => {
  const work = await mkdtemp(join(tmpdir(), 'solothurn-cli-test-'))
  try {
    const rail = join(work, 'network.xtf')
    await writeFile(rail, gunzipSync(await readFile('data/zug-rail-sources/network.xtf.gz')))
    for (const [study, date] of [['solothurn-region', '2026-09-04'], ['nyon-region', '2026-09-08']]) {
      const output = join(work, study)
      const result = spawnSync(process.execPath, ['scripts/build-regional-days.mjs', '--archive', 'unused', '--zvv', 'unused', '--tpg', 'unused', '--rail', rail, '--date', date, '--study', study, '--output-directory', output], { encoding: 'utf8' })
      expect(result.status, result.stderr).toBe(0)
      const release = await readRegionalDirectory(output, [study], date)
      expect(Object.keys(release.dates)).toEqual([study])
      expect((await readdir(output)).every(name => name.startsWith(study))).toBe(true)
    }
  } finally { await rm(work, { recursive: true, force: true }) }
}, 30000)
