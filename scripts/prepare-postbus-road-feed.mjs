import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const DEFAULT_MANIFEST = 'public/data/postbus-national-day-manifest.json'

export async function readPostbusDay(path = DEFAULT_MANIFEST) {
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  const chunks = await Promise.all(manifest.chunks.map(async descriptor => ({
    descriptor,
    path: resolve(dirname(path), descriptor.path),
    payload: JSON.parse(await readFile(resolve(dirname(path), descriptor.path), 'utf8')),
  })))
  const trains = [...new Map(chunks.flatMap(chunk => chunk.payload.trains).map(train => [train.id, train])).values()]
  return { manifest, chunks, trains }
}

// Timetable IDs change between releases; the route identity, complete ordered
// platform sequence and coordinates must still agree before a path is reused.
export function roadPatternId(train, stops) {
  return createHash('sha256').update(JSON.stringify([
    train.routeId,
    train.stops.map(([index]) => [stops[index][4], stops[index][0], stops[index][1]]),
  ])).digest('hex').slice(0, 24)
}

export function roadPatterns(trains, stops) {
  const patterns = new Map()
  for (const train of trains) {
    const id = roadPatternId(train, stops)
    const existing = patterns.get(id)
    if (existing) existing.tripCount++
    else patterns.set(id, { id, routeId: train.routeId, route: train.route,
      headsign: train.headsign, tripCount: 1, sourceTripId: train.id, stops: train.stops })
  }
  return [...patterns.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function pilotRoutes(patterns, stops, count = 30) {
  const routes = new Map()
  for (const pattern of patterns) {
    const route = routes.get(pattern.routeId) ?? { id: pattern.routeId, points: [], trips: 0 }
    route.points.push(...pattern.stops.map(([index]) => stops[index]))
    route.trips += pattern.tripCount
    routes.set(route.id, route)
  }
  const candidates = [...routes.values()].map(route => ({ ...route,
    centre: [0, 1].map(axis => route.points.reduce((sum, point) => sum + point[axis], 0) / route.points.length),
  }))
  // Include the existing hairpin control, busiest service and cross-border
  // termini, then spread the remaining sample geographically (farthest first).
  const selected = new Set()
  for (const route of candidates) {
    if (route.points.some(point => /Griesalp|Domodossola|Malles|Mals,|Büsingen|Gex,|Vaduz/.test(point[2]))) selected.add(route.id)
  }
  const busiest = [...candidates].sort((a, b) => b.trips - a.trips)[0]
  if (busiest) selected.add(busiest.id)
  while (selected.size < Math.min(count, candidates.length)) {
    const centres = candidates.filter(route => selected.has(route.id)).map(route => route.centre)
    const ranked = candidates.filter(route => !selected.has(route.id)).map(route => ({ ...route,
      distance: centres.length ? Math.min(...centres.map(point => Math.hypot(
        (point[0] - route.centre[0]) * 0.68, point[1] - route.centre[1],
      ))) : 1,
    })).sort((a, b) => b.distance - a.distance || a.id.localeCompare(b.id))
    selected.add(ranked[0].id)
  }
  return selected
}

const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`
const csv = rows => `${rows.map(row => row.map(csvCell).join(',')).join('\n')}\n`
const gtfsTime = seconds => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
  .map(value => String(value).padStart(2, '0')).join(':')

export async function prepareRoadFeed({ manifest, trains, output, pilot = 0 }) {
  const allPatterns = roadPatterns(trains, manifest.stops)
  const routes = pilot ? pilotRoutes(allPatterns, manifest.stops, pilot) : undefined
  const patterns = routes ? allPatterns.filter(pattern => routes.has(pattern.routeId)) : allPatterns
  const usedStops = new Set(patterns.flatMap(pattern => pattern.stops.map(([index]) => index)))
  const routeLabels = new Map(patterns.map(pattern => [pattern.routeId, pattern.route]))
  const date = manifest.metadata.serviceDate.replaceAll('-', '')
  await mkdir(output, { recursive: true })
  const tables = {
    'agency.txt': [['agency_id', 'agency_name', 'agency_url', 'agency_timezone'],
      ['801', 'PostAuto AG', 'https://www.postauto.ch', 'Europe/Zurich']],
    'routes.txt': [['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type'],
      ...[...routeLabels].map(([id, label]) => [id, '801', label, '', 3])],
    'trips.txt': [['route_id', 'service_id', 'trip_id', 'trip_headsign'],
      ...patterns.map(pattern => [pattern.routeId, 'day', pattern.id, pattern.headsign])],
    'stops.txt': [['stop_id', 'stop_name', 'stop_lat', 'stop_lon'],
      ...[...usedStops].sort((a, b) => a - b).map(index => {
        const stop = manifest.stops[index]
        return [stop[4], stop[2], stop[1], stop[0]]
      })],
    'stop_times.txt': [['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'],
      ...patterns.flatMap(pattern => pattern.stops.map(([index, arrival, departure], sequence) => [
        pattern.id, gtfsTime(arrival), gtfsTime(departure), manifest.stops[index][4], sequence + 1,
      ]))],
    'calendar_dates.txt': [['service_id', 'date', 'exception_type'], ['day', date, 1]],
    'feed_info.txt': [['feed_publisher_name', 'feed_publisher_url', 'feed_lang', 'feed_version'],
      ['Gleislicht / Swiss GTFS PostAuto subset', manifest.metadata.sourceUrl, 'de', manifest.metadata.feedVersion]],
  }
  await Promise.all(Object.entries(tables).map(([name, rows]) => writeFile(resolve(output, name), csv(rows))))
  const index = { schemaVersion: 1, metadata: manifest.metadata, pilotRoutes: pilot || null,
    stops: manifest.stops, patterns }
  await writeFile(resolve(output, 'patterns.json'), JSON.stringify(index))
  return { routes: routeLabels.size, patterns: patterns.length, trips: patterns.reduce((sum, pattern) => sum + pattern.tripCount, 0), stops: usedStops.size }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argument = (name, fallback) => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : fallback
  if (process.argv.includes('--help')) {
    console.log('Prepare one GTFS trip per distinct PostBus stop pattern. --output DIRECTORY [--snapshot MANIFEST] [--pilot 30]')
  } else {
    const output = argument('output')
    if (!output) throw new Error('--output DIRECTORY is required')
    const day = await readPostbusDay(argument('snapshot', DEFAULT_MANIFEST))
    console.log(await prepareRoadFeed({ ...day, output, pilot: Number(argument('pilot', 0)) }))
  }
}
