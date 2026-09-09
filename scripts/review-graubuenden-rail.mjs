import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { readJson, saveJson } from './build-graubuenden-region.mjs'
import { loadGraubuendenGeometry } from './graubuenden-geometry.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const policy = await readJson('data/graubuenden-policy.json'), raw = await readJson('data/graubuenden-audit/timetable.json.gz')
const primary = await loadGraubuendenGeometry({ ...policy, railAnchorReview: undefined }, raw), current = await loadGraubuendenGeometry(policy, raw)
const routes = new Map(raw.inventory.map(r => [r.routeId, r])), before = new Map(), after = new Map(), days = []
const conditional = t => t.calls.some(c => ['2', '3'].includes(c.pickupType) || ['2', '3'].includes(c.dropOffType))
for (const day of raw.snapshots) {
  let candidates = 0, originalAdmitted = 0, admitted = 0, unchangedCompleteJourneys = 0
  const patterns = new Map()
  for (const t of day.trains) {
    const route = routes.get(t.routeId)
    if (route.mode !== 'rail') continue
    candidates++
    const key = directedPatternKey(t)
    if (!before.has(key)) { before.set(key, primary.matchPattern(t, route)); after.set(key, current.matchPattern(t, route)) }
    const a = before.get(key), b = after.get(key), oldOk = a.every(p => p.path) && !conditional(t), ok = b.every(p => p.path) && !conditional(t)
    originalAdmitted += Number(oldOk); admitted += Number(ok)
    if (oldOk) { assert.deepEqual(b, a, 'Previously complete journey changed'); unchangedCompleteJourneys++ }
    if (!patterns.has(key)) patterns.set(key, { id: sha256(key).slice(0, 20), routeId: route.routeId, line: route.line, agencyId: route.agencyId,
      stopIds: t.calls.map(c => c.id), originallyAdmitted: oldOk, admitted: ok, trips: 0,
      originalFailures: a.filter(p => !p.path).map(({ path: _path, ...e }) => e), remainingReasons: [...new Set(b.filter(p => !p.path).map(p => p.reason))],
      anchorReviews: [...new Set(b.flatMap(p => (p.reviewedSourceSlices ?? []).map(s => s.reviewId)))] })
    patterns.get(key).trips++
  }
  const report = await readJson(`data/graubuenden-audit/${day.date}.json`), rail = report.byMode.find(m => m.id === 'rail')
  assert.equal(rail.trips, candidates); assert.equal(rail.admittedTrips, admitted)
  for (const p of patterns.values()) { const actual = report.patterns.find(r => r.id === p.id); assert.equal(actual.admitted, p.admitted); assert.equal(actual.trips, p.trips) }
  days.push({ date: day.date, candidates, originalAdmitted, admitted, gained: admitted - originalAdmitted, unchangedCompleteJourneys,
    gainedPatterns: [...patterns.values()].filter(p => p.admitted && !p.originallyAdmitted), remainingExcludedPatterns: [...patterns.values()].filter(p => !p.admitted) })
}
const alternatives = []
for (const file of ['sbb-sagliains', 'sbb-schmitten']) {
  const page = JSON.parse(gunzipSync(await readFile(`data/graubuenden-rail-review/${file}.response.gz`)))
  assert.equal(page.results.length, page.total_count)
  alternatives.push(...page.results.map(r => ({ file, line: r.linienr, from: r.bp_anf_bez, to: r.bp_end_bez,
    gauge: r.spurweite, vertices: r.geo_shape.geometry.coordinates.length, admitted: false,
    reason: r.geo_shape.geometry.coordinates.length === 2 ? 'schematic-two-point-record' : 'different-Schmitten-location-not-Graubuenden' })))
}
const review = { sourceHashes: { timetable: policy.timetableSha256, rail: policy.rail.sourceSha256, policy: sha256(await readFile('data/graubuenden-policy.json')), anchorPolicy: policy.railAnchorReview.policySha256 },
  model: 'Two reviewed station anchors subdivide existing RhB source curves. Baseline is the same pinned FOT/OSM pipeline with this review disabled. All originally complete rail paths and evidence must remain exactly identical.',
  anchors: current.railAnchors.reviews, alternatives, days }
