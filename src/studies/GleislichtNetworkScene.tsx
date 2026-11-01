import { gpuDebugEnabled } from '../debug.ts'
import { gleislichtMapStyle } from './gleislicht-map-style.ts'
import { lazy, Suspense, useMemo } from 'react'
import { NationalNetworkScene, type NationalNetworkSceneProps } from '@motionstudies/three/NationalNetworkScene'
import type { NetworkSceneExtensions } from '@motionstudies/three/scene-extensions'
import { createAtlasFlightCamera, useAtlasFlightLoop } from './atlas-flight-camera.ts'
import { GleislichtMapSelection, type MapSelectionSceneExtension } from './GleislichtMapSelection.tsx'
import { pickAirportTarget } from './map-selection.ts'

const Debug = lazy(() => import('@motionstudies/three/debug-fiber').then(module => ({ default: module.EditionDebug })))

const RoadLayer = lazy(() => import('./GleislichtRoadTrafficLayer.tsx').then(module => ({ default: module.GleislichtRoadTrafficLayer })))

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
    {gpuDebugEnabled && <Suspense fallback={null}><Debug label="National network" metadata={{
      playbackTime: props.time, playing: props.isPlaying, playbackRate: props.playbackRate,
      network: props.snapshot.metadata, spatialLayoutMix: props.spatialLayoutMix,
      selection: { train: props.selectedTrain?.id, station: props.selectedStation?.name, category: props.selectedCategory },
      layers: { air: !!props.airSnapshot, road: !!props.roadSnapshot, ground: props.groundStyle },
    }} /></Suspense>}
    {props.children}
    <GleislichtMapSelection stations={props.stations} onSelectStation={props.onSelectStation} onSelectTrain={props.onSelectTrain} onSelectRoad={props.onSelectRoad} onSelectAirport={props.onSelectAirport} roadsOnly={props.roadCategorySelected} disabled={props.airCategorySelected} />
  </NationalNetworkScene>
}
