import { describe, expect, it, vi } from 'vitest'
import { acceptedSites, ARCHIVE_ROOT, compileDailyArchive, minuteValues, previousSwissDate, summarizeCounter, swissDay, type ArchiveIO, type Topology } from './analysis.ts'
import type { AstraSnapshot } from '../scripts/astra-measured-data.mjs'

const topology: Topology = {
  metadata: { measurementSiteTableVersion: 23 },
  sites: [{ id: 'CH:1:positive', stationId: 'CH:1', direction: 'positive', detectorIds: ['CH:1.01', 'CH:1.02'], match: { confidence: 'high', road: 'N1' } }],
  sections: [],
}
function snapshot(time: number): AstraSnapshot {
  const iso = new Date(time).toISOString()
  return {
    metadata: { publisher: 'ASTRA', sourceUrl: 'test', measurementKind: 'recorded', recordingScope: 'national', measurementSiteTableVersion: 23, receivedAt: iso, publicationTime: iso },
    measurements: ['CH:1.01', 'CH:1.02'].map(siteId => ({ siteId, measurementTime: iso, lightFlowPerHour: 600, lightSpeedKmh: 60, heavyFlowPerHour: 0 })),
  }
}
function store(read: (time: number) => AstraSnapshot | null = snapshot) {
  const objects = new Map<string, string>()
  const io: ArchiveIO = {
    readJson: vi.fn(async key => objects.has(key) ? JSON.parse(objects.get(key)!) : null),
    readRecording: vi.fn(async key => read(Date.parse(key.split('/').at(-1)!.replace(/T(\d\d)-(\d\d)-(\d\d)-(\d+)Z.json.gz$/, 'T$1:$2:$3.$4Z')))),
    write: vi.fn(async (key, value) => { objects.set(key, value) }),
    promote: vi.fn(async (key, value) => { objects.set(key, JSON.stringify(value)) }),
  }
  return { io, objects }
}

describe('road history civil dates', () => {
  it.each([['2026-09-08', 1440], ['2026-03-29', 1380], ['2026-10-25', 1500]])('resolves %s without inventing or collapsing hours', (date, expected) => {
    expect(swissDay(date).expectedMinutes).toBe(expected)
    expect((swissDay(date).end - swissDay(date).start) / 60_000).toBe(expected)
  })
  it('uses Swiss yesterday and rejects normalized invalid dates', () => {
    expect(previousSwissDate(new Date('2026-09-08T22:30:00Z'))).toBe('2026-09-08')
    expect(() => swissDay('2026-02-30')).toThrow('Invalid')
  })
})

describe('counter aggregation', () => {
  const time = Date.parse('2026-09-08T00:00:00Z')
  it('sums parallel lanes and weights speed by traffic, retaining absent heavy vehicles', () => {
    const data = snapshot(time)
    data.measurements[1].lightFlowPerHour = 300
    data.measurements[1].lightSpeedKmh = 30
    expect(minuteValues(data, time, topology, acceptedSites(topology))).toEqual([[0, 900, 50, 0, 0]])
  })
  it('rejects a partial lane set, positive flow without speed, stale readings and duplicates', () => {
    const data = snapshot(time)
    data.measurements.pop()
    expect(minuteValues(data, time, topology, acceptedSites(topology))).toEqual([])
    const missingSpeed = snapshot(time)
    delete missingSpeed.measurements[0].lightSpeedKmh
    expect(minuteValues(missingSpeed, time, topology, acceptedSites(topology))).toEqual([])
    expect(minuteValues(snapshot(time - 60_000), time, topology, acceptedSites(topology))).toEqual([])
    const duplicate = snapshot(time)
    duplicate.measurements.push(duplicate.measurements[0])
    expect(() => minuteValues(duplicate, time, topology, acceptedSites(topology))).toThrow('Duplicate')
  })
  it('keeps unobserved totals distinct from measured zero', () => {
    const totals = { observedMinutes: 0, lightVehicles: 0, heavyVehicles: 0, lightVehicleSpeedSum: 0, heavyVehicleSpeedSum: 0 }
    expect(summarizeCounter(topology.sites[0], totals, 60)).toMatchObject({ lightVehicles: null, lightMeanSpeedKmh: null })
    expect(summarizeCounter(topology.sites[0], { ...totals, observedMinutes: 60 }, 60)).toMatchObject({ lightVehicles: 0, heavyVehicles: 0, heavyShare: null, lightMeanSpeedKmh: null })
  })
})

