export type AirSample = readonly [
  time: number,
  longitude: number,
  latitude: number,
  altitudeFeet: number,
  groundSpeedKnots: number,
]

export interface AirTrack {
  readonly id: string
  readonly callsign: string
  readonly start: number
  readonly end: number
  readonly samples: readonly AirSample[]
}

export interface AirSnapshot {
  readonly metadata: {
    readonly publisher: string
    readonly serviceDate: string
    readonly windowStart: number
    readonly windowEnd: number
    readonly sourceUrl: string
    readonly license: string
    readonly licenseUrl: string
    readonly model: string
    readonly note: string
    readonly sampleIntervalSeconds: number
  }
  readonly bounds: {
    readonly minLongitude: number
    readonly minLatitude: number
    readonly maxLongitude: number
    readonly maxLatitude: number
  }
  readonly tracks: readonly AirTrack[]
}

export interface AirPosition {
  readonly longitude: number
  readonly latitude: number
  readonly altitudeFeet: number
  readonly groundSpeedKnots: number
  readonly headingDegrees: number
  readonly verticalRateFeetPerMinute: number
}

const MAX_INTERPOLATION_GAP_SECONDS = 45

export function headingBetweenSamples(
  from: AirSample,
  to: AirSample,
): number {
  const latitude = ((from[2] + to[2]) * Math.PI) / 360
  const east = (to[1] - from[1]) * Math.cos(latitude)
  const north = to[2] - from[2]
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360
}

export function positionForAirTrack(
  track: AirTrack,
  time: number,
): AirPosition | undefined {
  if (time < track.start || time > track.end || track.samples.length < 2) {
    return undefined
  }

  let upper = track.samples.findIndex((sample) => sample[0] >= time)
  if (upper < 0) upper = track.samples.length - 1
  if (upper === 0) upper = 1
  const from = track.samples[upper - 1]
  const to = track.samples[upper]
  const duration = to[0] - from[0]
  if (duration <= 0 || duration > MAX_INTERPOLATION_GAP_SECONDS) return undefined
  const progress = Math.max(0, Math.min(1, (time - from[0]) / duration))

  return {
    longitude: from[1] + (to[1] - from[1]) * progress,
    latitude: from[2] + (to[2] - from[2]) * progress,
    altitudeFeet: from[3] + (to[3] - from[3]) * progress,
    groundSpeedKnots: from[4] + (to[4] - from[4]) * progress,
    headingDegrees: headingBetweenSamples(from, to),
    verticalRateFeetPerMinute: ((to[3] - from[3]) / duration) * 60,
  }
}

export function activeAirTracks(
  snapshot: AirSnapshot,
  time: number,
): readonly AirTrack[] {
  return snapshot.tracks.filter((track) => positionForAirTrack(track, time))
}
