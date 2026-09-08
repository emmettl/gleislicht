import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { annualServiceDates, parentStationPatternKey, selectAnnualDates, reviewZugAnnual } from './review-zug-annual.mjs'

const calendar = overrides => ({ service_id: 'regular', start_date: '20260901', end_date: '20260930',
  monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0', ...overrides })

describe('Zug annual complete directed-pattern census', () => {
  it('applies additions and removals, including exception-only services and feed boundaries', () => {
    const result = annualServiceDates([calendar()], [
      { service_id: 'regular', date: '20260904', exception_type: '2' },
      { service_id: 'regular', date: '20260906', exception_type: '1' },
      { service_id: 'special', date: '20260905', exception_type: '1' },
      { service_id: 'special', date: '20260908', exception_type: '1' },
    ], '2026-09-04', '2026-09-07', new Set(['regular', 'special']))
    expect(result.get('regular')).toEqual(['2026-09-06', '2026-09-07'])
    expect(result.get('special')).toEqual(['2026-09-05'])
  })
  it('rejects contradictory exceptions, duplicate calendars and invalid dates or weekday flags', () => {
    const exception = { service_id: 'regular', date: '20260904', exception_type: '1' }
    const run = (cal, changes) => annualServiceDates(cal, changes, '2026-09-01', '2026-09-30', new Set(['regular']))
    expect(() => run([calendar()], [exception, { ...exception, exception_type: '2' }])).toThrow('duplicate')
    expect(() => run([calendar(), calendar()], [])).toThrow('duplicate')
    expect(() => run([calendar({ sunday: '2' })], [])).toThrow('weekly')
    expect(() => run([calendar()], [{ ...exception, date: '20260931' }])).toThrow()
  })
  it('keeps civil weekday calculations stable across daylight-saving changes', () => {
    const result = annualServiceDates([calendar({ start_date: '20260328', end_date: '20260330', monday: '0', sunday: '1' })], [],
      '2026-03-28', '2026-03-30', new Set(['regular']))
    expect(result.get('regular')).toEqual(['2026-03-29'])
  })
  it('compares only explicit parent identities without merging directions, repeats or call rules', () => {
    const stops = new Map([['a', { parent_station: 'station' }], ['b', { parent_station: 'station' }], ['station', {}], ['other', {}]])
    const trip = { routeId: 'r', directionId: '0', calls: [{ id: 'a' }, { id: 'other' }] }
    const key = parentStationPatternKey(trip, stops)
    expect(parentStationPatternKey({ ...trip, calls: [{ id: 'b' }, { id: 'other' }] }, stops)).toBe(key)
    expect(parentStationPatternKey({ ...trip, directionId: '1' }, stops)).not.toBe(key)
    expect(parentStationPatternKey({ ...trip, calls: [...trip.calls, { id: 'a' }] }, stops)).not.toBe(key)
    expect(parentStationPatternKey({ ...trip, calls: [{ id: 'a', pickupType: '1' }, { id: 'other' }] }, stops)).not.toBe(key)
    expect(() => parentStationPatternKey(trip, new Map([['a', { parent_station: 'missing' }]]))).toThrow('parent station')
    expect(() => parentStationPatternKey(trip, new Map([['a', { parent_station: 'a' }]]))).toThrow('parent station')
  })
  it('covers every additional active pattern and retains Saturday-only cases', () => {
    const pattern = (id, activeDates, fixtureDates = []) => ({ id, activeDates, fixtureDates })
    const result = selectAnnualDates([
      pattern('a', ['2026-09-04', '2026-09-06']), pattern('b', ['2026-09-06']),
      pattern('saturday-only', ['2026-09-05']), pattern('inactive', []),
      pattern('already-tested', ['2026-09-04'], ['2026-09-04']),
    ])
    expect(result).toEqual([
      { date: '2026-09-06', weekday: 'sunday', newPatternIds: ['a', 'b'] },
      { date: '2026-09-05', weekday: 'saturday', newPatternIds: ['saturday-only'] },
    ])
  })
  it('replays all preserved annual calls/calendars, route census and both complete civil fixtures', async () => {
    const result = await reviewZugAnnual()
    expect(result.summary).toMatchObject({ annualRoutes: 77, annualTripRecords: 22676, annualDirectedPatterns: 3614,
      representedOnFixtures: 511, additionalActivePatterns: 3103, inactivePatterns: 0, frequencyTemplates: 0 })
    expect(JSON.parse(gunzipSync(await readFile('data/zug-annual-audit.json.gz')))).toEqual(result)
    const covered = result.proposedServiceDates.flatMap(d => d.newPatternIds)
    expect(new Set(covered).size).toBe(3103); expect(covered).toHaveLength(3103)
  }, 60000)
})
