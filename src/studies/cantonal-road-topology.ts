import type { RoadTopologyPath, RoadTopologyRoad, RoadTopologySnapshot } from '@motionstudies/core/domain/road'

export interface CantonalRoadTopology {
  metadata: {
    schemaVersion: number
    recordingScope: string
    publisher: string
    coverage: { catalogStations: number; preciseStationJoins: number; stationStatus: Record<string, number> }
  }
  roads: (RoadTopologyRoad & { lengthKm: number })[]
  paths: RoadTopologyPath[]
  sites: []
  sections: []
}

/** Geometry has its own provenance and never enters the federal observation index. */
export function withCantonalRoadGeometry(national: RoadTopologySnapshot, cantonal: CantonalRoadTopology): RoadTopologySnapshot {
  if (cantonal?.metadata?.schemaVersion !== 1 || cantonal.metadata.recordingScope !== 'zurich-cantonal' ||
    !Array.isArray(cantonal.roads) || !Array.isArray(cantonal.paths) ||
    cantonal.sites?.length !== 0 || cantonal.sections?.length !== 0) throw new Error('Invalid cantonal geometry artifact')
  const ids = new Set(national.roads.map(({ id }) => id))
  for (const road of cantonal.roads) {
    if (!road.id.startsWith('ZH:') || ids.has(road.id)) throw new Error('Cantonal road identifier collision')
    ids.add(road.id)
  }
  const cantonIds = new Set(cantonal.roads.map(({ id }) => id))
  if (cantonal.paths.some(({ road, points }) => !cantonIds.has(road) || points.length < 2 || points.some(([lon, lat]) => !Number.isFinite(lon) || !Number.isFinite(lat)))) {
    throw new Error('Invalid cantonal road geometry')
  }
  return { ...national, roads: [...national.roads, ...cantonal.roads], paths: [...national.paths, ...cantonal.paths] }
}

export async function loadCantonalRoadGeometry(national: RoadTopologySnapshot, url: string, signal: AbortSignal): Promise<RoadTopologySnapshot> {
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), 8000)
  try {
    const response = await fetch(url, { signal: AbortSignal.any([signal, timeout.signal]) })
    if (!response.ok) throw new Error(`Cantonal geometry returned ${response.status}`)
    return withCantonalRoadGeometry(national, await response.json() as CantonalRoadTopology)
  } catch (error) {
    if (signal.aborted) throw error
    console.warn('Cantonal road geometry is unavailable', error)
    return national
  } finally {
    clearTimeout(timer)
  }
}