describe('daily archive publication', () => {
  it('generates a complete day with hourly CSV and promotes only after all artifacts are written', async () => {
    const { io, objects } = store()
    const result = await compileDailyArchive(io, topology, '2026-09-08')
    expect(result.metadata).toMatchObject({ complete: true, observedMinutes: 1440, expectedMinutes: 1440, minimumSiteCoverage: 1 })
    expect(result.chunks).toHaveLength(24)
    const daily = JSON.parse(objects.get(result.summaryKey)!)
    expect(daily.counters[0]).toMatchObject({ lightVehicles: 28800, heavyVehicles: 0, lightMeanSpeedKmh: 60, observedMinutes: 1440, coverage: 1 })
    expect(objects.get(result.hourlyKey)!.trim().split('\n')).toHaveLength(25)
    expect(JSON.parse(objects.get(`${ARCHIVE_ROOT}/latest.json`)!).serviceDate).toBe('2026-09-08')
    expect(vi.mocked(io.promote).mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(io.write).mock.invocationCallOrder.at(-1)!)
    vi.mocked(io.readRecording).mockClear()
    await compileDailyArchive(io, topology, '2026-09-08')
    expect(io.readRecording).not.toHaveBeenCalled()
  })
  it('retains incomplete summaries without extrapolating or replacing the latest complete day', async () => {
    const start = swissDay('2026-09-08').start
    const { io, objects } = store(time => time === start + 60_000 ? null : snapshot(time))
    const result = await compileDailyArchive(io, topology, '2026-09-08')
    expect(result.metadata).toMatchObject({ complete: false, observedMinutes: 1439 })
    expect(result.metadata.missingMinutes).toHaveLength(1)
    expect(JSON.parse(objects.get(result.summaryKey)!).counters[0]).toMatchObject({ lightVehicles: 28780, observedMinutes: 1439 })
    expect(io.promote).not.toHaveBeenCalled()
  })
  it('does not promote a full timestamp inventory with unusable measurements', async () => {
    const start = swissDay('2026-09-08').start
    const { io } = store(time => { const data = snapshot(time); if (time === start) data.measurements.pop(); return data })
    const result = await compileDailyArchive(io, topology, '2026-09-08')
    expect(result.metadata).toMatchObject({ complete: false, observedMinutes: 1440, missingMinutes: [] })
    expect(result.metadata.sparseMinutes).toHaveLength(1)
    expect(io.promote).not.toHaveBeenCalled()
  })
  it('keeps both repeated autumn hours identifiable and counts their actual duration', async () => {
    const { io, objects } = store()
    const result = await compileDailyArchive(io, topology, '2026-10-25')
    expect(result.metadata.expectedMinutes).toBe(1500)
    expect(result.chunks).toHaveLength(25)
    expect(result.chunks[2].localHour).not.toBe(result.chunks[3].localHour)
    expect(result.chunks[2].hourStartUtc).not.toBe(result.chunks[3].hourStartUtc)
    expect(JSON.parse(objects.get(result.summaryKey)!).counters[0].lightVehicles).toBe(30000)
  })
  it('fails safely on detector-table changes or storage failures', async () => {
    const { io } = store(time => { const data = snapshot(time); data.metadata.measurementSiteTableVersion = 24; return data })
    await expect(compileDailyArchive(io, topology, '2026-09-08')).rejects.toThrow('version mismatch')
    expect(io.promote).not.toHaveBeenCalled()
    const failing = store()
    vi.mocked(failing.io.write).mockRejectedValue(new Error('Storage unavailable'))
    await expect(compileDailyArchive(failing.io, topology, '2026-09-08')).rejects.toThrow('Storage unavailable')
    expect(failing.io.promote).not.toHaveBeenCalled()
  })
})
