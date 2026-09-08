import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { loadBernIc61 } from './bern-ic61-geometry.mjs'
import { applyBernRail } from './bern-rail-geometry.mjs'
import { parseZugRail, zugRailMatcher, operatingPointNumber } from './zug-rail-geometry.mjs'
import { solothurnBernTerminalNetwork } from './solothurn-bern-terminal.mjs'
import { bernTerminalProjection } from './fribourg-bern-platforms.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
const sha = b => createHash('sha256').update(b).digest('hex')
const length = p => p.slice(1).reduce((n, x, i) => n + distanceMetres(p[i], x), 0)
export function bernIc61StationVariant(network, policy, bernStop, baselStop) {
  let current = network
  const evidence = [], overrides = [...policy.operatingPointOverrides]
  if (bernStop) {
    const v = solothurnBernTerminalNetwork(current, policy.bern, bernStop)
    const terminal = { ...v.terminal, id: `bern:ic61-platform:${bernStop[3]}`, number: `BE-IC61-${bernStop[3]}` }
    const spurId = `${terminal.id}:station-section`, nodes = new Map(v.network.nodes)
    nodes.delete(v.terminal.id); nodes.set(terminal.id, terminal)
    current = { ...v.network, nodes, segments: v.network.segments.map(s => s.id === v.evidence.spurId ? { ...s, id: spurId, start: terminal.id } : s) }
    evidence.push({ ...v.evidence, terminal, spurId, kind: 'bern-eastern-return-section' })
    overrides.push({ sourceNumber: policy.bern.node.number, targetNumber: terminal.number, expectedName: terminal.name })
  }
  if (baselStop) {
    assert(policy.basel.stops.some(s => JSON.stringify(s) === JSON.stringify(baselStop)), 'Unreviewed Basel platform')
    const p = policy.basel, curve = current.segments.find(s => s.id === p.curve.id)
    assert.deepEqual(current.nodes.get(p.node.id), p.node); assert.deepEqual(curve, p.curve)
    assert.equal(curve.gauge, 'mm1435'); assert.equal(curve.infrastructureOperator, 'SBB CFF FFS')
    const points = curve.start === p.node.id ? curve.points : [...curve.points].reverse()
    const projection = bernTerminalProjection(points, baselStop.slice(0, 2), p.maximumProjectionMetres)
    assert(projection.removedMetres >= p.minimumTrimMetres && projection.removedMetres <= p.maximumTrimMetres)
    const terminal = { id: `bern:ic61-basel:${baselStop[3]}`, number: `BE-IC61-BS-${baselStop[3]}`, name: `Basel SBB reviewed platform ${baselStop[3]}`, coordinate: projection.point }
    const clipped = { ...curve, id: `${curve.id}:ic61-basel:${baselStop[3]}`, start: terminal.id,
      end: curve.start === p.node.id ? curve.end : curve.start, points: projection.retainedPoints, length: length(projection.retainedPoints) }
    const nodes = new Map(current.nodes); nodes.set(terminal.id, terminal)
    const removed = current.segments.filter(s => [s.start, s.end].includes(p.node.id))
    current = { ...current, nodes, segments: [...current.segments.filter(s => !removed.includes(s)), clipped] }
    evidence.push({ kind: 'basel-eastern-terminal', stopId: baselStop[4], originalOperatingPoint: p.node, terminal, sourceCurveId: curve.id,
      clippedId: clipped.id, projection, removedConnections: removed.map(s => s.id) })
    overrides.push({ sourceNumber: p.node.number, targetNumber: terminal.number, expectedName: terminal.name })
  }
  return { network: current, evidence, overrides }
}
export function bernIc61PlatformsMatcher(network, policy) {
  const variants = new Map(), inventory = new Map(), evidence = []
  const originals = new Map(policy.originalStops.map(s => [s[4], s]))
  for (const p of policy.originalPatterns) {
    const bernStop = policy.bern.stops.find(s => p.stopIds.includes(s[4])), baselStop = policy.basel.stops.find(s => p.stopIds.includes(s[4]))
    const key = JSON.stringify([bernStop?.[4], baselStop?.[4]])
    if (variants.has(key)) continue
    const v = bernIc61StationVariant(network, policy, bernStop, baselStop)
    const matcher = zugRailMatcher(v.network, { ...policy, operatingPointOverrides: v.overrides }, ['2026-09-03', '2026-09-06'])
    assert(matcher.sourceInventory.every(s => !s.reason))
    for (const s of matcher.sourceInventory) inventory.set(s.id, s)
    variants.set(key, matcher); evidence.push({ key, stations: v.evidence })
  }
  return { sourceInventory: [...inventory.values()], evidence, matchPattern(train, stops, route) {
    assert.equal(train.routeId, '91-61-A-j26-1'); assert.equal(route.agencyId, '11'); assert.equal(route.line, 'IC61'); assert.equal(route.mode, 'rail')
    const ids = train.calls.map(c => c.id), reject = () => ids.slice(1).map(() => ({ reason: 'rail-unreviewed-ic61-station-context' }))
    if (!policy.originalPatterns.some(p => p.directionId === train.directionId && JSON.stringify(p.stopIds) === JSON.stringify(ids))) return reject()
    const bernStop = policy.bern.stops.find(s => ids.includes(s[4])), baselStop = policy.basel.stops.find(s => ids.includes(s[4]))
    if (bernStop) {
      const index = ids.indexOf(bernStop[4])
      if (ids.filter(id => operatingPointNumber(id) === '8507000').length !== 1) return reject()
      for (const adjacent of [ids[index - 1], ids[index + 1]].filter(Boolean)) if (!['8500218', '8507100', '8507006'].includes(operatingPointNumber(adjacent))) return reject()
    }
    if (baselStop && (![0, ids.length - 1].includes(ids.indexOf(baselStop[4])) || ids.filter(id => operatingPointNumber(id) === '8500010').length !== 1)) return reject()
    for (const id of ids) {
      const s = stops.get(id), original = originals.get(id)
      assert(s && original); assert.deepEqual([s.stop_lon, s.stop_lat], original.slice(0, 2), 'Changed IC61 original station-context coordinates')
    }
    return variants.get(JSON.stringify([bernStop?.[4], baselStop?.[4]])).matchPattern(train, stops, route)
  } }
}
export async function loadBernIc61Platforms() {
  const bytes = await readFile('data/bern-ic61-platforms-policy.json'), policy = JSON.parse(bytes), base = await loadBernIc61()
  assert.equal(policy.sourceId, 'bern-ic61-platforms-reviewed-fot-rail-20210706')
  for (const key of ['sourceSha256', 'sourceMetadataSha256', 'dates', 'limits', 'gauges', 'infrastructureOperators', 'originalPatterns', 'originalStops', 'operatingPointOverrides']) assert.deepEqual(policy[key], base.policy[key])
  assert.deepEqual(policy.routes.map(({ pairs: _pairs, ...r }) => r), base.policy.routes.map(({ pairs: _pairs, ...r }) => r))
  assert.equal(policy.bern.maximumProjectionMetres, 75); assert.equal(policy.bern.minimumSpurMetres, 100); assert.equal(policy.bern.maximumSpurMetres, 200)
  assert.equal(policy.basel.maximumProjectionMetres, 75); assert.equal(policy.basel.minimumTrimMetres, 200); assert.equal(policy.basel.maximumTrimMetres, 300)
  assert.deepEqual(policy.bern.stops.map(s => s[3]).sort(), ['5', '6', '7', '8']); assert.deepEqual(policy.basel.stops.map(s => s[3]).sort(), ['10', '3', '9'])
  for (const doc of policy.documents) assert.equal(sha(await readFile(`${policy.documentsDirectory}/${doc.file}`)), doc.sha256)
  const xml = gunzipSync(await readFile(`${policy.sourceDirectory}/network.xtf.gz`)); assert.equal(sha(xml), policy.sourceSha256)
  const parsed = parseZugRail(xml.toString(), 0)
  const selected = new Set(base.policy.routes.flatMap(r => r.pairs.flatMap(p => p.sourceSegments)))
  selected.add(policy.bern.stationCurve.id)
  const matcher = bernIc61PlatformsMatcher({ ...parsed, segments: parsed.segments.filter(s => selected.has(s.id)) }, policy)
  return { policy, matcher, metadata: { policySha256: sha(bytes), policy, source: base.metadata.source, sourceSegments: matcher.sourceInventory, stationEvidence: matcher.evidence } }
}
export const applyBernIc61Platforms = applyBernRail
