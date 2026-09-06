import { describe, expect, it } from 'vitest'
import {
  chunkNetworkSnapshot,
  extractNetworkWindow,
} from './chunk-network-snapshot.mjs'

const snapshot = {
  metadata: { windowStart: 0, windowEnd: 21_600, focusTime: 10_800 },
  bounds: {},
  stops: [[0, 0, 'A']],
  edges: [[0, 0]],
  paths: [[[0, 0], [1, 1]]],
  edgePaths: [0],
  trains: [
    { id: 'early', start: 600, end: 1_200 },
    { id: 'boundary', start: 10_700, end: 11_000 },
    { id: 'late', start: 18_500, end: 20_000 },
  ],
}

describe('progressive network studies', () => {
  it('keeps topology in the manifest and overlaps boundary-crossing journeys', () => {
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 10_800, 'day-chunks')

    expect(manifest.paths).toEqual(snapshot.paths)
    expect(manifest.edgePaths).toEqual(snapshot.edgePaths)
    expect(manifest.chunks.map((chunk) => chunk.path)).toEqual([
      'day-chunks/00-03.json',
      'day-chunks/03-06.json',
    ])
    expect(chunks[0].payload.trains.map(({ id }) => id)).toEqual([
      'early',
      'boundary',
    ])
    expect(chunks[1].payload.trains.map(({ id }) => id)).toEqual([
      'boundary',
      'late',
    ])
    expect(manifest.chunks[0].bytes).toBeGreaterThan(0)
    expect(manifest.chunks[0].sha256).toHaveLength(64)
  })

  it('derives the fast opening study without changing topology', () => {
    const opening = extractNetworkWindow(snapshot, 0, 3_600, 1_800)
    expect(opening.trains.map(({ id }) => id)).toEqual(['early'])
    expect(opening.paths).toBe(snapshot.paths)
    expect(opening.metadata).toMatchObject({
      windowStart: 0,
      windowEnd: 3_600,
      focusTime: 1_800,
    })
  })
})
