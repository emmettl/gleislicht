// @vitest-environment jsdom
import './dom.ts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import pilots from '../../data/cantonal-road-pilots.json'
import { mountApp, clock, seek, share, element } from './app-harness.tsx'
import { deferred, fixture, fixtureFetch } from './fixtures.ts'

it.each(pilots)('$id restores its final observation, shares and returns to morning', async pilot => {
  const { requests } = fixtureFetch()
  const app = mountApp(`?recording=${pilot.id}&time=${pilot.windowEnd}&latitude=47#private`)
  await waitFor(() => expect(clock().value).toBe(String(pilot.windowEnd)))
  expect(element('.cantonal-pilot').textContent).toContain(pilot.name)
  expect(clock().min).toBe(String(pilot.windowStart))
  expect(clock().max).toBe(String(pilot.windowEnd))
  expect(element('main').getAttribute('data-sbb-enabled')).toBe('false')
  expect(screen.getAllByRole('button', { name: /Resume motion/ })[0]).toBeTruthy()
  const url = await share()
  expect(new URL(url).searchParams.get('recording')).toBe(pilot.id)
  expect(url).not.toMatch(/latitude|private|station|train/)
  app.unmount()
  mountApp(new URL(url).search)
  await waitFor(() => expect(clock().value).toBe(String(pilot.windowEnd)))
  expect(element('.cantonal-pilot').textContent).toContain(pilot.name)
  fireEvent.click(screen.getByRole('button', { name: 'Return to morning roads' }))
  await waitFor(() => expect(clock().min).toBe('24300'))
  expect(requests).toContain(pilot.file)
})

it.each(pilots)('$id retries a failed linked download at the requested time', async pilot => {
  const { overrides } = fixtureFetch()
  overrides.set(pilot.file, () => new Response('', { status: 503 }))
  mountApp(`?recording=${pilot.id}&time=${pilot.windowEnd}`)
  await screen.findByText('Pilot could not be loaded. Try again.')
  expect(clock().min).toBe('24300')
  overrides.delete(pilot.file)
  fireEvent.click(screen.getByRole('button', { name: `Play ${pilot.label} recording` }))
  await waitFor(() => expect(clock().value).toBe(String(pilot.windowEnd)))
})

it('keeps a requested gap time and displays no traffic until observations resume', async () => {
  fixtureFetch()
  mountApp('?recording=horgen-2026-09-08&time=49020')
  await screen.findByText('No complete observations here. Traffic is hidden.')
  expect(clock().value).toBe('49020')
  expect(element('.road-corridor-card .metric-grid').textContent).toContain('—')
  seek(49440)
  await waitFor(() => expect(screen.queryByText('No complete observations here. Traffic is hidden.')).toBeNull())
})

it('rejects invalid links without fetching a recording', async () => {
  const { requests } = fixtureFetch()
  mountApp('?recording=unknown&time=57420')
  await screen.findByText(/This recording link is unavailable/)
  expect(requests.some(path => path.endsWith('road-pilot.json'))).toBe(false)
  expect(clock().min).toBe('24300')
})

it('ignores a fully settled old recording response after rail is enabled', async () => {
  const { overrides } = fixtureFetch(), pending = deferred<Response>()
  overrides.set('zurich-cantonal-road-pilot.json', () => pending.promise)
  mountApp('?recording=horgen-2026-09-08&time=49020')
  await screen.findByText('Loading pilot…')
  fireEvent.click(element('.network-study-picker .sbb-toggle'))
  await act(async () => { pending.resolve(Response.json(fixture('zurich-cantonal-road-pilot.json'))); await pending.promise })
  expect(element('main').getAttribute('data-sbb-enabled')).toBe('true')
  expect(clock().min).toBe('24300')
  expect(screen.getByRole('button', { name: 'Play Horgen recording' })).toBeTruthy()
})
