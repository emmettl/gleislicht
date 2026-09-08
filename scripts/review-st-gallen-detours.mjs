import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { gunzipSync } from 'node:zlib'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const root = 'data/st-gallen-sources/local/detour-review'
const output = 'data/st-gallen-detour-review.json'
const json = async p => JSON.parse(await readFile(p, 'utf8'))
const save = (p, value) => writeFile(p, JSON.stringify(value, null, 2) + '\n')
const key = p => p.map(n => n.toFixed(7)).join(',')
const edgeKey = (a, b) => [key(a), key(b)].sort().join('|')
const sources = [
  { id: '352', publisher: 'RTB Rheintal Bus', url: 'https://www.rtb.ch/reisen/info-haltestelle/detail-linie/352',
    required: ['352 Heerbrugg', 'Widnau, Nöllenstrasse', 'Heerbrugg, Rosenbergsaustrasse'] },
  { id: '353', publisher: 'RTB Rheintal Bus', url: 'https://www.rtb.ch/reisen/info-haltestelle/detail-linie/353',
    required: ['353 Heerbrugg', 'Widnau, Nöllenstrasse', 'Heerbrugg, Rosenbergsaustrasse'] },
  { id: '432', publisher: 'BUS Sarganserland Werdenberg', url: 'https://www.bsw-bus.ch/reisen/info-haltestelle/detail-linie/432',
    required: ['432 Sargans', 'Mels, Oberdorf', 'Mels, Fabrik'] },
  { id: 'notices', publisher: 'BUS Sarganserland Werdenberg / BOS Gruppe', url: 'https://www.bsw-bus.ch/reisen/stoerungen/betriebsmeldungen',
    required: ['Mels, Wolfriet und Sargans, Kantonsschule der Linie 400 sind nicht bedient.',
      '10.08.2026, 06:00 - 18.12.2026, 23:59', 'Die Haltestelle Mels, Oberdorf ist verschoben.',
      '10.08.2026, 06:00 - 31.01.2027, 23:59', '20 Meter Richtung Mels, Verrucano'] },
]

export async function fetchStGallenDetourEvidence() {
  await mkdir(root, { recursive: true })
  const records = await Promise.all(sources.map(async source => {
    const file = `${source.id}.html`
    await promisify(execFile)('curl', ['-fsSL', '--max-time', '45', source.url, '-o', join(root, file)])
    const bytes = await readFile(join(root, file))
    return { ...source, file, sha256: sha256(bytes), bytes: bytes.length, retrievedAt: new Date().toISOString(),
      sourceEditionDate: null, use: 'Operator stop-order or operating-notice evidence only; not a street geometry source.' }
  }))
  await save(join(root, 'sources.json'), records)
}

const resultSummary = result => ({ reason: result.reason ?? 'candidate-path', pathMetres: result.pathMetres ?? null,
  maximumSnapMetres: result.maximumSnapMetres ?? null, ...(result.path ? { geometrySha256: sha256(JSON.stringify(result.path)) } : {}) })
function components(graph) {
  const seen = new Set(); let count = 0
  for (let i = 0; i < graph.points.length; i++) if (!seen.has(i)) {
    count++; const queue = [i]; seen.add(i)
    while (queue.length) for (const [next] of graph.adjacency[queue.pop()]) if (!seen.has(next)) { seen.add(next); queue.push(next) }
  }
  return count
}

