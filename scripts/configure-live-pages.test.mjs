import { describe, expect, it } from 'vitest'
import { checkLiveEndpoint, liveCompatibility } from './configure-live-pages.mjs'

const now = Date.parse('2026-09-07T08:02:00Z')
const snapshot = {
  metadata: { feedVersion: '20260902', serviceDate: '2026-09-07' },
}
const health = {
  status: 'ok',
  generatedAt: '2026-09-07T08:01:00Z',
  staticFeedVersion: '20260902',
  serviceDate: '2026-09-07',
}

describe('live Pages compatibility gate', () => {
  it('enables a fresh, exactly paired Worker snapshot', () => {
    expect(liveCompatibility(snapshot, health, now)).toEqual({ compatible: true })
  })

  it('rejects a different static feed or service day', () => {
    expect(
      liveCompatibility(snapshot, { ...health, staticFeedVersion: '20260906' }, now),
    ).toMatchObject({ compatible: false, reason: 'feed-version' })
    expect(
      liveCompatibility(snapshot, { ...health, serviceDate: '2026-09-06' }, now),
    ).toMatchObject({ compatible: false, reason: 'service-date' })
  })

  it('rejects a stale Worker snapshot', () => {
    expect(
      liveCompatibility(snapshot, { ...health, generatedAt: '2026-09-07T07:58:00Z' }, now),
    ).toMatchObject({ compatible: false, reason: 'worker-stale' })
  })

  it('uses the same 150-second freshness ceiling as the client', () => {
    expect(liveCompatibility(snapshot, { ...health, generatedAt: new Date(now - 151_000).toISOString() }, now)).toMatchObject({ compatible: false })
  })

  it('retains static publication when health is unreachable or malformed', async () => {
    for (const fetcher of [
      async () => { throw new Error('network unavailable') },
      async () => new Response('invalid json'),
    ]) {
      expect(await checkLiveEndpoint(snapshot, 'https://realtime.test', fetcher)).toEqual({ compatible: false, reason: 'worker-unavailable' })
    }
    expect(await checkLiveEndpoint(snapshot, 'https://realtime.test', async () => new Response('', { status: 503 }))).toEqual({ compatible: false, reason: 'worker-http-503' })
  })
})
