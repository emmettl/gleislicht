// @vitest-environment jsdom
import './dom.ts'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import pilots from '../../data/cantonal-road-pilots.json'
import { mountApp, clock, element, search, seek } from './app-harness.tsx'
import { deferred, fixture, fixtureFetch } from './fixtures.ts'

it('recording catalogue exposes every identity and sanitized link without downloading recordings', async () => {
  const { requests } = fixtureFetch()
  mountApp('?latitude=47&longitude=8#private')
  fireEvent.click(await screen.findByRole('button', { name: 'Road recordings' }))
  const dialog = await screen.findByRole('dialog', { name: 'Road recordings' })
  for (const p of pilots) {
    const link = dialog.querySelector(`a[href*="recording=${p.id}&"]`) as HTMLAnchorElement
    expect(link.textContent).toContain(`${p.completeMinutes} recorded minutes`)
    expect(new URL(link.href).searchParams.get('recording')).toBe(p.id)
    expect(link.href).not.toMatch(/latitude|longitude|private/)
  }
  expect(requests.some(path => path.endsWith('road-pilot.json'))).toBe(false)
})

it('a wrong-corridor recording is rejected before a valid retry', async () => {
  const { overrides } = fixtureFetch()
  overrides.set('wallisellen-bassersdorf-road-pilot.json', () => Response.json(fixture('zurich-cantonal-road-pilot.json')))
  mountApp('?recording=wallisellen-bassersdorf-2026-09-08&time=57420')
  await screen.findByText('Pilot could not be loaded. Try again.')
  expect(clock().min).toBe('24300')
  overrides.delete('wallisellen-bassersdorf-road-pilot.json')
  fireEvent.click(screen.getByRole('button', { name: 'Play Wallisellen–Bassersdorf recording' }))
  await waitFor(() => expect(clock().value).toBe('57420'))
  expect(element('.cantonal-pilot').textContent).toContain('104 complete recorded minutes')
})

it('active movement count follows the selected station subset and release', async () => {
  fixtureFetch(); mountApp('?time=27900')
  const count = () => Number(element('.network-count-row > strong').textContent?.replace(/\D/g, ''))
  await waitFor(() => expect(count()).toBeGreaterThan(0))
  const total = count()
  await search('Bern', '.search-results .station-result')
  await waitFor(() => expect(count()).toBeLessThan(total))
  expect(count()).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Clear search and selection' }))
  expect(count()).toBe(total)
})

it('the operations toggle returns to the schedule and day moments drive the clock', async () => {
  fixtureFetch(); mountApp()
  const toggle = screen.getByRole('button', { name: 'Toggle scheduled and operations view' })
  await waitFor(() => expect(toggle.textContent).toBe('DEMO'))
  fireEvent.click(toggle)
  expect(toggle.textContent).toBe('PLAN')
  expect(element('.network-card').textContent).toContain('Scheduled rail')
  fireEvent.click(screen.getByRole('button', { name: /24-hour Switzerland study/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Evening rush · 17:15/ }))
  expect(clock().value).toBe('62100')
  const director = element('.director-toggle')
  fireEvent.click(director)
  expect(director.getAttribute('aria-pressed')).toBe('true')
})

it('unavailable Rigi remains recoverable by selecting the national study', async () => {
  const { overrides } = fixtureFetch()
  overrides.set('rigi-day.json', () => new Response('', { status: 503 }))
  mountApp('?study=rigi-lake')
  await screen.findByText(/Lake Lucerne–Rigi is unavailable/)
  fireEvent.click(within(element('.network-study-picker')).getByRole('button', { name: 'Show the two-hour Switzerland morning study' }))
  await waitFor(() => expect(Number(element('.network-count-row > strong').textContent?.replace(/\D/g, ''))).toBeGreaterThan(0))
  expect(element('h1').textContent).toContain('Switzerland')
})

it('keeps transport filters available while Cogwheel loads and supports switching directly to IC', async () => {
  const { overrides } = fixtureFetch(), pending = deferred<Response>()
  overrides.set('swiss-cogwheel-catalogue.json', () => pending.promise)
  mountApp('?time=27900')
  const legend = () => within(element('.service-legend'))
  await waitFor(() => expect(legend().getAllByRole('button').length).toBeGreaterThan(3))
  const labels = () => legend().getAllByRole('button').map(button => button.textContent)
  const original = labels()
  fireEvent.click(legend().getByRole('button', { name: 'Cogwheel' }))
  expect(element('main').getAttribute('data-cogwheel-enabled')).toBe('true')
  expect(labels()).toEqual(original)
  await act(async () => {
    pending.resolve(Response.json(fixture('swiss-cogwheel-catalogue.json')))
    await pending.promise
  })
  await waitFor(() => expect(element('.network-count-row > strong').textContent).not.toBe('—'))
  expect(labels()).toEqual(original)
  fireEvent.click(legend().getByRole('button', { name: 'IC' }))
  expect(element('main').getAttribute('data-cogwheel-enabled')).toBe('false')
  expect(legend().getByRole('button', { name: 'IC' }).getAttribute('aria-pressed')).toBe('true')
})

