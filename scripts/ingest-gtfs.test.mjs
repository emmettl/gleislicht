import { describe, expect, it } from 'vitest'
import {
  parseBounds,
  parseModes,
  transportModeForRouteType,
} from './ingest-gtfs.mjs'

describe('Swiss GTFS transport modes', () => {
  it('recognises the standard and Swiss extended mode codes', () => {
    expect(transportModeForRouteType('2')).toBe('rail')
    expect(transportModeForRouteType('109')).toBe('rail')
    expect(transportModeForRouteType('900')).toBe('tram')
    expect(transportModeForRouteType('700')).toBe('bus')
    expect(transportModeForRouteType('1000')).toBe('ferry')
    expect(transportModeForRouteType('1300')).toBe('cableway')
    expect(transportModeForRouteType('1400')).toBe('funicular')
  })

  it('parses regional mode and bounds profiles', () => {
    expect([...parseModes('rail,tram,bus')]).toEqual(['rail', 'tram', 'bus'])
    expect(parseBounds('8.45,47.32,8.63,47.44')).toEqual({
      minLongitude: 8.45,
      minLatitude: 47.32,
      maxLongitude: 8.63,
      maxLatitude: 47.44,
    })
  })
})
