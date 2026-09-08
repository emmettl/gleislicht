// Source screening only; candidate paths are not admitted to the vehicle feed.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { inWater, segmentInWater, distanceMetres } from './water-paths.mjs'
const dir = 'data/thurgau-water-review', path = `${dir}/foen-bodensee.json.gz`
if (process.argv[2]) await writeFile(path, gzipSync(await readFile(process.argv[2]), { mtime: 0 }))
const bytes = gunzipSync(await readFile(path)), response = JSON.parse(bytes), feature = response.feature
assert.equal(feature.id, 124); assert.equal(feature.layerBodId, 'ch.bafu.vec25-seen'); assert.equal(feature.geometry.type, 'MultiPolygon')
const polygons = feature.geometry.coordinates
for (const p of polygons) for (const r of p) {
  assert(r.length >= 4 && r.every(c => c.length === 2 && c.every(Number.isFinite)))
  assert.deepEqual(r[0], r.at(-1))
}
const raw = JSON.parse(gunzipSync(await readFile('data/thurgau-audit/timetable-cache.json.gz')))
const ids = new Set(raw.routes.filter(r => r.mode === 'ferry').map(r => r.id)), stops = new Map(), pairs = new Map()
function projection(p, polygon) {
  if (inWater(p, polygon)) return { point: p.slice(0, 2), offset: 0 }
  let best; const scale = Math.cos(p[1] * Math.PI / 180)
  for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], dx = (b[0] - a[0]) * scale, dy = b[1] - a[1], norm = dx * dx + dy * dy
    if (!norm) continue
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * scale * dx + (p[1] - a[1]) * dy) / norm)), point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], offset = distanceMetres(p, point)
    if (!best || offset < best.offset) best = { point, offset }
  }
  return best
}
const days = raw.snapshots.map(day => {
  const trains = day.trains.filter(t => ids.has(t.routeId)), candidates = []
  for (const t of trains) {
    const calls = t.stops.map(([i]) => day.stops[i]), keys = []
    for (const s of calls) if (!stops.has(s[4])) stops.set(s[4], { id: s[4], name: s[2], coordinate: s.slice(0, 2), projections: polygons.map(p => projection(s, p)) })
    for (let i = 1; i < calls.length; i++) {
      const a = stops.get(calls[i - 1][4]), b = stops.get(calls[i][4]), key = JSON.stringify([t.routeId, a.id, b.id]); keys.push(key)
      if (pairs.has(key)) continue
      const candidate = polygons.findIndex((p, j) => a.projections[j].offset <= 150 && b.projections[j].offset <= 150 && segmentInWater(a.projections[j].point, b.projections[j].point, p))
      pairs.set(key, { key, routeId: t.routeId, fromId: a.id, toId: b.id, candidatePolygon: candidate < 0 ? null : candidate,
        status: candidate < 0 ? 'no-direct-water-candidate-within-150m' : 'direct-water-candidate-not-admitted' })
    }
    if (keys.every(k => pairs.get(k).candidatePolygon !== null)) candidates.push(t.id)
  }
  return { date: day.metadata.serviceDate, boatJourneys: trains.length, completeDirectWaterCandidateJourneys: candidates.length, candidateJourneyIds: candidates }
})
const report = { sourceUrl: 'https://api3.geo.admin.ch/rest/services/ech/MapServer/ch.bafu.vec25-seen/124?geometryFormat=geojson&sr=4326', acquired: '2026-09-08',
  sha256: createHash('sha256').update(bytes).digest('hex'), attribution: '© FOEN, swisstopo',
  source: 'FOEN Vector25 lakes, original feature 124. Reference edition labelled 2007 by the existing source metadata; acquisition time does not establish an updated shoreline date.',
  sourceVertices: polygons.flatMap(p => p).reduce((n, r) => n + r.length, 0), polygons: polygons.length,
  status: 'screening-only-not-admitted', method: 'Use original source vertices without 60 m display simplification. Measure every called dock and check each straight projected pair against all shoreline and island intersections, with a 150 m screening offset. Candidate status is not route or dock-access verification.',
  nextEvidence: 'Review dock-to-water access and full candidate patterns before any admission; acquire connected Untersee/Rhine water geometry for rejected calls. No straight line may replace a missing river channel.',
  stops: [...stops.values()], directedPairs: [...pairs.values()], days }
await writeFile(`${dir}/original-source-review.json`, JSON.stringify(report, null, 2) + '\n')
console.log({ vertices: report.sourceVertices, docks: stops.size, fartherThan150m: report.stops.filter(s => s.projections.every(p => p.offset > 150)).length,
  pairs: pairs.size, candidates: report.directedPairs.filter(p => p.candidatePolygon !== null).length, days: days.map(({ candidateJourneyIds: _ids, ...d }) => d) })
