import { RoadTrafficLayer, type RoadTrafficLayerProps, type RoadPathResolver, type RoadCurveFactory } from '@motionstudies/three/RoadTrafficLayer'
import { RoadPolyline, roadPathOnTopology } from './road-geometry.ts'
import { GleislichtRoadLabels } from './GleislichtRoadLabels.tsx'

/** Use matched official road segments; absent paths stay absent rather than becoming chords. */
const resolveSwissRoadPath: RoadPathResolver = ({ topology, road, from, to, fromSiteId, toSiteId }) => {
  if (!topology) return null
  const origin = fromSiteId ? topology.sites.find(site => site.id === fromSiteId)?.match : undefined
  const destination = toSiteId ? topology.sites.find(site => site.id === toSiteId)?.match : undefined
  return roadPathOnTopology(topology, road.replace(/^A/, 'N'),
    origin?.projectedCoordinate ?? from, destination?.projectedCoordinate ?? to,
    origin?.segmentId, destination?.segmentId) ?? null
}
const createCurve: RoadCurveFactory = points => new RoadPolyline(points)

export function GleislichtRoadTrafficLayer(props: RoadTrafficLayerProps) {
  return <RoadTrafficLayer {...props} resolvePath={resolveSwissRoadPath} createCurve={createCurve}
    markerXOffset={0} Overlay={GleislichtRoadLabels} />
}
