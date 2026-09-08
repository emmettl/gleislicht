import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { prepareRoadFeed, roadPatternId } from './prepare-postbus-road-feed.mjs'
import { importLuzernRoads, roadConsensus, verifyLuzernRoadEvidence } from './luzern-road-geometry.mjs'
import { hashFile } from './solothurn-timetable.mjs'

const csv = rows => rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n'
export async function prepareSolothurnRoads(input, output) {
  const raw = JSON.parse(gunzipSync(await readFile(input))), routes = new Map(raw.routes.map(r => [r.id, r]))
  const stops = [], indexes = new Map(), trains = [], routeAgencies = {}
  for (const day of raw.snapshots) for (const train of day.trains) {
    const route = routes.get(train.routeId)
    if (route.mode !== 'bus') continue
    routeAgencies[route.id] = route.agencyId
    const shift = Math.max(0, Math.ceil(-train.stops[0][1] / 86400) * 86400)
    trains.push({ ...train, id: `${day.metadata.serviceDate}:${train.id}`, stops: train.stops.map(([i, a, d]) => {
      const stop = day.stops[i], key = JSON.stringify(stop)
      if (!indexes.has(key)) { indexes.set(key, stops.length); stops.push(stop) }
      return [indexes.get(key), a + shift, d + shift]
    }) })
  }
  const metadata = { dates: raw.snapshots.map(s => s.metadata.serviceDate), serviceDate: raw.snapshots[0].metadata.serviceDate,
    feedVersion: raw.snapshots[0].metadata.feedVersion, sourceUrl: raw.snapshots[0].metadata.sourceUrl,
    timetableSha256: await hashFile(input), sourceHashes: raw.sourceHashes, routeAgencies,
    scope: 'All full Solothurn bus patterns on twelve seasonal/civil dates, including night and replacement services; exact route, agency, stop IDs and coordinates retained. Routing-only nonnegative times.' }
  await mkdir(output, { recursive: true })
  const directory = join(output, 'all')
  const result = await prepareRoadFeed({ manifest: { metadata, stops }, trains, output: directory,
    agency: { id: 'all', name: 'Solothurn routing preparation', url: metadata.sourceUrl } })
  // Preserve each real agency in the routing input; do not relabel shared line
  // numbers from different operators as one service.
  const agencies = [...new Set(Object.values(routeAgencies))].map(id => [id, raw.routes.find(r => r.agencyId === id).agency, metadata.sourceUrl, 'Europe/Zurich'])
  await writeFile(join(directory, 'agency.txt'), csv([['agency_id', 'agency_name', 'agency_url', 'agency_timezone'], ...agencies]))
  await writeFile(join(directory, 'routes.txt'), csv([['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type'],
    ...Object.keys(routeAgencies).map(id => [id, routeAgencies[id], routes.get(id).name, routes.get(id).longName, 3])]))
  await writeFile(join(output, 'index.json'), JSON.stringify({ metadata, agencies: [{ agencyId: 'all', ...result }] }, null, 2) + '\n')
  return result
}

export async function loadSolothurnRoads(timetable, { verifyEvidence = false } = {}) {
  const path = 'data/solothurn-road-cache.json', cache = JSON.parse(await readFile(path))
  if (verifyEvidence) await verifyLuzernRoadEvidence(cache)
  assert.deepEqual(cache.metadata.sourceHashes, timetable.sourceHashes)
  const expected = new Set(), agency = cache.agencies.all
  for (const day of timetable.snapshots) for (const train of day.trains) {
    const route = timetable.routes.find(r => r.id === train.routeId)
    if (route.mode !== 'bus') continue
    assert.equal(cache.metadata.routeAgencies[route.id], route.agencyId)
    const id = roadPatternId(train, day.stops)
    assert(agency.identities[id], `Road scope missing complete pattern ${id}`)
    expected.add(id)
  }
  if (timetable.snapshots.length === cache.metadata.dates.length) assert.deepEqual([...expected].sort(), Object.keys(agency.identities).sort())
  const pairs = roadConsensus(cache, { detourRatio: 3, detourFloorMetres: 600 })
  // roadConsensus keys carry the original route identity; never infer an agency
  // from a display label or a shared road corridor.
  for (const [key, candidate] of pairs) candidate.agencyId = cache.metadata.routeAgencies[JSON.parse(key)[0]]
  return { pairs, metadata: cache.metadata, sha256: await hashFile(path) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'prepare') console.log(await prepareSolothurnRoads(...args))
  else if (command === 'import') console.log(await importLuzernRoads(args[0], args[1], 'data/solothurn-road-cache.json', 'data/solothurn-road-evidence'))
  else throw new Error('Usage: prepare TIMETABLE OUTPUT | import PREPARED MATCHED')
}
