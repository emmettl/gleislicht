import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { simplifyBernPath, bernDisplayDeviation } from './bern-display-geometry.mjs'
import { BERN_REVIEWED_DATES } from './bern-release-validation.mjs'
import { readRegionalDirectory } from './regional-artifacts.mjs'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export async function buildBernDay({ date = '2026-09-04', sourceDirectory = 'public/data/bern-region', auditDirectory = 'data/bern-audit', output = 'public/data' } = {}) {
  assert(BERN_REVIEWED_DATES.includes(date), 'Bern: rebuild and audit before publishing a new date')
  const directory = join(sourceDirectory, date)
  const manifestBytes = await readFile(join(directory, 'bern-region-day-manifest.json'))
  const day = JSON.parse(manifestBytes), morning = JSON.parse(await readFile(join(directory, 'bern-region-morning.json')))
  const auditBytes = await readFile(join(auditDirectory, `${date}.json`)), audit = JSON.parse(auditBytes)
  assert.equal(day.metadata.serviceDate, date); assert.equal(audit.serviceDate, date)
  assert.deepEqual(day.metadata.sourceHashes, audit.sourceHashes)
  assert(audit.validation.completeSourceCalls && audit.validation.directedEndpoints && audit.validation.admittedGeometryCoverage === 1)
  assert.deepEqual(morning.paths, day.paths)
  const original = day.paths, paths = original.map(p => simplifyBernPath(p, 5))
  const maximumDeviationMetres = Math.max(...paths.map((p, i) => bernDisplayDeviation(original[i], p)))
  const files = new Map(), unique = new Map()
  for (const descriptor of day.chunks) {
    assert(/^day-chunks\/\d\d-\d\d.json$/.test(descriptor.path))
    const bytes = await readFile(join(directory, descriptor.path)), chunk = JSON.parse(bytes)
    assert.equal(digest(bytes), descriptor.sha256); assert.equal(bytes.length, descriptor.bytes)
    for (const t of chunk.trains) { if (unique.has(t.id)) assert.deepEqual(unique.get(t.id), t); unique.set(t.id, t) }
    descriptor.path = `bern-region-${descriptor.path}`
    files.set(descriptor.path, bytes)
  }
  const trains = [...unique.values()], headway = trains.filter(t => t.frequency?.exactTimes === 0).length
  assert.equal(trains.length, audit.coverage.admittedTrips)
  assert.equal(headway, audit.coverage.admittedRepresentativeHeadwayTrips)
  const bernRelease = { version: 1, archiveManifestSha256: digest(manifestBytes), auditSha256: digest(auditBytes),
    movements: { total: trains.length, scheduled: trains.length - headway, representativeHeadway: headway },
    admittedSegments: trains.reduce((n, t) => n + t.pathSegments.length, 0),
    simplification: { algorithm: 'Douglas–Peucker; distance to retained chord in approximate LV95 metres', toleranceMetres: 5, maximumDeviationMetres,
      originalVertices: original.reduce((n, p) => n + p.length, 0), displayVertices: paths.reduce((n, p) => n + p.length, 0), endpointsUnchanged: true } }
  const geometry = { ...day.metadata.geometry, publisher: 'Kanton Bern',
    transformation: 'Source WGS84 vertices retained in order; display-only simplification bounded to 5 metres in approximate LV95. All segment endpoints unchanged; archive unsimplified.',
    localMetadata: 'bern-region/sources.json', localTerms: ['bern-region/terms_of_use_de.pdf', 'bern-region/terms_of_use_fr.pdf'] }
  // Full reviewed topology and projection evidence stays in the archive and
  // sources.json; the display payload carries its hash, dates and attribution.
  if (geometry.ir66Supplement) {
    const r = geometry.ir66Supplement
    geometry.ir66Supplement = { policySha256: r.policySha256, source: r.source, sourceId: r.policy.sourceId,
      model: r.policy.model, limits: r.policy.limits, documents: r.policy.documents,
      fullEvidence: { path: 'bern-region/sources.json', field: 'ir66Supplement' } }
  }
  for (const snapshot of [day, morning]) { snapshot.paths = paths; Object.assign(snapshot.metadata, { bernRelease, geometry }) }
  files.set('bern-region-day-manifest.json', Buffer.from(JSON.stringify(day)))
  files.set('bern-region-morning.json', Buffer.from(JSON.stringify(morning)))
  const work = await mkdtemp(join(tmpdir(), 'bern-release-'))
  try {
    for (const [path, bytes] of files) { await mkdir(dirname(join(work, path)), { recursive: true }); await writeFile(join(work, path), bytes) }
    await readRegionalDirectory(work, ['bern-region'], date)
    for (const [path, bytes] of files) { await mkdir(dirname(join(output, path)), { recursive: true }); await writeFile(join(output, path), bytes) }
    const report = { date, ...bernRelease, payload: Object.fromEntries([...files].map(([path, bytes]) => [path, { bytes: bytes.length, gzipBytes: gzipSync(bytes).length }])) }
    console.log(JSON.stringify(report))
    return report
  } finally { await rm(work, { recursive: true, force: true }) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1] }
  if (arg('date')) await buildBernDay({ date: arg('date'), output: arg('output') })
  else {
    const work = await mkdtemp(join(tmpdir(), 'bern-sunday-display-'))
    try {
      const dates = [await buildBernDay({ output: arg('output') }), await buildBernDay({ date: '2026-09-06', output: work })]
      await writeFile('data/bern-audit/display-release.json', JSON.stringify({ schemaVersion: 1, defaultServiceDate: '2026-09-04', dates }, null, 2) + '\n')
    } finally { await rm(work, { recursive: true, force: true }) }
  }
}