// This experiment never changes production graphs, limits, or feed files.
export async function reviewStGallenDetours() {
  const audit = await json('data/st-gallen-audit/local-report.json')
  assert.equal(sha256(await readFile('data/st-gallen-policy.json')), audit.sourceHashes.policy)
  const timetableBytes = await readFile('data/st-gallen-sources/local/timetable.json')
  assert.equal(sha256(timetableBytes), audit.sourceHashes.timetable)
  const timetable = JSON.parse(timetableBytes), catalogue = await json('data/st-gallen-sources/local/sources.json')
  assert.equal(sha256(await readFile('data/st-gallen-sources/local/sources.json')), audit.sourceHashes.catalogue)
  const raw = await readFile('data/st-gallen-sources/local/bus.geojson.gz')
  assert.equal(sha256(raw), catalogue.sources.find(s => s.file === 'bus.geojson.gz').sha256)
  const bus = JSON.parse(gunzipSync(raw)), stops = new Map(timetable.stops.map(s => [s.stop_id, [Number(s.stop_lon), Number(s.stop_lat)]]))
  const evidence = await json(join(root, 'sources.json'))
  assert.equal(evidence.length, sources.length)
  for (const expected of sources) {
    const source = evidence.find(s => s.id === expected.id); assert(source)
    assert.equal(source.url, expected.url)
    assert.equal(source.file, `${expected.id}.html`)
    assert(Number.isFinite(Date.parse(source.retrievedAt)), 'Missing evidence retrieval time')
    const bytes = await readFile(join(root, source.file))
    assert.equal(sha256(bytes), source.sha256); assert.equal(bytes.length, source.bytes)
    const text = bytes.toString('utf8').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
    for (const phrase of expected.required) assert(text.includes(phrase), `Operator evidence changed: ${expected.id}: ${phrase}`)
  }
  const operator = bus.features.filter(f => f.properties.BETREIBER === 'BOS'), union = lineGraph(operator)
  const owners = new Map()
  for (const f of operator) f.geometry.coordinates.forEach((part, partIndex) => {
    for (let i = 1; i < part.length; i++) {
      const k = edgeKey(part[i - 1], part[i]), refs = owners.get(k) ?? []
      refs.push({ feature: `bus:${f.id}`, expectedName: f.properties.LINIENNAME, partIndex, startVertex: i - 1, endVertex: i })
      owners.set(k, refs)
    }
  })
  const selected = new Map(audit.days.flatMap(d => d.directedStopPairs.filter(p => p.mode === 'bus' && p.reason === 'implausible-detour').map(p => [p.key, p])))
  const pairs = []
  for (const pair of selected.values()) {
    assert.equal(pair.agencyId, '138', 'Unreviewed operator in detour failures')
    assert(['352', '353', '400', '432'].includes(pair.line), 'New detour requires review')
    const features = pair.sourceFeatures.map(id => bus.features.find(f => `bus:${f.id}` === id))
    assert(features.every(Boolean)); const graph = lineGraph(features)
    const from = stops.get(pair.fromId), to = stops.get(pair.toId)
    const production = matchBaselSegment(graph, from, to, audit.policy.limits)
    assert.equal(production.reason, pair.reason); assert.equal(production.pathMetres, pair.pathMetres)
    // Every edge becomes its own snap candidate, still within the existing 5 m allowance.
    const allEdges = matchBaselSegment({ ...graph, parts: graph.edges.map(e => [e]) }, from, to, audit.policy.limits)
    assert.equal(allEdges.reason, 'implausible-detour', 'A nearby edge now resolves a reviewed failure')
    const combined = matchBaselSegment(union, from, to, audit.policy.limits)
    const targetEdges = new Set(graph.edges.map(e => edgeKey(graph.points[e.a], graph.points[e.b])))
    const additionalEdges = []
    if (combined.path) for (let i = 1; i < combined.path.length; i++) {
      const a = combined.path[i - 1], b = combined.path[i], k = edgeKey(a, b)
      if (!targetEdges.has(k) && owners.has(k)) additionalEdges.push({ edgeSha256: sha256(k), lengthMetres: distanceMetres(a, b),
        bothEndsExistingTargetVertices: graph.indexes.has(key(a)) && graph.indexes.has(key(b)), sources: owners.get(k) })
    }
    assert.equal(components(graph), 1, 'Reviewed target topology changed')
    if (pair.line === '400') {
      assert(combined.path, 'Line-400 diagnostic candidate changed')
      assert.equal(additionalEdges.length, 1)
      const edge = additionalEdges[0]
      assert(edge.bothEndsExistingTargetVertices)
      assert(Math.abs(edge.lengthMetres - 33.299013767286716) < 0.01)
      assert.deepEqual(edge.sources.map(s => s.feature), ['bus:86'], 'Line-400 donor evidence changed')
    } else assert.equal(combined.reason, 'implausible-detour', 'Operator union now resolves a reviewed failure')
    const days = audit.days.map(day => {
      const p = day.directedStopPairs.find(p => p.key === pair.key)
      const patterns = day.directedPatterns.filter(p => p.pairKeys.includes(pair.key))
      assert(patterns.every(p => !p.admitted), 'Reviewed failed pair admitted')
      return { date: day.date, occurrences: p?.occurrences ?? 0, affectedPatterns: patterns.length,
        affectedTrips: patterns.reduce((n, p) => n + p.trips, 0), patternIdsSha256: sha256(JSON.stringify(patterns.map(p => p.id).sort())) }
    })
    pairs.push({ key: pair.key, routeId: pair.routeId, line: pair.line, fromId: pair.fromId, toId: pair.toId, from: pair.from, to: pair.to,
      sourceFeatures: pair.sourceFeatures, sourceComponents: components(graph), directMetres: distanceMetres(from, to),
      admissionCeilingMetres: Math.max(audit.policy.limits.detourFloorMetres, distanceMetres(from, to) * audit.policy.limits.detourRatio),
      production: resultSummary(production), everyNearbyEdge: resultSummary(allEdges), operatorUnion: resultSummary(combined), additionalEdges, days,
      decision: 'Retain complete-pattern exclusion.',
      rationale: pair.line === '400'
        ? 'The shorter operator-union candidate borrows an edge from another line within an already connected target graph. It does not qualify as the bounded, independently corroborated disconnected-component repair. Construction notices overlap both fixture dates but supply no diverted street path.'
        : pair.line === '432'
          ? 'All nearby edge projections and the operator union still fail. The operator confirms the ordered calls and a relocated Oberdorf stop during both fixtures, without validating the long source path.'
          : 'The operator confirms the circular-service stop order. Neither all nearby edge projections nor the operator union yields a passing path; the stop list alone does not validate the long source alignment.' })
  }
  const days = audit.days.map(day => {
    const patterns = day.directedPatterns.filter(p => p.pairKeys.some(k => selected.has(k)))
    return { date: day.date, reviewedPairs: pairs.filter(p => p.days.find(d => d.date === day.date).occurrences).length,
      affectedPatterns: patterns.length, affectedTrips: patterns.reduce((n, p) => n + p.trips, 0), admittedTrips: day.admittedTrips,
      dayAuditSha256: sha256(JSON.stringify(day)) }
  })
  return { schemaVersion: 1, scope: 'Every bus implausible-detour failure on the two pinned St. Gallen fixtures; not every exclusion reason.',
    sourceHashes: audit.sourceHashes, operatorEvidence: evidence.map(({ required, ...s }) => s),
    method: 'Replay exact route graphs, compare all edge projections within the unchanged 5 m allowance, then diagnose the exact-vertex union of BOS regional bus records. The union is not an admissible route graph. No geometry coordinates are redistributed.',
    pairs, days, validation: { passed: true, feedChanged: false, admissionLimitsChanged: false, directionCertified: false } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--fetch-evidence')) await fetchStGallenDetourEvidence()
  const report = await reviewStGallenDetours()
  if (process.argv.includes('--check')) assert.deepEqual(report, await json(output), 'Stale detour review')
  else await save(output, report)
  console.log(JSON.stringify({ passed: true, reviewedPairs: report.pairs.length, days: report.days }, null, 2))
}
