// @vitest-environment jsdom
import './dom.ts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { mountApp, clock, seek } from './app-harness.tsx'
import { deferred, fixture, fixtureFetch } from './fixtures.ts'

const manifest = 'swiss-rail-day-manifest.json'
const chunk = (id: string) => `swiss-rail-day-chunks/${id}.json`
const scene = () => screen.getByTestId('map-scene')
const loaded = () => waitFor(() => expect(Number(scene().getAttribute('data-train-count'))).toBeGreaterThan(0))

it('keeps the morning fallback while the national manifest is pending, then uses the day timeline', async () => {
  const { overrides } = fixtureFetch(), pending = deferred<Response>()
  overrides.set(manifest, () => pending.promise.then(response => response.clone()))
  mountApp('?study=national&range=day&time=27900')
  await loaded()
  expect(clock().max).not.toBe('86400')
  expect(scene().getAttribute('data-playing')).toBe('false')
  await act(async () => { pending.resolve(new Response(JSON.stringify(fixture(manifest)))); await pending.promise })
  await waitFor(() => expect(clock().max).toBe('86400'))
  await loaded()
  expect(clock().value).toBe('27900')
})
it.each([manifest, chunk('06-09')])('explicitly retries %s without resuming or seeking', async path => {
  const { overrides, requests } = fixtureFetch()
  overrides.set(path, () => new Response('', { status: 503 }))
  mountApp('?study=national&range=day&time=27900')
  await screen.findByRole('button', { name: 'Retry' })
  overrides.delete(path)
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await loaded()
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull())
  expect(requests.filter(value => value === path).length).toBeGreaterThan(1)
  expect(clock().value).toBe('27900')
  expect(scene().getAttribute('data-playing')).toBe('false')
})
it('preserves a paused national seek when its delayed chunk arrives', async () => {
  const { overrides, requests } = fixtureFetch(), pending = deferred<Response>(), path = chunk('15-18')
  overrides.set(path, () => pending.promise.then(response => response.clone()))
  mountApp('?study=national&range=day&time=27900')
  await waitFor(() => expect(clock().max).toBe('86400'))
  await loaded()
  fireEvent.click(screen.getAllByRole('button', { name: /Resume motion/ })[0])
  seek(62100)
  await waitFor(() => expect(requests).toContain(path))
  expect(scene().getAttribute('data-playing')).toBe('false')
  fireEvent.click(screen.getAllByRole('button', { name: /Pause motion/ })[0])
  await act(async () => { pending.resolve(new Response(JSON.stringify(fixture(path)))); await pending.promise })
  await loaded()
  expect(clock().value).toBe('62100')
  expect(scene().getAttribute('data-playing')).toBe('false')
})
it.each([0, 86400])('loads the correct midnight boundary chunk at %s', async time => {
  const { requests } = fixtureFetch()
  mountApp(`?study=national&range=day&time=${time === 86400 ? 86399 : time}`)
  const path = chunk(time === 0 ? '00-03' : '21-24')
  await waitFor(() => expect(requests).toContain(path))
  const first = fixture<{ trains: { id: string }[] }>(path).trains[0].id
  await waitFor(() => expect(scene().getAttribute('data-train-ids')).toContain(first))
  // A link uses the last visible second; the scrubber also permits the inclusive end.
  if (time === 86400) seek(86400)
  expect(Number(clock().value)).toBe(time)
})
it('ignores an obsolete failure after another seek despite a failed neighbour', async () => {
  const { overrides, requests } = fixtureFetch(), pending = deferred<Response>(), obsolete = chunk('15-18')
  overrides.set(obsolete, () => pending.promise.then(response => response.clone()))
  overrides.set(chunk('03-06'), () => new Response('', { status: 503 }))
  mountApp('?study=national&range=day&time=27900')
  await waitFor(() => expect(requests).toContain(chunk('09-12')))
  await loaded()
  seek(62100)
  await waitFor(() => expect(requests).toContain(obsolete))
  seek(600)
  await loaded()
  await act(async () => { pending.resolve(new Response('', { status: 503 })); await pending.promise })
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  expect(clock().value).toBe('600')
})

it('retains a healthy prefetched neighbour when the other neighbour fails', async () => {
  const { overrides, requests } = fixtureFetch(), healthy = chunk('09-12')
  overrides.set(chunk('03-06'), () => new Response('', { status: 503 }))
  mountApp('?study=national&range=day&time=27900')
  await waitFor(() => expect(requests).toContain(healthy))
  await act(async () => { await Promise.resolve() })
  const attempts = requests.filter(path => path === healthy).length
  overrides.set(healthy, () => new Response('', { status: 503 }))
  seek(36000)
  const first = fixture<{ trains: { id: string }[] }>(healthy).trains[0].id
  await waitFor(() => expect(scene().getAttribute('data-train-ids')).toContain(first))
  expect(requests.filter(path => path === healthy).length).toBe(attempts)
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
})
it('ignores a national chunk retired by a study switch', async () => {
  const { overrides, requests } = fixtureFetch(), pending = deferred<Response>(), path = chunk('15-18')
  let signal: AbortSignal | null | undefined
  overrides.set(path, init => { signal = init?.signal; return pending.promise.then(response => response.clone()) })
  mountApp('?study=national&range=day&time=27900')
  await waitFor(() => expect(clock().max).toBe('86400'))
  await loaded()
  seek(62100)
  await waitFor(() => expect(requests).toContain(path))
  fireEvent.click(screen.getByRole('button', { name: 'Explore studies' }))
  fireEvent.click(await screen.findByRole('button', { name: /Zürich region · ZVV/ }))
  await loaded()
  expect(signal?.aborted).toBe(true)
  const time = clock().value, bounds = scene().getAttribute('data-bounds')
  await act(async () => { pending.resolve(new Response('', { status: 503 })); await pending.promise })
  expect(clock().value).toBe(time)
  expect(scene().getAttribute('data-bounds')).toBe(bounds)
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
})
