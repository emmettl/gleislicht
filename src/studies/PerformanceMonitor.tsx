import { useLocalPerformance } from '@motionstudies/web/use-local-performance'

export default function PerformanceMonitor() {
  const performanceSample = useLocalPerformance(true)
  return (
        <aside className="performance-monitor" aria-label="Local performance monitor">
          <span>Local only · no analytics</span>
          <strong>{performanceSample ? `${performanceSample.fps} FPS` : 'measuring…'}</strong>
          <small>
            {performanceSample
              ? `${performanceSample.slowFramePercent}% slow frames`
              : '1 second sample'}
          </small>
        </aside>
  )
}
