import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { activeServices, rowsFromArchive, stopsById, transportModeForRouteType } from '@motionstudies/data/gtfs'
import { createSnapshotBuilder, readStopTimes } from './ingest-gtfs.mjs'
import { readFrequencyIntervals } from './gtfs-frequencies.mjs'
import { applyRailGeometry, parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { createWaterRouter, distanceMetres } from './water-paths.mjs'

const argument = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1] }
const pair = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`
async function checksum(path) { const hash = createHash('sha256'); for await (const bytes of createReadStream(path)) hash.update(bytes); return hash.digest('hex') }

export function selectRigiRoute(route) {
  return (route.agency_id === '137' && route.route_type === '116') ||
    (route.agency_id === '185' && route.route_type === '1000') ||
    (route.agency_id === '13700' && route.route_type === '1300')
}

export function cablewayPath(from, to, response) {
  const features = response.results.filter(f => f.properties?.anlagenr === '71.105' && f.properties?.bahntyp === 'Luftseilbahn' && f.geometry?.type === 'LineString')
  if (features.length !== 1) throw new Error('Expected one official Weggis–Rigi Kaltbad cableway alignment')
  const feature = features[0], points = feature.geometry.coordinates
  const forward = distanceMetres(from, points[0]) + distanceMetres(to, points.at(-1)) <= distanceMetres(from, points.at(-1)) + distanceMetres(to, points[0])
  const path = forward ? points : [...points].reverse()
  const offsets = [distanceMetres(from, path[0]), distanceMetres(to, path.at(-1))]
  if (offsets.some(offset => offset > 150)) throw new Error('Cableway stop endpoints do not match the official alignment')
  return { path, featureId: feature.id, installation: '71.105', endpointOffsetsMetres: offsets, verticalProfile: 'not supplied by this 2D source' }
}

async function main() {
  const archive = argument('archive'), railSource = argument('rail-source')
  if (!archive || !railSource) throw new Error('Use --archive Swiss-GTFS.zip --rail-source schienennetz.xtf [--date 2026-09-04] [--output public/data/rigi-day.json]')
  const date = argument('date', '2026-09-04'), output = argument('output', 'public/data/rigi-day.json')
  const cableSource = argument('cable-source', 'data/rigi-cableway-source.json'), waterSource = argument('water-source', 'public/data/swiss-lakes.json')
  const [services, sourceStops, railXml, cable, lakes] = await Promise.all([
    activeServices(archive, date), stopsById(archive), readFile(railSource, 'utf8'),
    readFile(cableSource, 'utf8').then(JSON.parse), readFile(waterSource, 'utf8').then(JSON.parse),
  ])
  const routes = new Map(), operators = new Map(), trips = new Map()
  for await (const row of rowsFromArchive(archive, 'agency.txt')) operators.set(row.agency_id, row.agency_name)
  for await (const row of rowsFromArchive(archive, 'routes.txt')) if (selectRigiRoute(row)) routes.set(row.route_id, {
    routeId: row.route_id, agencyId: row.agency_id, operator: operators.get(row.agency_id), route: row.route_short_name,
    routeType: Number(row.route_type), mode: transportModeForRouteType(row.route_type), category: row.route_type === '116' ? 'other' : transportModeForRouteType(row.route_type),
  })
  for await (const row of rowsFromArchive(archive, 'trips.txt')) if (routes.has(row.route_id) && services.has(row.service_id)) trips.set(row.trip_id, {
    ...routes.get(row.route_id), headsign: row.trip_headsign, shortName: row.trip_short_name,
  })
  const builder = createSnapshotBuilder({ trips, sourceStops, windowStart: 0, windowEnd: 86400, focusTime: 43200, displayBounds: { minLongitude: -180, maxLongitude: 180, minLatitude: -90, maxLatitude: 90 } })
  console.log(`Reading ${trips.size} active Rigi/lake trips from ${routes.size} source routes…`)
  await readStopTimes(archive, trips, [builder], await readFrequencyIntervals(archive, trips), 0, 86400)
  const snapshot = builder.finish()
  snapshot.trains = snapshot.trains.map(train => {
    const source = trips.get(train.frequency?.sourceTripId ?? train.id)
    return { ...train, routeId: source.routeId, agencyId: source.agencyId, operator: source.operator, routeType: source.routeType }
  })
  const rail = applyRailGeometry({ ...snapshot, edges: [], trains: snapshot.trains.filter(t => t.routeType === 116) }, parseRailNetworkXtf(railXml, 10))
  if (rail.totalSegments === 0 || rail.totalSegments !== rail.matchedSegments) throw new Error(`Rigi rail geometry incomplete: ${rail.matchedSegments}/${rail.totalSegments}`)
  const paths = [...rail.paths], railTrains = new Map(rail.trains.map(t => [t.id, t]))
  const lake = lakes.lakes.find(l => l.id === '93' && l.name === 'Vierwaldstättersee')
  if (!lake || lake.polygons.length !== 1) throw new Error('Expected one Lake Lucerne polygon')
  console.log('Building water-constrained lake geometry…')
  const routeWater = createWaterRouter(lake.polygons[0]), matchedPairs = new Map(), waterAudit = [], cableAudit = []
  const trains = snapshot.trains.map(train => {
    if (railTrains.has(train.id)) return railTrains.get(train.id)
    const pathSegments = train.stops.slice(1).map(([b], i) => {
      const a = train.stops[i][0], key = `${train.category}:${pair(a, b)}`
      if (matchedPairs.has(key)) return matchedPairs.get(key)
      const from = snapshot.stops[a], to = snapshot.stops[b]
      const result = train.category === 'ferry' ? routeWater(from, to) : cablewayPath(from, to, cable)
      if (!result) throw new Error(`No water-constrained path: ${from[2]} → ${to[2]}`)
      const index = paths.length
      paths.push(result.path); matchedPairs.set(key, index)
      const record = { from: from[2], to: to[2], fromStopId: from[4], toStopId: to[4], ...result, path: undefined, pathIndex: index }
      if (train.category === 'ferry') waterAudit.push(record)
      else cableAudit.push(record)
      return index
    })
    return { ...train, pathSegments }
  })
  const edgeLookup = new Map()
  for (const train of trains) train.stops.slice(1).forEach(([b], i) => edgeLookup.set(pair(train.stops[i][0], b), train.pathSegments[i]))
  let feed
  for await (const row of rowsFromArchive(archive, 'feed_info.txt')) { feed = row; break }
  const sources = {
    timetable: { feedVersion: feed.feed_version, sha256: await checksum(archive) },
    rail: { sha256: await checksum(railSource), simplificationToleranceMetres: 10, publisher: 'Federal Office of Transport' },
    cableway: { sha256: await checksum(cableSource), publisher: 'Federal Office of Transport', installation: '71.105' },
    water: { sha256: await checksum(waterSource), ...lakes.metadata, lakeId: '93', method: 'shortest paths constrained to the cartographic lake polygon; not observed routes or shipping lanes', maximumDockOffsetMetres: 150 },
  }
  const metadata = {
    publisher: feed.feed_publisher_name, feedVersion: feed.feed_version, serviceDate: date,
    windowStart: 0, windowEnd: 86400, focusTime: 43200,
    sourceUrl: 'https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/',
    model: 'scheduled interpolation; FOT rail and cableway alignments; cartographic water-constrained boat paths',
    note: 'Lake Lucerne boats, Rigi cogwheel railways and Weggis–Rigi Kaltbad cableway. Boat paths are modelled, not shipping lanes. The map is 2D; vertical cable and terrain profiles remain separate work.',
    sources,
  }
  if (trains.some(t => t.frequency?.exactTimes === 0)) throw new Error('This Rigi fixture requires headway disclosure before accepting a source change')
  const result = { metadata, bounds: snapshot.bounds, stops: snapshot.stops, edges: snapshot.edges, paths, edgePaths: snapshot.edges.map(([a, b]) => edgeLookup.get(pair(a, b)) ?? null), trains }
  const audit = { metadata, counts: { trips: trains.length, stops: snapshot.stops.length, paths: paths.length, railSegments: rail.totalSegments }, routes: [...routes.values()].map(route => ({ ...route, trips: trains.filter(t => t.routeId === route.routeId).length })), water: waterAudit, cableway: cableAudit }
  await writeFile(output, JSON.stringify(result) + '\n')
  await writeFile(argument('audit-output', 'data/rigi-geometry-audit.json'), JSON.stringify(audit, null, 2) + '\n')
  console.log(`Wrote ${trains.length} full-day movements, ${paths.length} paths, ${waterAudit.length} water pairs and ${cableAudit.length} cableway pairs → ${output}`)
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error); process.exitCode = 1 })
