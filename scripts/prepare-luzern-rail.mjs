import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { sha256 } from './download-luzern-sources.mjs'
import { parseLuzernRail, luzernRailInputs, LUZERN_RAIL_LIMITS } from './luzern-rail-geometry.mjs'

const [inputPath, cataloguePath, collectionPath, timetablePath, output = 'data/luzern-rail-sources'] = process.argv.slice(2)
assert(timetablePath, 'Usage: SOURCE_XTF_OR_GZIP CATALOGUE COLLECTION TIMETABLE [OUTPUT]')
const input = await readFile(inputPath), xml = inputPath.endsWith('.gz') ? gunzipSync(input) : input
const catalogueBytes = await readFile(cataloguePath), collectionBytes = await readFile(collectionPath), catalogue = JSON.parse(catalogueBytes), collection = JSON.parse(collectionBytes)
const asset = catalogue.assets['schienennetz_2056_de.xtf']
assert.equal(asset['file:checksum'], `1220${sha256(xml)}`, 'Source bytes do not match federal published checksum')
const network = parseLuzernRail(xml.toString()), files = { 'network.xtf.gz': gzipSync(xml), 'catalogue.json': catalogueBytes, 'collection.json': collectionBytes }
await mkdir(output, { recursive: true })
for (const [name, bytes] of Object.entries(files)) await writeFile(join(output, name), bytes)
const source = { schemaVersion: 1, publisher: collection.providers[0].name, attribution: '© Federal Office of Transport (FOT)', catalogueLicense: collection.license,
  termsUrl: collection.links.find(l => l.rel === 'license').href, sourceUrl: asset.href, catalogueDate: catalogue.properties.datetime, assetUpdated: asset.updated, checkedOn: new Date().toISOString(),
  sha256: sha256(xml), nodes: network.nodes.size, segments: network.segments.length, files: Object.fromEntries(Object.entries(files).map(([file, bytes]) => [file, sha256(bytes)])),
  interpretation: 'Undirected infrastructure corridors; source Stand/validity dates retained per segment. Catalogue dates do not establish 2026 service routing or running-track validity.',
  transformation: 'Existing national XTF parser, 5 m LV95 simplification and approximate swisstopo LV95-to-WGS84 transformation; source coordinates rounded to six decimals.' }
const sourceBytes = JSON.stringify(source, null, 2) + '\n'
await writeFile(join(output, 'source.json'), sourceBytes)
const raw = JSON.parse(await readFile(timetablePath)), gauges = { '11': 'mm1435', '33': 'mm1435', '82': 'mm1435', '86': 'mm1000' }
const routes = raw.inventory.filter(r => r.mode === 'rail' && gauges[r.agencyId]).map(r => ({ routeId: r.routeId, agencyId: r.agencyId, line: r.line, gauge: gauges[r.agencyId] })).sort((a, b) => a.routeId.localeCompare(b.routeId))
const policyPath = 'data/luzern-policy.json', policy = JSON.parse(await readFile(policyPath))
policy.railFallback = { sourceDirectory: output, sourceMetadataSha256: sha256(sourceBytes), limits: LUZERN_RAIL_LIMITS, routes,
  admission: 'Fill only failed official rail pairs using exact operating-point numbers and reviewed route/gauge identities. Every complete pattern blocks other calls out of order; all contexts must agree. Retain full cross-canton journeys and prior official paths.' }
const inputs = 'data/luzern-rail-inputs.json', inputsBytes = JSON.stringify(luzernRailInputs(raw, policy.railFallback)) + '\n'
await writeFile(inputs, inputsBytes)
policy.railFallback.inputs = inputs; policy.railFallback.inputsSha256 = sha256(inputsBytes)
await writeFile(policyPath, JSON.stringify(policy, null, 2) + '\n')
console.log({ nodes: source.nodes, segments: source.segments, routes: routes.length, sha256: source.sha256 })
