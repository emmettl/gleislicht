import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { luzernOperatingPoint } from './luzern-rail-geometry.mjs'

export const borderSha = b => createHash('sha256').update(b).digest('hex')
export function thurgauBorderGraph(osm, policy) {
  assert(!osm.remark, 'Incomplete Overpass response')
  const nodes = new Map(), graph = new Map(), edges = [], inventory = []
  for (const n of osm.elements.filter(e => e.type === 'node')) {
    assert(Number.isFinite(n.lon) && Number.isFinite(n.lat) && Math.abs(n.lon) <= 180 && Math.abs(n.lat) <= 90, 'Invalid OSM coordinate')
    if (nodes.has(n.id)) assert.deepEqual([n.lon, n.lat], [nodes.get(n.id).lon, nodes.get(n.id).lat], 'Conflicting OSM node coordinates')
    if (n.timestamp) assert(n.timestamp <= policy.snapshot, 'Node newer than requested snapshot')
    if (!nodes.has(n.id) || n.tags) nodes.set(n.id, n)
  }
  for (const station of policy.stations) {
    const n = nodes.get(station.nodeId)
    assert.equal(n?.tags?.uic_ref, station.number); assert.equal(n.tags.name, station.name)
  }
  const ways = osm.elements.filter(e => e.type === 'way')
  assert.equal(new Set(ways.map(w => w.id)).size, ways.length)
  const reviewed = new Map((policy.reviewedWays ?? []).map(r => [r.id, r]))
  for (const review of reviewed.values()) {
    const w = ways.find(w => w.id === review.id)
    assert(w, 'Missing reviewed passenger connector')
    assert.equal(borderSha(JSON.stringify(w)), review.sourceFeatureSha256, 'Changed reviewed passenger connector')
    assert.deepEqual([w.nodes[0], w.nodes.at(-1)], review.endNodes)
    assert.equal(w.tags.gauge, '1435'); assert.equal(w.tags.passenger_lines, '1'); assert.equal(w.tags.service, 'siding'); assert.equal(w.tags.operator, 'SBB')
    for (const [i, id] of review.connectedMainWays.entries()) {
      const main = ways.find(w => w.id === id)
      assert(main?.nodes.includes(review.endNodes[i]) && main.tags.usage === 'main' && main.tags.gauge === '1435', 'Changed reviewed main-line connection')
    }
  }
  for (const w of ways) {
    assert(w.timestamp <= policy.snapshot, 'Way newer than requested snapshot')
    const reason = reviewed.has(w.id) ? null : w.tags.railway !== 'rail' || w.tags.gauge !== '1435' ? 'unreviewed-rail-gauge' :
      !((['main', 'branch'].includes(w.tags.usage) && !w.tags.service) || (w.tags.service === 'crossover' && w.tags['railway:track_type'] === 'main')) ? 'non-passenger-running-line' : null
    inventory.push({ id: w.id, version: w.version, timestamp: w.timestamp, tags: w.tags, reason, ...(reviewed.has(w.id) ? { admissionBasis: 'exact-reviewed-passenger-connector' } : {}) })
    if (reason) continue
    assert(w.nodes.length >= 2, 'Empty rail way')
    for (let i = 1; i < w.nodes.length; i++) {
      const a = nodes.get(w.nodes[i - 1]), b = nodes.get(w.nodes[i]); assert(a && b, 'Missing OSM node')
      const from = [a.lon, a.lat], to = [b.lon, b.lat], metres = distanceMetres(from, to)
      if (metres < 0.001) continue
      const edge = { from: a.id, to: b.id, a: from, b: to, wayId: w.id, metres }; edges.push(edge)
      for (const e of [edge, { ...edge, from: b.id, to: a.id, a: to, b: from }]) {
        const list = graph.get(e.from) ?? []; list.push(e); graph.set(e.from, list)
      }
    }
  }
  function project(p) {
    const scale = Math.cos(p[1] * Math.PI / 180)
    const candidates = edges.map(e => {
      const dx = (e.b[0] - e.a[0]) * scale, dy = e.b[1] - e.a[1]
      const t = Math.max(0, Math.min(1, ((p[0] - e.a[0]) * scale * dx + (p[1] - e.a[1]) * dy) / (dx * dx + dy * dy)))
      const point = [e.a[0] + t * (e.b[0] - e.a[0]), e.a[1] + t * (e.b[1] - e.a[1])]
      return { edge: e, point, t, distance: distanceMetres(p, point) }
    }).sort((a, b) => a.distance - b.distance || a.edge.wayId - b.edge.wayId)
    return candidates.filter(c => c.distance <= Math.min(policy.limits.trackAttachmentMetres, candidates[0].distance + policy.limits.projectionAlternativeMetres))
  }
  return { inventory, match(fromStop, toStop) {
    const stops = [fromStop, toStop], coordinates = stops.map(s => [Number(s.stop_lon), Number(s.stop_lat)])
    const stations = stops.map(s => policy.stations.find(p => p.number === luzernOperatingPoint(s)))
    if (!stations.every(Boolean) || stations[0] === stations[1]) return { reason: 'border-unreviewed-station-pair' }
    const stationAttachments = stations.map((s, i) => distanceMetres(coordinates[i], [nodes.get(s.nodeId).lon, nodes.get(s.nodeId).lat]))
    if (stationAttachments.some(d => d > policy.limits.stationIdentityMetres)) return { reason: 'border-station-identity-too-far' }
    const starts = project(coordinates[0]), ends = project(coordinates[1])
    if (!starts.length || !ends.length) return { reason: 'border-track-attachment-too-far' }
    // Virtual vertices attach only to their own source edge, never to a nearby track.
    const g = new Map([...graph].map(([id, es]) => [id, [...es]]))
    const add = e => { const es = g.get(e.from) ?? []; es.push(e); g.set(e.from, es) }
    for (const [id, candidates] of [['start', starts], ['end', ends]]) for (const c of candidates) {
      for (const [node, point] of [[c.edge.from, c.edge.a], [c.edge.to, c.edge.b]]) {
        const e = { from: id, to: node, a: c.point, b: point, wayId: c.edge.wayId, metres: distanceMetres(c.point, point) + c.distance, attachment: c.distance }
        if (id === 'start') add(e)
        else add({ ...e, from: node, to: id, a: point, b: c.point })
      }
    }
    const distances = new Map([['start', 0]]), previous = new Map(), queue = [[0, 'start', 'start', null]]
    let finish
    while (queue.length) {
      queue.sort((a, b) => b[0] - a[0]); const [d, state, id, incoming] = queue.pop()
      if (d !== distances.get(state)) continue
      if (id === 'end') { finish = state; break }
      for (const e of g.get(id) ?? []) {
        if (incoming) {
          const scale = Math.cos(e.a[1] * Math.PI / 180)
          const u = [(incoming.b[0] - incoming.a[0]) * scale, incoming.b[1] - incoming.a[1]]
          const v = [(e.b[0] - e.a[0]) * scale, e.b[1] - e.a[1]], norm = Math.hypot(...u) * Math.hypot(...v)
          if (norm > 1e-18 && (u[0] * v[0] + u[1] * v[1]) / norm < Math.cos(policy.limits.maximumTurnDegrees * Math.PI / 180)) continue
        }
        const next = d + e.metres, key = JSON.stringify([e.from, e.to, e.wayId, e.a, e.b])
        if (next > policy.limits.maximumPathMetres || next >= (distances.get(key) ?? Infinity)) continue
        distances.set(key, next); previous.set(key, { state, edge: e }); queue.push([next, key, e.to, e])
      }
    }
    if (!finish) return { reason: 'border-disconnected-detour-or-turn' }
    const selected = []
    for (let state = finish; state !== 'start';) { const p = previous.get(state); selected.unshift(p.edge); state = p.state }
    const path = [coordinates[0], ...selected.flatMap(e => [e.a, e.b]), coordinates[1]].map(p => p.map(n => Number(n.toFixed(7)))).filter((p, i, all) => !i || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1])
    const pathMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
    assert(pathMetres <= policy.limits.maximumPathMetres)
    return { path, pathMetres, geometrySource: 'fot-osm-border-rail-inference', gauge: 'mm1435',
      fromOperatingPoint: stations[0].number, toOperatingPoint: stations[1].number,
      stationAttachmentsMetres: stationAttachments, trackAttachmentsMetres: [selected[0].attachment, selected.at(-1).attachment],
      directedSourceSegments: selected.map(e => ({ id: `osm-way:${e.wayId}`, from: e.from, to: e.to })) }
  } }
}

