import { readFile, writeFile, stat } from 'node:fs/promises'
import { sha256 } from './fribourg-timetable.mjs'
import { BOLTIGEN_ROUTE, BOLTIGEN_PAIRS, decodeBoltigen, boltigenReview } from './fribourg-boltigen.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
const json = async f => JSON.parse(await readFile(f))
const config = await json('data/fribourg-policy.json'), cache = await json(config.roads.cacheFile)
const file = 'data/fribourg-boltigen-policy.json', sourceDirectory = 'data/fribourg-boltigen-sources'
const bern = await json(`${sourceDirectory}/bern-metadata.json`)
const previous = await json(file).catch(e => { if (e.code !== 'ENOENT') throw e; return { sources: [] } })
const sources = [
  { file: 'map.osm.gz', url: 'https://www.openstreetmap.org/api/0.6/map?bbox=7.343,46.590,7.356,46.598', attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', role: 'Complete retained raw bbox response, deterministic gzip. Detailed road 584938515 supplies both directed hairpin paths. Platform nodes are context, not exact original-platform equivalence. Object edits predate fixtures; survey dates unknown.' },
  { file: 'tpf-259-2026.pdf', url: 'https://www.tpf.ch/Portals/0/Images/Fichiers/Horaires%20et%20plans/Horaires/Bus%20r%C3%A9gionaux/2026/259%20Jaun%20-%20Boltigen.pdf', attribution: 'TPF TRAFIC', validFrom: '2025-12-14', validUntil: '2026-12-12', role: 'Official timetable supports original directed Schüpfboden / Schüpfen call order and one/two-minute intervals; no geometry extracted.' },
  { repositoryFile: 'data/bern-sources/oevtp.gpkg.zip', url: bern.sourceUrl, attribution: bern.attribution, license: bern.license, retrievedAt: bern.acquiredAt, dataUpdated: bern.dataUpdated, packagePublished: bern.packagePublished, role: 'Independently decode exact TPF line 20_259, objectid 300, from retained original 518-line GeoPackage. Diagnostic corroboration under unchanged Bern bus limits; emitted geometry comes from OSM. Geometry survey date unknown.' },
  ...['terms_of_use_de.pdf', 'metadata_oevtp_linie_de.pdf'].map(file => ({ file, url: bern.sourceUrl, attribution: bern.attribution, retrievedAt: bern.acquiredAt, role: 'Original document from retained Bern package: reuse terms or line metadata.' })),
  { file: 'bern-metadata.json', url: bern.metadataUrl, attribution: bern.attribution, retrievedAt: bern.acquiredAt, role: 'Retained Bern source metadata, dates, hashes and attribution.' },
]
for (const s of sources) {
  const path = s.repositoryFile ?? `${sourceDirectory}/${s.file}`
  s.sha256 = sha256(await readFile(path))
  s.retrievedAt ??= previous.sources.find(p => p.file === s.file && p.sha256 === s.sha256)?.retrievedAt ?? (await stat(path)).mtime.toISOString()
}
const patterns = Object.entries(cache.agencies['834'].identities).filter(([, p]) => p.routeId === BOLTIGEN_ROUTE).map(([id, p]) => ({ id, ...p }))
const pairs = BOLTIGEN_PAIRS.map(ids => ({ stops: ids.map(id => patterns.flatMap(p => p.stops).find(s => s[4] === id)) }))
const policy = { schemaVersion: 1, id: 'boltigen-corroborated-hairpins', sourceDirectory, sources, agencyId: '834', routeId: BOLTIGEN_ROUTE,
  roadCacheSha256: config.roads.cacheSha256, dates: cache.metadata.dates, patterns, pairs,
  maximumAttachmentMetres: 20, maximumLengthMetres: 1200, maximumComparisonMetres: 20,
  admission: 'Only the two original directed Schüpfboden / Schüpfen platform pairs in both complete TPF 259 patterns. Project unchanged original calls onto complete bidirectional secondary road 584938515, ref 219, and preserve every intervening source vertex. Original-call attachments at most 20 m; path 900–1200 m. Independently match Bern objectid 300 under unchanged 80 m / 4.5× / 1200 m bus limits; maximum vertex-to-other-polyline gap at most 20 m in both directions. Preserve primary road-excessive-detour failures. This is inferred OSM road geometry, not surveyed bus lanes.',
  exclusions: ['Other routes, changed full contexts or validation dates', 'Generic detour-limit relaxation or straightening hairpins', 'Exact GTFS-to-OSM platform equivalence or source height claims', 'Using Bern geometry as emitted OSM geometry', 'Certifying absence of restrictions outside the retained response'] }
const result = boltigenReview(cache, roadConsensus(cache, config.roads.limits), policy, decodeBoltigen(`${sourceDirectory}/map.osm.gz`))
await writeFile(file, JSON.stringify(policy, null, 2) + '\n')
config.roads.boltigen = { file, sha256: sha256(await readFile(file)) }
await writeFile('data/fribourg-policy.json', JSON.stringify(config, null, 2) + '\n')
console.log(result.audit.assessments.map(a => ({ key: a.key, lengthMetres: a.lengthMetres, attachments: a.attachments.map(p => p.gapMetres), comparison: [a.comparison.bernToOsmMetres, a.comparison.osmToBernMetres], vertices: a.path.length })))
