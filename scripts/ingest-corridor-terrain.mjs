import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromUrl } from 'geotiff'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_NETWORK = resolve(ROOT, 'public/data/swiss-rail-morning.json')
const DEFAULT_LAKES = resolve(ROOT, 'public/data/swiss-lakes.json')
const DEFAULT_OUTPUT = resolve(ROOT, 'public/data/zurich-chur-corridor.json')
const STAC_ITEM_URL =
  'https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissaltiregio/items/swissaltiregio'
const PRODUCT_URL = 'https://www.swisstopo.admin.ch/en/height-model-swissaltiregio'
const PROFILE_URL = 'https://api3.geo.admin.ch/rest/services/profile.json'
const SBB_TUNNEL_API =
  'https://data.sbb.ch/api/explore/v2.1/catalog/datasets/tunnel/records'
const SBB_TUNNEL_PRODUCT_URL = 'https://data.sbb.ch/explore/dataset/tunnel/'
const ATTRIBUTION =
  'Bundesamt für Landestopografie swisstopo; Tarquini S., I. Isola, M. Favalli, A. Battistini, G. Dotta (2023), TINITALY 1.1; DGM Österreich, geoland.at; DGM1, Bayerische Vermessungsverwaltung; DGM1, Baden-Württemberg: LGL, dl-de/by-2-0; RGEAlti, IGN France, July 2023'

export function wgs84ToLv95(longitude, latitude) {
  const latitudeAux = (latitude * 3600 - 169028.66) / 10000
  const longitudeAux = (longitude * 3600 - 26782.5) / 10000
  const easting =
    2600072.37 +
    211455.93 * longitudeAux -
    10938.51 * longitudeAux * latitudeAux -
    0.36 * longitudeAux * latitudeAux ** 2 -
    44.54 * longitudeAux ** 3
  const northing =
    1200147.07 +
    308807.95 * latitudeAux +
    3745.25 * longitudeAux ** 2 +
    76.63 * latitudeAux ** 2 -
    194.56 * longitudeAux ** 2 * latitudeAux +
    119.79 * latitudeAux ** 3
  return [easting, northing]
}

function squaredDistance([firstX, firstY], [secondX, secondY]) {
  return (firstX - secondX) ** 2 + (firstY - secondY) ** 2
}

function orientedSegment(points, fromCoordinate) {
  if (points.length < 2) return points
  return squaredDistance(points[0], fromCoordinate) <=
    squaredDistance(points.at(-1), fromCoordinate)
    ? points
    : [...points].reverse()
}

export function corridorRoute(network) {
  const candidates = network.trains
    .map((train) => {
      const names = train.stops.map(([stopIndex]) => network.stops[stopIndex]?.[2])
      const fromIndex = names.indexOf('Zürich HB')
      const toIndex = names.indexOf('Chur')
      if (fromIndex < 0 || toIndex <= fromIndex) return undefined
      const matchedSegments = train.pathSegments
        ?.slice(fromIndex, toIndex)
        .filter((value) => value !== null && value !== undefined).length ?? 0
      return { train, fromIndex, toIndex, matchedSegments }
    })
    .filter(Boolean)
    .sort(
      (first, second) =>
        Number(second.train.route === 'IR35') - Number(first.train.route === 'IR35') ||
        second.matchedSegments - first.matchedSegments ||
        first.train.start - second.train.start,
    )

  const selected = candidates[0]
  if (!selected) throw new Error('No Zürich HB → Chur service found in the snapshot')

  const route = []
  for (let index = selected.fromIndex; index < selected.toIndex; index += 1) {
    const fromStop = network.stops[selected.train.stops[index][0]]
    const toStop = network.stops[selected.train.stops[index + 1][0]]
    const pathIndex = selected.train.pathSegments?.[index]
    const sourcePoints =
      pathIndex === null || pathIndex === undefined
        ? [fromStop.slice(0, 2), toStop.slice(0, 2)]
        : (network.paths?.[pathIndex] ?? [fromStop.slice(0, 2), toStop.slice(0, 2)])
    const points = orientedSegment(sourcePoints, fromStop)
    route.push(...(route.length ? points.slice(1) : points))
  }

  return {
    train: selected.train,
    fromIndex: selected.fromIndex,
    toIndex: selected.toIndex,
    points: route,
  }
}

