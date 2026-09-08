import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { AARGAU_RAIL_LIMITS } from './aargau-rail-geometry.mjs'
const arg = name => { const i = process.argv.indexOf(`--${name}`); assert(i >= 0, `Missing --${name}`); return process.argv[i + 1] }
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const xml = await readFile(arg('source')), itemBytes = await readFile(arg('catalogue')), collectionBytes = await readFile(arg('collection'))
const item = JSON.parse(itemBytes), collection = JSON.parse(collectionBytes), asset = item.assets['schienennetz_2056_de.xtf']
assert.equal(`1220${sha(xml)}`, asset['file:checksum'])
const network = parseRailNetworkXtf(xml.toString(), AARGAU_RAIL_LIMITS.simplificationMetres), directory = arg('output')
await mkdir(directory, { recursive: true })
const files = { 'network.xtf.gz': gzipSync(xml), 'catalogue.json': itemBytes, 'collection.json': collectionBytes }
for (const [name, bytes] of Object.entries(files)) await writeFile(`${directory}/${name}`, bytes)
const source = { schemaVersion: 1, publisher: collection.providers[0].name, attribution: '© Federal Office of Transport (FOT)', license: collection.license, termsUrl: collection.links.find(l => l.rel === 'license').href, catalogueDate: item.properties.datetime, assetUpdated: asset.updated, catalogueCheckedOn: arg('checked-on'), sourceUrl: asset.href, sha256: sha(xml), publishedChecksum: asset['file:checksum'], validOn: null, validityNote: 'Catalogue dates and verified bytes do not establish September 2026 alignment validity. Inferred infrastructure paths, not certified service running tracks.', nodes: network.nodes.size, segments: network.segments.length, transformation: 'Existing XTF parser; LV95 simplification 5 m and swisstopo approximate LV95-to-WGS84 transformation rounded to 6 decimals.', files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, sha(bytes)])) }
await writeFile(`${directory}/source.json`, JSON.stringify(source, null, 2) + '\n')
const routes = new Map(), inputTimetableHashes = {}
for (const date of ['2026-09-04', '2026-09-06']) {
  const bytes = await readFile(`data/aargau/${date}-timetable.json.gz`), raw = JSON.parse(gunzipSync(bytes)); inputTimetableHashes[date] = sha(bytes)
  for (const train of raw.trains) if (train.category === 'rail' && ['11', '65', '82'].includes(train.agencyId)) routes.set(train.routeId, { routeId: train.routeId, agencyId: train.agencyId, line: train.route })
}
await writeFile(arg('policy'), JSON.stringify({ schemaVersion: 1, scope: 'Exact retained SBB (11), THURBO (65) and SOB (82) rail route identities only. Fill absent AGIS geometry. Full ordered operating-point sequence constrains each directed infrastructure search. No nearest-name or nearest-network identity fallback.', inputTimetableHashes, routes: [...routes.values()].sort((a, b) => a.routeId.localeCompare(b.routeId)) }, null, 2) + '\n')
console.log({ nodes: source.nodes, segments: source.segments, routes: routes.size, sha256: source.sha256 })
