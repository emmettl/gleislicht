import type { AirTrack } from './air.ts'
import { foldSearchText } from '../search-text.ts'

export interface StudyAirport {
  readonly id: string
  readonly name: string
  readonly city: string
  readonly iata: string
  readonly icao: string
  readonly longitude: number
  readonly latitude: number
  readonly approachRadiusKilometres: number
  readonly maximumApproachAltitudeFeet: number
}

export function airportSearchText(airport: StudyAirport): string {
  return foldSearchText(
    `${airport.name} ${airport.city} ${airport.iata} ${airport.icao}`,
  )
}

function airportMatchRank(airport: StudyAirport, query: string): number {
  const codes = [airport.iata, airport.icao].map(foldSearchText)
  const name = foldSearchText(airport.name)
  if (codes.includes(query) || name === query) return 0
  if (codes.some((code) => code.startsWith(query)) || name.startsWith(query)) {
    return 1
  }
  return 2
}

export function searchAirports(
  airports: readonly StudyAirport[],
  searchQuery: string,
  limit = 5,
): readonly StudyAirport[] {
  const query = foldSearchText(searchQuery)
  if (!query) return []
  return airports
    .filter((airport) => airportSearchText(airport).includes(query))
    .sort(
      (first, second) =>
        airportMatchRank(first, query) - airportMatchRank(second, query) ||
        first.name.localeCompare(second.name, 'en'),
    )
    .slice(0, limit)
}

function coordinateDistanceKilometres(
  firstLongitude: number,
  firstLatitude: number,
  secondLongitude: number,
  secondLatitude: number,
): number {
  const averageLatitude = ((firstLatitude + secondLatitude) * Math.PI) / 360
  const east =
    (secondLongitude - firstLongitude) * 111.32 * Math.cos(averageLatitude)
  const north = (secondLatitude - firstLatitude) * 111.32
  return Math.hypot(east, north)
}

export function airTrackServesAirport(
  track: AirTrack,
  airport: StudyAirport,
): boolean {
  if (track.airportIds?.includes(airport.id)) return true
  return track.samples.some(
    ([, longitude, latitude, altitudeFeet]) =>
      altitudeFeet <= airport.maximumApproachAltitudeFeet &&
      coordinateDistanceKilometres(
        longitude,
        latitude,
        airport.longitude,
        airport.latitude,
      ) <= airport.approachRadiusKilometres,
  )
}

export function airportAirTrackIds(
  tracks: readonly AirTrack[],
  airport: StudyAirport,
): ReadonlySet<string> {
  return new Set(
    tracks
      .filter((track) => airTrackServesAirport(track, airport))
      .map((track) => track.id),
  )
}
