import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { thurgauBorderGraph } from './thurgau-border-rail.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

const vertexGap = (point, path) => Math.min(...path.slice(1).map((b, i) => {
  const a = path[i], scale = Math.cos(point[1] * Math.PI / 180), dx = (b[0] - a[0]) * scale, dy = b[1] - a[1]
  const t = dx || dy ? Math.max(0, Math.min(1, ((point[0] - a[0]) * scale * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0
  return distanceMetres(point, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
}))

export function zugComoMatcher(osm, policy, scope) {
  assert.equal(policy.reviewedWays, undefined, 'No siding exceptions reviewed for Como')
  const graph = thurgauBorderGraph(osm, policy), stops = new Map(scope.stops.map(s => [s.stop_id, s]))
  const patterns = new Map(scope.patterns.map(p => [p.key, p.id]))
  const pairs = policy.pairs.map(pair => {
    const result = graph.match(...pair.stopIds.map(id => stops.get(id)))
    assert(result.path, `Como source path failed: ${result.reason}`)
    assert.equal(sha256(JSON.stringify(result.path)), pair.pathSha256, 'Changed Como source path')
    const ways = [...new Set(result.directedSourceSegments.map(s => Number(s.id.split(':')[1])))]
    assert.deepEqual(ways, pair.sourceWayIds, 'Changed directed Como way chain')
    for (const id of ways) {
      const way = graph.inventory.find(w => w.id === id)
      assert.equal(way.tags.usage, 'main')
      assert.equal(way.tags.service, undefined, 'No yards, sidings or crossover exceptions')
      assert(Number(way.tags.passenger_lines) > 0, 'Missing passenger corridor evidence')
    }
    const tunnel = graph.inventory.find(w => w.id === pair.tunnelWayId)
    assert(ways.includes(tunnel.id), 'Missing Monte Olimpino I passage')
    assert.equal(tunnel.tags.name, 'Monte Olimpino 1')
    assert.equal(tunnel.tags['tunnel:name'], 'Chiasso Olimpino I')
    assert.equal(tunnel.tags.tunnel, 'yes')
    return { stopIds: pair.stopIds, ...result, geometrySource: 'osm-como-rail-inference', corridor: 'chiasso-como-olimpino-i',
      sourceWayIds: ways, tunnelWayId: pair.tunnelWayId, geometrySha256: pair.pathSha256 }
  })
  return { inventory: graph.inventory, pairs,
    matchPair(original, route, train, from, to) {
      if (original.path || original.reason !== 'rail-no-exact-operating-point') return original
      if (!['routeId', 'agencyId', 'line', 'mode', 'routeType'].every(k => route[k] === policy.route[k])) return original
      const reviewedPatternId = patterns.get(directedPatternKey(train))
      if (!reviewedPatternId) return original
      const pair = pairs.find(p => p.stopIds[0] === from.stop_id && p.stopIds[1] === to.stop_id)
      if (!pair) return original
      for (const stop of [from, to]) for (const field of ['didok', 'stop_lon', 'stop_lat']) assert.equal(stop[field], stops.get(stop.stop_id)[field], 'Changed Como stop identity or coordinate')
      const { stopIds: _stopIds, ...result } = pair
      return { ...result, reviewedPatternId, primaryFailure: original }
    } }
}

export async function loadZugComoRail(policy, raw, timetableHash) {
  const bytes = await readFile(join(policy.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), policy.sourceSha256, 'Changed Como source catalogue')
  const source = JSON.parse(bytes)
  for (const f of source.files) assert.equal(sha256(await readFile(join(policy.sourceDirectory, f.file))), f.sha256, `Changed Como source ${f.file}`)
  assert.equal(policy.snapshot, source.snapshot)
  assert((await readFile(join(policy.sourceDirectory, 'query.txt'), 'utf8')).includes(`[date:"${policy.snapshot}"]`))
  const scope = JSON.parse(await readFile(join(policy.sourceDirectory, 'scope.json')))
  assert.equal(scope.timetableSha256, timetableHash, 'Changed Como timetable')
  assert.deepEqual(scope.route, policy.route)
  const route = raw.inventory.find(r => r.routeId === policy.route.routeId)
  for (const [key, value] of Object.entries(policy.route)) assert.equal(route[key], value, 'Changed Como route identity')
  const days = raw.snapshots.map(d => ({ date: d.date, trips: d.trains.filter(t => t.routeId === route.routeId).map(t => ({ id: t.id, sourceTripId: t.sourceTripId,
    directionId: t.directionId, shortName: t.shortName, sourceServiceDate: t.sourceServiceDate, calls: t.calls })) }))
  assert.deepEqual(days, scope.days, 'Changed complete EC trip scope or calls')
  const trains = raw.snapshots.flatMap(d => d.trains.filter(t => t.routeId === route.routeId))
  const keys = [...new Set(trains.map(directedPatternKey))].sort()
  assert.deepEqual(scope.patterns, keys.map(key => ({ id: sha256(key).slice(0, 24), key })), 'Changed complete EC patterns')
  const ids = [...new Set(trains.flatMap(t => t.calls.map(c => c.id)))].sort()
  assert.deepEqual(scope.stops, ids.map(id => raw.stops.find(s => s.stop_id === id)), 'Changed full EC stop scope')
  const osm = JSON.parse(gunzipSync(await readFile(join(policy.sourceDirectory, 'osm.json.gz'))))
  const matcher = zugComoMatcher(osm, policy, scope)
  // Retain an independent, complete official corridor review, including the
  // longer bypass and the unrelated Como Lago branch. No lines are spliced in.
  const lombardia = JSON.parse(await readFile(join(policy.sourceDirectory, 'lombardia-rail.json')))
  const objectIds = JSON.parse(await readFile(join(policy.sourceDirectory, 'lombardia-ids.json'))).objectIds
  assert(!lombardia.exceededTransferLimit && !lombardia.error)
  assert.equal(lombardia.spatialReference.wkid, 4326)
  assert.deepEqual(lombardia.features.map(f => f.attributes.OBJECTID_1).sort((a, b) => a - b), [...objectIds].sort((a, b) => a - b), 'Incomplete Lombardia rail review')
  assert.equal(new Set(objectIds).size, 8)
  const comparisonInventory = lombardia.features.map(f => {
    const reviewed = source.lombardia.corridorIds.includes(f.attributes.OBJECTID_1)
    const maximumVertexGapMetres = Math.max(...f.geometry.paths.flat().map(p => vertexGap(p, matcher.pairs[0].path)))
    if (reviewed) {
      assert.equal(f.attributes.GESTORE_RETE, 'RFI')
      assert.equal(f.attributes.DSCART, 'Standard')
      assert(maximumVertexGapMetres <= policy.comparisonMaximumVertexGapMetres, 'Changed independent corridor comparison')
    }
    return { id: f.attributes.OBJECTID_1, attributes: f.attributes,
      vertices: f.geometry.paths.reduce((n, p) => n + p.length, 0), maximumVertexGapMetres,
      use: reviewed ? 'independent-corridor-review-only' : 'outside-reviewed-corridor' }
  })
  const timing = days.map(day => ({ date: day.date, pairs: matcher.pairs.map(pair => {
    const intervals = day.trips.flatMap(t => t.calls.slice(1).flatMap((c, i) => t.calls[i].id === pair.stopIds[0] && c.id === pair.stopIds[1] ? [{ tripId: t.id, fromSequence: t.calls[i].sequence, toSequence: c.sequence, seconds: c.arrival - t.calls[i].departure }] : []))
    assert(intervals.length && intervals.every(i => i.seconds > 0))
    return { stopIds: pair.stopIds, intervals, meanKmh: [...new Set(intervals.map(i => pair.pathMetres * 3.6 / i.seconds))] }
  }) }))
  return { ...matcher, source, scope, comparisonInventory, timing }
}

export function matchZugRailWithComo(rail, supplement, como, train, stops, route) {
  return rail.matchPattern(train, stops, route).map((original, i) => {
    const from = stops.get(train.calls[i].id), to = stops.get(train.calls[i + 1].id)
    return como.matchPair(supplement.matchPair(original, route, from, to), route, train, from, to)
  })
}
