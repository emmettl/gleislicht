import { useEffect, useLayoutEffect, useRef } from 'react'
import { GleislichtScene } from './GleislichtJourneyScene.tsx'
import { advanceRigiTerrainClock, rigiTerrainPosition, type RigiTerrainBinding } from './rigi-timetable-terrain.ts'

const ignoreProgress = () => {}
export default function RigiTimetableTerrain({ binding, time, isPlaying, rate, onTime, onEnd }: {
  binding: RigiTerrainBinding; time: number; isPlaying: boolean; rate: number
  onTime: (time: number) => void; onEnd: () => void
}) {
  const latest = useRef({ onTime, onEnd }), clock = useRef(time), lastPublished = useRef(time)
  useLayoutEffect(() => {
    latest.current = { onTime, onEnd }
    if (!isPlaying || time !== lastPublished.current) clock.current = time // External seeks win; acknowledgements keep sub-frame accumulation.
  }, [time, onTime, onEnd, isPlaying])
  useEffect(() => {
    if (!isPlaying) return
    let previous = performance.now(), lastReport = previous, frame = 0
    const tick = (now: number) => {
      clock.current = advanceRigiTerrainClock(clock.current, (now - previous) / 1000, rate, binding.sequence.end)
      previous = now
      if (now - lastReport >= 50 || clock.current >= binding.sequence.end) {
        lastReport = now; lastPublished.current = clock.current
        latest.current.onTime(clock.current)
      }
      if (clock.current >= binding.sequence.end) { latest.current.onEnd(); return }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, rate, binding])
  const position = rigiTerrainPosition(binding, time)
  return <div className="rigi-timetable-scene" data-progress={position.progress} data-stopped={position.stopped} style={{ width: '100%', height: '100%' }}>
    <GleislichtScene corridor={binding.corridor} isPlaying={false} progress={position.progress} onProgress={ignoreProgress} />
  </div>
}
