import { useEffect, useState } from 'react'

export interface LocalPerformanceSample {
  readonly fps: number
  readonly slowFramePercent: number
}

export function useLocalPerformance(enabled: boolean): LocalPerformanceSample | undefined {
  const [sample, setSample] = useState<LocalPerformanceSample>()

  useEffect(() => {
    if (!enabled) return
    let animationFrame = 0
    let frames = 0
    let slowFrames = 0
    let previous = performance.now()
    let windowStart = previous

    const measure = (now: number) => {
      const frameDuration = now - previous
      previous = now
      frames += 1
      if (frameDuration > 34) slowFrames += 1
      const elapsed = now - windowStart
      if (elapsed >= 1_000) {
        setSample({
          fps: Math.round((frames * 1_000) / elapsed),
          slowFramePercent: Math.round((slowFrames / frames) * 100),
        })
        frames = 0
        slowFrames = 0
        windowStart = now
      }
      animationFrame = requestAnimationFrame(measure)
    }

    animationFrame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(animationFrame)
  }, [enabled])

  return sample
}
