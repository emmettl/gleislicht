import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'

const sha = b => createHash('sha256').update(b).digest('hex')
const input = process.argv[2] ?? 'data/zug-sbb-rail-sources', output = 'data/thurgau-sbb-rail-sources'
const originalBytes = await readFile(`${input}/sources.json`), original = JSON.parse(originalBytes)
await mkdir(output, { recursive: true })
const files = original.files.filter(f => ['metadata.json', 'foreign-review.json', 'terms.html'].includes(f.file))
assert.equal(files.length, 3)
for (const f of files) {
  const bytes = await readFile(`${input}/${f.file}`)
  assert.equal(sha(bytes), f.sha256)
  await writeFile(`${output}/${f.file}`, bytes)
}
await writeFile(`${output}/parent-sources.json`, originalBytes)
const source = { ...original, files: [...files, { file: 'parent-sources.json', sha256: sha(originalBytes), url: null }],
  reusedOn: '2026-09-08', model: 'Two explicitly identified detailed SBB border-to-Konstanz curves joined to named FOT border nodes. Full ordered pattern routing, bounded endpoint connectors; no schematic records or nearest-network merges.' }
// This separately acquired query is exclusion evidence only, not admitted geometry.
const reviewBytes = await readFile(process.argv[3] ?? `${output}/bregenz-review.json`)
const review = JSON.parse(reviewBytes)
assert.equal(review.total_count, review.results.length)
assert(review.results.every(r => r.geo_shape.geometry.coordinates.length === 2))
await writeFile(`${output}/bregenz-review.json`, reviewBytes)
source.files.push({ file: 'bregenz-review.json', sha256: sha(reviewBytes), retrieved: '2026-09-08',
  url: 'https://data.sbb.ch/api/explore/v2.1/catalog/datasets/linie-mit-polygon/records?where=search%28%22Bregenz%22%29&limit=100',
  role: 'Excluded: every returned curve is schematic two-point geometry. Separate query acquisition; no feature survey date established.' })
await writeFile(`${output}/sources.json`, JSON.stringify(source, null, 2) + '\n')
const bytes = await readFile('data/thurgau-audit/timetable-cache.json.gz'), raw = JSON.parse(gunzipSync(bytes))
const routeIds = new Set(raw.snapshots.flatMap(d => d.trains.filter(t => t.stops.some(([i]) => d.stops[i][4] === '8014586')).map(t => t.routeId)))
const policy = { schemaVersion: 1, sourceSha256: sha(await readFile(`${output}/sources.json`)), timetableSha256: sha(bytes),
  limits: { sourceNodeAttachmentMetres: 10 },
  routes: raw.routes.filter(r => routeIds.has(r.id)).map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, gauge: 'mm1435' })).sort((a, b) => a.routeId.localeCompare(b.routeId)),
  foreignNode: { id: 'sbb:KODB', number: '8014586', name: 'Konstanz', sourceCode: 'KODB', coordinate: [9.177307662740644, 47.65805229481395] },
  segments: [
    { id: 'sbb:822:KRGR:KODB', feature: [822, 'KRGR', 'KODB', 61428.973, 61846.814], nodeId: 'ch14uvag00089372', number: '8518047', name: 'Kreuzlingen Grenze', vertices: 43 },
    { id: 'sbb:824:KHGR:KODB', feature: [824, 'KHGR', 'KODB', 100880.565, 101285.09], nodeId: 'ch14uvag00089349', number: '8518048', name: 'Kreuzlingen Hafen Grenze', vertices: 42 },
  ],
  scope: 'Exact six Konstanz-calling SBB/THURBO route identities on the pinned dates. Source KODB is explicitly crosswalked to GTFS 8014586; KRGR and KHGR remain separate FOT boundary identities. Konstanz station coordinate uses the line 822 source endpoint; line 824 has a measured bounded connector. All original full calls retained. Previously complete FOT/cantonal/road patterns take priority.' }
await writeFile('data/thurgau-sbb-rail-policy.json', JSON.stringify(policy, null, 2) + '\n')
console.log({ routes: policy.routes.length, segments: policy.segments.length })
