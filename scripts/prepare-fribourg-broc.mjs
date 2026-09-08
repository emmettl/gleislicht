import { readFile, writeFile, stat } from 'node:fs/promises'
import { sha256 } from './fribourg-timetable.mjs'
import { BROC_ROUTE, BROC_STOPS, decodeBroc, brocReview } from './fribourg-broc.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
const json = async f => JSON.parse(await readFile(f))
const config = await json('data/fribourg-policy.json'), cache = await json(config.roads.cacheFile)
const file = 'data/fribourg-broc-policy.json', sourceDirectory = 'data/fribourg-broc-sources'
const previous = await json(file).catch(e => { if (e.code !== 'ENOENT') throw e; return { sources: [] } })
const sources = [
  { file: 'map.osm.gz', url: 'https://www.openstreetmap.org/api/0.6/map?bbox=7.095,46.602,7.103,46.607', attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', role: 'Complete retained raw bbox response, deterministic gzip. Road 1395561049 is the source; adjacent station roads are context only. All selected object edits predate the fixtures; edit dates are not survey dates.' },
  { file: 'tpf-platforms.pdf', url: 'https://www.tpf.ch/Portals/0/Images/Fichiers/Horaires%20et%20plans/Interruptions/Plan%20des%20bus%20de%20remplacement/Broc-Village.pdf', attribution: 'TPF', published: null, role: 'Visually reviewed official station plan identifies platform B for line 260 towards Charmey–Jaun. Publication date unknown. No map geometry extracted; arrival record 10 is not assigned to platform A.' },
  { file: 'tpf-260-2026.pdf', url: 'https://www.tpf.ch/Portals/0/Images/Fichiers/Horaires%20et%20plans/Horaires/Bus%20r%C3%A9gionaux/2026/260%20Gruy%C3%A8res%20-%20Jaun.pdf', attribution: 'TPF TRAFIC', validFrom: '2026-08-27', validUntil: '2026-12-12', role: 'Official timetable retains separate Broc arrival and departure rows. Supports call order and waiting interval; does not establish a physical shunting manoeuvre.' },
]
for (const s of sources) {
  s.sha256 = sha256(await readFile(`${sourceDirectory}/${s.file}`))
  s.retrievedAt = previous.sources.find(p => p.file === s.file && p.sha256 === s.sha256)?.retrievedAt ?? (await stat(`${sourceDirectory}/${s.file}`)).mtime.toISOString()
}
const patterns = Object.entries(cache.agencies['834'].identities).filter(([, p]) => p.routeId === BROC_ROUTE).map(([id, p]) => ({ id, ...p }))
const example = patterns.find(p => BROC_STOPS.every(id => p.stops.some(s => s[4] === id)))
const policy = { schemaVersion: 1, id: 'broc-station-calls', sourceDirectory, sources, agencyId: '834', routeId: BROC_ROUTE,
  roadCacheSha256: config.roads.cacheSha256, dates: cache.metadata.dates, patterns, stops: BROC_STOPS.map(id => example.stops.find(s => s[4] === id)),
  maximumAttachmentMetres: 10, maximumLengthMetres: 35,
  admission: 'Only original arrival record 10 → departure platform B (19835) in both contributing complete route-260 patterns, with exact Epagny Prâ Dêrê / Broc Le Home neighbours. Project the unchanged arrival coordinate onto directed OSM way 1395561049 and follow its remaining 5–20 m to source stop-position 3313999352. Each original call connector is at most 10 m, total geometry 15–35 m. Preserve both call times and the waiting interval. The short centreline section is an inferred geometric connection, not evidence that the bus moves throughout its wait. No generic short-path exemption, platform merging or assignment of unlabelled arrival 10 to platform A.',
  exclusions: ['Reverse direction and platform C remain unchanged', 'Station loop, platform-A assignment and invented turnaround', 'Other routes, changed full contexts or validation dates', 'Certifying the timetable waiting interval as physical movement time'] }
const result = brocReview(cache, roadConsensus(cache, config.roads.limits), policy, decodeBroc(`${sourceDirectory}/map.osm.gz`))
await writeFile(file, JSON.stringify(policy, null, 2) + '\n')
config.roads.broc = { file, sha256: sha256(await readFile(file)) }
await writeFile('data/fribourg-policy.json', JSON.stringify(config, null, 2) + '\n')
console.log(result.audit.geometry)
