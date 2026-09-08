import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { parseLuzernCableways } from './luzern-cableway-geometry.mjs'
const directory = 'data/luzern-cableway-sources', digest = b => createHash('sha256').update(b).digest('hex')
const metadata = JSON.parse(await readFile(`${directory}/source.json`))
for (const [name, sha] of Object.entries(metadata.files)) assert.equal(digest(await readFile(`${directory}/${name}`)), sha)
const xml = gunzipSync(await readFile(`${directory}/network.xtf.gz`)); assert.equal(digest(xml), metadata.xmlSha256)
const network = parseLuzernCableways(xml.toString())
const routes = [
  { routeId: '93-LAS-j26-1', agencyId: '125', installation: '61.001', maximumSnapMetres: 25, stops: ['1350', '1351'] },
  { routeId: '93-TG-j26-1', agencyId: '131', installation: '61.046', maximumSnapMetres: 15, stops: ['30673', '92618', '30031'] },
  { routeId: '93-VCP-j26-1', agencyId: '155', installation: '61.050', maximumSnapMetres: 15, stops: ['1250', '1251', '1252', '1253', '1254', '1255'] },
].map(policy => {
  const installations = network.installations.filter(i => i.number === policy.installation); assert.equal(installations.length, 1)
  const installation = installations[0], segments = network.segments.filter(s => s.installation === installation.id)
  assert.equal(installation.type, 'Standseilbahn'); assert.equal(installation.operator, '212'); assert.equal(segments.length, 1); assert.equal(segments[0].lines.length, 1)
  return { ...policy, stops: policy.stops.map(id => `ch:1:sloid:${id}`), feature: installation, segment: segments[0], stations: network.stations.filter(s => s.installation === installation.id) }
})
const source = { schemaVersion: 1, metadata, routes, interpretation: 'Federal 2D installation centrelines, unsimplified. Intermediate timetable calls projected onto the installation axis. No passing-loop track assignment, cable simulation or measured elevation.' }
const bytes = JSON.stringify(source, null, 2) + '\n'
await writeFile('data/riviera-sources/funiculars.json', bytes)
await writeFile('data/riviera-sources/funiculars.sha256', digest(bytes) + '\n')
