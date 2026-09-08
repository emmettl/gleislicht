import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { auditLausanneStudy } from './audit-lausanne-study.mjs'
import { readRegionalDirectory } from './regional-artifacts.mjs'

export async function buildLausanneDay({ archive, railPath, date, output, snapshotPath, mbcSnapshotPath, busCachePath = 'data/lausanne-road-cache.json' }) {
  const staged = await mkdtemp(join(tmpdir(), 'lausanne-publish-'))
  try {
    const report = await auditLausanneStudy({ archive, railPath, date, output: staged, snapshotPath, busCachePath, includeMbc: true, mbcSnapshotPath })
    assert(report.gate.passed, `Lausanne failed validation: ${report.gate.failures.join('; ')}`)
    for (const name of ['lausanne-region-day-manifest.json', 'lausanne-region-morning.json']) {
      const value = JSON.parse(await readFile(join(staged, name), 'utf8'))
      assert.equal(value.metadata.dayModel, 'civil day with preceding service-day spillover', 'Lausanne requires civil-day coverage')
      value.metadata.note = 'Scheduled Lausanne-region transport plus complete MBC rail and bus journeys through Morges, Bière and Cossonay, including preceding service-day spillover. Cossonay funicular and lake services excluded. Rail follows matched FOT corridors with short platform connectors. OSM bus paths are inferred, not operator-verified routes. Unmatched segments retain stop interpolation; frequency services are representative, not exact departures. No live GPS positions.'
      value.metadata.lausanneGeometry = report.groups.map(({ id, totalSegments, acceptedSegments }) => ({ id, totalSegments, acceptedSegments }))
      value.metadata.geometry.coverageWindow = 'full day'
      value.metadata.railGeometry.coverageWindow = 'full day'
      await writeFile(join(staged, name), JSON.stringify(value))
    }
    const { files } = await readRegionalDirectory(staged, ['lausanne-region'], date)
    for (const [name, bytes] of files) {
      const path = join(output, name)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, bytes)
    }
    return report
  } finally { await rm(staged, { recursive: true, force: true }) }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = name => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined
  for (const name of ['archive', 'rail', 'date']) assert(arg(name), `Missing --${name}`)
  const report = await buildLausanneDay({ archive: arg('archive'), railPath: arg('rail'), date: arg('date'), output: resolve(arg('output-directory') ?? 'public/data'), snapshotPath: arg('snapshot'), mbcSnapshotPath: arg('mbc-snapshot') })
  console.log(`Lausanne: ${report.scope.candidateTrips} trips; geometry and payload gates passed`)
}
