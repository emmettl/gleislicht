import type {
  NetworkDayChunk,
  NetworkDayChunkDescriptor,
  NetworkDayManifest,
  NetworkSnapshot,
} from './network.ts'

export function dayChunkForTime(
  manifest: NetworkDayManifest,
  time: number,
): NetworkDayChunkDescriptor {
  const last = manifest.chunks.at(-1)
  const match = manifest.chunks.find(
    (chunk) =>
      time >= chunk.windowStart &&
      (time < chunk.windowEnd || (chunk === last && time <= chunk.windowEnd)),
  )
  return match ?? (time < manifest.metadata.windowStart ? manifest.chunks[0] : last)!
}

export function adjacentDayChunks(
  manifest: NetworkDayManifest,
  current: NetworkDayChunkDescriptor,
): readonly NetworkDayChunkDescriptor[] {
  const index = manifest.chunks.findIndex((chunk) => chunk.id === current.id)
  return manifest.chunks.slice(Math.max(0, index - 1), index + 2)
}

export function networkSnapshotForDayChunk(
  manifest: NetworkDayManifest,
  chunk?: NetworkDayChunk,
): NetworkSnapshot {
  return {
    metadata: manifest.metadata,
    bounds: manifest.bounds,
    stops: manifest.stops,
    edges: manifest.edges,
    paths: manifest.paths,
    edgePaths: manifest.edgePaths,
    trains: chunk?.trains ?? [],
  }
}
