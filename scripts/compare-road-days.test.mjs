import { expect, it } from 'vitest'
import { compareRoadDays } from './compare-road-days.mjs'

function day(volume = 100, observedMinutes = 1440) {
  return { metadata: { schemaVersion: 1, expectedMinutes: 1440, serviceDate: '2026-09-08', topologyHash: 'same' }, counters: [{ siteId: 'one', detectorIds: ['lane'], observedMinutes, lightVehicles: volume, heavyVehicles: 0, lightMeanSpeedKmh: 60, heavyShare: 0 }] }
}
it('compares stable fully observed counters without summing the network', () => {
  const result = compareRoadDays(day(), day(150))
  expect(result.comparedCounters).toBe(1)
  expect(result.counters[0]).toMatchObject({ vehicleChange: 50, vehicleChangePercent: 50, lightSpeedChangeKmh: 0 })
  expect(compareRoadDays(day(), day(90, 1400)).excludedCounters).toEqual(['one'])
  expect(compareRoadDays(day(0), day(5)).counters[0].vehicleChangePercent).toBeNull()
})
it('rejects changes in counter topology or civil-day duration', () => {
  const different = day()
  different.metadata.topologyHash = 'changed'
  expect(() => compareRoadDays(day(), different)).toThrow('topology changed')
  different.metadata.topologyHash = 'same'
  different.metadata.expectedMinutes = 1500
  expect(() => compareRoadDays(day(), different)).toThrow('day lengths')
})
