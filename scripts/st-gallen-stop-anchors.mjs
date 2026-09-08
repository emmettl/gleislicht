import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { sha256 } from './download-luzern-sources.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export function applyStGallenStopAnchors(raw, policy, externalStops) {
  const stops = new Map(raw.stops.map(s => [s.stop_id, { ...s }])), anchors = []
  assert.equal(new Set((policy.stopAnchors ?? []).map(a => a.stopId)).size, (policy.stopAnchors ?? []).length)
  for (const config of policy.stopAnchors ?? []) {
    assert.deepEqual(config.reviewedDates, raw.dates, 'Unreviewed anchor dates')
    const stop = stops.get(config.stopId); assert(stop)
    assert.equal(stop.stop_name, config.expectedName)
    assert.deepEqual([stop.stop_lon, stop.stop_lat], config.expectedCoordinate, 'Swiss anchor source coordinate changed')
    const records = config.sourceStops.map(s => externalStops.find(r => r.stop_id === s.stop_id))
    assert.deepEqual(records, config.sourceStops, 'External anchor source changed')
    const source = records.find(s => s.stop_id === config.sourceStopId); assert(source)
    const point = s => [Number(s.stop_lon), Number(s.stop_lat)]
    assert(config.maximumPlatformSpreadMetres > 0 && config.maximumPlatformSpreadMetres <= 15)
    assert(config.maximumShiftMetres > 0 && config.maximumShiftMetres <= 700)
    const spread = Math.max(...records.map(s => distanceMetres(point(source), point(s))))
    const shift = distanceMetres(point(stop), point(source))
    assert(spread <= config.maximumPlatformSpreadMetres && shift <= config.maximumShiftMetres)
    const usedRoutes = [...new Set(raw.snapshots.flatMap(d => d.trains.filter(t => t.calls.some(c => c.id === config.stopId)).map(t => t.routeId)))].sort()
    assert.deepEqual(usedRoutes, [...config.routeIds].sort(), 'Anchor would affect unreviewed routes')
    anchors.push({ id: config.id, stopId: config.stopId, name: stop.stop_name, originalCoordinate: point(stop), coordinate: point(source),
      sourceStopId: source.stop_id, platformSpreadMetres: spread, shiftMetres: shift, sourceSha256: config.sourceSha256, routeIds: config.routeIds, use: config.use })
    stop.stop_lon = source.stop_lon; stop.stop_lat = source.stop_lat
  }
  return { stops, anchors }
}

export async function loadStGallenStopAnchors(raw, policy, directory, timetableSha256) {
  const records = []
  for (const config of policy.stopAnchors ?? []) {
    assert.equal(config.reviewedTimetableSha256, timetableSha256, 'Unreviewed anchor timetable')
    const archive = join(directory, config.sourceFile)
    assert.equal(sha256(await readFile(archive)), config.sourceSha256)
    for (const e of config.evidence) assert.equal(sha256(await readFile(join(directory, e.file))), e.sha256)
    const bytes = await readFile(config.scheduleReview.path)
    assert.equal(sha256(bytes), config.scheduleReview.sha256, 'Anchor schedule evidence changed')
    const proof = JSON.parse(bytes)
    assert.equal(proof.sourceHashes.timetable, timetableSha256)
    assert.deepEqual(proof.days.map(d => d.date), raw.dates)
    for (const day of proof.days) {
      assert(day.patterns.every(p => p.allCallTimesMatch && p.orderedStopNamesMatch))
      assert.equal(day.swissTrips, day.externalTrips)
      assert.equal(raw.snapshots.find(d => d.date === day.date).trains.filter(t => config.routeIds.includes(t.routeId)).length, day.swissTrips)
    }
    const { stdout } = await promisify(execFile)('python3', ['-c', `
import csv,io,json,sys,zipfile
z=zipfile.ZipFile(sys.argv[1]); ids=set(json.loads(sys.argv[2]))
print(json.dumps([{k:r[k] for k in ['stop_id','stop_name','stop_lon','stop_lat']} for r in csv.DictReader(io.TextIOWrapper(z.open('stops.txt'),encoding='utf-8-sig')) if r['stop_id'] in ids]))
`, archive, JSON.stringify(config.sourceStops.map(s => s.stop_id))])
    records.push(...JSON.parse(stdout))
  }
  return applyStGallenStopAnchors(raw, policy, records)
}
