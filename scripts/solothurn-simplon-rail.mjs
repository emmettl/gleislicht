import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { simplonGraph } from './aargau-simplon-graph.mjs'
import { bernPatternId } from './bern-line-geometry.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const stop = s => ({ stop_id: s[4] === '8301003' ? '8501607' : s[4], stop_lon: s[0], stop_lat: s[1] })

export function solothurnSimplonMatcher(osm, stationPage, policy, context) {
  const records = stationPage.results.filter(r => r.number === 8501607)
  assert.equal(records.length, 1)
  const record = records[0]
  assert.equal(record.designationofficial, 'Domodossola'); assert.equal(record.fotcomment, 'Fahrplan unter 8301003 (Ausland)')
  assert.equal(record.operatingpointtechnicaltimetabletype, 'ASSIGNED_OPERATING_POINT')
  assert.equal(record.validfrom, '2024-12-15')
  assert.equal(hash(JSON.stringify(record)), policy.stationRecordSha256, 'Changed official station association')
  const crossing = osm.elements.find(e => e.type === 'way' && e.id === 643956810)
  assert.equal(hash(JSON.stringify(crossing)), policy.crossoverSha256, 'Changed reviewed Simplon crossover')
  assert.equal(crossing.tags.service, 'crossover'); assert.equal(crossing.tags.gauge, '1435')
  assert.equal(crossing.tags.passenger_lines, '2'); assert.equal(crossing.tags['tunnel:name'], 'Simplontunnel')
  assert.deepEqual(policy.graph.reviewedCrossoverWayIds, [643956810]); assert.equal(policy.graph.reviewedWays, undefined)
  const graph = simplonGraph(osm, policy.graph), patterns = new Map()
  const route = context.routes.find(r => r.id === policy.route.id)
  for (const [k, v] of Object.entries(policy.route)) assert.equal(route[k], v, 'Changed Simplon route identity')
  for (const day of context.snapshots) for (const train of day.trains.filter(t => t.routeId === route.id)) {
    const id = bernPatternId(train, day.stops), calls = train.stops.map(([i]) => day.stops[i])
    patterns.set(id, { id, directionId: train.directionId, stops: calls,
      foreignTerminal: calls.filter(s => s[4] === '8301003').length === 1 && [calls[0][4], calls.at(-1)[4]].includes('8301003') })
  }
  assert.deepEqual([...patterns.keys()].sort(), policy.patternIds, 'Changed complete Simplon scope')
  const pairs = policy.pairs.map(review => {
    const result = graph.match(stop(review.from), stop(review.to))
    assert(result.path, result.reason)
    assert.equal(hash(JSON.stringify(result.path)), review.pathSha256, 'Changed Simplon path')
    assert.equal(hash(JSON.stringify(result.directedSourceSegments)), review.segmentsSha256, 'Changed Simplon source-edge order')
    const crossoverUsed = result.directedSourceSegments.some(s => s.id === 'osm-way:643956810')
    assert.equal(crossoverUsed, review.crossoverUsed)
    const contexts = [...patterns.values()].filter(p => p.stops.some((s,i) => s[4] === review.from[4] && p.stops[i+1]?.[4] === review.to[4]))
    assert(contexts.length && contexts.every(p => p.foreignTerminal))
    for (const p of contexts) for (const expected of [review.from, review.to]) assert.deepEqual(p.stops.find(s => s[4] === expected[4]), expected)
    return { ...result, geometrySource: 'osm-solothurn-simplon-inference',
      fromOperatingPoint: review.from[4] === '8301003' ? '8301003' : result.fromOperatingPoint,
      toOperatingPoint: review.to[4] === '8301003' ? '8301003' : result.toOperatingPoint,
      sourceStationNumber: '8501607', crossoverUsed, geometrySha256: review.pathSha256,
      from: review.from, to: review.to, contextPatternIds: contexts.map(p => p.id).sort() }
  })
  return { inventory: graph.inventory, pairs, patterns: [...patterns.values()],
    identityEvidence: { recordNumber: record.number, timetableNumber: '8301003', comment: record.fotcomment, editionDate: record.editiondate, validFrom: record.validfrom },
    matchPattern(train, rawStops, candidateRoute, original) {
      if (!Object.entries(policy.route).every(([k,v]) => candidateRoute[k] === v)) return original
      const pattern = patterns.get(bernPatternId(train, rawStops))
      if (!pattern?.foreignTerminal) return original
      const calls = train.stops.map(([i]) => rawStops[i]); assert.deepEqual(calls, pattern.stops, 'Changed Simplon calls or coordinates')
      return original.map((value,i) => {
        if (value.path) return value
        const pair = pairs.find(p => p.from[4] === calls[i][4] && p.to[4] === calls[i+1][4])
        if (!pair) return value
        const { from, to, contextPatternIds, ...result } = pair
        return { ...result, reviewedPatternId: pattern.id, previousSupplementFailure: value.reason }
      })
    } }
}

export async function loadSolothurnSimplonRail(context) {
  const file = 'data/solothurn-simplon-policy.json', policy = JSON.parse(await readFile(file)), dir = policy.sourceDirectory
  assert.equal(await hashFile('data/solothurn-pattern-contexts.json.gz'), policy.contextSha256)
  assert.deepEqual(context.sourceHashes, policy.timetableSourceHashes)
  assert.equal(await hashFile(`${dir}/sources.json`), policy.sourceSha256)
  const source = JSON.parse(await readFile(`${dir}/sources.json`))
  for (const item of source.files) assert.equal(await hashFile(`${dir}/${item.file}`), item.sha256)
  assert((await readFile(`${dir}/rail.overpass`, 'utf8')).includes(`[date:"${policy.graph.snapshot}"]`))
  const matcher = solothurnSimplonMatcher(JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`))), JSON.parse(await readFile(`${dir}/sbb-domodossola-stations.json`)), policy, context)
  return { ...matcher, metadata: { policy, policySha256: await hashFile(file), source, identityEvidence: matcher.identityEvidence,
    patterns: matcher.patterns, pairEvidence: matcher.pairs.map(({path,directedSourceSegments,...p})=>({...p,directedSourceSegmentsSha256:hash(JSON.stringify(directedSourceSegments))})) } }
}
