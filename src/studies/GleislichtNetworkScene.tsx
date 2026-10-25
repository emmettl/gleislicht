import { lazy, useMemo } from 'react'
import { SERVICE_COLORS } from '@motionstudies/core/theme'
import { NationalNetworkScene, type NationalNetworkSceneProps } from '@motionstudies/three/NationalNetworkScene'
import type { NetworkSceneExtensions } from '@motionstudies/three/scene-extensions'
import type { NetworkMapStyle } from '@motionstudies/three/scene-style'
import { createAtlasFlightCamera, useAtlasFlightLoop } from './atlas-flight-camera.ts'
import { GleislichtMapSelection, type MapSelectionSceneExtension } from './GleislichtMapSelection.tsx'
import { pickAirportTarget } from './map-selection.ts'

const RoadLayer = lazy(() => import('./GleislichtRoadTrafficLayer.tsx').then(module => ({ default: module.GleislichtRoadTrafficLayer })))
const screenOffset = (height: number, comparisonIndex: number) => height / 2 + 4 + Math.max(0, comparisonIndex) * (height + 4)

const extensions: NetworkSceneExtensions = {
  RoadLayer,
  createCameraDriver: createAtlasFlightCamera,
  stationPicking: 'custom',
  aircraftPicking: { event: 'click', accepts: event => event.dragDistance <= 5 && !pickAirportTarget(event.scene, event.camera, event.canvas.getBoundingClientRect(), event.clientX, event.clientY, event.touch) },
}

export function GleislichtNetworkScene(props: NationalNetworkSceneProps & MapSelectionSceneExtension & { roadConditions?: NetworkSceneExtensions['roadConditions'] }) {
  const frameloop = useAtlasFlightLoop()
  const sceneExtensions = useMemo(() => ({ ...extensions, roadConditions: props.roadConditions }), [props.roadConditions])
  const mapStyle = useMemo(() => gleislichtMapStyle(props.mapStyle), [props.mapStyle])
  return <NationalNetworkScene {...props} extensions={sceneExtensions} frameloop={frameloop === 'never' ? 'never' : props.frameloop ?? frameloop} mapStyle={mapStyle}>
    {props.children}
    <GleislichtMapSelection stations={props.stations} onSelectStation={props.onSelectStation} onSelectTrain={props.onSelectTrain} onSelectRoad={props.onSelectRoad} onSelectAirport={props.onSelectAirport} roadsOnly={props.roadCategorySelected} disabled={props.airCategorySelected} />
  </NationalNetworkScene>
}

/** Edition-owned palette and placement policies; the renderer owns geometry/lifetimes. */
export function gleislichtMapStyle(style?: NetworkMapStyle): NetworkMapStyle {
  return ({ ...style,
    coplanar: true,
    selectionMarkers: { stationMaxRadiusPixels: 10, trainMaxRadiusPixels: 3.5 },
    trainLabels: { ...style?.trainLabels, screenOffset },
    categoryColors: style?.categoryColors ?? SERVICE_COLORS,
    trailElevationOffset: 0,
    airports: { independent: true, labelRenderOrder: 30, fog: false },
    roads: {
      mainline: { color: '#a0a6b2', opacity: ({ selected, subdued }) => selected ? 0.25 : subdued ? 0.2 : 0.45, depthTest: false, toneMapped: false },
      connectors: { color: '#a0a6b2', opacity: ({ subdued }) => subdued ? 0.15 : 0.3, depthTest: false, toneMapped: false },
      selected: { color: '#a0a6b2', opacity: 0.65 },
    },
  })
}
