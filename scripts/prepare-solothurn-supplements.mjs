import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { hashFile } from './solothurn-timetable.mjs'
const dir = 'data/solothurn-sources/supplements'
await mkdir(dir, { recursive: true })
const source = JSON.parse(gunzipSync(await readFile('data/bern-sources/decoded.json.gz')))
const boats = source.lines.filter(f => f.properties.liniencode === '3216')
assert.equal(boats.length, 1); assert.equal(boats[0].properties.tucode, 'BSG'); assert.equal(boats[0].properties.vkmtyp, 6)
await writeFile(`${dir}/boat-3216.json`, JSON.stringify(boats[0]))
for (const name of source.metadata.termsFiles) await copyFile(`data/bern-sources/${name}`, `${dir}/${name}`)
const cataloguePath = `${dir}/basel-sources.json`
const catalogueBytes = await readFile(cataloguePath).catch(() => readFile('/private/tmp/gleislicht-basel-sources/sources.json'))
await writeFile(cataloguePath, catalogueBytes)
const catalogue = JSON.parse(catalogueBytes)
const tram = catalogue.sources.find(s => s.layer === 'LN_Tramlinie')
const tramPath = '/private/tmp/gleislicht-basel-sources/LN_Tramlinie.geojson'
const tramBytes = await readFile(tramPath).catch(async () => gunzipSync(await readFile(`${dir}/basel-tram.geojson.gz`)))
assert.equal(createHash('sha256').update(tramBytes).digest('hex'), tram.sha256)
await writeFile(`${dir}/basel-tram.geojson.gz`, gzipSync(tramBytes, { mtime: 0 }))
const routes = JSON.parse(await readFile('data/solothurn-audit/routes.json'))
const rail = { sourceDirectory: 'data/zug-rail-sources', sourceSha256: '2895811c6c338cdc3d32e946d2861ce58ca72ddde7d700fe9b73f2c393f7b828', sourceMetadataSha256: 'deeaa5552be1c671511cee21d9ba2787d5787d008dda4d4a36b82d4d4e64462c', limits: { stationAttachmentMetres: 350, topologyAttachmentMetres: 120, detourRatio: 4.5, detourFloorMetres: 3000, simplificationMetres: 5 } }
const policy = { schemaVersion: 1,
  rail: { ...rail, routes: routes.filter(r => r.mode === 'rail' && ['11', '33', '68', '82'].includes(r.agencyId)).map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name })), method: "Exact operating-point number, standard gauge (mm1435) only, original declared topology. Every other scheduled operating point is blocked during each pair search. Paths are inferred infrastructure corridors; track assignment and 2026 validity remain unproven." },
  boat: { routeId: '94-321-6-j26-1', agencyId: '182', line: '3216', mode: 'ferry', file: `${dir}/boat-3216.json`, sha256: await hashFile(`${dir}/boat-3216.json`), source: source.metadata },
  tram: { routeId: '91-10-j26-1', agencyId: '37', line: '10', mode: 'tram', file: `${dir}/basel-tram.geojson.gz`, sha256: await hashFile(`${dir}/basel-tram.geojson.gz`),
    source: { ...tram, retrievedAt: catalogue.retrievedAt, validOn: null, attribution: 'Geodaten Kanton Basel-Stadt', metadataUrl: 'https://shop.geo.bs.ch/geodaten-katalog/',
      modelUrl: 'https://models.geo.bs.ch/Modellbeschreibungen/LN_LiniennetzOeV_KGDM_V1_0.pdf', termsUrl: 'https://www.bs.ch/news/2026-anpassung-der-kgeoiv',
      limits: { snapMetres: 80, detourRatio: 3, detourFloorMetres: 600, alternativeSnapMetres: 5 },
      note: 'Line/operator-specific official geometry, not running-track or diversion certification. No geometry effective date supplied.' } },
  priority: 'Retain admitted Solothurn source paths; use compatible reviewed route geometry or full-pattern road/rail consensus only for source gaps. Night services require a separate supplement on every segment.',
  direction: 'OSM road matching uses bus access/direction and supported turn restrictions. FOT enforces standard gauge and operating-point stop order. Neither certifies current operator itineraries or temporary diversions.' }
await writeFile('data/solothurn-supplement-policy.json', JSON.stringify(policy, null, 2) + '\n')
console.log(`Prepared boat/tram sources and ${policy.rail.routes.length} explicitly scoped standard-gauge rail records`)
