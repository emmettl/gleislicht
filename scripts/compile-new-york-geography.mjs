import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const SOURCE_URL =
  "https://data.cityofnewyork.us/resource/gthc-hcne.geojson?%24where=boroname%3D%27Manhattan%27"
const LICENSE_URL = 'https://opendata.cityofnewyork.us/overview/#termsofuse'

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1])
  const projection = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)),
  )
  return Math.hypot(
    point[0] - (start[0] + projection * dx),
    point[1] - (start[1] + projection * dy),
  )
}

function simplify(points, tolerance) {
  if (points.length <= 2) return points
  let maximum = 0
  let split = 0
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points.at(-1))
    if (distance > maximum) {
      maximum = distance
      split = index
    }
  }
  if (maximum <= tolerance) return [points[0], points.at(-1)]
  return [
    ...simplify(points.slice(0, split + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(split), tolerance),
  ]
}

function signedArea(ring) {
  return ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length]
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0) / 2
}

function mainRing(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons
    .flatMap((polygon) => polygon)
    .toSorted((first, second) => Math.abs(signedArea(second)) - Math.abs(signedArea(first)))[0]
}

function bankSamples(ring, minLatitude, maxLatitude, bins = 48) {
  return Array.from({ length: bins + 1 }, (_, index) => {
    const latitude = minLatitude + (maxLatitude - minLatitude) * (index / bins)
    const radius = (maxLatitude - minLatitude) / bins
    const nearby = ring.filter((point) => Math.abs(point[1] - latitude) <= radius)
    const candidates = nearby.length ? nearby : ring.toSorted((a, b) => Math.abs(a[1] - latitude) - Math.abs(b[1] - latitude)).slice(0, 8)
    return {
      latitude,
      west: Math.min(...candidates.map((point) => point[0])),
      east: Math.max(...candidates.map((point) => point[0])),
    }
  })
}

function waterPolygon(samples, side, outsideLongitude) {
  const inside = samples.map((sample) => [sample[side], sample.latitude])
  const outside = [...samples]
    .reverse()
    .map((sample) => [outsideLongitude, sample.latitude])
  const ring = [...inside, ...outside, inside[0]]
  return [[ring]]
}

const input = option('--input')
const output = resolve(option('--output', 'fixtures/mta/local-express-geography.json'))
const retrievedAt = option('--retrieved-at', new Date().toISOString())
const source = input
  ? JSON.parse(await readFile(resolve(input), 'utf8'))
  : await fetch(SOURCE_URL).then((response) => {
      if (!response.ok) throw new Error(`NYC Open Data responded ${response.status}`)
      return response.json()
    })
const feature = source.features?.find((candidate) => candidate.properties?.boroname === 'Manhattan') ?? source.features?.[0]
if (!feature) throw new Error('Manhattan boundary was not present in the source')

const rawRing = mainRing(feature.geometry)
const closed = rawRing[0][0] === rawRing.at(-1)[0] && rawRing[0][1] === rawRing.at(-1)[1]
  ? rawRing
  : [...rawRing, rawRing[0]]
const simplified = simplify(closed, 0.00016)
const minLatitude = 40.697
const maxLatitude = 40.821
const samples = bankSamples(rawRing, minLatitude, maxLatitude)

const artifact = {
  metadata: {
    publisher: 'NYC Department of City Planning',
    sourceUrl: SOURCE_URL,
    license: 'NYC Open Data Terms of Use',
    licenseUrl: LICENSE_URL,
    retrievedAt,
    model: 'Official water-excluded Manhattan borough boundary; corridor water bands derived from the published shoreline for visual context.',
    simplificationToleranceMetres: 14,
  },
  boundary: [simplified],
  water: [
    {
      id: 'hudson-river',
      name: 'Hudson River',
      polygons: waterPolygon(samples, 'west', -74.035),
    },
    {
      id: 'east-harlem-rivers',
      name: 'East and Harlem Rivers',
      polygons: waterPolygon(samples, 'east', -73.91),
    },
  ],
}

await writeFile(output, `${JSON.stringify(artifact)}\n`)
console.log(`Wrote ${output} with ${simplified.length} shoreline points.`)