export async function loadThurgauBorderRail(timetable, { reviewedWays = true } = {}) {
  const directory = 'data/thurgau-border-rail-sources', policyBytes = await readFile('data/thurgau-border-rail-policy.json'), policy = JSON.parse(policyBytes)
  const sourceBytes = await readFile(`${directory}/sources.json`), source = JSON.parse(sourceBytes)
  assert.equal(borderSha(sourceBytes), policy.sourceSha256)
  assert.equal(borderSha(await readFile('data/thurgau-audit/timetable-cache.json.gz')), policy.timetableSha256)
  for (const f of source.files) assert.equal(borderSha(await readFile(`${directory}/${f.file}`)), f.sha256)
  assert.equal(source.snapshot, policy.snapshot)
  assert((await readFile(`${directory}/query.txt`, 'utf8')).includes(`[date:"${policy.snapshot}"]`), 'Query snapshot differs from policy')
  const osm = JSON.parse(gunzipSync(await readFile(`${directory}/osm.json.gz`))), matcher = thurgauBorderGraph(osm, reviewedWays ? policy : { ...policy, reviewedWays: [] })
  const primary = thurgauBorderGraph(osm, { ...policy, reviewedWays: [] })
  const match = (from, to) => {
    const original = primary.match(from, to)
    if (original.path || !reviewedWays) return original
    // The reviewed siding is a station-throat connection, not a general siding allowance.
    const ids = [from.stop_id, to.stop_id].sort()
    if (JSON.stringify(ids) !== JSON.stringify(['8102336', 'ch:1:sloid:6314:2:2'])) return original
    const result = matcher.match(from, to)
    if (!result.path) return result
    return { ...result, primaryBorderFailure: original.reason, reviewedSourceWayIds: [...new Set(result.directedSourceSegments.map(s => Number(s.id.split(':')[1])).filter(id => policy.reviewedWays.some(r => r.id === id)))] }
  }
  const ids = new Set(timetable.snapshots.flatMap(d => d.trains.filter(t => t.stops.some(([i]) => d.stops[i][4] === '8102336')).map(t => t.routeId)))
  assert.deepEqual([...ids], [policy.route.routeId])
  const keys = new Set(timetable.snapshots.flatMap(d => d.trains.filter(t => ids.has(t.routeId)).map(t => JSON.stringify(t.stops.map(([i]) => d.stops[i][4])))))
  return { ...matcher, match, policy, source, policySha256: borderSha(policyBytes), supplement(train, stops, route, original) {
    if (original.every(s => s.path) || train.routeId !== policy.route.routeId) return original
    assert.equal(route.agencyId, policy.route.agencyId); assert.equal(route.line, policy.route.line)
    assert(keys.has(JSON.stringify(train.calls.map(c => c.id))), 'Unreviewed full border pattern')
    return original.map((s, i) => s.path ? s : { ...match(stops.get(train.calls[i].id), stops.get(train.calls[i + 1].id)), primaryFailure: s.reason })
  } }
}