it.each(['missing', 'mismatch'])('cogwheel %s catalogue discloses unavailable counts and restores rail', async failure => {
  const { overrides } = fixtureFetch()
  overrides.set('swiss-cogwheel-catalogue.json', () => failure === 'missing' ? new Response('', { status: 503 }) : Response.json({ metadata: { feedVersion: 'wrong', serviceDate: '2020-01-01' }, trips: {}, routes: {} }))
  mountApp('?time=27900')
  await waitFor(() => expect(Number(element('.network-count-row > strong').textContent?.replace(/\D/g, ''))).toBeGreaterThan(0))
  const toggle = within(element('.service-legend')).getByRole('button', { name: 'Cogwheel' })
  const labels = () => within(element('.service-legend')).getAllByRole('button').map(button => button.textContent)
  const original = labels()
  fireEvent.click(toggle)
  await screen.findByText(/Cogwheel catalogue unavailable/)
  expect(element('.network-count-row > strong').textContent).toBe('—')
  expect(labels()).toEqual(original)
  fireEvent.click(toggle)
  await waitFor(() => expect(Number(element('.network-count-row > strong').textContent?.replace(/\D/g, ''))).toBeGreaterThan(0))
})

it.each(['manifest', 'chunk'])('PostBus invalid %s never displays the old rail counts', async failure => {
  const { overrides } = fixtureFetch()
  overrides.set(failure === 'manifest' ? 'postbus-national-day-manifest.json' : 'postbus-national-day-chunks/06-09.json', () => failure === 'manifest' ? new Response('', { status: 503 }) : Response.json({ trains: [] }))
  mountApp('?time=27900')
  fireEvent.click(element('.postbus-toggle'))
  await screen.findByText(/PostBus timetable unavailable/)
  expect(element('.network-count-row > strong').textContent).toBe('—')
})

it('national road selection remains available while geometry is pending or cantonal data fails', async () => {
  const { overrides } = fixtureFetch(), pending = deferred<Response>()
  overrides.set('swiss-road-topology.json', () => pending.promise)
  overrides.set('zurich-cantonal-road-topology.json', () => new Response('', { status: 404 }))
  mountApp()
  await search('Gotthard', '.search-results .road-result')
  await waitFor(() => expect(element('.road-corridor-card').textContent).toContain('A2'))
  await act(async () => { pending.resolve(Response.json(fixture('swiss-road-topology.json'))); await pending.promise })
  expect(element('.road-corridor-card').textContent).toContain('A2')
  expect(element('.road-corridor-card').textContent).not.toContain('Road geometry only')
})

it('Rigi rhythm exposes quiet periods, next departure and end of study', async () => {
  fixtureFetch(); mountApp('?study=rigi-lake&time=0')
  fireEvent.click(await screen.findByRole('button', { name: 'A day on lake and mountain →' }))
  await screen.findAllByText('Quiet now', { exact: true })
  expect(within(element('.rigi-day-rhythm')).getAllByText('Quiet now', { exact: true })).toHaveLength(4)
  fireEvent.click(element('.rigi-day-rhythm [data-mode="cable"] button'))
  expect(clock().value).toBe('24000')
  expect(element('.rigi-day-rhythm [data-mode="cable"]').textContent).toContain('1 underway')
  seek(86400)
  expect(within(element('.rigi-day-rhythm')).getAllByText('End of study window', { exact: true })).toHaveLength(4)
  fireEvent.click(screen.getByRole('button', { name: /Return to first departure/ }))
  expect(clock().value).toBe('22800')
})

it.each([0, 1])('frequency exactTimes=%i renders the correct selected-card contract', async exactTimes => {
  const { overrides } = fixtureFetch()
  overrides.set('zvv-region-morning.json', () => Response.json({
    metadata: { publisher: 'Fixture', feedVersion: 'fixture', serviceDate: '2026-09-04', windowStart: 24300, windowEnd: 31500, focusTime: 27900, sourceUrl: '', model: 'schedule' },
    bounds: { minLongitude: 8.55, maxLongitude: 8.65, minLatitude: 47.25, maxLatitude: 47.28 },
    stops: [[8.6, 47.27, 'Test Valley'], [8.61, 47.28, 'Test Summit']], edges: [[0, 1]],
    trains: [{ id: 'frequency:fixture:27900', route: 'TestLift', category: 'cableway', headsign: 'Test Summit', shortName: '', start: 27900, end: 28500, stops: [[0, 27900, 27900], [1, 28500, 28500]], frequency: { sourceTripId: 'fixture', startTime: 24300, endTime: 31500, headwaySeconds: 600, exactTimes } }],
  }))
  mountApp('?study=zvv-region&range=morning&time=27900')
  await search('TestLift', '.search-results .result-service b')
  await waitFor(() => expect(document.querySelector('.selected-card')).not.toBeNull())
  if (exactTimes) {
    expect(element('.selected-card').textContent).not.toContain('≈')
    expect(document.querySelector('.frequency-note')).toBeNull()
    expect(element('.selected-card').textContent).toContain('Plan')
  } else {
    expect(element('.selected-card').textContent).toContain('Illustrated arrival')
    expect(element('.frequency-note').textContent).toContain('10 min')
  }
})

