import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { hashFile } from './solothurn-timetable.mjs'
const directory = 'data/solothurn-sources/corridors'
await mkdir(`${directory}/sbb`, { recursive: true })
const bern = JSON.parse(gunzipSync(await readFile('data/bern-sources/decoded.json.gz')))
const features = bern.lines.filter(f => f.properties.liniencode === '413')
assert.equal(features.length, 1)
assert.equal(features[0].properties.tucode, 'ASm'); assert.equal(features[0].properties.liniennr, 'S11'); assert.equal(features[0].properties.vkmtyp, 1)
await writeFile(`${directory}/bern-413.json`, JSON.stringify(features[0]))
const s29 = bern.lines.filter(f => f.properties.liniencode === '450_S_b')
assert.equal(s29.length, 1); assert.equal(s29[0].properties.tucode, 'SBB'); assert.equal(s29[0].properties.liniennr, 'S29'); assert.equal(s29[0].properties.vkmtyp, 1)
await writeFile(`${directory}/bern-450_S_b.json`, JSON.stringify(s29[0]))
const sourceDirectory = 'data/zug-sbb-rail-sources'
const sourceSha256 = 'c67745131e337136b47da452650f57c1c0dcc9a16f54fc659e6a0227f6fad030'
assert.equal(await hashFile(`${sourceDirectory}/sources.json`), sourceSha256)
const sbb = JSON.parse(await readFile(`${sourceDirectory}/sources.json`))
for (const f of sbb.files) {
  assert.equal(await hashFile(`${sourceDirectory}/${f.file}`), f.sha256)
  await copyFile(`${sourceDirectory}/${f.file}`, `${directory}/sbb/${f.file}`)
}
await copyFile(`${sourceDirectory}/sources.json`, `${directory}/sbb/sources.json`)
const policy = { schemaVersion: 1,
  asm: { sourceLine: '413', sourceOperator: 'ASm', routeId: '91-11-M-j26-1', agencyId: '81', line: 'S11', mode: 'rail',
    sourceFile: `${directory}/bern-413.json`, sha256: await hashFile(`${directory}/bern-413.json`), source: bern.metadata,
    limits: { snapMetres: 120, detourRatio: 3, detourFloorMetres: 1500, alternativeSnapMetres: 5 },
    method: 'Exact operator/line/route association to Bern feature 413. Original LV95 line graph; whole directed platform chain retained. No standard-gauge graph or invented connection.' },
  s29: { sourceLine: '450_S_b', sourceOperator: 'SBB', routeId: '91-29-j26-1', agencyId: '11', line: 'S29', mode: 'rail',
    sourceFile: `${directory}/bern-450_S_b.json`, sha256: await hashFile(`${directory}/bern-450_S_b.json`), source: bern.metadata,
    limits: { snapMetres: 120, detourRatio: 3, detourFloorMetres: 1500, alternativeSnapMetres: 5 },
    method: 'Exact SBB S29 line association to Bern feature 450_S_b. Retains complete timetable calls including Aarau–Olten reversals; shortest paths on this official line remain inferred.' },
  sbb: { sourceDirectory: `${directory}/sbb`, sourceSha256,
    limits: { stationAttachmentMetres: 100, detourRatio: 2, detourFloorMetres: 1500 },
    corridors: [{ id: 'daeniken-schoenenwerd', agencyId: '11',
      routes: [{ routeId: '91-23-j26-1', line: 'S23' }, { routeId: '91-26-j26-1', line: 'S26' }, { routeId: '91-29-j26-1', line: 'S29' },
        { routeId: '91-11-E-j26-1', line: 'SN11' }, { routeId: '91-6-W-j26-1', line: 'RE6' }, { routeId: '91-5F-Y-j26-1', line: 'IC' }],
      operatingPointIds: ['8502111', '8502112'], sourcePointCodes: ['DK', 'SCOE'],
      features: [[540, 'DK', 'DKO', 45673.43, 46100], [540, 'DKO', 'SCOE', 46100, 48129.6]] }],
    method: 'Only the two complete, graphically sampled SBB segments DK–DKO–SCOE, in either directed call order. Exact operating-point IDs and six reviewed original route identities. All full seasonal contexts must agree. No schematic records or arbitrary graph stitching.' },
  admission: 'These corridors supply only previously unmatched supplement pairs. Cantonal and already successful supplementary paths remain unchanged. No current running-track or diversion certification.' }
await writeFile('data/solothurn-corridor-policy.json', JSON.stringify(policy, null, 2) + '\n')
console.log('Prepared exact asm S11 and SBB Däniken–Schönenwerd source corridors')
