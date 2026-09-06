#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const GLA_MAP_SERVICE = 'https://gis.london.gov.uk/arcgis/rest/services/apps/webmap_context_layer/MapServer'
const DEFAULT_OUTPUT = 'fixtures/tfl/all-change-geography.json'

function argument(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : argv[index + 1]
}

function queryUrl(layer) {
  const url = new URL(`${GLA_MAP_SERVICE}/${layer}/query`)
  url.searchParams.set('where', '1=1')
  url.searchParams.set('outFields', layer === 0 ? 'name' : 'legend')
  url.searchParams.set('returnGeometry', 'true')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('f', 'geojson')
  return url
}

async function fetchGeoJson(layer) {
  const url = queryUrl(layer)
  const response = await fetch(url, {
    headers: { 'user-agent': 'Motion Studies data compiler (offline research)' },
  })
  if (!response.ok) throw new Error(`GLA map request failed (${response.status}) for layer ${layer}`)
  return response.json()
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function distanceToSegmentSquared(point, first, last) {
  const latitude = (point[1] + first[1] + last[1]) / 3
  const longitudeScale = Math.cos(latitude * Math.PI / 180)
  const px = point[0] * longitudeScale
  const py = point[1]
  const ax = first[0] * longitudeScale
  const ay = first[1]
  const bx = last[0] * longitudeScale
  const by = last[1]
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) return (px - ax) ** 2 + (py - ay) ** 2
  const position = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx ** 2 + dy ** 2)))
  const x = ax + position * dx
  const y = ay + position * dy
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
  const closed = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]
  const source = closed ? ring.slice(0, -1) : ring
  if (source.length < 4) return ring
  const anchorIndex = source.reduce((best, point, index) =>
    point[0] < source[best][0] ? index : best, 0)
  const rotated = [...source.slice(anchorIndex), ...source.slice(0, anchorIndex), source[anchorIndex]]
  const simplified = simplifyLine(rotated, toleranceMetres / 111_320)
  const minimum = simplified.length >= 4 ? simplified : rotated
  return minimum.map(([longitude, latitude]) => [
    Number(longitude.toFixed(5)),
    Number(latitude.toFixed(5)),
  ])
}

function mapPolygonCoordinates(coordinates, toleranceMetres) {
  return coordinates.map((ring) => simplifyRing(ring, toleranceMetres))
}

export function simplifyGeometry(geometry, toleranceMetres) {
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: mapPolygonCoordinates(geometry.coordinates, toleranceMetres) }
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon) => mapPolygonCoordinates(polygon, toleranceMetres)),
    }
  }
  throw new Error(`Unsupported GLA geometry type ${geometry.type}`)
}

function pointCount(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.reduce((total, polygon) =>
    total + polygon.reduce((ringTotal, ring) => ringTotal + ring.length, 0), 0)
}

function singleGeometry(featureCollection, label) {
  if (featureCollection.type !== 'FeatureCollection' || featureCollection.features?.length !== 1) {
    throw new Error(`${label} source must contain exactly one feature`)
  }
  return featureCollection.features[0].geometry
}

export function compileLondonGeography({
  boundarySource,
  thamesSource,
  retrievedAt = new Date().toISOString(),
  toleranceMetres = 35,
}) {
  const boundaryRaw = singleGeometry(boundarySource, 'Greater London boundary')
  const thamesRaw = singleGeometry(thamesSource, 'River Thames')
  const boundary = simplifyGeometry(boundaryRaw, toleranceMetres)
  const thames = simplifyGeometry(thamesRaw, toleranceMetres)
  return {
    metadata: {
      publisher: 'Greater London Authority',
      retrievedAt,
      sourceUrl: GLA_MAP_SERVICE,
      sourceSha256: sha256({ boundarySource, thamesSource }),
      license: 'Open Government Licence v3.0',
      licenseUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      model: 'GLA boundary and River Thames polygons simplified for deterministic rendering',
      toleranceMetres,
      layers: {
        boundary: { id: 0, sourceUrl: `${GLA_MAP_SERVICE}/0`, sourceSha256: sha256(boundarySource) },
        thames: { id: 1, sourceUrl: `${GLA_MAP_SERVICE}/1`, sourceSha256: sha256(thamesSource) },
      },
      pointCounts: {
        boundary: { source: pointCount(boundaryRaw), compiled: pointCount(boundary) },
        thames: { source: pointCount(thamesRaw), compiled: pointCount(thames) },
      },
    },
    boundary,
    thames,
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const boundaryPath = argument(argv, 'boundary')
  const thamesPath = argument(argv, 'thames')
  if (Boolean(boundaryPath) !== Boolean(thamesPath)) {
    throw new Error('--boundary and --thames must be supplied together')
  }
  const [boundarySource, thamesSource] = boundaryPath
    ? await Promise.all([boundaryPath, thamesPath].map(async (path) => JSON.parse(await readFile(path, 'utf8'))))
    : await Promise.all([fetchGeoJson(0), fetchGeoJson(1)])
  const output = argument(argv, 'output', DEFAULT_OUTPUT)
  const geography = compileLondonGeography({
    boundarySource,
    thamesSource,
    retrievedAt: argument(argv, 'retrieved-at', new Date().toISOString()),
    toleranceMetres: Number(argument(argv, 'tolerance-metres', '35')),
  })
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(geography)}\n`)
  console.log(
    `Wrote ${output}: boundary ${geography.metadata.pointCounts.boundary.source} → ${geography.metadata.pointCounts.boundary.compiled} points / Thames ${geography.metadata.pointCounts.thames.source} → ${geography.metadata.pointCounts.thames.compiled} points`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
