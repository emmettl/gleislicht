// @vitest-environment jsdom
import './dom.ts'
import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useChunkedPlayback } from '../studies/use-chunked-playback.ts'

const defaults = { source: 'geneva:day', enabled: true, ready: true, playing: true, rate: 120 }
it('holds a seek against queued frames until the scene adopts it', () => {
  const onTime = vi.fn()
  const { result } = renderHook(() => useChunkedPlayback({ ...defaults, onTime }))
  act(() => result.current.seek(62100))
  act(() => result.current.tick(27900))
  expect(onTime.mock.calls).toEqual([[62100]])
  act(() => result.current.tick(62101))
  expect(onTime.mock.calls).toEqual([[62100], [62101]])
})
it('does not let chunk readiness resume a user pause, including queued callbacks', () => {
  const onTime = vi.fn()
  const { result, rerender } = renderHook(props => useChunkedPlayback({ ...props, onTime }), { initialProps: { ...defaults, ready: false } })
  const queuedTick = result.current.tick
  act(() => result.current.seek(62100))
  expect(result.current.canPlay).toBe(false)
  rerender({ ...defaults, ready: false, playing: false })
  rerender({ ...defaults, ready: true, playing: false })
  act(() => queuedTick(62101))
  expect(result.current.canPlay).toBe(false)
  expect(onTime.mock.calls).toEqual([[62100]])
  rerender({ ...defaults })
  act(() => result.current.tick(62101))
  expect(result.current.canPlay).toBe(true)
  expect(onTime.mock.calls).toEqual([[62100], [62101]])
})
it('rejects ticks while loading and uses the latest seek after multiple pending seeks', () => {
  const onTime = vi.fn()
  const { result, rerender } = renderHook(props => useChunkedPlayback({ ...props, onTime }), { initialProps: { ...defaults, ready: false } })
  act(() => { result.current.seek(62100); result.current.seek(7200); result.current.tick(7201) })
  expect(onTime.mock.calls).toEqual([[62100], [7200]])
  rerender({ ...defaults })
  act(() => { result.current.tick(62101); result.current.tick(7201) })
  expect(onTime.mock.calls).toEqual([[62100], [7200], [7201]])
})
it('rejects old-source commands after switching away and back', () => {
  const onTime = vi.fn()
  const { result, rerender } = renderHook(props => useChunkedPlayback({ ...props, onTime }), { initialProps: defaults })
  const obsolete = result.current
  rerender({ ...defaults, source: 'zurich:day' })
  rerender({ ...defaults })
  act(() => { obsolete.seek(123); obsolete.tick(124); result.current.tick(27901) })
  expect(onTime.mock.calls).toEqual([[27901]])
})
it('uses the latest rate, accepts midnight wrap, and stops after unmount', () => {
  const onTime = vi.fn()
  const { result, rerender, unmount } = renderHook(props => useChunkedPlayback({ ...props, onTime }), { initialProps: defaults })
  act(() => result.current.seek(86399))
  rerender({ ...defaults, rate: 1 })
  act(() => { result.current.tick(100); result.current.tick(0) })
  expect(onTime.mock.calls).toEqual([[86399], [0]])
  const queued = result.current
  unmount()
  act(() => { queued.seek(500); queued.tick(501) })
  expect(onTime).toHaveBeenCalledTimes(2)
})
