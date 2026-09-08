import { describe, expect, it } from 'vitest'
import { auditedMode, summarizeRoute, uniqueDayTrains } from './audit-mountain-transport.mjs'

describe('source-backed mountain transport audit', () => {
  it('uses source mode codes, without classifying every Alpine regional train as cogwheel', () => {
    expect(auditedMode('116')).toBe('cogwheel')
    expect(auditedMode('106')).toBeUndefined()
    expect(auditedMode('1300')).toBe('cableway')
    expect(auditedMode('1303')).toBe('cableway')
    expect(auditedMode('1400')).toBe('funicular')
    expect(auditedMode('1000')).toBe('ferry')
  })

  it('deduplicates shared chunk boundaries and rejects inconsistent copies', () => {
    const trip = { id: 'boundary', start: 10700, end: 10900 }
    expect(uniqueDayTrains([{ trains: [trip] }, { trains: [trip] }]).size).toBe(1)
    expect(() => uniqueDayTrains([{ trains: [trip] }, { trains: [{ ...trip, end: 11100 }] }])).toThrow('Conflicting trip')
  })

  it('separates headway templates, inactive windows, missing trips and unresolved geometry', () => {
    const source = ['present', 'missing', 'headway', 'tomorrow'].map(id => ({ id, calls: 2, start: id === 'tomorrow' ? 87000 : 36000, end: id === 'tomorrow' ? 88000 : 37000 }))
    const trains = new Map([['present', { category: 'other', stops: [[0], [1], [2]], pathSegments: [0, null] }]])
    const result = summarizeRoute({ id: 'r', mode: 'cogwheel' }, source, new Map([['headway', [{}, {}]]]), trains)
    expect(result).toMatchObject({ scheduledTrips: 2, frequencyTemplates: 1, frequencyIntervals: 2, nationalRailTrips: 1, missingNationalRailTrips: ['missing'], nationalGeometry: { matchedSegments: 1, totalSegments: 2 } })
    expect(summarizeRoute({ mode: 'ferry' }, source, new Map(), trains).missingNationalRailTrips).toBeNull()
  })
})
