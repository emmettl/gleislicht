import { describe, expect, it } from 'vitest'
import type { NetworkDayManifest } from './network.ts'
import {
  adjacentDayChunks,
  dayChunkForTime,
  networkSnapshotForDayChunk,
} from './network-day.ts'

const manifest: NetworkDayManifest = {
  metadata: {
    publisher: 'SBB',
    feedVersion: 'test',
    serviceDate: '2026-09-04',
    windowStart: 0,
    windowEnd: 86_400,
    focusTime: 27_900,
    sourceUrl: 'test',
    model: 'scheduled',
    note: 'test',
  },
  bounds: {
    minLongitude: 5,
    minLatitude: 45,
    maxLongitude: 11,
    maxLatitude: 48,
  },
  stops: [],
  edges: [],
  paths: [[[8.5, 47.3], [8.6, 47.4]]],
  edgePaths: [0],
  tripCount: 100,
  chunks: [
    { id: '00-03', windowStart: 0, windowEnd: 10_800, path: '00.json', tripCount: 20 },
    { id: '03-06', windowStart: 10_800, windowEnd: 21_600, path: '03.json', tripCount: 30 },
    { id: '06-09', windowStart: 21_600, windowEnd: 32_400, path: '06.json', tripCount: 40 },
  ],
}

describe('network day chunks', () => {
  it('switches to the next chunk at an exact boundary', () => {
    expect(dayChunkForTime(manifest, 10_799).id).toBe('00-03')
    expect(dayChunkForTime(manifest, 10_800).id).toBe('03-06')
  })

  it('returns the current chunk and its neighbours for prefetching', () => {
    const current = dayChunkForTime(manifest, 15_000)
    expect(adjacentDayChunks(manifest, current).map((chunk) => chunk.id)).toEqual([
      '00-03',
      '03-06',
      '06-09',
    ])
  })

  it('builds a renderable snapshot before movement data arrives', () => {
    const snapshot = networkSnapshotForDayChunk(manifest)
    expect(snapshot.metadata.windowEnd).toBe(86_400)
    expect(snapshot.trains).toEqual([])
    expect(snapshot.paths).toBe(manifest.paths)
    expect(snapshot.edgePaths).toBe(manifest.edgePaths)
  })
})
