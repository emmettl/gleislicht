import type { NetworkSnapshot, NetworkDayManifest, NetworkDayChunkDescriptor, NetworkDayChunk } from '@motionstudies/core/domain/network'
export function extractNetworkWindow(snapshot: NetworkSnapshot, windowStart: number, windowEnd: number, focusTime: number): NetworkSnapshot
export function chunkNetworkSnapshot(snapshot: NetworkSnapshot, chunkSeconds: number, chunkDirectoryName: string): {
  manifest: NetworkDayManifest
  chunks: { descriptor: NetworkDayChunkDescriptor; payload: NetworkDayChunk }[]
}
