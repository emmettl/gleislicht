// @vitest-environment jsdom
import './dom.ts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { mountApp, clock, element, search } from './app-harness.tsx'
import { deferred, fixture, fixtureFetch } from './fixtures.ts'

it('enables desktop and mobile road controls for the full day and preserves a late clock through loading and selection', async () => {
  const { overrides, requests } = fixtureFetch(), pending = deferred<Response>()
  overrides.set('swiss-road-topology.json', () => pending.promise)
  mountApp('?study=national&range=day&time=81000')
  await waitFor(() => expect(clock().value).toBe('81000'))
  for (const toggle of screen.getAllByRole('button', { name: 'Show Road Study 001' })) expect((toggle as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(element('.road-toggle'))
  await waitFor(() => expect(requests).toContain('swiss-road-topology.json'))
  await act(async () => { pending.resolve(Response.json(fixture('swiss-road-topology.json'))); await pending.promise })
  await waitFor(() => expect(requests).toContain('swiss-road-national-manifest.json'))
  expect(clock().value).toBe('81000')
  await search('Gotthard', '.search-results .road-result')
  expect(clock().min).toBe('0')
  expect(clock().max).toBe('86400')
  expect(clock().value).toBe('81000')
  expect(element('.road-toggle').getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(element('.road-toggle'))
  fireEvent.click(element('.road-toggle'))
  expect(clock().value).toBe('81000')
})

it('keeps roads enabled when switching from the morning to the full-day study', async () => {
  fixtureFetch(); mountApp()
  await screen.findByTestId('map-scene')
  fireEvent.click(element('.road-toggle'))
  fireEvent.click(screen.getByRole('button', { name: /24-hour Switzerland study/ }))
  await waitFor(() => expect(clock().min).toBe('0'))
  expect(element('.road-toggle').getAttribute('aria-pressed')).toBe('true')
})

it('opens the full-day clock when the road history seeks outside the morning window', async () => {
  fixtureFetch(); mountApp()
  await search('Gotthard', '.search-results .road-result')
  const history = await screen.findByRole('slider', { name: 'Choose traffic time' })
  fireEvent.change(history, { target: { value: '62100' } })
  await waitFor(() => expect(clock().max).toBe('86400'))
  expect(clock().value).toBe('62100')
})
