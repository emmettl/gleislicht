import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { postbusTickFollowsSeek } from './postbus.ts'

interface PlaybackOptions {
  source: string
  enabled: boolean
  ready: boolean
  playing: boolean
  rate: number
  onTime: (time: number) => void
}

/** Local clock handoff for regional and PostBus chunks.
 * Loading only gates scene playback; it never changes the user's playback intent.
 * An old scene callback cannot undo a seek, a pause or a source change.
 */
export function useChunkedPlayback({ source, enabled, ready, playing, rate, onTime }: PlaybackOptions) {
  const owner = useMemo(() => ({ source }), [source])
  const pendingSeek = useRef<{ owner: typeof owner; time: number; at: number } | undefined>(undefined)
  const current = useRef<{ owner: typeof owner; enabled: boolean; ready: boolean; playing: boolean; rate: number; onTime: typeof onTime } | null>(null)
  useLayoutEffect(() => {
    current.current = { owner, enabled, ready, playing, rate, onTime }
    return () => { current.current = null }
  }, [owner, enabled, ready, playing, rate, onTime])
  const seek = useCallback((time: number) => {
    const state = current.current
    if (!state || state.owner !== owner) return
    pendingSeek.current = state.enabled ? { owner, time, at: performance.now() } : undefined
    state.onTime(time)
  }, [owner])
  const tick = useCallback((time: number) => {
    const state = current.current
    if (!state || state.owner !== owner || !state.enabled || !state.ready || !state.playing) return
    const pending = pendingSeek.current?.owner === owner ? pendingSeek.current : undefined
    if (pending && !postbusTickFollowsSeek(time, pending.time, (performance.now() - pending.at) / 1000, state.rate)) return
    pendingSeek.current = undefined
    state.onTime(time)
  }, [owner])
  const reset = useCallback(() => {
    if (current.current?.owner === owner) pendingSeek.current = undefined
  }, [owner])
  return { seek, tick, reset, canPlay: playing && (!enabled || ready) }
}
