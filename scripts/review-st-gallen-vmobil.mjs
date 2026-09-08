import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'

const output = 'data/st-gallen-vmobil-review.json'
const json = async p => JSON.parse(await readFile(p, 'utf8'))
const sourceDirectory = 'data/st-gallen-sources/local/endpoint-review'
const zipPath = `${sourceDirectory}/vmobil-20260703.zip`
const archiveSha256 = 'c19094742f994a7c7b346d67a2021d35b71bce610a994e5825b0f8d1900438ed'
// These two spelling differences are reviewed for this route; not a fuzzy
// stop-name matcher or an automatic cross-feed identity rule.
export const vmobilStopName = name => name.toLowerCase().replaceAll('ß', 'ss').replaceAll('straße', 'strasse')
  .replace('philipp-krapf-str.', 'philipp-krapf-strasse').replace(/[, .]/g, '')
const seconds = text => text.split(':').reduce((n, v) => n * 60 + Number(v), 0)

export function directedShapeSlice(points, start, end) {
  assert(points.length > 1 && Number.isFinite(start) && end > start)
  assert(points.every((p, i) => p.length === 3 && p.every(Number.isFinite) && (!i || p[2] >= points[i - 1][2])), 'Invalid shape order')
  assert(start >= points[0][2] && end <= points.at(-1)[2], 'Stop distance outside source shape')
  const at = distance => {
    const exact = points.find(p => p[2] === distance)
    if (exact) return exact.slice(0, 2)
    const i = points.findIndex(p => p[2] > distance), a = points[i - 1], b = points[i]
    const t = (distance - a[2]) / (b[2] - a[2])
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
  }
  return [at(start), ...points.filter(p => p[2] > start && p[2] < end).map(p => p.slice(0, 2)), at(end)]
}

async function extract() {
  const { stdout } = await promisify(execFile)('python3', ['-c', `
import csv,io,json,zipfile,collections,sys
z=zipfile.ZipFile(sys.argv[1])
def rows(n): return csv.DictReader(io.TextIOWrapper(z.open(n),encoding='utf-8-sig'))
routes=[r for r in rows('routes.txt') if r['route_id']=='at:vvv:164:']; assert len(routes)==1
trips=[r for r in rows('trips.txt') if r['route_id']=='at:vvv:164:']; ids={t['trip_id'] for t in trips}
calls=collections.defaultdict(list)
for r in rows('stop_times.txt'):
 if r['trip_id'] in ids:calls[r['trip_id']].append(r)
shapes=collections.defaultdict(list); shape_ids={t['shape_id'] for t in trips}
for r in rows('shapes.txt'):
 if r['shape_id'] in shape_ids:shapes[r['shape_id']].append(r)
stop_ids={r['stop_id'] for c in calls.values() for r in c}; services={t['service_id'] for t in trips}
print(json.dumps({'route':routes[0],'agency':next(r for r in rows('agency.txt') if r['agency_id']==routes[0]['agency_id']),
 'feed':list(rows('feed_info.txt'))[0],'trips':trips,'calls':calls,'shapes':shapes,
 'stops':[r for r in rows('stops.txt') if r['stop_id'] in stop_ids],
 'calendar':[r for r in rows('calendar.txt') if r['service_id'] in services],
 'exceptions':[r for r in rows('calendar_dates.txt') if r['service_id'] in services]}))
`, zipPath], { maxBuffer: 5 * 1024 * 1024 })
  return JSON.parse(stdout)
}

export function activeVmobilServices(raw, date) {
  const compact = date.replaceAll('-', ''), weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(`${date}T12:00:00Z`).getUTCDay()]
  const active = new Set(raw.calendar.filter(c => c.start_date <= compact && c.end_date >= compact && c[weekday] === '1').map(c => c.service_id))
  for (const e of raw.exceptions.filter(e => e.date === compact)) {
    assert(['1', '2'].includes(e.exception_type))
    if (e.exception_type === '1') active.add(e.service_id); else active.delete(e.service_id)
  }
  return active
}

