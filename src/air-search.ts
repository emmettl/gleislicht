import type { AirTrack } from './domain/air.ts'
import { foldSearchText } from './search-text.ts'

export function airTrackSearchText(track: AirTrack): string {
  return foldSearchText(`${track.callsign} ${track.id}`)
}

export function airTrackSearchValue(track: AirTrack): string {
  return `${track.callsign} · ${track.id.toUpperCase()}`
}

function airTrackMatchRank(track: AirTrack, query: string): number {
  const callsign = foldSearchText(track.callsign)
  const id = foldSearchText(track.id)
  if (callsign === query || id === query) return 0
  if (callsign.startsWith(query) || id.startsWith(query)) return 1
  return 2
}

export function searchAirTracks(
  tracks: readonly AirTrack[],
  searchQuery: string,
  time: number,
  limit = 8,
): readonly AirTrack[] {
  const query = foldSearchText(searchQuery)
  if (!query) return []
  return tracks
    .filter((track) => airTrackSearchText(track).includes(query))
    .sort((first, second) => {
      const firstActive = first.start <= time && first.end >= time
      const secondActive = second.start <= time && second.end >= time
      return (
        airTrackMatchRank(first, query) - airTrackMatchRank(second, query) ||
        Number(secondActive) - Number(firstActive) ||
        first.start - second.start ||
        first.callsign.localeCompare(second.callsign, 'en', { numeric: true })
      )
    })
    .slice(0, limit)
}
