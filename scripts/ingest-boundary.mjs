import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const DEFAULT_OUTPUT = 'public/data/swiss-boundary.json'
const SOURCE_URL =
  'https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip'
const PRODUCT_URL =
  'https://www.swisstopo.admin.ch/en/landscape-model-swissboundaries3d'

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function requiredArgument(name) {
  const value = argument(name)
  if (!value) throw new Error(`Missing --${name}`)
  return value
}

function readGeometryBlob(geopackage) {
  const hex = execFileSync(
    'sqlite3',
    [geopackage, "select hex(geom) from tlm_landesgebiet where icc='CH';"],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  ).trim()
  if (!hex) throw new Error('The GeoPackage contains no CH national area')
  return Buffer.from(hex, 'hex')
}

function geometryOffset(blob) {
  if (blob.toString('ascii', 0, 2) !== 'GP') {
    throw new Error('Expected a GeoPackage geometry header')
  }
  const flags = blob.readUInt8(3)
  const envelopeCode = (flags >> 1) & 0b111
  const envelopeBytes = [0, 32, 48, 48, 64][envelopeCode]
  if (envelopeBytes === undefined) throw new Error('Unsupported GeoPackage envelope')
  return 8 + envelopeBytes
}

function wkbType(rawType) {
  const dimensionalType = rawType & 0x0fffffff
  if (dimensionalType >= 3000) return { base: dimensionalType - 3000, dimensions: 4 }
  if (dimensionalType >= 2000) return { base: dimensionalType - 2000, dimensions: 3 }
  if (dimensionalType >= 1000) return { base: dimensionalType - 1000, dimensions: 3 }
  return { base: dimensionalType, dimensions: 2 }
}

function reader(blob, initialOffset) {
  let offset = initialOffset

  function header(expectedType) {
    const littleEndian = blob.readUInt8(offset) === 1
    offset += 1
    const rawType = littleEndian
      ? blob.readUInt32LE(offset)
      : blob.readUInt32BE(offset)
    offset += 4
    const type = wkbType(rawType)
    if (type.base !== expectedType) {
      throw new Error(`Expected WKB type ${expectedType}, received ${type.base}`)
    }
    return { littleEndian, dimensions: type.dimensions }
  }

  function integer(littleEndian) {
    const value = littleEndian
      ? blob.readUInt32LE(offset)
      : blob.readUInt32BE(offset)
    offset += 4
    return value
  }

  function coordinate(littleEndian, dimensions) {
    const values = []
    for (let dimension = 0; dimension < dimensions; dimension += 1) {
      values.push(
        littleEndian ? blob.readDoubleLE(offset) : blob.readDoubleBE(offset),
      )
      offset += 8
    }
    return [values[0], values[1]]
  }

  function polygon() {
    const { littleEndian, dimensions } = header(3)
    const ringCount = integer(littleEndian)
    const rings = []
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
      const pointCount = integer(littleEndian)
      const points = []
      for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
        points.push(coordinate(littleEndian, dimensions))
      }
      rings.push(points)
    }
    return rings
  }

  function multiPolygon() {
    const { littleEndian } = header(6)
    const polygonCount = integer(littleEndian)
    const rings = []
    for (let index = 0; index < polygonCount; index += 1) rings.push(...polygon())
    return rings
  }

  return { multiPolygon }
}

function squareDistance(first, second) {
  const east = first[0] - second[0]
  const north = first[1] - second[1]
  return east * east + north * north
}

function squareSegmentDistance(point, first, second) {
  let east = first[0]
  let north = first[1]
  const deltaEast = second[0] - east
  const deltaNorth = second[1] - north

  if (deltaEast !== 0 || deltaNorth !== 0) {
    const progress =
      ((point[0] - east) * deltaEast + (point[1] - north) * deltaNorth) /
      (deltaEast * deltaEast + deltaNorth * deltaNorth)
    if (progress > 1) {
      east = second[0]
      north = second[1]
    } else if (progress > 0) {
      east += deltaEast * progress
      north += deltaNorth * progress
    }
  }

  const offsetEast = point[0] - east
  const offsetNorth = point[1] - north
  return offsetEast * offsetEast + offsetNorth * offsetNorth
}

function simplifyPath(points, toleranceSquared) {
  if (points.length <= 2) return points
  const first = points[0]
  const last = points.at(-1)
  let greatestDistance = toleranceSquared
  let splitIndex = 0

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = squareSegmentDistance(points[index], first, last)
    if (distance <= greatestDistance) continue
    splitIndex = index
    greatestDistance = distance
  }

  if (!splitIndex) return [first, last]
  const before = simplifyPath(points.slice(0, splitIndex + 1), toleranceSquared)
  const after = simplifyPath(points.slice(splitIndex), toleranceSquared)
  return [...before.slice(0, -1), ...after]
}

function simplifyRing(points, tolerance) {
  const open = squareDistance(points[0], points.at(-1)) < 0.01
    ? points.slice(0, -1)
    : points
  if (open.length <= 4) return [...open, open[0]]

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
  const toleranceSquared = tolerance * tolerance
  const firstHalf = simplifyPath(
    rotated.slice(0, oppositeIndex + 1),
    toleranceSquared,
  )
  const secondHalf = simplifyPath(
    [...rotated.slice(oppositeIndex), ...rotated.slice(0, 1)],
    toleranceSquared,
  )
  return [...firstHalf.slice(0, -1), ...secondHalf]
}

function lv95ToWgs84([east, north]) {
  const y = (east - 2_600_000) / 1_000_000
  const x = (north - 1_200_000) / 1_000_000
  const longitudeSeconds =
    2.6779094 +
    4.728982 * y +
    0.791484 * y * x +
    0.1306 * y * x * x -
    0.0436 * y * y * y
  const latitudeSeconds =
    16.9023892 +
    3.238272 * x -
    0.270978 * y * y -
    0.002528 * x * x -
    0.0447 * y * y * x -
    0.014 * x * x * x
  return [
    Number((longitudeSeconds * 100 / 36).toFixed(5)),
    Number((latitudeSeconds * 100 / 36).toFixed(5)),
  ]
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: npm run data:boundary -- --source <swissBOUNDARIES3D.gpkg>')
    return
  }
  const source = resolve(requiredArgument('source'))
  const output = resolve(argument('output', DEFAULT_OUTPUT))
  const tolerance = Number(argument('tolerance', '700'))
  const blob = readGeometryBlob(source)
  const rings = reader(blob, geometryOffset(blob))
    .multiPolygon()
    .map((ring) => simplifyRing(ring, tolerance).map(lv95ToWgs84))

  const artifact = {
    metadata: {
      source: 'swissBOUNDARIES3D',
      sourceUrl: SOURCE_URL,
      productUrl: PRODUCT_URL,
      edition: '2026-01',
      attribution: '© swisstopo',
      sourceCrs: 'EPSG:2056',
      outputCrs: 'EPSG:4326',
      simplificationToleranceMetres: tolerance,
    },
    rings,
  }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(artifact)}\n`)
  console.log(
    `Wrote ${rings.length} rings and ${rings.reduce((sum, ring) => sum + ring.length, 0)} points to ${output}`,
  )
}

await main()
