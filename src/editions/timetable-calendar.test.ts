import { describe, expect, it } from 'vitest'
import { rolloverUrl, selectTimetableDay, swissDate, timetableFile } from './timetable-calendar.ts'
describe('Swiss timetable date selection', () => {
  it('rolls over at Swiss midnight in summer and winter, including DST transitions', () => {
    for (const [instant, date] of [
      ['2026-09-12T21:59:59Z', '2026-09-12'], ['2026-09-12T22:00:00Z', '2026-09-13'],
      ['2026-12-12T23:00:00Z', '2026-12-13'], ['2026-03-29T01:00:00Z', '2026-03-29'],
      ['2026-10-25T01:00:00Z', '2026-10-25'],
    ]) expect(swissDate(new Date(instant))).toBe(date)
  })
  it('selects only an available exact date and leaves reviewed archives outside the calendar', () => {
    const calendar = { schemaVersion: 1, days: [{ date: '2026-09-13', feedVersion: '20260909', prefix: 'calendar/2026-09-13/', indexSha256: 'a'.repeat(64) }] }
    expect(selectTimetableDay(calendar, '2026-09-13')).toBe(calendar.days[0])
    expect(selectTimetableDay(calendar, '2026-09-14')).toBeUndefined()
    expect(timetableFile('swiss-rail-day-chunks/00-03.json')).toBe(true)
    expect(timetableFile('lausanne-region-day-manifest.json')).toBe(true)
    expect(timetableFile('bern-region-day-manifest.json')).toBe(false)
    expect(timetableFile('orbital/day.json')).toBe(false)
  })
  it('opens a clean new full-day session with Now resumed', () => {
    const url = new URL(rolloverUrl('https://motionstudies.app/gleislicht/?study=national&date=2026-09-12&t=86000&train=old', 'national'))
    expect(Object.fromEntries(url.searchParams)).toEqual({ study: 'national', range: 'day', now: '1' })
  })
})
