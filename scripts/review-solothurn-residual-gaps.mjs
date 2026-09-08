import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { bernPatternId } from './bern-line-geometry.mjs'
import { loadSolothurnSupplements } from './solothurn-supplement-geometry.mjs'
import { applySolothurnGeometry, solothurnGraphs, SO_LIMITS } from './solothurn-network-geometry.mjs'
import { reviewedRoadCorridor } from './solothurn-road-detours.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const json = async p => JSON.parse(await readFile(p))
const zipped = async p => JSON.parse(gunzipSync(await readFile(p)))
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const length = path => path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
const addedRoutes = ['91-17-B-j26-1', '91-81-A-j26-1']

export function assertPreservedPattern(before, after, paths) {
  for (const key of ['id', 'routeId', 'agencyId', 'line', 'directionId']) assert.equal(after[key], before[key])
  assert.deepEqual(after.stopIds, before.stopIds, 'Changed original complete stop chain')
  assert.equal(after.pathSegments.length, before.pathSegments.length)
  for (const [i, previous] of before.pathSegments.entries()) {
    const current = after.pathSegments[i] === null ? null : hash(paths[after.pathSegments[i]])
    if (previous !== null) assert.equal(current, previous, 'Changed previously selected geometry')
    else if (current !== null) assert(addedRoutes.includes(after.routeId), 'Unreviewed route gained geometry')
  }
  if (before.admittedTrips) assert(after.admittedTrips, 'Lost previously admitted full pattern')
}

