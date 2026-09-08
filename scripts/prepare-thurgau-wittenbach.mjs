import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
const dir = 'data/thurgau-wittenbach-sources', sha = b => createHash('sha256').update(b).digest('hex')
await mkdir(dir, { recursive: true })
if (process.argv.includes('--import')) for (const [target, original] of [['osm.json.gz', 'osm.json'], ['query.txt', 'query.txt'], ['restrictions.json.gz', 'restrictions.json'], ['restrictions-query.txt', 'restrictions-query.txt']]) {
  const bytes = await readFile(`/private/tmp/thurgau-wittenbach-${original}`)
  await writeFile(`${dir}/${target}`, target.endsWith('.gz') ? gzipSync(bytes, { mtime: 0 }) : bytes)
}
const osm = JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`))), elements = new Map()
for (const e of osm.elements) {
  const key = `${e.type}:${e.id}`
  if (elements.has(key)) assert.deepEqual(e, elements.get(key))
  elements.set(key, e)
}
const files = []
for (const file of ['osm.json.gz', 'query.txt', 'restrictions.json.gz', 'restrictions-query.txt']) files.push({ file, sha256: sha(await readFile(`${dir}/${file}`)) })
const source = { publisher: 'OpenStreetMap contributors', attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', termsUrl: 'https://www.openstreetmap.org/copyright',
  endpoint: 'https://overpass-api.de/api/interpreter', snapshot: '2026-09-02T00:00:00Z', acquired: '2026-09-08', files, elementCount: elements.size,
  method: 'Explicit original-road turnaround inference between two original Wittenbach Zentrum platforms, using the full mapped roundabout in source traffic direction. No new street, loop or platform coordinate is drawn. Route relations support the approach and terminus, not the complete two-call turnaround. No operator, lane, diversion or operational certification.',
  restrictionReview: 'All restriction relations referencing either selected way were queried at the same historical timestamp. Relation 14866387 only_right_turn starts on residential way 697567549 at node 7826558259; the scoped turnaround never enters from that way or reaches that node.',
  routeRelationLimit: 'OSM 200/207 arrivals include the approach and roundabout; departures start at the other source stop position and omit the turnaround. The two-call GTFS sequence is retained, and the intervening movement remains explicitly inferred.' }
await writeFile(`${dir}/sources.json`, JSON.stringify(source, null, 2) + '\n')
const timetable = JSON.parse(gunzipSync(await readFile('data/thurgau-audit/timetable-cache.json.gz')))
const oldReview = JSON.parse(await readFile('data/thurgau-audit/wittenbach-review.json'))
const pin = (type, id) => {
  const e = elements.get(`${type}:${id}`); assert(e)
  return { type, id, version: e.version, timestamp: e.timestamp, sha256: sha(JSON.stringify(e)) }
}
const policy = { sourceSha256: sha(await readFile(`${dir}/sources.json`)), timetableSha256: sha(await readFile('data/thurgau-audit/timetable-cache.json.gz')),
  regionalRoadsSha256: sha(await readFile('data/thurgau-regional-roads/cache.json.gz')), previousReviewSha256: sha(await readFile('data/thurgau-audit/wittenbach-review.json')),
  snapshot: source.snapshot, wayIds: [1111858974, 26647200], sharedNode: 292227795,
  features: [pin('way', 1111858974), pin('way', 26647200), ...[17128888, 17128889, 16238506, 16238511].map(id => pin('relation', id))],
  from: oldReview.patterns[0].from, to: oldReview.patterns[0].to,
  patterns: oldReview.patterns.map(p => ({ roadPatternId: p.roadPatternId, routeId: p.routeId, agencyId: '801', directionId: '1', line: timetable.routes.find(r => r.id === p.routeId).name })),
  limits: { attachmentMetres: 15, maximumRoadMetres: 400, minimumRoadMetres: 150 },
  scope: 'Only segment zero of the four preserved full 200/207 patterns, after the original matcher records missing-shape and equal zero shape distances. Every subsequent segment must exist in that exact original pattern cache; no cross-pattern borrowing or reverse-pair override. Original GTFS platforms, calls, permissions and times are unchanged.' }
await writeFile('data/thurgau-wittenbach-policy.json', JSON.stringify(policy, null, 2) + '\n')
console.log({ sourceElements: elements.size, reviewedWays: policy.wayIds, patterns: policy.patterns.length })
