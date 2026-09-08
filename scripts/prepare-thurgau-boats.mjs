import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

const dir = 'data/thurgau-boat-sources', sha = b => createHash('sha256').update(b).digest('hex')
await mkdir(dir, { recursive: true })
if (process.argv[2]) {
  const incoming = process.argv[2]
  const requests = JSON.parse(await readFile(`${incoming}/requests.json`))
  await writeFile(`${dir}/requests.json`, JSON.stringify(requests, null, 2) + '\n')
  for (const r of requests) {
    const bytes = await readFile(`${incoming}/${r.file}`)
    assert.equal(sha(gunzipSync(bytes)), r.rawSha256)
    await writeFile(`${dir}/${r.file}`, bytes)
  }
  await writeFile(`${dir}/lakes.json.gz`, gzipSync(await readFile('/private/tmp/thurgau-lakes-wide.json'), { mtime: 0 }))
  for (const [offset, file] of [[0, 'wide'], [200, 'offset'], [400, '400'], [600, '600']]) {
    await writeFile(`${dir}/broad-${offset}.json.gz`, gzipSync(await readFile(`/private/tmp/thurgau-shipping-${file}.json`), { mtime: 0 }))
  }
  const reused = JSON.parse(await readFile('data/zug-boat-sources/sources.json'))
  for (const file of ['layer.json', 'collection.json', 'lake-layer.json', 'shoreline-legend.html', 'terms.html']) {
    const bytes = await readFile(`data/zug-boat-sources/${file}`)
    assert.equal(sha(bytes), reused.files.find(f => f.file === file).sha256)
    await writeFile(`${dir}/${file}.gz`, gzipSync(bytes, { mtime: 0 }))
  }
}
const requests = JSON.parse(await readFile(`${dir}/requests.json`))
assert.equal(requests.length, 30)
const features = new Map(), files = []
for (const r of requests) {
  const bytes = await readFile(`${dir}/${r.file}`), raw = gunzipSync(bytes), page = JSON.parse(raw)
  assert.equal(sha(raw), r.rawSha256); assert.equal(page.results.length, r.count); assert(r.count < 200)
  files.push({ file: r.file, url: r.url, sha256: sha(bytes) })
  for (const f of page.results.filter(f => f.properties.objval?.trim() === 'Kursschiff_Linie')) {
    if (features.has(f.id)) assert.deepEqual(f, features.get(f.id), 'Conflicting shipping tile duplicate')
    features.set(f.id, f)
  }
}
assert.equal(features.size, 69)
const base = 'https://api3.geo.admin.ch/rest/services/ech/MapServer/'
const extra = {
  'requests.json': 'Gleislicht acquisition receipts for the 30 listed official API requests',
  'lakes.json.gz': base + 'identify?geometryType=esriGeometryEnvelope&geometry=8.6,47.45,9.6,47.76&geometryFormat=geojson&imageDisplay=1600,900,96&mapExtent=8.6,47.45,9.6,47.76&tolerance=0&layers=all:ch.bafu.vec25-seen&returnGeometry=true&limit=200&sr=4326',
  'layer.json.gz': base + 'ch.swisstopo.vec200-transportation-oeffentliche-verkehr?lang=en',
  'collection.json.gz': 'https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swisstlmregio',
  'lake-layer.json.gz': base + 'ch.bafu.vec25-seen?lang=en',
  'shoreline-legend.html.gz': base + 'ch.bafu.vec25-seen/legend?lang=en',
  'terms.html.gz': 'https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices',
}
for (const offset of [0, 200, 400, 600]) extra[`broad-${offset}.json.gz`] = base + `identify?geometryType=esriGeometryEnvelope&geometry=8.6,47.45,9.6,47.76&geometryFormat=geojson&imageDisplay=1600,900,96&mapExtent=8.6,47.45,9.6,47.76&tolerance=0&layers=all:ch.swisstopo.vec200-transportation-oeffentliche-verkehr&returnGeometry=true&limit=200&sr=4326&offset=${offset}`
for (const [file, url] of Object.entries(extra)) files.push({ file, url, sha256: sha(await readFile(`${dir}/${file}`)) })
const collection = JSON.parse(gunzipSync(await readFile(`${dir}/collection.json.gz`)))
const source = { acquired: '2026-09-08', publisher: 'swisstopo; FOEN', attribution: 'Shipping geometry: © swisstopo; shoreline validation: © FOEN, swisstopo',
  productUrl: 'https://www.swisstopo.admin.ch/en/landscape-model-swisstlmregio', termsUrl: extra['terms.html.gz'],
  license: collection.license, collectionUpdated: collection.updated, collectionTemporalExtent: collection.extent.temporal.interval,
  shorelineDataStatus: '2007-01-01', featureVintage: 'Shipping API supplies no individual feature survey date. Collection and acquisition dates do not establish a 2026 alignment.',
  acquisition: 'Thirty adjacent 0.1° × 0.11° envelopes cover 8.6–9.6° E / 47.45–47.78° N, including every dated boat dock. Every response is below the 200 feature cap; duplicate shipping records agree exactly. A broad paginated mixed-transport query omitted shipping features present in the small queries and is not used as a completeness claim.',
  model: 'Gleislicht shortest-path cartographic inference on generalized official shipping linework. Exact source-vertex connectivity, bounded original-dock connectors and full shoreline-intersection audit. No navigational, shipping-lane, diversion or physical-direction certification.', files }
await writeFile(`${dir}/sources.json`, JSON.stringify(source, null, 2) + '\n')
const timetableBytes = await readFile('data/thurgau-audit/timetable-cache.json.gz'), timetable = JSON.parse(gunzipSync(timetableBytes))
const routes = timetable.routes.filter(r => r.mode === 'ferry').map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, type: r.type }))
const policy = { sourceSha256: sha(await readFile(`${dir}/sources.json`)), timetableSha256: sha(timetableBytes), dates: timetable.snapshots.map(d => d.metadata.serviceDate),
  routes, sourceFeatureIds: [...features.keys()].sort(), shorelineFeatureIds: [124, 171],
  limits: { snapMetres: 150, detourRatio: 3, detourFloorMetres: 1200, alternativeSnapMetres: 5 }, dockZoneMetres: 150,
  scope: 'Only the seven exact dated GTFS boat route/agency/type identities and their full original dock/coordinate chains. Every segment must pass; never shorten a rejected trip. Other successful modes remain unchanged. No topology bridges or new water paths are drawn.',
  shorelineRule: 'Split every path edge at every original shoreline/island intersection. Outside-water intervals are allowed only wholly within 150 m of one actual endpoint dock, and are recorded as source discrepancies. Any other interval rejects the entire pattern. Untersee polygon is acquired; missing Rhine water is not replaced by a straight path.' }
await writeFile('data/thurgau-boat-policy.json', JSON.stringify(policy, null, 2) + '\n')
console.log({ shippingFeatures: features.size, routes: routes.length, tiles: requests.length })
