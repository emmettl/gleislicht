import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { fromArrayBuffer } from 'geotiff'
import { territetTerrainRoutes, maskTerritetGroundDisagreements, territetGridHeight } from './territet-terrain-geometry.mjs'

const hash = b => createHash('sha256').update(b).digest('hex')
const read = async p => JSON.parse(await readFile(p, 'utf8'))
const cache = process.argv[2] ?? '/private/tmp/territet-alti3d'
await mkdir(cache, { recursive: true })
const manifest = await read('data/territet-elevation-source.json')
const pins = { 'swissalti3d_2021_2560-1141': 'c014f0d3fe982c2edf7e024dda5b8cf3d410dd75f108b6dec7728f569816920a', 'swissalti3d_2021_2560-1142': '82d4835622108b1e190073335c563d9936720c288d89a0273b4d0b623c344f62' }
const tiles = []
for (const [id, sha256] of Object.entries(pins)) {
  const item = manifest.items.find(i => i.id === id), name = `${id}_2_2056_5728.tif`, asset = item?.assets[name]
  assert(asset && asset['file:checksum'].toLowerCase() === `1220${sha256}` && asset['proj:epsg'] === 2056 && asset.gsd === 2, 'Changed elevation source metadata')
  assert.equal(asset.href, `https://data.geo.admin.ch/ch.swisstopo.swissalti3d/${id}/${name}`, 'Changed elevation URL')
  let bytes
  try { bytes = await readFile(`${cache}/${name}`) } catch (e) {
    if (e.code !== 'ENOENT') throw e
    const response = await fetch(asset.href)
    assert(response.ok, `Elevation download failed: ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
    assert.equal(hash(bytes), sha256, 'Changed downloaded elevation tile')
    await writeFile(`${cache}/${name}`, bytes)
  }
  assert.equal(hash(bytes), sha256, 'Changed cached elevation tile')
  const tiff = await fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)), image = await tiff.getImage()
  const north = id.endsWith('1142') ? 1143000 : 1142000
  assert.deepEqual(image.getOrigin(), [2560000, north, 0], 'Changed elevation tile origin')
  assert.deepEqual(image.getResolution(), [2, -2, 0], 'Changed native resolution')
  assert.equal(image.getGeoKeys().ProjectedCSTypeGeoKey, 2056, 'Changed raster CRS')
  assert.equal(image.getGeoKeys().GTRasterTypeGeoKey, 1, 'Expected pixel-area elevation raster')
  assert.equal(image.getWidth(), 500); assert.equal(image.getHeight(), 500)
  tiles.push({ id, sha256, href: asset.href, north, values: await image.readRasters({ samples: [0], interleave: true }), noData: image.getGDALNoData() })
}
// Sample a single mosaic, including native cells on both sides of the tile seam.
const sample = (east, north) => {
  const x = (east - 2560000) / 2 - .5, y = (1143000 - north) / 2 - .5
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const cell = (col, row) => {
    assert(col >= 0 && col < 500 && row >= 0 && row < 1000, 'Elevation outside source mosaic')
    const tile = tiles.find(t => t.north === (row < 500 ? 1143000 : 1142000))
    const v = tile.values[(row % 500) * 500 + col]
    assert(Number.isFinite(v) && v !== tile.noData && v >= 0 && v <= 5000, 'Invalid native elevation')
    return v
  }
  return (cell(ix, iy) * (1 - fx) + cell(ix + 1, iy) * fx) * (1 - fy) + (cell(ix, iy + 1) * (1 - fx) + cell(ix + 1, iy + 1) * fx) * fy
}
const network = await read('public/data/territet-day.json'), source = await read('data/territet-terrain-source.json')
const origin = { easting: 2560500, northing: 1142000 }, columns = 193, rows = 321, widthMetres = 960, depthMetres = 1600
const mapped = territetTerrainRoutes(source, network, await read('data/territet-journey-source.json'), await read('data/territet-funicular-source.json'), origin)
const elevations = Array.from({ length: columns * rows }, (_, i) => Number(sample(2560020 + (i % columns) * 5, 1142800 - Math.floor(i / columns) * 5).toFixed(1)))
const artifact = {
  id: 'territet-ascent-terrain', version: 1, viewScale: 180,
  metadata: { serviceDate: network.metadata.serviceDate, feedVersion: network.metadata.feedVersion, timetableSha256: network.metadata.sources.timetable.sha256, source: 'swissALTI3D + swissTLM3D', sourceCrs: 'EPSG:2056 / LN02', terrainRelease: '2021', terrainProductUrl: manifest.productUrl, railProductUrl: source.productUrl, attribution: '© swisstopo; installation context: Federal Office of Transport', gridSpacingMetres: 5, nativeResolutionMetres: 2, terrainTiles: tiles.map(({ id, sha256, href }) => ({ id, sha256, href })), railFeaturesSha256: '3594a4be7a7d712258157da5477ab24596e81c207347a1de4f81b1a2e41ebe25', model: 'Measured common track; both passing-loop branches shown only as context. Conservative loop fallback on the map. Original timetable interpolation by 3D polyline distance; no cable mechanics. Equal horizontal and vertical scale, enlarged vehicle marker.' },
  origin, terrain: { columns, rows, widthMetres, depthMetres, minElevation: Math.min(...elevations), maxElevation: Math.max(...elevations), elevations }, routes: [mapped.route], contextTracks: mapped.contextTracks,
}
const clearance = maskTerritetGroundDisagreements(mapped.route, p => Math.max(sample(origin.easting + p[0], origin.northing - p[1]), territetGridHeight(artifact.terrain, p)))
artifact.routes[0].maskedRanges = clearance.maskedRanges
const bytes = JSON.stringify(artifact) + '\n', gzipBytes = gzipSync(bytes).length
assert(gzipBytes < 180 * 1024, 'Optional funicular terrain exceeds 180 KiB gzip')
const { elevations: omitted, ...grid } = artifact.terrain
const binding = { ...artifact, terrain: grid }
await writeFile('public/data/territet-ascent-terrain.json', bytes)
await writeFile('data/territet-terrain-binding.json', JSON.stringify(binding) + '\n')
await writeFile('data/territet-terrain-playback-audit.json', JSON.stringify({ metadata: artifact.metadata, artifactSha256: hash(bytes), gzipBytes, grid: { ...grid, sampleCount: omitted.length }, alternatives: mapped.alternatives, loopFractions: mapped.fractions, maskedRanges: mapped.route.maskedRanges, contextTracks: mapped.contextTracks, clearanceThresholdMetres: 2.5, clearanceSamplingMetres: 1, clearanceMarginMetres: 3, clearanceSamples: clearance.samples, railGroundChecks: mapped.route.points.map(p => ({ rail: p, groundHeight: sample(origin.easting + p[0], origin.northing - p[1]), railMinusGroundMetres: p[2] - sample(origin.easting + p[0], origin.northing - p[1]) })) }, null, 2) + '\n')
console.log(`Wrote ${columns}×${rows} terrain at 5 m; ${(gzipBytes / 1024).toFixed(1)} KiB gzip`)
