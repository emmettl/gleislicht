export type RoadTrafficSample = readonly [
  time: number,
  lightFlowPerHour: number,
  lightSpeedKmh: number,
  heavyFlowPerHour: number,
  heavySpeedKmh: number,
]

export interface RoadTrafficDirection {
  readonly id: string
  readonly label: string
  readonly reverse: boolean
  readonly detectorIds: readonly string[]
  readonly samples: readonly RoadTrafficSample[]
}

export interface RoadTrafficCorridor {
  readonly id: string
  readonly name: string
  readonly road: string
  readonly distanceKm: number
  readonly path: readonly (readonly [longitude: number, latitude: number])[]
  readonly directions: readonly RoadTrafficDirection[]
}

export interface RoadTrafficSnapshot {
  readonly metadata: {
    readonly publisher: string
    readonly serviceDate: string
    readonly windowStart: number
    readonly windowEnd: number
    readonly sourceUrl: string
    readonly measurementSiteUrl: string
    readonly measurementSiteTableVersion: number
    readonly measurementSitePublishedAt: string
    readonly measurementKind: 'representative-calibration' | 'recorded'
    readonly model: string
    readonly note: string
    readonly sampleIntervalSeconds: number
    readonly visualSampleRate: number
    readonly recording?: {
      readonly firstMeasurementTime: string
      readonly lastMeasurementTime: string
      readonly completeMinutes: number
      readonly minimumDirectionCoverage: number
    }
  }
  readonly corridors: readonly RoadTrafficCorridor[]
}

export interface RoadTopologyPath {
  readonly id: string
  readonly road: string
  readonly axisName: string
  readonly position: string
  readonly mainline: boolean
  readonly points: readonly (readonly [longitude: number, latitude: number])[]
}

export interface RoadTopologySite {
  readonly id: string
  readonly stationId: string
  readonly direction: 'positive' | 'negative'
  readonly detectorIds: readonly string[]
  readonly carriageways: readonly string[]
  readonly coordinate: readonly [longitude: number, latitude: number]
  readonly match: {
    readonly confidence: 'high' | 'continuity' | 'review' | 'unmatched'
    readonly method?: 'neighbouring-counters'
    readonly distanceMetres?: number
    readonly road?: string
    readonly axisName?: string
    readonly axisPosition?: string
    readonly segmentId?: string
    readonly mainline?: boolean
    readonly projectedCoordinate?: readonly [longitude: number, latitude: number]
    readonly competingRoad?: string
    readonly competingDistanceMetres?: number
  }
}

export interface RoadTopologyRoad {
  readonly id: string
  readonly label: string
  readonly officialLabel: string
  readonly description?: string
  readonly bounds: {
    readonly minLongitude: number
    readonly maxLongitude: number
    readonly minLatitude: number
    readonly maxLatitude: number
  }
  readonly focus: readonly [longitude: number, latitude: number]
  readonly cameraScale: number
  readonly pathCount: number
  readonly stationCount: number
  readonly directionalSiteCount: number
  readonly sectionCount: number
}

export interface RoadTopologySection {
  readonly id: string
  readonly road: string
  readonly direction: 'positive' | 'negative'
  readonly fromSiteId: string
  readonly toSiteId: string
  readonly fromCoordinate: readonly [longitude: number, latitude: number]
  readonly toCoordinate: readonly [longitude: number, latitude: number]
  readonly distanceKm: number
}

export interface RoadTopologySnapshot {
  readonly metadata: {
    readonly publisher: string
    readonly sourceUrl: string
    readonly sourceAsset: string
    readonly sourceCrs: string
    readonly sourceDate: string
    readonly sourceUpdated: string
    readonly measurementSiteUrl: string
    readonly measurementSiteTableVersion: number
    readonly measurementSitePublishedAt: string
    readonly model: string
    readonly coverage: {
      readonly federalStations: number
      readonly federalDetectorRecords: number
      readonly usableDirectionalGroups: number
      readonly matchedDirectionalGroups: number
      readonly highConfidenceDirectionalGroups: number
      readonly continuityResolvedDirectionalGroups: number
      readonly reviewDirectionalGroups: number
      readonly unmatchedDirectionalGroups: number
      readonly matchedStations: number
      readonly medianMatchDistanceMetres: number
      readonly p95MatchDistanceMetres: number
      readonly roads: number
      readonly axisSegments: number
    }
  }
  readonly roads: readonly RoadTopologyRoad[]
  readonly paths: readonly RoadTopologyPath[]
  readonly sections: readonly RoadTopologySection[]
  readonly sites: readonly RoadTopologySite[]
}

