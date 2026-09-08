import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lv95ToWgs84, simplifyRoadPath } from './ingest-national-road-topology.mjs'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'

const MAIN_CLASSES = new Set([
  'Hauptstrassen nach DgStrVO Kat A mit Nummerntafel',
  'Hauptstrassen nach DgStrVO Kat B ohne Nummerntafel',
  'Übrige sign. kt. Hauptstrassen (Verbindungsstr)',
])
const ROAD_CLASSES = new Set([...MAIN_CLASSES, 'Kantonale Nebenstrassen'])
export const CANTONAL_GEO_SOURCES = {
  stations: 'https://maps.zh.ch/wfs/TBAVMSZHWFS?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:verkehrszaehlstellen&SRSNAME=EPSG:2056&OUTPUTFORMAT=application%2Fjson&COUNT=10000',
  roads: 'https://maps.zh.ch/wfs/TBAStrZHWFS?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:haupt-und-nebenstrassen&SRSNAME=EPSG:2056&OUTPUTFORMAT=application%2Fjson&COUNT=100000',
  collectors: 'https://vdp.zh.ch/pws/public-service/readCollectorsCfg',
}
const hash = (value) => createHash('sha256').update(value).digest('hex')
const round = (value) => Math.round(value * 100) / 100
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const validPoint = (point) => Array.isArray(point) && point.length >= 2 &&
  point.slice(0, 2).every(Number.isFinite) && point[0] > 2_400_000 && point[0] < 2_900_000 && point[1] > 1_000_000 && point[1] < 1_400_000

export function validateGeoCollection(collection, name) {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features) || !collection.features.length) throw new Error(`${name}: empty or invalid GeoJSON`)
  if (!/EPSG(?::|::)2056$/.test(collection.crs?.properties?.name ?? '')) throw new Error(`${name}: expected explicit EPSG:2056 coordinates`)
  if (!Number.isInteger(collection.numberMatched) || collection.numberMatched !== collection.features.length) throw new Error(`${name}: incomplete WFS response; fetch all matched features`)
  return collection.features
}

export function projectOnRoad(point, points) {
  let best
  let offset = 0
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index]
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy)
    if (!length) continue
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length ** 2))
    const projected = [a[0] + dx * t, a[1] + dy * t]
    const separation = distance(point, projected)
    if (!best || separation < best.distance) best = { distance: separation, projected, offset: offset + length * t, edge: index - 1 }
    offset += length
  }
  return best && { ...best, totalLength: offset }
}

function parseRoads(collection) {
  const seen = new Set()
  return validateGeoCollection(collection, 'roads').map((feature) => {
    const p = feature.properties
    if (!p?.achsnummer?.trim() || !p.achsname || !p.netzname || !p.achstypnam) throw new Error('Road is missing identity or classification')
    if (feature.geometry?.type !== 'LineString' || feature.geometry.coordinates.length < 2 || !feature.geometry.coordinates.every(validPoint)) throw new Error(`Invalid road geometry: ${p.achsnummer}`)
    if (![p.startdista, p.enddistanz].every(Number.isFinite) || p.enddistanz <= p.startdista) throw new Error(`Invalid road chainage: ${p.achsnummer}`)
    const points = feature.geometry.coordinates.map((point) => point.slice(0, 2))
    const eligible = ROAD_CLASSES.has(p.netzname) && p.achstypnam !== 'Aufgehobene Strassen'
    const road = `ZH:${p.achsnummer.trim()}`
    const id = `${road}:${hash(JSON.stringify([p, points])).slice(0, 16)}`
    if (seen.has(id)) throw new Error(`Duplicate road feature: ${id}`)
    seen.add(id)
    return { id, road, label: `ZH ${p.achsnummer.trim()}`, name: p.achsname, roadClass: p.netzname, mainRoad: MAIN_CLASSES.has(p.netzname), eligible, points }
  })
}

function bounds(points) {
  return {
    minLongitude: Math.min(...points.map((p) => p[0])), maxLongitude: Math.max(...points.map((p) => p[0])),
    minLatitude: Math.min(...points.map((p) => p[1])), maxLatitude: Math.max(...points.map((p) => p[1])),
  }
}

