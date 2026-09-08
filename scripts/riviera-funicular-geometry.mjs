import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { distanceMetres, sliceShape } from './enrich-postbus-roads.mjs'
import { projectRailStop } from './lausanne-rail-geometry.mjs'

export async function loadRivieraFuniculars() {
  const bytes = await readFile(new URL('../data/riviera-sources/funiculars.json', import.meta.url))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  assert.equal(sha256, (await readFile(new URL('../data/riviera-sources/funiculars.sha256', import.meta.url), 'utf8')).trim(), 'Riviera: changed funicular source')
  return { source: JSON.parse(bytes), sha256 }
}

export function applyRivieraFuniculars(snapshot, routes, source) {
  const paths = [...snapshot.paths], edgePaths = [...snapshot.edgePaths], updated = new Map(), reports = []
  for (const policy of source.routes) {
    const route = routes.get(policy.routeId)
    assert(route?.agencyId === policy.agencyId && route.mode === 'funicular', 'Riviera: changed funicular route identity')
    const trains = snapshot.trains.filter(t => t.routeId === policy.routeId)
    if (!trains.length) continue
    assert.equal(policy.feature.number, policy.installation)
    assert.equal(policy.feature.type, 'Standseilbahn'); assert.equal(policy.feature.operator, '212')
    assert(policy.feature.validFrom <= snapshot.metadata.sourceServiceDates[0] && (!policy.feature.validUntil || policy.feature.validUntil >= snapshot.metadata.serviceDate), 'Riviera: funicular source outside validity')
    assert.equal(policy.segment.installation, policy.feature.id)
    assert.equal(policy.segment.lines.length, 1)
    let distance = 0
    const shape = policy.segment.lines[0].map((point, i, all) => { if (i) distance += distanceMetres(all[i - 1], point); return [...point, distance] })
    const indices = [...new Set(trains.flatMap(t => t.stops.map(([i]) => i)))], anchors = new Map()
    assert.deepEqual(indices.map(i => snapshot.stops[i][4]).sort(), [...policy.stops].sort(), 'Riviera: changed funicular platforms')
    for (const index of indices) {
      const p = projectRailStop(snapshot.stops[index], [{ id: policy.segment.id, shape }], policy.maximumSnapMetres)
      assert(p, `Riviera: funicular stop exceeds attachment limit: ${snapshot.stops[index][2]}`)
      anchors.set(index, p)
    }
    const forward = policy.stops.map(id => anchors.get(indices.find(i => snapshot.stops[i][4] === id)).distance)
    assert(forward.every((v, i) => !i || v > forward[i - 1]), 'Riviera: reversed or collapsed funicular stop order')
    const pairs = new Map()
    for (const train of trains) {
      assert.equal(train.category, 'funicular')
      const ids = train.stops.map(([i]) => snapshot.stops[i][4])
      assert(JSON.stringify(ids) === JSON.stringify(policy.stops) || JSON.stringify(ids) === JSON.stringify([...policy.stops].reverse()), 'Riviera: changed funicular call sequence')
      const pathSegments = train.stops.slice(1).map(([to], j) => {
        const from = train.stops[j][0], key = `${from}:${to}`
        if (!pairs.has(key)) {
          const a = anchors.get(from), b = anchors.get(to)
          const segment = sliceShape(shape, Math.min(a.distance, b.distance), Math.max(a.distance, b.distance))
          assert(segment?.length >= 2, 'Riviera: collapsed funicular segment')
          const points = a.distance < b.distance ? segment : segment.reverse()
          const path = [snapshot.stops[from].slice(0, 2), ...points, snapshot.stops[to].slice(0, 2)]
            .filter((p, i, all) => !i || distanceMetres(all[i - 1], p) > .01)
          pairs.set(key, paths.length); paths.push(path)
        }
        const index = pairs.get(key)
        const edge = snapshot.edges.findIndex(([a, b]) => a === from && b === to || a === to && b === from)
        assert(edge >= 0); edgePaths[edge] = index
        return index
      })
      updated.set(train.id, { ...train, pathSegments })
    }
    reports.push({ routeId: policy.routeId, installation: policy.installation, sourceDate: policy.feature.sourceDate, sourceSegmentId: policy.segment.id, trips: trains.length,
      matchedSegments: trains.reduce((n, t) => n + t.stops.length - 1, 0), maximumSnapMetres: Math.max(...[...anchors.values()].map(p => p.snapMetres)),
      stops: indices.map(i => ({ id: snapshot.stops[i][4], name: snapshot.stops[i][2], coordinate: snapshot.stops[i].slice(0, 2), ...anchors.get(i) })) })
  }
  const trains = snapshot.trains.map(t => updated.get(t.id) ?? t)
  assert(trains.filter(t => t.category === 'funicular').every(t => updated.has(t.id)), 'Riviera: unreviewed funicular journey')
  return { snapshot: { ...snapshot, paths, edgePaths, trains }, reports }
}
