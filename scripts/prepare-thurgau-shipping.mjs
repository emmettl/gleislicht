import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
const dir = 'data/thurgau-shipping-sources', sha = b => createHash('sha256').update(b).digest('hex')
await mkdir(dir, { recursive: true })
if (process.argv.includes('--import')) for (const file of ['osm.json', 'query.txt', 'water.json', 'water-query.txt']) {
  const bytes = await readFile(`/private/tmp/thurgau-lake/${file}`), zipped = file.endsWith('.json')
  await writeFile(`${dir}/${file}${zipped ? '.gz' : ''}`, zipped ? gzipSync(bytes, { mtime: 0 }) : bytes)
}
const readOsm = async file => {
  const response = JSON.parse(gunzipSync(await readFile(`${dir}/${file}`))), elements = new Map()
  assert(!response.remark)
  for (const e of response.elements) { const k = `${e.type}:${e.id}`; if (elements.has(k)) assert.deepEqual(e, elements.get(k)); elements.set(k, e) }
  return { response, elements }
}
const ships = await readOsm('osm.json.gz'), water = await readOsm('water.json.gz')
const timetableBytes = await readFile('data/thurgau-audit/timetable-cache.json.gz'), timetable = JSON.parse(gunzipSync(timetableBytes))
const previousBytes = await readFile('data/thurgau-boat-sources/path-review.json'), previous = JSON.parse(previousBytes)
const stops = new Map(previous.patterns.flatMap(p => p.calls).map(s => [s[4], s]))
const definitions = [
  [66929232, 'ch:1:sloid:6112', 'ch:1:sloid:6110'], [1255664244, 'ch:1:sloid:6112', 'ch:1:sloid:30835'],
  [66929246, 'ch:1:sloid:6165', 'ch:1:sloid:30720'], [1255942854, '8014611', 'ch:1:sloid:6165'],
  [96604650, 'ch:1:sloid:6110', '8014650'], [66929242, 'ch:1:sloid:95982', 'ch:1:sloid:6112'],
  [25489146, 'ch:1:sloid:6150', 'ch:1:sloid:1101322'], [25489986, 'ch:1:sloid:1101322', 'ch:1:sloid:6152'],
]
const pairs = definitions.map(([wayId, a, b], i) => {
  const way = ships.elements.get(`way:${wayId}`); assert(way)
  const selected = [way, ...way.nodes.map(id => ships.elements.get(`node:${id}`))]
  return { wayId, from: stops.get(a), to: stops.get(b), water: i < 6 ? 'bodensee-2007' : 'rhine-osm',
    version: way.version, timestamp: way.timestamp, selectedElementsSha256: sha(JSON.stringify(selected)),
    limits: { snapMetres: i < 6 ? 120 : 25, alternativeSnapMetres: 0, detourRatio: 3, detourFloorMetres: 1200 }, dockZoneMetres: i === 3 ? 100 : i < 6 ? 25 : 10 }
})
const river = water.elements.get('relation:1679977'), members = river.members.map(m => water.elements.get(`way:${m.ref}`))
const riverNodes = [...new Set(members.flatMap(w => w.nodes))].map(id => water.elements.get(`node:${id}`))
const files = await Promise.all(['osm.json.gz', 'query.txt', 'water.json.gz', 'water-query.txt'].map(async file => ({ file, sha256: sha(await readFile(`${dir}/${file}`)) })))
const source = { publisher: 'OpenStreetMap contributors', attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', termsUrl: 'https://www.openstreetmap.org/copyright',
  endpoint: 'https://overpass-api.de/api/interpreter', snapshot: '2026-09-02T00:00:00Z', acquired: '2026-09-08', files,
  acquisition: { shippingBounds: [8.6, 47.45, 9.6, 47.78], waterBounds: [8.62, 47.68, 8.77, 47.71], shippingResponseElements: ships.response.elements.length, shippingUniqueElements: ships.elements.size, waterResponseElements: water.response.elements.length, waterUniqueElements: water.elements.size,
    scope: 'All ferry ways/relations and all natural-water/riverbank ways/relations intersecting the respective envelopes, with recursive members. All response duplicates agree. Referenced geometry extends beyond query envelopes; this is not a census of every real-world service or all OSM water in the canton.' },
  model: 'Exact named OSM ferry ways substitute only failed complete stop-to-stop segments within the original directed GTFS patterns. Successful official shipping segments remain unchanged. No cross-source mid-segment join, new water path, topology bridge or dock relocation. All calls are required for admission.',
  sourceIdentityLimit: 'Way 1255942854 is named Meersburg–Kreuzlingen but carries an URh operator tag, conflicting with this SBS GTFS route. It is used solely as cartographic connection evidence; operator identity comes from the exact GTFS route and public connection context, not that tag. All source tags remain preserved.',
  operatorContext: [
    { url: 'https://www.urh.ch/fahrplan_sommer_nw', checked: '2026-09-08', finding: 'Published low-water timetable runs Schaffhausen–Diessenhofen round trips from 27 June to 4 October 2026, while Diessenhofen–Stein am Rhein is interrupted. The original selected GTFS patterns already reflect that separation. No movement is inserted across the interrupted section.' },
    { url: 'https://stadtinfo.rorschach.ch/stadtrat/tageskarten-der-schifffahrtsbetriebe-zum-vorzugspreis/', checked: '2026-09-08', finding: 'City of Rorschach describes the SBS shore service through Romanshorn and Kreuzlingen to Meersburg. Used as connection/operator context, not source geometry or trip-level operating evidence.' },
  ],
  shoreline: { source: 'data/thurgau-boat-sources/lakes.json.gz', featureId: 124, dataStatus: '2007-01-01', attribution: '© FOEN, swisstopo', termsUrl: 'https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices' },
  river: { relationId: river.id, version: river.version, timestamp: river.timestamp, tags: river.tags, outerWayId: 122858269, innerWayIds: [937838731], outerVertices: members[0].nodes.length, innerVertices: members[1].nodes.length,
    limitation: 'OSM water area retains source=Landsat and one island hole. Edit date is not a survey date, water-level observation, depth model or navigability certification.' },
  vintage: 'Historical state requested 2 September 2026; acquired 8 September 2026. Selected way and node edit dates are retained in the inventory and original responses, with no independently verified survey or operating-lane date.' }
