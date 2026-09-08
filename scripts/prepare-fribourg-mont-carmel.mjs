import { readFile, writeFile, stat } from 'node:fs/promises'
import { sha256 } from './fribourg-timetable.mjs'
import { decodeMontCarmel, montCarmelReview } from './fribourg-mont-carmel.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'

const json = async f => JSON.parse(await readFile(f))
const config = await json('data/fribourg-policy.json'), cache = await json(config.roads.cacheFile)
const file = 'data/fribourg-mont-carmel-policy.json', sourceDirectory = 'data/fribourg-mont-carmel-sources'
const previous = await json(file).catch(e => { if (e.code !== 'ENOENT') throw e; return { sources: [] } })
const sources = [
  { file: 'map.osm.gz', url: 'https://www.openstreetmap.org/api/0.6/map?bbox=7.132,46.808,7.141,46.815', attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', role: 'Complete raw bounding-box response, deterministic gzip; detailed directed road topology and stop identities.' },
  { file: 'tpf-agglo.html', url: 'https://www.tpf.ch/fr/horaires-et-reseaux/horaire-par-reseaux/agglo', attribution: 'TPF', role: 'Current operator line-3 Mont-Carmel–Charmettes identity, timetable valid from 2025-12-14; not proof of a terminal manoeuvre.' },
  { file: 'givisiez-works.html', url: 'https://www.givisiez.ch/article/deplacement-provisoire-de-larret-de-bus-mont-carmel-26052026', attribution: 'Commune de Givisiez', documentDate: '2026-05-26', role: 'Temporary stop displacement towards Belfaux on Route de la Chassotte; does not establish closure of the roundabout or justify moving the original GTFS stops.' },
]
for (const s of sources) {
  s.sha256 = sha256(await readFile(`${sourceDirectory}/${s.file}`))
  s.retrievedAt = previous.sources.find(p => p.file === s.file && p.sha256 === s.sha256)?.retrievedAt ?? (await stat(`${sourceDirectory}/${s.file}`)).mtime.toISOString()
}
const patterns = Object.entries(cache.agencies['834'].identities).filter(([, p]) => p.routeId === '92-3-A-j26-1').map(([id, p]) => ({ id, ...p }))
const policy = { schemaVersion: 1, id: 'mont-carmel-terminal', sourceDirectory, sources,
  roadCacheSha256: config.roads.cacheSha256, agencyId: '834', routeId: '92-3-A-j26-1', dates: cache.metadata.dates,
  stops: patterns.find(p => p.stops.at(-1)[4] === 'ch:1:sloid:87238:0:15108').stops.slice(-2), patterns,
  maximumAttachmentMetres: 15,
  chain: [{ wayId: '1097802067', from: '947021993', to: '292013103' }, { wayId: '55700630', from: '292013103', to: '699975410' }, { wayId: '1095950865', from: '699975410', to: '947021971' }],
  relations: [{ id: '2464722', stopNode: '947021993', role: 'stop_exit_only' }, { id: '12589725', stopNode: '947021993', role: 'stop_exit_only' }, { id: '1224330', stopNode: '947021971', role: 'stop_entry_only' }, { id: '12589724', stopNode: '947021971', role: 'stop_entry_only' }],
  admission: 'One exact final directed pair on TPF 3, in every complete contributing pattern. Three original OSM ways, shared node identity, forward-only one-way/roundabout traversal, trolley wires and no intersecting returned turn restrictions. Preserve both original calls and coordinates; no collapsing duplicate stop names. Inferred centreline movement, not operator-certified running lanes or a guarantee of temporary access. Route-relation j23 references are historical identity evidence only.' }
const review = montCarmelReview(cache, roadConsensus(cache, config.roads.limits), policy, decodeMontCarmel(`${sourceDirectory}/map.osm.gz`))
await writeFile(file, JSON.stringify(policy, null, 2) + '\n')
config.roads.montCarmel = { file, sha256: sha256(await readFile(file)) }
await writeFile('data/fribourg-policy.json', JSON.stringify(config, null, 2) + '\n')
console.log({ fullPatterns: patterns.length, contributingPatterns: review.audit.contributingPatterns.length, lengthMetres: review.audit.geometry.lengthMetres, attachments: review.audit.geometry.attachmentsMetres })
