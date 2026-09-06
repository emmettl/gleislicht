#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_OUTPUT = 'fixtures/idfm/correspondances-geography.json'
const BOUNDARY_URL =
  'https://geo.api.gouv.fr/communes/75056?format=geojson&geometry=contour'
const WATER_URL =
  'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/plan-de-voirie-voies-deau/records?select=objectid,lib_classe,geo_shape&limit=100'
const WATER_PRODUCT_URL =
  'https://opendata.paris.fr/explore/dataset/plan-de-voirie-voies-deau/'
const PERIPHERIQUE_URL =
  'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/voie/records?select=l_longmin,l_voie,geom,objectid&where=search(%22PERIPHERIQUE%22)&limit=100'
const STREET_PRODUCT_URL = 'https://opendata.paris.fr/explore/dataset/voie/'

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function distanceToSegmentSquared(point, start, end) {
  const latitude = (point[1] + start[1] + end[1]) / 3
  const longitudeScale = Math.cos(latitude * Math.PI / 180)
  const px = point[0] * longitudeScale
  const py = point[1]
  const ax = start[0] * longitudeScale
  const ay = start[1]
  const bx = end[0] * longitudeScale
  const by = end[1]
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) return (px - ax) ** 2 + (py - ay) ** 2
  const projection = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx ** 2 + dy ** 2)),
  )
  const x = ax + projection * dx
  const y = ay + projection * dy
  return (px - x) ** 2 + (py - y) ** 2
}

function simplifyLine(points, toleranceDegrees) {
  if (points.length <= 2) return points
  let maximum = 0
  let splitIndex = 0
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = distanceToSegmentSquared(points[index], points[0], points.at(-1))
    if (distance > maximum) {
      maximum = distance
      splitIndex = index
    }
  }
  if (maximum <= toleranceDegrees ** 2) return [points[0], points.at(-1)]
  const first = simplifyLine(points.slice(0, splitIndex + 1), toleranceDegrees)
  const second = simplifyLine(points.slice(splitIndex), toleranceDegrees)
  return [...first.slice(0, -1), ...second]
}

function simplifyRing(ring, toleranceMetres) {
  const closed =
    ring.length > 1 &&
    ring[0][0] === ring.at(-1)[0] &&
    ring[0][1] === ring.at(-1)[1]
  const source = closed ? ring.slice(0, -1) : ring
  if (source.length < 4) return ring
  const anchorIndex = source.reduce(
    (best, point, index) => point[0] < source[best][0] ? index : best,
    0,
  )
  const rotated = [
    ...source.slice(anchorIndex),
    ...source.slice(0, anchorIndex),
    source[anchorIndex],
  ]
  const simplified = simplifyLine(rotated, toleranceMetres / 111_320)
  const result = simplified.length >= 4 ? simplified : rotated
  return result.map(([longitude, latitude]) => [
    Number(longitude.toFixed(5)),
    Number(latitude.toFixed(5)),
  ])
}

function simplifyPath(path, toleranceMetres) {
  const simplified = simplifyLine(path, toleranceMetres / 111_320)
  return simplified.map(([longitude, latitude]) => [
    Number(longitude.toFixed(5)),
    Number(latitude.toFixed(5)),
  ])
}

function pointCount(polygons) {
  return polygons.reduce(
    (total, polygon) =>
      total + polygon.reduce((ringTotal, ring) => ringTotal + ring.length, 0),
    0,
  )
}

function polygonsForGeometry(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates
  throw new Error(`Unsupported Paris geometry: ${geometry.type}`)
}

