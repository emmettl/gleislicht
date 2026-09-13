import { useMemo, type ComponentType } from 'react'
import { SERVICE_COLORS } from '@motionstudies/core/theme'
import { NationalNetworkScene, type NationalNetworkSceneProps } from '@motionstudies/three/NationalNetworkScene'
import type { NetworkSceneExtensions } from '@motionstudies/three/scene-extensions'
import { TrailWorkerClient } from './trail-worker-client.ts'
import { createAtlasFlightCamera, useAtlasFlightLoop } from './atlas-flight-camera.ts'
import { nationalRoadConditionsAtTime } from './road-conditions.ts'
import type { MapSelectionSceneExtension } from './GleislichtMapSelection.tsx'

const extensions: NetworkSceneExtensions = {
  createTrailBackend: () => new TrailWorkerClient(),
  createCameraDriver: createAtlasFlightCamera,
  roadConditions: nationalRoadConditionsAtTime,
}
const Scene = NationalNetworkScene as ComponentType<NationalNetworkSceneProps & MapSelectionSceneExtension>

export function GleislichtNetworkScene(props: NationalNetworkSceneProps & MapSelectionSceneExtension) {
  const frameloop = useAtlasFlightLoop()
  const mapStyle = useMemo(() => ({ ...props.mapStyle, categoryColors: props.mapStyle?.categoryColors ?? SERVICE_COLORS }), [props.mapStyle])
  return <Scene {...props} extensions={extensions} frameloop={frameloop} mapStyle={mapStyle} />
}
