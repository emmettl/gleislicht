import type { RoadTopologyRoad } from '@motionstudies/core/domain/road'
import { roads } from '../../public/data/swiss-road-topology.json'

// Import only the small catalogue; production builds exclude the geometry and observations.
// Sharing the topology source keeps names and camera targets in sync on refresh.
export const SWITZERLAND_ROADS: readonly (RoadTopologyRoad & { readonly lengthKm: number })[] = roads.map(road => ({
  ...road,
  focus: [road.focus[0], road.focus[1]],
}))
