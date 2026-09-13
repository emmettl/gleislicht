import type { CorridorSnapshot } from '@motionstudies/core/domain/corridor'
import type { Journey } from '@motionstudies/core/domain/journey'
import {
  type NetworkSnapshot,
  type NetworkTrain,
} from '@motionstudies/core/domain/network'

export type SwitzerlandCorridorVehicleKind = 'train' | 'bus' | 'cogwheel'

export const RIGI_ASCENTS = {
  'vitznau-rigi': { origin: 'Vitznau', name: 'Vitznau', service: '82' },
  'arth-goldau-rigi': { origin: 'Arth-Goldau RB', name: 'Arth-Goldau', service: '81' },
} as const
export type RigiCorridorId = keyof typeof RIGI_ASCENTS
export function isRigiCorridorId(id: string | undefined): id is RigiCorridorId {
  return id === 'vitznau-rigi' || id === 'arth-goldau-rigi'
}
export function rigiPendingJourney(id: RigiCorridorId): Journey {
  const approach = RIGI_ASCENTS[id]
  return {
    id: `${approach.name}–Rigi Kulm`, service: approach.service, destination: 'Rigi Kulm',
    operator: 'Rigi Bahnen AG', speedKmh: 0,
    stops: [{ name: approach.origin, progress: 0, departure: '—' }, { name: 'Rigi Kulm', progress: 1, departure: '—' }],
  }
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
  return corridor?.id === 'kiental-griesalp' ? 'bus' : isRigiCorridorId(corridor?.id) ? 'cogwheel' : 'train'
}

export function rigiCorridorForTrain(train: NetworkTrain | undefined, network: NetworkSnapshot | undefined): RigiCorridorId | undefined {
  if (!train || !network) return undefined
  const type = (train as NetworkTrain & { routeType?: number }).routeType
  if (type !== undefined && type !== 116 || type === undefined && train.category !== 'other') return undefined
  if (network.stops[train.stops.at(-1)?.[0] ?? -1]?.[2] !== 'Rigi Kulm') return undefined
  const origin = network.stops[train.stops[0]?.[0] ?? -1]?.[2]
  if (origin === RIGI_ASCENTS['vitznau-rigi'].origin) return 'vitznau-rigi'
  if (origin === RIGI_ASCENTS['arth-goldau-rigi'].origin) return 'arth-goldau-rigi'
  return undefined
}

export function isVitznauRigiTrain(train: NetworkTrain | undefined, network: NetworkSnapshot | undefined): boolean {
  return rigiCorridorForTrain(train, network) === 'vitznau-rigi'
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
