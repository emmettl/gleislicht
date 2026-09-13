import type { CorridorSnapshot } from '@motionstudies/core/domain/corridor'
import type { Journey } from '@motionstudies/core/domain/journey'
import { formatServiceTime, type NetworkSnapshot, type NetworkTrain } from '@motionstudies/core/domain/network'
import { isRigiCorridorId, rigiCorridorForTrain, isZurichChurTrain } from './switzerland-corridors.ts'

export function journeyForSwissCorridor(
  corridor: CorridorSnapshot,
  train?: NetworkTrain,
  network?: NetworkSnapshot,
): Journey {
  const rigi = isRigiCorridorId(corridor.id)
  const matches = rigi ? rigiCorridorForTrain(train, network) === corridor.id : corridor.id === 'zurich-chur' && isZurichChurTrain(train, network)
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
  const fromIndex = names.indexOf(corridor.route.stops[0].name)
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

