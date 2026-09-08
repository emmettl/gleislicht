import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { importRoadShapes } from './enrich-postbus-roads.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const directory = process.argv[2] ?? '/private/tmp/graubuenden-access-matched', output = 'data/graubuenden-access-roads'
const parent = JSON.parse(await readFile(`${output}/graph-source.json`)), description = 'Preserved Geofabrik Switzerland 2026-09-02 service-road graph; 20 m pfaedle stop candidates; whole Graubünden rejected-route patterns'
const cache = await importRoadShapes(directory, description), files = {}
assert.equal(cache.metadata.sourceSha256, parent.osmSha256)
assert.equal(cache.metadata.matcher.configSha256, sha256(await readFile(`${output}/routing.cfg`)))
assert.equal(cache.metadata.matcher.binarySha256, parent.binarySha256)
for (const name of ['patterns.json', 'matching.log', 'shapes.txt', 'trips.txt', 'stop_times.txt', 'routing-run.json']) {
 const bytes = await readFile(`${directory}/${name}`); await writeFile(`${output}/${name}.gz`, gzipSync(bytes)); files[name] = sha256(bytes)
}
await writeFile(`${output}/cache.json.gz`, gzipSync(JSON.stringify(cache)))
const graphFiles = {}
for (const name of ['filter.cfg', 'routing.cfg', 'pfaedle-LICENSE', 'filtering.log.gz', 'filter-patterns.json.gz', 'parent-source.json']) graphFiles[name] = sha256(await readFile(`${output}/${name}`))
const rejectedReuse = JSON.parse(await readFile(`${output}/rejected-reuse/extent-review.json`))
await writeFile(`${output}/sources.json`, JSON.stringify({ description, attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', licenseUrl: 'https://www.openstreetmap.org/copyright',
 graphSourceSha256: sha256(await readFile(`${output}/graph-source.json`)), graph: parent, selectionSha256: sha256(await readFile(`${output}/selection.json`)), cacheSha256: sha256(await readFile(`${output}/cache.json.gz`)), files,
 scope: 'Inferred geometry from a Switzerland-only extract with service roads retained. No guarantee of foreign-road completeness, physical direction, seasonal access or operator-certified itinerary. Original access/turn rules remain; the primary whole-pattern feed takes priority.', graphFiles, rejectedReuse }, null, 2)+'\n')
console.log(JSON.stringify({ patterns: Object.keys(cache.patterns).length, matchedWholePatterns: Object.values(cache.patterns).filter(p => p.every(i => i !== null)).length, ...cache.report, issues: undefined, routes: undefined }))
