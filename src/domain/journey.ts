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

export const prototypeJourney: Journey = {
  id: 'IR-35-2367',
  service: 'IR 35',
  destination: 'Chur',
  operator: 'SBB CFF FFS',
  speedKmh: 112,
  stops: [
    { name: 'Zürich HB', progress: 0, departure: '21:42' },
    { name: 'Thalwil', progress: 0.17, departure: '21:54' },
    { name: 'Pfäffikon SZ', progress: 0.39, departure: '22:12' },
    { name: 'Ziegelbrücke', progress: 0.64, departure: '22:34' },
    { name: 'Sargans', progress: 0.82, departure: '22:51' },
    { name: 'Chur', progress: 1, departure: '23:05' },
  ],
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

