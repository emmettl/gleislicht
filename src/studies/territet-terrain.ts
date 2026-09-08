import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import expected from '../../data/territet-terrain-binding.json'
import { territetJourneys } from './territet.ts'
import { bindMeasuredTerrain, type MeasuredTerrain } from './measured-terrain.ts'

export function bindTerritetTerrain(value: unknown, network: NetworkSnapshot, train: NetworkSnapshot['trains'][number]) {
 try {
  const ascent = territetJourneys(network, 'ascent').includes(train)
  if (!ascent && !territetJourneys(network, 'descent').includes(train)) return
  const data = value as MeasuredTerrain
  if (!data?.terrain || !Array.isArray(data.routes) || data.routes.length !== 1) return
  // The optional raster may not substitute a branch, remove the conservative
  // mask or supply a camera/axis outside the completed source audit.
  const { elevations: _elevations, ...grid } = data.terrain
  if (JSON.stringify({...data, terrain: grid}) !== JSON.stringify(expected)) return
  const route = data.routes[0]
  const ids = ascent ? expected.routes[0].forwardTripIds : expected.routes[0].reverseTripIds
  if (!ids.includes(train.id)) return
  const oriented = ascent ? data : {...data, routes: [{...route, points: [...route.points].reverse(), stops: [...route.stops].reverse().map(s => ({...s, progress: 1 - s.progress})), maskedRanges: [...route.maskedRanges].reverse().map(r => ({...r, start: 1 - r.end, end: 1 - r.start}))}]}
  return bindMeasuredTerrain(oriented, network, {id: 'territet-ascent-terrain', legs: [{train, departure: train.stops[0][2], arrival: train.stops.at(-1)![1], vehicle: 'funicular'}]})
 } catch { return undefined }
}
