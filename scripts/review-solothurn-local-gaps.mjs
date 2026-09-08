import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { baselGraphs, matchBaselSegment } from './basel-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export async function solothurnLocalGapReview() {
  const sourcePath = 'data/solothurn-sources/decoded.json.gz', contextPath = 'data/solothurn-pattern-contexts.json.gz', roadPath = 'data/solothurn-road-cache.json'
  const source = JSON.parse(gunzipSync(await readFile(sourcePath))), context = JSON.parse(gunzipSync(await readFile(contextPath)))
  const stops = new Map(context.snapshots.flatMap(d => d.stops.map(s => [s[4], s])))
  const tram = JSON.parse(await readFile('data/solothurn-supplement-policy.json')).tram
  assert.equal(await hashFile(tram.file), tram.sha256)
  const collection = JSON.parse(gunzipSync(await readFile(tram.file))), graph = baselGraphs([collection]).get('37:tram:10')
  const from = stops.get('ch:1:sloid:88764:1:1'), to = stops.get('ch:1:sloid:77:1:5')
  const endpointIds = ['fdee9376-c614-4f36-b275-6d148c4a3d09', '4066c808-1c9b-4119-bef9-9dfa72651f9c']
  const endpoints = endpointIds.map(id => { const f = source.lines.find(f => f.properties.T_Ili_Tid === id)
    assert.equal(f.properties.verkehrsmittel, 'Bus'); assert.equal(f.properties.tunnel, 0)
    return { id, featureSha256: hash(f), part: 0, vertex: 0, coordinate: f.geometry.coordinates[0][0] } })
  const a = endpoints[0].coordinate, b = endpoints[1].coordinate
  const road = JSON.parse(await readFile(roadPath)).agencies.all, candidates = new Map()
  for (const [patternId, identity] of Object.entries(road.identities)) {
    if (identity.routeId !== '96-131-1-j26-1') continue
    for (let i = 1; i < identity.stops.length; i++) {
      if (identity.stops[i - 1][4] !== 'ch:1:sloid:3662:0:869147' || identity.stops[i][4] !== 'ch:1:sloid:72212:1:4') continue
      const pathIndex = road.cache.patterns[patternId][i - 1], path = road.cache.paths[pathIndex]
      assert(path)
      const sha256 = hash(path), row = candidates.get(sha256) ?? { sha256, pathIndex, path,
        metres: path.slice(1).reduce((n, p, j) => n + distanceMetres(path[j], p), 0), patternIds: [] }
      row.patternIds.push(patternId); candidates.set(sha256, row)
    }
  }
  return { schemaVersion: 1, purpose: 'Retained-source diagnostics only; no additional admission or geometry correction.',
    sourceHashes: { network: await hashFile(sourcePath), context: await hashFile(contextPath), road: await hashFile(roadPath), tram: tram.sha256 },
    arlesheim: { routeId: tram.routeId, agencyId: tram.agencyId, from, to, limits: tram.source.limits,
      assessment: matchBaselSegment(graph, from, to, tram.source.limits), decision: 'Excluded: original platform E exceeds the 80 m tram attachment limit; no coordinate substitution.' },
    liestal: { routeId: '96-131-1-j26-1', agencyId: '801', from: stops.get('ch:1:sloid:3662:0:869147'), to: stops.get('ch:1:sloid:72212:1:4'),
      endpoints, gapMetres: Math.hypot(a[0] - b[0], a[1] - b[1]), roadCandidates: [...candidates.values()],
      decision: 'Excluded: differing complete-pattern road candidates and a source-endpoint gap far above the separately reviewed 3 mm Oberbuchsiten limit. No route-specific operating evidence resolves the alternatives.' } }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await solothurnLocalGapReview()
  await writeFile('data/solothurn-audit/local-gap-review.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ arlesheimMetres: report.arlesheim.assessment.maximumSnapMetres, liestalGapMetres: report.liestal.gapMetres,
    liestalRoadMetres: report.liestal.roadCandidates.map(c => c.metres) }))
}