export function compileParisGeography({
  boundarySource,
  waterSource,
  peripheriqueSource,
  boundaryBytes,
  waterBytes,
  peripheriqueBytes,
  retrievedAt = new Date().toISOString(),
  toleranceMetres = 16,
}) {
  if (boundarySource?.type !== 'Feature') {
    throw new Error('Paris boundary source must be one GeoJSON Feature')
  }
  const boundaryPolygons = polygonsForGeometry(boundarySource.geometry)
  const boundary = boundaryPolygons.map((polygon) =>
    polygon.map((ring) => simplifyRing(ring, toleranceMetres)),
  )
  const waterRecords = waterSource?.results ?? []
  if (!waterRecords.length) throw new Error('Paris water source has no records')
  const sourceWater = waterRecords.flatMap((record) =>
    polygonsForGeometry(record.geo_shape?.geometry ?? record.geo_shape),
  )
  const water = sourceWater.map((polygon) =>
    polygon.map((ring) => simplifyRing(ring, toleranceMetres)),
  )
  const peripheriqueRecord = peripheriqueSource?.results?.find(
    (record) => record.l_longmin === 'Boulevard Périphérique',
  )
  const peripheriqueGeometry =
    peripheriqueRecord?.geom?.geometry ?? peripheriqueRecord?.geom
  if (peripheriqueGeometry?.type !== 'MultiLineString') {
    throw new Error('Paris street source has no Boulevard Périphérique multiline')
  }
  const peripherique = peripheriqueGeometry.coordinates.map((line) =>
    simplifyPath(line, toleranceMetres),
  )

  return {
    metadata: {
      retrievedAt,
      model:
        'Official Paris administrative contour, street-plan water polygons and périphérique axis simplified for deterministic rendering.',
      toleranceMetres,
      layers: {
        boundary: {
          publisher: 'Direction interministérielle du numérique',
          sourceUrl: BOUNDARY_URL,
          sourceSha256: sha256(boundaryBytes),
          productUrl: 'https://geo.api.gouv.fr/decoupage-administratif/communes',
          attribution: 'API Découpage administratif · code commune 75056',
        },
        water: {
          publisher: 'Direction de l’Urbanisme · Ville de Paris',
          sourceUrl: WATER_URL,
          sourceSha256: sha256(waterBytes),
          productUrl: WATER_PRODUCT_URL,
          license: 'Open Database License (ODbL)',
          licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
          attribution: 'Ville de Paris · Plan de voirie – Voies d’eau',
        },
        peripherique: {
          publisher: 'Direction de l’Urbanisme · Ville de Paris',
          sourceUrl: PERIPHERIQUE_URL,
          sourceSha256: sha256(peripheriqueBytes),
          productUrl: STREET_PRODUCT_URL,
          license: 'Open Database License (ODbL)',
          licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
          attribution: 'Ville de Paris · Filaire de voies',
        },
      },
      pointCounts: {
        boundary: {
          source: pointCount(boundaryPolygons),
          compiled: pointCount(boundary),
        },
        water: {
          source: pointCount(sourceWater),
          compiled: pointCount(water),
        },
        peripherique: {
          source: peripheriqueGeometry.coordinates.reduce(
            (total, line) => total + line.length,
            0,
          ),
          compiled: peripherique.reduce(
            (total, line) => total + line.length,
            0,
          ),
        },
      },
    },
    boundary,
    water: [
      {
        id: 'seine-et-canaux',
        name: 'Seine et canaux',
        polygons: water,
      },
    ],
    references: [
      {
        id: 'boulevard-peripherique',
        name: 'Boulevard Périphérique',
        color: '#c9a9dd',
        paths: peripherique,
      },
    ],
  }
}

async function main() {
  const boundaryPath = option('--boundary')
  const waterPath = option('--water')
  const peripheriquePath = option('--peripherique')
  if (!boundaryPath || !waterPath || !peripheriquePath) {
    throw new Error('Pass explicit --boundary, --water and --peripherique source files')
  }
  const [boundaryBytes, waterBytes, peripheriqueBytes] = await Promise.all([
    readFile(resolve(boundaryPath)),
    readFile(resolve(waterPath)),
    readFile(resolve(peripheriquePath)),
  ])
  const artifact = compileParisGeography({
    boundarySource: JSON.parse(boundaryBytes.toString('utf8')),
    waterSource: JSON.parse(waterBytes.toString('utf8')),
    peripheriqueSource: JSON.parse(peripheriqueBytes.toString('utf8')),
    boundaryBytes,
    waterBytes,
    peripheriqueBytes,
    retrievedAt: option('--retrieved-at', new Date().toISOString()),
    toleranceMetres: Number(option('--tolerance-metres', '16')),
  })
  const output = resolve(option('--output', DEFAULT_OUTPUT))
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(artifact)}\n`)
  console.log(
    `Wrote ${output}: boundary ${artifact.metadata.pointCounts.boundary.source} → ${artifact.metadata.pointCounts.boundary.compiled} points / water ${artifact.metadata.pointCounts.water.source} → ${artifact.metadata.pointCounts.water.compiled} points / périphérique ${artifact.metadata.pointCounts.peripherique.source} → ${artifact.metadata.pointCounts.peripherique.compiled} points`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