export interface RoadTrafficConditions {
  readonly lightFlowPerHour: number
  readonly lightSpeedKmh: number
  readonly heavyFlowPerHour: number
  readonly heavySpeedKmh: number
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

export function roadConditionsAtTime(
  direction: RoadTrafficDirection,
  time: number,
): RoadTrafficConditions {
  const samples = direction.samples
  if (!samples.length) {
    return {
      lightFlowPerHour: 0,
      lightSpeedKmh: 0,
      heavyFlowPerHour: 0,
      heavySpeedKmh: 0,
    }
  }
  if (time <= samples[0][0]) {
    const [, lightFlowPerHour, lightSpeedKmh, heavyFlowPerHour, heavySpeedKmh] =
      samples[0]
    return { lightFlowPerHour, lightSpeedKmh, heavyFlowPerHour, heavySpeedKmh }
  }
  if (time >= samples[samples.length - 1][0]) {
    const [, lightFlowPerHour, lightSpeedKmh, heavyFlowPerHour, heavySpeedKmh] =
      samples[samples.length - 1]
    return { lightFlowPerHour, lightSpeedKmh, heavyFlowPerHour, heavySpeedKmh }
  }

  let low = 1
  let high = samples.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (samples[middle][0] < time) low = middle + 1
    else high = middle
  }
  const from = samples[low - 1]
  const to = samples[low]
  const progress = (time - from[0]) / (to[0] - from[0])
  return {
    lightFlowPerHour: interpolate(from[1], to[1], progress),
    lightSpeedKmh: interpolate(from[2], to[2], progress),
    heavyFlowPerHour: interpolate(from[3], to[3], progress),
    heavySpeedKmh: interpolate(from[4], to[4], progress),
  }
}

export function trafficDensity(
  flowPerHour: number,
  speedKmh: number,
): number {
  return speedKmh > 0 ? Math.max(0, flowPerHour) / speedKmh : 0
}

export function reconstructedVehicleCount(
  snapshot: RoadTrafficSnapshot,
  time: number,
): number {
  return Math.round(
    snapshot.corridors.reduce(
      (total, corridor) =>
        total +
        corridor.directions.reduce((directionTotal, direction) => {
          const conditions = roadConditionsAtTime(direction, time)
          return (
            directionTotal +
            (trafficDensity(
              conditions.lightFlowPerHour,
              conditions.lightSpeedKmh,
            ) +
              trafficDensity(
                conditions.heavyFlowPerHour,
                conditions.heavySpeedKmh,
              )) *
              corridor.distanceKm
          )
        }, 0),
      0,
    ),
  )
}

export function visualVehicleCount(
  flowPerHour: number,
  speedKmh: number,
  distanceKm: number,
  sampleRate: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      0,
      Math.round(trafficDensity(flowPerHour, speedKmh) * distanceKm * sampleRate),
    ),
  )
}

export function roadDistanceTravelledKm(
  direction: RoadTrafficDirection,
  time: number,
  vehicle: 'light' | 'heavy',
): number {
  const samples = direction.samples
  if (samples.length < 2 || time <= samples[0][0]) return 0
  const speedIndex = vehicle === 'light' ? 2 : 4
  const limit = Math.min(time, samples[samples.length - 1][0])
  let distance = 0
  for (let index = 1; index < samples.length; index += 1) {
    const from = samples[index - 1]
    const to = samples[index]
    if (from[0] >= limit) break
    const segmentEnd = Math.min(limit, to[0])
    const duration = segmentEnd - from[0]
    const progress = duration / (to[0] - from[0])
    const endSpeed = interpolate(from[speedIndex], to[speedIndex], progress)
    distance += ((from[speedIndex] + endSpeed) / 2) * (duration / 3600)
    if (segmentEnd === limit) break
  }
  return distance
}
