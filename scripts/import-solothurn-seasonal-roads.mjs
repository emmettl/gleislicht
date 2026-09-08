import assert from 'node:assert/strict'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { importRoadShapes } from './enrich-postbus-roads.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const directory = 'data/solothurn-seasonal-roads', matched = '/private/tmp/solothurn-seasonal-road-matched', feed = '/private/tmp/solothurn-seasonal-road-feed'
const graph = JSON.parse(await readFile(`${directory}/graph-source.json`)), selection = JSON.parse(await readFile(`${directory}/selection.json`))
const description = 'Geofabrik Switzerland 2026-09-02; Solothurn three-route seasonal service-road review with 20 m stop candidates'
const cache = await importRoadShapes(matched, description), input = JSON.parse(await readFile(`${matched}/patterns.json`))
assert.deepEqual(input.metadata, selection)
assert.equal(cache.metadata.matcher.osmSha256, graph.osmSha256)
assert.equal(cache.metadata.matcher.configSha256, await hashFile(`${directory}/routing.cfg`))
const evidence = {}, routingInput = {}
for (const name of ['patterns.json', 'matching.log', 'shapes.txt', 'trips.txt', 'stop_times.txt', 'routing-run.json']) evidence[name] = await readFile(`${matched}/${name}`, 'utf8')
for (const name of await readdir(feed)) routingInput[name] = await readFile(`${feed}/${name}`, 'utf8')
assert.equal(routingInput['patterns.json'], evidence['patterns.json'])
await writeFile(`${directory}/evidence.json.gz`, gzipSync(JSON.stringify(evidence)))
await writeFile(`${directory}/routing-input.json.gz`, gzipSync(JSON.stringify(routingInput)))
const files = {}
for (const name of ['parent-source.json', 'graph-source.json', 'selection.json', 'filter.cfg', 'routing.cfg', 'pfaedle-LICENSE', 'network.osm.gz', 'filtering.log.gz', 'filter-patterns.json.gz', 'routing-input.json.gz', 'evidence.json.gz']) files[name] = await hashFile(`${directory}/${name}`)
const source = { ...graph, description, matcher: cache.metadata.matcher, files, configurationAttribution: 'pfaedle configuration, University of Freiburg / Patrick Brosi et al., GPL v3; service-road and strict-candidate profile retained from the Luzern study. No access/direction/turn rules removed.' }
await writeFile(`${directory}/source.json`, JSON.stringify(source, null, 2) + '\n')
const wrapped = { schemaVersion: 1, metadata: { ...selection, source, attribution: graph.attribution, license: graph.license, licenseUrl: graph.licenseUrl },
  agencies: { all: { evidence: { file: `${directory}/evidence.json.gz`, sha256: files['evidence.json.gz'] }, patternsSha256: cache.metadata.matcher.patternsSha256,
    identities: Object.fromEntries(input.patterns.map(p => [p.id, { routeId: p.routeId, stops: p.stops.map(([i]) => input.stops[i]) }])), cache } } }
await writeFile(`${directory}/cache.json.gz`, gzipSync(JSON.stringify(wrapped)))
const all = roadConsensus(wrapped, { detourRatio: 3, detourFloorMetres: 600 }, source.osmSha256)
console.log(JSON.stringify({ patterns: input.patterns.length, issues: cache.report.issues.length, maximumImportedSnapMetres: cache.report.maxSnapMetres }))
// Reproduction preserves the reviewed pair scope; it never promotes a newly
// matching pair just because a fresh matcher run found a candidate.
const policyFile = 'data/solothurn-seasonal-road-policy.json', policy = JSON.parse(await readFile(policyFile))
for (const review of policy.pairs) {
  const candidate = all.get(JSON.stringify([review.routeId, review.fromId, review.toId]))
  assert(candidate?.path, 'Reviewed seasonal pair no longer has consensus')
  assert.equal(createHash('sha256').update(JSON.stringify(candidate.path)).digest('hex'), review.geometrySha256)
  assert.deepEqual(candidate.roadPatternIds, review.roadPatternIds)
}
policy.sourceSha256 = await hashFile(`${directory}/source.json`)
policy.cacheSha256 = await hashFile(`${directory}/cache.json.gz`)
await writeFile(policyFile, JSON.stringify(policy, null, 2) + '\n')
