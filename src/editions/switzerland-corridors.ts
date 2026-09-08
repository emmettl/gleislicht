import type { CorridorSnapshot } from '@motionstudies/core/domain/corridor'
import type { Journey } from '@motionstudies/core/domain/journey'
import {
  formatServiceTime,
  type NetworkSnapshot,
  type NetworkTrain,
} from '@motionstudies/core/domain/network'

export type SwitzerlandCorridorVehicleKind = 'train' | 'bus' | 'cogwheel'

export const RIGI_PENDING_JOURNEY: Journey = {
  id: 'Vitznau–Rigi Kulm', service: 'RIGI', destination: 'Rigi Kulm',
  operator: 'Rigi Bahnen AG', speedKmh: 0,
  stops: [{ name: 'Vitznau', progress: 0, departure: '—' }, { name: 'Rigi Kulm', progress: 1, departure: '—' }],
}

export const SWITZERLAND_PROTOTYPE_JOURNEY: Journey = {
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
export function vehicleKindForSwissCorridor(
  corridor?: Pick<CorridorSnapshot, 'id'>,
): SwitzerlandCorridorVehicleKind {
  return corridor?.id === 'kiental-griesalp' ? 'bus' : corridor?.id === 'vitznau-rigi' ? 'cogwheel' : 'train'
}

export function isVitznauRigiTrain(train: NetworkTrain | undefined, network: NetworkSnapshot | undefined): boolean {
  if (!train || !network) return false
  const type = (train as NetworkTrain & { routeType?: number }).routeType
  return (type === undefined || type === 116) &&
    network.stops[train.stops[0]?.[0]]?.[2] === 'Vitznau' &&
    network.stops[train.stops.at(-1)?.[0] ?? -1]?.[2] === 'Rigi Kulm'
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

export function journeyForSwissCorridor(
  corridor: CorridorSnapshot,
  train?: NetworkTrain,
  network?: NetworkSnapshot,
): Journey {
  const rigi = corridor.id === 'vitznau-rigi'
  const matches = rigi ? isVitznauRigiTrain(train, network) : corridor.id === 'zurich-chur' && isZurichChurTrain(train, network)
  if (!train || !network || !matches) {
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
  const fromIndex = names.indexOf(rigi ? 'Vitznau' : 'Zürich HB')
  const toIndex = names.indexOf(rigi ? 'Rigi Kulm' : 'Chur')
  const corridorProgress = new Map(
    corridor.route.stops.map((stop) => [stop.name, stop.progress]),
  )
  const selectedStops = train.stops.slice(fromIndex, toIndex + 1)
  const start = selectedStops[0][2]
  const end = selectedStops.at(-1)![1]
  return {
    id: `${train.route}-${train.shortName}`,
    service: train.route,
    destination: corridor.route.destination,
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

export function swissCorridorProgressForTime(
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
