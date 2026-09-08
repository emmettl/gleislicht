import { describe, expect, it } from 'vitest'
import { expandFrequencyTrip, frequencyIntervals } from './gtfs-frequencies.mjs'
import { createSnapshotBuilder } from './ingest-gtfs.mjs'
import { chunkNetworkSnapshot } from '@motionstudies/data/network-chunks'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const row = { trip_id: 'template', start_time: '23:50:00', end_time: '25:00:00', headway_secs: '600', exact_times: '0' }
const active = new Map([['template', { route: 'Lift', mode: 'cableway', category: 'cableway', shortName: 'template-number', headsign: 'Summit' }]])
const stops = [{ stopId: 'valley', arrival: 300, departure: 360 }, { stopId: 'middle', arrival: 660, departure: 720 }, { stopId: 'summit', arrival: 1260, departure: 1260 }]

function expand(rows = [row], start = 0, end = 86400) {
  return [...expandFrequencyTrip('template', stops, frequencyIntervals(rows, active).get('template'), start, end)]
}

describe('GTFS frequency expansion', () => {
  it('offsets every stop from the first departure, retaining dwell and midnight semantics', () => {
    const trips = expand()
    expect(trips.map(t => t.stops[0].departure)).toEqual([85800, 86400])
    expect(trips[0].stops.map(s => [s.arrival, s.departure])).toEqual([[85740, 85800], [86100, 86160], [86700, 86700]])
    expect(trips[0].frequency).toMatchObject({ sourceTripId: 'template', exactTimes: 0, headwaySeconds: 600 })
    expect(trips[0].id).not.toBe('template')
  })

  it('uses an exclusive interval end and permits adjacent changed headways', () => {
    const trips = expand([{ ...row, end_time: '24:00:00', exact_times: '1' }, { ...row, start_time: '24:00:00', end_time: '24:20:00', headway_secs: '300', exact_times: '1' }], 85800, 88000)
    expect(trips.map(t => t.stops[0].departure)).toEqual([85800, 86400, 86700, 87000, 87300])
    expect(trips.every(t => t.frequency.exactTimes === 1)).toBe(true)
  })

  it('keeps grid phases and instance identities stable for independently compiled windows', () => {
    const all = expand([row], 0, 90000)
    const window = expand([row], 86300, 86900)
    expect(window).toEqual(all.filter(t => t.stops[0].departure <= 86900 && t.stops.at(-1).arrival >= 86300))
    expect(expand([row], 91000, 92000)).toEqual([])
  })

  it('defaults to headway semantics and excludes inactive service templates', () => {
    expect(frequencyIntervals([{ ...row, exact_times: '' }], active).get('template')[0].exactTimes).toBe(0)
    expect(frequencyIntervals([row], new Map()).size).toBe(0)
    expect(frequencyIntervals([{ ...row, start_time: '7:00:00', end_time: '8:00:00' }], active).get('template')[0]).toMatchObject({ startTime: 25200, endTime: 28800 })
  })

  it('rejects overlaps, invalid times, nonpositive headways and impossible stop sequences', () => {
    expect(() => frequencyIntervals([row, row], active)).toThrow('Overlapping')
    for (const invalid of [{ headway_secs: '0' }, { headway_secs: '-1' }, { headway_secs: '1.5' }, { start_time: '23:80:00' }, { exact_times: '2' }, { end_time: '22:00:00' }]) expect(() => frequencyIntervals([{ ...row, ...invalid }], active)).toThrow()
    expect(() => [...expandFrequencyTrip('template', [...stops].reverse(), frequencyIntervals([row], active).get('template'), 0, 86400)]).toThrow('Invalid frequency stop times')
  })

  it('retains frequency provenance through bounds clipping and progressive chunks', () => {
    const builder = createSnapshotBuilder({ trips: active, sourceStops: new Map([['valley', { longitude: 7, latitude: 46, name: 'Valley' }], ['middle', { longitude: 8, latitude: 46, name: 'Middle' }], ['summit', { longitude: 8.1, latitude: 46, name: 'Summit' }]]), windowStart: 85000, windowEnd: 87000, focusTime: 86500, displayBounds: { minLongitude: 7.5, maxLongitude: 9, minLatitude: 45, maxLatitude: 47 } })
    for (const trip of expand([row], 85000, 87000)) builder.addTrip(trip.id, trip.stops, { ...active.get('template'), shortName: '', frequency: trip.frequency })
    const snapshot = builder.finish()
    expect(snapshot.trains[0].start).toBe(86160)
    expect(snapshot.trains[0].frequency.startTime).toBe(85800)
    expect(snapshot.trains[0].shortName).toBe('')
    const { chunks } = chunkNetworkSnapshot({ ...snapshot, metadata: { windowStart: 85000, windowEnd: 87000 } }, 1000, 'chunks')
    expect(chunks.flatMap(c => c.payload.trains).every(t => t.frequency.sourceTripId === 'template')).toBe(true)
  })

  it('imports calendar additions and removals without duplicating frequency templates', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gleislicht-frequency-'))
    try {
      const files = {
        'feed_info.txt': 'feed_publisher_name,feed_version\nFixture,test\n',
        'routes.txt': 'route_id,agency_id,route_short_name,route_type\nlift,agency,Lift,1300\n',
        'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\na,Valley,46,8\nb,Summit,46.1,8.1\n',
        'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nremoved,1,1,1,1,1,1,1,20260101,20261231\nnormal,1,1,1,1,1,1,1,20260101,20261231\n',
        'calendar_dates.txt': 'service_id,date,exception_type\nremoved,20260904,2\nadded,20260904,1\n',
        'trips.txt': 'route_id,service_id,trip_id,trip_headsign,trip_short_name\nlift,removed,removed-template,Summit,111\nlift,added,added-template,Summit,222\nlift,normal,scheduled,Summit,333\n',
        'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nremoved-template,00:00:00,00:00:00,a,1\nremoved-template,00:10:00,00:10:00,b,2\nadded-template,00:10:00,00:10:00,b,2\nadded-template,00:00:00,00:00:00,a,1\nscheduled,07:10:00,07:10:00,a,1\nscheduled,07:20:00,07:20:00,b,2\n',
        'frequencies.txt': 'trip_id,start_time,end_time,headway_secs,exact_times\nremoved-template,07:00:00,08:00:00,600,0\nadded-template,07:00:00,07:30:00,600,0\n',
      }
      await Promise.all(Object.entries(files).map(([name, content]) => writeFile(join(directory, name), content)))
      await run('zip', ['-q', 'fixture.zip', ...Object.keys(files)], { cwd: directory })
      const output = join(directory, 'snapshot.json')
      const args = [resolve('scripts/ingest-gtfs.mjs'), '--archive', join(directory, 'fixture.zip'), '--date', '2026-09-04', '--modes', 'all', '--window-start', '07:00', '--window-end', '08:00', '--output', output, '--hub-output', 'none']
      await run(process.execPath, args)
      const snapshot = JSON.parse(await readFile(output, 'utf8'))
      expect(snapshot.trains.map(t => t.id)).toEqual(['frequency:added-template:25200', 'frequency:added-template:25800', 'frequency:added-template:26400', 'scheduled'])
      expect(snapshot.trains[0]).toMatchObject({ shortName: '', start: 25200, end: 25800, frequency: { sourceTripId: 'added-template', exactTimes: 0 } })
      expect(snapshot.metadata.frequency).toMatchObject({ headwayTrips: 3, exactFrequencyTrips: 0 })
      // Frequencies is optional: scheduled feeds continue to import normally.
      await run('zip', ['-qd', 'fixture.zip', 'frequencies.txt'], { cwd: directory })
      await run(process.execPath, args)
      const scheduled = JSON.parse(await readFile(output, 'utf8'))
      expect(scheduled.trains.map(t => t.id)).toEqual(['scheduled'])
      expect(scheduled.metadata.frequency).toBeUndefined()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
