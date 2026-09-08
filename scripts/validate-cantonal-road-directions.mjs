import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectOnRoad } from './ingest-cantonal-road-topology.mjs'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'
import { lv95ToWgs84 } from './ingest-national-road-topology.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
const norm = value => value.trim().normalize('NFC').toLocaleLowerCase('de-CH')
export const directionDestination = description => description?.match(/^(?:Normalspur|Überholspur) Richtung ([\p{L} .'-]+)$/u)?.[1].trim()
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const round = n => Math.round(n * 100) / 100
export const DIRECTION_GATES = { minimumDestinationDistanceMetres: 1500, minimumOffsetSeparationMetres: 750, maximumDestinationRoadDistanceMetres: 1500, minimumBearingAgreement: 0.75, maximumSectionMetres: 5000 }

export function destinationCandidates(name, response) {
  if (!Array.isArray(response?.results)) throw new Error('Invalid place search response')
  // Exact feature queries are capped at 200; saturated responses stay unresolved.
  if (response.results.length >= 200) return []
  const unique = new Map()
  for (const feature of response.results) {
    const a = feature.properties, b = feature.bbox
    if (feature.layerBodId !== 'ch.swisstopo.swissnames3d' || a?.objektklasse !== 'TLM_SIEDLUNGSNAME' || norm(a.name ?? '') !== norm(name)) continue
    if (!Array.isArray(b) || b.length !== 4 || !b.every(Number.isFinite) || b[0] < 2400000 || b[2] > 2900000 || b[1] < 1000000 || b[3] > 1400000 || b[0] > b[2] || b[1] > b[3]) continue
    // Multiple source representations of the same named settlement share bounds.
    // Keep distinct extents as alternatives instead of picking an arbitrary hit.
    unique.set(b.join(':'), { name: a.name, coordinate: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], bounds: b, sourceFeatureId: feature.featureId })
  }
  return [...unique.values()]
}

function pathPoint(points, offset) {
  let travelled = 0
  for (let i = 1; i < points.length; i++) {
    const length = distance(points[i - 1], points[i])
    if (travelled + length >= offset && length) {
      const t = Math.max(0, (offset - travelled) / length)
      return points[i - 1].map((v, axis) => v + t * (points[i][axis] - v))
    }
    travelled += length
  }
  return points.at(-1)
}

export function orientDestination(point, points, candidates) {
  // Resolve homonyms only within the regional context, never by choosing the nearest.
  const nearby = candidates.filter(c => distance(point, c.coordinate) <= 50000)
  if (nearby.length !== 1) return { status: nearby.length ? 'ambiguous-destination' : 'unresolved-destination' }
  const destination = nearby[0]
  const site = projectOnRoad(point, points), target = projectOnRoad(destination.coordinate, points)
  if (!site || !target) return { status: 'invalid-path' }
  const separation = distance(point, destination.coordinate)
  const delta = target.offset - site.offset
  const before = pathPoint(points, Math.max(0, site.offset - 100))
  const after = pathPoint(points, Math.min(site.totalLength, site.offset + 100))
  const tangent = [after[0] - before[0], after[1] - before[1]]
  const vector = [destination.coordinate[0] - point[0], destination.coordinate[1] - point[1]]
  const agreement = (tangent[0] * vector[0] + tangent[1] * vector[1]) / (Math.hypot(...tangent) * separation)
  const evidence = { destination, destinationDistanceMetres: round(separation), destinationRoadDistanceMetres: round(target.distance), offsetSeparationMetres: round(delta), bearingAgreement: round(agreement), offsetMetres: round(site.offset) }
  if (separation < DIRECTION_GATES.minimumDestinationDistanceMetres || Math.abs(delta) < DIRECTION_GATES.minimumOffsetSeparationMetres) return { status: 'destination-too-close', ...evidence }
  if (target.distance > DIRECTION_GATES.maximumDestinationRoadDistanceMetres) return { status: 'destination-off-axis', ...evidence }
  if (!Number.isFinite(agreement) || Math.abs(agreement) < DIRECTION_GATES.minimumBearingAgreement || Math.sign(agreement) !== Math.sign(delta)) return { status: 'bearing-conflict', ...evidence }
  if (destination.bounds) {
    const [west, south, east, north] = destination.bounds
    const corners = [[west, south], [west, north], [east, south], [east, north]]
    if (corners.some(corner => {
      const projected = projectOnRoad(corner, points)
      const v = [corner[0] - point[0], corner[1] - point[1]]
      const alignment = (tangent[0] * v[0] + tangent[1] * v[1]) / (Math.hypot(...tangent) * Math.hypot(...v))
      return !Number.isFinite(alignment) || alignment * Math.sign(delta) < 0.5 || (projected.offset - site.offset) * Math.sign(delta) < DIRECTION_GATES.minimumOffsetSeparationMetres
    })) return { status: 'destination-extent-conflict', ...evidence }
  }
  return { status: 'validated', direction: delta > 0 ? 'positive' : 'negative', ...evidence }
}

function sectionPath(points, from, to) {
  const start = pathPoint(points, from), end = pathPoint(points, to)
  let travelled = 0
  return [start, ...points.slice(1).filter((p, i) => {
    travelled += distance(points[i], p)
    return travelled > from && travelled < to
  }), end].map(lv95ToWgs84)
}

export function buildDirectionTopology(topology, catalog, places) {
  if (topology.metadata.recordingScope !== 'zurich-cantonal' || catalog.metadata.supplier !== 'ZH.CH') throw new Error('Expected Zürich topology and catalog')
  if (topology.metadata.measurementSiteTableVersion !== catalog.metadata.measurementSiteTableVersion) throw new Error('Topology and catalog versions differ')
  const paths = new Map(topology.paths.map(p => [p.id, { ...p, lv95: p.points.map(([lon, lat]) => wgs84ToLv95(lon, lat)) }]))
  const detectors = new Map(catalog.detectors.map(d => [d.id, d]))
  const stationAudit = topology.stations.map(station => {
    if (!station.match) return { id: station.id, status: 'unmatched-geometry', candidatePaths: station.preciseLv95 ? (station.candidates ?? []).map(c => c.pathId) : [], detectors: [] }
    const path = paths.get(station.match.pathId)
    if (!path) throw new Error(`Missing path for ${station.id}`)
    const descriptions = new Map((station.detectorDescriptions ?? []).map(d => [d.id, d.description]))
    const audit = station.detectorIds.flatMap(id => {
      const detector = detectors.get(id)
      if (!detector) throw new Error(`Detector absent from catalog: ${id}`)
      if (detector.lane === 'emergencyLane') return []
      const description = descriptions.get(id), name = directionDestination(description)
      const place = name && places.entries.find(p => norm(p.name) === norm(name))
      return [{ id, description, alertCDirection: detector.direction, ...(place ? orientDestination(station.preciseLv95, path.lv95, place.candidates) : { status: 'unresolved-description' }) }]
    })
    const complete = audit.length >= 2 && audit.every(d => d.status === 'validated') && new Set(audit.map(d => d.direction)).size === 2
    return { id: station.id, road: station.match.road, pathId: path.id, status: complete ? 'validated' : 'unresolved-direction-pair', detectors: audit }
  })
  const sites = stationAudit.filter(s => s.status === 'validated').flatMap(station => ['positive', 'negative'].map(direction => {
    const source = topology.stations.find(s => s.id === station.id)
    const group = station.detectors.filter(d => d.direction === direction)
    const offset = group[0].offsetMetres
    return { id: `${station.id}:axis-${direction}`, stationId: station.id, direction, detectorIds: group.map(d => d.id), carriageways: ['mainCarriageway'], coordinate: source.coordinate, offsetMetres: offset,
      match: { confidence: 'high', road: station.road, segmentId: station.pathId, projectedCoordinate: lv95ToWgs84(pathPoint(paths.get(station.pathId).lv95, offset)), method: 'destination-and-axis-bearing' } }
  }))
  const sections = [], sectionAudit = []
  for (const path of paths.values()) {
    // Include unresolved intervening counters: skipping them would conceal a coverage gap.
    const stations = stationAudit.filter(s => s.pathId === path.id || s.candidatePaths?.includes(path.id)).map(s => ({ ...s, offset: projectOnRoad(topology.stations.find(t => t.id === s.id).preciseLv95, path.lv95).offset })).sort((a, b) => a.offset - b.offset)
    for (let i = 1; i < stations.length; i++) {
      const a = stations[i - 1], b = stations[i], length = b.offset - a.offset
      const status = a.status !== 'validated' || b.status !== 'validated' ? 'unresolved-endpoint' : length < 100 ? 'colocated-counters' : length > DIRECTION_GATES.maximumSectionMetres ? 'counter-gap' : 'accepted'
      sectionAudit.push({ pathId: path.id, from: a.id, to: b.id, distanceMetres: round(length), status })
      if (status !== 'accepted') continue
      const geometry = sectionPath(path.lv95, a.offset, b.offset)
      for (const direction of ['positive', 'negative']) {
        const reverse = direction === 'negative', from = reverse ? b : a, to = reverse ? a : b
        const points = reverse ? [...geometry].reverse() : geometry
        sections.push({ id: `${path.id}:${direction}:${a.id}:${b.id}`, road: path.road, direction, fromSiteId: `${from.id}:axis-${direction}`, toSiteId: `${to.id}:axis-${direction}`, fromCoordinate: points[0], toCoordinate: points.at(-1), path: points, distanceKm: round(length) / 1000 })
      }
    }
  }
  return { metadata: { ...topology.metadata, geometryOnly: false, publicationStatus: 'draft', directionModel: 'Destination projection and local bearing with complete opposing detector groups; positive follows stored path vertex order, not Alert-C', directionGates: DIRECTION_GATES, placesSource: places.metadata, directionCoverage: { stations: stationAudit.length, validatedStations: sites.length / 2, directionalSites: sites.length, directedSections: sections.length, roadsWithSections: new Set(sections.map(s => s.road)).size } }, roads: topology.roads.map(r => ({ ...r, directionalSiteCount: sites.filter(s => s.match.road === r.id).length, sectionCount: sections.filter(s => s.road === r.id).length })), paths: topology.paths, sites, sections, stationAudit, sectionAudit }
}

async function main() {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  const topologyFile = arg('topology') ?? 'public/data/zurich-cantonal-road-topology.json'
  const topology = JSON.parse(await readFile(topologyFile, 'utf8'))
  const directory = arg('download') ?? arg('input')
  if (!directory && !arg('places')) throw new Error('Use --download=/tmp/zh-destinations, --input=/tmp/zh-destinations or --places=data/zurich-cantonal-road-directions.json')
  if (arg('download')) {
    await mkdir(directory, { recursive: true })
    const names = [...new Set(topology.stations.filter(s => s.match).flatMap(s => (s.detectorDescriptions ?? []).map(d => directionDestination(d.description)).filter(Boolean)))].sort()
    const entries = []
    for (const [i, name] of names.entries()) {
      const url = new URL('https://api3.geo.admin.ch/rest/services/ech/MapServer/find')
      for (const [key, value] of Object.entries({ layer: 'ch.swisstopo.swissnames3d', searchText: name, searchField: 'name', contains: 'false', sr: '2056', geometryFormat: 'geojson' })) url.searchParams.set(key, value)
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
      const body = await response.text()
      destinationCandidates(name, JSON.parse(body))
      const file = `${i}.json`
      await writeFile(resolve(directory, file), body)
      entries.push({ name, url: String(url), file, sha256: hash(body) })
    }
    await writeFile(resolve(directory, 'sources.json'), `${JSON.stringify({ fetchedAt: new Date().toISOString(), entries }, null, 2)}\n`)
    return
  }
  const saved = arg('places') ? JSON.parse(await readFile(arg('places'), 'utf8')) : undefined
  if (saved && (saved.metadata.placesSha256 !== hash(JSON.stringify(saved.places)) || saved.metadata.geometryArtifactSha256 !== hash(await readFile(topologyFile)))) throw new Error('Pinned direction inputs have changed')
  const manifest = saved ? undefined : JSON.parse(await readFile(resolve(directory, 'sources.json'), 'utf8'))
  const places = saved?.places ?? { metadata: { publisher: 'swisstopo / GeoAdmin', fetchedAt: manifest.fetchedAt, sourceUrl: 'https://docs.geo.admin.ch/access-data/find-features.html' }, entries: [] }
  if (!Number.isFinite(Date.parse(places.metadata.fetchedAt))) throw new Error('Place retrieval timestamp is missing')
  for (const entry of manifest?.entries ?? []) {
    const body = await readFile(resolve(directory, entry.file), 'utf8')
    const url = new URL(entry.url)
    if (hash(body) !== entry.sha256 || url.origin !== 'https://api3.geo.admin.ch' || url.searchParams.get('sr') !== '2056' || url.searchParams.get('searchText') !== entry.name || url.searchParams.get('contains') !== 'false' || url.searchParams.get('layer') !== 'ch.swisstopo.swissnames3d') throw new Error(`Place provenance mismatch: ${entry.name}`)
    places.entries.push({ ...entry, candidates: destinationCandidates(entry.name, JSON.parse(body)) })
  }
  const catalog = JSON.parse(await readFile('data/zurich-cantonal-road-counters.json', 'utf8'))
  const result = buildDirectionTopology(topology, catalog, places)
  result.metadata.geometryArtifactSha256 = hash(await readFile(topologyFile))
  result.metadata.placesSha256 = hash(JSON.stringify(places))
  const output = arg('output') ?? 'data/zurich-cantonal-road-directions.json'
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify({ ...result, places })}\n`)
  console.log(JSON.stringify(result.metadata.directionCoverage, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
