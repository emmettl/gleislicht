import type { NationalRoadStudySnapshot } from '@motionstudies/core/domain/road-day'
import type { RoadTopologySnapshot } from '@motionstudies/core/domain/road'
import pilotCatalog from '../../data/cantonal-road-pilots.json'
export const cantonalPilotForRecording = (id?: string) => pilotCatalog.find(p => p.id === id)
export const cantonalPilotsForRoad = (road?: string) => pilotCatalog.filter(p => p.road === road)
export const cantonalPilotForRoad = (road?: string, recordingId?: string) => {
  const pilots = cantonalPilotsForRoad(road)
  return pilots.find(p => p.id === recordingId) ?? pilots[0]
}
export type CantonalPilotDefinition = typeof pilotCatalog[number]
export interface CantonalPilot {
  metadata: { schemaVersion: number; recordingId: string; recordingScope: string; serviceDate: string; windowStart: number; windowEnd: number; road: string; name: string; completeMinutes: number }
  topology: Pick<RoadTopologySnapshot, 'sites' | 'sections'>
  windows: NationalRoadStudySnapshot[]
  gaps: { start: number; end: number }[]
}
