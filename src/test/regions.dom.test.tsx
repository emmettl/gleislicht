// @vitest-environment jsdom
import './dom.ts'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { mountApp, clock, seek, share, element, search } from './app-harness.tsx'
import { fixture, fixtureFetch } from './fixtures.ts'

const regions = [
  ['basel-core', 'Weil am Rhein', 'S3'], ['bern-region', 'Solothurn', 'S8'],
  ['solothurn-region', 'Biel/Bienne', 'IC5'], ['lausanne-region', 'Lausanne', 'm2'],
  ['luzern-region', 'Luzern', ''], ['zug-region', 'Zug', ''],
  ['thurgau-region', 'Frauenfeld', ''], ['fribourg-region', 'Fribourg', ''],
  ['ticino-region', 'Lugano', ''],
] as const
const dated = (id: string) => ['luzern-region', 'zug-region', 'thurgau-region', 'fribourg-region', 'ticino-region'].includes(id)
const prefix = (id: string, date = '2026-09-04') => dated(id) ? `${id}/${date}/${id === 'ticino-region' ? '' : 'study/'}` : ''

it.each(regions)('%s loads its real full-day feed, searches, seeks and restores a dated share', async (id, station, route) => {
  const { requests } = fixtureFetch()
  const app = mountApp(`?study=${id}&time=27900&date=2026-09-04`)
  await waitFor(() => expect(element('.network-card .between').textContent).toContain('Full day'))
  expect(clock().max).toBe('86400')
  if (dated(id)) {
    fireEvent.change(await screen.findByRole('combobox', { name: /timetable date/i }), { target: { value: '2026-09-06' } })
    await waitFor(() => expect(requests.some(path => path.startsWith(prefix(id, '2026-09-06')) && /06-08/.test(path))).toBe(true))
  }
  if (route) {
    await search(route, '.search-results .route-result')
    await waitFor(() => expect(element('.route-card').textContent).toContain(route))
  }
  await search(station, '.search-results .station-result')
  await waitFor(() => expect(element('.station-card').textContent).toContain(station))
  seek(62100)
  await waitFor(() => expect(requests.some(path => path.startsWith(prefix(id, dated(id) ? '2026-09-06' : undefined)) && path.includes('16-18.json'))).toBe(true))
  const url = await share(), params = new URL(url).searchParams
  expect(params.get('study')).toBe(id)
  expect(params.get('range')).toBe('day')
  if (dated(id)) expect(params.get('date')).toBe('2026-09-06')
  app.unmount(); mountApp(new URL(url).search)
  await waitFor(() => expect(element('.station-card').textContent).toContain(station))
  expect(clock().value).toBe('62100')
})

it.each(regions.filter(([id]) => id !== 'lausanne-region'))('%s recovers a failed morning snapshot without replacing its study', async (id) => {
  const { overrides } = fixtureFetch()
  const file = `${prefix(id)}${id}-morning.json`
  overrides.set(file, () => new Response('', { status: 503 }))
  mountApp(`?study=${id}&range=morning&time=27900&date=2026-09-04`)
  await screen.findByRole('button', { name: 'Retry' })
  overrides.delete(file)
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull())
  const expected = fixture<{ trains: { id: string }[] }>(file).trains[0].id
  await waitFor(() => expect(screen.getByTestId('map-scene').getAttribute('data-train-ids')).toContain(expected))
  expect(element('.network-card .between').textContent).not.toContain('unavailable')
  expect(clock().value).toBe('27900')
})

it.each(['basel-core', 'bern-region', 'solothurn-region', 'lausanne-region'])('%s recovers a failed midnight chunk', async id => {
  const { overrides, requests } = fixtureFetch(), file = `${id}-day-chunks/00-02.json`
  overrides.set(file, () => new Response('', { status: 503 }))
  mountApp(`?study=${id}&time=600`)
  await screen.findByRole('button', { name: 'Retry' })
  overrides.delete(file)
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull())
  expect(clock().value).toBe('600')
  expect(Number(element('.network-count-row > strong').textContent?.replace(/\D/g, ''))).toBeGreaterThan(0)
  expect(requests.filter(path => path === file).length).toBeGreaterThan(1)
  const priorDayIds: Record<string, string> = {
    'basel-core': 'service:2026-09-07:.ojp-91-10.1.TA.2542.j26',
    'bern-region': 'service:2026-09-03:.ojp-91-13-G.1.TA.86.j26',
    'solothurn-region': 'service:2026-09-03:.ojp-91-10.1.TA.4684.j26',
    'lausanne-region': 'service:2026-09-07:.ojp-91-1-M.1.TA.316.j26',
  }
  await waitFor(() => expect(screen.getByTestId('map-scene').getAttribute('data-train-ids')).toContain(priorDayIds[id]))
})

it.each(regions)('%s translates its real search controls in all supported languages', async id => {
  fixtureFetch(); mountApp(`?study=${id}&range=morning`)
  for (const [code, placeholder] of [['FR', /Rechercher/], ['DE', /suchen/], ['IT', /Cerca/]] as const) {
    fireEvent.click(within(element('.language-picker')).getByRole('button', { name: code }))
    await waitFor(() => expect(element('.train-search input').getAttribute('placeholder')).toMatch(placeholder))
  }
})
