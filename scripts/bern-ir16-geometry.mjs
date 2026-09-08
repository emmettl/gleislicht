import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { loadBernRail, applyBernRail } from './bern-rail-geometry.mjs'
import { parseZugRail, zugRailMatcher, operatingPointNumber } from './zug-rail-geometry.mjs'
import { bernTerminalNetwork } from './fribourg-bern-platforms.mjs'
import { solothurnBernTerminalNetwork } from './solothurn-bern-terminal.mjs'
import { previousServiceDate } from './civil-day.mjs'
const sha = b => createHash('sha256').update(b).digest('hex')
export const BERN_IR16_ROUTES = ['91-16-B-j26-1']

// Reuse the reviewed eastern-spur construction, with Bern-owned derived IDs.
export function bernIr16Spur(network, policy, stop) {
  const v = solothurnBernTerminalNetwork(network, { ...policy, stops: policy.spurStops }, stop)
  const terminal = { ...v.terminal, id: `bern:ir16-terminal:${stop[3]}`, number: `BE-IR16-${stop[3]}` }
  const spurId = terminal.id + ':inferred-station-spur', nodes = new Map(v.network.nodes)
  nodes.delete(v.terminal.id); nodes.set(terminal.id, terminal)
  const segments = v.network.segments.map(s => s.id === v.evidence.spurId ? { ...s, id: spurId, start: terminal.id } : s)
  return { network: { ...v.network, nodes, segments }, terminal, evidence: { ...v.evidence, terminal, spurId } }
}

export function bernIr16Matcher(network, policy) {
  const variants = new Map(), inventory = new Map(), zurichEvidence = []
  const spur = bernIr16Spur(network, policy.bern, policy.bern.spurStops[0])
  for (const s of policy.zurich.stops) {
    for (const useSpur of [false, true]) {
      const v = bernTerminalNetwork(useSpur ? spur.network : network, policy.zurich,
        { stop_id: s[4], platform_code: s[3], stop_lon: s[0], stop_lat: s[1] }, policy.zurich.corridor)
      const clippedId = v.evidence.clippedSegmentId.replace(':bern-terminal:', ':zurich-terminal:')
      const segments = v.network.segments.map(p => p.id === v.evidence.clippedSegmentId ? { ...p, id: clippedId } : p)
      const config = { ...policy, operatingPointOverrides: useSpur ? [{ sourceNumber: policy.bern.node.number,
        targetNumber: spur.terminal.number, expectedName: spur.terminal.name, routeIds: BERN_IR16_ROUTES }] : [] }
      const matcher = zugRailMatcher({ ...v.network, segments }, config, [previousServiceDate(policy.dates[0]), policy.dates.at(-1)])
      assert(matcher.sourceInventory.every(s => !s.reason), 'Invalid reviewed IR16 segment')
      for (const p of matcher.sourceInventory) inventory.set(p.id, p)
      variants.set(JSON.stringify([s[4], useSpur]), matcher)
      if (!useSpur) zurichEvidence.push({ ...v.evidence, clippedSegmentId: clippedId })
    }
  }
  return { sourceInventory: [...inventory.values()], zurichEvidence, bernEvidence: spur.evidence,
    matchPattern(train, stops, route) {
      assert.equal(train.routeId, '91-16-B-j26-1'); assert.equal(route.agencyId, '11')
      assert.equal(route.line, 'IR16'); assert.equal(route.mode, 'rail')
      const reject = () => train.calls.slice(1).map(() => ({ reason: 'rail-unreviewed-ir16-terminal-context' }))
      const numbers = train.calls.map(c => operatingPointNumber(c.id)), forward = JSON.stringify(numbers) === JSON.stringify(policy.originalStationOrder)
      if (!forward && JSON.stringify(numbers) !== JSON.stringify([...policy.originalStationOrder].reverse())) return reject()
      const bernId = train.calls[forward ? train.calls.length - 1 : 0].id, zurichId = train.calls[forward ? 0 : train.calls.length - 1].id
      for (const [id, reviewed] of [[bernId, policy.bern.stops], [zurichId, policy.zurich.stops]]) {
        const expected = reviewed.find(s => s[4] === id)
        if (!expected) return reject()
        const original = stops.get(id)
        assert.deepEqual([original.stop_lon, original.stop_lat], expected.slice(0, 2), 'Changed reviewed IR16 terminal coordinates')
      }
      const useSpur = policy.bern.spurStops.some(s => s[4] === bernId)
      const matcher = variants.get(JSON.stringify([zurichId, useSpur]))
      return matcher.matchPattern(train, stops, route).map(r => ({ ...r, ...(r.path ? { ir16Review: {
        bernStopId: bernId, zurichStopId: zurichId, bernSpurId: useSpur ? spur.evidence.spurId : null,
        zurichSourceCurveId: policy.zurich.corridor.segment.id, terminalOnly: true,
      } } : {}) }))
    } }
}

