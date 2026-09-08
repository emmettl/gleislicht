import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { simplifyBernPath, bernDisplayDeviation } from './bern-display-geometry.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const json = async file => JSON.parse(await readFile(file, 'utf8'))
const repo = 'https://github.com/emmettl/gleislicht/blob/main/'
export const REGIONAL_STUDY_PACKAGES = [
  { id: 'luzern-region', root: 'public/data/luzern-region', doc: 'docs/LUZERN-STUDY.md', sources: 'data/luzern-sources/sources.json', credit: 'SBB / opentransportdata.swiss · © rawi Kanton Luzern · © Verkehrsverbund Luzern · FOT · SBB Infrastructure · swisstopo · FOEN · OpenStreetMap contributors / ODbL' },
  { id: 'zug-region', root: 'public/data/zug-region', doc: 'docs/ZUG-STUDY.md', sources: 'data/zug-sources/sources.json', credit: 'SBB / opentransportdata.swiss · Quelle: GIS Kanton Zug · Luzern · FOT · SBB Infrastructure · swisstopo · OpenStreetMap contributors / ODbL' },
  { id: 'thurgau-region', root: 'public/data/thurgau-region', doc: 'docs/THURGAU-STUDY.md', sources: 'public/data/thurgau-region/sources.json', credit: 'SBB / opentransportdata.swiss · Kanton Thurgau · FOT · SBB Infrastructure · swisstopo · OpenStreetMap contributors / ODbL' },
  { id: 'fribourg-region', root: 'data/fribourg-region', doc: 'docs/FRIBOURG-STUDY.md', sources: 'data/fribourg-region/sources.json', credit: 'SBB / opentransportdata.swiss · Source: Etat de Fribourg · FOT · SBB Infrastructure · swisstopo · OpenStreetMap contributors / ODbL' },
]

export async function readStudyArchive(directory, id, date) {
  const manifestBytes = await readFile(join(directory, `${id}-day-manifest.json`))
  const morningBytes = await readFile(join(directory, `${id}-morning.json`))
  const manifest = JSON.parse(manifestBytes), morning = JSON.parse(morningBytes)
  assert.equal(manifest.metadata.serviceDate, date, 'Wrong manifest date')
  assert.equal(morning.metadata.serviceDate, date, 'Wrong morning date')
  assert.equal(manifest.metadata.feedVersion, '20260902', 'Unreviewed feed version')
  assert.equal(morning.metadata.feedVersion, manifest.metadata.feedVersion)
  assert.deepEqual(morning.metadata.sourceHashes, manifest.metadata.sourceHashes)
  assert.deepEqual([manifest.metadata.windowStart, manifest.metadata.windowEnd], [0, 86400])
  assert.deepEqual([morning.metadata.windowStart, morning.metadata.windowEnd], [24300, 31500])
  assert.deepEqual(morning.paths, manifest.paths)
  assert.deepEqual(morning.stops, manifest.stops)
  const files = new Map(), trains = new Map()
  assert.equal(manifest.chunks.length, 12)
  for (const [i, chunk] of manifest.chunks.entries()) {
    assert(/^(?:[a-z-]+\/)?\d\d-\d\d\.json$/.test(chunk.path), 'Unsafe chunk path')
    assert.equal(chunk.windowStart, i * 7200)
    assert.equal(chunk.windowEnd, (i + 1) * 7200)
    const bytes = await readFile(join(directory, chunk.path)), data = JSON.parse(bytes)
    assert.equal(hash(bytes), chunk.sha256, 'Chunk checksum mismatch')
    assert.equal(bytes.length, chunk.bytes)
    assert.equal(data.windowStart, chunk.windowStart)
    assert.equal(data.windowEnd, chunk.windowEnd)
    assert.equal(data.trains.length, chunk.tripCount)
    assert(gzipSync(bytes).length < 450 * 1024, 'Chunk payload budget exceeded')
    for (const train of data.trains) {
      assert.equal(train.pathSegments.length, train.stops.length - 1)
      assert(train.pathSegments.every(index => Number.isInteger(index) && index >= 0 && index < manifest.paths.length), 'Incomplete admitted geometry')
      if (trains.has(train.id)) assert.deepEqual(trains.get(train.id), train, 'Conflicting repeated journey')
      trains.set(train.id, train)
    }
    files.set(chunk.path, bytes)
  }
  assert.equal(trains.size, manifest.tripCount, 'Wrong full-day journey count')
  for (const train of morning.trains) assert.deepEqual(train, trains.get(train.id), 'Morning journey differs from full day')
  return { manifest, morning, manifestBytes, morningBytes, files }
}

