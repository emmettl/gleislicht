import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { importRoadShapes } from './enrich-postbus-roads.mjs'

const source = 'Geofabrik Switzerland 2026-09-02 plus OSM border extract 2026-09-08; pfaedle 99f2cd466696ecc6bdb73b2b3bb9008557fcb84a'
const root = process.argv[2] ?? '/private/tmp/thurgau-city-road-matched'
const output = 'data/thurgau-city-roads'
const caches = {}, files = []
for (const id of ['727', '797']) {
  const directory = join(root, id), cache = await importRoadShapes(directory, source)
  assert.equal(cache.metadata.sourceSha256, 'd5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b')
  assert(Object.values(cache.patterns).every(p => p.every(i => i !== null)), 'Review every city-pattern rejection before replacing the complete pinned supplement')
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
  scope: 'Only agencies 727/797; full ordered platform-and-coordinate patterns from both dated fixtures. Frauenfeld NT excluded as demand-responsive.',
  model: 'Inferred OSM road paths; not operator-surveyed alignments or observed positions. Complete patterns only.',
  limits: caches['727'].metadata.limits, files }, caches }
await writeFile(join(output, 'cache.json.gz'), gzipSync(JSON.stringify(bundle)))
await writeFile(join(output, 'sources.json'), JSON.stringify(bundle.metadata, null, 2) + '\n')
console.log(Object.entries(caches).map(([id, c]) => ({ id, patterns: Object.keys(c.patterns).length, ...c.report })))
