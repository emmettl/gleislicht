import assert from 'node:assert/strict'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseLuzernRail } from './luzern-rail-geometry.mjs'
import { sha256 } from './fribourg-timetable.mjs'

const json = async file => JSON.parse(await readFile(file))
const directory = 'data/fribourg-rail-review-sources', config = await json('data/fribourg-policy.json')
const inputs = await json(config.rail.inputs), original = await json(`${config.rail.sourceDirectory}/source.json`)
const network = parseLuzernRail(gunzipSync(await readFile(`${config.rail.sourceDirectory}/network.xtf.gz`)).toString())
const metadata = await json(`${directory}/sbb-metadata.json`)
const previous = await json(`${directory}/sources.json`).catch(error => { if (error.code !== 'ENOENT') throw error; return { files: [] } })
const documents = [
  ['bls-platforms-2026.pdf', 'https://www.bls.ch/-/media/bls/pdf/uebrige-pdfs/trassen-netzzugang/infrastruktur-trassen-betriebspunkte.pdf', 'BLS platform table: state 2026-05-28, valid from 2026-06-06; Bern–Neuchâtel Kerzers physical tracks 4 and 6.'],
  ['bls-kerzers.svg', 'https://www.bls.ch/-/media/bls/bilder/fahren/fahrplan/lageplaene-ersatzverkehr/kerzers.svg', 'BLS station plan version 1.0, state 2023-03-09, valid 2023-03-11; tracks 4/6 on the western branch, distinct from 1/3. Layout evidence, not source geometry.'],
  ['sbb-daeniken.json', 'https://data.sbb.ch/api/explore/v2.1/catalog/datasets/linie-mit-polygon/records?where=search%28%22D%C3%A4niken%22%29&limit=100', 'Complete 21-record query; only line 540 DK→DKO is used, with 44 original vertices and normal-gauge N.'],
  ['sbb-metadata.json', 'https://data.sbb.ch/api/explore/v2.1/catalog/datasets/linie-mit-polygon', 'SBB source metadata and attribution-required licence.'],
  ['sbb-terms.html', 'https://data.sbb.ch/page/licence/', 'Retained SBB data reuse terms.'],
]
const files = await Promise.all(documents.map(async ([file, url, role]) => {
  const bytes = await readFile(`${directory}/${file}`)
  if (file.endsWith('.pdf')) assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
  if (file.endsWith('.svg')) assert(bytes.toString().includes('<svg'))
  const hash = sha256(bytes), retained = previous.files.find(f => f.file === file && f.sha256 === hash)
  return { file, url, role, sha256: hash, retrievedAt: retained?.retrievedAt ?? (await stat(`${directory}/${file}`)).mtime.toISOString() }
}))
const source = { publisher: 'SBB Infrastructure / BLS Netz AG', attribution: 'SBB Infrastructure / data.sbb.ch; BLS Netz AG (platform evidence)',
  termsUrl: 'https://data.sbb.ch/page/licence/', license: metadata.metas.dcat_ap_ch.license, rights: metadata.metas.dcat_ap_ch.rights,
  modified: metadata.metas.default.modified, dataProcessed: metadata.metas.default.data_processed,
  note: 'One detailed SBB geometry record and two reviewed BLS platform identities. Processing and document dates do not certify actual September running tracks or diversions.', files }
await writeFile(`${directory}/sources.json`, JSON.stringify(source, null, 2) + '\n')
const policy = { schemaVersion: 1, id: 'kerzers-bls-and-daeniken-sbb', sourceDirectory: directory, sourceSha256: sha256(await readFile(`${directory}/sources.json`)),
  fotSha256: original.sha256, inputsSha256: config.rail.inputsSha256, limits: config.rail.limits,
  routes: config.rail.routes.filter(r => ['91-66-A-j26-1', '91-1-D-j26-1'].includes(r.routeId)),
  kerzers: { routeId: '91-66-A-j26-1', sourceNumber: '8504400', node: network.nodes.get('ch14uvag00089383'),
    stops: ['ch:1:sloid:4400:2:4', 'ch:1:sloid:4400:3:6'].map(id => { const stop = inputs.stops.find(s => s.stop_id === id); assert(stop); return stop }),
    explanation: 'Only BLS IR66 calls on reviewed physical platforms 4/6 use FOT Kerzers BLS 8516192. Original GTFS IDs and coordinates remain unchanged; no SBB-side station merge or nearest-name substitution.' },
  daeniken: { routeId: '91-1-D-j26-1', id: 'sbb-540-dk-dko', feature: [540, 'DK', 'DKO', 45673.43, 46100], vertices: 44,
    nodes: ['ch14uvag00089021', 'ch14uvag00089022'].map(id => network.nodes.get(id)),
    originalSegment: network.segments.find(s => s.id === 'ch14uvag00087837'),
    explanation: 'FOT DK–DKO says mm1000. Retain that rejection unchanged; add the independent SBB N-gauge 44-vertex record for IC1 only. Other SBB query records are excluded from this review.' },
  admission: 'Fill only previously failed pairs with a complete-context consensus carrying the specific review evidence. Existing admitted geometry and all call identities/times remain unchanged. No global gauge correction or station-distance increase.' }
await writeFile('data/fribourg-rail-review-policy.json', JSON.stringify(policy, null, 2) + '\n')
config.rail.admission = config.rail.admission.replace('No nearest-station, operator-name or platform override.', 'No general nearest-station or operator-name substitution; only separately hashed Kerzers platform and SBB Däniken reviews may fill the original failures.')
config.rail.review = { file: 'data/fribourg-rail-review-policy.json', sha256: sha256(await readFile('data/fribourg-rail-review-policy.json')) }
await writeFile('data/fribourg-policy.json', JSON.stringify(config, null, 2) + '\n')
console.log('Pinned two Kerzers platforms and one independent SBB Däniken curve')
