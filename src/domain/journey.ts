export interface JourneyStop {
  readonly name: string
  readonly progress: number
  readonly departure: string
}

export interface Journey {
  readonly id: string
  readonly service: string
  readonly destination: string
  readonly operator: string
  readonly speedKmh: number
  readonly stops: readonly JourneyStop[]
}

export interface JourneyPosition {
  readonly previous: JourneyStop
  readonly next: JourneyStop
  readonly legProgress: number
}

export function positionOnJourney(
  journey: Journey,
  progress: number,
): JourneyPosition {
  const clamped = Math.min(1, Math.max(0, progress))
  const nextIndex = journey.stops.findIndex((stop) => stop.progress >= clamped)

  if (nextIndex <= 0) {
    return {
      previous: journey.stops[0],
      next: journey.stops[1],
      legProgress: 0,
    }
  }

  if (nextIndex === -1) {
    const last = journey.stops.at(-1)!
    return { previous: last, next: last, legProgress: 1 }
  }

  const previous = journey.stops[nextIndex - 1]
  const next = journey.stops[nextIndex]
  const legLength = next.progress - previous.progress

  return {
    previous,
    next,
    legProgress: legLength === 0 ? 1 : (clamped - previous.progress) / legLength,
  }
}
