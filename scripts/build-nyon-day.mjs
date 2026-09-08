import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { readRegionalDirectory } from './regional-artifacts.mjs'
import { NYON_REVIEWED_DATES } from './nyon-release-validation.mjs'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export async function buildNyonDay({ date = '2026-09-08', sourceDirectory = 'data/nyon-region', output = 'public/data' } = {}) {
  assert(NYON_REVIEWED_DATES.includes(date), 'Nyon: rebuild and audit before publishing a new date')
  const directory = join(sourceDirectory, date)
  const manifestBytes = await readFile(join(directory, 'nyon-region-day-manifest.json'))
  const day = JSON.parse(manifestBytes), morning = JSON.parse(await readFile(join(directory, 'nyon-region-morning.json')))
  assert.equal(day.metadata.serviceDate, date)
  const nyonRelease = { version: 1, archiveManifestSha256: digest(manifestBytes), auditSha256: digest(await readFile(join(sourceDirectory, 'audit.json'))) }
  const files = new Map()
  for (const descriptor of day.chunks) {
    assert(/^day-chunks\/\d\d-\d\d\.json$/.test(descriptor.path))
    const bytes = await readFile(join(directory, descriptor.path))
    assert.equal(digest(bytes), descriptor.sha256); assert.equal(bytes.length, descriptor.bytes)
    descriptor.path = `nyon-region-${descriptor.path}`
    files.set(descriptor.path, bytes)
  }
  for (const snapshot of [day, morning]) Object.assign(snapshot.metadata, { nyonRelease,
    note: 'Scheduled movements on inferred FOT rail and OSM road paths. Complete NStCM, TPN and Bus Nyon-Prangins journeys for the stated date; not live positions or all transport in the district.' })
  files.set('nyon-region-day-manifest.json', Buffer.from(JSON.stringify(day)))
  files.set('nyon-region-morning.json', Buffer.from(JSON.stringify(morning)))
  const work = await mkdtemp(join(tmpdir(), 'nyon-release-'))
  try {
    for (const [path, bytes] of files) { await mkdir(dirname(join(work, path)), { recursive: true }); await writeFile(join(work, path), bytes) }
    await readRegionalDirectory(work, ['nyon-region'], date)
    for (const [path, bytes] of files) { await mkdir(dirname(join(output, path)), { recursive: true }); await writeFile(join(output, path), bytes) }
    return { date, trips: day.tripCount, artifacts: files.size, ...nyonRelease }
  } finally { await rm(work, { recursive: true, force: true }) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1] }
  console.log(JSON.stringify(await buildNyonDay({ date: arg('date'), output: arg('output') })))
}
