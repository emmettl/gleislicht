import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const PUBLISHED_DATA = 'https://emmettl.github.io/gleislicht/data/'
const ROOT_FILES = ['swiss-rail-morning.json', 'swiss-rail-day-manifest.json', 'swiss-hub-day.json']

function assert(condition, message) {
  if (!condition) throw new Error(`Published timetable recovery: ${message}`)
}

/** Recover only a complete, internally consistent national timetable. */
export async function readPublishedNationalData(fetchData = fetch) {
  const files = new Map()
  async function read(path) {
    const response = await fetchData(new URL(path, PUBLISHED_DATA), { signal: AbortSignal.timeout(30_000) })
    assert(response.ok, `${path} returned ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    const value = JSON.parse(bytes.toString('utf8'))
    files.set(path, bytes)
    return value
  }
  const [morning, day, hubs] = await Promise.all(ROOT_FILES.map(read))
  const { serviceDate, feedVersion } = morning.metadata ?? {}
  assert(/^\d{4}-\d{2}-\d{2}$/.test(serviceDate ?? ''), 'missing service date')
  assert(typeof feedVersion === 'string' && feedVersion.length > 0, 'missing feed version')
  for (const artifact of [morning, day, hubs]) {
    assert(artifact.metadata?.serviceDate === serviceDate && artifact.metadata?.feedVersion === feedVersion, 'mixed service dates or feed versions')
  }
  for (const artifact of [morning, day]) {
    for (const key of ['stops', 'edges', 'paths', 'edgePaths']) {
      assert(Array.isArray(artifact[key]) && artifact[key].length > 0, `missing ${key}`)
    }
  }
  assert(Array.isArray(morning.trains) && morning.trains.length > 0, 'empty morning study')
  assert(day.metadata.windowStart === 0 && day.metadata.windowEnd === 86_400, 'incomplete day window')
  assert(Array.isArray(day.chunks) && day.chunks.length > 0 && day.chunks.length <= 24, 'invalid day chunks')
  for (const id of ['zurich', 'bern', 'basel', 'geneva']) {
    assert(Array.isArray(hubs.hubs?.[id]) && hubs.hubs[id].length > 0, `missing ${id} hub`)
  }
  let end = 0
  const paths = new Set()
  for (const chunk of day.chunks) {
    assert(/^swiss-rail-day-chunks\/\d{2}-\d{2}\.json$/.test(chunk.path), 'unexpected chunk path')
    assert(!paths.has(chunk.path), 'duplicate chunk path')
    paths.add(chunk.path)
    assert(chunk.windowStart === end && chunk.windowEnd > end && chunk.windowEnd <= 86_400, 'gaps or overlaps in day windows')
    end = chunk.windowEnd
  }
  assert(end === 86_400, 'day chunks do not cover 24 hours')
  let repaired = 0
  await Promise.all(day.chunks.map(async (descriptor) => {
    const chunk = await read(descriptor.path)
    const bytes = files.get(descriptor.path)
    assert(chunk.windowStart === descriptor.windowStart && chunk.windowEnd === descriptor.windowEnd, `window mismatch: ${descriptor.path}`)
    assert(Array.isArray(chunk.trains) && chunk.trains.length === descriptor.tripCount, `trip count mismatch: ${descriptor.path}`)
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (bytes.length !== descriptor.bytes || digest !== descriptor.sha256) {
      // Older FOT enrichment added pathSegments after hashing. Accept only
      // that exact historical transformation, never an arbitrary mismatch.
      const beforeGeometry = JSON.stringify({ ...chunk, trains: chunk.trains.map(({ pathSegments: _paths, ...train }) => train) })
      assert(day.metadata.geometry?.publisher === 'Federal Office of Transport (FOT)' && Buffer.byteLength(beforeGeometry) === descriptor.bytes && createHash('sha256').update(beforeGeometry).digest('hex') === descriptor.sha256, `integrity mismatch: ${descriptor.path}`)
      for (const train of chunk.trains) {
        if (train.pathSegments === undefined) continue
        assert(Array.isArray(train.pathSegments) && train.pathSegments.length === train.stops?.length - 1 && train.pathSegments.every((index) => index === null || (Number.isInteger(index) && index >= 0 && index < day.paths.length)), `invalid geometry: ${descriptor.path}`)
      }
      descriptor.bytes = bytes.length
      descriptor.sha256 = digest
      repaired += 1
    }
  }))
  if (repaired) files.set(ROOT_FILES[1], Buffer.from(JSON.stringify(day)))
  // Optional discovery metadata follows the recovered timetable when available.
  // Older published sets remain recoverable; the UI rejects an incompatible local catalogue.
  const cataloguePath = 'swiss-cogwheel-catalogue.json'
  try {
    const catalogue = await read(cataloguePath)
    assert(catalogue.metadata?.feedVersion === feedVersion && catalogue.metadata?.serviceDate === serviceDate, 'cogwheel catalogue mismatch')
    assert(catalogue.routes && catalogue.trips && !Array.isArray(catalogue.routes) && !Array.isArray(catalogue.trips), 'invalid cogwheel catalogue')
    const tripIds = new Set(day.chunks.flatMap(descriptor => JSON.parse(files.get(descriptor.path).toString('utf8')).trains.map(train => train.id)))
    assert(Object.entries(catalogue.routes).every(([id, route]) => route?.id === id && route.routeType === 116 && typeof route.operator === 'string' && typeof route.name === 'string'), 'invalid cogwheel route')
    assert(Object.entries(catalogue.trips).every(([id, routeId]) => tripIds.has(id) && Object.hasOwn(catalogue.routes, routeId)), 'invalid cogwheel trip')
  } catch {
    files.delete(cataloguePath)
  }
  return { files, serviceDate, feedVersion, repaired }
}

async function main() {
  const index = process.argv.indexOf('--output-directory')
  const output = resolve(index < 0 ? 'public/data' : process.argv[index + 1])
  const { files, serviceDate, feedVersion, repaired } = await readPublishedNationalData()
  // Validate every download before replacing any local artifact. Any failure
  // leaves the build stopped; source dates and provenance are never rewritten.
  for (const [path, bytes] of files) {
    const destination = resolve(output, path)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, bytes)
  }
  console.log(`Retained published Swiss timetable: service ${serviceDate}, feed ${feedVersion}, ${files.size} verified files from ${PUBLISHED_DATA}`)
  if (repaired) console.log(`Repaired ${repaired} legacy geometry checksums after verifying their original timetable hashes.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1 })
}
