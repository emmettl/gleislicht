import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'

const [rawPath, downloadDirectory] = process.argv.slice(2)
if (!rawPath || !downloadDirectory) throw new Error('Usage: node scripts/prepare-luzern-osm-boats.mjs TIMETABLE_JSON OSM_DOWNLOAD_DIRECTORY')
const json = async p => JSON.parse(await readFile(p)), save = async (p, x) => writeFile(p, `${JSON.stringify(x, null, 2)}\n`)
const rawBytes = await readFile(rawPath), raw = JSON.parse(rawBytes), inputs = await json('data/luzern-boat-inputs.json')
const main = await json('data/luzern-policy.json'), boats = await json(main.boatFallback.policyPath)
if (sha256(rawBytes) !== boats.timetableSha256) throw new Error('Changed frozen timetable')
const routeIds = new Set(inputs.inventory.map(r => r.routeId))
const scope = { routes: inputs.inventory, stops: inputs.stops, days: raw.snapshots.map(d => ({ date: d.date, trains: d.trains.filter(t => routeIds.has(t.routeId)) })) }
const sourceDirectory = 'data/luzern-osm-boat-sources'; await mkdir(sourceDirectory, { recursive: true })
const files = []
for (const [file, bytes] of [['query.txt', await readFile(`${downloadDirectory}/query.txt`)], ['ferries.json.gz', await readFile(`${downloadDirectory}/ferries.json`)], ['scope.json.gz', Buffer.from(JSON.stringify(scope))]]) {
  const packed = file.endsWith('.gz') ? gzipSync(bytes) : bytes
  await writeFile(`${sourceDirectory}/${file}`, packed); files.push({ file, sha256: sha256(packed), rawSha256: sha256(bytes) })
}
const osm = await json(`${downloadDirectory}/ferries.json`), elements = new Map(osm.elements.map(e => [`${e.type}/${e.id}`, e]))
const nodes = [984738514, 2393265378, 478073148, 670299349, 6686811677]
const ids = ['ch:1:sloid:8488', 'ch:1:sloid:8487', 'ch:1:sloid:8484', 'ch:1:sloid:8459', 'ch:1:sloid:8492:0:929446']
const docks = ids.map((id, i) => { const s = inputs.stops.find(s => s.stop_id === id); return { stopId: id, nodeId: nodes[i], uic: s.didok, maximumIdentityMetres: i === 3 ? 100 : 30, ...(i === 4 ? { platform: '3', osmName: 'Luzern Bahnhofquai 3' } : {}) } })
const point = id => { const s = inputs.stops.find(s => s.stop_id === id); return [+s.stop_lon, +s.stop_lat] }
const path = [point(ids[1]), ...elements.get('way/1355336513').nodes.map(id => elements.get(`node/${id}`)).map(n => [n.lon, n.lat]), point(ids[2])]
const policy = { schemaVersion: 1, sourceDirectory, files, snapshot: '2026-09-02T00:00:00Z', retrieved: '2026-09-09', endpoint: 'https://overpass-api.de/api/interpreter',
  attribution: '© OpenStreetMap contributors (ODbL-1.0)', license: 'ODbL-1.0', terms: 'https://www.openstreetmap.org/copyright', maximumDockMetres: 30, maximumMeanKmh: 25,
  binding: { routeId: '94-360-3-j26-1', agencyId: '185', line: '3603', operator: 'SGV', relationId: 18628404, wayId: 1355336513, patternId: 'a54c8947555d19d0ae31', fromId: ids[1], toId: ids[2], docks, geometrySha256: sha256(JSON.stringify(path)) },
  exclusions: [
    { route: '3600', reason: 'Source relations use Bahnhofquai dock 4; no reviewed dock-1 binding. Relation 18623434 names the operator Verkehrshaus, and 18615633 lacks an operator.' },
    { route: '3601', reason: 'Retained for further review; no whole-pattern geometry admission. Relation 18629129 lacks an operator. Hergiswil and Alpnachstad still exceed official geometry endpoint limits.' },
    { route: '3605', reason: 'Relation 18624219 names Saphir but has ref 3604 and calls Schweizerhofquai, not the distinct GTFS Bahnhofquai dock. No alias or route substitution.' },
    { route: 'all other relations/ways', reason: 'Retained source census only, including unrelated Zug, Ägeri and Beckenried–Gersau records; no general permission to reuse their paths.' },
  ] }
// Pin the immutable shoreline source catalogue independently of this supplement.
policy.shorelineSourceSha256 = boats.sourceSha256
await save('data/luzern-osm-boat-policy.json', policy)
boats.osmSupplement = { policyPath: 'data/luzern-osm-boat-policy.json', sha256: sha256(await readFile('data/luzern-osm-boat-policy.json')) }
await save(main.boatFallback.policyPath, boats)
main.boatFallback.sha256 = sha256(await readFile(main.boatFallback.policyPath)); await save('data/luzern-policy.json', main)
