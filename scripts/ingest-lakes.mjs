import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'

const DEFAULT_OUTPUT = 'public/data/swiss-lakes.json'
const LAYER_ID = 'ch.bafu.vec25-seen'
const PRODUCT_URL = 'https://www.bafu.admin.ch/en/the-swiss-hydrographic-network'
const SOURCE_URL = new URL(
  'https://api3.geo.admin.ch/rest/services/ech/MapServer/identify',
)

for (const [name, value] of Object.entries({
  geometryType: 'esriGeometryEnvelope',
  geometry: '5.7,45.7,10.7,48.0',
  geometryFormat: 'geojson',
  imageDisplay: '1600,900,96',
  mapExtent: '5.7,45.7,10.7,48.0',
  tolerance: '0',
  layers: `all:${LAYER_ID}`,
  returnGeometry: 'true',
  limit: '200',
  sr: '4326',
})) {
  SOURCE_URL.searchParams.set(name, value)
}

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function squareSegmentDistanceMetres(point, first, second) {
  const latitude = ((point[1] + first[1] + second[1]) / 3) * (Math.PI / 180)
  const longitudeScale = Math.cos(latitude)
  const scale = 111_320
  const pointX = point[0] * longitudeScale * scale
  const pointY = point[1] * scale
  let firstX = first[0] * longitudeScale * scale
  let firstY = first[1] * scale
  const deltaX = (second[0] - first[0]) * longitudeScale * scale
  const deltaY = (second[1] - first[1]) * scale

  if (deltaX !== 0 || deltaY !== 0) {
    const progress =
      ((pointX - firstX) * deltaX + (pointY - firstY) * deltaY) /
      (deltaX * deltaX + deltaY * deltaY)
    if (progress > 1) {
      firstX += deltaX
      firstY += deltaY
    } else if (progress > 0) {
      firstX += deltaX * progress
      firstY += deltaY * progress
    }
  }

  return (pointX - firstX) ** 2 + (pointY - firstY) ** 2
}

function simplifyPath(points, toleranceSquared) {
  if (points.length <= 2) return points
  const first = points[0]
  const last = points.at(-1)
  let greatestDistance = toleranceSquared
  let splitIndex = 0

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = squareSegmentDistanceMetres(points[index], first, last)
    if (distance <= greatestDistance) continue
    greatestDistance = distance
    splitIndex = index
  }

  if (!splitIndex) return [first, last]
  const before = simplifyPath(points.slice(0, splitIndex + 1), toleranceSquared)
  const after = simplifyPath(points.slice(splitIndex), toleranceSquared)
  return [...before.slice(0, -1), ...after]
}

function squareDistance(first, second) {
  return (first[0] - second[0]) ** 2 + (first[1] - second[1]) ** 2
}

export function simplifyRing(points, toleranceMetres) {
  const open = squareDistance(points[0], points.at(-1)) < 1e-16
    ? points.slice(0, -1)
    : points
  if (open.length < 4) return []
  let startIndex = 0
  for (let index = 1; index < open.length; index += 1) {
    if (open[index][0] < open[startIndex][0]) startIndex = index
  }
  const rotated = [...open.slice(startIndex), ...open.slice(0, startIndex)]
  let oppositeIndex = 1
  for (let index = 2; index < rotated.length; index += 1) {
    if (
      squareDistance(rotated[0], rotated[index]) >
      squareDistance(rotated[0], rotated[oppositeIndex])
    ) {
      oppositeIndex = index
    }
  }
  const toleranceSquared = toleranceMetres * toleranceMetres
  const firstHalf = simplifyPath(
    rotated.slice(0, oppositeIndex + 1),
    toleranceSquared,
  )
  const secondHalf = simplifyPath(
    [...rotated.slice(oppositeIndex), rotated[0]],
    toleranceSquared,
  )
  const simplified = [...firstHalf.slice(0, -1), ...secondHalf]
  if (simplified.length < 4) return []
  return simplified.map(([longitude, latitude]) => [
    Number(longitude.toFixed(5)),
    Number(latitude.toFixed(5)),
  ])
}

function polygonsForGeometry(geometry) {
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates
  if (geometry?.type === 'Polygon') return [geometry.coordinates]
  return []
}

export function buildLakeArtifact(
  response,
  { toleranceMetres = 60, minimumAreaSquareKilometres = 0.1 } = {},
) {
  if (response.results?.length >= 200) {
    throw new Error('Lake query reached its 200-feature limit; the artifact may be incomplete')
  }
  const lakes = (response.results ?? [])
    .map((result) => {
      const areaSquareKilometres = Number(
        result.properties?.seeflaeche_km2 ?? 0,
      )
      const polygons = polygonsForGeometry(result.geometry)
        .map((polygon) =>
          polygon
            .map((ring) => simplifyRing(ring, toleranceMetres))
            .filter((ring) => ring.length >= 4),
        )
        .filter((polygon) => polygon.length)
      return {
        id: String(result.id),
        name: result.properties?.name || `Lake ${result.id}`,
        areaSquareKilometres,
        polygons,
      }
    })
    .filter(
      (lake) =>
        lake.areaSquareKilometres >= minimumAreaSquareKilometres &&
        lake.polygons.length,
    )
    .sort(
      (first, second) =>
        second.areaSquareKilometres - first.areaSquareKilometres ||
        first.name.localeCompare(second.name),
    )

  return {
    metadata: {
      source: 'FOEN Vector25 lakes',
      sourceUrl: SOURCE_URL.toString(),
      productUrl: PRODUCT_URL,
      edition: 'Vector25 reference network (2007)',
      attribution: '© FOEN, swisstopo',
      sourceCrs: 'EPSG:4326',
      outputCrs: 'EPSG:4326',
      simplificationToleranceMetres: toleranceMetres,
      minimumAreaSquareKilometres,
    },
    lakes,
  }
}

async function readSource(source) {
  if (source) return JSON.parse(await readFile(resolve(source), 'utf8'))
  const response = await fetch(SOURCE_URL)
  if (!response.ok) throw new Error(`Lake source returned ${response.status}`)
  return response.json()
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: npm run data:lakes -- [--source /path/identify.json] ' +
        '[--output public/data/swiss-lakes.json] [--tolerance 60] [--min-area 0.1]',
    )
    return
  }
  const output = resolve(argument('output', DEFAULT_OUTPUT))
  const toleranceMetres = Number(argument('tolerance', '60'))
  const minimumAreaSquareKilometres = Number(argument('min-area', '0.1'))
  const source = await readSource(argument('source'))
  const artifact = buildLakeArtifact(source, {
    toleranceMetres,
    minimumAreaSquareKilometres,
  })
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(artifact)}\n`)
  const pointCount = artifact.lakes.reduce(
    (total, lake) =>
      total +
      lake.polygons.reduce(
        (polygonTotal, polygon) =>
          polygonTotal +
          polygon.reduce((ringTotal, ring) => ringTotal + ring.length, 0),
        0,
      ),
    0,
  )
  console.log(
    `Wrote ${artifact.lakes.length} lake features and ${pointCount} points to ${output}`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
