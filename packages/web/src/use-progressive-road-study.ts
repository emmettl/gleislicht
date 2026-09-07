import { useMemo } from 'react'
import {
  adjacentRoadChunks,
  roadChunkForTime,
  roadSnapshotForChunk,
  type NationalRoadChunkDescriptor,
  type NationalRoadMinuteChunk,
  type NationalRoadStudyManifest,
} from '@motionstudies/core/domain/road-day'
import type { DataUrlResolver } from './data-url.ts'
import { useProgressiveChunks, type ProgressiveChunkAdapter } from './use-progressive-chunks.ts'

const adapter: ProgressiveChunkAdapter<NationalRoadStudyManifest, NationalRoadChunkDescriptor, NationalRoadMinuteChunk> = {
  chunkForTime: roadChunkForTime,
  adjacentChunks: adjacentRoadChunks,
  readChunk: (response) => response.json(),
  optional: true,
}

export function useProgressiveRoadStudy(
  manifestFile: string,
  active: boolean,
  time: number,
  resolveAssetUrl: DataUrlResolver,
) {
  const { chunk, ...state } = useProgressiveChunks(manifestFile, active, time, resolveAssetUrl, adapter)
  const snapshot = useMemo(
    () => state.manifest ? roadSnapshotForChunk(state.manifest, chunk) : undefined,
    [state.manifest, chunk],
  )
  return { ...state, snapshot }
}
