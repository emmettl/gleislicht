// @vitest-environment jsdom
import './dom.ts'
import { readFileSync } from 'node:fs'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { mountApp, clock, element, seek } from './app-harness.tsx'
import { deferred, fixtureFetch } from './fixtures.ts'

it.each([true, false])('Now follows Swiss time with PostBus active and SBB visible=%s', async sbb => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-08T15:15:00Z'))
  fixtureFetch()
  mountApp(`?postbus=1&sbb=${Number(sbb)}&time=27900`)
  const now = await screen.findByRole('button', { name: 'Now' })
  await waitFor(() => expect((now as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(now)
  await waitFor(() => expect(now.getAttribute('aria-pressed')).toBe('true'))
  expect(clock().max).toBe('86400')
  expect(Number(clock().value)).toBe(62100)
  expect(element('.experience').getAttribute('data-postbus-enabled')).toBe('true')
  expect(element('.experience').getAttribute('data-sbb-enabled')).toBe(String(sbb))
  vi.setSystemTime(new Date('2026-09-08T15:15:02Z'))
  await waitFor(() => expect(Number(clock().value)).toBe(62102))
  seek(63000)
  await waitFor(() => expect(now.getAttribute('aria-pressed')).toBe('false'))
  expect(Number(clock().value)).toBe(63000)
})

it('Now waits for the PostBus chunk at the current time before starting', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-08T15:15:00Z'))
  const { overrides, requests } = fixtureFetch(), pending = deferred<Response>()
  const chunk = 'postbus-national-day-chunks/15-18.json'
  overrides.set(chunk, () => pending.promise.then(response => response.clone()))
  mountApp('?postbus=1&time=27900')
  const now = await screen.findByRole('button', { name: 'Now' })
  await waitFor(() => expect((now as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(now)
  await waitFor(() => expect(requests).toContain(chunk))
  expect(now.getAttribute('aria-pressed')).toBe('false')
  expect((now as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { pending.resolve(new Response(readFileSync(`${process.cwd()}/public/data/${chunk}`, 'utf8'))); await pending.promise })
  await waitFor(() => expect(now.getAttribute('aria-pressed')).toBe('true'))
  expect(Number(clock().value)).toBe(62100)
})
