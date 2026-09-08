import { expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { civilTripInstance, previousServiceDate } from './civil-day.mjs'

const run = promisify(execFile)

it('uses calendar dates across leap years and Swiss clock changes', () => {
  for (const [date, previous] of [['2026-01-01', '2025-12-31'], ['2024-03-01', '2024-02-29'], ['2026-03-30', '2026-03-29'], ['2026-10-26', '2026-10-25']]) expect(previousServiceDate(date)).toBe(previous)
  expect(() => previousServiceDate('2026-02-30')).toThrow()
})

it('preserves source identity, negative crossing times and frequency phase', () => {
  const stops = [{ stopId: 'a', arrival: 86100, departure: 86100 }, { stopId: 'b', arrival: 87000, departure: 87000 }]
  const result = civilTripInstance('frequency:template:86100', stops, { frequency: { sourceTripId: 'template', startTime: 86100, endTime: 90000, headwaySeconds: 600 } }, -86400, '2026-09-08')
  expect(result.id).toBe('service:2026-09-07:frequency%3Atemplate%3A86100')
  expect(result.stops.map(s => s.arrival)).toEqual([-300, 600])
  expect(result.metadata).toMatchObject({ sourceTripId: 'template', sourceServiceDate: '2026-09-07', frequency: { startTime: -300, endTime: 3600, headwaySeconds: 600 } })
  expect(stops[0].arrival).toBe(86100)
  expect(() => civilTripInstance('too-late', [{ arrival: 172800, departure: 172800 }], {}, 0, '2026-09-08')).toThrow('below 48:00')
})

it('imports each calendar independently, includes spillover and excludes tomorrow at 24:00', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lausanne-civil-test-'))
  try {
    const schedules = [
      ['daily', 'crossing', '23:55:00', '24:10:00'],
      ['daily', 'midnight', '24:00:00', '24:20:00'],
      ['daily', 'daytime', '12:00:00', '12:10:00'],
      ['removed', 'removed-overnight', '24:20:00', '24:30:00'],
      ['added', 'added-overnight', '24:30:00', '24:40:00'],
      ['today', 'today-only', '00:30:00', '00:40:00'],
      ['daily', 'frequency', '00:00:00', '00:10:00'],
    ]
    const files = {
      'feed_info.txt': 'feed_publisher_name,feed_version,feed_start_date,feed_end_date\nFixture,test,20260101,20261231\n',
      'routes.txt': 'route_id,agency_id,route_short_name,route_type\nroute,151,1,3\n',
      'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\na,A,46.52,6.62\nb,B,46.53,6.63\n',
      'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\ndaily,1,1,1,1,1,1,1,20260101,20261231\nremoved,1,1,1,1,1,1,1,20260101,20261231\n',
      'calendar_dates.txt': 'service_id,date,exception_type\nremoved,20260907,2\nadded,20260907,1\ntoday,20260908,1\n',
      'trips.txt': 'route_id,service_id,trip_id,trip_headsign,trip_short_name\n' + schedules.map(([service, id]) => `route,${service},${id},B,`).join('\n') + '\n',
      'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' + schedules.flatMap(([, id, start, end]) => [`${id},${start},${start},a,1`, `${id},${end},${end},b,2`]).join('\n') + '\n',
      'frequencies.txt': 'trip_id,start_time,end_time,headway_secs,exact_times\nfrequency,23:55:00,24:26:00,600,0\n',
    }
    await Promise.all(Object.entries(files).map(([name, data]) => writeFile(join(directory, name), data)))
    await run('zip', ['-q', 'fixture.zip', ...Object.keys(files)], { cwd: directory })
    const output = join(directory, 'snapshot.json')
    const args = [resolve('scripts/ingest-gtfs.mjs'), '--archive', join(directory, 'fixture.zip'), '--date', '2026-09-08', '--modes', 'all', '--window-start', '00:00', '--window-end', '24:00', '--output', output, '--hub-output', 'none', '--civil-day']
    await run(process.execPath, args)
    const snapshot = JSON.parse(await readFile(output, 'utf8'))
    const trips = new Map(snapshot.trains.map(t => [t.id, t]))
    expect(snapshot.metadata.sourceServiceDates).toEqual(['2026-09-07', '2026-09-08'])
    expect(trips.get('crossing')).toMatchObject({ start: 86100, end: 87000, sourceServiceDate: '2026-09-08' })
    expect(trips.get('service:2026-09-07:crossing')).toMatchObject({ start: -300, end: 600, sourceTripId: 'crossing', sourceServiceDate: '2026-09-07' })
    expect(trips.has('midnight')).toBe(false)
    expect(trips.get('service:2026-09-07:midnight').start).toBe(0)
    expect(trips.has('daytime')).toBe(true)
    expect(trips.has('service:2026-09-07:daytime')).toBe(false)
    expect(snapshot.trains.some(t => t.sourceTripId === 'removed-overnight')).toBe(false)
    expect(trips.get('service:2026-09-07:added-overnight').start).toBe(1800)
    expect(trips.get('today-only').start).toBe(1800)
    expect(snapshot.trains.filter(t => t.sourceTripId === 'frequency').map(t => t.start).sort((a, b) => a - b)).toEqual([-300, 300, 900, 1500, 86100])
    expect(new Set(snapshot.trains.map(t => t.id)).size).toBe(snapshot.trains.length)
    // A feed that starts on the target date cannot promise preceding-day coverage.
    await writeFile(join(directory, 'feed_info.txt'), files['feed_info.txt'].replace('20260101', '20260908'))
    await run('zip', ['-q', 'fixture.zip', 'feed_info.txt'], { cwd: directory })
    await expect(run(process.execPath, args)).rejects.toThrow('does not cover both service days')
  } finally { await rm(directory, { recursive: true, force: true }) }
})
