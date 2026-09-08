import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
import { importLuzernRoads } from './luzern-road-geometry.mjs'
import { hashFile } from './valais-timetable.mjs'

const csv = rows => rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n'
export async function prepareValaisRoads(input, output) {
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
    scope: 'All full Valais bus patterns on both civil dates, including night and replacement services; exact route, agency, stop IDs and coordinates retained. Routing-only nonnegative times.' }
  await mkdir(output, { recursive: true })
  const directory = join(output, 'all')
  const result = await prepareRoadFeed({ manifest: { metadata, stops }, trains, output: directory,
    agency: { id: 'all', name: 'Valais routing preparation', url: metadata.sourceUrl } })
  // Preserve each real agency in the routing input; do not relabel shared line
  // numbers from different operators as one service.
  const agencies = [...new Set(Object.values(routeAgencies))].map(id => [id, raw.routes.find(r => r.agencyId === id).agency, metadata.sourceUrl, 'Europe/Zurich'])
  await writeFile(join(directory, 'agency.txt'), csv([['agency_id', 'agency_name', 'agency_url', 'agency_timezone'], ...agencies]))
  await writeFile(join(directory, 'routes.txt'), csv([['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type'],
    ...Object.keys(routeAgencies).map(id => [id, routeAgencies[id], routes.get(id).name, routes.get(id).longName, 3])]))
  await writeFile(join(output, 'index.json'), JSON.stringify({ metadata, agencies: [{ agencyId: 'all', ...result }] }, null, 2) + '\n')
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'prepare') console.log(await prepareValaisRoads(...args))
  else if (command === 'import') console.log(await importLuzernRoads(args[0], args[1], 'data/valais-road-cache.json', 'data/valais-road-evidence'))
  else throw new Error('Usage: prepare TIMETABLE OUTPUT | import PREPARED MATCHED')
}