export async function reviewSolothurnResidualGaps() {
  const contextPath = 'data/solothurn-pattern-contexts.json.gz', baselinePath = 'data/solothurn-seasonal-platform-baseline.json.gz'
  const context = await zipped(contextPath), baseline = await zipped(baselinePath)
  assert.deepEqual(baseline.sourceHashes, context.sourceHashes)
  const source = await zipped('data/solothurn-sources/decoded.json.gz'), supplements = await loadSolothurnSupplements(context, { verifyEvidence: true })
  const graph = solothurnGraphs(source.lines), routes = new Map(context.routes.map(r => [r.id, r])), cache = new Map()
  const previous = new Map(baseline.patterns.map(p => [p.id, p])), verified = new Map(), reviewed = []
  for (const raw of context.snapshots) {
    const result = applySolothurnGeometry(raw, routes, graph, cache, supplements)
    const trains = new Map(raw.trains.map(t => [bernPatternId(t, raw.stops), t]))
    for (const p of result.patterns) {
      const before = previous.get(p.id); assert(before, 'New context requires baseline review')
      assertPreservedPattern(before, p, result.paths); assert(!verified.has(p.id)); verified.set(p.id, p)
      if (addedRoutes.includes(p.routeId)) reviewed.push({ id: p.id, routeId: p.routeId, agencyId: p.agencyId, line: p.line, directionId: p.directionId,
        stops: trains.get(p.id).stops.map(([i]) => raw.stops[i]), beforeAdmitted: Boolean(before.admittedTrips), afterAdmitted: Boolean(p.admittedTrips),
        addedSegments: p.pathSegments.flatMap((index, i) => before.pathSegments[i] !== null || index === null ? [] : [{ fromId: p.stopIds[i], toId: p.stopIds[i + 1], path: result.paths[index], geometrySha256: hash(result.paths[index]) }]) })
    }
  }
  for (const pattern of reviewed) for (const segment of pattern.addedSegments) {
    const expected = pattern.routeId === '91-17-B-j26-1'
      ? [['ch:1:sloid:8005:2:2', 'ch:1:sloid:7000:55:50']]
      : [['ch:1:sloid:7493:0:470772', 'ch:1:sloid:7492:0:581416'], ['ch:1:sloid:7493:0:470772', 'ch:1:sloid:7492:0:460848']]
    assert(expected.some(([a, b]) => a === segment.fromId && b === segment.toId), 'Unreviewed seasonal platform pair')
  }
  assert.equal(verified.size, previous.size)
  assert.equal(reviewed.filter(p => p.routeId === addedRoutes[0]).length, 27)
  assert.equal(reviewed.filter(p => p.routeId === addedRoutes[1]).length, 5)
  assert.equal(reviewed.filter(p => !p.beforeAdmitted && p.afterAdmitted).length, 7)
  const seasonal = await zipped('data/solothurn-audit/seasonal-patterns.json.gz'), summary = await json('data/solothurn-audit/seasonal-summary.json')
  const stops = new Map(context.snapshots.flatMap(d => d.stops.map(s => [s[4], s])))
  const residualPairs = new Map(), days = []
  for (const day of seasonal) {
    const before = baseline.days.find(d => d.date === day.date), after = summary.days.find(d => d.date === day.date)
    const admitted = day.patterns.reduce((n, p) => n + p.admittedTrips, 0); assert.equal(admitted, after.admittedTrips)
    const additions = day.patterns.filter(p => p.admittedTrips && !previous.get(p.id).admittedTrips)
    assert(additions.every(p => addedRoutes.includes(p.routeId)))
    assert.equal(admitted - before.admittedTrips, additions.reduce((n, p) => n + p.admittedTrips, 0))
    const excludedByRoute = {}
    for (const p of day.patterns) {
      const expected = verified.get(p.id); assert(expected)
      assert.deepEqual(p.stopIds, expected.stopIds)
      assert.deepEqual(p.matchedMask, expected.pathSegments.map(i => i !== null))
      if (p.admittedTrips) continue
      excludedByRoute[p.routeId] = (excludedByRoute[p.routeId] ?? 0) + p.trips
      for (let i = 0; i < p.matchedMask.length; i++) if (!p.matchedMask[i]) {
        const key = JSON.stringify([p.routeId, p.stopIds[i], p.stopIds[i + 1]])
        const row = residualPairs.get(key) ?? { routeId: p.routeId, agencyId: p.agencyId, line: p.line, mode: p.mode,
          from: stops.get(p.stopIds[i]), to: stops.get(p.stopIds[i + 1]), patternIds: [], occurrencesByDate: {} }
        if (!row.patternIds.includes(p.id)) row.patternIds.push(p.id)
        row.occurrencesByDate[day.date] = (row.occurrencesByDate[day.date] ?? 0) + p.trips
        residualPairs.set(key, row)
      }
    }
    assert.equal(Object.values(excludedByRoute).reduce((n, v) => n + v, 0), after.trips - admitted)
    days.push({ date: day.date, beforeAdmitted: before.admittedTrips, admitted, addedJourneys: admitted - before.admittedTrips,
      addedPatterns: additions.map(p => ({ id: p.id, routeId: p.routeId, journeys: p.admittedTrips })), excludedJourneys: after.trips - admitted, excludedByRoute })
  }
  assert.equal(days.reduce((n, d) => n + d.addedJourneys, 0), 12)
  for (const date of ['2026-09-04', '2026-09-06']) assert.equal(days.find(d => d.date === date).addedJourneys, 0)
  const dir = 'data/solothurn-residual-sources', evidence = await json(`${dir}/sources.json`)
  for (const f of evidence.files) assert.equal(await hashFile(`${dir}/${f.file}`), f.sha256, 'Changed residual source evidence')
  const egerkingen = (await json('data/solothurn-road-detour-sources/egerkingen-rejected-review.json')).review
  const osm = await zipped('data/solothurn-road-detour-sources/osm.json.gz'), corridor = reviewedRoadCorridor(osm, egerkingen)
  const cantonal = matchBaselSegment(graph.get('bus'), egerkingen.from, egerkingen.to, { ...SO_LIMITS.bus, detourFloorMetres: 1400 })
  assert(cantonal.path && cantonal.pathMetres > 1300 && cantonal.pathMetres < 1400)
  const road = await zipped('data/solothurn-access-roads/cache.json.gz'), all = road.agencies.all
  const roadCandidates = egerkingen.roadPatternIds.map(id => {
    const stops = all.identities[id].stops; assert.equal(all.identities[id].routeId, egerkingen.routeId)
    const i = stops.findIndex((s, i) => s[4] === egerkingen.from[4] && stops[i + 1]?.[4] === egerkingen.to[4]); assert(i >= 0)
    const path = all.cache.paths[all.cache.patterns[id][i]]
    return { id, stops, path, pathMetres: length(path), geometrySha256: hash(path) }
  })
  return { schemaVersion: 1, baselineCommit: baseline.commit, baselineSha256: await hashFile(baselinePath), contextSha256: await hashFile(contextPath),
    sourceHashes: context.sourceHashes, sourceEvidenceSha256: await hashFile(`${dir}/sources.json`), evidence,
    method: 'Revalidate all 2,824 complete original contexts and preserve every prior non-null segment geometry hash. Add only reviewed BLS IR17 Bern terminal and SBB IC81 Interlaken platform associations, with existing full-pattern consensus and unchanged limits. Count excluded journeys once per route; failed-pair occurrences may overlap.',
    stationSources: { interlaken: supplements.metadata.railReview, bern: supplements.metadata.bernTerminal },
    verifiedCompleteContexts: verified.size, reviewed, days,
    residualPairs: [...residualPairs.values()],
    egerkingenAlternatives: { from: egerkingen.from, to: egerkingen.to, relationId: egerkingen.relationId, relationPath: corridor.path,
      relationPathMetres: length(corridor.path), fromStopGapMetres: distanceMetres(egerkingen.from, corridor.path[0]), toStopGapMetres: distanceMetres(egerkingen.to, corridor.path.at(-1)),
      cantonalCandidate: { ...cantonal, diagnosticOnly: true, detourFloorMetres: 1400, geometrySha256: hash(cantonal.path) },
      roadCandidates, decision: 'Excluded. The 2020 target-state plan does not confirm a completed route. The original relation stop position differs from the GTFS stop; no endpoint substitution or new detour override.' },
    remainingEvidenceNeeded: { arlesheim: 'Dated operator/platform evidence resolving the original tram platform E coordinate without inventing track geometry.',
      egerkingen: 'A dated operating itinerary and station boarding position to resolve the three conflicting approaches.',
      pieterlen: 'Direction-specific replacement-bus departure/turning evidence; the boarding/walking plan alone does not select either full-context alternative.',
      seasonal: 'Further original-platform and full-pattern reviews for the retained winter and summer residual pairs. No year-round certification.' } }
}
export function egerkingenComparisonSvg(a) {
  const rows = [{ label: `OSM bus relation: ${a.relationPathMetres.toFixed(1)} m`, path: a.relationPath, color: '#9333ea' },
    { label: `Cantonal network: ${a.cantonalCandidate.pathMetres.toFixed(1)} m`, path: a.cantonalCandidate.path, color: '#2563eb' },
    { label: `Road matcher: ${a.roadCandidates[0].pathMetres.toFixed(1)} m (3 contexts)`, path: a.roadCandidates[0].path, color: '#dc2626' }]
  const points = rows.flatMap(r => r.path), origin = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))]
  const metres = p => [(p[0] - origin[0]) * 111320 * Math.cos(origin[1] * Math.PI / 180), (p[1] - origin[1]) * 111320]
  const xy = points.map(metres), scale = Math.min(810 / Math.max(...xy.map(p => p[0])), 360 / Math.max(...xy.map(p => p[1])))
  const project = p => { const [x, y] = metres(p); return [75 + x * scale, 520 - y * scale] }
  const marker = (p, label, dx, dy) => { const [x, y] = project(p); return `<circle cx="${x}" cy="${y}" r="5" fill="#111827"/><text x="${x + dx}" y="${y + dy}" font-size="13">${label}</text>` }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="#fff"/><g font-family="Arial, sans-serif" fill="#111827"><text x="35" y="40" font-size="23" font-weight="bold">Egerkingen: three conflicting approaches</text><text x="35" y="66" font-size="14">Gäu Park → Bahnhof · original source coordinates · north up</text>
