import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromUrl } from 'geotiff'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = resolve(ROOT, 'public/data/kiental-postbus-day-manifest.json')
const OUTPUT_PATH = resolve(ROOT, 'public/data/kiental-griesalp-corridor.json')
const STAC_URL =
  'https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissalti3d/items'
const TERRAIN_PRODUCT_URL = 'https://www.swisstopo.admin.ch/en/height-model-swissalti3d'
const ROUTING_URL = 'https://routing.openstreetmap.de/routed-car/route/v1/driving/'

function distanceSquared([firstX, firstY], [secondX, secondY]) {
  return (firstX - secondX) ** 2 + (firstY - secondY) ** 2
}

function pointSegmentDistanceSquared(point, start, end) {
  const length = distanceSquared(start, end)
  if (length === 0) return distanceSquared(point, start)
  const amount = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * (end[0] - start[0]) +
        (point[1] - start[1]) * (end[1] - start[1])) /
        length,
    ),
  )
  return distanceSquared(point, [
    start[0] + amount * (end[0] - start[0]),
    start[1] + amount * (end[1] - start[1]),
  ])
}

function simplifyLine(points, tolerance = 7) {
  if (points.length <= 2) return points
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()
    let furthest = -1
    let furthestDistance = tolerance ** 2
    for (let index = start + 1; index < end; index += 1) {
      const distance = pointSegmentDistanceSquared(points[index], points[start], points[end])
      if (distance > furthestDistance) {
        furthest = index
        furthestDistance = distance
      }
    }
    if (furthest >= 0) {
      keep[furthest] = 1
      stack.push([start, furthest], [furthest, end])
    }
  }
  return points.filter((_, index) => keep[index])
}

function cumulativeDistances(points) {
  const values = [0]
  for (let index = 1; index < points.length; index += 1) {
    values.push(values[index - 1] + Math.hypot(
      points[index][0] - points[index - 1][0],
      points[index][1] - points[index - 1][1],
    ))
  }
  return values
}

function stopProgresses(routePoints, stopCoordinates) {
  const distances = cumulativeDistances(routePoints)
  let minimumIndex = 0
  return stopCoordinates.map((coordinate) => {
    let closestIndex = minimumIndex
    let closestDistance = Number.POSITIVE_INFINITY
    for (let index = minimumIndex; index < routePoints.length; index += 1) {
      const distance = distanceSquared(routePoints[index], coordinate)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    }
    minimumIndex = closestIndex
    return distances.at(-1) ? distances[closestIndex] / distances.at(-1) : 0
  })
}

async function selectedRun(manifest) {
  for (const chunk of manifest.chunks) {
    if (!chunk.tripCount) continue
    const snapshot = JSON.parse(
      await readFile(resolve(dirname(MANIFEST_PATH), chunk.path), 'utf8'),
    )
    const train = snapshot.trains.find(
      (candidate) =>
        candidate.route === '220' &&
        candidate.headsign === 'Griesalp, Kurhaus' &&
        candidate.stops.length >= 19,
    )
    if (train) return train
  }
  throw new Error('No complete PostBus 220 run to Griesalp was found')
}

async function roadRoute(stopCoordinates) {
  const waypoints = stopCoordinates
    .map(([longitude, latitude]) => `${longitude},${latitude}`)
    .join(';')
  const url = new URL(`${ROUTING_URL}${waypoints}`)
  url.searchParams.set('overview', 'full')
  url.searchParams.set('geometries', 'geojson')
  url.searchParams.set('steps', 'false')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`OpenStreetMap routing returned ${response.status}`)
  const payload = await response.json()
  const coordinates = payload.routes?.[0]?.geometry?.coordinates
  if (!Array.isArray(coordinates) || coordinates.length < stopCoordinates.length) {
    throw new Error('OpenStreetMap routing returned no usable road geometry')
  }
  return {
    distance: payload.routes[0].distance,
    coordinates,
    sourceUrl: url.toString(),
  }
}

async function stacItems(boundsWgs84) {
  const url = new URL(STAC_URL)
  url.searchParams.set('bbox', boundsWgs84.join(','))
  url.searchParams.set('limit', '100')
  const items = []
  let nextUrl = url.toString()
  while (nextUrl) {
    const response = await fetch(nextUrl)
    if (!response.ok) throw new Error(`swissALTI3D STAC returned ${response.status}`)
    const payload = await response.json()
    items.push(...payload.features)
    nextUrl = payload.links?.find((link) => link.rel === 'next')?.href
  }
  return items
}

