// @vitest-environment jsdom
import './dom.ts'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { mountApp, element, clock, seek } from './app-harness.tsx'
import { fixture, fixtureFetch } from './fixtures.ts'

it.each(['http', 'null'])('Jungfrau %s terrain retries without replacing the ascent', async failure => {
  const { overrides } = fixtureFetch(), file = 'jungfrau-ascent-terrain.json'
  overrides.set(file, () => failure === 'http' ? new Response('', { status: 503 }) : Response.json(null))
  mountApp('?study=jungfrau')
  fireEvent.click(await screen.findByRole('button', { name: /Follow the ascent via Wengen/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Follow in measured terrain' }))
  await waitFor(() => expect(element('.jungfrau-ascent [data-terrain-status]').getAttribute('data-terrain-status')).toBe('error'))
  expect(clock().value).toBe('43440')
  overrides.delete(file)
  fireEvent.click(screen.getByRole('button', { name: 'Retry terrain' }))
  await waitFor(() => expect(element('.jungfrau-ascent [data-terrain-status]').getAttribute('data-terrain-status')).toBe('outdoor'))
  expect(clock().value).toBe('43440')
})

it.each(['funicular', 'railway'])('Glion isolates %s terrain failure from the other leg and retries invalid data', async leg => {
  const { overrides } = fixtureFetch()
  const file = leg === 'funicular' ? 'territet-ascent-terrain.json' : 'rochers-ascent-terrain.json'
  overrides.set(file, () => new Response('', { status: 503 }))
  const failedTime = leg === 'funicular' ? 41700 : 42960, validTime = leg === 'funicular' ? 42960 : 41700
  mountApp(`?study=territet&date=2026-09-04&time=${failedTime}&glion=.ojp-91-37-F.1.TA.45.j26`)
  fireEvent.click(await screen.findByRole('button', { name: 'Follow in measured terrain' }))
  const status = () => element('.glion-journey [data-terrain-status]').getAttribute('data-terrain-status')
  await waitFor(() => expect(status()).toBe('error'))
  expect(clock().value).toBe(String(failedTime))
  seek(validTime); await waitFor(() => expect(status()).toBe('outdoor'))
  seek(42000); expect(status()).toBe('interchange')
  expect(screen.queryByRole('button', { name: 'Retry terrain' })).toBeNull()
  seek(failedTime); expect(status()).toBe('error')
  overrides.set(file, () => Response.json(null))
  fireEvent.click(screen.getByRole('button', { name: 'Retry terrain' }))
  await waitFor(() => expect(status()).toBe('error'))
  overrides.delete(file)
  fireEvent.click(screen.getByRole('button', { name: 'Retry terrain' }))
  await waitFor(() => expect(status()).toBe('outdoor'))
  expect(clock().value).toBe(String(failedTime))
})

it('Rigi sequence switches approaches, holds Kaltbad, replays and retries its terrain', async () => {
  const { overrides, requests } = fixtureFetch(), file = 'vitznau-rigi-corridor.json'
  overrides.set(file, () => new Response('', { status: 503 }))
  mountApp('?study=rigi-lake')
  fireEvent.click(await screen.findByRole('button', { name: /Follow lake to summit/ }))
  await waitFor(() => expect(element('.rigi-sequence').getAttribute('data-phase')).toBe('boat'))
  const card = within(element('.rigi-sequence'))
  expect(clock().value).toBe('43920')
  seek(47340); expect(element('.rigi-sequence').getAttribute('data-phase')).toBe('interchange')
  seek(47700); expect(element('.rigi-sequence').getAttribute('data-phase')).toBe('rail')
  fireEvent.click(card.getByRole('button', { name: /Follow this train in terrain/ }))
  await screen.findByText(/Terrain unavailable for this service/)
  expect(clock().value).toBe('47700')
  overrides.delete(file); fireEvent.click(card.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.queryByText(/Terrain unavailable for this service/)).toBeNull())
  fireEvent.change(card.getByRole('combobox', { name: 'Choose an approach' }), { target: { value: 'weggis' } })
  expect(clock().value).toBe('43920')
  seek(51300); expect(element('.rigi-sequence').getAttribute('data-phase')).toBe('kaltbad')
  fireEvent.click(card.getByRole('button', { name: /Cogwheel 1139/ }))
  expect(clock().value).toBe('52500')
  expect(element('.rigi-sequence').getAttribute('data-phase')).toBe('rail')
  seek(53220); expect(element('.rigi-sequence').getAttribute('data-phase')).toBe('complete')
  fireEvent.click(card.getByRole('button', { name: /Replay/ }))
  expect(clock().value).toBe('43920')
  expect(requests.filter(path => path === file)).toHaveLength(2)
})

it.each(['vitznau', 'arth-goldau'])('scenic Rigi %s failure retries the correct corridor', async approach => {
  const { overrides } = fixtureFetch(), file = `${approach}-rigi-corridor.json`
  overrides.set(file, () => new Response('', { status: 503 }))
  mountApp('?study=rigi-lake')
  const button = await screen.findByRole('button', { name: approach === 'vitznau' ? /Climb Vitznau/ : /Climb Arth-Goldau/ })
  fireEvent.click(button)
  await screen.findAllByText(/Rigi terrain unavailable/)
  expect(element('.journey-card').textContent).toContain(approach === 'vitznau' ? 'Vitznau' : 'Arth-Goldau')
  overrides.delete(file)
  fireEvent.click(screen.getByRole('button', { name: approach === 'vitznau' ? /Climb Vitznau/ : /Climb Arth-Goldau/ }))
  await waitFor(() => expect(document.querySelector('.rigi-terrain-profile')).not.toBeNull())
})

it('Glion rejects unlisted downhill geometry without poisoning valid funicular terrain', async () => {
  const { overrides } = fixtureFetch(), file = 'rochers-ascent-terrain.json'
  const data = fixture<{ routes: { reverseTripIds?: string[] }[] }>(file)
  delete data.routes[0].reverseTripIds
  overrides.set(file, () => Response.json(data))
  mountApp('?study=territet&date=2026-09-04&time=46000&glion=.ojp-91-37-F.1.TA.89.j26')
  fireEvent.click(await screen.findByRole('button', { name: 'Follow in measured terrain' }))
  const status = () => element('.glion-journey [data-terrain-status]').getAttribute('data-terrain-status')
  await waitFor(() => expect(status()).toBe('error'))
  seek(48000); await waitFor(() => expect(status()).toBe('outdoor'))
  seek(46000); expect(status()).toBe('error')
  overrides.delete(file); fireEvent.click(screen.getByRole('button', { name: 'Retry terrain' }))
  await waitFor(() => expect(status()).toBe('outdoor'))
  expect(clock().value).toBe('46000')
})
