import type { NationalRoadStudySnapshot, NationalRoadSiteValue } from '@motionstudies/core/domain/road-day'
import { trafficDensity, type RoadTrafficConditions } from '@motionstudies/core/domain/road'

type Minute = NationalRoadStudySnapshot['minutes'][number]
const EMPTY: RoadTrafficConditions = Object.freeze({ lightFlowPerHour: 0, lightSpeedKmh: 0, heavyFlowPerHour: 0, heavySpeedKmh: 0 })

/** Keep only the current bracket and frame; old chunks can be garbage collected. */
const samplers = new WeakMap<NationalRoadStudySnapshot, ReturnType<typeof createSampler>>()

function createSampler(snapshot: NationalRoadStudySnapshot) {
  let previousTime = NaN
  let lower: Minute | undefined
  let upper: Minute | undefined
  let fromValues = new Map<number, NationalRoadSiteValue>()
  let toValues = new Map<number, NationalRoadSiteValue>()
  let progress = 0
  const conditions = new Map<number, RoadTrafficConditions>()
  const index = (minute: Minute) => new Map(minute[1].map(value => [value[0], value]))

  return (site: number, time: number): RoadTrafficConditions => {
    const minutes = snapshot.minutes
    if (!minutes.length) return EMPTY
    if (time !== previousTime) {
      previousTime = time
      conditions.clear()
      let low = 0
      let high = minutes.length - 1
      while (low < high) {
        const middle = (low + high) >>> 1
        if (minutes[middle][0] < time) low = middle + 1
        else high = middle
      }
      const nextUpper = minutes[low]
      const nextLower = time >= minutes.at(-1)![0] ? nextUpper : minutes[Math.max(0, low - 1)]
      const nextFrom = nextLower === lower ? fromValues : nextLower === upper ? toValues : index(nextLower)
      const nextTo = nextUpper === upper ? toValues : nextUpper === nextLower ? nextFrom : index(nextUpper)
      lower = nextLower
      upper = nextUpper
      fromValues = nextFrom
      toValues = nextTo
      progress = lower === upper ? 0 : (time - lower[0]) / (upper[0] - lower[0])
    }
    const cached = conditions.get(site)
    if (cached) return cached
    const from = fromValues.get(site)
    const to = toValues.get(site)
    const interpolate = (column: 1 | 2 | 3 | 4) => {
      const start = from?.[column] ?? 0
      return start + ((to?.[column] ?? 0) - start) * progress
    }
    const value = {
      lightFlowPerHour: interpolate(1), lightSpeedKmh: interpolate(2),
      heavyFlowPerHour: interpolate(3), heavySpeedKmh: interpolate(4),
    }
    conditions.set(site, value)
    return value
  }
}

/** Same interpolation as the package, without scanning every site's observations per frame. */
export function nationalRoadConditionsAtTime(snapshot: NationalRoadStudySnapshot, site: number, time: number) {
  let sample = samplers.get(snapshot)
  if (!sample) {
    sample = createSampler(snapshot)
    samplers.set(snapshot, sample)
  }
  return sample(site, time)
}

export function reconstructedNationalVehicleCount(snapshot: NationalRoadStudySnapshot, time: number, road?: string) {
  let total = 0
  for (const section of snapshot.sections) {
    if (road && section.road !== road) continue
    const from = nationalRoadConditionsAtTime(snapshot, section.fromSiteIndex, time)
    const to = nationalRoadConditionsAtTime(snapshot, section.toSiteIndex, time)
    total += (trafficDensity((from.lightFlowPerHour + to.lightFlowPerHour) / 2, (from.lightSpeedKmh + to.lightSpeedKmh) / 2) +
      trafficDensity((from.heavyFlowPerHour + to.heavyFlowPerHour) / 2, (from.heavySpeedKmh + to.heavySpeedKmh) / 2)) * section.distanceKm
  }
  return Math.round(total)
}
