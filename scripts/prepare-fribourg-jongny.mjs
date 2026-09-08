import { readFile, writeFile, stat } from 'node:fs/promises'
import { sha256 } from './fribourg-timetable.mjs'
import { decodeJongny, jongnyReview, JONGNY_ROUTES, JONGNY_STOPS } from './fribourg-jongny.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
const json = async f => JSON.parse(await readFile(f))
const config = await json('data/fribourg-policy.json'), cache = await json(config.roads.cacheFile)
const file = 'data/fribourg-jongny-policy.json', sourceDirectory = 'data/fribourg-jongny-sources'
const previous = await json(file).catch(e => { if (e.code !== 'ENOENT') throw e; return { sources: [] } })
const sources = [
  { file: 'map.osm.gz', url: 'https://www.openstreetmap.org/api/0.6/map?bbox=6.835,46.471,6.850,46.478', attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', role: 'Complete raw bbox response, deterministic gzip; ten detailed ways and three 2026 route relations independently specify the directed road chain.' },
  { file: 'vmcv-network-2026.pdf', url: 'https://vmcv.cdn.prismic.io/vmcv/aTqBp3NYClf9oDK-_VMCV-Planr%C3%A9seauH26.pdf', attribution: 'VMCV', timetableYear: 2026, validFrom: '2025-12-14', validUntil: '2026-12-12', role: 'Official schematic network plan: lines 213/216/217 and consecutive Châtillon / Cure d’Attalens stops. Identity evidence only; no geometry extracted.' },
]
for (const s of sources) {
  s.sha256 = sha256(await readFile(`${sourceDirectory}/${s.file}`))
  s.retrievedAt = previous.sources.find(p => p.file === s.file && p.sha256 === s.sha256)?.retrievedAt ?? (await stat(`${sourceDirectory}/${s.file}`)).mtime.toISOString()
}
const patterns = Object.entries(cache.agencies['876'].identities).filter(([, p]) => JONGNY_ROUTES.includes(p.routeId)).map(([id, p]) => ({ id, ...p }))
const example = patterns.find(p => p.stops.some(s => s[4] === JONGNY_STOPS[0]))
const policy = { schemaVersion: 1, id: 'jongny-route-chain', sourceDirectory, sources,
  roadCacheSha256: config.roads.cacheSha256, cantonalSourceSha256: sha256(await readFile('data/fribourg-sources/decoded.json.gz')), agencyId: '876', routeIds: JONGNY_ROUTES, dates: cache.metadata.dates,
  stops: JONGNY_STOPS.map(id => example.stops.find(s => s[4] === id)), patterns,
  maximumAttachmentMetres: 15, maximumLengthMetres: 2050,
  chain: [{"wayId": "33834623", "from": "3574221526", "to": "294654205", "direction": "forward"}, {"wayId": "26834441", "from": "294654205", "to": "294654202", "direction": "backward"}, {"wayId": "296774233", "from": "294654202", "to": "294654190", "direction": "backward"}, {"wayId": "353177811", "from": "294654190", "to": "330109326", "direction": "backward"}, {"wayId": "56058308", "from": "330109326", "to": "387420834", "direction": "backward"}, {"wayId": "26834440", "from": "387420834", "to": "11149836135", "direction": "backward"}, {"wayId": "1320550996", "from": "11149836135", "to": "12220444344", "direction": "forward"}, {"wayId": "26834438", "from": "12220444344", "to": "12220433894", "direction": "forward"}, {"wayId": "1320550993", "from": "12220433894", "to": "83324695", "direction": "forward"}, {"wayId": "1238158528", "from": "83324695", "to": "6763649067", "direction": "backward"}],
  relations: [{ id: '8291117', routeId: JONGNY_ROUTES[0] }, { id: '8291116', routeId: JONGNY_ROUTES[1] }, { id: '12495927', routeId: JONGNY_ROUTES[2] }],
  admission: 'Only three exact downhill platform pairs in all complete route contexts. Ten connected source ways must appear in the same order in all three exact j26 bus route relations. Preserve directions, source stop identities and calls; no intersecting returned restrictions or conditional access. A fixed 2050 m ceiling is scoped to this independently evidenced chain; general detour limits are unchanged. Both original cantonal and pfaedle failures remain retained. Inferred centreline geometry, not operator-certified running lanes or temporary access.',
  unavailableSources: [{ url: 'https://horaire26.vmcv.ch/ligne-213/', reason: 'Direct acquisition returned HTTP 403; not used as retained evidence.' }] }
const result = jongnyReview(cache, roadConsensus(cache, config.roads.limits), policy, decodeJongny(`${sourceDirectory}/map.osm.gz`))
await writeFile(file, JSON.stringify(policy, null, 2) + '\n')
config.roads.jongny = { file, sha256: sha256(await readFile(file)) }
await writeFile('data/fribourg-policy.json', JSON.stringify(config, null, 2) + '\n')
console.log({ patterns: patterns.length, lengthMetres: result.audit.geometry.lengthMetres, attachments: result.audit.geometry.attachmentsMetres })
