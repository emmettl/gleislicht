import { useMemo } from 'react'
import {
  adjacentAirDayChunks,
  airDayChunkForTime,
  airSnapshotForDayChunk,
  type AirDayChunk,
  type AirDayChunkDescriptor,
  type AirDayManifest,
} from '@motionstudies/core/domain/air-day'
import type { DataUrlResolver } from './data-url.ts'
import { useProgressiveChunks, type ProgressiveChunkAdapter } from './use-progressive-chunks.ts'

const adapter: ProgressiveChunkAdapter<AirDayManifest, AirDayChunkDescriptor, AirDayChunk> = {
  chunkForTime: airDayChunkForTime,
  adjacentChunks: adjacentAirDayChunks,
  readChunk: (response) => response.json(),
}

export function useProgressiveAirDay(
  manifestFile: string,
  active: boolean,
  time: number,
  resolveAssetUrl: DataUrlResolver,
) {
  const { chunk, ...state } = useProgressiveChunks(manifestFile, active, time, resolveAssetUrl, adapter)
  const snapshot = useMemo(
    () => state.manifest ? airSnapshotForDayChunk(state.manifest, chunk) : undefined,
    [state.manifest, chunk],
  )
  return { ...state, snapshot }
}
