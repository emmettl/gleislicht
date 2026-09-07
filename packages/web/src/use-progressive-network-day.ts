import { useMemo } from 'react'
import {
  adjacentDayChunks,
  dayChunkForTime,
  networkSnapshotForDayChunk,
} from '@motionstudies/core/domain/network-day'
import type {
  NetworkDayChunk,
  NetworkDayChunkDescriptor,
  NetworkDayManifest,
} from '@motionstudies/core/domain/network'
import type { DataUrlResolver } from './data-url.ts'
import { useProgressiveChunks, type ProgressiveChunkAdapter } from './use-progressive-chunks.ts'

export async function verifiedNetworkDayChunk(
  response: Response,
  descriptor: NetworkDayChunkDescriptor,
): Promise<NetworkDayChunk> {
  const bytes = await response.arrayBuffer()
  if (descriptor.bytes !== undefined && bytes.byteLength !== descriptor.bytes) {
    throw new Error(`Network day chunk ${descriptor.id} has an unexpected size`)
  }
  if (descriptor.sha256) {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const actual = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
    if (actual !== descriptor.sha256) {
      throw new Error(`Network day chunk ${descriptor.id} failed its integrity check`)
    }
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as NetworkDayChunk
}

const adapter: ProgressiveChunkAdapter<NetworkDayManifest, NetworkDayChunkDescriptor, NetworkDayChunk> = {
  chunkForTime: dayChunkForTime,
  adjacentChunks: adjacentDayChunks,
  readChunk: verifiedNetworkDayChunk,
}

export function useProgressiveNetworkDay(
  manifestFile: string,
  active: boolean,
  time: number,
  resolveAssetUrl: DataUrlResolver,
) {
  const { chunk, ...state } = useProgressiveChunks(manifestFile, active, time, resolveAssetUrl, adapter)
  const network = useMemo(
    () => state.manifest ? networkSnapshotForDayChunk(state.manifest, chunk) : undefined,
    [state.manifest, chunk],
  )
  return { ...state, network }
}
