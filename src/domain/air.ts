export type AirSample = readonly [
  time: number,
  longitude: number,
  latitude: number,
  altitudeFeet: number,
  groundSpeedKnots: number,
]

export interface AirTrack {
  readonly id: string
  readonly icaoAddress?: string
  readonly callsign: string
  readonly start: number
  readonly end: number
  readonly airportIds?: readonly string[]
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

function sampleBracket(
  samples: readonly AirSample[],
  time: number,
): readonly [lower: number, upper: number] {
  let low = 1
  let high = samples.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (samples[middle][0] < time) low = middle + 1
    else high = middle
  }
  return [low - 1, low]
}

function sampleTangent(
  samples: readonly AirSample[],
  index: number,
  coordinate: 1 | 2,
  fallback: number,
): number {
  const previous = samples[index - 1]
  const next = samples[index + 1]
  const current = samples[index]
  if (
    previous &&
    next &&
    current[0] - previous[0] <= MAX_INTERPOLATION_GAP_SECONDS &&
    next[0] - current[0] <= MAX_INTERPOLATION_GAP_SECONDS
  ) {
    return (next[coordinate] - previous[coordinate]) / (next[0] - previous[0])
  }
  return fallback
}

function hermiteValue(
  from: number,
  to: number,
  fromTangent: number,
  toTangent: number,
  duration: number,
  progress: number,
): number {
  const progressSquared = progress * progress
  const progressCubed = progressSquared * progress
  return (
    (2 * progressCubed - 3 * progressSquared + 1) * from +
    (progressCubed - 2 * progressSquared + progress) * fromTangent * duration +
    (-2 * progressCubed + 3 * progressSquared) * to +
    (progressCubed - progressSquared) * toTangent * duration
  )
}

function hermiteDerivative(
  from: number,
  to: number,
  fromTangent: number,
  toTangent: number,
  duration: number,
  progress: number,
): number {
  const progressSquared = progress * progress
  return (
    (6 * progressSquared - 6 * progress) * from +
    (3 * progressSquared - 4 * progress + 1) * fromTangent * duration +
    (-6 * progressSquared + 6 * progress) * to +
    (3 * progressSquared - 2 * progress) * toTangent * duration
  )
}

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

  const [lower, upper] = sampleBracket(track.samples, time)
  const from = track.samples[lower]
  const to = track.samples[upper]
  const duration = to[0] - from[0]
  if (duration <= 0 || duration > MAX_INTERPOLATION_GAP_SECONDS) return undefined
  const progress = Math.max(0, Math.min(1, (time - from[0]) / duration))
  const longitudeRate = (to[1] - from[1]) / duration
  const latitudeRate = (to[2] - from[2]) / duration
  const fromLongitudeTangent = sampleTangent(
    track.samples,
    lower,
    1,
    longitudeRate,
  )
  const toLongitudeTangent = sampleTangent(
    track.samples,
    upper,
    1,
    longitudeRate,
  )
  const fromLatitudeTangent = sampleTangent(
    track.samples,
    lower,
    2,
    latitudeRate,
  )
  const toLatitudeTangent = sampleTangent(
    track.samples,
    upper,
    2,
    latitudeRate,
  )
  const longitude = hermiteValue(
    from[1],
    to[1],
    fromLongitudeTangent,
    toLongitudeTangent,
    duration,
    progress,
  )
  const latitude = hermiteValue(
    from[2],
    to[2],
    fromLatitudeTangent,
    toLatitudeTangent,
    duration,
    progress,
  )
  const longitudeDerivative = hermiteDerivative(
    from[1],
    to[1],
    fromLongitudeTangent,
    toLongitudeTangent,
    duration,
    progress,
  )
  const latitudeDerivative = hermiteDerivative(
    from[2],
    to[2],
    fromLatitudeTangent,
    toLatitudeTangent,
    duration,
    progress,
  )
  const east = longitudeDerivative * Math.cos((latitude * Math.PI) / 180)
  const headingDegrees =
    Math.abs(east) + Math.abs(latitudeDerivative) > Number.EPSILON
      ? ((Math.atan2(east, latitudeDerivative) * 180) / Math.PI + 360) % 360
      : headingBetweenSamples(from, to)

  return {
    longitude,
    latitude,
    altitudeFeet: from[3] + (to[3] - from[3]) * progress,
    groundSpeedKnots: from[4] + (to[4] - from[4]) * progress,
    headingDegrees,
    verticalRateFeetPerMinute: ((to[3] - from[3]) / duration) * 60,
  }
}

export function activeAirTracks(
  snapshot: AirSnapshot,
  time: number,
): readonly AirTrack[] {
  return snapshot.tracks.filter((track) => positionForAirTrack(track, time))
}
