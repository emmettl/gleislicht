import { test } from 'vitest'
import assert from 'node:assert/strict'
import { activeVmobilServices, directedShapeSlice, vmobilStopName } from './review-st-gallen-vmobil.mjs'

test('shape-distance clipping follows the supplied direction through repeated coordinates', () => {
  const points = [[0, 0, 0], [1, 0, 10], [1, 1, 20], [0, 0, 30], [-1, 0, 40]]
  assert.deepEqual(directedShapeSlice(points, 5, 35), [[0.5, 0], [1, 0], [1, 1], [0, 0], [-0.5, 0]])
  assert.deepEqual(directedShapeSlice(points, 30, 40), [[0, 0], [-1, 0]])
  assert.throws(() => directedShapeSlice(points, 35, 5))
  assert.throws(() => directedShapeSlice(points, 0, 41), /outside/)
  assert.throws(() => directedShapeSlice([[0, 0, 5], [1, 0, 4]], 5, 6), /order/)
})

test('calendar exceptions override weekday flags and apply to exception-only services', () => {
  const raw = { calendar: [
    { service_id: 'weekday', start_date: '20260101', end_date: '20261231', friday: '1', sunday: '0' },
    { service_id: 'expired', start_date: '20260101', end_date: '20260801', friday: '1', sunday: '1' },
  ], exceptions: [
    { service_id: 'weekday', date: '20260904', exception_type: '2' },
    { service_id: 'special', date: '20260904', exception_type: '1' },
    { service_id: 'weekday', date: '20260906', exception_type: '1' },
  ] }
  assert.deepEqual([...activeVmobilServices(raw, '2026-09-04')], ['special'])
  assert.deepEqual([...activeVmobilServices(raw, '2026-09-06')], ['weekday'])
})

test('reviewed name normalization tolerates typography without collapsing distinct stops', () => {
  assert.equal(vmobilStopName('Lustenau, Philipp-Krapf-Str.'), vmobilStopName('Lustenau Philipp-Krapf-Straße'))
  assert.equal(vmobilStopName('Dornbirn, Treffpunkt a.d.Ach'), vmobilStopName('Dornbirn Treffpunkt A.d.Ach'))
  assert.notEqual(vmobilStopName('Dornbirn, Messeplatz'), vmobilStopName('Dornbirn, Messekreuzung'))
})
