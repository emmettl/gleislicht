import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { loadBernRail, applyBernRail } from './bern-rail-geometry.mjs'
import { parseZugRail, zugRailMatcher, operatingPointNumber } from './zug-rail-geometry.mjs'
import { bernTerminalNetwork } from './fribourg-bern-platforms.mjs'
import { previousServiceDate } from './civil-day.mjs'
const sha = b => createHash('sha256').update(b).digest('hex')
export const BERN_IR66_ROUTES = ['91-66-A-j26-1']

export function bernIr66Matcher(network, policy) {
  const terminal = policy.terminal, kerzers = policy.kerzers
  assert.deepEqual(network.nodes.get(kerzers.node.id), kerzers.node, 'Changed Kerzers BLS node')
  assert.equal(kerzers.node.number, '8516192'); assert.equal(kerzers.node.name, 'Kerzers BLS')
  const variants = new Map(), evidence = [], inventory = new Map()
  const config = { ...policy, operatingPointOverrides: [{ sourceNumber: kerzers.sourceNumber,
    targetNumber: kerzers.node.number, expectedName: kerzers.node.name, routeIds: BERN_IR66_ROUTES }] }
  for (const s of terminal.stops) {
    const stop = { stop_id: s[4], platform_code: s[3], stop_lon: s[0], stop_lat: s[1] }
    const variant = bernTerminalNetwork(network, terminal, stop, terminal.corridor)
    const matcher = zugRailMatcher(variant.network, config, [previousServiceDate(policy.dates[0]), policy.dates.at(-1)])
    assert(matcher.sourceInventory.every(s => !s.reason), 'Invalid reviewed IR66 source segment')
    for (const segment of matcher.sourceInventory) inventory.set(segment.id, segment)
    variants.set(s[4], { ...variant, matcher }); evidence.push(variant.evidence)
  }
  return { sourceInventory: [...inventory.values()], evidence, matchPattern(train, stops, route) {
    assert.equal(train.routeId, '91-66-A-j26-1')
    assert.equal(route.agencyId, '33'); assert.equal(route.line, 'IR66'); assert.equal(route.mode, 'rail')
    const reject = () => train.calls.slice(1).map(() => ({ reason: 'rail-unreviewed-ir66-platform-context' }))
    const bern = train.calls.map((c, i) => ({ id: c.id, index: i })).filter(c => operatingPointNumber(c.id) === terminal.node.number)
    if (bern.length !== 1 || ![0, train.calls.length - 1].includes(bern[0].index)) return reject()
    const { id, index } = bern[0], variant = variants.get(id)
    if (!variant) return reject()
    const reviewed = terminal.stops.find(s => s[4] === id), original = stops.get(id)
    assert.deepEqual([original.stop_lon, original.stop_lat], reviewed.slice(0, 2), 'Changed original Bern platform coordinates')
    const adjacent = train.calls[index === 0 ? 1 : index - 1]
    if (!terminal.adjacentOperatingPoints.includes(operatingPointNumber(adjacent.id))) return reject()
    const kerzersIds = train.calls.filter(c => operatingPointNumber(c.id) === kerzers.sourceNumber).map(c => c.id)
    for (const id of kerzersIds) {
      const expected = kerzers.stops.find(s => s.stop_id === id)
      if (!expected) return reject()
      const original = stops.get(id)
      assert.deepEqual([original.stop_lon, original.stop_lat], [expected.stop_lon, expected.stop_lat], 'Changed original Kerzers platform coordinates')
    }
    return variant.matcher.matchPattern(train, stops, route).map((r, i) => ({ ...r, ...(r.path ? {
      ir66Review: { terminalStopId: id, terminalSourceCurveId: terminal.corridor.segment.id,
        terminalClippedSegmentId: variant.evidence.clippedSegmentId,
        kerzersStopIds: kerzersIds, kerzersSourceNumber: kerzers.sourceNumber, kerzersTargetNumber: kerzers.node.number,
        touchesTerminal: index === i || index === i + 1, touchesKerzers: [train.calls[i].id, train.calls[i + 1].id].some(id => kerzersIds.includes(id)) },
    } : {}) }))
  } }
}

export async function loadBernIr66() {
  const bytes = await readFile('data/bern-ir66-policy.json'), policy = JSON.parse(bytes)
  const baseline = await loadBernRail()
  assert.equal(policy.sourceId, 'bern-ir66-reviewed-fot-rail-20210706')
  for (const key of ['sourceDirectory', 'sourceMetadataSha256', 'sourceSha256']) assert.equal(policy[key], baseline.policy[key])
  assert.deepEqual(policy.limits, baseline.policy.limits); assert.deepEqual(policy.dates, baseline.policy.dates)
  assert.deepEqual(policy.gauges, ['mm1435']); assert.deepEqual(policy.infrastructureOperators, ['SBB CFF FFS', 'BLSN'])
  assert.deepEqual(policy.routes.map(({ pairs: _pairs, ...r }) => r), [{ routeId: '91-66-A-j26-1', agencyId: '33', line: 'IR66', mode: 'rail' }])
  assert.equal(policy.terminal.maximumProjectionMetres, 75)
  assert.equal(policy.terminal.minimumTrimMetres, 50); assert.equal(policy.terminal.maximumTrimMetres, 450)
  assert.equal(policy.terminal.stops.length, 9); assert.equal(policy.kerzers.stops.length, 2)
  for (const doc of policy.documents) assert.equal(sha(await readFile(`${policy.documentsDirectory}/${doc.file}`)), doc.sha256, 'Changed IR66 station evidence')
  const xml = gunzipSync(await readFile(`${policy.sourceDirectory}/network.xtf.gz`)); assert.equal(sha(xml), policy.sourceSha256)
  const parsed = parseZugRail(xml.toString(), 0)
  const bindings = policy.routes[0].pairs
  assert.equal(new Set(bindings.map(p => JSON.stringify([p.fromId, p.toId]))).size, bindings.length)
  for (const p of bindings) assert.deepEqual(p.operatingPointPair, [p.fromId, p.toId].map(operatingPointNumber))
  const selected = new Set(bindings.flatMap(p => p.sourceSegments.map(id => id.split(':bern-terminal:')[0])))
  const segments = parsed.segments.filter(s => selected.has(s.id))
  assert.equal(segments.length, selected.size)
  const matcher = bernIr66Matcher({ ...parsed, segments }, policy)
  return { policy, matcher, metadata: { policySha256: sha(bytes), policy, source: baseline.metadata.source,
    sourceSegments: matcher.sourceInventory, terminalEvidence: matcher.evidence } }
}
export const applyBernIr66 = applyBernRail