export async function loadBernIr16() {
  const bytes = await readFile('data/bern-ir16-policy.json'), policy = JSON.parse(bytes), baseline = await loadBernRail()
  assert.equal(policy.sourceId, 'bern-ir16-reviewed-fot-rail-20210706')
  for (const key of ['sourceDirectory', 'sourceMetadataSha256', 'sourceSha256']) assert.equal(policy[key], baseline.policy[key])
  for (const key of ['limits', 'dates', 'gauges', 'infrastructureOperators']) assert.deepEqual(policy[key], baseline.policy[key])
  assert.deepEqual(policy.routes.map(({ pairs: _pairs, ...r }) => r), [{ routeId: '91-16-B-j26-1', agencyId: '11', line: 'IR16', mode: 'rail' }])
  assert.deepEqual(policy.originalStationOrder, ['8503000', '8503504', '8500309', '8502113', '8500218', '8507000'])
  assert.equal(policy.bern.stops.length, 3); assert.equal(policy.zurich.stops.length, 7)
  assert.deepEqual(policy.bern.spurStops.map(s => s[4]), ['ch:1:sloid:7000:55:49'])
  assert.equal(policy.bern.maximumProjectionMetres, 75); assert.equal(policy.zurich.maximumProjectionMetres, 75)
  assert.equal(policy.bern.minimumSpurMetres, 200); assert.equal(policy.bern.maximumSpurMetres, 600)
  assert.equal(policy.zurich.minimumTrimMetres, 200); assert.equal(policy.zurich.maximumTrimMetres, 400)
  for (const doc of policy.documents) assert.equal(sha(await readFile(`${policy.documentsDirectory}/${doc.file}`)), doc.sha256, 'Changed IR16 station evidence')
  const xml = gunzipSync(await readFile(`${policy.sourceDirectory}/network.xtf.gz`)); assert.equal(sha(xml), policy.sourceSha256)
  const parsed = parseZugRail(xml.toString(), 0), bindings = policy.routes[0].pairs
  assert.equal(new Set(bindings.map(p => JSON.stringify([p.fromId, p.toId]))).size, bindings.length)
  for (const p of bindings) assert.deepEqual(p.operatingPointPair, [p.fromId, p.toId].map(operatingPointNumber))
  const selected = new Set(bindings.flatMap(p => p.sourceSegments.filter(id => !id.startsWith('bern:ir16-terminal:')).map(id => id.split(':zurich-terminal:')[0])))
  selected.add(policy.bern.stationCurve.id)
  const segments = parsed.segments.filter(s => selected.has(s.id)); assert.equal(segments.length, selected.size)
  const matcher = bernIr16Matcher({ ...parsed, segments }, policy)
  return { policy, matcher, metadata: { policySha256: sha(bytes), policy, source: baseline.metadata.source,
    sourceSegments: matcher.sourceInventory, zurichTerminalEvidence: matcher.zurichEvidence, bernTerminalEvidence: matcher.bernEvidence } }
}
export const applyBernIr16 = applyBernRail