await writeFile(`${dir}/sources.json`, JSON.stringify(source, null, 2) + '\n')
const routeIds = ['94-380-0-j26-1', '94-380-1-j26-1', '94-382-0-j26-1']
const policy = { sourceSha256: sha(await readFile(`${dir}/sources.json`)), timetableSha256: sha(timetableBytes), previousBoatReviewSha256: sha(previousBytes), previousBoatPolicySha256: sha(await readFile('data/thurgau-boat-policy.json')),
  shorelineSha256: sha(await readFile(source.shoreline.source)), snapshot: source.snapshot, dates: timetable.snapshots.map(d => d.metadata.serviceDate),
  routes: timetable.routes.filter(r => routeIds.includes(r.id)).map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, type: r.type })),
  patterns: previous.patterns.filter(p => !p.admitted && routeIds.includes(p.routeId)).map(p => ({ routeId: p.routeId, agencyId: p.agencyId, line: p.line, directionId: p.directionId, calls: p.calls, days: p.days })), pairs,
  riverElementsSha256: sha(JSON.stringify([river, ...members, ...riverNodes])),
  scope: 'Only the 17 originally rejected full directed dock/coordinate patterns of three exact SBS/URh route identities. Use each successful original official segment unchanged; for a failed segment, only its exact reviewed OSM way is available. Any unresolved segment excludes the full journey. Previous admitted journeys and demand-responsive exclusions are preserved.',
  shorelineRule: 'Audit every source edge against all shoreline and island intersections. Lake OSM replacements use original Bodensee feature 124 with 120 m dock snaps and 25 m discrepancy zones except the explicitly reviewed Meersburg dock pair (100 m, below the original official 150 m policy); Rhine replacements use exact OSM relation 1679977 with its hole, 25 m snaps and 10 m discrepancy zones. Successful official segments retain their original 150 m policy. No remote outside-water interval is admitted.' }
assert.equal(policy.patterns.length, 17)
await writeFile('data/thurgau-shipping-policy.json', JSON.stringify(policy, null, 2) + '\n')
console.log({ patterns: policy.patterns.length, pairs: pairs.length, river: source.river })
