import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { importRoadShapes } from './enrich-postbus-roads.mjs'

const source = 'Geofabrik Switzerland 2026-09-02 plus OSM border extract 2026-09-08; pfaedle 99f2cd466696ecc6bdb73b2b3bb9008557fcb84a'
const root = process.argv[2] ?? '/private/tmp/thurgau-regional-road-matched'
const output = 'data/thurgau-regional-roads'
const caches = {}, files = []
const reviewBytes = await readFile(join(output, 'review-sources.json'))
for (const id of ['138', '744', '801', '896']) {
  const directory = join(root, id), cache = await importRoadShapes(directory, source)
  assert.equal(cache.metadata.matcher.binarySha256, '6d193a755bc22c45516f8bce7594bb30e07a2632a5ef049a95915b262406cbd8')
  assert.equal(cache.metadata.matcher.configSha256, '31deee35fee9cb6fadc89cc5298e501a95cc4e8d78d7ae7fe6b60932cbf23db4')
  assert.equal(cache.metadata.matcher.osmSha256, 'd5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b')
  assert.equal(cache.metadata.sourceSha256, 'd5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b')
  caches[id] = cache
  for (const file of ['patterns.json', 'matching.log', 'shapes.txt', 'trips.txt', 'stop_times.txt', 'routing-run.json']) {
    const bytes = await readFile(join(directory, file)), path = `${id}/${file}.gz`
    await mkdir(join(output, id), { recursive: true })
    await writeFile(join(output, path), gzipSync(bytes))
    files.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
}
const bundle = { schemaVersion: 1, metadata: { publisher: 'OpenStreetMap contributors', license: 'ODbL-1.0',
  sourceUrl: 'https://www.openstreetmap.org/copyright', source, processedBy: 'Gleislicht',
  matchedOn: '2026-09-08', reviewNotes: { path: 'review-sources.json', sha256: createHash('sha256').update(reviewBytes).digest('hex') },
  scope: 'Only fixed bus patterns for agencies 138/744/801/896; full ordered platform-and-coordinate patterns from both dated fixtures. GTFS type 715 and reservation/on-demand services excluded. Complete official patterns take priority; no partial road pattern is admitted.',
  model: 'Inferred OSM road paths; not operator-surveyed alignments or observed positions. Complete patterns only.',
  limits: caches['138'].metadata.limits, files }, caches }
await writeFile(join(output, 'cache.json.gz'), gzipSync(JSON.stringify(bundle)))
await writeFile(join(output, 'sources.json'), JSON.stringify(bundle.metadata, null, 2) + '\n')
console.log(Object.entries(caches).map(([id, c]) => ({ id, patterns: Object.keys(c.patterns).length, ...c.report })))
