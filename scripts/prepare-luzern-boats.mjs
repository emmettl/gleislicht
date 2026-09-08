import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { inWater } from './water-paths.mjs'
import { LUZERN_LAKE_GRIDS, luzernBoatInputs } from './luzern-boat-geometry.mjs'
const [incoming, timetable] = process.argv.slice(2)
assert(incoming && timetable, 'Usage: node scripts/prepare-luzern-boats.mjs DOWNLOADED_DIRECTORY TIMETABLE')
const dir = 'data/luzern-boat-sources', save = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n')
await mkdir(dir, { recursive: true })
const requests = JSON.parse(await readFile(join(incoming, 'requests.json'))), files = [], pages = new Map()
await save(join(dir, 'requests.json'), requests)
for (const request of requests) {
  const bytes = await readFile(join(incoming, request.file)), raw = gunzipSync(bytes), page = JSON.parse(raw)
  assert.equal(sha256(raw), request.rawSha256); assert.equal(page.results.length, request.count); assert(request.count < 200)
  await writeFile(join(dir, request.file), bytes); pages.set(request.file, page)
  files.push({ ...request, sha256: sha256(bytes) })
}
files.push({ file: 'requests.json', sha256: sha256(await readFile(join(dir, 'requests.json'))), description: 'Acquisition receipts and source query envelopes' })
const parent = JSON.parse(await readFile('data/zug-boat-sources/sources.json'))
for (const file of ['layer.json', 'collection.json', 'lake-layer.json', 'shoreline-legend.html', 'shoreline-product.html', 'terms.html']) {
  const bytes = await readFile(join('data/zug-boat-sources', file)), descriptor = parent.files.find(f => f.file === file)
  assert.equal(sha256(bytes), descriptor.sha256)
  const zipped = gzipSync(bytes); await writeFile(join(dir, file + '.gz'), zipped)
  files.push({ file: file + '.gz', url: descriptor.url, retrieved: parent.retrieved, rawSha256: sha256(bytes), sha256: sha256(zipped), reusedFrom: 'data/zug-boat-sources/' + file })
}
const source = { publisher: parent.publisher, attribution: parent.attribution, productUrl: parent.productUrl, license: parent.license, termsUrl: parent.termsUrl,
  geometryRetrieved: '2026-09-09', metadataRetrieved: parent.retrieved, collectionTemporalExtent: parent.collectionTemporalExtent, collectionUpdated: parent.collectionUpdated,
  shorelineDataStatus: parent.shorelineDataStatus, featureSourceDates: parent.featureSourceDates,
  acquisition: 'Fourteen adjoining bounded shipping queries cover the full dock areas: twelve for Lake Lucerne and two for Hallwilersee. Every response is below the 200 feature cap and shared features must agree byte-for-byte. One full lake query retains all polygon parts and holes. This is a scoped regional source census, not a national shipping census.',
  model: 'Gleislicht cartographic inference on generalized official passenger-shipping linework, with source-vertex connectivity, explicit GTFS dock attachments and full shoreline-intersection checks. Not navigational, operator-certified shipping lanes or current-diversion evidence.', files }
await save(join(dir, 'sources.json'), source)
const rawBytes = await readFile(timetable), raw = JSON.parse(rawBytes), inputs = luzernBoatInputs(raw)
await save('data/luzern-boat-inputs.json', inputs)
const all = new Map(), lakeRows = pages.get('lakes.json.gz').results
const lakes = LUZERN_LAKE_GRIDS.map(grid => {
  const polygons = lakeRows.find(f => f.id === grid.shorelineId).geometry.coordinates, fs = new Map()
  for (const r of requests.filter(r => r.lake === grid.id)) for (const f of pages.get(r.file).results.filter(f => f.properties.objval?.trim() === 'Kursschiff_Linie')) {
    if (all.has(f.id)) assert.deepEqual(f, all.get(f.id)); all.set(f.id, f); fs.set(f.id, f)
  }
  return { id: grid.id, featureIds: [...fs.values()].filter(f => f.geometry.coordinates.some(p => polygons.some(poly => inWater(p, poly)))).map(f => f.id).sort() }
})
const policy = { sourceDirectory: dir, sourceSha256: sha256(await readFile(join(dir, 'sources.json'))), timetableSha256: sha256(rawBytes),
  inputs: 'data/luzern-boat-inputs.json', inputsSha256: sha256(await readFile('data/luzern-boat-inputs.json')), dates: inputs.dates,
  routes: inputs.inventory.map(r => ({ ...r, stopIds: [...new Set(inputs.snapshots.flatMap(d => d.trains.filter(t => t.routeId === r.routeId).flatMap(t => t.calls.map(c => c.id))))].sort() })),
  sourceFeatureIds: [...all.keys()].sort(), lakes,
  limits: { snapMetres: 150, detourRatio: 3, detourFloorMetres: 1200, alternativeSnapMetres: 5 }, dockZoneMetres: 150,
  scope: 'All eight annual boat route records and every complete fixture pattern, including all calls outside Luzern. Every segment must pass before the whole journey is admitted. Route-specific directed pair reuse requires accepted identical paths in every full pattern. Only exact source-vertex joins at seven-decimal coordinate precision; no fabricated water paths or topology bridges.',
  shorelineRule: 'Split each path edge at all original shoreline and island-ring intersections. An outside-water interval is retained only wholly within 150 m of one actual endpoint dock, and its full evidence is disclosed. Any remote land crossing excludes the whole pattern. Source and shoreline vintages do not establish current navigability.' }
await save('data/luzern-boat-policy.json', policy)
console.log({ sourceFeatures: all.size, lakes: lakes.map(l => [l.id, l.featureIds.length]), patterns: inputs.snapshots[0].trains.length, routes: policy.routes.length })
