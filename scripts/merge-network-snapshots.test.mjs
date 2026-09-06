import { describe, expect, it } from 'vitest'
import { mergeNetworkSnapshots } from './merge-network-snapshots.mjs'

function snapshot(id, mode, sourceId, longitude) {
  return {
    metadata: {
      serviceDate: '2026-09-04',
      windowStart: 24_300,
      windowEnd: 31_500,
      focusTime: 27_900,
      modes: [mode],
      sourceUrl: `source:${id}`,
      sourceSha256: id.repeat(64).slice(0, 64),
      geometry: { sourceUrl: `geometry:${id}`, sourceSha256: id.repeat(64).slice(0, 64) },
      model: 'test',
      note: id,
    },
    stops: [[longitude, 51.5, 'Shared', '', sourceId], [longitude + 0.1, 51.6, id, '', `${sourceId}:${id}`]],
    edges: [[0, 1]],
    paths: [[[longitude, 51.5], [longitude + 0.1, 51.6]]],
    edgePaths: [0],
    trains: [{ id, stops: [[0, 25_000, 25_000], [1, 26_000, 26_000]], pathSegments: [0] }],
  }
}

describe('network snapshot merger', () => {
  it('deduplicates source stops and remaps paths and trains', () => {
    const merged = mergeNetworkSnapshots([
      snapshot('a', 'tube', 'shared', -0.2),
      snapshot('b', 'overground', 'shared', -0.2),
    ], { retrievedAt: '2026-09-06T00:00:00.000Z' })

    expect(merged.stops).toHaveLength(3)
    expect(merged.paths).toHaveLength(1)
    expect(merged.trains[1].stops[0][0]).toBe(0)
    expect(merged.trains[1].stops[1][0]).toBe(2)
    expect(merged.trains[1].pathSegments).toEqual([0])
    expect(merged.metadata.modes).toEqual(['tube', 'overground'])
  })

  it('rejects mismatched study windows', () => {
    const first = snapshot('a', 'tube', 'a', -0.2)
    const second = snapshot('b', 'tram', 'b', 0.1)
    second.metadata.windowEnd += 60
    expect(() => mergeNetworkSnapshots([first, second])).toThrow('share a service date and study window')
  })
})
