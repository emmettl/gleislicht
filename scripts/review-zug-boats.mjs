import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadZugBoats, auditZugBoatWater } from './zug-boat-geometry.mjs'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { distanceMetres } from './water-paths.mjs'
import { sha256 } from './download-luzern-sources.mjs'

// Diagnostic graph only. Keep original vertex/edge identities, and never join
// the ends of a removed edge. Conservative whole-edge removal can also remove
// usable partial edges; failure is not proof that no water-valid route exists.
export function waterFilteredBoatGraph(graph, polygons, docks, dockZoneMetres) {
  const blocked = []
  const edges = graph.edges.filter((edge, edgeIndex) => {
    const coordinates = [graph.points[edge.a], graph.points[edge.b]]
    const water = auditZugBoatWater(coordinates, polygons, docks, dockZoneMetres)
    if (water.landCrossing) blocked.push({ edgeIndex, coordinates, water })
    return !water.landCrossing
  })
  const retained = new Set(edges), adjacency = graph.points.map(() => [])
  for (const e of edges) { adjacency[e.a].push([e.b, e.length]); adjacency[e.b].push([e.a, e.length]) }
  return { graph: { ...graph, edges, adjacency, parts: graph.parts.map(part => part.filter(e => retained.has(e))).filter(part => part.length) }, blocked }
}

// Deliberately no admission API. Trial paths are retained only in the audit.
export async function reviewZugBoats(policy, boatPolicy, raw, timetableHash) {
  const bytes = await readFile(join(policy.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), policy.sourceSha256, 'Changed boat review catalogue')
  const source = JSON.parse(bytes)
  assert.equal(source.boatSourceSha256, boatPolicy.sourceSha256)
  assert.equal(source.timetableSha256, timetableHash, 'Changed boat review timetable')
  for (const file of source.files) assert.equal(sha256(await readFile(join(policy.sourceDirectory, file.file))), file.sha256, 'Changed boat review evidence')
  const fleet = await readFile(join(policy.sourceDirectory, 'fleet.html'), 'utf8')
  for (const [name, speed] of Object.entries(source.fleet.maximumKmh)) {
    const section = fleet.split(`Technische Daten Motorschiff ${name.replace('MS ', '')}`)[1]
    assert(section, 'Missing operator vessel specification')
    assert.equal(Number(section.match(/Geschwindigkeit maximal<\/td><td>(\d+) km\/h/)?.[1]), speed, 'Changed operator maximum speed')
  }
  const boats = await loadZugBoats(boatPolicy)
  const stops = new Map(raw.stops.map(s => [s.stop_id, s])), routes = new Map(raw.inventory.map(r => [r.routeId, r]))
  const failures = new Map(), results = new Map()
  for (const day of raw.snapshots) for (const train of day.trains) {
    const route = routes.get(train.routeId)
    if (route.mode !== 'boat') continue
    for (let i = 1; i < train.calls.length; i++) {
      const from = train.calls[i - 1], to = train.calls[i], key = JSON.stringify([route.routeId, from.id, to.id])
      if (!results.has(key)) results.set(key, boats.matchPair(route, stops.get(from.id), stops.get(to.id)))
      const original = results.get(key)
      if (original.path) continue
      assert.equal(original.reason, 'boat-land-crossing', 'New boat failure needs review')
      if (!failures.has(key)) failures.set(key, { original, intervals: [] })
      const seconds = to.arrival - from.departure
      assert(seconds > 0, 'Invalid boat source interval')
      failures.get(key).intervals.push({ date: day.date, tripId: train.id, sourceTripId: train.sourceTripId,
        sourceServiceDate: train.sourceServiceDate, fromSequence: from.sequence, toSequence: to.sequence, seconds })
    }
  }
  assert.deepEqual([...failures.keys()].sort(), source.pairs.map(p => JSON.stringify(p)).sort(), 'Changed complete boat failure scope')
  const lakes = JSON.parse(await readFile(join(boatPolicy.sourceDirectory, 'lakes.json')))
  const trials = []
  for (const [index, [routeId, fromId, toId]] of source.pairs.entries()) {
    const mapping = boatPolicy.routes.find(r => r.routeId === routeId), lake = boatPolicy.lakes.find(l => l.id === mapping.lake)
    const page = JSON.parse(await readFile(join(boatPolicy.sourceDirectory, `${lake.id}.json`)))
    const features = page.results.filter(f => lake.shippingFeatureIds.includes(f.id)), graph = lineGraph(features)
    const polygons = lake.shorelineFeatureIds.flatMap(id => lakes.results.find(f => String(f.id) === String(id)).geometry.coordinates)
    const docks = [fromId, toId].map(id => stops.get(id)).map(s => [Number(s.stop_lon), Number(s.stop_lat)])
    const filtered = waterFilteredBoatGraph(graph, polygons, docks, boatPolicy.dockZoneMetres)
    // lineGraph retains one part per LineString in exactly this source order.
    assert.equal(graph.parts.length, features.length)
    for (const edge of filtered.blocked) edge.sourceFeatureIds = features.flatMap((f, i) => graph.parts[i].includes(graph.edges[edge.edgeIndex]) ? [f.id] : [])
    const candidate = matchBaselSegment(filtered.graph, ...docks, boatPolicy.limits)
    assert(Number.isFinite(candidate.pathMetres) && candidate.pathMetres > 0, 'New alternate-path outcome needs review')
    const water = candidate.path ? auditZugBoatWater(candidate.path, polygons, docks, boatPolicy.dockZoneMetres) : null
    const fullPathMetres = candidate.path ? candidate.path.slice(1).reduce((n, p, i) => n + distanceMetres(candidate.path[i], p), 0) : null
    const failure = failures.get(JSON.stringify([routeId, fromId, toId]))
    trials.push({ routeId, fromId, toId, from: stops.get(fromId).stop_name, to: stops.get(toId).stop_name,
      original: failure.original, sourceEdgeCount: graph.edges.length, retainedEdgeCount: filtered.graph.edges.length,
      blockedEdges: filtered.blocked, candidate, water, fullPathMetres,
      geometrySha256: candidate.path ? sha256(JSON.stringify(candidate.path)) : null,
      intervals: failure.intervals.map(interval => ({ ...interval,
        // Matcher distance excludes dock connectors. A failed detour supplies
        // only that lower bound, not a validated full replacement geometry.
        graphMeanKmh: candidate.pathMetres * 3.6 / interval.seconds,
        fullPathMeanKmh: fullPathMetres === null ? null : fullPathMetres * 3.6 / interval.seconds })),
      decision: source.decisions[index] })
  }
  assert(trials[0].candidate.path && !trials[0].water.landCrossing, 'Changed Walchwil trial needs review')
  assert.equal(trials[1].candidate.reason, 'implausible-detour', 'Changed Risch trial needs review')
  return { source, trials, admittedFromTrials: 0 }
}
