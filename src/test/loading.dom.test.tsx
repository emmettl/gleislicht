// @vitest-environment jsdom
import './dom.ts'
import { act, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useProgressiveRoadStudy } from '@motionstudies/web/use-progressive-road-study'
import { mountApp, element, clock } from './app-harness.tsx'
import { deferred, fixture, fixtureFetch } from './fixtures.ts'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import { SWITZERLAND_MAP_FRAMINGS } from '../editions/switzerland.ts'

it.each([
  ['zurich-city', 'zurich'], ['zvv-region', 'zvv'], ['geneva-tpg', 'geneva'],
] as const)('%s frames the full-day map independently of its morning response', async (study, framing) => {
  const { overrides, requests } = fixtureFetch(), pending = deferred<Response>()
  const morning = `${study}-morning.json`
  overrides.set(morning, () => pending.promise)
  mountApp(`?study=${study}&range=day`)
  const scene = await screen.findByTestId('map-scene')
  await waitFor(() => expect(requests).toContain(morning))
  const bounds = JSON.stringify(fixture<NetworkSnapshot>(`${study}-day-manifest.json`).bounds)
  const reference = JSON.stringify(fixture<NetworkSnapshot>('swiss-rail-morning.json').bounds)
  expect(scene.dataset.cameraScale).toBe(String(SWITZERLAND_MAP_FRAMINGS[framing].homeDistanceScale))
  expect(scene.dataset.bounds).toBe(bounds)
  expect(scene.dataset.referenceBounds).toBe(reference)
  await act(async () => { pending.resolve(Response.json(fixture(morning))); await pending.promise })
  expect(scene.dataset.cameraScale).toBe(String(SWITZERLAND_MAP_FRAMINGS[framing].homeDistanceScale))
  expect(scene.dataset.bounds).toBe(bounds)
  expect(scene.dataset.referenceBounds).toBe(reference)
})

it('waits for the shared map projection before showing a directly linked Zürich map', async () => {
  const { overrides, requests } = fixtureFetch(), pending = deferred<Response>()
  overrides.set('swiss-rail-morning.json', () => pending.promise)
  mountApp('?study=zurich-city&range=day')
  await waitFor(() => expect(requests.some(path => path.startsWith('zurich-city-day-chunks/'))).toBe(true))
  expect(screen.queryByTestId('map-scene')).toBeNull()
  await act(async () => { pending.resolve(Response.json(fixture('swiss-rail-morning.json'))); await pending.promise })
  const scene = await screen.findByTestId('map-scene')
  expect(scene.dataset.cameraScale).toBe(String(SWITZERLAND_MAP_FRAMINGS.zurich.homeDistanceScale))
  expect(scene.dataset.referenceBounds).toBe(JSON.stringify(fixture<NetworkSnapshot>('swiss-rail-morning.json').bounds))
})

it('does not substitute the national map while Zürich morning data is loading', async () => {
  const { overrides } = fixtureFetch(), pending = deferred<Response>()
  overrides.set('zurich-city-morning.json', () => pending.promise)
  mountApp()
  await screen.findByTestId('map-scene')
  fireEvent.click(screen.getByRole('button', { name: 'Show Zürich city multimodal network' }))
  fireEvent.click(screen.getByRole('button', { name: 'Full day' }))
  expect(screen.queryByTestId('map-scene')).toBeNull()
  await act(async () => { pending.resolve(Response.json(fixture('zurich-city-morning.json'))); await pending.promise })
  const scene = await screen.findByTestId('map-scene')
  expect(scene.dataset.bounds).toBe(JSON.stringify(fixture<NetworkSnapshot>('zurich-city-morning.json').bounds))
  expect(scene.dataset.cameraScale).toBe(String(SWITZERLAND_MAP_FRAMINGS.zurich.homeDistanceScale))
})

it('adopts the loaded national minute values rather than only changing attribution text', async () => {
  const { overrides, requests } = fixtureFetch(), pending = deferred<Response>()
  overrides.set('swiss-road-national-manifest.json', () => Response.json({
    metadata: { serviceDate: '2026-09-04', windowStart: 24300, windowEnd: 31500 },
    siteIds: ['CH:0017:positive', 'CH:0072:positive'],
    sections: [{ id: 'test', road: 'N1', direction: 'positive', fromSiteIndex: 0, toSiteIndex: 1, distanceKm: 1.11 }],
    chunks: [{ id: '06-09', windowStart: 24300, windowEnd: 31500, path: 'swiss-road-national/test.json', minuteCount: 2, valueCount: 4 }],
  }))
  overrides.set('swiss-road-national/test.json', () => pending.promise)
  const url = (path: string) => `/data/${path}`
  const hook = renderHook(({ active }) => useProgressiveRoadStudy('swiss-road-national-manifest.json', active, 27900, url), { initialProps: { active: false } })
  expect(requests).toEqual([])
  hook.rerender({ active: true })
  await waitFor(() => expect(requests).toContain('swiss-road-national/test.json'))
  expect(hook.result.current.chunkReady).toBe(false)
  const minutes = [[27900, [[0, 1000, 80, 100, 70], [1, 1100, 78, 110, 68]]], [27960, [[0, 1020, 79, 102, 69], [1, 1120, 77, 112, 67]]]]
  await act(async () => { pending.resolve(Response.json({ windowStart: 24300, windowEnd: 31500, minutes })); await pending.promise })
  await waitFor(() => expect(hook.result.current.chunkReady).toBe(true))
  expect(hook.result.current.snapshot?.minutes).toEqual(minutes)
  expect(hook.result.current.snapshot?.siteIds).toEqual(['CH:0017:positive', 'CH:0072:positive'])
})

it('switching regional studies ignores an older morning response and keeps the new feed', async () => {
  const { overrides, requests } = fixtureFetch(), pending = deferred<Response>()
  const file = 'zug-region/2026-09-04/study/zug-region-morning.json'
  overrides.set(file, () => pending.promise)
  mountApp('?study=zug-region&range=morning&date=2026-10-01')
  await waitFor(() => expect(requests).toContain(file))
  fireEvent.click(screen.getByRole('button', { name: 'Explore studies' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: /Thurgau · rail, buses and lake/ }))
  await waitFor(() => expect(element('.network-card .between').textContent).toContain('Full day'))
  await act(async () => { pending.resolve(Response.json(fixture(file))); await pending.promise })
  expect((screen.getByRole('combobox', { name: /Thurgau.*Timetable date/i }) as HTMLSelectElement).value).toBe('2026-09-04')
  expect(element('.network-card .between').textContent).toContain('Full day')
  fireEvent.click(screen.getByRole('button', { name: 'Full day' }))
  await waitFor(() => expect(element('.network-card .between').textContent).toContain('Selected trains, buses and boats'))
})

it.each(['gornergrat', 'pilatus', 'rochers', 'territet', 'jungfrau', 'zug-region', 'ticino-region'])('%s discloses unavailable dates and retains the requested time', async id => {
  fixtureFetch(); mountApp(`?study=${id}&date=2020-01-01&time=43200`)
  await screen.findByText('The linked date is unavailable; showing the available timetable.')
  expect(clock().value).toBe('43200')
})
