import { foldSearchText } from './search-text.ts'

export interface AirSearchTrack {
  readonly id: string
  readonly icaoAddress?: string
  readonly callsign: string
  readonly start: number
  readonly end: number
}

export function airTrackSearchText(track: AirSearchTrack): string {
  return foldSearchText(`${track.callsign} ${track.icaoAddress ?? track.id}`)
}

export function airTrackSearchValue(track: AirSearchTrack): string {
  return `${track.callsign} · ${(track.icaoAddress ?? track.id).toUpperCase()}`
}

function airTrackMatchRank(track: AirSearchTrack, query: string): number {
  const callsign = foldSearchText(track.callsign)
  const id = foldSearchText(track.icaoAddress ?? track.id)
  if (callsign === query || id === query) return 0
  if (callsign.startsWith(query) || id.startsWith(query)) return 1
  return 2
}

export function searchAirTracks<Track extends AirSearchTrack>(
  tracks: readonly Track[],
  searchQuery: string,
  time: number,
  limit = 8,
): readonly Track[] {
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