function sampleGrid(terrain, easting, northing) {
  const x =
    ((easting - terrain.bounds.minEasting) /
      (terrain.bounds.maxEasting - terrain.bounds.minEasting)) *
    (terrain.columns - 1)
  const y =
    ((terrain.bounds.maxNorthing - northing) /
      (terrain.bounds.maxNorthing - terrain.bounds.minNorthing)) *
    (terrain.rows - 1)
  const x0 = Math.max(0, Math.min(terrain.columns - 1, Math.floor(x)))
  const y0 = Math.max(0, Math.min(terrain.rows - 1, Math.floor(y)))
  const x1 = Math.min(terrain.columns - 1, x0 + 1)
  const y1 = Math.min(terrain.rows - 1, y0 + 1)
  const tx = Math.max(0, Math.min(1, x - x0))
  const ty = Math.max(0, Math.min(1, y - y0))
  const value = (column, row) => terrain.elevations[row * terrain.columns + column]
  const top = value(x0, y0) * (1 - tx) + value(x1, y0) * tx
  const bottom = value(x0, y1) * (1 - tx) + value(x1, y1) * tx
  return top * (1 - ty) + bottom * ty
}

function cumulativeDistances(points) {
  const distances = [0]
  for (let index = 1; index < points.length; index += 1) {
    distances.push(
      distances[index - 1] + Math.hypot(
        points[index][0] - points[index - 1][0],
        points[index][1] - points[index - 1][1],
      ),
    )
  }
  return distances
}

export function matchSbbTunnels(routePoints, tunnels) {
  const distances = cumulativeDistances(routePoints)
  const totalDistance = distances.at(-1) ?? 0
  const corridorLines = new Set(['722', '890'])
  return tunnels.flatMap((tunnel) => {
    if (
      !corridorLines.has(String(tunnel.linie)) ||
      !tunnel.geopos ||
      !Number.isFinite(tunnel.lange_bahntunnel)
    ) {
      return []
    }
    const coordinate = wgs84ToLv95(tunnel.geopos.lon, tunnel.geopos.lat)
    let closestIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < routePoints.length; index += 1) {
      const distance = squaredDistance(routePoints[index], coordinate)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    }
    if (Math.sqrt(closestDistance) > 700 || totalDistance <= 0) return []
    const startDistance = distances[closestIndex]
    const endDistance = Math.min(
      totalDistance,
      startDistance + tunnel.lange_bahntunnel,
    )
    return [{
      id: tunnel.uuid,
      name: tunnel.name,
      lengthMetres: Math.round(tunnel.lange_bahntunnel),
      line: String(tunnel.linie),
      startProgress: Number((startDistance / totalDistance).toFixed(5)),
      endProgress: Number((endDistance / totalDistance).toFixed(5)),
    }]
  }).sort((first, second) => first.startProgress - second.startProgress)
}

function stopProgresses(routePoints, stopCoordinates) {
  const distances = cumulativeDistances(routePoints)
  let minimumIndex = 0
  return stopCoordinates.map((coordinate) => {
    let closestIndex = minimumIndex
    let closestDistance = Number.POSITIVE_INFINITY
    for (let index = minimumIndex; index < routePoints.length; index += 1) {
      const distance = squaredDistance(routePoints[index], coordinate)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    }
    minimumIndex = closestIndex
    return distances.at(-1) ? distances[closestIndex] / distances.at(-1) : 0
  })
}

function overlapsBounds(points, bounds) {
  const eastings = points.map(([easting]) => easting)
  const northings = points.map(([, northing]) => northing)
  return !(
    Math.max(...eastings) < bounds.minEasting ||
    Math.min(...eastings) > bounds.maxEasting ||
    Math.max(...northings) < bounds.minNorthing ||
    Math.min(...northings) > bounds.maxNorthing
  )
}