export function buildCantonalRoadTopology(catalog, stationGeo, roadGeo, { fetchedAt, sourceHashes, collectors = [] } = {}) {
  if (catalog?.metadata?.supplier !== 'ZH.CH') throw new Error('Expected Zürich counter catalog')
  const stationFeatures = validateGeoCollection(stationGeo, 'stations')
  const preciseStations = new Map()
  for (const feature of stationFeatures) {
    const number = feature.properties?.messst_nr
    if (!Number.isInteger(number) || number < 1 || feature.geometry?.type !== 'Point' || !validPoint(feature.geometry.coordinates)) throw new Error('Invalid precise station identity or coordinate')
    if (preciseStations.has(number)) throw new Error(`Duplicate precise station number: ${number}`)
    preciseStations.set(number, feature)
  }
  const allRoads = parseRoads(roadGeo)
  const eligibleRoads = allRoads.filter(({ eligible }) => eligible)
  const detectorMap = new Map(catalog.detectors.map((detector) => [detector.id, detector]))
  const collectorMap = new Map()
  for (const collector of collectors) {
    const number = collector.uID?.id?.match(/^M(\d+)$/)?.[1]
    // This public endpoint also contains unrelated city/test collectors.
    if (!number) continue
    if (collectorMap.has(Number(number))) {
      collectorMap.set(Number(number), null)
      continue
    }
    collectorMap.set(Number(number), collector)
  }
  const stations = catalog.stations.map((station) => {
    const number = Number(station.id.split(':')[1])
    const feature = preciseStations.get(number)
    const result = { id: station.id, detectorIds: station.detectorIds, coordinate: null, geometryStatus: 'missing-station', match: null }
    const collector = collectorMap.get(number)
    if (collectorMap.has(number) && !collector) result.collectorMetadataIssue = 'ambiguous-collector-id'
    if (collector) {
      result.name = collector.name
      result.collectorStatus = collector.collectorStatus
      result.detectorDescriptions = (collector.detectors ?? []).flatMap((detector) => {
        if (detector.uID?.id !== collector.uID.id || !/^\d+$/.test(detector.uID?.sub?.id ?? '')) throw new Error(`Invalid detector configuration at ${station.id}`)
        const detectorId = `${station.id}.${detector.uID.sub.id.padStart(2, '0')}`
        return station.detectorIds.includes(detectorId) ? [{ id: detectorId, description: detector.name }] : []
      })
    }
    if (!feature) return result
    const point = feature.geometry.coordinates.slice(0, 2)
    const coarse = station.detectorIds.map((id) => detectorMap.get(id)?.coordinate).filter(Boolean)
    const shifts = coarse.map(([lon, lat]) => distance(point, wgs84ToLv95(lon, lat)))
    result.coordinate = lv95ToWgs84(point)
    result.preciseLv95 = point
    result.coordinateSource = 'Zürich Verkehrsmessstellen WFS / messst_nr'
    result.sourceStationNumber = number
    result.sourceStationType = feature.properties.messst_typ
    result.minimumCoordinateShiftMetres = shifts.length ? round(Math.min(...shifts)) : null
    // Exact IDs are essential; a large geographic disagreement still needs review.
    if (shifts.length && Math.min(...shifts) > 1500) return { ...result, geometryStatus: 'coordinate-conflict' }
    const perRoad = new Map()
    for (const road of allRoads) {
      const projected = projectOnRoad(point, road.points)
      if (!projected || projected.distance > 100) continue
      // Include excluded classes in competition so motorway counters never snap to a nearby minor road.
      const key = `${road.road}:${road.eligible}`
      if (!perRoad.has(key) || projected.distance < perRoad.get(key).distance) perRoad.set(key, { ...projected, path: road })
    }
    const candidates = [...perRoad.values()].sort((a, b) => a.distance - b.distance || a.path.id.localeCompare(b.path.id))
    const first = candidates[0], competing = candidates[1]
    result.candidates = candidates.slice(0, 3).map(({ distance: d, path }) => ({ road: path.road, pathId: path.id, distanceMetres: round(d), eligible: path.eligible }))
    if (!first || first.distance > 25) return { ...result, geometryStatus: 'off-network' }
    if (!first.path.eligible) return { ...result, geometryStatus: 'excluded-road-class' }
    if (competing && competing.distance - first.distance < 15) return { ...result, geometryStatus: 'ambiguous-road' }
    return {
      ...result, geometryStatus: 'matched',
      match: { road: first.path.road, pathId: first.path.id, roadClass: first.path.roadClass, distanceMetres: round(first.distance), projectedCoordinate: lv95ToWgs84(first.projected), offsetMetres: round(first.offset), directionStatus: 'unresolved' },
    }
  })
  const paths = eligibleRoads.map((road) => ({ id: road.id, road: road.road, axisName: road.name, position: 'equal', mainline: true, roadClass: road.roadClass, points: simplifyRoadPath(road.points, 5).map(lv95ToWgs84) }))
  const roadIds = [...new Set(eligibleRoads.map(({ road }) => road))].sort()
  const roads = roadIds.map((id) => {
    const source = eligibleRoads.filter(({ road }) => road === id)
    const roadPaths = paths.filter(({ road }) => road === id)
    const roadBounds = bounds(roadPaths.flatMap(({ points }) => points))
    const matched = stations.filter(({ match }) => match?.road === id)
    const length = source.reduce((sum, { points }) => sum + points.slice(1).reduce((total, p, i) => total + distance(points[i], p), 0), 0)
    return {
      id, label: source[0].label, officialLabel: 'Kanton Zürich', description: source[0].name,
      roadClasses: [...new Set(source.map(({ roadClass }) => roadClass))],
      bounds: roadBounds, focus: [(roadBounds.minLongitude + roadBounds.maxLongitude) / 2, (roadBounds.minLatitude + roadBounds.maxLatitude) / 2],
      cameraScale: Math.max(0.12, Math.min(0.65, Math.max((roadBounds.maxLongitude - roadBounds.minLongitude) / 4.3, (roadBounds.maxLatitude - roadBounds.minLatitude) / 2.2))),
      pathCount: roadPaths.length, stationCount: matched.length, directionalSiteCount: 0, sectionCount: 0, lengthKm: round(length / 1000),
    }
  })
  const statusCounts = Object.fromEntries([...new Set(stations.map(({ geometryStatus }) => geometryStatus))].sort().map((status) => [status, stations.filter(({ geometryStatus }) => geometryStatus === status).length]))
  return {
    metadata: {
      schemaVersion: 1, recordingScope: 'zurich-cantonal', publisher: 'Tiefbauamt Kanton Zürich',
      sourceUrl: 'https://geolion.zh.ch/geodatensatz/3177', stationSourceUrl: 'https://geolion.zh.ch/geodatensatz/1243',
      fetchedAt, sourceCrs: 'EPSG:2056', sources: Object.fromEntries(Object.entries(CANTONAL_GEO_SOURCES).map(([name, url]) => [name, { url, sha256: sourceHashes?.[name] }])),
      counterCatalogSha256: catalog.metadata.sourceSha256, measurementSiteTableVersion: catalog.metadata.measurementSiteTableVersion,
      model: 'Official classified road geometry with station-ID joins and conservative spatial matching; no inferred travel direction',
      geometryToleranceMetres: 5, maximumMatchDistanceMetres: 25, ambiguityMarginMetres: 15,
      coverage: { catalogStations: stations.length, preciseStationFeatures: stationFeatures.length, preciseStationJoins: stations.filter(({ coordinate }) => coordinate).length, sourceRoadFeatures: allRoads.length, includedRoadFeatures: paths.length, roads: roads.length, stationStatus: statusCounts },
    },
    roads, paths, stations,
    // Direction codes are relative to Alert-C, not these source polylines.
    // Position matching alone must not create a directional playback section.
    sites: [], sections: [],
  }
}