function tileCoordinates(item) {
  const match = item.id.match(/_(\d{4})-(\d{4})$/)
  if (!match) return undefined
  return [Number(match[1]) * 1000, Number(match[2]) * 1000]
}

function terrainAsset(item) {
  return Object.values(item.assets).find(
    (asset) => asset.gsd === 2 && asset.type?.includes('geotiff'),
  )
}

function tileIntersectsBounds(item, bounds) {
  const origin = tileCoordinates(item)
  if (!origin) return false
  return !(
    origin[0] + 1000 <= bounds.minEasting ||
    origin[0] >= bounds.maxEasting ||
    origin[1] + 1000 <= bounds.minNorthing ||
    origin[1] >= bounds.maxNorthing
  )
}

function latestItemsByTile(items) {
  const latest = new Map()
  for (const item of items) {
    const origin = tileCoordinates(item)
    if (!origin) continue
    const key = origin.join('-')
    const current = latest.get(key)
    if (!current || current.properties.datetime < item.properties.datetime) {
      latest.set(key, item)
    }
  }
  return [...latest.values()]
}

async function readTerrainTile(item, xs, ys, elevations, columns) {
  const origin = tileCoordinates(item)
  const asset = terrainAsset(item)
  if (!origin || !asset) return
  const [minEasting, minNorthing] = origin
  const columnIndexes = xs.flatMap((value, index) =>
    value >= minEasting && value < minEasting + 1000 ? [index] : [],
  )
  const rowIndexes = ys.flatMap((value, index) =>
    value >= minNorthing && value < minNorthing + 1000 ? [index] : [],
  )
  if (!columnIndexes.length || !rowIndexes.length) return
  const minX = xs[columnIndexes[0]]
  const maxX = xs[columnIndexes.at(-1)]
  const maxY = ys[rowIndexes[0]]
  const minY = ys[rowIndexes.at(-1)]
  const tiff = await fromUrl(asset.href)
  const raster = await tiff.readRasters({
    bbox: [minX - 1, minY - 1, maxX + 1, maxY + 1],
    width: columnIndexes.length,
    height: rowIndexes.length,
    samples: [0],
    interleave: true,
    resampleMethod: 'bilinear',
  })
  rowIndexes.forEach((row, localRow) => {
    columnIndexes.forEach((column, localColumn) => {
      elevations[row * columns + column] = raster[localRow * columnIndexes.length + localColumn]
    })
  })
}

async function parallelMap(values, concurrency, callback) {
  let next = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < values.length) {
        const index = next
        next += 1
        await callback(values[index], index)
      }
    }),
  )
}

