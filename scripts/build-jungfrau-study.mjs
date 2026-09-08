import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { activeServices, rowsFromArchive, stopsById, transportModeForRouteType } from '@motionstudies/data/gtfs'
import { createSnapshotBuilder, readStopTimes } from './ingest-gtfs.mjs'
import { readFrequencyIntervals } from './gtfs-frequencies.mjs'
import { applyRailGeometry, parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { distanceMetres } from './water-paths.mjs'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1] }
async function checksum(path) { const hash = createHash('sha256'); for await (const bytes of createReadStream(path)) hash.update(bytes); return hash.digest('hex') }
const pair = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`
export function selectJungfrauRoute(route) {
  return route.agency_id === '35' && route.route_type === '106' && ['91-61-j26-1', '91-62-j26-1'].includes(route.route_id) ||
    route.agency_id === '157' && route.route_type === '116' && ['93-63-j26-1', '93-64-j26-1'].includes(route.route_id) ||
    route.agency_id === '124' && route.route_type === '116' && route.route_id === '93-65-j26-1' ||
    route.agency_id === '200' && route.route_type === '1300' && route.route_id === '93-244-4-j26-1'
}
export function projectOnPath(point, path) {
  const scale = Math.cos(point[1] * Math.PI / 180)
  let best
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = (b[0] - a[0]) * scale, dy = b[1] - a[1], denominator = dx * dx + dy * dy
    if (!denominator) continue
    const fraction = Math.max(0, Math.min(1, (((point[0] - a[0]) * scale) * dx + (point[1] - a[1]) * dy) / denominator))
    const coordinate = [a[0] + fraction * (b[0] - a[0]), a[1] + fraction * (b[1] - a[1])], offset = distanceMetres(point, coordinate)
    if (!best || offset < best.offset) best = { coordinate, offset, index: i }
  }
  return best
}
// Two missing intermediate infrastructure nodes: audited exact FOT segments,
// not an unrestricted nearest-track lookup. Projections retain mapped alignments.
export function insertJungfrauStations(network, stops) {
  const corrections = [
    { source: '10470', name: 'Matten b. Interlaken', segment: 'ch14uvag00068371', from: 'Interlaken Ost [Gleis 1-2]', to: 'Wilderswil' },
    { source: '5226', name: 'Grindelwald Terminal', segment: 'ch14uvag00067777', from: 'Schwendi bei Grindelwald', to: 'Grindelwald' },
  ]
  const nodes = new Map(network.nodes), segments = [...network.segments], audit = []
  const length = path => path.slice(1).reduce((sum, p, i) => sum + distanceMetres(path[i], p), 0)
  for (const fix of corrections) {
    const stop = stops.find(s => s[4]?.match(/sloid:(\d+)/)?.[1] === fix.source)
    const index = segments.findIndex(s => s.id === fix.segment), segment = segments[index]
    if (!stop || !segment || nodes.get(segment.start).name !== fix.from || nodes.get(segment.end).name !== fix.to) throw new Error(`Unverified Jungfrau station correction: ${fix.name}`)
    const projection = projectOnPath(stop, segment.points)
    if (!projection || projection.offset > 30 || distanceMetres(projection.coordinate, segment.points[0]) < 10 || distanceMetres(projection.coordinate, segment.points.at(-1)) < 10) throw new Error(`Jungfrau station projection outside audited tolerance: ${fix.name}`)
    const id = `jungfrau:${fix.source}`, left = [...segment.points.slice(0, projection.index), projection.coordinate], right = [projection.coordinate, ...segment.points.slice(projection.index)]
    nodes.set(id, { id, number: `85${fix.source.padStart(5, '0')}`, name: fix.name, coordinate: projection.coordinate })
    segments.splice(index, 1, { ...segment, id: `${segment.id}:a`, end: id, points: left, length: length(left) }, { ...segment, id: `${segment.id}:b`, start: id, points: right, length: length(right) })
    audit.push({ ...fix, coordinate: projection.coordinate, offsetMetres: projection.offset })
  }
  return { network: { nodes, segments }, audit }
}
// BOB uses platform 2 at Interlaken Ost. The shared GTFS station number
// resolves to an unconnected generic node; use the existing FOT platform 1–2
// number only for geometry resolution, retaining original published stop IDs.
export function jungfrauRailResolverStops(stops) {
  return stops.map(stop => {
    if (stop[4]?.match(/sloid:(\d+)/)?.[1] !== '7492') return stop
    if (!/^2[A-Z]?$/.test(stop[3])) throw new Error('Unaudited Interlaken platform for the BOB study')
    return [...stop.slice(0, 4), 'ch:1:sloid:19310']
  })
}
export function eigerExpressPath(from, to, source) {
  const features = source.results.filter(f => f.attributes?.anlagenr === '75.014' && f.attributes?.betreiber_tuabkuerzung === 'WAB' && f.attributes?.fahrzeugtyp === 'Kabine' && f.geometry?.paths?.length === 1)
  if (features.length !== 1) throw new Error('Expected exact Eiger Express installation 75.014')
  const feature = features[0], points = feature.geometry.paths[0]
  const forward = distanceMetres(from, points[0]) + distanceMetres(to, points.at(-1)) <= distanceMetres(from, points.at(-1)) + distanceMetres(to, points[0])
  const path = forward ? points : [...points].reverse(), offsets = [distanceMetres(from, path[0]), distanceMetres(to, path.at(-1))]
  const roots = [from, to].map(s => s[4]?.match(/sloid:(\d+)/)?.[1])
  if (new Set(roots).size !== 2 || !roots.every(id => ['5226', '7361'].includes(id)) || offsets.some((d, i) => d > (roots[i] === '5226' ? 225 : 150))) throw new Error('Eiger Express endpoints do not match the audited shared timetable stops')
  return { path, featureId: feature.id, installation: '75.014', endpointOffsetsMetres: offsets }
}
export function auditJungfrauGeometry(snapshot) {
  const groups = new Map(), pairs = new Map()
  for (const train of snapshot.trains) {
    const group = groups.get(train.routeId) ?? { routeId: train.routeId, operator: train.operator, trips: 0, segments: 0, matched: 0, maxEndpointOffsetMetres: 0 }
    group.trips++
    for (let i = 1; i < train.stops.length; i++) {
      group.segments++
      const from = snapshot.stops[train.stops[i - 1][0]], to = snapshot.stops[train.stops[i][0]], path = snapshot.paths[train.pathSegments?.[i - 1]]
      const offset = path?.length >= 2 ? Math.min(Math.max(distanceMetres(from, path[0]), distanceMetres(to, path.at(-1))), Math.max(distanceMetres(from, path.at(-1)), distanceMetres(to, path[0]))) : Infinity
      if (offset <= (train.category === 'cableway' ? 225 : 150)) group.matched++
      group.maxEndpointOffsetMetres = Math.max(group.maxEndpointOffsetMetres, offset)
      const key = `${from[4]}:${to[4]}`
      if (!pairs.has(key)) pairs.set(key, { from: from[2], to: to[2], fromId: from[4], toId: to[4], pathIndex: train.pathSegments?.[i - 1] ?? null, endpointOffsetMetres: Number.isFinite(offset) ? offset : null })
    }
    groups.set(train.routeId, group)
  }
  return { routes: [...groups.values()], pairs: [...pairs.values()], passed: [...groups.values()].every(g => g.segments > 0 && g.matched === g.segments) }
}
async function main() {
  const archive = arg('archive'), railSource = arg('rail-source'), date = arg('date', '2026-09-04'), cableSource = arg('cable-source', 'data/jungfrau-cableway-source.json')
  if (!archive || !railSource) throw new Error('Use --archive Swiss-GTFS.zip --rail-source schienennetz.xtf [--date 2026-09-04]')
  const [services, sourceStops, railXml, cable] = await Promise.all([activeServices(archive, date), stopsById(archive), readFile(railSource, 'utf8'), readFile(cableSource, 'utf8').then(JSON.parse)])
  const routes = new Map(), operators = new Map(), trips = new Map()
  for await (const r of rowsFromArchive(archive, 'agency.txt')) operators.set(r.agency_id, r.agency_name)
  for await (const r of rowsFromArchive(archive, 'routes.txt')) if (selectJungfrauRoute(r)) routes.set(r.route_id, { routeId: r.route_id, agencyId: r.agency_id, operator: operators.get(r.agency_id), route: r.agency_id === '200' ? 'Eiger Express' : r.route_short_name, sourceRouteShortName: r.route_short_name, routeType: Number(r.route_type), mode: transportModeForRouteType(r.route_type), category: r.route_type === '116' ? 'other' : r.route_type === '106' ? 'regional' : 'cableway' })
  if (routes.size !== 6) throw new Error('Expected six audited Jungfrau routes')
  for await (const r of rowsFromArchive(archive, 'trips.txt')) if (routes.has(r.route_id) && services.has(r.service_id)) trips.set(r.trip_id, { ...routes.get(r.route_id), headsign: r.trip_headsign, shortName: r.trip_short_name })
  const builder = createSnapshotBuilder({ trips, sourceStops, windowStart: 0, windowEnd: 86400, focusTime: 43200, displayBounds: { minLongitude: -180, maxLongitude: 180, minLatitude: -90, maxLatitude: 90 } })
  const frequencies = await readFrequencyIntervals(archive, trips)
  if (frequencies.size) throw new Error('Jungfrau frequency source changed; review operating semantics before rebuilding')
  console.log(`Reading ${trips.size} source timetable records…`)
  await readStopTimes(archive, trips, [builder], frequencies, 0, 86400)
  const snapshot = builder.finish()
  snapshot.trains = snapshot.trains.map(t => ({ ...t, routeId: trips.get(t.id).routeId, agencyId: trips.get(t.id).agencyId, operator: trips.get(t.id).operator, sourceRouteShortName: trips.get(t.id).sourceRouteShortName, routeType: trips.get(t.id).routeType }))
  const corrected = insertJungfrauStations(parseRailNetworkXtf(railXml, 10), snapshot.stops)
  const rail = applyRailGeometry({ ...snapshot, stops: jungfrauRailResolverStops(snapshot.stops), edges: [], trains: snapshot.trains.filter(t => t.category !== 'cableway') }, corrected.network)
  const paths = [...rail.paths], railTrains = new Map(rail.trains.map(t => [t.id, t])), cablePaths = new Map(), cableAudit = []
  const trains = snapshot.trains.map(t => {
    if (railTrains.has(t.id)) return railTrains.get(t.id)
    return { ...t, pathSegments: t.stops.slice(1).map(([b], i) => {
      const a = t.stops[i][0], key = pair(a, b)
      if (cablePaths.has(key)) return cablePaths.get(key)
      const result = eigerExpressPath(snapshot.stops[a], snapshot.stops[b], cable), index = paths.length
      paths.push(result.path); cablePaths.set(key, index); cableAudit.push({ from: snapshot.stops[a][4], to: snapshot.stops[b][4], ...result, path: undefined })
      return index
    }) }
  })
  const edgeLookup = new Map()
  for (const t of trains) t.stops.slice(1).forEach(([b], i) => edgeLookup.set(pair(t.stops[i][0], b), t.pathSegments?.[i]))
  let feed
  for await (const r of rowsFromArchive(archive, 'feed_info.txt')) { feed = r; break }
  const metadata = { publisher: feed.feed_publisher_name, feedVersion: feed.feed_version, serviceDate: date, windowStart: 0, windowEnd: 86400, focusTime: 43200, sourceUrl: 'https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/', model: 'source timetable interpolation on mapped 2D rail and cableway alignments; Eiger Express records are not tracked physical cabins', note: 'BOB valley branches, Wengernalpbahn, Jungfraubahn and Eiger Express only. No measured terrain, tunnel heights or walking geometry. After-midnight records remain on their original service day; preceding-day spillover is not included.', sources: { timetable: { sha256: await checksum(archive) }, rail: { publisher: 'Federal Office of Transport', sha256: await checksum(railSource), simplificationToleranceMetres: 10 }, cableway: { publisher: 'Federal Office of Transport', sha256: await checksum(cableSource), installation: '75.014' } } }
  const result = { metadata, bounds: snapshot.bounds, stops: snapshot.stops, edges: snapshot.edges, paths, edgePaths: snapshot.edges.map(([a, b]) => edgeLookup.get(pair(a, b)) ?? null), trains }
  const geometry = auditJungfrauGeometry(result)
  const audit = { metadata, counts: { trips: trains.length, rail: trains.filter(t => t.category !== 'cableway').length, cableway: trains.filter(t => t.category === 'cableway').length, stops: snapshot.stops.length, paths: paths.length, gzipBytes: gzipSync(JSON.stringify(result)).length }, stationCorrections: corrected.audit, platformResolution: { gtfsStation: 'ch:1:sloid:7492', platforms: ['2', '2A', '2B'], fotNode: 'ch14uvag00066282', fotNumber: '8519310', name: 'Interlaken Ost [Gleis 1-2]', publishedStopIdsUnchanged: true }, cableway: cableAudit, ...geometry }
  await writeFile(arg('audit-output', 'data/jungfrau-study-audit.json'), JSON.stringify(audit, null, 2) + '\n')
  if (!geometry.passed || audit.counts.gzipBytes > 100 * 1024) throw new Error('Jungfrau geometry or optional-data budget gate failed; see audit')
  await writeFile(arg('output', 'public/data/jungfrau-day.json'), JSON.stringify(result) + '\n')
  console.log(JSON.stringify(audit.counts)); console.log(geometry.routes)
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error); process.exitCode = 1 })