export function buildCorridorArtifact({
  network,
  lakes,
  raster,
  routeProfile,
  releaseDate,
  sourceUrl,
  tunnels = [],
}) {
  const route = corridorRoute(network)
  const routeLv95 = routeProfile.map(({ easting, northing }) => [easting, northing])
  const centreEasting = (raster.bounds.minEasting + raster.bounds.maxEasting) / 2
  const centreNorthing = (raster.bounds.minNorthing + raster.bounds.maxNorthing) / 2
  const localPoint = ([easting, northing]) => [
    Math.round(easting - centreEasting),
    Math.round(centreNorthing - northing),
  ]
  const stopRecords = route.train.stops.slice(route.fromIndex, route.toIndex + 1)
  const stopCoordinates = stopRecords.map(([stopIndex]) => {
    const [longitude, latitude] = network.stops[stopIndex]
    return wgs84ToLv95(longitude, latitude)
  })
  const progresses = stopProgresses(routeLv95, stopCoordinates)
  const routeDistances = cumulativeDistances(routeLv95)
  const terrain = {
    ...raster,
    elevations: raster.elevations.map((value) => Math.round(value)),
  }

  const corridorLakes = lakes.lakes.flatMap((lake) =>
    lake.polygons.flatMap((polygon, polygonIndex) => {
      const lv95Rings = polygon.map((ring) =>
        ring.map(([longitude, latitude]) => wgs84ToLv95(longitude, latitude)),
      )
      const outer = lv95Rings[0]
      if (!outer?.length || !overlapsBounds(outer, raster.bounds)) return []
      const sample = outer[Math.floor(outer.length / 2)]
      return [{
        id: `${lake.name}-${polygonIndex}`,
        name: lake.name,
        elevation: Math.round(sampleGrid(terrain, sample[0], sample[1])),
        rings: lv95Rings.map((ring) => ring.map(localPoint)),
      }]
    }),
  )

  return {
    id: 'zurich-chur',
    metadata: {
      source: 'swissALTIRegio',
      releaseDate,
      sourceUrl,
      productUrl: PRODUCT_URL,
      attribution: ATTRIBUTION,
      sourceCrs: 'EPSG:2056',
      model: '10 m federal terrain sampled offline to a corridor-level low-poly grid',
      railSource: network.metadata.geometry,
      profileSourceUrl: PROFILE_URL,
      tunnelSource: 'SBB Infrastruktur open data',
      tunnelSourceUrl: SBB_TUNNEL_API,
      tunnelProductUrl: SBB_TUNNEL_PRODUCT_URL,
    },
    origin: {
      easting: Math.round(centreEasting),
      northing: Math.round(centreNorthing),
    },
    terrain: {
      columns: terrain.columns,
      rows: terrain.rows,
      widthMetres: raster.bounds.maxEasting - raster.bounds.minEasting,
      depthMetres: raster.bounds.maxNorthing - raster.bounds.minNorthing,
      minElevation: Math.round(Math.min(...terrain.elevations)),
      maxElevation: Math.round(Math.max(...terrain.elevations)),
      elevations: terrain.elevations,
    },
    route: {
      service: route.train.route,
      destination: 'Chur',
      operator: 'SBB CFF FFS',
      representativeTrain: route.train.shortName,
      distanceMetres: Math.round(routeDistances.at(-1)),
      points: routeLv95.map(([easting, northing], index) => [
        ...localPoint([easting, northing]),
        Math.round(routeProfile[index].elevation),
      ]),
      stops: stopRecords.map(([stopIndex, , departure], index) => ({
        name: network.stops[stopIndex][2],
        progress: Number(progresses[index].toFixed(5)),
        departure,
      })),
      tunnels: matchSbbTunnels(routeLv95, tunnels),
    },
    lakes: corridorLakes,
  }
}

async function fetchSbbTunnels() {
  const records = []
  let offset = 0
  while (true) {
    const url = new URL(SBB_TUNNEL_API)
    url.searchParams.set('limit', '100')
    url.searchParams.set('offset', String(offset))
    const response = await fetch(url)
    if (!response.ok) throw new Error(`SBB tunnel API returned ${response.status}`)
    const payload = await response.json()
    records.push(...payload.results)
    offset += payload.results.length
    if (offset >= payload.total_count || payload.results.length === 0) break
  }
  return records
}

