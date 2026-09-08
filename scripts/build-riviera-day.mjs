import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { readRegionalDirectory } from './regional-artifacts.mjs'
import { RIVIERA_REVIEWED_DATES } from './riviera-release-validation.mjs'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export async function buildRivieraDay({ date = '2026-09-08', sourceDirectory = 'data/riviera-region', output = 'public/data' } = {}) {
  assert(RIVIERA_REVIEWED_DATES.includes(date), 'Riviera: rebuild and audit before publishing a new date')
  const directory = join(sourceDirectory, date)
  const manifestBytes = await readFile(join(directory, 'riviera-region-day-manifest.json'))
  const day = JSON.parse(manifestBytes), morning = JSON.parse(await readFile(join(directory, 'riviera-region-morning.json')))
  assert.equal(day.metadata.serviceDate, date)
  const rivieraRelease = { version: 1, archiveManifestSha256: digest(manifestBytes), auditSha256: digest(await readFile(join(sourceDirectory, 'audit.json'))) }
  const files = new Map()
  for (const descriptor of day.chunks) {
    assert(/^day-chunks\/\d\d-\d\d\.json$/.test(descriptor.path))
    const bytes = await readFile(join(directory, descriptor.path))
    assert.equal(digest(bytes), descriptor.sha256); assert.equal(bytes.length, descriptor.bytes)
    descriptor.path = `riviera-region-${descriptor.path}`
    files.set(descriptor.path, bytes)
  }
  for (const snapshot of [day, morning]) Object.assign(snapshot.metadata, { rivieraRelease,
    note: 'Scheduled movements on inferred FOT rail and funicular axes and OSM road paths. Complete MVR, MOB, VMCV and replacement journeys for the stated date; not live positions or all transport in the district.' })
  files.set('riviera-region-day-manifest.json', Buffer.from(JSON.stringify(day)))
  files.set('riviera-region-morning.json', Buffer.from(JSON.stringify(morning)))
  const work = await mkdtemp(join(tmpdir(), 'riviera-release-'))
  try {
    for (const [path, bytes] of files) { await mkdir(dirname(join(work, path)), { recursive: true }); await writeFile(join(work, path), bytes) }
    await readRegionalDirectory(work, ['riviera-region'], date)
    for (const [path, bytes] of files) { await mkdir(dirname(join(output, path)), { recursive: true }); await writeFile(join(output, path), bytes) }
    return { date, trips: day.tripCount, artifacts: files.size, ...rivieraRelease }
  } finally { await rm(work, { recursive: true, force: true }) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1] }
  console.log(JSON.stringify(await buildRivieraDay({ date: arg('date'), output: arg('output') })))
}
