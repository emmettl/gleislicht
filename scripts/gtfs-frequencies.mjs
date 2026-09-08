import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { parseGtfsTime, rowsFromArchive } from '@motionstudies/data/gtfs'

function frequencyTime(value) {
  if (!/^\d+:[0-5]\d:[0-5]\d$/.test(value)) throw new Error(`Invalid frequency time: ${value}`)
  const time = parseGtfsTime(value)
  if (!Number.isSafeInteger(time)) throw new Error(`Invalid frequency time: ${value}`)
  return time
}

export function frequencyIntervals(rows, activeTrips) {
  const result = new Map()
  for (const row of rows) {
    if (!activeTrips.has(row.trip_id)) continue
    const headwaySeconds = Number(row.headway_secs)
    const exactTimes = Number(row.exact_times || 0)
    const startTime = frequencyTime(row.start_time), endTime = frequencyTime(row.end_time)
    if (!Number.isSafeInteger(headwaySeconds) || headwaySeconds <= 0 || ![0, 1].includes(exactTimes) || endTime <= startTime) throw new Error(`Invalid frequency interval for ${row.trip_id}`)
    const intervals = result.get(row.trip_id) ?? []
    intervals.push({ startTime, endTime, headwaySeconds, exactTimes })
    result.set(row.trip_id, intervals)
  }
  for (const [id, intervals] of result) {
    intervals.sort((a, b) => a.startTime - b.startTime)
    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i].startTime < intervals[i - 1].endTime) throw new Error(`Overlapping frequency intervals for ${id}`)
    }
  }
  return result
}

export async function readFrequencyIntervals(archive, activeTrips) {
  const { stdout } = await promisify(execFile)('unzip', ['-Z1', archive])
  if (!stdout.split(/\r?\n/).includes('frequencies.txt')) return new Map()
  const rows = []
  for await (const row of rowsFromArchive(archive, 'frequencies.txt')) rows.push(row)
  return frequencyIntervals(rows, activeTrips)
}

/** Deterministic representative headway motion for exactTimes=0; a timetable for 1.
 * The grid is anchored to the source interval, never to a requested output window.
 */
export function* expandFrequencyTrip(tripId, stops, intervals, windowStart, windowEnd) {
  if (stops.length < 2) return
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) throw new Error('Invalid frequency study window')
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]
    if (!Number.isFinite(stop.arrival) || !Number.isFinite(stop.departure) || stop.departure < stop.arrival || (i && stop.arrival < stops[i - 1].departure)) throw new Error(`Invalid frequency stop times for ${tripId}`)
  }
  const baseDeparture = stops[0].departure
  const duration = stops.at(-1).arrival - baseDeparture
  for (const interval of intervals) {
    // Retain instances entering the window after departing before it.
    const first = Math.max(0, Math.ceil((windowStart - duration - interval.startTime) / interval.headwaySeconds))
    for (let departure = interval.startTime + first * interval.headwaySeconds;
      departure < interval.endTime && departure <= windowEnd;
      departure += interval.headwaySeconds) {
      const delta = departure - baseDeparture
      yield {
        id: `frequency:${encodeURIComponent(tripId)}:${departure}`,
        stops: stops.map(stop => ({ ...stop, arrival: stop.arrival + delta, departure: stop.departure + delta })),
        frequency: { sourceTripId: tripId, ...interval },
      }
    }
  }
}
