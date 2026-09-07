import { describe, expect, it } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { rowsFromArchive, parseCsvLine, activeServices } from './gtfs.mjs'
import { mergeNetworkSnapshots } from './merge-network.mjs'
import { chunkNetworkSnapshot } from './network-chunks.mjs'

const snapshot = {
  metadata: { publisher: 'Fixture publisher', feedVersion: 'fixture', serviceDate: '2026-01-01', windowStart: 0, windowEnd: 120, focusTime: 60, sourceUrl: 'https://example.test', model: 'Synthetic', note: 'No real journeys' },
  bounds: { minLongitude: 0, maxLongitude: 1, minLatitude: 0, maxLatitude: 1 },
  stops: [[0, 0, 'Start', '', 'start'], [1, 1, 'End', '', 'end']], edges: [[0, 1]],
  trains: [{ id: 'one', stops: [[0, 0, 0], [1, 120, 120]], pathSegments: [null] }],
}

describe('shared offline tooling', () => {
  it('gives short chunks unique paths while retaining existing hourly artifact names', () => {
    const short = chunkNetworkSnapshot(snapshot, 30, 'chunks')
    expect(new Set(short.chunks.map(({ descriptor }) => descriptor.path)).size).toBe(4)
    expect(short.chunks[0].descriptor.id).toBe('00h00m00s-00h00m30s')
    const hourly = chunkNetworkSnapshot({ ...snapshot, metadata: { ...snapshot.metadata, windowEnd: 7200 } }, 3600, 'chunks')
    expect(hourly.chunks.map(({ descriptor }) => descriptor.id)).toEqual(['00-01', '01-02'])
    expect(() => chunkNetworkSnapshot(snapshot, 0.5, 'chunks')).toThrow('whole number')
  })
  it('merges networks with optional geometry without inventing path indexes or source identity', () => {
    const result = mergeNetworkSnapshots([snapshot], { retrievedAt: '2026-01-01T00:00:00Z' })
    expect(result.metadata.publisher).toBe('Fixture publisher')
    expect(result.metadata.sourceUrl).toBe('https://example.test')
    expect(result.paths).toEqual([])
    expect(result.edgePaths).toEqual([null])
    expect(result.trains[0].pathSegments).toEqual([null])
  })
  it('lets a consumer supply provenance while preserving the validated time window', () => {
    const result = mergeNetworkSnapshots([snapshot], { metadata: { publisher: 'Composite', windowEnd: 999 }, geometryMetadata: { model: 'Joined paths' } })
    expect(result.metadata.publisher).toBe('Composite')
    expect(result.metadata.windowEnd).toBe(120)
    expect(result.metadata.geometry.model).toBe('Joined paths')
  })
  it('parses escaped CSV fields and reads an archive without leaking its child process', async () => {
    expect(parseCsvLine('"A, B","say ""hello"""')).toEqual(['A, B', 'say "hello"'])
    const directory = await mkdtemp(join(tmpdir(), 'motion-gtfs-'))
    try {
      await writeFile(join(directory, 'stops.txt'), '\ufeffstop_id,stop_name\na,"A, B"\nb,Second\n')
      await writeFile(join(directory, 'calendar.txt'), 'service_id,start_date,end_date,thursday\nbase,20260101,20260131,1\n')
      await writeFile(join(directory, 'calendar_dates.txt'), 'service_id,date,exception_type\nbase,20260101,2\nextra,20260101,1\n')
      const zip = spawnSync('zip', ['-q', 'fixture.zip', 'stops.txt', 'calendar.txt', 'calendar_dates.txt'], { cwd: directory })
      expect(zip.status).toBe(0)
      const rows = rowsFromArchive(join(directory, 'fixture.zip'), 'stops.txt')
      expect((await rows.next()).value).toMatchObject({ stop_id: 'a', stop_name: 'A, B' })
      await rows.return()
      expect(await activeServices(join(directory, 'fixture.zip'), '2026-01-01')).toEqual(new Set(['extra']))
      await expect(rowsFromArchive(join(directory, 'missing.zip'), 'stops.txt').next()).rejects.toThrow('unzip')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