${rows.map((r, i) => `<line x1="35" y1="${96 + 22 * i}" x2="65" y2="${96 + 22 * i}" stroke="${r.color}" stroke-width="3"/><text x="75" y="${101 + 22 * i}" font-size="14">${r.label}</text>`).join('')}
${rows.map(r => `<polyline points="${r.path.map(p => project(p).map(n => n.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${r.color}" stroke-width="2.5" stroke-opacity="0.8"/>`).join('')}
${marker(a.from, 'GTFS Gäu Park', 10, 16)}${marker(a.to, 'GTFS Bahnhof', 10, 18)}${marker(a.relationPath.at(-1), 'OSM relation stop', -120, 22)}
<text x="35" y="568" font-size="14">All three remain excluded. The 1,400 m cantonal search is diagnostic only.</text><text x="35" y="592" font-size="12">Sources: Kanton Solothurn network (2025-12-17); © OpenStreetMap contributors, ODbL-1.0 (2026-09-02).</text><text x="35" y="615" font-size="12">Geographic comparison does not establish operating direction, current access or the correct itinerary.</text></g></svg>\n`
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const audit = await reviewSolothurnResidualGaps(), file = 'data/solothurn-audit/residual-gap-review.json'
  if (process.argv.includes('--check')) assert.deepEqual(await json(file), audit)
  else await writeFile(file, JSON.stringify(audit, null, 2) + '\n')
  const plot = egerkingenComparisonSvg(audit.egerkingenAlternatives), plotFile = 'data/solothurn-audit/egerkingen-alternatives.svg'
  if (process.argv.includes('--check')) assert.equal(await readFile(plotFile, 'utf8'), plot)
  else await writeFile(plotFile, plot)
  console.log(JSON.stringify({ verifiedContexts: audit.verifiedCompleteContexts, addedJourneys: audit.days.reduce((n, d) => n + d.addedJourneys, 0), residualDirectedPairs: audit.residualPairs.length, dates: audit.days.map(({ date, admitted, addedJourneys, excludedJourneys }) => ({ date, admitted, addedJourneys, excludedJourneys })) }))
}
