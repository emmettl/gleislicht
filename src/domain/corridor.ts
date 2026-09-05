import type { Journey } from './journey.ts'
import {
  formatServiceTime,
  type NetworkSnapshot,
  type NetworkTrain,
} from './network.ts'

export interface CorridorTerrain {
  readonly columns: number
  readonly rows: number
  readonly widthMetres: number
  readonly depthMetres: number
  readonly minElevation: number
  readonly maxElevation: number
  readonly elevations: readonly number[]
}

export interface CorridorRouteStop {
  readonly name: string
  readonly progress: number
  readonly departure: number
}

export interface CorridorLake {
  readonly id: string
  readonly name: string
  readonly elevation: number
  readonly rings: readonly (readonly (readonly [number, number])[])[]
}

export interface CorridorTunnel {
  readonly id: string
  readonly name: string
  readonly lengthMetres: number
  readonly line: string
  readonly startProgress: number
  readonly endProgress: number
}

export interface CorridorSnapshot {
  readonly id: string
  readonly metadata: {
    readonly source: string
    readonly releaseDate: string
    readonly sourceUrl: string
    readonly productUrl: string
    readonly attribution: string
    readonly sourceCrs: string
    readonly model: string
    readonly railSource: unknown
    readonly profileSourceUrl: string
    readonly routeSource?: string
    readonly routeAttribution?: string
    readonly routeProductUrl?: string
    readonly tunnelSource?: string
    readonly tunnelSourceUrl?: string
    readonly tunnelProductUrl?: string
  }
  readonly origin: {
    readonly easting: number
    readonly northing: number
  }
  readonly terrain: CorridorTerrain
  readonly route: {
    readonly service: string
    readonly destination: string
    readonly operator: string
    readonly representativeTrain: string
    readonly distanceMetres: number
    readonly points: readonly (readonly [number, number, number])[]
    readonly stops: readonly CorridorRouteStop[]
    readonly tunnels?: readonly CorridorTunnel[]
  }
  readonly lakes: readonly CorridorLake[]
}

export function isZurichChurTrain(
  train: NetworkTrain | undefined,
  network: NetworkSnapshot | undefined,
): boolean {
  if (!train || !network) return false
  const names = train.stops.map(([stopIndex]) => network.stops[stopIndex]?.[2])
  const zurichIndex = names.indexOf('Zürich HB')
  const churIndex = names.indexOf('Chur')
  return zurichIndex >= 0 && churIndex > zurichIndex
}

export function isKientalGriesalpTrain(
  train: NetworkTrain | undefined,
  network: NetworkSnapshot | undefined,
): boolean {
  if (!train || !network || train.route !== '220') return false
  const names = train.stops.map(([stopIndex]) => network.stops[stopIndex]?.[2])
  const reichenbachIndex = names.indexOf('Reichenbach i. K., Bahnhof')
  const griesalpIndex = names.indexOf('Griesalp, Kurhaus')
  return reichenbachIndex >= 0 && griesalpIndex > reichenbachIndex
}

export function journeyForCorridor(
  corridor: CorridorSnapshot,
  train?: NetworkTrain,
  network?: NetworkSnapshot,
): Journey {
  if (!train || !network || !isZurichChurTrain(train, network)) {
    const first = corridor.route.stops[0]
    const last = corridor.route.stops.at(-1)!
    const duration = Math.max(1, last.departure - first.departure)
    return {
      id: `${corridor.route.service}-${corridor.route.representativeTrain}`,
      service: corridor.route.service,
      destination: corridor.route.destination,
      operator: corridor.route.operator,
      speedKmh: Math.round((corridor.route.distanceMetres / duration) * 3.6),
      stops: corridor.route.stops.map((stop) => ({
        name: stop.name,
        progress: stop.progress,
        departure: formatServiceTime(stop.departure),
      })),
    }
  }

  const names = train.stops.map(([stopIndex]) => network.stops[stopIndex]?.[2])
  const fromIndex = names.indexOf('Zürich HB')
  const toIndex = names.indexOf('Chur')
  const corridorProgress = new Map(
    corridor.route.stops.map((stop) => [stop.name, stop.progress]),
  )
  const selectedStops = train.stops.slice(fromIndex, toIndex + 1)
  const start = selectedStops[0][2]
  const end = selectedStops.at(-1)![1]
  return {
    id: `${train.route}-${train.shortName}`,
    service: train.route,
    destination: 'Chur',
    operator: corridor.route.operator,
    speedKmh: Math.round(
      (corridor.route.distanceMetres / Math.max(1, end - start)) * 3.6,
    ),
    stops: selectedStops.map(([stopIndex, arrival, departure], index) => ({
      name: network.stops[stopIndex][2],
      progress:
        corridorProgress.get(network.stops[stopIndex][2]) ??
        (selectedStops.length === 1 ? 0 : index / (selectedStops.length - 1)),
      departure: formatServiceTime(
        index === selectedStops.length - 1 ? arrival : departure,
      ),
    })),
  }
}

export function corridorProgressForTime(
  train: NetworkTrain,
  network: NetworkSnapshot,
  time: number,
): number {
  const names = train.stops.map(([stopIndex]) => network.stops[stopIndex]?.[2])
  const fromIndex = names.indexOf('Zürich HB')
  const toIndex = names.indexOf('Chur')
  if (fromIndex < 0 || toIndex <= fromIndex) return 0
  const start = train.stops[fromIndex][2]
  const end = train.stops[toIndex][1]
  return Math.min(0.985, Math.max(0.015, (time - start) / Math.max(1, end - start)))
}
