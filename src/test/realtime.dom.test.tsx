// @vitest-environment jsdom
import './dom.ts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { RealtimeSnapshot } from '@motionstudies/core/domain/realtime'
vi.hoisted(() => vi.stubEnv('VITE_GLEISLICHT_REALTIME_URL', 'https://realtime.test/data/live.json'))
import { mountApp, element } from './app-harness.tsx'
import { fixture, fixtureFetch } from './fixtures.ts'

function liveFeed() {
  const snapshot = fixture<RealtimeSnapshot>('realtime-demo.json')
  return { ...snapshot, metadata: { ...snapshot.metadata, kind: 'live' as const, generatedAt: new Date().toISOString(), receivedAt: new Date().toISOString() } }
}
const badge = () => screen.getByRole('button', { name: 'Toggle scheduled and operations view' })
const adjustedCount = () => Number(element('[data-testid="map-scene"]').getAttribute('data-realtime-count'))

it('defaults to LIVE, removes corrections on a failed poll, and recovers on the next successful poll', async () => {
  const { overrides } = fixtureFetch()
  const intervals = vi.spyOn(window, 'setInterval')
  const poll = () => {
    const handler = intervals.mock.calls.find(([, timeout]) => timeout === 60_000)?.[0]
    if (typeof handler !== 'function') throw new Error('Missing realtime poll')
    handler()
  }
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  overrides.set('live.json', () => Response.json(liveFeed()))
  mountApp()
  await waitFor(() => expect(badge().textContent).toBe('LIVE'))
  await waitFor(() => expect(adjustedCount()).toBeGreaterThan(0))
  overrides.set('live.json', () => new Response('', { status: 503 }))
  await act(async () => { poll!() })
  await waitFor(() => expect(badge().textContent).toBe('OFF'))
  expect(adjustedCount()).toBe(0)
  overrides.set('live.json', () => Response.json(liveFeed()))
  await act(async () => { poll!() })
  await waitFor(() => expect(badge().textContent).toBe('LIVE'))
  expect(adjustedCount()).toBeGreaterThan(0)
  fireEvent.click(badge())
  expect(badge().textContent).toBe('PLAN')
  expect(adjustedCount()).toBe(0)
})

it.each(['old', 'invalid', 'future'] as const)('rejects a %s source timestamp even with a fresh receive timestamp', async kind => {
  const { overrides } = fixtureFetch()
  const snapshot = liveFeed()
  snapshot.metadata.generatedAt = kind === 'old' ? new Date(Date.now() - 180_000).toISOString() : kind === 'future' ? new Date(Date.now() + 60_000).toISOString() : 'invalid'
  overrides.set('live.json', () => Response.json(snapshot))
  mountApp()
  await waitFor(() => expect(badge().textContent).toBe('STALE'))
  expect(adjustedCount()).toBe(0)
})

it.each(['serviceDate', 'staticFeedVersion'] as const)('keeps scheduled geometry and times for a mismatched %s', async key => {
  const { overrides } = fixtureFetch()
  const snapshot = liveFeed()
  snapshot.metadata[key] = 'unmatched'
  overrides.set('live.json', () => Response.json(snapshot))
  mountApp()
  await waitFor(() => expect(badge().textContent).toBe('MATCH'))
  expect(adjustedCount()).toBe(0)
})
