// @vitest-environment jsdom
import './dom.ts'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { mountApp, clock, seek, element, search, share } from './app-harness.tsx'
import { deferred, fixture, fixtureFetch } from './fixtures.ts'

const journeys = [
  { id: 'gornergrat', start: /Follow Zermatt to Gornergrat/, card: '.gornergrat-ascent', time: 43200, stop: 'Riffelalp', stopTime: 44100, end: 45180, descent: 42900, choices: 26, outdoor: 45000 },
  { id: 'pilatus', start: /Follow the Pilatus railway/, card: '.pilatus-journey', time: 44100, stop: 'Ämsigen', stopTime: 44700, end: 45720, descent: 44040, choices: 17, outdoor: 44620 },
  { id: 'rochers', start: /Follow Montreux to Rochers-de-Naye/, card: '.rochers-journey', time: 41640, stop: 'Caux', stopTime: 42960, end: 44520, descent: 44820, choices: 10, outdoor: 43000 },
  { id: 'territet', start: /Follow the Territet–Glion funicular/, card: '.territet-journey', time: 43440, stop: 'Collonge (funi)', stopTime: 43500, end: 43800, descent: 43440, choices: 70, outdoor: 43500 },
] as const

async function openJourney(j: typeof journeys[number]) {
  fireEvent.click(await screen.findByRole('button', { name: j.start }))
  await waitFor(() => { expect(element(j.card)).toBeTruthy(); expect(clock().value).toBe(String(j.time)) })
  return within(element(j.card))
}
it.each(journeys)('$id follows actual calls, stops on arrival, replays, changes direction and exits', async j => {
  fixtureFetch(); mountApp(`?study=${j.id}`)
  const card = await openJourney(j)
  expect(card.getByRole('combobox', { name: 'Choose a departure' }).querySelectorAll('option')).toHaveLength(j.choices)
  fireEvent.click(within(element(`${j.card} nav`)).getByText(j.stop, { exact: j.id !== 'pilatus' }))
  expect(clock().value).toBe(String(j.stopTime))
  expect(element(`${j.card} [aria-current="step"]`).textContent).toContain(j.stop)
  seek(j.end)
  await waitFor(() => expect(element(j.card).getAttribute('data-phase')).toBe('complete'))
  expect(screen.getAllByRole('button', { name: /Resume motion/ }).length).toBeGreaterThan(0)
  fireEvent.click(card.getByRole('button', { name: /Replay/ }))
  expect(clock().value).toBe(String(j.time))
  fireEvent.change(card.getByRole('combobox', { name: 'Direction' }), { target: { value: 'descent' } })
  expect(clock().value).toBe(String(j.descent))
  expect(element(j.card).getAttribute('data-direction')).toBe('descent')
  const choices = card.getByRole('combobox', { name: 'Choose a departure' }) as HTMLSelectElement
  fireEvent.change(choices, { target: { value: choices.options[0].value } })
  expect(clock().value).not.toBe(String(j.descent))
  fireEvent.click(card.getByRole('button', { name: /Exit/ }))
  expect(document.querySelector(j.card)).toBeNull()
})

for (const failure of ['http', 'null', 'unreviewed'] as const) {
  it.each(journeys)(`$id rejects ${failure} terrain then retries on the same clock`, async j => {
    const { overrides, requests } = fixtureFetch(), file = `${j.id}-ascent-terrain.json`
    const data = fixture<{ routes: { reverseTripIds?: string[] }[]; contextTracks: unknown[] }>(file)
    overrides.set(file, () => {
      if (failure === 'http') return new Response('', { status: 503 })
      if (failure === 'null') return Response.json(null)
      if (j.id === 'territet') data.contextTracks.pop()
      else delete data.routes[0].reverseTripIds
      return Response.json(data)
    })
    mountApp(`?study=${j.id}`)
    const card = await openJourney(j)
    if (failure === 'unreviewed' && j.id !== 'territet') fireEvent.change(card.getByRole('combobox', { name: 'Direction' }), { target: { value: 'descent' } })
    const time = failure === 'unreviewed' && j.id !== 'territet' ? j.descent : j.outdoor
    seek(time)
    expect(requests).not.toContain(file)
    fireEvent.click(card.getByRole('button', { name: 'Follow in measured terrain' }))
    await waitFor(() => expect(element(`${j.card} [data-terrain-status]`).getAttribute('data-terrain-status')).toBe('error'))
    expect(clock().value).toBe(String(time))
    overrides.delete(file)
    fireEvent.click(card.getByRole('button', { name: 'Retry terrain' }))
    await waitFor(() => expect(element(`${j.card} [data-terrain-status]`).getAttribute('data-terrain-status')).not.toMatch(/error|loading/))
    expect(clock().value).toBe(String(time))
    fireEvent.click(card.getByRole('button', { name: 'Return to map' }))
    expect(clock().value).toBe(String(time))
  })
}

