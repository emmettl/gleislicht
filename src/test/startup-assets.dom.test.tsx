// @vitest-environment jsdom
import './dom.ts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useStartupAssets } from '../studies/use-startup-assets.ts'

const data = { nationalMorning: 'rail.json', boundary: 'boundary.json', water: 'water.json' }
afterEach(() => vi.unstubAllGlobals())
it('loads the three eager assets independently without controlling playback', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ source: url }))))
  const { result } = renderHook(() => useStartupAssets(data))
  await waitFor(() => expect(result.current.lakes).toBeDefined())
  expect(result.current.nationalNetwork).toBeDefined()
  expect(result.current.boundary).toBeDefined()
  expect(result.current.dataError).toBe(false)
  expect(fetch).toHaveBeenCalledTimes(3)
})
it('treats rail failure as blocking but map failures as optional', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
  const { result } = renderHook(() => useStartupAssets(data))
  await waitFor(() => expect(result.current.dataError).toBe(true))
  await waitFor(() => expect(warning).toHaveBeenCalledTimes(2))
  warning.mockRestore()
})
it('ignores obsolete successes and errors even when transport ignores cancellation', async () => {
  const pending: { resolve: (response: Response) => void; signal: AbortSignal }[] = []
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise<Response>(resolve => {
    pending.push({ resolve, signal: options.signal as AbortSignal })
  })))
  const { result, rerender, unmount } = renderHook(({ source }) => useStartupAssets(source), { initialProps: { source: data } })
  rerender({ source: { ...data, nationalMorning: 'new-rail.json' } })
  expect(pending.slice(0, 3).every(request => request.signal.aborted)).toBe(true)
  await act(async () => { pending.slice(3).forEach(request => request.resolve(new Response('{"current":true}'))) })
  await waitFor(() => expect(result.current.nationalNetwork).toEqual({ current: true }))
  await act(async () => {
    pending[0].resolve(new Response('', { status: 500 }))
    pending[1].resolve(new Response('{"obsolete":true}'))
    pending[2].resolve(new Response('{"obsolete":true}'))
  })
  expect(result.current.dataError).toBe(false)
  expect(result.current.boundary).toEqual({ current: true })
  expect(result.current.lakes).toEqual({ current: true })
  unmount()
  expect(pending.every(request => request.signal.aborted)).toBe(true)
})

it('keeps rail usable when optional map assets fail', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/rail.json')
    ? new Response('{"rail":true}') : new Response('', { status: 503 })))
  const { result } = renderHook(() => useStartupAssets(data))
  await waitFor(() => expect(warning).toHaveBeenCalledTimes(2))
  expect(result.current.nationalNetwork).toEqual({ rail: true })
  expect(result.current.dataError).toBe(false)
  expect(result.current.boundary).toBeUndefined()
  expect(result.current.lakes).toBeUndefined()
  warning.mockRestore()
})
