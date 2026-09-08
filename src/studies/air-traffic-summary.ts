import type { AirTrack } from '@motionstudies/core/domain/air'

/** Count distinct known airports for the aircraft visible at the current study time. */
export function airTrafficSummary(tracks: readonly AirTrack[]) {
  const origins = new Set<string>()
  const destinations = new Set<string>()
  for (const track of tracks) {
    if (track.origin?.icao) origins.add(track.origin.icao)
    if (track.destination?.icao) destinations.add(track.destination.icao)
  }
  return { aircraft: tracks.length, origins: origins.size, destinations: destinations.size }
}
