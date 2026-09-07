import type { StudyAirport } from '@motionstudies/core/domain/airport'
import type { TrainLabelMode } from './train-labels.ts'

export function airportsForMap(
  airports: readonly StudyAirport[],
  emphasised: boolean,
  selectedAirport?: StudyAirport,
): readonly StudyAirport[] {
  if (!emphasised) return selectedAirport ? [selectedAirport] : []
  if (!selectedAirport || airports.some(({ id }) => id === selectedAirport.id)) {
    return airports
  }
  return [...airports, selectedAirport]
}

export function airportLabelsAreVisible(labelMode: TrainLabelMode): boolean {
  return labelMode !== 'off'
}
