import type { NationalRoadStudySnapshot } from '@motionstudies/core/domain/road-day'
import type { RoadTopologySnapshot } from '@motionstudies/core/domain/road'
import pilotCatalog from '../../data/cantonal-road-pilots.json'
import { searchRoadCorridors, type RoadSearchCorridor } from '@motionstudies/core/road-search'
export const cantonalPilotForRecording = (id?: string) => pilotCatalog.find(p => p.id === id)
export const cantonalPilotsForRoad = (road?: string) => pilotCatalog.filter(p => p.road === road)
export const cantonalPilotForRoad = (road?: string, recordingId?: string) => {
  const pilots = cantonalPilotsForRoad(road)
  return pilots.find(p => p.id === recordingId) ?? pilots[0]
}
export type CantonalPilotDefinition = typeof pilotCatalog[number]
export function searchRoadsWithPilots<Road extends RoadSearchCorridor>(roads: readonly Road[], query: string): readonly Road[] {
  const searchable = roads.map(road => {
    const pilots = cantonalPilotsForRoad(road.id)
    return { ...road, original: road, description: pilots.length ? `${road.description ?? ''} ${pilots.map(p => p.name).join(' ')}` : road.description }
  })
  return searchRoadCorridors(searchable, query).map(road => road.original)
}
export interface CantonalPilot {
  metadata: { schemaVersion: number; recordingId: string; recordingScope: string; serviceDate: string; windowStart: number; windowEnd: number; road: string; name: string; completeMinutes: number }
  topology: Pick<RoadTopologySnapshot, 'sites' | 'sections'>
  windows: NationalRoadStudySnapshot[]
  gaps: { start: number; end: number }[]
}
export function cantonalPilotWindow(pilot: CantonalPilot, time: number) {
  return pilot.windows.find(w => time >= w.metadata.windowStart && time <= w.metadata.windowEnd)
}
export function topologyWithPilot(topology: RoadTopologySnapshot, pilot: CantonalPilot): RoadTopologySnapshot {
  if (pilot.topology.sites.some(s => topology.sites.some(n => n.id === s.id))) throw new Error('Pilot site collision')
  return { ...topology, sites: [...topology.sites, ...pilot.topology.sites], sections: [...topology.sections, ...pilot.topology.sections] }
}
