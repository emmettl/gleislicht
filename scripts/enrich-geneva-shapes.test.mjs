import { describe, expect, it } from 'vitest'
import {
  categoryForVehicle,
  normalizeRoute,
} from './enrich-geneva-shapes.mjs'

describe('TPG line geometry normalisation', () => {
  it('aligns SITG display labels with Swiss GTFS route names', () => {
    expect(normalizeRoute('01')).toBe('1')
    expect(normalizeRoute('12')).toBe('12')
    expect(normalizeRoute('E_pl')).toBe('E+')
  })

  it('keeps trolleybuses in the bus service category', () => {
    expect(categoryForVehicle('TRAM')).toBe('tram')
    expect(categoryForVehicle('BUS')).toBe('bus')
    expect(categoryForVehicle('TROLLEY')).toBe('bus')
    expect(categoryForVehicle('Non défini')).toBeUndefined()
  })
})
