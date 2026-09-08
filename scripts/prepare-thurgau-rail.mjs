import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { parseLuzernRail } from './luzern-rail-geometry.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const input = process.argv[2] ?? 'data/aargau-rail-sources', output = 'data/thurgau-rail-sources'
const original = JSON.parse(await readFile(`${input}/source.json`))
await mkdir(output, { recursive: true })
for (const [name, hash] of Object.entries(original.files)) {
  const bytes = await readFile(`${input}/${name}`)
  assert.equal(sha(bytes), hash)
  await writeFile(`${output}/${name}`, bytes)
}
const xml = gunzipSync(await readFile(`${output}/network.xtf.gz`))
assert.equal(sha(xml), original.sha256)
const catalogue = JSON.parse(await readFile(`${output}/catalogue.json`))
assert.equal(catalogue.assets['schienennetz_2056_de.xtf']['file:checksum'], `1220${sha(xml)}`)
const network = parseLuzernRail(xml.toString())
assert.equal(network.nodes.size, original.nodes); assert.equal(network.segments.length, original.segments)
const source = { ...original, reusedOn: '2026-09-08', reuseNote: 'Reused the already acquired national FOT snapshot; no new network acquisition. Catalogue and per-segment dates do not certify September 2026 service alignments.' }
await writeFile(`${output}/source.json`, JSON.stringify(source, null, 2) + '\n')
const bytes = await readFile('data/thurgau-audit/timetable-cache.json.gz'), raw = JSON.parse(gunzipSync(bytes))
const policy = { schemaVersion: 1, sourceMetadataSha256: sha(await readFile(`${output}/source.json`)), timetableSha256: sha(bytes),
  dates: raw.snapshots.map(s => s.metadata.serviceDate),
  limits: { simplificationMetres: 5, stationAttachmentMetres: 350, topologyAttachmentMetres: 120, detourRatio: 4.5, detourFloorMetres: 3000 },
  scope: 'SBB (11) and THURBO (65) standard-gauge routes, exact original route IDs. Complete cantonal patterns take priority. Full-pattern infrastructure inference only; no stop removal, reverse/pair cache borrowing, name matching or nearest-network identity fallback. The two explicit Interlaken IC81 platform overrides are separately evidenced against the FOT tracks 5–8 node.',
  operatingPointOverrides: [
    { stopId: 'ch:1:sloid:7492:0:460848', platform: '7' },
    { stopId: 'ch:1:sloid:7492:0:581416', platform: '5' },
  ].map(s => ({ ...s, routeId: '91-81-A-j26-1', sourceNumber: '8507492', targetNumber: '8519309', expectedName: 'Interlaken Ost [Gleis 5-8]',
    evidence: 'FOT node ch14uvag00165678 explicitly names tracks 5–8 and connects to the mm1435 Interlaken West segment ch14uvag00087489. Exact IC81 GTFS platform IDs 5/7 only; generic station node is disconnected.' })),
  routes: raw.routes.filter(r => r.mode === 'rail' && ['11', '65'].includes(r.agencyId)).map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, gauge: 'mm1435' })).sort((a, b) => a.routeId.localeCompare(b.routeId)) }
await writeFile('data/thurgau-rail-policy.json', JSON.stringify(policy, null, 2) + '\n')
console.log({ nodes: network.nodes.size, segments: network.segments.length, routes: policy.routes.length })