async function fetchRouteProfile(routeLv95) {
  const url = new URL(PROFILE_URL)
  const compactRoute = routeLv95.map(([easting, northing]) => [
    Math.round(easting),
    Math.round(northing),
  ])
  url.searchParams.set(
    'geom',
    JSON.stringify({ type: 'LineString', coordinates: compactRoute }),
  )
  url.searchParams.set('sr', '2056')
  url.searchParams.set('nb_points', String(routeLv95.length))
  url.searchParams.set('distinct_points', 'true')
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `swisstopo elevation profile returned ${response.status}: ${await response.text()}`,
    )
  }
  const records = await response.json()
  if (!Array.isArray(records) || records.length < 2) {
    throw new Error('swisstopo elevation profile returned no usable points')
  }
  return records.map((record) => {
    const elevation = record.alts?.COMB ?? record.alts?.DTM2 ?? record.alts?.DTM25
    if (![record.easting, record.northing, elevation].every(Number.isFinite)) {
      throw new Error('swisstopo elevation profile contains an invalid point')
    }
    return {
      easting: record.easting,
      northing: record.northing,
      elevation,
    }
  })
}

async function main() {
  const networkPath = resolve(ROOT, process.env.GLEISLICHT_NETWORK ?? DEFAULT_NETWORK)
  const lakesPath = resolve(ROOT, process.env.GLEISLICHT_LAKES ?? DEFAULT_LAKES)
  const outputPath = resolve(ROOT, process.env.GLEISLICHT_OUTPUT ?? DEFAULT_OUTPUT)
  const [network, lakes, itemResponse, tunnels] = await Promise.all([
    readFile(networkPath, 'utf8').then(JSON.parse),
    readFile(lakesPath, 'utf8').then(JSON.parse),
    fetch(STAC_ITEM_URL),
    fetchSbbTunnels(),
  ])
  if (!itemResponse.ok) throw new Error(`swissALTIRegio STAC returned ${itemResponse.status}`)
  const item = await itemResponse.json()
  const asset = Object.values(item.assets).find(
    (candidate) =>
      candidate['geoadmin:variant'] === 'fullcoverage' &&
      candidate.type?.includes('geotiff'),
  )
  if (!asset) throw new Error('No full-coverage swissALTIRegio COG asset found')

  const route = corridorRoute(network)
  const coordinates = route.points.map(([longitude, latitude]) =>
    wgs84ToLv95(longitude, latitude),
  )
  const margin = 9000
  const bounds = {
    minEasting: Math.floor((Math.min(...coordinates.map(([x]) => x)) - margin) / 1000) * 1000,
    minNorthing:
      Math.floor((Math.min(...coordinates.map(([, y]) => y)) - margin) / 1000) * 1000,
    maxEasting: Math.ceil((Math.max(...coordinates.map(([x]) => x)) + margin) / 1000) * 1000,
    maxNorthing:
      Math.ceil((Math.max(...coordinates.map(([, y]) => y)) + margin) / 1000) * 1000,
  }
  const columns = 241
  const rows = Math.max(
    96,
    Math.round(
      columns *
        ((bounds.maxNorthing - bounds.minNorthing) /
          (bounds.maxEasting - bounds.minEasting)),
    ),
  )
  const tiff = await fromUrl(asset.href)
  const [raster, routeProfile] = await Promise.all([
    tiff.readRasters({
      bbox: [bounds.minEasting, bounds.minNorthing, bounds.maxEasting, bounds.maxNorthing],
      width: columns,
      height: rows,
      samples: [0],
      interleave: true,
      resampleMethod: 'bilinear',
    }),
    fetchRouteProfile(coordinates),
  ])
  const artifact = buildCorridorArtifact({
    network,
    lakes,
    routeProfile,
    raster: {
      bounds,
      columns: raster.width,
      rows: raster.height,
      elevations: [...raster],
    },
    releaseDate: item.properties.datetime.slice(0, 10),
    sourceUrl: asset.href,
    tunnels,
  })
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(artifact)}\n`)
  console.log(
    `Wrote ${outputPath} (${artifact.terrain.columns}×${artifact.terrain.rows}, ${artifact.route.points.length} profiled rail points, ${artifact.route.tunnels.length} tunnels, ${artifact.lakes.length} lake polygons)`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
