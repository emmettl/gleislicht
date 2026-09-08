import type { NationalRoadStudySnapshot } from '@motionstudies/core/domain/road-day'
import type { RoadTrafficSnapshot } from '@motionstudies/core/domain/road'
import { roadTrafficSummary, type RoadTrafficSummary } from './road-traffic-summary.ts'

export interface RoadHistoryPoint { time: number; summary?: RoadTrafficSummary }

/** Sample the entire window, keeping absent measurements as gaps rather than zero. */
export function roadTrafficHistory(road: string, national?: NationalRoadStudySnapshot, fallback?: RoadTrafficSnapshot): RoadHistoryPoint[] {
  const source = national ?? fallback
  if (!source) return []
  const { windowStart, windowEnd, sampleIntervalSeconds } = source.metadata
  if (!(sampleIntervalSeconds > 0)) return []
  const points: RoadHistoryPoint[] = []
  for (let time = windowStart; time <= windowEnd; time += sampleIntervalSeconds) {
    points.push({ time, summary: roadTrafficSummary(road, time, national, national ? undefined : fallback) })
  }
  return points
}

export function roadHistoryPath(points: RoadHistoryPoint[], x: (time: number) => number, y: (density: number) => number) {
  let drawing = false
  return points.map(point => {
    if (!point.summary) { drawing = false; return '' }
    const command = drawing ? 'L' : 'M'
    drawing = true
    return `${command}${x(point.time).toFixed(2)},${y(point.summary.density).toFixed(2)}`
  }).join(' ')
}
