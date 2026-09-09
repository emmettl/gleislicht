// @vitest-environment jsdom
import './dom.ts'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useUiLanguage } from '../use-ui-language.ts'
import { ORBITAL_COPY } from '../studies/orbital-copy.ts'
import OrbitalView from '../studies/OrbitalView.tsx'
import { mountApp, element } from './app-harness.tsx'
import { fixtureFetch } from './fixtures.ts'
import { EXPLORE_COPY } from '../studies/explore-copy.ts'
import { loadUiText } from '../use-ui-text.ts'

// Exercise the actual controls and loaders without requiring a GPU.
vi.mock('@react-three/fiber', () => ({ Canvas: () => null }))
vi.mock('../studies/OrbitalScene.tsx', () => ({ default: () => null }))

it.each(['en', 'de', 'fr', 'it'] as const)('localizes orbital controls, notes and failures in %s', async language => {
  localStorage.setItem('gleislicht-language', language)
  await loadUiText(language)
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Raw internal fetch failure')))
  render(<OrbitalView />)
  const copy = ORBITAL_COPY[language]
  await screen.findByText(copy.dataError)
  expect(document.documentElement.lang).toBe(language)
  expect(document.title).toBe(copy.pageTitle)
  expect(screen.getByRole('slider', { name: copy.snowlineAltitude }).getAttribute('aria-valuetext')).toContain('2')
  expect(screen.getByRole('button', { name: copy.returnOrbit })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: copy.about }))
  expect(screen.getByText(copy.aboutTitle)).toBeTruthy()
  expect(screen.getByText(copy.aboutSnow)).toBeTruthy()
  expect(screen.queryByText('Raw internal fetch failure')).toBeNull()
  expect(document.body.textContent).not.toMatch(/\{(?:height|mode|journeys|studies|spacing)\}/)
})

it('follows the shared atlas language without an orbital language selector', async () => {
  await loadUiText('fr')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')))
  const otherView = renderHook(() => useUiLanguage())
  render(<OrbitalView />)
  await screen.findByText(ORBITAL_COPY.en.dataError)
  expect(document.querySelector('.language-picker')).toBeNull()
  act(() => otherView.result.current[1]('fr'))
  await screen.findByText(ORBITAL_COPY.fr.dataError)
  expect(screen.queryByText(ORBITAL_COPY.en.dataError)).toBeNull()
  expect(otherView.result.current[0]).toBe('fr')
  expect(localStorage.getItem('gleislicht-language')).toBe('fr')
  expect(document.documentElement.lang).toBe('fr')
})

it('keeps a selected language for newly mounted views when browser storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
  const first = renderHook(() => useUiLanguage('blocked-language-test'))
  act(() => first.result.current[1]('it'))
  const second = renderHook(() => useUiLanguage('blocked-language-test'))
  expect(second.result.current[0]).toBe('it')
  act(() => second.result.current[1]('de'))
  expect(first.result.current[0]).toBe('de')
})

it('retranslates a loaded study notice, title, controls and study browser', async () => {
  fixtureFetch()
  mountApp('?study=ticino-region&date=2020-01-01')
  await screen.findByText(EXPLORE_COPY.en.dateMismatch)
  for (const language of ['de', 'fr', 'it', 'en'] as const) {
    fireEvent.click(within(element('.masthead .language-picker')).getByRole('button', { name: language.toUpperCase() }))
    await screen.findByText(EXPLORE_COPY[language].dateMismatch)
    const text = await loadUiText(language)
    await waitFor(() => expect(document.documentElement.lang).toBe(language))
    expect((await screen.findAllByRole('button', { name: new RegExp(text.pauseMotion) })).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: EXPLORE_COPY[language].browse }))
    const dialog = await screen.findByRole('dialog', { name: EXPLORE_COPY[language].browse })
    expect(within(dialog).getByText(EXPLORE_COPY[language].experiment)).toBeTruthy()
    expect(within(dialog).getByText(EXPLORE_COPY[language].descriptions[0])).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(EXPLORE_COPY[language].close) }))
  }
})
