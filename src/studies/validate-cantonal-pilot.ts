import { cantonalPilotForRoad, type CantonalPilot } from './cantonal-road-pilot.ts'

export function validateCantonalPilot(value: CantonalPilot, expected = cantonalPilotForRoad(value?.metadata?.road)): CantonalPilot {
  if (value?.metadata?.schemaVersion !== 1 || value.metadata.recordingScope !== 'zurich-cantonal' || !expected || value.metadata.road !== expected.road || value.metadata.recordingId !== expected.id || value.metadata.serviceDate !== expected.serviceDate || value.metadata.windowStart !== expected.windowStart || value.metadata.windowEnd !== expected.windowEnd || value.metadata.completeMinutes !== expected.completeMinutes || !Array.isArray(value.windows) || !value.windows.length || !Array.isArray(value.gaps) || !value.topology?.sections?.length) throw new Error('Invalid cantonal pilot identity or coverage')
  const { windowStart, windowEnd, serviceDate } = value.metadata
  const minuteAligned = (time: number) => Number.isInteger(time) && time >= 0 && time < 86400 && time % 60 === 0
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || !minuteAligned(windowStart) || !minuteAligned(windowEnd) || windowEnd <= windowStart) throw new Error('Invalid pilot bounds')
  const sites = new Set(value.topology.sites.map(s => s.id))
  if (sites.size !== 4 || sites.size !== value.topology.sites.length || value.topology.sites.some(s => !expected.stationIds.includes(s.stationId) || !s.id.startsWith(`${s.stationId}:`)) || value.topology.sections.length !== 2 || new Set(value.topology.sections.map(s => s.direction)).size !== 2 || value.topology.sections.some(s => s.road !== value.metadata.road || !sites.has(s.fromSiteId) || !sites.has(s.toSiteId))) throw new Error('Invalid pilot sites')
  let end = -Infinity
  const recorded = new Set<number>()
  for (const window of value.windows) {
    if (window.metadata.serviceDate !== value.metadata.serviceDate || window.metadata.measurementKind !== 'recorded' || window.metadata.windowStart <= end || window.metadata.windowStart < value.metadata.windowStart || window.metadata.windowEnd > value.metadata.windowEnd || window.minutes.length < 2 || window.minutes[0][0] !== window.metadata.windowStart || window.minutes.at(-1)![0] !== window.metadata.windowEnd || window.siteIds.some(id => !sites.has(id))) throw new Error('Invalid pilot window')
    if (window.minutes.some(([time, values], i) => (i > 0 && time - window.minutes[i-1][0] !== 60) || values.length !== window.siteIds.length || new Set(values.map(v => v[0])).size !== values.length || values.some(v => v.length !== 5 || v.some(n => !Number.isFinite(n) || n < 0) || v[0] >= window.siteIds.length || (v[1] > 0 && v[2] <= 0) || (v[3] > 0 && v[4] <= 0)))) throw new Error('Incomplete pilot observations')
    if (new Set(window.siteIds).size !== sites.size || window.sections.length !== value.topology.sections.length || value.topology.sections.some(section => !window.sections.some(s => s.id === section.id && s.road === section.road && s.direction === section.direction && s.distanceKm === section.distanceKm && window.siteIds[s.fromSiteIndex] === section.fromSiteId && window.siteIds[s.toSiteIndex] === section.toSiteId))) throw new Error('Invalid pilot section mapping')
    for (const [time, values] of window.minutes) {
      if (!minuteAligned(time) || values.some(v => !Number.isInteger(v[0]))) throw new Error('Invalid pilot minute')
      recorded.add(time)
    }
    end = window.metadata.windowEnd
  }
  const missing = new Set<number>()
  let gapEnd = -Infinity
  for (const gap of value.gaps) {
    if (!minuteAligned(gap.start) || !minuteAligned(gap.end) || gap.start <= gapEnd || gap.start < windowStart || gap.end > windowEnd || gap.end < gap.start) throw new Error('Invalid pilot gap')
    for (let time = gap.start; time <= gap.end; time += 60) {
      if (recorded.has(time)) throw new Error('Pilot gap overlaps observations')
      missing.add(time)
    }
    gapEnd = gap.end
  }
  if (recorded.size !== value.metadata.completeMinutes || recorded.size + missing.size !== (windowEnd - windowStart) / 60 + 1) throw new Error('Incomplete pilot coverage')
  return value
}