export function validateVmobilDay(review, day, limits, anchors = []) {
  const result = review.days.find(d => d.date === day.date); assert(result)
  assert.equal(result.dayAuditSha256, sha256(JSON.stringify(day)), 'Stale Vorarlberg day binding')
  const patterns = day.directedPatterns.filter(p => p.routeId === '92-164-C-j26-1')
  assert.deepEqual(result.patterns.map(p => p.patternId).sort(), patterns.map(p => p.id).sort())
  assert.equal(result.swissTrips, patterns.reduce((n, p) => n + p.trips, 0))
  assert.equal(result.externalTrips, result.swissTrips)
  for (const resultPattern of result.patterns) {
    const pattern = patterns.find(p => p.id === resultPattern.patternId)
    assert.equal(resultPattern.routeId, pattern.routeId); assert.equal(resultPattern.directionId, pattern.directionId)
    assert.equal(resultPattern.swissTrips, pattern.trips); assert.equal(resultPattern.externalTrips, pattern.trips)
    assert(resultPattern.orderedStopNamesMatch && resultPattern.allCallTimesMatch)
    assert.equal(resultPattern.variants.reduce((n, v) => n + v.activeTrips, 0), pattern.trips)
    assert.equal(new Set(resultPattern.variants.map(v => v.shapeId)).size, resultPattern.variants.length)
    for (const variant of resultPattern.variants) {
      const source = review.sourceShapeInventory.find(s => s.shapeId === variant.shapeId); assert(source)
      assert.equal(source.sha256, variant.shapeSha256); assert(source.activeDates.includes(day.date))
      assert.deepEqual(variant.stops.map(s => s.swissStopId), pattern.stopIds)
      assert.deepEqual(variant.stops.map(s => s.swissName), pattern.stopNames)
      assert(variant.stops.every(s => vmobilStopName(s.swissName) === vmobilStopName(s.externalName) && Number.isFinite(s.coordinateSeparationMetres) && s.coordinateSeparationMetres >= 0))
      assert.equal(variant.pairs.length, pattern.stopIds.length - 1)
      for (const [i, pair] of variant.pairs.entries()) {
        assert.deepEqual([pair.fromId, pair.toId], pattern.stopIds.slice(i, i + 2))
        assert.deepEqual([pair.from, pair.to], pattern.stopNames.slice(i, i + 2))
        assert.deepEqual([pair.externalFromId, pair.externalToId], variant.stops.slice(i, i + 2).map(s => s.externalStopId))
        assert(pair.sourceEndDistance > pair.sourceStartDistance && pair.pathMetres > 0)
        assert([pair.directMetres, pair.swissEndpointGapMetres, pair.externalEndpointGapMetres].every(n => Number.isFinite(n) && n >= 0))
        assert(/^[a-f0-9]{64}$/.test(pair.geometrySha256))
        const reason = pair.swissEndpointGapMetres > limits.snapMetres ? 'endpoint-gap'
          : pair.pathMetres > Math.max(limits.detourFloorMetres, limits.detourRatio * pair.directMetres) ? 'implausible-detour' : 'candidate-path'
        assert.equal(pair.reason, reason)
      }
      assert.equal(variant.completePatternPasses, variant.pairs.every(p => p.reason === 'candidate-path'))
      assert(!variant.completePatternPasses, 'Original-coordinate discrepancy no longer applies')
      if (pattern.admitted) assert(anchors.some(a=>a.routeIds.includes(pattern.routeId)&&a.reviewedDates.includes(day.date)&&pattern.stopIds.includes(a.stopId)), 'Unreviewed admission despite source-coordinate discrepancy')
    }
  }
  assert.equal(result.externalActiveShapes, new Set(result.patterns.flatMap(p => p.variants.map(v => v.shapeId))).size)
}

