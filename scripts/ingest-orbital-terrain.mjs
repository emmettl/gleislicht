import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { fromUrl } from 'geotiff'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'
import { insideOrbitalRing } from '../src/studies/orbital-terrain.ts'

const catalogue = 'https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissaltiregio/items/swissaltiregio'
let item
try { item = JSON.parse(await readFile('/private/tmp/jungfrau-alti-stac.json', 'utf8')) }
catch { const response = await fetch(catalogue); if (!response.ok) throw new Error(`Terrain catalogue: ${response.status}`); item = await response.json() }
const asset = Object.values(item.assets).find(a => a['geoadmin:variant'] === 'fullcoverage' && a.type?.includes('geotiff') && a['proj:epsg'] === 2056)
if (!asset) throw new Error('No full-coverage LV95 terrain asset')
const detailed = process.argv.includes('--detailed')
const suffix = detailed ? '-detailed' : ''
const bounds = { west: 5.7, east: 10.8, south: 45.6, north: 47.95 }, columns = detailed ? 2305 : 769, rows = detailed ? 1345 : 449
const corners = [[bounds.west, bounds.south], [bounds.west, bounds.north], [bounds.east, bounds.south], [bounds.east, bounds.north]].map(p => wgs84ToLv95(...p))
const bbox = [Math.floor(Math.min(...corners.map(p => p[0])) / 1000) * 1000 - 1000, Math.floor(Math.min(...corners.map(p => p[1])) / 1000) * 1000 - 1000, Math.ceil(Math.max(...corners.map(p => p[0])) / 1000) * 1000 + 1000, Math.ceil(Math.max(...corners.map(p => p[1])) / 1000) * 1000 + 1000]
const width = detailed ? 3600 : 1200, height = Math.round(width * (bbox[3] - bbox[1]) / (bbox[2] - bbox[0]))
const cache = `/private/tmp/gleislicht-orbital-elevation-raster${suffix}.json`
let raster
try { raster = JSON.parse(await readFile(cache, 'utf8')) } catch { /* Fetch the bounded overview on the first run. */ }
if (!raster || raster.width !== width || raster.height !== height || raster.checksum !== asset['file:checksum'] || JSON.stringify(raster.bbox) !== JSON.stringify(bbox)) {
  console.log('Reading national terrain overview from swisstopo…', bbox, width, height)
  const tiff = await fromUrl(asset.href, { allowFullFile: false })
  const values = await tiff.readRasters({ bbox, width, height, samples: [0], interleave: true, resampleMethod: 'bilinear' })
  raster = { bbox, width, height, checksum: asset['file:checksum'], values: [...values] }
  await writeFile(cache, JSON.stringify(raster))
}
function elevation(lon, lat) {
  const [east, north] = wgs84ToLv95(lon, lat)
  const x = Math.max(0, Math.min(raster.width - 1, (east - bbox[0]) / (bbox[2] - bbox[0]) * raster.width - 0.5))
  const y = Math.max(0, Math.min(raster.height - 1, (bbox[3] - north) / (bbox[3] - bbox[1]) * raster.height - 0.5))
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, raster.width - 1), y1 = Math.min(y0 + 1, raster.height - 1)
  const a = raster.values[y0 * raster.width + x0], b = raster.values[y0 * raster.width + x1], c = raster.values[y1 * raster.width + x0], d = raster.values[y1 * raster.width + x1]
  if (![a, b, c, d].every(v => Number.isFinite(v) && v >= 0 && v < 6000)) throw new Error(`Missing terrain at ${lon}, ${lat}`)
  return Math.round((a * (1 - (x - x0)) + b * (x - x0)) * (1 - (y - y0)) + (c * (1 - (x - x0)) + d * (x - x0)) * (y - y0))
}
const elevations = Array.from({ length: columns * rows }, (_, i) => elevation(bounds.west + (i % columns) / (columns - 1) * (bounds.east - bounds.west), bounds.north - Math.floor(i / columns) / (rows - 1) * (bounds.north - bounds.south)))
const lakesBytes = await readFile('public/data/swiss-lakes.json'), lakes = JSON.parse(lakesBytes).lakes, lakeElevations = {}
for (const lake of lakes) {
  const indexes = []
  for (const polygon of lake.polygons) {
    const ring = polygon[0], xs = ring.map(p => p[0]), ys = ring.map(p => p[1])
    const left = Math.max(0, Math.floor((Math.min(...xs) - bounds.west) / (bounds.east - bounds.west) * (columns - 1)))
    const right = Math.min(columns - 1, Math.ceil((Math.max(...xs) - bounds.west) / (bounds.east - bounds.west) * (columns - 1)))
    const top = Math.max(0, Math.floor((bounds.north - Math.max(...ys)) / (bounds.north - bounds.south) * (rows - 1)))
    const bottom = Math.min(rows - 1, Math.ceil((bounds.north - Math.min(...ys)) / (bounds.north - bounds.south) * (rows - 1)))
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      const lon = bounds.west + col / (columns - 1) * (bounds.east - bounds.west), lat = bounds.north - row / (rows - 1) * (bounds.north - bounds.south)
      if (insideOrbitalRing(lon, lat, ring) && !polygon.slice(1).some(hole => insideOrbitalRing(lon, lat, hole))) indexes.push(row * columns + col)
    }
  }
  const samples = indexes.length >= 3 ? indexes.map(i => elevations[i]) : lake.polygons.flatMap(p => p[0].map(([lon, lat]) => elevation(lon, lat)))
  samples.sort((a, b) => a - b)
  // A median of water cells rejects shoreline slopes; tiny lakes use the lower
  // shoreline sample. These are DEM-derived display levels, not water gauges.
  const level = samples[Math.floor(samples.length * (indexes.length >= 3 ? 0.5 : 0.1))]
  lakeElevations[lake.id] = level
  for (const i of indexes) elevations[i] = level
}
const artifact = { version: 1, bounds, columns, rows, elevations, metadata: { source: 'swissALTIRegio', sourceUrl: asset.href, sourceChecksum: asset['file:checksum'], releaseDate: item.properties.datetime.slice(0, 10), catalogueUrl: catalogue, sourceCrs: 'EPSG:2056 / LN02', outputCrs: 'EPSG:4326', gridSpacingMetres: [Math.round((bounds.east - bounds.west) * 111320 * Math.cos(46.8 * Math.PI / 180) / (columns - 1)), Math.round((bounds.north - bounds.south) * 111320 / (rows - 1))], model: 'Federal ground elevations resampled from a bounded COG overview to an approximately 500 m national grid. Display relief is exaggerated; surface draping is not surveyed rail, bridge, tunnel or cable height.', attribution: '© swisstopo; swissALTIRegio contributing national datasets: TINITALY 1.1, geoland.at, Bavarian and Baden-Württemberg surveying authorities, IGN France.' } }
artifact.lakeElevations = lakeElevations
artifact.metadata.lakeModel = 'Flat DEM-derived lake levels; median interior grid-cell height, lower shoreline sample for sub-grid lakes. No live water-level observations.'
artifact.metadata.lakesSha256 = createHash('sha256').update(lakesBytes).digest('hex')
artifact.metadata.model = `Federal ground elevations resampled from a bounded COG overview to an approximately ${detailed ? '170–195' : '500–585'} m national grid. Display relief is exaggerated; surface draping is not surveyed rail, bridge, tunnel or cable height.`
const bytes = JSON.stringify(artifact)
await writeFile(`public/data/orbital-terrain${suffix}.json`, bytes)
await writeFile(`data/orbital-terrain${suffix}-audit.json`, JSON.stringify({ ...artifact.metadata, columns, rows, elevationRange: elevations.reduce((a, v) => [Math.min(a[0], v), Math.max(a[1], v)], [Infinity, -Infinity]), lakes: lakes.map(lake => ({ id: lake.id, name: lake.name, elevation: lakeElevations[lake.id] })), gzipBytes: gzipSync(bytes).length, sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2) + '\n')
console.log(`Wrote ${columns} × ${rows} terrain; ${Math.round(gzipSync(bytes).length / 1024)} KiB compressed`)
