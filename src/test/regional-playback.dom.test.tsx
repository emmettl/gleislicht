// @vitest-environment jsdom
import './dom.ts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { mountApp, clock, seek } from './app-harness.tsx'
import { deferred, fixture, fixtureFetch } from './fixtures.ts'

it('keeps a pause and sought time when a pending regional chunk arrives', async () => {
  const { overrides, requests } = fixtureFetch()
  const pending = deferred<Response>(), path = 'geneva-tpg-day-chunks/16-18.json'
  overrides.set(path, () => pending.promise.then(response => response.clone()))
  mountApp('?study=geneva-tpg&range=day&time=27900')
  await waitFor(() => expect(screen.getByTestId('map-scene').getAttribute('data-train-count')).not.toBe('0'))
  fireEvent.click(screen.getAllByRole('button', { name: /Resume motion/ })[0])
  seek(62100)
  await waitFor(() => expect(requests).toContain(path))
  fireEvent.click(screen.getAllByRole('button', { name: /Pause motion/ })[0])
  await act(async () => { pending.resolve(new Response(JSON.stringify(fixture(path)))); await pending.promise })
  await waitFor(() => expect(screen.getByTestId('map-scene').getAttribute('data-train-count')).not.toBe('0'))
  expect(clock().value).toBe('62100')
  expect(screen.getByTestId('map-scene').getAttribute('data-playing')).toBe('false')
  expect(screen.getAllByRole('button', { name: /Resume motion/ })[0]).toBeTruthy()
})
it('retries a failed regional chunk without changing paused intent or sought time', async () => {
  const { overrides, requests } = fixtureFetch(), path = 'geneva-tpg-day-chunks/06-08.json'
  overrides.set(path, () => new Response('', { status: 503 }))
  mountApp('?study=geneva-tpg&range=day&time=27900')
  await screen.findByRole('button', { name: 'Retry' })
  overrides.delete(path)
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull())
  await waitFor(() => expect(screen.getByTestId('map-scene').getAttribute('data-train-count')).not.toBe('0'))
  expect(requests.filter(request => request === path).length).toBeGreaterThan(1)
  expect(clock().value).toBe('27900')
  expect(screen.getByTestId('map-scene').getAttribute('data-playing')).toBe('false')
})

it('ignores a cancelled morning failure after another region is selected', async () => {
  const { overrides } = fixtureFetch(), pending = deferred<Response>()
  let obsoleteSignal: AbortSignal | null | undefined
  overrides.set('geneva-tpg-morning.json', init => {
    obsoleteSignal = init?.signal
    return pending.promise.then(response => response.clone())
  })
  mountApp('?study=geneva-tpg&range=morning&time=27900')
  await waitFor(() => expect(obsoleteSignal).toBeDefined())
  fireEvent.click(screen.getByRole('button', { name: 'Explore studies' }))
  fireEvent.click(await screen.findByRole('button', { name: /Zürich region · ZVV/ }))
  await waitFor(() => expect(screen.getByTestId('map-scene').getAttribute('data-train-count')).not.toBe('0'))
  expect(obsoleteSignal?.aborted).toBe(true)
  await act(async () => { pending.resolve(new Response('', { status: 503 })); await pending.promise })
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  expect(clock().value).toBe('27900')
  expect(screen.getByTestId('map-scene').getAttribute('data-playing')).toBe('false')
})
