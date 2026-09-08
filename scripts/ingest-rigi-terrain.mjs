import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fromUrl } from 'geotiff'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'

const STAC = 'https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissaltiregio/items/swissaltiregio'
const PRODUCT = 'https://www.swisstopo.admin.ch/en/height-model-swissaltiregio'
const argument = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1] }
const hash = value => createHash('sha256').update(value).digest('hex')
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const coordinate = p => wgs84ToLv95(p[0], p[1])

export function rigiAscent(network) {
  const train = network.trains.filter(t => t.routeType === 116 && network.stops[t.stops[0][0]][2] === 'Vitznau' && network.stops[t.stops.at(-1)[0]][2] === 'Rigi Kulm')
    .sort((a, b) => b.stops.length - a.stops.length || Math.abs(a.start - 43200) - Math.abs(b.start - 43200) || a.id.localeCompare(b.id))[0]
  if (!train) throw new Error('No complete source-classified Vitznau–Rigi Kulm ascent')
  const points = [], stopDistances = [0]
  let length = 0
  for (let i = 0; i < train.stops.length - 1; i++) {
    const path = network.paths?.[train.pathSegments?.[i]]
    if (!path || path.length < 2) throw new Error('Rigi ascent requires complete mapped rail paths')
    const from = coordinate(network.stops[train.stops[i][0]])
    const projected = path.map(coordinate)
    if (distance(from, projected[0]) > distance(from, projected.at(-1))) projected.reverse()
    if (points.length && distance(points.at(-1), projected[0]) > 100) throw new Error('Disconnected Rigi rail alignment')
    for (const point of projected) {
      if (points.length) {
        const step = distance(points.at(-1), point)
        if (step < 0.1) continue
        length += step
      }
      points.push(point)
    }
    stopDistances.push(length)
  }
  // Add ground-profile samples along every retained FOT segment, preserving bends.
  const dense = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], steps = Math.ceil(distance(a, b) / 20)
    for (let j = 1; j <= steps; j++) dense.push([a[0] + (b[0] - a[0]) * j / steps, a[1] + (b[1] - a[1]) * j / steps])
  }
  return { train, points: dense, length, stops: train.stops.map(([index, arrival, departure], i) => ({ name: network.stops[index][2], progress: stopDistances[i] / length, departure: i === train.stops.length - 1 ? arrival : departure })) }
}

export function sampleElevation(raster, easting, northing) {
  const x = (easting - raster.origin[0]) / raster.resolution[0] - 0.5 - raster.window[0]
  const y = (northing - raster.origin[1]) / raster.resolution[1] - 0.5 - raster.window[1]
  if (x < 0 || y < 0 || x > raster.width - 1 || y > raster.height - 1) throw new Error('Elevation query outside cached raster')
  const a = Math.floor(x), b = Math.floor(y), tx = x - a, ty = y - b
  const at = (c, r) => {
    const value = raster.values[Math.min(r, raster.height - 1) * raster.width + Math.min(c, raster.width - 1)]
    if (!Number.isFinite(value) || value < 0 || value > 5000) throw new Error('Invalid Swiss terrain sample')
    return value
  }
  const result = (at(a, b) * (1 - tx) + at(a + 1, b) * tx) * (1 - ty) + (at(a, b + 1) * (1 - tx) + at(a + 1, b + 1) * tx) * ty
  if (!Number.isFinite(result) || result < 0 || result > 5000) throw new Error('Invalid Swiss terrain sample')
  return result
}

export function clipRingToBounds(ring, bounds) {
  let result = ring
  for (const [axis, edge, sign] of [[0, bounds.minEasting, 1], [0, bounds.maxEasting, -1], [1, bounds.minNorthing, 1], [1, bounds.maxNorthing, -1]]) {
    const next = []
    for (let i = 0; i < result.length; i++) {
      const a = result[i], b = result[(i + 1) % result.length], ai = sign * (a[axis] - edge) >= 0, bi = sign * (b[axis] - edge) >= 0
      if (ai) next.push(a)
      if (ai !== bi) { const t = (edge - a[axis]) / (b[axis] - a[axis]); next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]) }
    }
    result = next
  }
  return result
}

