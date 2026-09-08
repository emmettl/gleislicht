import type { NationalRoadStudySnapshot } from '@motionstudies/core/domain/road-day'
import { nationalRoadConditionsAtTime } from './road-conditions.ts'
import { roadConditionsAtTime, trafficDensity, type RoadTrafficConditions, type RoadTrafficSnapshot } from '@motionstudies/core/domain/road'

export interface RoadTrafficSummary {
  vehicles: number
  density: number
  carriagewayKm: number
  representative: boolean
}

function usable(value: RoadTrafficConditions) {
  return [value.lightFlowPerHour, value.heavyFlowPerHour, value.lightSpeedKmh, value.heavySpeedKmh].every(v => Number.isFinite(v) && v >= 0) &&
    (value.lightFlowPerHour === 0 || value.lightSpeedKmh > 0) &&
    (value.heavyFlowPerHour === 0 || value.heavySpeedKmh > 0)
}

const density = (value: RoadTrafficConditions) =>
  trafficDensity(value.lightFlowPerHour, value.lightSpeedKmh) +
  trafficDensity(value.heavyFlowPerHour, value.heavySpeedKmh)

/** Counts and density share the same covered directional distance; missing data is not zero. */
export function roadTrafficSummary(road: string | undefined, time: number,
  national?: NationalRoadStudySnapshot, fallback?: RoadTrafficSnapshot): RoadTrafficSummary | undefined {
  let vehicles = 0
  let carriagewayKm = 0
  let representative = false
  if (national && time >= national.metadata.windowStart && time <= national.metadata.windowEnd) {
    let before: NationalRoadStudySnapshot['minutes'][number] | undefined
    for (const minute of national.minutes) {
      if (minute[0] > time) break
      before = minute
    }
    const after = national.minutes.find(minute => minute[0] >= time) ?? before
    const interval = national.metadata.sampleIntervalSeconds
    if (before && after && time - before[0] <= interval && after[0] - before[0] <= interval) {
      const sitesBefore = new Map(before[1].map(value => [value[0], value]))
      const sitesAfter = new Map(after[1].map(value => [value[0], value]))
      for (const section of national.sections) {
        if ((road !== undefined && section.road !== road) || section.distanceKm <= 0) continue
        const values = [section.fromSiteIndex, section.toSiteIndex].flatMap(index => [sitesBefore.get(index), sitesAfter.get(index)])
        if (values.some(value => !value || !usable({ lightFlowPerHour: value[1], lightSpeedKmh: value[2], heavyFlowPerHour: value[3], heavySpeedKmh: value[4] }))) continue
        const from = nationalRoadConditionsAtTime(national, section.fromSiteIndex, time)
        const to = nationalRoadConditionsAtTime(national, section.toSiteIndex, time)
        // Match the renderer's flow/speed estimate for each counter-to-counter section.
        vehicles += density({
          lightFlowPerHour: (from.lightFlowPerHour + to.lightFlowPerHour) / 2,
          lightSpeedKmh: (from.lightSpeedKmh + to.lightSpeedKmh) / 2,
          heavyFlowPerHour: (from.heavyFlowPerHour + to.heavyFlowPerHour) / 2,
          heavySpeedKmh: (from.heavySpeedKmh + to.heavySpeedKmh) / 2,
        }) * section.distanceKm
        carriagewayKm += section.distanceKm
      }
    }
  }
  if (!carriagewayKm && fallback && time >= fallback.metadata.windowStart && time <= fallback.metadata.windowEnd) {
    representative = fallback.metadata.measurementKind === 'representative-calibration'
    for (const corridor of fallback.corridors) {
      if ((road !== undefined && corridor.road.replace(/^A/, 'N') !== road) || corridor.distanceKm <= 0) continue
      for (const direction of corridor.directions) {
        if (!direction.samples.length || time < direction.samples[0][0] || time > direction.samples.at(-1)![0]) continue
        const conditions = roadConditionsAtTime(direction, time)
        if (!usable(conditions)) continue
        vehicles += density(conditions) * corridor.distanceKm
        carriagewayKm += corridor.distanceKm
      }
    }
  }
  return carriagewayKm ? { vehicles: Math.round(vehicles), density: vehicles / carriagewayKm, carriagewayKm, representative } : undefined
}
