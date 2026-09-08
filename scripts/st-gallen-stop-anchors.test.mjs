import { test } from 'vitest'
import assert from 'node:assert/strict'
import { applyStGallenStopAnchors } from './st-gallen-stop-anchors.mjs'

function fixture() {
  const raw = { dates: ['2026-09-04'], stops: [{ stop_id: 's', stop_name: 'Stop', stop_lon: '9', stop_lat: '47' }],
    snapshots: [{ trains: [{ routeId: 'r', calls: [{ id: 's', arrival: 5, departure: 7 }] }] }] }
  const sourceStops = [{ stop_id: 'a', stop_name: 'Stop A', stop_lon: '9.001', stop_lat: '47' },
    { stop_id: 'b', stop_name: 'Stop B', stop_lon: '9.00101', stop_lat: '47' }]
  const policy = { stopAnchors: [{ id: 'anchor', stopId: 's', expectedName: 'Stop', expectedCoordinate: ['9','47'],
    reviewedDates: raw.dates, routeIds: ['r'], sourceStops, sourceStopId: 'a', maximumPlatformSpreadMetres: 15, maximumShiftMetres: 100 }] }
  return { raw, policy, records: structuredClone(sourceStops) }
}
test('anchor changes only the effective coordinate, retaining original source calls and stops', () => {
  const f=fixture(), original=structuredClone(f.raw), result=applyStGallenStopAnchors(f.raw,f.policy,f.records)
  assert.deepEqual(f.raw,original)
  assert.equal(result.stops.get('s').stop_lon,'9.001')
  assert.deepEqual(result.anchors[0].originalCoordinate,[9,47])
  assert.deepEqual(result.anchors[0].coordinate,[9.001,47])
  assert(result.anchors[0].shiftMetres>70 && result.anchors[0].platformSpreadMetres<1)
})
test('anchor rejects unreviewed dates, routes, source coordinates and external records', () => {
  for (const mutate of [
    f=>f.raw.dates=['2026-09-06'],
    f=>f.raw.snapshots[0].trains.push({routeId:'other',calls:[{id:'s'}]}),
    f=>f.raw.stops[0].stop_lon='9.0001',
    f=>f.records[0].stop_lon='9.002',
    f=>f.policy.stopAnchors.push(structuredClone(f.policy.stopAnchors[0])),
    f=>f.policy.stopAnchors[0].maximumShiftMetres=701,
    f=>f.policy.stopAnchors[0].maximumPlatformSpreadMetres=16,
  ]) { const f=fixture();mutate(f);assert.throws(()=>applyStGallenStopAnchors(f.raw,f.policy,f.records)) }
})