it.each([...journeys.map(j => j.id), 'jungfrau'])('%s retries a missing timetable without replacing the linked study', async id => {
  const { overrides } = fixtureFetch(), file = `${id === 'rigi-lake' ? 'rigi' : id}-day.json`
  overrides.set(file, () => new Response('', { status: 503 }))
  mountApp(`?study=${id}&time=43200&date=2026-09-04`)
  const retry = await screen.findByRole('button', { name: 'Retry' })
  overrides.delete(file); fireEvent.click(retry)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull())
  expect(clock().value).toBe('43200')
})

it('Glion preserves its exact downhill share and exits on railway station selection', async () => {
  fixtureFetch()
  const app = mountApp('?study=territet&date=2026-09-04&time=47400&glion=.ojp-91-37-F.1.TA.89.j26')
  await waitFor(() => expect(element('.glion-journey').getAttribute('data-phase')).toBe('interchange'))
  expect(clock().value).toBe('47400')
  await waitFor(() => expect(screen.getByTestId('map-scene').getAttribute('data-train-count')).toBe('2'))
  const url = await share()
  expect(new URL(url).searchParams.get('glion')).toBe('.ojp-91-37-F.1.TA.89.j26')
  app.unmount(); mountApp(new URL(url).search)
  await waitFor(() => expect(element('.glion-journey').getAttribute('data-phase')).toBe('interchange'))
  await search('Caux', '.search-results .station-result')
  await waitFor(() => expect(document.querySelector('.glion-journey')).toBeNull())
  expect(element('.station-card').textContent).toContain('Caux')
})

it('Glion rejects failed and wrong-date source responses before accepting a retry', async () => {
  const { overrides } = fixtureFetch(), file = 'rochers-day.json'
  overrides.set(file, () => new Response('', { status: 503 }))
  mountApp('?study=territet&date=2026-09-04')
  fireEvent.click(await screen.findByRole('button', { name: /Continue to Rochers-de-Naye/ }))
  const retry = await screen.findByRole('button', { name: 'Retry connection' })
  const data = fixture<{ metadata: { serviceDate: string } }>(file)
  data.metadata.serviceDate = '2026-09-05'
  overrides.set(file, () => Response.json(data)); fireEvent.click(retry)
  await waitFor(() => expect(element('.glion-journey').getAttribute('data-phase')).toBe('unavailable'))
  expect(document.querySelector('.glion-journey nav')).toBeNull()
  overrides.delete(file); fireEvent.click(screen.getByRole('button', { name: 'Retry connection' }))
  await waitFor(() => expect(element('.glion-journey').getAttribute('data-phase')).toBe('first-leg'))
})

it('leaving a pending recording rejects its response even when the transport ignores abort', async () => {
  const { overrides } = fixtureFetch(), pending = deferred<Response>()
  overrides.set('zurich-cantonal-road-pilot.json', () => pending.promise)
  mountApp('?recording=horgen-2026-09-08')
  await screen.findByText('Loading pilot…')
  await search('Bassersdorf', '.search-results .road-result')
  await act(async () => { pending.resolve(Response.json(fixture('zurich-cantonal-road-pilot.json'))); await pending.promise })
  expect(screen.getByRole('button', { name: 'Play Wallisellen–Bassersdorf recording' })).toBeTruthy()
  expect(clock().min).toBe('24300')
})

it('Jungfrau guide enters the three-leg ascent, preserves waits and exits on manual selection', async () => {
  fixtureFetch(); mountApp('?study=jungfrau&date=2026-09-04&time=43200')
  fireEvent.click(await screen.findByRole('button', { name: /Three approaches to Jungfraujoch/ }))
  const guide = await screen.findByRole('dialog')
  expect(guide.querySelectorAll('[data-approach]')).toHaveLength(3)
  fireEvent.click(within(guide).getByRole('button', { name: /Follow the ascent via Wengen/ }))
  await waitFor(() => expect(element('.jungfrau-ascent').getAttribute('data-phase')).toBe('leg-0'))
  expect(clock().value).toBe('43440')
  for (const [time, phase] of [[44760, 'wait-0'], [46800, 'leg-1'], [50280, 'leg-2'], [52860, 'complete']] as const) {
    seek(time); expect(element('.jungfrau-ascent').getAttribute('data-phase')).toBe(phase)
  }
  fireEvent.click(screen.getByRole('button', { name: /Replay ascent/ }))
  expect(clock().value).toBe('43440')
  await search('Eiger Express', '.search-results .result-service b')
  await waitFor(() => expect(document.querySelector('.jungfrau-ascent')).toBeNull())
  expect(element('.selected-card').textContent).toContain('not tracked cabins')
})
