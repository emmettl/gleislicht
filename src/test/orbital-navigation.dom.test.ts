// @vitest-environment jsdom
import './dom.ts'
import { expect, it, vi } from 'vitest'
import { observeFooter, observeMasthead } from '../studies/masthead-layout.ts'
import { animateOrbitalFlight } from '../studies/orbital-flight-animation.ts'
import { orbitalFlight } from '../studies/orbital-flight.ts'

it('updates mobile panel clearance when translated headings or search controls resize', () => {
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  const cancel = vi.fn()
  vi.stubGlobal('cancelAnimationFrame', cancel)
  let resize!: () => void
  const observe = vi.fn(), disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe = observe; disconnect = disconnect })
  const shell = document.createElement('main')
  shell.innerHTML = '<header></header><section class="train-search"></section>'
  document.body.append(shell)
  const header = shell.querySelector('header')!, search = shell.querySelector<HTMLElement>('section')!
  let headerHeight = 110, searchHeight = 90
  Object.defineProperty(header, 'clientHeight', { get: () => headerHeight })
  Object.defineProperty(search, 'offsetHeight', { get: () => searchHeight })
  const cleanup = observeMasthead(header)
  expect(observe.mock.calls.flat()).toEqual([header, search])
  expect(shell.style.getPropertyValue('--masthead-clearance')).toBe('126px')
  expect(shell.style.getPropertyValue('--search-height')).toBe('90px')
  headerHeight = 150; searchHeight = 100; resize(); resize()
  expect(frames).toHaveLength(1)
  expect(shell.style.getPropertyValue('--masthead-clearance')).toBe('126px')
  frames.shift()!(performance.now())
  expect(shell.style.getPropertyValue('--masthead-clearance')).toBe('166px')
  expect(shell.style.getPropertyValue('--search-height')).toBe('100px')
  resize()
  cleanup?.()
  expect(cancel).toHaveBeenCalled()
  expect(disconnect).toHaveBeenCalledOnce()
  expect(shell.style.length).toBe(0)
  shell.remove()
})

it('refreshes playback clearance when wrapping credits move controls without resizing them', () => {
  let resize!: () => void
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const shell = document.createElement('main')
  shell.innerHTML = '<section class="transport"></section><footer></footer>'
  document.body.append(shell)
  const footer = shell.querySelector('footer')!, controls = shell.querySelector('section')!
  let footerHeight = 16
  Object.defineProperty(footer, 'offsetHeight', { get: () => footerHeight })
  Object.defineProperty(controls, 'offsetHeight', { value: 172 })
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => ({
    bottom: element === footer ? '8px' : `${Math.max(42, Number.parseFloat(shell.style.getPropertyValue('--footer-clearance')) || 0)}px`,
  }) as CSSStyleDeclaration)
  const cleanup = observeFooter(footer)
  expect(shell.style.getPropertyValue('--playback-clearance')).toBe('226px')
  footerHeight = 31; resize(); frames.shift()!(performance.now())
  expect(shell.style.getPropertyValue('--footer-clearance')).toBe('47px')
  expect(shell.style.getPropertyValue('--playback-clearance')).toBe('231px')
  cleanup?.(); shell.remove()
})

it.each([true, false])('restores navigation focus only for keyboard activation (%s)', restoreFocus => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const atlas = document.createElement('div'), orbit = document.createElement('div')
  atlas.innerHTML = '<a class="masthead-orbital" href="?view=orbital">Orbit</a>'
  orbit.innerHTML = '<a class="orbital-back" href="?">Back</a>'
  document.body.append(atlas, orbit)
  const entry = atlas.querySelector('a')!, back = orbit.querySelector('a')!
  const entryFocus = vi.spyOn(entry, 'focus'), backFocus = vi.spyOn(back, 'focus')
  for (const departing of [true, false]) {
    animateOrbitalFlight({ departing, saved: null, orbit, atlas, focus: entry, title: 'Gleislicht', restoreFocus })
    while (frames.length) frames.shift()!(performance.now())
    expect(orbitalFlight.phase).toBe(departing ? 'orbital' : 'atlas')
  }
  expect(entryFocus).toHaveBeenCalledTimes(restoreFocus ? 1 : 0)
  expect(backFocus).toHaveBeenCalledTimes(restoreFocus ? 1 : 0)
  atlas.remove(); orbit.remove()
})
