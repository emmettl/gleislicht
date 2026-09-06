import type { StudyAirport } from '../domain/airport.ts'
import airportCatalogue from '../../fixtures/tfl/all-change-airports.json'

// The airports whose approach envelopes intersect the present London air study.
// Gatwick sits just beyond the southern crop, but its northern approaches enter it.
export const LONDON_AIRPORTS = airportCatalogue satisfies readonly StudyAirport[]
