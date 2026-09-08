import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
const dir = 'data/thurgau-ferry-sources', sha = b => createHash('sha256').update(b).digest('hex')
await mkdir(dir, { recursive: true })
if (process.argv.includes('--import')) for (const file of ['osm.json', 'query.txt']) {
  const bytes = await readFile(`/private/tmp/thurgau-ferry/${file}`)
  await writeFile(`${dir}/${file === 'osm.json' ? file + '.gz' : file}`, file === 'osm.json' ? gzipSync(bytes, { mtime: 0 }) : bytes)
}
const osm = JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`))), elements = new Map()
assert(!osm.remark)
for (const e of osm.elements) {
  const key = `${e.type}:${e.id}`
  if (elements.has(key)) assert.deepEqual(elements.get(key), e)
  elements.set(key, e)
}
const way = elements.get('way:26255860'); assert(way)
const selected = [way, ...way.nodes.map(id => elements.get(`node:${id}`))]
const files = await Promise.all(['osm.json.gz', 'query.txt'].map(async file => ({ file, sha256: sha(await readFile(`${dir}/${file}`)) })))
const source = { publisher: 'OpenStreetMap contributors', attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', termsUrl: 'https://www.openstreetmap.org/copyright',
  endpoint: 'https://overpass-api.de/api/interpreter', snapshot: '2026-09-02T00:00:00Z', acquired: '2026-09-08', files,
  elementCount: elements.size, responseElementCount: osm.elements.length,
  acquisition: 'Historical ferry ways/relations intersecting the eastern lake envelope, with recursively referenced ways and nodes. Inventory of this response only, not a complete Lake Constance or Rhine OSM census.',
  model: 'One explicitly named OSM ferry way, traversed in original GTFS dock order for two exact SBS/BSB route identities. Source vertices retained between dock projections. Separate ODbL path database. Cartographic inference, not observed vessel movement or certified navigational lanes.',
  operatorContext: { url: 'https://www.bsb.de/de/fahrplan/bodensee-faehre', checked: '2026-09-08', publisher: 'Bodensee-Schiffsbetriebe GmbH',
    finding: 'The operator page identifies the Friedrichshafen–Romanshorn connection and joint BSB/SBS operation. Used for route identity only; no operator geometry or archived operating-status confirmation is supplied.' },
  shoreline: { source: 'data/thurgau-boat-sources/lakes.json.gz', featureId: 124, publisher: 'FOEN, swisstopo', attribution: '© FOEN, swisstopo', dataStatus: '2007-01-01', termsUrl: 'https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices' },
  vintage: { wayVersion: way.version, wayTimestamp: way.timestamp, selectedNodeTimestamps: [...new Set(selected.slice(1).map(n => n.timestamp))].sort(), limitation: 'OSM edit timestamps and requested historical state do not establish a survey date, 2026 shipping-lane validity or temporary operational changes.' } }
await writeFile(`${dir}/sources.json`, JSON.stringify(source, null, 2) + '\n')
const timetableBytes = await readFile('data/thurgau-audit/timetable-cache.json.gz'), timetable = JSON.parse(gunzipSync(timetableBytes))
const review = JSON.parse(await readFile('data/thurgau-boat-sources/path-review.json'))
const routeIds = ['94-381-0-j26-1', '94-381-A-j26-1']
const policy = { sourceSha256: sha(await readFile(`${dir}/sources.json`)), timetableSha256: sha(timetableBytes),
  previousBoatPolicySha256: sha(await readFile('data/thurgau-boat-policy.json')), previousBoatReviewSha256: sha(await readFile('data/thurgau-boat-sources/path-review.json')),
  shorelineSha256: sha(await readFile(source.shoreline.source)), shorelineFeatureId: 124,
  snapshot: source.snapshot, wayId: way.id, selectedElementsSha256: sha(JSON.stringify(selected)), wayVersion: way.version, wayTimestamp: way.timestamp,
  dates: timetable.snapshots.map(d => d.metadata.serviceDate),
  routes: timetable.routes.filter(r => routeIds.includes(r.id)).map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, type: r.type })),
  patterns: review.patterns.filter(p => routeIds.includes(p.routeId)).map(p => ({ routeId: p.routeId, agencyId: p.agencyId, line: p.line, directionId: p.directionId, calls: p.calls, days: p.days })),
  limits: { snapMetres: 10, alternativeSnapMetres: 0, detourRatio: 1.3, detourFloorMetres: 0 }, dockZoneMetres: 10,
  scope: 'Only the four original full two-dock direction/operator patterns of line 3810 after generalized official shipping geometry fails. Both actual GTFS dock coordinates, direction IDs, times and permissions remain unchanged. Existing admitted journeys retain their paths. No other ferry ways from this response are admitted.',
  shorelineRule: 'Every edge split at every original Bodensee shoreline/island intersection. Outside-water intervals must lie wholly within 10 m of one original endpoint dock and remain disclosed. Every other land interval rejects the full journey.' }
assert.equal(policy.routes.length, 2); assert.equal(policy.patterns.length, 4)
await writeFile('data/thurgau-ferry-policy.json', JSON.stringify(policy, null, 2) + '\n')
console.log({ sourceElements: elements.size, way: way.id, vertices: way.nodes.length, patterns: policy.patterns.length })