it('airport board responds to seeking, changes direction and selects the actual flight', async () => {
  fixtureFetch(); mountApp('?time=27900')
  fireEvent.change(element('.train-search input'), { target: { value: 'ZRH' } })
  fireEvent.click(await screen.findByRole('option', { name: /ZRH/ }))
  await waitFor(() => expect(element('.ms-airport-hero tbody button')).toBeTruthy())
  const before = element('.ms-airport-hero tbody').textContent
  seek(30000)
  await waitFor(() => expect(element('.ms-airport-hero tbody').textContent).not.toBe(before))
  fireEvent.click(within(element('.ms-airport-hero')).getByRole('button', { name: 'Arrivals' }))
  await waitFor(() => expect(element('.ms-airport-hero tbody button')).toBeTruthy())
  fireEvent.click(element('.ms-airport-hero tbody button'))
  await waitFor(() => expect(document.querySelector('.ms-airport-hero')).toBeNull())
  expect(element('.air-card')).toBeTruthy()
})

it('performance monitoring is absent by default and explicitly enabled by the URL', async () => {
  fixtureFetch(); const app = mountApp()
  await screen.findByTestId('map-scene')
  expect(screen.queryByRole('complementary', { name: 'Local performance monitor' })).toBeNull()
  app.unmount(); mountApp('?perf=1')
  const monitor = await screen.findByRole('complementary', { name: 'Local performance monitor' })
  expect(monitor.textContent).toContain('Local only · no analytics')
  expect(monitor.textContent).toMatch(/measuring|FPS/)
})

it('every Rigi guide stop selects its distinct station without moving the clock', async () => {
  fixtureFetch(); mountApp('?study=rigi-lake&time=43200')
  for (const [id, name] of [['arth', 'Arth-Goldau RB'], ['staffel', 'Rigi Staffel'], ['kulm', 'Rigi Kulm'], ['kaltbadRail', 'Rigi Kaltbad-First'], ['kaltbadCable', 'Rigi Kaltbad (Luftseilbahn)'], ['weggisCable', 'Weggis (Luftseilbahn)'], ['weggisPier', 'Weggis'], ['vitznau', 'Vitznau'], ['luzern', 'Luzern Bahnhofquai']]) {
    fireEvent.click(await screen.findByRole('button', { name: 'Explore the Rigi connections →' }))
    await screen.findByRole('dialog')
    fireEvent.click(element(`[data-stop="${id}"]`))
    await waitFor(() => expect(element('.station-card .service').textContent).toBe(name))
    expect(clock().value).toBe('43200')
  }
})


it('PostBus layers combine with rail and remain selectable with SBB hidden', async () => {
  const { requests } = fixtureFetch()
  mountApp('?time=27900')
  const scene = () => screen.getByTestId('map-scene')
  await waitFor(() => expect(Number(scene().getAttribute('data-train-count'))).toBeGreaterThan(0))
  const railIds = scene().getAttribute('data-train-ids')!.split(',')
  expect(requests.some(path => path.includes('postbus-national'))).toBe(false)
  fireEvent.click(element('.postbus-toggle'))
  await waitFor(() => expect(Number(scene().getAttribute('data-train-count'))).toBeGreaterThan(railIds.length))
  expect(scene().getAttribute('data-train-ids')!.split(',')).toEqual(expect.arrayContaining(railIds))
  expect(clock().value).toBe('27900')
  fireEvent.click(element('.sbb-toggle'))
  const busIds = scene().getAttribute('data-train-ids')!.split(',')
  expect(busIds.length).toBeGreaterThan(0)
  expect(busIds.some(id => railIds.includes(id))).toBe(false)
  expect(element('.network-count-row').textContent).toContain('Vehicles in motion')
  await search('220', '.search-results .route-result')
  await waitFor(() => expect(element('.route-card').textContent).toContain('220'))
  expect(element('.experience').getAttribute('data-sbb-enabled')).toBe('false')
  fireEvent.click(element('.postbus-toggle'))
  expect(scene().getAttribute('data-train-count')).toBe('0')
  expect(document.querySelector('.route-card')).toBeNull()
  fireEvent.click(element('.sbb-toggle'))
  expect(scene().getAttribute('data-train-ids')!.split(',')).toEqual(railIds)
})
