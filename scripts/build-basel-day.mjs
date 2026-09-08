import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { buildBaselCore } from './build-basel-core.mjs'
import { readRegionalDirectory } from './regional-artifacts.mjs'

export async function buildBaselDay({ candidateDirectory, archive, sourceDirectory, railPath, date, output = 'public/data', policyPath = 'data/basel-core-policy.json' }) {
  const work = await mkdtemp(join(tmpdir(), 'basel-release-'))
  try {
    if (!candidateDirectory) {
      await buildBaselCore({ archive, sourceDirectory, railPath, dates: [date], output: work, policyPath,
        busCachePath: 'data/basel-road-cache.json', supplementalBusCachePath: 'data/basel-core-road-cache.json', diversionPolicyPath: 'data/basel-tram-diversions.json' })
      candidateDirectory = join(work, date)
    }
    const report = JSON.parse(await readFile(join(candidateDirectory, 'basel-core-audit.json')))
    assert(report.gate.passed && report.gate.integrationCandidateReady, 'Basel candidate failed its data gate')
    if (date) assert.equal(report.serviceDate, date, 'Basel: candidate date differs from request')
    const policyBytes = await readFile(policyPath)
    assert.equal(createHash('sha256').update(policyBytes).digest('hex'), report.sourceHashes.policy, 'Basel: candidate policy was changed after review')
    if (report.sourceHashes.reviewedGeometry) {
      const reviewedBytes = await readFile('data/basel-reviewed-geometry.json')
      assert.equal(createHash('sha256').update(reviewedBytes).digest('hex'), report.sourceHashes.reviewedGeometry, 'Basel: reviewed geometry changed after candidate build')
    }
    const staged = join(work, 'release'); await mkdir(staged)
    const manifest = JSON.parse(await readFile(join(candidateDirectory, 'basel-core-day-manifest.json')))
    const morning = JSON.parse(await readFile(join(candidateDirectory, 'basel-core-morning.json')))
    assert.deepEqual(manifest.metadata.sourceHashes, report.sourceHashes, 'Basel: candidate source mismatch')
    const local = report.groups.filter(group => group.id !== 'regional-rail')
    const rail = report.groups.find(group => group.id === 'regional-rail')
    const metadata = { baselReleaseVersion: 1, baselGeometry: report.groups,
      baselRouteAgencies: Object.fromEntries(report.routes.map(route => [route.id, route.agencyId])),
      note: 'Scheduled BVB/BLT local services and bounded Swiss-side regional rail, including preceding service-day services. Inferred centrelines with explicit stop interpolation where geometry is unresolved. Source headsigns may extend beyond the displayed rail boundary.',
      geometry: { ...manifest.metadata.geometry, publisher: 'Basel-Stadt / BAV / OSM', sourceUrl: 'https://wfs.geo.bs.ch/', productUrl: 'https://www.openstreetmap.org/copyright', license: 'ODbL-1.0',
        matchedSegments: local.reduce((sum, group) => sum + group.matched, 0), totalSegments: local.reduce((sum, group) => sum + group.total, 0) },
      railGeometry: { ...manifest.metadata.geometry.rail, matchedSegments: rail.matched, totalSegments: rail.total,
        maximumSnapMetres: Math.max(...report.infrastructure.decisions.filter(decision => decision.mode === 'rail' && decision.accepted).map(decision => decision.maximumSnapMetres),
          ...(report.reviewedGeometry?.decisions ?? []).filter(decision => decision.mode === 'rail').map(decision => decision.maximumSnapMetres)) },
    }
    for (const [name, snapshot] of [['basel-core-day-manifest.json', manifest], ['basel-core-morning.json', morning]]) {
      snapshot.metadata = { ...snapshot.metadata, ...metadata }
      await writeFile(join(staged, name), JSON.stringify(snapshot))
    }
    for (const chunk of manifest.chunks) {
      assert(/^basel-core-day-chunks\/\d{2}-\d{2}\.json$/.test(chunk.path), 'Basel: unsafe candidate chunk path')
      const destination = join(staged, chunk.path); await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, await readFile(join(candidateDirectory, chunk.path)))
    }
    const verified = await readRegionalDirectory(staged, ['basel-core'], report.serviceDate)
    // Only complete, validated bytes can replace the published study.
    for (const [path, bytes] of verified.files) {
      const destination = join(output, path); await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, bytes)
    }
    return { date: report.serviceDate, trips: manifest.tripCount, files: verified.files.size }
  } finally { await rm(work, { recursive: true, force: true }) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined
  assert(arg('candidate') || ['archive', 'sources', 'rail', 'date'].every(arg), 'Supply --candidate DIRECTORY or --archive --sources --rail --date')
  console.log(await buildBaselDay({ candidateDirectory: arg('candidate'), archive: arg('archive'), sourceDirectory: arg('sources'), railPath: arg('rail'), date: arg('date'), output: arg('output-directory') ?? 'public/data' }))
}
