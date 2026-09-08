import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { rowsFromArchive } from '@motionstudies/data/gtfs'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'

export const BASEL_BUS_AGENCIES = [
  { id: '823', name: 'Basler Verkehrs-Betriebe', url: 'https://www.bvb.ch' },
  { id: '37', name: 'BLT Baselland Transport AG', url: 'https://www.blt.ch' },
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

export async function readBaselRoadCandidate(path) {
  const bytes = await readFile(path), manifest = JSON.parse(bytes)
  assert.deepEqual(manifest.metadata.localAgencyIds, ['823', '37'])
  const trains = new Map()
  for (const descriptor of manifest.chunks) {
    const data = await readFile(resolve(dirname(path), descriptor.path))
    assert.equal(hash(data), descriptor.sha256, 'Changed Basel candidate chunk')
    assert.equal(data.length, descriptor.bytes)
    const chunk = JSON.parse(data)
    assert.equal(chunk.trains.length, descriptor.tripCount)
    for (const train of chunk.trains) {
      if (trains.has(train.id)) assert.deepEqual(train, trains.get(train.id), 'Conflicting chunk journey')
      trains.set(train.id, train)
    }
  }
  assert.equal(trains.size, manifest.tripCount)
  return { manifest, trains: [...trains.values()], sha256: hash(bytes) }
}

export function mergeBaselBusCandidates(candidates, routes) {
  const stops = [], indexes = new Map(), trains = [], dates = new Set()
  const feedVersion = candidates[0]?.manifest.metadata.feedVersion
  assert(feedVersion && candidates.length, 'No Basel candidates supplied')
  for (const { manifest, trains: daily } of candidates) {
    assert.equal(manifest.metadata.feedVersion, feedVersion, 'Cannot combine different timetable feeds')
    const date = manifest.metadata.serviceDate
    assert(!dates.has(date), 'Duplicate Basel service date'); dates.add(date)
    const remap = manifest.stops.map(stop => {
      if (!indexes.has(stop[4])) { indexes.set(stop[4], stops.length); stops.push(stop) }
      const index = indexes.get(stop[4])
      assert.deepEqual(stops[index], stop, 'Conflicting platform identity in one feed')
      return index
    })
    for (const train of daily) {
      if (train.category !== 'bus') continue
      const route = routes.get(train.routeId)
      assert(route && BASEL_BUS_AGENCIES.some(agency => agency.id === route.agencyId), 'Unexpected Basel road agency')
      assert.equal(route.name, train.route)
      // A civil-day carry-in can start before zero. Restore its source-day
      // times for the offline GTFS matcher, preserving every interval; GTFS
      // cannot encode negative hours. This does not alter the study artifact.
      const offset = train.stops.some(([, arrival, departure]) => arrival < 0 || departure < 0) ? 86400 : 0
      // Dates distinguish source journeys in this offline pattern union. The
      // output calendar is only a matcher input, not a published timetable.
      trains.push({ ...train, id: `${date}:${train.id}`, stops: train.stops.map(([index, ...times]) => [remap[index], ...times.map(time => time + offset)]) })
    }
  }
  return { stops, trains, metadata: { feedVersion, serviceDate: [...dates][0], serviceDates: [...dates],
    sourceUrl: candidates[0].manifest.metadata.sourceUrl,
    inputManifestHashes: candidates.map(candidate => candidate.sha256),
    note: 'Offline geometry pattern union. Calendar uses the first date solely for matching; never use this feed as the study timetable.',
  } }
}

export async function prepareBaselRoadFeeds({ archive, manifestPaths, output }) {
  const routes = new Map()
  for await (const row of rowsFromArchive(archive, 'routes.txt')) routes.set(row.route_id, { agencyId: row.agency_id, name: row.route_short_name })
  const candidates = await Promise.all(manifestPaths.map(readBaselRoadCandidate))
  const union = mergeBaselBusCandidates(candidates, routes)
  for await (const row of rowsFromArchive(archive, 'feed_info.txt')) assert.equal(union.metadata.feedVersion, row.feed_version)
  const reports = []
  for (const agency of BASEL_BUS_AGENCIES) reports.push({ agencyId: agency.id, ...await prepareRoadFeed({
    manifest: { stops: union.stops, metadata: { ...union.metadata, baselRoadAgencyId: agency.id } },
    trains: union.trains.filter(train => routes.get(train.routeId).agencyId === agency.id), agency,
    output: join(output, agency.id),
  }) })
  return reports
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { archive: { type: 'string' }, manifest: { type: 'string', multiple: true }, output: { type: 'string' } } })
  assert(values.archive && values.manifest?.length && values.output, 'Requires --archive FILE --manifest MANIFEST [--manifest SECOND] --output DIRECTORY')
  console.log(await prepareBaselRoadFeeds({ archive: values.archive, manifestPaths: values.manifest, output: values.output }))
}
