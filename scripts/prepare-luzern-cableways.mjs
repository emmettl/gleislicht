import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { sha256 } from './download-luzern-sources.mjs'
import { parseLuzernCableways } from './luzern-cableway-geometry.mjs'
const [zipPath, cataloguePath, collectionPath, timetablePath, output = 'data/luzern-cableway-sources'] = process.argv.slice(2)
assert(timetablePath, 'Usage: ZIP CATALOGUE COLLECTION TIMETABLE [OUTPUT]')
const zip = await readFile(zipPath), catalogueBytes = await readFile(cataloguePath), collectionBytes = await readFile(collectionPath)
const item = JSON.parse(catalogueBytes).features[0], collection = JSON.parse(collectionBytes), asset = item.assets['seilbahnen-bundeskonzession_2056_de.xtf.zip']
assert.equal(asset['file:checksum'], `1220${sha256(zip)}`)
const names = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n').filter(n => n.endsWith('.xtf'))
assert.equal(names.length, 1)
const xml = execFileSync('unzip', ['-p', zipPath, names[0]], { maxBuffer: 32 * 1024 * 1024 }), network = parseLuzernCableways(xml.toString())
const files = { 'source.xtf.zip': zip, 'network.xtf.gz': gzipSync(xml), 'catalogue.json': catalogueBytes, 'collection.json': collectionBytes }
await mkdir(output, { recursive: true })
for (const [name, bytes] of Object.entries(files)) await writeFile(join(output, name), bytes)
const source = { publisher: collection.providers[0].name, attribution: '© Federal Office of Transport (FOT)', catalogueLicense: collection.license, termsUrl: collection.links.find(l => l.rel === 'license').href,
  sourceUrl: asset.href, catalogueDate: item.properties.datetime, assetUpdated: asset.updated, checkedOn: new Date().toISOString(), archiveMember: names[0], sha256: sha256(zip), xmlSha256: sha256(xml),
  counts: Object.fromEntries(['installations', 'stations', 'segments'].map(n => [n, network[n].length])), files: Object.fromEntries(Object.entries(files).map(([name, b]) => [name, sha256(b)])),
  interpretation: 'Official 2D cableway axes; source Stand dates retained per installation. No cable sag, altitude profile, observed cabins or live operational status.', transformation: 'Approximate swisstopo LV95-to-WGS84 polynomial, seven decimals, no geometry simplification.' }
const bytes = JSON.stringify(source, null, 2) + '\n'; await writeFile(join(output, 'source.json'), bytes)
const segment = (installation, stopNumbers, sourceStationNumbers = stopNumbers, aliasReason) => ({ installation, stopNumbers, sourceStationNumbers, ...(aliasReason ? { aliasReason } : {}) })
const aliasReason = 'GTFS uses the shared interchange identity; the federal source distinguishes cableway section stations. Exact reviewed station-number crosswalk, still subject to the 120 m station limit.'
const routes = [
  { routeId: '93-250-0-j26-1', agencyId: '273', line: '2500', sourceOperator: '1103', segments: [segment('72.062', ['8530351', '8530352'])] },
  { routeId: '93-250-5-j26-1', agencyId: '283', line: '2505', sourceOperator: '1234', segments: [segment('71.114', ['8508354', '8508355'])] },
  { routeId: '93-250-A-j26-1', agencyId: '283', line: '2503', sourceOperator: '1234', segments: [segment('72.078', ['8530353', '8530354'])] },
  { routeId: '93-251-6-j26-1', agencyId: '13600', line: '2516', sourceOperator: '213', segments: [segment('72.016', ['8508453', '8508454']), segment('72.017', ['8508454', '8508455'], ['8530893', '8508455'], aliasReason)] },
  { routeId: '93-251-7-j26-1', agencyId: '13600', line: '2517', sourceOperator: '213', segments: [segment('71.141', ['8508455', '8508456'], ['8530938', '8530939'], aliasReason)] },
]
const policyPath = 'data/luzern-policy.json', policy = JSON.parse(await readFile(policyPath))
policy.cablewayFallback = { sourceDirectory: output, sourceMetadataSha256: sha256(bytes), routes, limits: { stationAttachmentMetres: 120, topologyAttachmentMetres: 5, detourRatio: 4.5, detourFloorMetres: 1200 } }
const raw = JSON.parse(await readFile(timetablePath)), inventory = raw.inventory.filter(r => r.mode === 'mountain'), ids = new Set(inventory.map(r => r.routeId)), stops = new Set(raw.snapshots.flatMap(d => d.trains.filter(t => ids.has(t.routeId)).flatMap(t => t.calls.map(c => c.id))))
const inputBytes = JSON.stringify({ dates: raw.dates, inventory, stops: raw.stops.filter(s => stops.has(s.stop_id)) }) + '\n'
policy.cablewayFallback.inputs = 'data/luzern-cableway-inputs.json'; policy.cablewayFallback.inputsSha256 = sha256(inputBytes)
await writeFile(policy.cablewayFallback.inputs, inputBytes)
await writeFile(policyPath, JSON.stringify(policy, null, 2) + '\n')
console.log(source.counts)
