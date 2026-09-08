import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const REGIONAL_IDS = ['zurich-city', 'zvv-region', 'geneva-tpg']
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
export async function readRegionalArtifacts(read, ids = REGIONAL_IDS, expectedDate) {
  const files = new Map()
  async function json(path) {
    const bytes = Buffer.from(await read(path))
    files.set(path, bytes)
    return JSON.parse(bytes)
  }
  const dates = {}
  for (const id of ids) {
    assert(REGIONAL_IDS.includes(id), 'Unknown regional study')
    const day = await json(`${id}-day-manifest.json`)
    const morning = await json(`${id}-morning.json`)
    const { serviceDate, feedVersion } = day.metadata ?? {}
    assert(/^\d{4}-\d{2}-\d{2}$/.test(serviceDate ?? ''), `${id}: missing service date`)
    assert(typeof feedVersion === 'string' && feedVersion.length, `${id}: missing feed version`)
    if (expectedDate) assert.equal(serviceDate, expectedDate, `${id}: unexpected service date`)
    assert.equal(morning.metadata?.serviceDate, serviceDate, `${id}: mixed service dates`)
    assert.equal(morning.metadata?.feedVersion, feedVersion, `${id}: mixed feed versions`)
    dates[id] = serviceDate
    assert(day.metadata.windowStart === 0 && day.metadata.windowEnd === 86400, `${id}: incomplete day`)
    assert(morning.metadata.windowStart === 24300 && morning.metadata.windowEnd === 31500, `${id}: wrong morning window`)
    assert(day.tripCount > 1000 && morning.trains?.length > 100, `${id}: insufficient services`)
    assert(day.chunks?.length === 12, `${id}: expected twelve two-hour chunks`)
    const local = day.metadata.geometry
    const rail = day.metadata.railGeometry
    assert(local?.matchedSegments / local?.totalSegments >= (id === 'geneva-tpg' ? .7 : .8), `${id}: insufficient local geometry`)
    assert(rail?.matchedSegments / rail?.totalSegments >= .65, `${id}: insufficient rail geometry`)
    assert(/^[a-f0-9]{64}$/.test(rail?.sha256 ?? ''), `${id}: missing rail source hash`)
    assert(Object.values(day.metadata.sourceHashes ?? {}).length >= 2 && Object.values(day.metadata.sourceHashes).every(hash => /^[a-f0-9]{64}$/.test(hash)), `${id}: missing source hashes`)
    const checkGeometry = snapshot => {
      assert(snapshot.stops?.length && snapshot.edges?.length && snapshot.paths?.length, `${id}: missing topology`)
      assert(snapshot.edgePaths?.length === snapshot.edges.length, `${id}: missing edge geometry`)
      const pathIndex = index => index === null || Number.isInteger(index) && index >= 0 && index < snapshot.paths.length
      const stopIndex = index => Number.isInteger(index) && index >= 0 && index < snapshot.stops.length
      assert(snapshot.edgePaths.every(pathIndex) && snapshot.edges.every(([a, b]) => stopIndex(a) && stopIndex(b)), `${id}: invalid edge index`)
      assert(snapshot.paths.every(path => path.length >= 2 && path.every(point => point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)), `${id}: invalid path coordinates`)
      return trains => {
        for (const train of trains) {
          assert(typeof train.id === 'string' && Number.isFinite(train.start) && Number.isFinite(train.end) && train.end >= train.start, `${id}: invalid train`)
          assert(train.stops?.length >= 2 && train.stops.every(stop => stopIndex(stop[0]) && stop.slice(1).every(Number.isFinite)), `${id}: invalid train stops`)
          if (train.pathSegments) assert(train.pathSegments.length === train.stops.length - 1 && train.pathSegments.every(pathIndex), `${id}: invalid train geometry`)
        }
      }
    }
    const checkTrains = checkGeometry(day)
    checkGeometry(morning)(morning.trains)
    assert(gzipSync(files.get(`${id}-day-manifest.json`)).length < 650 * 1024, `${id}: manifest budget exceeded`)
    assert(gzipSync(files.get(`${id}-morning.json`)).length < 1600 * 1024, `${id}: morning budget exceeded`)
    const unique = new Set()
    for (let i = 0; i < day.chunks.length; i++) {
      const descriptor = day.chunks[i]
      const filename = `${String(i * 2).padStart(2, '0')}-${String(i * 2 + 2).padStart(2, '0')}.json`
      assert.equal(descriptor.path, `${id}-day-chunks/${filename}`, `${id}: unexpected chunk path`)
      assert(descriptor.windowStart === i * 7200 && descriptor.windowEnd === (i + 1) * 7200, `${id}: chunk gaps or overlaps`)
      const chunk = await json(descriptor.path)
      const bytes = files.get(descriptor.path)
      assert(bytes.length === descriptor.bytes && digest(bytes) === descriptor.sha256, `${id}: chunk integrity mismatch`)
      assert(gzipSync(bytes).length < 450 * 1024, `${id}: chunk budget exceeded`)
      assert(chunk.windowStart === descriptor.windowStart && chunk.windowEnd === descriptor.windowEnd && chunk.trains?.length === descriptor.tripCount, `${id}: chunk metadata mismatch`)
      checkTrains(chunk.trains)
      chunk.trains.forEach(train => unique.add(train.id))
    }
    assert.equal(unique.size, day.tripCount, `${id}: day trip count mismatch`)
  }
  return { files, dates }
}
export const readRegionalDirectory = (directory, ids, date) => readRegionalArtifacts(path => readFile(join(directory, path)), ids, date)

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { dates, files } = await readRegionalDirectory(process.argv[2] ?? 'public/data')
  console.log(`Verified ${files.size} regional artifacts: ${JSON.stringify(dates)}`)
}
