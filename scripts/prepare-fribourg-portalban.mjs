import { readFile, writeFile, stat } from 'node:fs/promises'
import { sha256 } from './fribourg-timetable.mjs'
import { PORTALBAN_ROUTE, PORTALBAN_PAIRS, decodePortalban, portalbanReview } from './fribourg-portalban.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
const json = async f => JSON.parse(await readFile(f))
const config = await json('data/fribourg-policy.json'), cache = await json(config.roads.cacheFile)
const file = 'data/fribourg-portalban-policy.json', sourceDirectory = 'data/fribourg-portalban-sources'
const previous = await json(file).catch(e => { if (e.code !== 'ENOENT') throw e; return { sources: [] } })
const sources = [
  { file: 'map.osm.gz', url: 'https://www.openstreetmap.org/api/0.6/map?bbox=6.953,46.916,6.958,46.920', attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', role: 'Complete retained raw bbox response, deterministic gzip. Three named residential/tertiary streets provide detailed geometry. Two village platform records are context only; no source school platform or physical turnaround is established. Object edits predate fixtures; survey dates unknown.' },
  { file: 'tpf-544-2026.pdf', url: 'https://www.tpf.ch/Portals/0/Images/Fichiers/Horaires%20et%20plans/Horaires/Bus%20r%C3%A9gionaux/2026/544%20Fribourg%20-%20Avenches%20-%20Domdidier%20-%20Gletterens.pdf', attribution: 'TPF TRAFIC', validFrom: '2025-12-14', validUntil: '2026-12-12', role: 'Annual PDF currently linked by TPF, created 2025-10-16; supports school/village call order and one-minute intervals. Published validity covers both fixtures but is not a certification of all later timetable changes. No map geometry extracted.' },
  { file: 'tpf-timetable-redirect.html', url: 'https://www.tpf.ch/Portals/0/Images/Fichiers/Horaires%20et%20plans/Horaires/Bus%20r%C3%A9gionaux/2026/544%20Fribourg%20-%20Avenches%20-%20Domdidier%20-%20Gletterens_valable%20d%C3%A8s-g%C3%BCltig%20ab%2017.08.26.pdf', attribution: 'TPF', role: 'Failed indexed timetable URL redirected to TPF re404 HTML. Retained as failed acquisition evidence; not used as a PDF or timetable.' },
  { file: 'tpf-regional-page.html.gz', url: 'https://www.tpf.ch/fr/horaires-et-reseaux/horaire-par-reseaux/bus-regionaux', attribution: 'TPF', role: 'Retained official page linking the annual line-544 PDF.' },
]
for (const s of sources) {
  const path = `${sourceDirectory}/${s.file}`
  s.sha256 = sha256(await readFile(path))
  s.retrievedAt = previous.sources.find(p => p.file === s.file && p.sha256 === s.sha256)?.retrievedAt ?? (await stat(path)).mtime.toISOString()
}
if (!(await readFile(`${sourceDirectory}/tpf-544-2026.pdf`)).subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('TPF timetable is not a PDF')
const patterns = Object.entries(cache.agencies['834'].identities).filter(([, p]) => p.routeId === PORTALBAN_ROUTE).map(([id, p]) => ({ id, ...p }))
const pairs = PORTALBAN_PAIRS.map(ids => ({ stops: ids.map(id => patterns.flatMap(p => p.stops).find(s => s[4] === id)) }))
const policy = { schemaVersion: 1, id: 'portalban-school-streets', sourceDirectory, sources, agencyId: '834', routeId: PORTALBAN_ROUTE,
  roadCacheSha256: config.roads.cacheSha256, dates: cache.metadata.dates, patterns, pairs,
  maximumAttachmentMetres: 10, maximumLengthMetres: 130,
  admission: 'Only the two original school/village directed pairs in all complete TPF 544 contexts. Reconstruct Chemin du Four, Chemin du Ruisseau and La Râpe from three complete named OSM street ways, with exact source-node joins and every intervening vertex. Project unchanged school/village coordinates onto their specific streets with at most 10 m connectors and 90–130 m total geometry. Preserve all differing primary matcher paths. This is road-centreline inference, not surveyed platform access or a physical turnaround.',
  exclusions: ['Other routes, changed full contexts or validation dates', 'Generic tolerance for differing matcher paths', 'Merging original platform identities or coordinates', 'Invented school turnaround, driveway access or bus-lane claims', 'Certifying absence of restrictions outside the retained response'] }

const result = portalbanReview(cache, roadConsensus(cache, config.roads.limits), policy, decodePortalban(`${sourceDirectory}/map.osm.gz`))
await writeFile(file, JSON.stringify(policy, null, 2) + '\n')
config.roads.portalban = { file, sha256: sha256(await readFile(file)) }
await writeFile('data/fribourg-policy.json', JSON.stringify(config, null, 2) + '\n')
console.log(result.audit.assessments.map(a => ({ key: a.key, lengthMetres: a.lengthMetres, attachments: a.attachments.map(p => p.gapMetres), vertices: a.path.length })))
