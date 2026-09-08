import { readFile, writeFile, stat } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseLuzernRail } from './luzern-rail-geometry.mjs'
import { sha256 } from './fribourg-timetable.mjs'
import { avryFeatureKey, fribourgAvryNetwork } from './fribourg-avry.mjs'

const json = async f => JSON.parse(await readFile(f))
const config = await json('data/fribourg-policy.json'), inputs = await json(config.rail.inputs)
const directory = 'data/fribourg-avry-sources', file = 'data/fribourg-avry-policy.json'
const previous = await json(file).catch(e => { if (e.code !== 'ENOENT') throw e; return { sources: [] } })
const network = parseLuzernRail(gunzipSync(await readFile(`${config.rail.sourceDirectory}/network.xtf.gz`)).toString(), config.rail.limits.simplificationMetres)
const sources = [], metadata = []
for (const dataset of ['linie-mit-polygon', 'perron', 'zugzahlen']) {
  const url = `https://data.sbb.ch/api/explore/v2.1/catalog/datasets/${dataset}`
  sources.push({ file: `${dataset}.json`, url: `${url}/records?where=search%28%22Avry%22%29&limit=100` }, { file: `${dataset}-metadata.json`, url })
  const m = (await json(`${directory}/${dataset}-metadata.json`)).metas
  metadata.push({ dataset, modified: m.default.modified, dataProcessed: m.default.data_processed, license: m.dcat_ap_ch.license, rights: m.dcat_ap_ch.rights })
}
sources.push({ file: 'opening-notice.html', url: 'https://www.fr.ch/dime/actualites/gare-routiere-et-parc-relais-a-la-future-halte-ferroviaire-davry-matran', documentDate: '2025-11-12', role: 'Canton announcement of planned commissioning on 14 December 2025; supporting temporal evidence only.' })
for (const s of sources) {
  s.sha256 = sha256(await readFile(`${directory}/${s.file}`))
  s.retrievedAt = previous.sources.find(p => p.file === s.file && p.sha256 === s.sha256)?.retrievedAt ?? (await stat(`${directory}/${s.file}`)).mtime.toISOString()
}
const pages = { curves: await json(`${directory}/linie-mit-polygon.json`), perron: await json(`${directory}/perron.json`), zugzahlen: await json(`${directory}/zugzahlen.json`) }
const node = { id: 'sbb-avry-8501632', number: '8501632', name: 'Avry-Matran', coordinate: pages.zugzahlen.results.find(r => r.von_bpuic === 8501632).verbindung.geometry.coordinates[0] }
const endpoints = ['8504028', '8504029'].map(number => [...network.nodes.values()].find(n => n.number === number))
const policy = { schemaVersion: 1, id: 'sbb-avry-operating-point', sourceDirectory: directory, sources, metadata, attribution: 'SBB Infrastructure / data.sbb.ch; Source: Etat de Fribourg (opening notice)',
  fotSha256: (await json(`${config.rail.sourceDirectory}/source.json`)).sha256, inputsSha256: config.rail.inputsSha256,
  openingDate: '2025-12-14', node, endpoints,
  replacedSegment: network.segments.find(s => s.id === 'ch14uvag00087311'),
  stops: inputs.stops.filter(s => s.stop_id.startsWith('ch:1:sloid:1632:')),
  routes: config.rail.routes.filter(r => r.routeId === '91-2B-Y-j26-1'),
  curves: pages.curves.results.map(r => ({ id: `sbb-250-${r.bp_anfang.toLowerCase()}-${r.bp_ende.toLowerCase()}`,
    feature: avryFeatureKey(r), vertices: r.geo_shape.geometry.coordinates.length,
    start: r.bp_anfang === 'AVRY' ? node.id : endpoints[0].id, end: r.bp_ende === 'AVRY' ? node.id : endpoints[1].id })),
  admission: 'Only SBB SN route 91-2B-Y-j26-1. Bind new operating point 8501632 to current SBB exact UIC identities and platform records; replace old Rosé–Matran edge with two detailed SBB normal-gauge curves in this route-local graph. Never use traffic-count two-point links as curves. Preserve all existing accepted pairs and every original call. All full directed contexts must agree under unchanged station/topology/detour guards. Source processing timestamps do not certify survey vintage or train-specific track paths.' }
fribourgAvryNetwork(network, config.rail, policy, pages)
await writeFile(file, JSON.stringify(policy, null, 2) + '\n')
config.rail.avry = { file, sha256: sha256(await readFile(file)) }
config.rail.admission = config.rail.admission.replace('Däniken and Bern terminal reviews', 'Däniken, Bern terminal and Avry operating-point reviews').replace('Däniken Bern terminal', 'Däniken, Bern terminal')
await writeFile('data/fribourg-policy.json', JSON.stringify(config, null, 2) + '\n')
console.log({ operatingPoint: node.number, curves: policy.curves.map(c => ({ id: c.id, vertices: c.vertices })), metadata })