async function main() {
  const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3)
  if (process.argv.includes('--help')) {
    console.log('Usage: npm run data:road:topology:cantonal -- [--download=/tmp/zh-road-sources] | --input=/tmp/zh-road-sources [--catalog=data/zurich-cantonal-road-counters.json] [--output=public/data/zurich-cantonal-road-topology.json]')
    return
  }
  if (arg('download')) {
    const directory = resolve(arg('download'))
    await mkdir(directory, { recursive: true })
    const sources = {}
    for (const [name, url] of Object.entries(CANTONAL_GEO_SOURCES)) {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
      const body = await response.text()
      const parsed = JSON.parse(body)
      if (name === 'collectors') {
        if (!Array.isArray(parsed) || !parsed.length) throw new Error('Empty collector configuration')
      } else validateGeoCollection(parsed, name)
      await writeFile(resolve(directory, `${name}.geojson`), body)
      sources[name] = { url, sha256: hash(body) }
    }
    await writeFile(resolve(directory, 'sources.json'), `${JSON.stringify({ fetchedAt: new Date().toISOString(), sources }, null, 2)}\n`)
    console.log(`Saved complete public WFS sources to ${directory}`)
    return
  }
  if (!arg('input')) throw new Error('--input or --download is required')
  const input = resolve(arg('input'))
  const manifest = JSON.parse(await readFile(resolve(input, 'sources.json'), 'utf8'))
  if (!Number.isFinite(Date.parse(manifest.fetchedAt))) throw new Error('Source retrieval time is missing')
  const sources = {}, sourceHashes = {}
  for (const [name, url] of Object.entries(CANTONAL_GEO_SOURCES)) {
    const body = await readFile(resolve(input, `${name}.geojson`), 'utf8')
    if (manifest.sources[name]?.sha256 !== hash(body) || manifest.sources[name]?.url !== url) throw new Error(`Source provenance mismatch: ${name}`)
    sources[name] = JSON.parse(body)
    sourceHashes[name] = hash(body)
  }
  const catalog = JSON.parse(await readFile(resolve(arg('catalog') ?? 'data/zurich-cantonal-road-counters.json'), 'utf8'))
  const result = buildCantonalRoadTopology(catalog, sources.stations, sources.roads, { fetchedAt: manifest.fetchedAt, sourceHashes, collectors: sources.collectors })
  const output = resolve(arg('output') ?? 'public/data/zurich-cantonal-road-topology.json')
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(result)}\n`)
  console.log(JSON.stringify(result.metadata.coverage, null, 2))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
