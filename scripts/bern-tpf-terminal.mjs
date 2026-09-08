import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { loadBernRail, applyBernRail } from './bern-rail-geometry.mjs'
import { parseZugRail, zugRailMatcher, operatingPointNumber } from './zug-rail-geometry.mjs'
import { solothurnBernTerminalNetwork } from './solothurn-bern-terminal.mjs'
import { previousServiceDate } from './civil-day.mjs'
const sha = b => createHash('sha256').update(b).digest('hex')
export const BERN_TPF_TERMINAL_ROUTES = ['91-20-B-j26-1', '91-21-A-j26-1']

// The same source-curve construction used at Bern applies here with the
// opposite approach called northern. Derived identities belong to this review.
export function bernTpfTerminalNetwork(network, policy, stop) {
  const v = solothurnBernTerminalNetwork(network, { ...policy, easternApproach: policy.northernApproach }, stop)
  const terminal = { ...v.terminal, id: `bern:tpf-fribourg-terminal:${stop[3]}`,
    number: `BE-TPF-FR-${stop[3]}`, name: `Fribourg/Freiburg reviewed platform ${stop[3]}` }
  const spurId = terminal.id + ':inferred-station-spur', nodes = new Map(v.network.nodes)
  nodes.delete(v.terminal.id); nodes.set(terminal.id, terminal)
  const segments = v.network.segments.map(s => s.id === v.evidence.spurId ? { ...s, id: spurId, start: terminal.id } : s)
  const { easternApproachId, ...evidence } = v.evidence
  return { network: { ...v.network, nodes, segments }, terminal,
    evidence: { ...evidence, terminal, spurId, northernApproachId: easternApproachId } }
}

export function bernTpfTerminalMatcher(network, policy) {
  const variants = new Map(), inventory = new Map(), evidence = []
  const originalStops = new Map(policy.originalStops.map(s => [s[4], s]))
  const patterns = new Set(policy.originalPatterns.map(p => JSON.stringify([p.routeId, p.directionId, p.stopIds])))
  for (const stop of policy.terminal.stops) {
    const v = bernTpfTerminalNetwork(network, policy.terminal, stop)
    const config = { ...policy, operatingPointOverrides: [{ sourceNumber: policy.terminal.node.number,
      targetNumber: v.terminal.number, expectedName: v.terminal.name, routeIds: BERN_TPF_TERMINAL_ROUTES }] }
    const matcher = zugRailMatcher(v.network, config, [previousServiceDate(policy.dates[0]), policy.dates.at(-1)])
    assert(matcher.sourceInventory.every(s => !s.reason), 'Invalid reviewed TPF station segment')
    for (const s of matcher.sourceInventory) inventory.set(s.id, s)
    variants.set(stop[4], matcher); evidence.push(v.evidence)
  }
  return { sourceInventory: [...inventory.values()], evidence, matchPattern(train, stops, route) {
    const identity = policy.routes.find(r => r.routeId === train.routeId)
    assert(identity, 'Route outside TPF terminal review')
    assert.equal(route.agencyId, identity.agencyId); assert.equal(route.line, identity.line); assert.equal(route.mode, identity.mode)
    const reject = () => train.calls.slice(1).map(() => ({ reason: 'rail-unreviewed-tpf-terminal-context' }))
    const ids = train.calls.map(c => c.id)
    if (!patterns.has(JSON.stringify([train.routeId, train.directionId, ids]))) return reject()
    const terminals = ids.map((id, index) => ({ id, index })).filter(c => operatingPointNumber(c.id) === policy.terminal.node.number)
    if (terminals.length !== 1 || ![0, ids.length - 1].includes(terminals[0].index)) return reject()
    const terminal = terminals[0], matcher = variants.get(terminal.id)
    if (!matcher || operatingPointNumber(ids[terminal.index === 0 ? 1 : terminal.index - 1]) !== '8504181') return reject()
    // Validate every original platform before looking up the graph's cache.
    for (const id of ids) {
      const original = stops.get(id), expected = originalStops.get(id)
      assert(original && expected, 'Missing reviewed TPF source stop')
      assert.deepEqual([original.stop_lon, original.stop_lat], expected.slice(0, 2), 'Changed reviewed TPF stop coordinates')
    }
    return matcher.matchPattern(train, stops, route).map((r, i) => {
      if (i !== terminal.index && i + 1 !== terminal.index) return { reason: 'rail-outside-tpf-terminal-pair' }
      if (r.path) {
        assert(r.directedSourceSegments.some(s => s.id === policy.terminal.northernApproach.id), 'TPF terminal bypassed northern approach')
        return { ...r, tpfTerminalReview: { stopId: terminal.id, sourceCurveId: policy.terminal.stationCurve.id,
          northernApproachId: policy.terminal.northernApproach.id, terminalOnly: true } }
      }
      return r
    })
  } }
}

export async function loadBernTpfTerminal() {
  const bytes = await readFile('data/bern-tpf-terminal-policy.json'), policy = JSON.parse(bytes), baseline = await loadBernRail()
  assert.equal(policy.sourceId, 'bern-tpf-fribourg-reviewed-fot-rail-20210706')
  for (const key of ['sourceDirectory', 'sourceMetadataSha256', 'sourceSha256']) assert.equal(policy[key], baseline.policy[key])
  for (const key of ['limits', 'dates', 'gauges', 'infrastructureOperators']) assert.deepEqual(policy[key], baseline.policy[key])
  assert.deepEqual(policy.routes.map(({ pairs: _pairs, ...r }) => r), BERN_TPF_TERMINAL_ROUTES.map((routeId, i) => ({ routeId, agencyId: '53', line: i ? 'S21' : 'S20', mode: 'rail' })))
  assert.equal(policy.terminal.maximumProjectionMetres, 75)
  assert.equal(policy.terminal.minimumSpurMetres, 200); assert.equal(policy.terminal.maximumSpurMetres, 400)
  assert.equal(policy.terminal.node.number, '8504100')
  assert.deepEqual(policy.terminal.stops.map(s => s[3]).sort(), ['4', '4A-D', '5'])
  assert.equal(policy.originalPatterns.length, 37); assert.equal(policy.originalStops.length, 25)
  for (const doc of policy.documents) assert.equal(sha(await readFile(`${policy.documentsDirectory}/${doc.file}`)), doc.sha256, 'Changed TPF station evidence')
  const xml = gunzipSync(await readFile(`${policy.sourceDirectory}/network.xtf.gz`)); assert.equal(sha(xml), policy.sourceSha256)
  const parsed = parseZugRail(xml.toString(), 0), bindings = policy.routes.flatMap(r => r.pairs)
  assert.equal(bindings.length, 9)
  for (const r of policy.routes) assert.equal(new Set(r.pairs.map(p => JSON.stringify([p.fromId, p.toId]))).size, r.pairs.length)
  for (const p of bindings) assert.deepEqual(p.operatingPointPair, [p.fromId, p.toId].map(operatingPointNumber))
  const selected = new Set(bindings.flatMap(p => p.sourceSegments.filter(id => !id.startsWith('bern:tpf-fribourg-terminal:'))))
  selected.add(policy.terminal.stationCurve.id)
  const segments = parsed.segments.filter(s => selected.has(s.id)); assert.equal(segments.length, selected.size)
  const matcher = bernTpfTerminalMatcher({ ...parsed, segments }, policy)
  return { policy, matcher, metadata: { policySha256: sha(bytes), policy, source: baseline.metadata.source,
    sourceSegments: matcher.sourceInventory, terminalEvidence: matcher.evidence } }
}
export const applyBernTpfTerminal = applyBernRail