await saveJson('data/graubuenden-audit/rail-anchor-review.json', review)

// Geographic review figure: local equirectangular metre axes, same scale in x/y.
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
const svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="650" viewBox="0 0 1280 650">',
 '<rect width="1280" height="650" fill="#101b29"/>', '<style>text{font-family:Arial,sans-serif;fill:#e8f0f8} .small{font-size:13px} .label{font-size:14px} .title{font-size:22px;font-weight:bold}</style>',
 '<text x="30" y="36" class="title">Graubünden · reviewed station positions on pinned FOT curves</text>',
 '<text x="30" y="62" class="label">Derived stop attachments · original GTFS coordinates retained · no new alignment</text>']
for (const [i, r] of review.anchors.entries()) {
  const a = current.railAnchors.policy.anchors[i], points = r.slices.flatMap(s => s.points), lonScale = Math.cos(a.referenceCoordinate[1] * Math.PI / 180) * 111320
  const metre = p => [(p[0] - a.referenceCoordinate[0]) * lonScale, (p[1] - a.referenceCoordinate[1]) * 111320]
  const extent = points.concat(a.stops.map(s => s.coordinate), [r.sourceStartNode.coordinate, r.sourceEndNode.coordinate]).map(metre)
  const xs = extent.map(p => p[0]), ys = extent.map(p => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const scale = Math.min(510 / (maxX - minX), 350 / (maxY - minY)), ox = 55 + i * 630, oy = 138
  const xy = p => { const [x, y] = metre(p); return [ox + (x - minX) * scale, oy + 350 - (y - minY) * scale] }
  svg.push(`<text x="${ox}" y="105" class="title">${escape(r.name)}</text>`)
  svg.push(`<polyline points="${points.map(p => xy(p).join(',')).join(' ')}" fill="none" stroke="#62d6c5" stroke-width="4"/>`)
  for (const [node, dy] of [[r.sourceStartNode, 24], [r.sourceEndNode, -14]]) {
    const [x, y] = xy(node.coordinate); svg.push(`<circle cx="${x}" cy="${y}" r="5" fill="#ffffff"/><text x="${x + 8}" y="${y + dy}" class="label">${escape(node.name)}${node.id === r.replacesOperatingPoint ? ' · old source node' : ''}</text>`)
  }
  const [x, y] = xy(r.projection.coordinate)
  svg.push(`<circle cx="${x}" cy="${y}" r="10" fill="#101b29" stroke="#ffc873" stroke-width="3"/><text x="${x + 16}" y="${y - 16}" class="label">Reviewed anchor</text>`)
  for (const s of a.stops) { const [px, py] = xy(s.coordinate); svg.push(`<path d="M${px - 4},${py - 4}L${px + 4},${py + 4}M${px - 4},${py + 4}L${px + 4},${py - 4}" stroke="#ff89ae" stroke-width="2"/>`) }
  svg.push(`<text x="${ox}" y="550" class="label">Platform attachments: ${r.platformAttachmentsMetres.map(m => m.toFixed(1)+' m').join(' / ')}</text>`)
  svg.push(`<text x="${ox}" y="574" class="small">Nearest alternative RhB curve: ${r.nearestAlternative.metres.toFixed(1)} m</text>`)
  svg.push(`<text x="${ox}" y="598" class="small">Source: ${r.sourceSegmentId} · ${r.sourceLengthMetres.toFixed(0)} m</text>`)
}
svg.push('<text x="30" y="633" class="small">© FOT · timetable: SBB / opentransportdata.swiss · teal: FOT curve · amber: derived anchor · pink: timetable stop</text></svg>')
await mkdir('docs/assets', { recursive: true }); await writeFile('docs/assets/graubuenden-rail-anchors.svg', svg.join('\n'))
console.log(JSON.stringify(days.map(({ gainedPatterns: _gainedPatterns, remainingExcludedPatterns: _remainingExcludedPatterns, ...d }) => d)))
