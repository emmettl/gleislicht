import { studyLinkUrl } from './share-link.ts'
import { resolveSwissNow, swissInstant } from './swiss-now.ts'
import { describe, expect, it } from 'vitest'
import { readStudyLink, withinStudy } from './explore.ts'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
const metadata = (date: string, start = 0, end = 86400) => ({ serviceDate: date, windowStart: start, windowEnd: end }) as NetworkSnapshot['metadata']
describe('Swiss Now and study links', () => {
  it('uses Swiss civil time through both daylight-saving transitions', () => {
    expect(swissInstant(new Date('2026-03-29T00:30:00Z')).time).toBe(5400)
    expect(swissInstant(new Date('2026-03-29T01:30:00Z')).time).toBe(12600)
    expect(swissInstant(new Date('2026-10-25T00:30:00Z')).time).toBe(9000)
    expect(swissInstant(new Date('2026-10-25T01:30:00Z')).time).toBe(9000)
    expect(swissInstant(new Date('2026-09-08T22:30:00Z')).date).toBe('2026-09-09')
  })
  it('accepts a recent representative weekday but rejects weekends, old seasons and partial windows', () => {
    const now = new Date('2026-09-08T12:00:00Z')
    expect(resolveSwissNow(now, metadata('2026-09-04'))).toBe(50400)
    expect(resolveSwissNow(now, metadata('2026-09-05'))).toBeNull()
    expect(resolveSwissNow(now, metadata('2026-01-02'))).toBeNull()
    expect(resolveSwissNow(now, metadata('2026-09-04', 24300, 31500))).toBeNull()
    expect(resolveSwissNow(now, metadata('2026-09-04', 0, 50400))).toBeNull()
  })
  it('round-trips supported focus and time, excluding user location', () => {
    const state = { study: 'zvv-region', range: 'day', date: '2026-09-04', time: 62100, station: 'Zürich HB' } as const
    const url = studyLinkUrl('https://motionstudies.app/gleislicht/?latitude=47&longitude=8&perf=1#secret', state)
    expect(url).not.toMatch(/latitude|longitude|perf|secret/)
    expect(readStudyLink(new URL(url).search)).toMatchObject(state)
    expect(readStudyLink('?study=unknown&time=Infinity&range=bad')).toMatchObject({ study: 'national', range: 'morning', time: undefined })
  })
  it('keeps an out-of-study location from moving the map', () => {
    expect(withinStudy({ longitude: 0, latitude: 0 }, { minLongitude: 8, maxLongitude: 9, minLatitude: 47, maxLatitude: 48 })).toBe(false)
  })
})


describe('cantonal recording links', () => {
  for (const [recording, start, end] of [
    ['horgen-2026-09-08', 48180, 51660],
    ['wallisellen-bassersdorf-2026-09-08', 51240, 57420],
  ] as const) {
    it(`round-trips ${recording}, including its last observation`, () => {
      for (const time of [start, end]) {
        const state = { study: 'national', range: 'morning', recording, date: '2026-09-08', time } as const
        const url = studyLinkUrl('https://example.org/?latitude=47&longitude=8&token=private#location', { ...state, station: 'Zürich HB', train: 'stale' })
        expect(readStudyLink(new URL(url).search)).toEqual(state)
        expect(url).not.toMatch(/latitude|longitude|token|private|location|station|train/)
      }
    })
  }
  it('preserves a gap time and resolves defaults from the recording, ignoring rail focus', () => {
    expect(readStudyLink('?recording=horgen-2026-09-08&time=49020&study=postbus&range=day&station=Bern')).toEqual({ study: 'national', range: 'morning', recording: 'horgen-2026-09-08', date: '2026-09-08', time: 49020 })
    expect(readStudyLink('?recording=horgen-2026-09-08').time).toBe(49440)
  })
  it('rejects unsupported identities, conflicting dates and times outside the recording', () => {
    for (const query of ['recording=../../private.json', 'recording=', 'recording=horgen-2026-09-08&date=2026-09-09', ...['', 'NaN', 'Infinity', '-1', '48179', '51661'].map(time => `recording=horgen-2026-09-08&time=${time}`)]) {
      expect(readStudyLink(`?${query}&study=postbus&station=Bern`)).toEqual({ study: 'national', range: 'morning', invalidRecording: true })
    }
    expect(() => studyLinkUrl('https://example.org', { study: 'national', range: 'morning', recording: 'unknown' })).toThrow('Invalid recording link')
  })
})
