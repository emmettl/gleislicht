import type { RoadTopologySnapshot } from '@motionstudies/core/domain/road'
import { searchRoadCorridors, type RoadSearchCorridor } from '@motionstudies/core/road-search'
import { cantonalPilotsForRoad, type CantonalPilot } from './cantonal-road-pilot.ts'

export function searchRoadsWithPilots<Road extends RoadSearchCorridor>(roads: readonly Road[], query: string): readonly Road[] {
  const searchable = roads.map(road => {
    const pilots = cantonalPilotsForRoad(road.id)
    return { ...road, original: road, description: pilots.length ? `${road.description ?? ''} ${pilots.map(p => p.name).join(' ')}` : road.description }
  })
  return searchRoadCorridors(searchable, query).map(road => road.original)
}
export function cantonalPilotWindow(pilot: CantonalPilot, time: number) {
  return pilot.windows.find(w => time >= w.metadata.windowStart && time <= w.metadata.windowEnd)
}
export function topologyWithPilot(topology: RoadTopologySnapshot, pilot: CantonalPilot): RoadTopologySnapshot {
  if (pilot.topology.sites.some(s => topology.sites.some(n => n.id === s.id))) throw new Error('Pilot site collision')
  return { ...topology, sites: [...topology.sites, ...pilot.topology.sites], sections: [...topology.sections, ...pilot.topology.sections] }
}