export async function reviewStGallenVmobil() {
  assert.equal(sha256(await readFile(zipPath)), archiveSha256)
  const audit = await json('data/st-gallen-audit/local-report.json'), timetableBytes = await readFile('data/st-gallen-sources/local/timetable.json')
  assert.equal(sha256(timetableBytes), audit.sourceHashes.timetable)
  assert.equal(sha256(await readFile('data/st-gallen-policy.json')), audit.sourceHashes.policy)
  const timetable = JSON.parse(timetableBytes), raw = await extract()
  const evidence = (await json(`${sourceDirectory}/sources.json`)).filter(s => ['vmobil', 'vmobil-license', 'vmobil-catalogue'].includes(s.id))
  assert.equal(evidence.length, 3)
  for (const source of evidence) assert.equal(sha256(await readFile(`${sourceDirectory}/${source.file}`)), source.sha256)
  assert.equal(raw.route.route_short_name, '164'); assert.equal(raw.route.agency_id, '33'); assert.equal(raw.agency.agency_name, 'Landbus Unterland')
  assert.equal(raw.feed.feed_version, '20260703')
  const swissStops = new Map(timetable.stops.map(s => [s.stop_id, s])), externalStops = new Map(raw.stops.map(s => [s.stop_id, s]))
  const coord = s => [Number(s.stop_lon), Number(s.stop_lat)]
  const shapePoints = new Map(Object.entries(raw.shapes).map(([id, rows]) => {
    rows.sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence))
    assert.equal(new Set(rows.map(r => r.shape_pt_sequence)).size, rows.length)
    return [id, rows.map(r => [Number(r.shape_pt_lon), Number(r.shape_pt_lat), Number(r.shape_dist_traveled)])]
  }))
  for (const trip of raw.trips) {
    const calls = raw.calls[trip.trip_id]; calls.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence))
    assert.equal(new Set(calls.map(c => c.stop_sequence)).size, calls.length)
    assert(calls.every((c, i) => Number.isFinite(Number(c.shape_dist_traveled)) && seconds(c.arrival_time) <= seconds(c.departure_time)
      && (!i || seconds(c.arrival_time) >= seconds(calls[i - 1].departure_time))), 'Invalid external calls')
  }
  const days = []
  for (const day of audit.days) {
    const active = activeVmobilServices(raw, day.date), externalTrips = raw.trips.filter(t => active.has(t.service_id))
    const swissTrips = timetable.snapshots.find(s => s.date === day.date).trains.filter(t => t.routeId === '92-164-C-j26-1')
    // No preceding-day spillover exists for this route in either source. Fail
    // closed if a later source introduces it; do not compare service-day counts
    // against civil-day counts without accounting for that distinction.
    assert(swissTrips.every(t => t.sourceServiceDate === day.date))
    const previous = new Date(`${day.date}T12:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1)
    const prior = activeVmobilServices(raw, previous.toISOString().slice(0, 10))
    assert(raw.trips.filter(t => prior.has(t.service_id)).every(t => seconds(raw.calls[t.trip_id].at(-1).arrival_time) < 86400))
    assert(externalTrips.every(t => seconds(raw.calls[t.trip_id].at(-1).arrival_time) < 86400))
    const patterns = []
    for (const pattern of day.directedPatterns.filter(p => p.routeId === '92-164-C-j26-1')) {
      const names = pattern.stopNames.map(vmobilStopName)
      const matched = externalTrips.filter(t => t.direction_id === pattern.directionId && JSON.stringify(raw.calls[t.trip_id].map(c => vmobilStopName(externalStops.get(c.stop_id).stop_name))) === JSON.stringify(names))
      assert.equal(matched.length, pattern.trips, 'External full-pattern trip count differs')
      const variants = []
      for (const shapeId of [...new Set(matched.map(t => t.shape_id))]) {
        const trips = matched.filter(t => t.shape_id === shapeId), calls = raw.calls[trips[0].trip_id], points = shapePoints.get(shapeId)
        const graph = lineGraph([{ geometry: { type: 'LineString', coordinates: points.map(p => p.slice(0, 2)) } }])
        for (const t of trips) assert.deepEqual(raw.calls[t.trip_id].map(c => [c.stop_id, c.shape_dist_traveled]), calls.map(c => [c.stop_id, c.shape_dist_traveled]))
        const stops = calls.map((c, i) => {
          const swiss = swissStops.get(pattern.stopIds[i]), external = externalStops.get(c.stop_id)
          return { swissStopId: swiss.stop_id, swissName: swiss.stop_name, externalStopId: external.stop_id, externalName: external.stop_name,
            coordinateSeparationMetres: distanceMetres(coord(swiss), coord(external)) }
        })
        const pairs = calls.slice(1).map((c, i) => {
          const path = directedShapeSlice(points, Number(calls[i].shape_dist_traveled), Number(c.shape_dist_traveled))
          const a = coord(swissStops.get(pattern.stopIds[i])), b = coord(swissStops.get(pattern.stopIds[i + 1]))
          const externalA = coord(externalStops.get(calls[i].stop_id)), externalB = coord(externalStops.get(c.stop_id))
          const swissEndpointGapMetres = Math.max(distanceMetres(a, path[0]), distanceMetres(b, path.at(-1)))
          const externalEndpointGapMetres = Math.max(distanceMetres(externalA, path[0]), distanceMetres(externalB, path.at(-1)))
          const pathMetres = path.slice(1).reduce((n, p, j) => n + distanceMetres(path[j], p), 0)
          const ceiling = Math.max(audit.policy.limits.detourFloorMetres, audit.policy.limits.detourRatio * distanceMetres(a, b))
          const nearest = matchBaselSegment(graph, a, b, audit.policy.limits)
          return { fromId: pattern.stopIds[i], toId: pattern.stopIds[i + 1], from: pattern.stopNames[i], to: pattern.stopNames[i + 1],
            externalFromId: calls[i].stop_id, externalToId: c.stop_id,
            sourceStartDistance: Number(calls[i].shape_dist_traveled), sourceEndDistance: Number(c.shape_dist_traveled),
            geometrySha256: sha256(JSON.stringify(path)), pathMetres, directMetres: distanceMetres(a, b), swissEndpointGapMetres, externalEndpointGapMetres,
            nearestFullShapeDiagnostic: { reason: nearest.reason ?? 'candidate-path', maximumSnapMetres: nearest.maximumSnapMetres },
            reason: swissEndpointGapMetres > audit.policy.limits.snapMetres ? 'endpoint-gap' : pathMetres > ceiling ? 'implausible-detour' : 'candidate-path' }
        })
        variants.push({ shapeId, activeTrips: trips.length, sourceTripIdsSha256: sha256(JSON.stringify(trips.map(t => t.trip_id).sort())),
          shapeSha256: sha256(JSON.stringify(points)), stops, pairs, completePatternPasses: pairs.every(p => p.reason === 'candidate-path') })
      }
      const sourceSchedule = matched.map(t => raw.calls[t.trip_id].map(c => [seconds(c.arrival_time), seconds(c.departure_time)])).map(JSON.stringify).sort()
      const swissSchedule = swissTrips.filter(t => t.directionId === pattern.directionId).map(t => t.calls.map(c => [c.arrival, c.departure])).map(JSON.stringify).sort()
      patterns.push({ patternId: pattern.id, routeId: pattern.routeId, directionId: pattern.directionId, swissTrips: pattern.trips,
        externalTrips: matched.length, orderedStopNamesMatch: true, allCallTimesMatch: JSON.stringify(sourceSchedule) === JSON.stringify(swissSchedule), variants,
        decision: pattern.admitted ? 'Admitted on original AL_OEV geometry using the separately reviewed stop rendering anchor; this comparison retains original Swiss coordinates.'
          : variants.some(v => v.completePatternPasses) ? 'Candidate requires separate admission review.' : 'Retain exclusion: external shapes do not resolve Swiss endpoint coordinates.' })
    }
    assert.equal(patterns.reduce((n, p) => n + p.externalTrips, 0), externalTrips.length)
    days.push({ date: day.date, dayAuditSha256: sha256(JSON.stringify(day)), swissTrips: swissTrips.length, externalTrips: externalTrips.length,
      externalActiveShapes: new Set(externalTrips.map(t => t.shape_id)).size, patterns })
  }
  const report = { schemaVersion: 1, sourceHashes: audit.sourceHashes, sourceEvidence: evidence, externalRoute: raw.route, externalAgency: raw.agency, externalFeed: raw.feed,
    sourceShapeInventory: [...shapePoints].map(([shapeId, points]) => ({ shapeId, points: points.length, sha256: sha256(JSON.stringify(points)),
      activeDates: days.filter(d => d.patterns.some(p => p.variants.some(v => v.shapeId === shapeId))).map(d => d.date) })),
    method: 'Calendar plus exceptions, complete ordered name/direction comparison with explicit spelling normalization, then forward shape-distance slices for every call pair. Original Swiss stop coordinates remain unchanged. Names establish a candidate correspondence, not authorization to replace a stop coordinate.',
    days, validation: { passed: true, feedChanged: false, stopCoordinatesChanged: false, externalShapesAdmitted: false, directionCertified: false } }
  for (const day of audit.days) validateVmobilDay(report, day, audit.policy.limits, audit.policy.stopAnchors)
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await reviewStGallenVmobil()
  if (process.argv.includes('--check')) assert.deepEqual(report, await json(output), 'Stale Vorarlberg review')
  else await writeFile(output, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: true, days: report.days.map(d => ({ date: d.date, swissTrips: d.swissTrips, externalTrips: d.externalTrips,
    patterns: d.patterns.map(p => ({ direction: p.directionId, timesMatch: p.allCallTimesMatch, variants: p.variants.map(v => ({ shapeId: v.shapeId,
      failures: v.pairs.filter(p => p.reason !== 'candidate-path').map(p => ({ from: p.from, to: p.to, gap: p.swissEndpointGapMetres })) })) })) })) }, null, 2))
}
