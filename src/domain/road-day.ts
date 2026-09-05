import { trafficDensity, type RoadTrafficConditions } from './road.ts'

export type NationalRoadSiteValue = readonly [
  siteIndex: number,
  lightFlowPerHour: number,
  lightSpeedKmh: number,
  heavyFlowPerHour: number,
  heavySpeedKmh: number,
]

export interface NationalRoadSection {
  readonly id: string
  readonly road: string
  readonly direction: 'positive' | 'negative'
  readonly fromSiteIndex: number
  readonly toSiteIndex: number
  readonly distanceKm: number
}

export interface NationalRoadMinuteChunk {
  readonly windowStart: number
  readonly windowEnd: number
  readonly minutes: readonly (readonly [
    time: number,
    values: readonly NationalRoadSiteValue[],
  ])[]
}

export interface NationalRoadChunkDescriptor {
  readonly id: string
  readonly windowStart: number
  readonly windowEnd: number
  readonly path: string
  readonly minuteCount: number
  readonly valueCount: number
}

export interface NationalRoadStudyManifest {
  readonly metadata: {
    readonly publisher: string
    readonly serviceDate: string
    readonly windowStart: number
    readonly windowEnd: number
    readonly sourceUrl: string
    readonly measurementSiteTableVersion: number
    readonly measurementKind: 'recorded'
    readonly model: string
    readonly sampleIntervalSeconds: number
    readonly acceptedSites: number
    readonly sections: number
    readonly minimumSiteCoverage: number
    readonly firstMeasurementTime: string
    readonly lastMeasurementTime: string
    readonly completeMinutes: number
  }
  readonly siteIds: readonly string[]
  readonly sections: readonly NationalRoadSection[]
  readonly chunks: readonly NationalRoadChunkDescriptor[]
}

export interface NationalRoadStudySnapshot {
  readonly metadata: NationalRoadStudyManifest['metadata']
  readonly siteIds: readonly string[]
  readonly sections: readonly NationalRoadSection[]
  readonly minutes: NationalRoadMinuteChunk['minutes']
}

export function roadChunkForTime(
  manifest: NationalRoadStudyManifest,
  time: number,
): NationalRoadChunkDescriptor {
  const last = manifest.chunks.at(-1)
  const match = manifest.chunks.find(
    (chunk) =>
      time >= chunk.windowStart &&
      (time < chunk.windowEnd || (chunk === last && time <= chunk.windowEnd)),
  )
  return match ?? (time < manifest.metadata.windowStart ? manifest.chunks[0] : last)!
}

export function adjacentRoadChunks(
  manifest: NationalRoadStudyManifest,
  current: NationalRoadChunkDescriptor,
): readonly NationalRoadChunkDescriptor[] {
  const index = manifest.chunks.findIndex((chunk) => chunk.id === current.id)
  return manifest.chunks.slice(Math.max(0, index - 1), index + 2)
}

export function roadSnapshotForChunk(
  manifest: NationalRoadStudyManifest,
  chunk?: NationalRoadMinuteChunk,
): NationalRoadStudySnapshot {
  return {
    metadata: manifest.metadata,
    siteIds: manifest.siteIds,
    sections: manifest.sections,
    minutes: chunk?.minutes ?? [],
  }
}

function valueConditions(value?: NationalRoadSiteValue): RoadTrafficConditions {
  return value
    ? {
        lightFlowPerHour: value[1],
        lightSpeedKmh: value[2],
        heavyFlowPerHour: value[3],
        heavySpeedKmh: value[4],
      }
    : {
        lightFlowPerHour: 0,
        lightSpeedKmh: 0,
        heavyFlowPerHour: 0,
        heavySpeedKmh: 0,
      }
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

export function nationalRoadConditionsAtTime(
  snapshot: NationalRoadStudySnapshot,
  siteIndex: number,
  time: number,
): RoadTrafficConditions {
  const minutes = snapshot.minutes
  if (!minutes.length) return valueConditions()
  const conditionsAt = (minuteIndex: number) =>
    valueConditions(minutes[minuteIndex][1].find((value) => value[0] === siteIndex))
  if (time <= minutes[0][0]) return conditionsAt(0)
  if (time >= minutes.at(-1)![0]) return conditionsAt(minutes.length - 1)
  let high = 1
  while (high < minutes.length && minutes[high][0] < time) high += 1
  const low = high - 1
  const from = conditionsAt(low)
  const to = conditionsAt(high)
  const progress = (time - minutes[low][0]) / (minutes[high][0] - minutes[low][0])
  return {
    lightFlowPerHour: interpolate(from.lightFlowPerHour, to.lightFlowPerHour, progress),
    lightSpeedKmh: interpolate(from.lightSpeedKmh, to.lightSpeedKmh, progress),
    heavyFlowPerHour: interpolate(from.heavyFlowPerHour, to.heavyFlowPerHour, progress),
    heavySpeedKmh: interpolate(from.heavySpeedKmh, to.heavySpeedKmh, progress),
  }
}

export function reconstructedNationalVehicleCount(
  snapshot: NationalRoadStudySnapshot,
  time: number,
  road?: string,
): number {
  return Math.round(
    snapshot.sections.reduce((total, section) => {
      if (road && section.road !== road) return total
      const from = nationalRoadConditionsAtTime(snapshot, section.fromSiteIndex, time)
      const to = nationalRoadConditionsAtTime(snapshot, section.toSiteIndex, time)
      const lightFlow = (from.lightFlowPerHour + to.lightFlowPerHour) / 2
      const lightSpeed = (from.lightSpeedKmh + to.lightSpeedKmh) / 2
      const heavyFlow = (from.heavyFlowPerHour + to.heavyFlowPerHour) / 2
      const heavySpeed = (from.heavySpeedKmh + to.heavySpeedKmh) / 2
      return (
        total +
        (trafficDensity(lightFlow, lightSpeed) +
          trafficDensity(heavyFlow, heavySpeed)) *
          section.distanceKm
      )
    }, 0),
  )
}
