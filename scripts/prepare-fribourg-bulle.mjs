import { readFile, writeFile, stat } from 'node:fs/promises'
import { sha256 } from './fribourg-timetable.mjs'
import { BULLE_ROUTES, BULLE_PAIRS, BULLE_CHAINS, BULLE_ANCHOR, decodeBulle, bulleReview } from './fribourg-bulle.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
const json = async f => JSON.parse(await readFile(f))
const config = await json('data/fribourg-policy.json'), cache = await json(config.roads.cacheFile)
const file = 'data/fribourg-bulle-policy.json', sourceDirectory = 'data/fribourg-bulle-sources'
const previous = await json(file).catch(e => { if (e.code !== 'ENOENT') throw e; return { sources: [] } })
const sources = [
  { file: 'map.osm.gz', url: 'https://www.openstreetmap.org/api/0.6/map?bbox=7.049,46.618,7.054,46.622', attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', role: 'Complete raw bbox response, deterministic gzip. Eight station-exit ways, three context ways, exact L/M stop-position identities and seven no-U-turn relations retained. Selected edits predate fixtures; survey vintage unknown.' },
  { file: 'tpf-platforms-2026.pdf', url: 'https://www.tpf.ch/Portals/0/Images/Fichiers/Horaires%20et%20plans/Interruptions/Plan%20des%20bus%20de%20remplacement/FER%202026/Bulle.pdf', attribution: 'TPF', created: '2026-02-09', role: 'Official 2026 station plan identifies 258 at L and 454 at M. Supports original platform labels and locality; no map geometry extracted or physical exit certified.' },
  { file: 'tpf-platforms-legacy.pdf', url: 'https://www.tpf.ch/Portals/0/Images/Fichiers/Horaires%20et%20plans/Interruptions/Plan%20des%20bus%20de%20remplacement/Bulle.pdf', attribution: 'TPF', role: 'Older numbered-platform plan retained as excluded acquisition evidence; not used for current L/M identity.' },
]
for (const s of sources) {
  const path = `${sourceDirectory}/${s.file}`, bytes = await readFile(path)
  if (s.file.endsWith('.pdf') && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Station document is not a PDF')
  s.sha256 = sha256(bytes); s.retrievedAt = previous.sources.find(p => p.file === s.file && p.sha256 === s.sha256)?.retrievedAt ?? (await stat(path)).mtime.toISOString()
}
const agency = cache.agencies['834'], patterns = Object.entries(agency.identities).filter(([, p]) => BULLE_ROUTES.includes(p.routeId)).map(([id, p]) => ({ id, ...p }))
const cases = BULLE_PAIRS.map((ids, i) => {
  const p = patterns.find(p => p.routeId === BULLE_ROUTES[i] && ids.every(id => p.stops.some(s => s[4] === id)))
  const index = p.stops.findIndex(s => s[4] === ids[0]), path = agency.cache.paths[agency.cache.patterns[p.id][index]]
  return { stops: p.stops.slice(index, index + 2), chain: BULLE_CHAINS[i], commonTail: path.slice(path.findIndex(p => JSON.stringify(p) === JSON.stringify(BULLE_ANCHOR))) }
})
const policy = { schemaVersion: 1, id: 'bulle-directed-platform-exit', sourceDirectory, sources, agencyId: '834', routeIds: BULLE_ROUTES,
  roadCacheSha256: config.roads.cacheSha256, dates: cache.metadata.dates, patterns, cases, commonTailSha256: sha256(JSON.stringify(cases[0].commonTail)),
  maximumAttachmentMetres: 6, maximumPrefixMetres: 220, maximumJoinMetres: 0.1, maximumDestinationMetres: 0.1,
  admission: 'Only original L/M departures on routes 258/454 to Vuadens. Follow each exact matching OSM stop-position forward through TPF bus-designated station roads, Chemin des Crêts and the directed roundabout exit to Route de la Pâla. Preserve every intervening source node. Original call attachment at most 6 m, local prefix 180–220 m, source join at most 0.1 m. All three full contexts per route must have the identical 25-vertex suffix beyond the fixed join; preserve that suffix byte-for-byte and append an at-most-0.1 m connector to the original seven-decimal Vuadens coordinate. Check seven retained no-U-turn relations against traversed transitions, including the onward southwest exit. General detour limits unchanged.',
  exclusions: ['Other routes, platforms, directions, full contexts or fixture dates', 'Differing paths beyond the fixed local review boundary', 'General tolerance for differing matcher outputs', 'Opposed one-way movement or prohibited source turns', 'Treating access=no as public access: selected TPF roads require explicit bus=designated', 'Using the older numbered-platform plan or claiming an operator-verified running lane'] }
const result = bulleReview(cache, roadConsensus(cache, config.roads.limits), policy, decodeBulle(`${sourceDirectory}/map.osm.gz`))
await writeFile(file, JSON.stringify(policy, null, 2) + '\n')
config.roads.bulle = { file, sha256: sha256(await readFile(file)) }
await writeFile('data/fribourg-policy.json', JSON.stringify(config, null, 2) + '\n')
console.log(result.audit.assessments.map(a => ({ key: a.key, prefixMetres: a.prefix.lengthMetres, attachmentMetres: a.prefix.attachmentMetres, joinMetres: a.prefix.joinMetres, lengthMetres: a.lengthMetres })))
