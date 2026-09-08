import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { parseZugRail, zugRailMatcher, operatingPointNumber } from './zug-rail-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { hashFile } from './solothurn-timetable.mjs'
import { previousServiceDate } from './civil-day.mjs'
const length = points => points.slice(1).reduce((n, p, i) => n + distanceMetres(points[i], p), 0)

// Extend the reviewed eastern approach through the station along the retained
// SBB station curve, ending at the actual western platform projection. This is
// a local terminal spur, not a relocation of Bern's original operating point.
export function solothurnBernTerminalNetwork(network, policy, stop) {
  assert.deepEqual(network.nodes.get(policy.node.id), policy.node)
  for (const segment of [policy.stationCurve, policy.easternApproach]) {
    assert.deepEqual(network.segments.find(s => s.id === segment.id), segment, 'Changed reviewed Bern source curve')
    assert.equal(segment.gauge, 'mm1435'); assert.equal(segment.infrastructureOperator, 'SBB CFF FFS')
    assert([segment.start, segment.end].includes(policy.node.id))
  }
  assert(policy.stops.some(s => JSON.stringify(s) === JSON.stringify(stop)), 'Unreviewed Bern platform')
  const curve = policy.stationCurve, points = curve.end === policy.node.id ? curve.points : [...curve.points].reverse()
  const factor = Math.cos(stop[1] * Math.PI / 180); let best
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = (b[0] - a[0]) * factor, dy = b[1] - a[1], denominator = dx * dx + dy * dy
    if (!denominator) continue
    const fraction = Math.max(0, Math.min(1, ((stop[0] - a[0]) * factor * dx + (stop[1] - a[1]) * dy) / denominator))
    const point = [a[0] + fraction * (b[0] - a[0]), a[1] + fraction * (b[1] - a[1])].map(n => +n.toFixed(7))
    const attachmentMetres = distanceMetres(point, stop)
    if (!best || attachmentMetres < best.attachmentMetres) best = { segmentIndex: i - 1, fraction, point, attachmentMetres }
  }
  assert(best && best.attachmentMetres <= policy.maximumProjectionMetres, 'Bern platform projection too far')
  assert(best.segmentIndex > 0 && best.segmentIndex < points.length - 2, 'Bern terminal must lie inside the station curve')
  const retained = [best.point, ...points.slice(best.segmentIndex + 1)], retainedMetres = length(retained)
  assert(retainedMetres >= policy.minimumSpurMetres && retainedMetres <= policy.maximumSpurMetres, 'Unreviewed Bern terminal spur length')
  const terminal = { id: `solothurn:bern-terminal:${stop[3]}`, number: `SO-BERN-${stop[3]}`, name: `Bern reviewed platform ${stop[3]}`, coordinate: best.point }
  const spur = { ...curve, id: terminal.id + ':inferred-station-spur', start: terminal.id, end: policy.node.id, points: retained, length: retainedMetres }
  const nodes = new Map(network.nodes); nodes.set(terminal.id, terminal)
  // Keep only the reviewed eastern connection at the existing station node.
  const removed = network.segments.filter(s => [s.start, s.end].includes(policy.node.id) && s.id !== policy.easternApproach.id)
  return { network: { ...network, nodes, segments: [...network.segments.filter(s => !removed.includes(s)), spur] }, terminal,
    evidence: { stopId: stop[4], originalOperatingPoint: policy.node, terminal, projection: best, retainedMetres,
      sourceCurveId: curve.id, easternApproachId: policy.easternApproach.id, spurId: spur.id, removedConnections: removed.map(s => s.id).sort() } }
}

export async function loadSolothurnBernTerminal(config, dates) {
  const file = 'data/solothurn-bern-terminal-policy.json', policy = JSON.parse(await readFile(file))
  assert.equal(policy.sourceSha256, config.sourceSha256)
  for (const source of policy.sources) assert.equal(await hashFile(`${policy.sourceDirectory}/${source.file}`), source.sha256)
  assert.equal(await hashFile('data/solothurn-pattern-contexts.json.gz'), policy.contextSha256)
  assert.equal(policy.maximumProjectionMetres, 75); assert.equal(policy.minimumSpurMetres, 200); assert.equal(policy.maximumSpurMetres, 600)
  const xml = gunzipSync(await readFile(`${config.sourceDirectory}/network.xtf.gz`))
  assert.equal(createHash('sha256').update(xml).digest('hex'), policy.sourceSha256)
  assert.deepEqual(policy.routes, config.routes.filter(r => policy.routes.some(p => p.routeId === r.routeId)))
  const network = parseZugRail(xml.toString(), config.limits.simplificationMetres)
  const variants = new Map(), evidence = []
  for (const stop of policy.stops) {
    const variant = solothurnBernTerminalNetwork(network, policy, stop)
    const reviewedConfig = { ...config, routes: policy.routes, operatingPointOverrides: [{ sourceNumber: policy.node.number, targetNumber: variant.terminal.number,
      expectedName: variant.terminal.name, routeIds: policy.routes.map(r => r.routeId) }] }
    variants.set(stop[4], { ...variant, matcher: zugRailMatcher(variant.network, reviewedConfig, [previousServiceDate([...dates].sort()[0]), [...dates].sort().at(-1)]) })
    evidence.push(variant.evidence)
  }
  return { metadata: { policy, policySha256: await hashFile(file), evidence },
    matchPattern(train, rawStops, route, original) {
      const identity = policy.routes.find(r => r.routeId === route.id)
      if (!identity || route.agencyId !== identity.agencyId || route.name !== identity.line || route.mode !== 'rail') return original
      const calls = train.stops.map(([i]) => rawStops[i]), bern = calls.map((s, i) => ({ stop: s, index: i })).filter(c => operatingPointNumber(c.stop[4]) === policy.node.number)
      if (bern.length !== 1 || ![0, calls.length - 1].includes(bern[0].index)) return original
      const { stop, index } = bern[0], variant = variants.get(stop[4]); if (!variant) return original
      assert.deepEqual(stop, policy.stops.find(s => s[4] === stop[4]), 'Changed reviewed Bern platform')
      const adjacent = calls[index === 0 ? 1 : index - 1]
      if (!policy.adjacentOperatingPoints[route.id].includes(operatingPointNumber(adjacent[4]))) return original
      const stops = new Map(calls.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
      const results = variant.matcher.matchPattern({ ...train, calls: calls.map(s => ({ id: s[4] })) }, stops, { ...route, line: route.name })
      return original.map((value, i) => {
        const candidate = results[i]
        if (value.path || !candidate.path || (index !== i && index !== i + 1)) return value
        assert(candidate.directedSourceSegments.some(s => s.id === policy.easternApproach.id), 'Bern terminal bypassed reviewed eastern approach')
        assert(candidate.directedSourceSegments.some(s => s.id === variant.evidence.spurId))
        return { ...candidate, geometrySource: 'fot-reviewed-bern-eastern-terminal', bernTerminalReview: variant.evidence, previousSupplementFailure: value.reason }
      })
    } }
}