function sampleTerrain(terrain, easting, northing) {
  const x =
    ((easting - terrain.bounds.minEasting) /
      (terrain.bounds.maxEasting - terrain.bounds.minEasting)) *
    (terrain.columns - 1)
  const y =
    ((terrain.bounds.maxNorthing - northing) /
      (terrain.bounds.maxNorthing - terrain.bounds.minNorthing)) *
    (terrain.rows - 1)
  const column = Math.max(0, Math.min(terrain.columns - 1, Math.round(x)))
  const row = Math.max(0, Math.min(terrain.rows - 1, Math.round(y)))
  return terrain.elevations[row * terrain.columns + column]
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
  const train = await selectedRun(manifest)
  const stopCoordinates = train.stops.map(([stopIndex]) => manifest.stops[stopIndex].slice(0, 2))
  const road = await roadRoute(stopCoordinates)
  const roadLv95 = simplifyLine(road.coordinates.map(([longitude, latitude]) =>
    wgs84ToLv95(longitude, latitude),
  ))
  const stopLv95 = stopCoordinates.map(([longitude, latitude]) =>
    wgs84ToLv95(longitude, latitude),
  )
  const margin = 1200
  const bounds = {
    minEasting: Math.floor((Math.min(...roadLv95.map(([x]) => x)) - margin) / 100) * 100,
    minNorthing: Math.floor((Math.min(...roadLv95.map(([, y]) => y)) - margin) / 100) * 100,
    maxEasting: Math.ceil((Math.max(...roadLv95.map(([x]) => x)) + margin) / 100) * 100,
    maxNorthing: Math.ceil((Math.max(...roadLv95.map(([, y]) => y)) + margin) / 100) * 100,
  }
  const columns = 257
  const rows = Math.max(257, Math.round(
    columns * (bounds.maxNorthing - bounds.minNorthing) /
      (bounds.maxEasting - bounds.minEasting),
  ))
  const xs = Array.from({ length: columns }, (_, index) =>
    bounds.minEasting + index * (bounds.maxEasting - bounds.minEasting) / (columns - 1),
  )
  const ys = Array.from({ length: rows }, (_, index) =>
    bounds.maxNorthing - index * (bounds.maxNorthing - bounds.minNorthing) / (rows - 1),
  )
  const longitudeValues = road.coordinates.map(([longitude]) => longitude)
  const latitudeValues = road.coordinates.map(([, latitude]) => latitude)
  const degreeMargin = 0.025
  const items = await stacItems([
    Math.min(...longitudeValues) - degreeMargin,
    Math.min(...latitudeValues) - degreeMargin,
    Math.max(...longitudeValues) + degreeMargin,
    Math.max(...latitudeValues) + degreeMargin,
  ])
  const elevations = new Float32Array(columns * rows)
  elevations.fill(Number.NaN)
  const terrainItems = latestItemsByTile(items).filter((item) =>
    tileIntersectsBounds(item, bounds),
  )
  await parallelMap(terrainItems, 6, (item) =>
    readTerrainTile(item, xs, ys, elevations, columns),
  )
  const missing = elevations.reduce((count, value) => count + Number(!Number.isFinite(value)), 0)
  if (missing) throw new Error(`swissALTI3D mosaic has ${missing} missing cells`)

  const terrain = { bounds, columns, rows, elevations }
  const centreEasting = (bounds.minEasting + bounds.maxEasting) / 2
  const centreNorthing = (bounds.minNorthing + bounds.maxNorthing) / 2
  const localPoint = ([easting, northing]) => [
    Math.round(easting - centreEasting),
    Math.round(centreNorthing - northing),
  ]
  const progresses = stopProgresses(roadLv95, stopLv95)
  const releaseYears = [...new Set(terrainItems.map((item) => item.properties.datetime.slice(0, 4)))].sort()
  const artifact = {
    id: 'kiental-griesalp',
    metadata: {
      source: 'swissALTI3D',
      releaseDate: releaseYears.join('–'),
      sourceUrl: STAC_URL,
      productUrl: TERRAIN_PRODUCT_URL,
      attribution: 'Federal Office of Topography swisstopo',
      sourceCrs: 'EPSG:2056',
      model: '2 m federal terrain sampled offline to a corridor-level low-poly grid',
      railSource: manifest.metadata,
      profileSourceUrl: road.sourceUrl,
      routeSource: 'OpenStreetMap road geometry via OSRM',
      routeAttribution: '© OpenStreetMap contributors, ODbL',
      routeProductUrl: 'https://www.openstreetmap.org/copyright',
    },
    origin: {
      easting: Math.round(centreEasting),
      northing: Math.round(centreNorthing),
    },
    terrain: {
      columns,
      rows,
      widthMetres: bounds.maxEasting - bounds.minEasting,
      depthMetres: bounds.maxNorthing - bounds.minNorthing,
      minElevation: Math.round(Math.min(...elevations)),
      maxElevation: Math.round(Math.max(...elevations)),
      elevations: [...elevations].map(Math.round),
    },
    route: {
      service: train.route,
      destination: train.headsign,
      operator: 'PostAuto',
      representativeTrain: train.shortName,
      distanceMetres: Math.round(road.distance),
      points: roadLv95.map(([easting, northing]) => [
        ...localPoint([easting, northing]),
        Math.round(sampleTerrain(terrain, easting, northing)),
      ]),
      stops: train.stops.map(([stopIndex, , departure], index) => ({
        name: manifest.stops[stopIndex][2],
        progress: Number(progresses[index].toFixed(5)),
        departure,
      })),
    },
    lakes: [],
  }
  const outputPath = resolve(ROOT, process.env.GLEISLICHT_OUTPUT ?? OUTPUT_PATH)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(artifact)}\n`)
  console.log(
    `Wrote ${outputPath} (${columns}×${rows}, ${roadLv95.length} road points, ${terrainItems.length} swissALTI3D tiles)`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
