import type { AirSnapshot, AirTrack } from './air.ts'

export interface AirDayAircraft {
  readonly id: string
  readonly icaoAddress: string
  readonly callsign: string
  readonly start: number
  readonly end: number
  readonly airportIds?: readonly string[]
  readonly chunkIds: readonly string[]
}

export interface AirDayChunkDescriptor {
  readonly id: string
  readonly windowStart: number
  readonly windowEnd: number
  readonly path: string
  readonly trackCount: number
  readonly sampleCount: number
}

export interface AirDayChunk {
  readonly windowStart: number
  readonly windowEnd: number
  readonly tracks: readonly AirTrack[]
}

export interface AirDayManifest {
  readonly metadata: AirSnapshot['metadata']
  readonly bounds: AirSnapshot['bounds']
  readonly trackCount: number
  readonly sampleCount: number
  readonly aircraft: readonly AirDayAircraft[]
  readonly chunks: readonly AirDayChunkDescriptor[]
}

export function airDayChunkForTime(
  manifest: AirDayManifest,
  time: number,
): AirDayChunkDescriptor {
  const last = manifest.chunks.at(-1)
  const match = manifest.chunks.find(
    (chunk) =>
      time >= chunk.windowStart &&
      (time < chunk.windowEnd || (chunk === last && time <= chunk.windowEnd)),
  )
  return match ?? (time < manifest.metadata.windowStart ? manifest.chunks[0] : last)!
}

export function adjacentAirDayChunks(
  manifest: AirDayManifest,
  current: AirDayChunkDescriptor,
): readonly AirDayChunkDescriptor[] {
  const index = manifest.chunks.findIndex((chunk) => chunk.id === current.id)
  return manifest.chunks.slice(Math.max(0, index - 1), index + 2)
}

export function airSnapshotForDayChunk(
  manifest: AirDayManifest,
  chunk?: AirDayChunk,
): AirSnapshot {
  return {
    metadata: manifest.metadata,
    bounds: manifest.bounds,
    tracks: chunk?.tracks ?? [],
  }
}