export async function packageRegionalStudies({ output = 'public/data' } = {}) {
  const reports = []
  for (const entry of REGIONAL_STUDY_PACKAGES) {
    if (entry.id === 'fribourg-region') assert.equal((await json(join(entry.root, 'index.json'))).publicRedistributionCleared, true, 'Fribourg redistribution not cleared')
    const dates = []
    for (const date of ['2026-09-04', '2026-09-06']) {
      const archive = await readStudyArchive(join(entry.root, date), entry.id, date)
      const { manifest, morning, files } = archive
      const paths = manifest.paths.map(path => simplifyBernPath(path, 5))
      const maximumDeviationMetres = Math.max(...paths.map((path, i) => bernDisplayDeviation(manifest.paths[i], path)))
      assert(maximumDeviationMetres <= 5.000001)
      const release = { archiveManifestSha256: hash(archive.manifestBytes), archiveMorningSha256: hash(archive.morningBytes), toleranceMetres: 5, maximumDeviationMetres, originalVertices: manifest.paths.reduce((n, p) => n + p.length, 0), displayVertices: paths.reduce((n, p) => n + p.length, 0), endpointsUnchanged: true, timetableUnchanged: true }
      for (const snapshot of [manifest, morning]) {
        snapshot.paths = paths
        snapshot.metadata.studyRelease = release
        snapshot.metadata.geometry = { ...snapshot.metadata.geometry, publisher: entry.credit, productUrl: `${repo}${entry.doc}`, transformation: 'Display-only simplification within 5 metres in approximate LV95; original endpoints, path indices and all timetable records retained. Complete source paths remain in the archival audit.' }
      }
      files.set(`${entry.id}-day-manifest.json`, Buffer.from(JSON.stringify(manifest)))
      files.set(`${entry.id}-morning.json`, Buffer.from(JSON.stringify(morning)))
      const payload = Object.fromEntries([...files].map(([name, bytes]) => [name, { bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: hash(bytes) }]))
      assert(payload[`${entry.id}-day-manifest.json`].gzipBytes < 650 * 1024, `${entry.id}: manifest budget exceeded`)
      assert(payload[`${entry.id}-morning.json`].gzipBytes < 1600 * 1024, `${entry.id}: morning budget exceeded`)
      const destination = join(output, entry.id, date, 'study')
      for (const [file, bytes] of files) { await mkdir(dirname(join(destination, file)), { recursive: true }); await writeFile(join(destination, file), bytes) }
      dates.push({ date, trips: manifest.tripCount, ...release, payload })
    }
    const sources = { schemaVersion: 1, study: entry.id, attribution: entry.credit, scope: 'Partial canton coverage; complete admitted journeys with cross-boundary calls. Archival September 2026 fixtures; no automatic refresh or observed vehicle positions.', documentation: `${repo}${entry.doc}`, sourceCatalogue: `${repo}${entry.sources}`, sourceCatalogueSha256: hash(await readFile(entry.sources)), geometryReuse: 'Retain each publisher’s terms in the linked source catalogue. OpenStreetMap-derived geometry: ODbL-1.0; the display paths are supplied in the downloadable manifests.', osmLicense: 'https://opendatacommons.org/licenses/odbl/1-0/', dates }
    await writeFile(join(output, entry.id, 'study-sources.json'), `${JSON.stringify(sources, null, 2)}\n`)
    // Retain the resolved Fribourg OGD evidence with the newly packaged study.
    if (entry.id === 'fribourg-region') for (const file of ['sources.json', 'ogd-layer.json', 'ogd-service.json', 'ogd-catalogue-item.json']) await cp(join(entry.root, file), join(output, entry.id, file))
    reports.push(sources)
  }
  return reports
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const reports = await packageRegionalStudies()
  await writeFile('data/regional-study-release.json', `${JSON.stringify(reports, null, 2)}\n`)
  for (const report of reports) console.log(`${report.study}: ${report.dates.map(day => `${day.date} ${day.trips} journeys, ${Math.round(day.payload[`${report.study}-day-manifest.json`].gzipBytes / 1024)} KiB manifest`).join('; ')}`)
}