function contains(point, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

async function main() {
  const networkBytes = await readFile(argument('network', 'public/data/rigi-day.json'))
  const network = JSON.parse(networkBytes), route = rigiAscent(network)
  const margin = 1400, xs = route.points.map(p => p[0]), ys = route.points.map(p => p[1])
  const bounds = { minEasting: Math.floor((Math.min(...xs) - margin) / 100) * 100, maxEasting: Math.ceil((Math.max(...xs) + margin) / 100) * 100, minNorthing: Math.floor((Math.min(...ys) - margin) / 100) * 100, maxNorthing: Math.ceil((Math.max(...ys) + margin) / 100) * 100 }
  const stacFile = argument('stac'), cacheFile = argument('source-cache')
  const item = stacFile ? JSON.parse(await readFile(stacFile, 'utf8')) : await fetch(STAC).then(r => { if (!r.ok) throw new Error(`STAC returned ${r.status}`); return r.json() })
  const asset = Object.values(item.assets).find(a => a['geoadmin:variant'] === 'fullcoverage' && a.type?.includes('geotiff'))
  if (!asset || asset['proj:epsg'] !== 2056) throw new Error('No compatible federal elevation asset')
  let raster
  if (cacheFile) { try { raster = JSON.parse(await readFile(cacheFile, 'utf8')) } catch (e) { if (e.code !== 'ENOENT') throw e } }
  if (raster && (raster.assetChecksum !== asset['file:checksum'] || JSON.stringify(raster.bounds) !== JSON.stringify(bounds))) throw new Error('Cached terrain belongs to different source or bounds')
  if (!raster) {
    console.log('Reading bounded native 10 m terrain using COG range requests…')
    const tiff = await fromUrl(asset.href, { allowFullFile: false })
    const image = await tiff.getImage(0), origin = image.getOrigin(), resolution = image.getResolution()
    if (resolution[0] !== 10 || resolution[1] !== -10) throw new Error('Unexpected native terrain grid')
    const window = [Math.floor((bounds.minEasting - origin[0]) / 10) - 2, Math.floor((origin[1] - bounds.maxNorthing) / 10) - 2, Math.ceil((bounds.maxEasting - origin[0]) / 10) + 2, Math.ceil((origin[1] - bounds.minNorthing) / 10) + 2]
    const values = await image.readRasters({ window, samples: [0], interleave: true })
    raster = { bounds, origin, resolution, window, width: values.width, height: values.height, assetChecksum: asset['file:checksum'], values: [...values] }
    if (cacheFile) await writeFile(cacheFile, JSON.stringify(raster))
  }
  const columns = 193, width = bounds.maxEasting - bounds.minEasting, depth = bounds.maxNorthing - bounds.minNorthing, rows = Math.round((columns - 1) * depth / width) + 1
  const origin = { easting: (bounds.minEasting + bounds.maxEasting) / 2, northing: (bounds.minNorthing + bounds.maxNorthing) / 2 }
  const local = p => [Number((p[0] - origin.easting).toFixed(2)), Number((origin.northing - p[1]).toFixed(2))]
  const gridPoints = Array.from({ length: columns * rows }, (_, i) => [bounds.minEasting + (i % columns) * width / (columns - 1), bounds.maxNorthing - Math.floor(i / columns) * depth / (rows - 1)])
  const elevations = gridPoints.map(p => Math.round(sampleElevation(raster, ...p)))
  const lakeBytes = await readFile(argument('lakes', 'public/data/swiss-lakes.json'))
  const water = JSON.parse(lakeBytes).lakes.find(l => l.id === '93')
  const lakeRing = clipRingToBounds(water.polygons[0][0].map(coordinate), bounds)
  const lakeHeights = gridPoints.flatMap((p, i) => contains(p, lakeRing) ? [elevations[i]] : []).sort((a, b) => a - b)
  if (!lakeHeights.length) throw new Error('Expected lake context beside Vitznau')
  const points = route.points.map(p => [...local(p), Number(sampleElevation(raster, ...p).toFixed(1))])
  const artifact = {
    id: 'vitznau-rigi',
    metadata: { source: 'swissALTIRegio', releaseDate: item.properties.datetime.slice(0, 10), sourceUrl: asset.href, productUrl: PRODUCT,
      attribution: 'Bundesamt für Landestopografie swisstopo; Tarquini S., I. Isola, M. Favalli, A. Battistini, G. Dotta (2023), TINITALY 1.1; DGM Österreich, geoland.at; DGM1, Bayerische Vermessungsverwaltung; DGM1, Baden-Württemberg: LGL, dl-de/by-2-0; RGEAlti, IGN France, July 2023',
      sourceCrs: 'EPSG:2056 / LN02', model: '10 m ground elevations sampled beneath FOT railway geometry; reduced terrain mesh; no surveyed track height, tunnels or cable profile', railSource: network.metadata,
      profileSourceUrl: asset.href, routeSource: 'Federal Office of Transport rail network', routeAttribution: 'Federal Office of Transport', routeProductUrl: 'https://map.geo.admin.ch/?layers=ch.bav.schienennetz',
      sourceEvidence: { assetChecksum: asset['file:checksum'], rasterSha256: hash(JSON.stringify(raster)), networkSha256: hash(networkBytes), lakeSha256: hash(lakeBytes), bounds, nativeResolutionMetres: 10, gridSpacingMetres: [width / (columns - 1), depth / (rows - 1)], routeMaximumSampleSpacingMetres: 20, routeSourceTripId: route.train.id, elevationMeaning: 'ground beneath alignment, not track survey', lakeSurfaceModel: 'median terrain sample within clipped cartographic lake' } },
    origin, terrain: { columns, rows, widthMetres: width, depthMetres: depth, minElevation: Math.min(...elevations), maxElevation: Math.max(...elevations), elevations },
    route: { service: route.train.route, destination: route.train.headsign, operator: route.train.operator, representativeTrain: route.train.shortName, distanceMetres: Math.round(route.length), points, stops: route.stops },
    lakes: [{ id: '93', name: water.name, elevation: lakeHeights[Math.floor(lakeHeights.length / 2)], rings: [lakeRing.map(local)] }],
  }
  await writeFile(argument('output', 'public/data/vitznau-rigi-corridor.json'), JSON.stringify(artifact) + '\n')
  console.log(`Wrote ${columns}×${rows} terrain, ${points.length} profile points, ${Math.round(route.length)} m route, ${points[0][2]}→${points.at(-1)[2]} m ground elevations`)
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exitCode = 1 })
