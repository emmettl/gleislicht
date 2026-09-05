import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type {
  BoundaryCoordinate,
  SwissBoundary,
} from '../domain/boundary.ts'
import type { SwissLakes } from '../domain/lakes.ts'
import type { RoadTrafficSnapshot } from '../domain/road.ts'
import {
  positionForAirTrack,
  type AirSnapshot,
  type AirTrack,
} from '../domain/air.ts'
import {
  positionForTrain,
  SERVICE_COLORS,
  type NetworkSnapshot,
  type NetworkRouteIndexEntry,
  type NetworkTrain,
  type ServiceCategory,
  type StationIndexEntry,
} from '../domain/network.ts'
import {
  buildTrainTimeIndex,
  trainsNearTime,
  type TrainTimeIndex,
} from '../domain/train-time-index.ts'
import {
  compareStationLabelCandidates,
  MAX_STATION_LABELS,
  rankStationsForLabels,
  stationIndexAtScreenPoint,
  stationLabelCameraHeight,
  stationLabelBudget,
  stationLabelRankLimit,
  stationLabelScreenHeight,
  stationLabelScreenWidth,
  stationLabelText,
  stationLabelWorldHeight,
  stationLabelsCanRepopulate,
  stationTapRadius,
  stableStationLabelBudget,
} from './station-labels.ts'
import {
  categoryIsVisibleInAutoMode,
  compareTrainLabelCandidates,
  MAX_TRAIN_LABELS,
  trainLabelArrivalOpacity,
  trainLabelBudget,
  trainLabelScreenHeight,
  trainLabelScreenWidth,
  type TrainLabelMode,
} from './train-labels.ts'
import { edgeTrafficWeights } from './traffic-weights.ts'
import {
  VEHICLE_TRAIL_SEGMENTS,
  VEHICLE_TRAIL_STEP_SECONDS,
  vehicleTrailSampleTimes,
} from './vehicle-trails.ts'
import {
  applyMapZoom,
  homeMapDistanceScale,
  mapCameraDampingRate,
  mapCameraFieldOfView,
  mapPanScale,
  mapSelectionNeedsReveal,
  mapWheelZoomMultiplier,
  minimumMapDistanceScale,
  STATION_SELECTION_PULSE_COUNT,
  stationSelectionPulseFrame,
  type MapCameraFraming,
} from './map-camera.ts'
import {
  pointAlongProjectedPath,
  pointAlongProjectedPathFrom,
  prepareProjectedPath,
  projectedPathRunsForward,
  type ProjectedNetworkPath,
} from './network-paths.ts'
import {
  createLakeAvoidingPathMap,
  lakeAvoidingPathForStops,
  type LakeAvoidingPathMap,
} from './lake-aware-paths.ts'
import {
  localNetworkDetailAtZoom,
  regionalCameraHeight,
  vehicleIsVisibleAtZoom,
} from './regional-lod.ts'
import { AirTrafficLayer } from './AirTrafficLayer.tsx'
import { projectAirPosition } from './air-projection.ts'
import { RoadTrafficLayer } from './RoadTrafficLayer.tsx'

export type MapCameraAction =
  | 'zoom-in'
  | 'zoom-out'
  | 'reset'
  | 'reveal-station'

export interface MapCameraCommand {
  readonly id: number
  readonly action: MapCameraAction
}

interface NationalNetworkSceneProps {
  readonly boundary?: SwissBoundary
  readonly lakes?: SwissLakes
  readonly snapshot: NetworkSnapshot
  readonly referenceSnapshot: NetworkSnapshot
  readonly contextSnapshot?: NetworkSnapshot
  readonly isPlaying: boolean
  readonly time: number
  readonly selectedTrain?: NetworkTrain
  readonly onTime: (time: number) => void
  readonly cameraCommand?: MapCameraCommand
  readonly playbackRate: number
  readonly selectedCategory?: ServiceCategory
  readonly selectedRoute?: NetworkRouteIndexEntry
  readonly selectedStation?: StationIndexEntry
  readonly onSelectStation?: (station: StationIndexEntry) => void
  readonly stations: readonly StationIndexEntry[]
  readonly trainLabelMode: TrainLabelMode
  readonly cameraFraming: MapCameraFraming
  readonly airSnapshot?: AirSnapshot
  readonly airCategorySelected?: boolean
  readonly roadSnapshot?: RoadTrafficSnapshot
  readonly roadCategorySelected?: boolean
  readonly selectedAirTrack?: AirTrack
  readonly onSelectAirTrack?: (trackId: string) => void
}

type ProjectedStop = readonly [x: number, y: number, z: number]

const EMPTY_LAKE_AVOIDING_PATHS: LakeAvoidingPathMap = new Map()
const LakeAvoidingPathsContext = createContext<LakeAvoidingPathMap>(
  EMPTY_LAKE_AVOIDING_PATHS,
)

const STATION_SURFACE_Y = 0.035

const MAP_LAYER = {
  selectionGlow: 6,
  selectionCore: 7,
  selectionStopGlow: 8,
  selectionStopCore: 9,
  vehicleGlow: 10,
  vehicleCore: 11,
  vehicleSpark: 12,
  focusMarkerGlow: 13,
  focusMarkerCore: 14,
  trainLabel: 16,
  stationLabel: 20,
} as const

export interface NetworkProjection {
  readonly centreLongitude: number
  readonly centreLatitude: number
  readonly longitudeScale: number
  readonly scale: number
}

function createNetworkProjection(snapshot: NetworkSnapshot): NetworkProjection {
  const { bounds } = snapshot
  const centreLongitude = (bounds.minLongitude + bounds.maxLongitude) / 2
  const centreLatitude = (bounds.minLatitude + bounds.maxLatitude) / 2
  const longitudeScale = Math.cos((centreLatitude * Math.PI) / 180)
  const projectedWidth =
    (bounds.maxLongitude - bounds.minLongitude) * longitudeScale
  return {
    centreLongitude,
    centreLatitude,
    longitudeScale,
    scale: 51 / projectedWidth,
  }
}

function projectCoordinate(
  [longitude, latitude]: BoundaryCoordinate,
  projection: NetworkProjection,
  height = 0,
): ProjectedStop {
  return [
    (longitude - projection.centreLongitude) *
      projection.longitudeScale *
      projection.scale,
    height,
    -(latitude - projection.centreLatitude) * projection.scale,
  ]
}

function projectStops(
  snapshot: NetworkSnapshot,
  projection: NetworkProjection,
): readonly ProjectedStop[] {
  return snapshot.stops.map(([longitude, latitude]) =>
    projectCoordinate([longitude, latitude], projection),
  )
}

function projectPaths(
  snapshot: NetworkSnapshot,
  projection: NetworkProjection,
): readonly ProjectedNetworkPath[] {
  return (snapshot.paths ?? []).map((path) =>
    prepareProjectedPath(
      path.map((coordinate) => projectCoordinate(coordinate, projection)),
    ),
  )
}

function segmentPoints(
  train: NetworkTrain,
  segmentIndex: number,
  projectedStops: readonly ProjectedStop[],
  projectedPaths: readonly ProjectedNetworkPath[],
  lakeAvoidingPaths: LakeAvoidingPathMap = EMPTY_LAKE_AVOIDING_PATHS,
): readonly ProjectedStop[] {
  const pathIndex = train.pathSegments?.[segmentIndex]
  if (pathIndex !== undefined && pathIndex !== null) {
    const path = projectedPaths[pathIndex]
    if (path?.points.length) {
      const fromIndex = train.stops[segmentIndex]?.[0]
      const from = fromIndex === undefined ? undefined : projectedStops[fromIndex]
      if (!from || projectedPathRunsForward(path, from)) return path.points
      return [...path.points].reverse()
    }
  }
  const fromIndex = train.stops[segmentIndex]?.[0]
  const toIndex = train.stops[segmentIndex + 1]?.[0]
  if (fromIndex === undefined || toIndex === undefined) return []
  const detour = lakeAvoidingPathForStops(
    lakeAvoidingPaths,
    fromIndex,
    toIndex,
  )
  if (detour) return detour.points
  const from = projectedStops[fromIndex]
  const to = projectedStops[toIndex]
  return from && to ? [from, to] : []
}

function appendLineSegments(
  positions: number[],
  points: readonly ProjectedStop[],
  height: number,
) {
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    positions.push(from[0], height, from[2], to[0], height, to[2])
  }
}

function projectedTrainPosition(
  train: NetworkTrain,
  time: number,
  projectedStops: readonly ProjectedStop[],
  projectedPaths: readonly ProjectedNetworkPath[] = [],
  lakeAvoidingPaths: LakeAvoidingPathMap = EMPTY_LAKE_AVOIDING_PATHS,
): ProjectedStop | undefined {
  const position = positionForTrain(train, time)
  if (!position) return undefined
  const pathIndex =
    position.segmentIndex === undefined
      ? undefined
      : train.pathSegments?.[position.segmentIndex]
  const path =
    pathIndex === undefined || pathIndex === null
      ? undefined
      : projectedPaths[pathIndex]
  if (path) {
    const from = projectedStops[position.fromStop]
    const point = from
      ? pointAlongProjectedPathFrom(path, position.progress, from)
      : pointAlongProjectedPath(path, position.progress)
    if (point) return [point[0], 0.2, point[2]]
  }
  const detour = lakeAvoidingPathForStops(
    lakeAvoidingPaths,
    position.fromStop,
    position.toStop,
  )
  if (detour) {
    const point = pointAlongProjectedPath(detour, position.progress)
    if (point) return [point[0], 0.2, point[2]]
  }
  const from = projectedStops[position.fromStop]
  const to = projectedStops[position.toStop]
  if (!from || !to) return undefined
  return [
    THREE.MathUtils.lerp(from[0], to[0], position.progress),
    0.2,
    THREE.MathUtils.lerp(from[2], to[2], position.progress),
  ]
}

function NationalGround() {
  return (
    <group position={[0, -0.11, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[66, 56, 64, 48]} />
        <meshBasicMaterial color="#090b1f" transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[66, 56, 64, 48]} />
        <meshBasicMaterial color="#424b98" transparent opacity={0.1} wireframe />
      </mesh>
    </group>
  )
}

function LakeLayer({
  lakes,
  projection,
  subdued,
}: {
  readonly lakes: SwissLakes
  readonly projection: NetworkProjection
  readonly subdued: boolean
}) {
  const geometry = useMemo(() => {
    const shapes: THREE.Shape[] = []
    const shorelinePositions: number[] = []

    for (const lake of lakes.lakes) {
      for (const polygon of lake.polygons) {
        const [outerRing, ...holes] = polygon
        if (!outerRing || outerRing.length < 4) continue
        const outer = outerRing.map((coordinate) => {
          const [x, , z] = projectCoordinate(coordinate, projection)
          return new THREE.Vector2(x, z)
        })
        const shape = new THREE.Shape(outer)
        for (const holeRing of holes) {
          const hole = holeRing.map((coordinate) => {
            const [x, , z] = projectCoordinate(coordinate, projection)
            return new THREE.Vector2(x, z)
          })
          if (hole.length >= 4) shape.holes.push(new THREE.Path(hole))
        }
        shapes.push(shape)

        for (const ring of polygon) {
          const projected = ring.map((coordinate) =>
            projectCoordinate(coordinate, projection),
          )
          if (projected.length < 2) continue
          const isClosed =
            projected[0][0] === projected.at(-1)?.[0] &&
            projected[0][2] === projected.at(-1)?.[2]
          appendLineSegments(
            shorelinePositions,
            isClosed ? projected : [...projected, projected[0]],
            0,
          )
        }
      }
    }

    const fill = new THREE.ShapeGeometry(shapes)
    fill.rotateX(Math.PI / 2)
    const shoreline = new THREE.BufferGeometry()
    shoreline.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(shorelinePositions, 3),
    )
    return { fill, shoreline }
  }, [lakes.lakes, projection])

  useEffect(
    () => () => {
      geometry.fill.dispose()
      geometry.shoreline.dispose()
    },
    [geometry],
  )

  return (
    <group position={[0, -0.072, 0]}>
      <mesh geometry={geometry.fill} renderOrder={1}>
        <meshBasicMaterial
          color="#08233b"
          transparent
          opacity={subdued ? 0.42 : 0.9}
          depthWrite={false}
          side={THREE.DoubleSide}
          fog={false}
        />
      </mesh>
      <mesh geometry={geometry.fill} position={[0, 0.007, 0]} renderOrder={1}>
        <meshBasicMaterial
          color="#20a9cb"
          transparent
          opacity={subdued ? 0.035 : 0.13}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <lineSegments
        geometry={geometry.shoreline}
        position={[0, 0.014, 0]}
        renderOrder={2}
      >
        <lineBasicMaterial
          color="#54dff7"
          transparent
          opacity={subdued ? 0.06 : 0.31}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </lineSegments>
    </group>
  )
}

function CountryBorder({
  boundary,
  projection,
  subdued,
}: {
  readonly boundary: SwissBoundary
  readonly projection: NetworkProjection
  readonly subdued: boolean
}) {
  const tubes = useMemo(() => {
    return boundary.rings.flatMap((ring, index) => {
      const coordinates =
        ring.length > 1 &&
        ring[0][0] === ring[ring.length - 1][0] &&
        ring[0][1] === ring[ring.length - 1][1]
          ? ring.slice(0, -1)
          : ring
      if (coordinates.length < 4) return []
      const points = coordinates.map((coordinate) => {
        const [x, y, z] = projectCoordinate(coordinate, projection, 0.075)
        return new THREE.Vector3(x, y, z)
      })
      const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5)
      const segments = THREE.MathUtils.clamp(points.length * 2, 24, 920)
      return [{
        id: `${index}:${coordinates.length}`,
        glow: new THREE.TubeGeometry(curve, segments, 0.13, 5, true),
        core: new THREE.TubeGeometry(curve, segments, 0.026, 5, true),
      }]
    })
  }, [boundary.rings, projection])

  useEffect(
    () => () => {
      tubes.forEach(({ glow, core }) => {
        glow.dispose()
        core.dispose()
      })
    },
    [tubes],
  )

  return (
    <group>
      {tubes.map(({ id, glow, core }) => (
        <group key={id}>
          <mesh geometry={glow}>
            <meshBasicMaterial
              color="#56e9ff"
              transparent
              opacity={subdued ? 0.018 : 0.12}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              fog={false}
            />
          </mesh>
          <mesh geometry={core} renderOrder={2}>
            <meshBasicMaterial
              color="#b9fbff"
              transparent
              opacity={subdued ? 0.13 : 0.84}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              fog={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function RailGraph({
  snapshot,
  projectedStops,
  projectedPaths,
  cameraFraming,
  subdued,
  lakeAvoidingPaths,
  showTraffic = true,
}: {
  readonly snapshot: NetworkSnapshot
  readonly projectedStops: readonly ProjectedStop[]
  readonly projectedPaths: readonly ProjectedNetworkPath[]
  readonly cameraFraming: MapCameraFraming
  readonly subdued: boolean
  readonly lakeAvoidingPaths: LakeAvoidingPathMap
  readonly showTraffic?: boolean
}) {
  const { camera } = useThree()
  const stationMaterial = useRef<THREE.PointsMaterial>(null)
  const localNetworkMaterial = useRef<THREE.LineBasicMaterial>(null)
  const stationTexture = useMemo(() => trainLightTexture('orb'), [])
  const railGeometry = useMemo(() => {
    const structuralPositions: number[] = []
    const localPositions: number[] = []
    snapshot.edges.forEach(([fromIndex, toIndex], edgeIndex) => {
      const from = projectedStops[fromIndex]
      const to = projectedStops[toIndex]
      if (!from || !to) return
      const pathIndex = snapshot.edgePaths?.[edgeIndex]
      const path =
        pathIndex === undefined || pathIndex === null
          ? undefined
          : projectedPaths[pathIndex]
      const detour = lakeAvoidingPathForStops(
        lakeAvoidingPaths,
        fromIndex,
        toIndex,
      )
      appendLineSegments(
        pathIndex === undefined || pathIndex === null
          ? structuralPositions
          : localPositions,
        path?.points ?? detour?.points ?? [from, to],
        0,
      )
    })
    const structural = new THREE.BufferGeometry()
    structural.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(structuralPositions, 3),
    )
    const local = new THREE.BufferGeometry()
    local.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(localPositions, 3),
    )
    return { structural, local }
  }, [
    lakeAvoidingPaths,
    projectedPaths,
    projectedStops,
    snapshot.edgePaths,
    snapshot.edges,
  ])

  const stationGeometry = useMemo(() => {
    const positions = new Float32Array(projectedStops.length * 3)
    projectedStops.forEach((stop, index) => positions.set(stop, index * 3))
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [projectedStops])

  useEffect(
    () => () => {
      stationTexture.dispose()
      railGeometry.structural.dispose()
      railGeometry.local.dispose()
    },
    [railGeometry, stationTexture],
  )

  useFrame(() => {
    if (!stationMaterial.current || !localNetworkMaterial.current) return
    const cameraScale = THREE.MathUtils.clamp(camera.position.y / 37, 0.02, 1)
    stationMaterial.current.size = 0.065 * cameraScale
    const detail = localNetworkDetailAtZoom(camera.position.y, cameraFraming)
    localNetworkMaterial.current.opacity = subdued
      ? 0.008 + detail * 0.025
      : 0.025 + detail * 0.115
  })

  return (
    <>
      <lineSegments geometry={railGeometry.structural}>
        <lineBasicMaterial
          color="#7296bb"
          transparent
          opacity={subdued ? 0.035 : 0.14}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <lineSegments geometry={railGeometry.local}>
        <lineBasicMaterial
          ref={localNetworkMaterial}
          color="#7296bb"
          transparent
          opacity={subdued ? 0.035 : 0.14}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      {showTraffic && (
        <TrafficFlowLayer
          snapshot={snapshot}
          projectedStops={projectedStops}
          projectedPaths={projectedPaths}
          lakeAvoidingPaths={lakeAvoidingPaths}
          subdued={subdued}
        />
      )}
      <points geometry={stationGeometry} position={[0, STATION_SURFACE_Y, 0]}>
        <pointsMaterial
          ref={stationMaterial}
          color="#a18cff"
          map={stationTexture}
          size={0.065}
          transparent
          opacity={subdued ? 0.055 : 0.4}
          alphaTest={0.015}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
    </>
  )
}

function TrafficFlowLayer({
  snapshot,
  projectedStops,
  projectedPaths,
  lakeAvoidingPaths,
  subdued,
}: {
  readonly snapshot: NetworkSnapshot
  readonly projectedStops: readonly ProjectedStop[]
  readonly projectedPaths: readonly ProjectedNetworkPath[]
  readonly lakeAvoidingPaths: LakeAvoidingPathMap
  readonly subdued: boolean
}) {
  const pulseMaterial = useRef<THREE.LineBasicMaterial>(null)
  const geometries = useMemo(() => {
    const { strengths } = edgeTrafficWeights(snapshot)
    const weightedPositions: number[] = []
    const weightedColors: number[] = []
    const pulsePositions: number[] = []
    const pulseColors: number[] = []
    const quiet = new THREE.Color('#18204a')
    const busy = new THREE.Color('#8dfaff')

    snapshot.edges.forEach(([fromIndex, toIndex], edgeIndex) => {
      const strength = strengths[edgeIndex] ?? 0
      const from = projectedStops[fromIndex]
      const to = projectedStops[toIndex]
      if (!strength || !from || !to) return
      const pathIndex = snapshot.edgePaths?.[edgeIndex]
      const path =
        pathIndex === undefined || pathIndex === null
          ? undefined
          : projectedPaths[pathIndex]
      const detour = lakeAvoidingPathForStops(
        lakeAvoidingPaths,
        fromIndex,
        toIndex,
      )
      const points = path?.points ?? detour?.points ?? [from, to]

      const color = quiet.clone().lerp(busy, strength)
      color.multiplyScalar(0.2 + strength * 0.8)
      appendLineSegments(weightedPositions, points, 0)
      for (let index = 1; index < points.length; index += 1) {
        weightedColors.push(color.r, color.g, color.b, color.r, color.g, color.b)
      }

      if (strength >= 0.82) {
        appendLineSegments(pulsePositions, points, 0)
        for (let index = 1; index < points.length; index += 1) {
          pulseColors.push(color.r, color.g, color.b, color.r, color.g, color.b)
        }
      }
    })

    const weighted = new THREE.BufferGeometry()
    weighted.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(weightedPositions, 3),
    )
    weighted.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(weightedColors, 3),
    )
    const pulse = new THREE.BufferGeometry()
    pulse.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(pulsePositions, 3),
    )
    pulse.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(pulseColors, 3),
    )
    return { weighted, pulse }
  }, [lakeAvoidingPaths, projectedPaths, projectedStops, snapshot])

  useEffect(
    () => () => {
      geometries.weighted.dispose()
      geometries.pulse.dispose()
    },
    [geometries],
  )

  useFrame(({ clock }) => {
    if (!pulseMaterial.current) return
    const wave = 0.5 + Math.sin(clock.elapsedTime * 1.35) * 0.5
    pulseMaterial.current.opacity = subdued
      ? 0.012 + wave * 0.012
      : 0.1 + wave * 0.12
  })

  return (
    <group position={[0, 0.055, 0]}>
      <lineSegments geometry={geometries.weighted} renderOrder={1}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={subdued ? 0.045 : 0.62}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <lineSegments geometry={geometries.pulse} renderOrder={2}>
        <lineBasicMaterial
          ref={pulseMaterial}
          vertexColors
          transparent
          opacity={subdued ? 0.035 : 0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  )
}

function trainLightTexture(kind: 'halo' | 'orb' | 'spark'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(43, 39, 0, 48, 48, 46)
    if (kind === 'halo') {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
      gradient.addColorStop(0.12, 'rgba(255, 255, 255, 0.72)')
      gradient.addColorStop(0.34, 'rgba(255, 255, 255, 0.3)')
      gradient.addColorStop(0.72, 'rgba(255, 255, 255, 0.07)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    } else if (kind === 'orb') {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.18, 'rgba(255, 255, 255, 0.98)')
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.78)')
      gradient.addColorStop(0.76, 'rgba(255, 255, 255, 0.3)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    } else {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.32, 'rgba(255, 255, 255, 0.96)')
      gradient.addColorStop(0.68, 'rgba(255, 255, 255, 0.18)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    }
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

function realtimeRingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (context) {
    context.strokeStyle = 'rgba(255, 255, 255, 0.96)'
    context.lineWidth = 7
    context.shadowColor = 'rgba(255, 255, 255, 0.8)'
    context.shadowBlur = 10
    context.beginPath()
    context.arc(48, 48, 30, 0, Math.PI * 2)
    context.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

type VehicleMarkerKind = 'rail' | 'tram' | 'bus'

const VEHICLE_MARKER_KINDS: readonly VehicleMarkerKind[] = [
  'rail',
  'tram',
  'bus',
]

function vehicleMarkerKind(category: ServiceCategory): VehicleMarkerKind {
  if (category === 'tram') return 'tram'
  if (category === 'bus') return 'bus'
  return 'rail'
}

function vehicleGlyphTexture(kind: 'tram' | 'bus'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (context) {
    context.strokeStyle = 'rgba(255, 255, 255, 0.98)'
    context.fillStyle = 'rgba(255, 255, 255, 1)'
    context.shadowColor = 'rgba(255, 255, 255, 0.75)'
    context.shadowBlur = 7
    context.lineJoin = 'round'
    context.lineCap = 'round'

    if (kind === 'tram') {
      context.lineWidth = 9
      context.beginPath()
      context.moveTo(48, 17)
      context.lineTo(76, 48)
      context.lineTo(48, 79)
      context.lineTo(20, 48)
      context.closePath()
      context.stroke()
      context.beginPath()
      context.arc(48, 48, 7, 0, Math.PI * 2)
      context.fill()
    } else {
      context.lineWidth = 15
      context.beginPath()
      context.moveTo(25, 48)
      context.lineTo(71, 48)
      context.stroke()
      context.shadowBlur = 0
      context.fillStyle = 'rgba(255, 255, 255, 0.72)'
      context.beginPath()
      context.arc(28, 48, 3.5, 0, Math.PI * 2)
      context.arc(68, 48, 3.5, 0, Math.PI * 2)
      context.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

function SelectedRoute({
  train,
  projectedStops,
  projectedPaths,
}: {
  readonly train: NetworkTrain
  readonly projectedStops: readonly ProjectedStop[]
  readonly projectedPaths: readonly ProjectedNetworkPath[]
}) {
  const lakeAvoidingPaths = useContext(LakeAvoidingPathsContext)
  const line = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let index = 0; index < train.stops.length - 1; index += 1) {
      segmentPoints(
        train,
        index,
        projectedStops,
        projectedPaths,
        lakeAvoidingPaths,
      ).forEach(
        ([x, , z], pointIndex) => {
          if (index > 0 && pointIndex === 0) return
          points.push(new THREE.Vector3(x, 0.12, z))
        },
      )
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: SERVICE_COLORS[train.category],
      transparent: true,
      opacity: 0.95,
      blending: THREE.NormalBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    return new THREE.Line(geometry, material)
  }, [lakeAvoidingPaths, projectedPaths, projectedStops, train])

  useEffect(
    () => () => {
      line.geometry.dispose()
      ;(line.material as THREE.Material).dispose()
    },
    [line],
  )

  return <primitive object={line} renderOrder={MAP_LAYER.selectionCore} />
}

function SelectedLinePaths({
  route,
  snapshot,
  projectedStops,
  projectedPaths,
}: {
  readonly route: NetworkRouteIndexEntry
  readonly snapshot: NetworkSnapshot
  readonly projectedStops: readonly ProjectedStop[]
  readonly projectedPaths: readonly ProjectedNetworkPath[]
}) {
  const lakeAvoidingPaths = useContext(LakeAvoidingPathsContext)
  const glowMaterial = useRef<THREE.LineBasicMaterial>(null)
  const stopTextures = useMemo(
    () => ({
      halo: trainLightTexture('halo'),
      core: trainLightTexture('spark'),
    }),
    [],
  )
  const geometries = useMemo(() => {
    const trainIds = new Set(route.trainIds)
    const usedEdges = new Set<string>()
    const pathPositions: number[] = []

    for (const train of snapshot.trains) {
      if (!trainIds.has(train.id)) continue
      for (let index = 1; index < train.stops.length; index += 1) {
        const firstIndex = train.stops[index - 1][0]
        const secondIndex = train.stops[index][0]
        const pathIndex = train.pathSegments?.[index - 1]
        const key =
          pathIndex === undefined || pathIndex === null
            ? firstIndex < secondIndex
              ? `${firstIndex}:${secondIndex}`
              : `${secondIndex}:${firstIndex}`
            : `path:${pathIndex}`
        if (usedEdges.has(key)) continue
        const points = segmentPoints(
          train,
          index - 1,
          projectedStops,
          projectedPaths,
          lakeAvoidingPaths,
        )
        if (points.length < 2) continue
        usedEdges.add(key)
        appendLineSegments(pathPositions, points, 0.15)
      }
    }

    const stopPositions = route.stopIndexes.flatMap((stopIndex) => {
      const stop = projectedStops[stopIndex]
      return stop ? [stop[0], 0.19, stop[2]] : []
    })
    const path = new THREE.BufferGeometry()
    path.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(pathPositions, 3),
    )
    const stops = new THREE.BufferGeometry()
    stops.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(stopPositions, 3),
    )
    return { path, stops }
  }, [
    projectedPaths,
    projectedStops,
    lakeAvoidingPaths,
    route.stopIndexes,
    route.trainIds,
    snapshot.trains,
  ])

  useEffect(
    () => () => {
      geometries.path.dispose()
      geometries.stops.dispose()
    },
    [geometries],
  )

  useEffect(
    () => () => {
      stopTextures.halo.dispose()
      stopTextures.core.dispose()
    },
    [stopTextures],
  )

  useFrame(({ clock }) => {
    if (!glowMaterial.current) return
    glowMaterial.current.opacity =
      0.12 + (Math.sin(clock.elapsedTime * 1.8) * 0.5 + 0.5) * 0.12
  })

  const color = SERVICE_COLORS[route.category]
  return (
    <group>
      <lineSegments
        geometry={geometries.path}
        renderOrder={MAP_LAYER.selectionCore}
      >
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.96}
          blending={THREE.NormalBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </lineSegments>
      <lineSegments
        geometry={geometries.path}
        renderOrder={MAP_LAYER.selectionGlow}
      >
        <lineBasicMaterial
          ref={glowMaterial}
          color={color}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </lineSegments>
      <points
        geometry={geometries.stops}
        renderOrder={MAP_LAYER.selectionStopGlow}
      >
        <pointsMaterial
          color={color}
          map={stopTextures.halo}
          size={5.2}
          transparent
          opacity={0.3}
          alphaTest={0.01}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          sizeAttenuation={false}
          toneMapped={false}
          fog={false}
        />
      </points>
      <points
        geometry={geometries.stops}
        renderOrder={MAP_LAYER.selectionStopCore}
      >
        <pointsMaterial
          color={color}
          map={stopTextures.core}
          size={2.1}
          transparent
          opacity={0.9}
          alphaTest={0.02}
          blending={THREE.NormalBlending}
          depthTest={false}
          depthWrite={false}
          sizeAttenuation={false}
          toneMapped={false}
          fog={false}
        />
      </points>
    </group>
  )
}

function stationCentre(
  station: StationIndexEntry,
  projectedStops: readonly ProjectedStop[],
): THREE.Vector3 {
  const centre = new THREE.Vector3()
  let count = 0
  station.stopIndexes.forEach((stopIndex) => {
    const stop = projectedStops[stopIndex]
    if (!stop) return
    centre.x += stop[0]
    centre.z += stop[2]
    count += 1
  })
  if (count) centre.multiplyScalar(1 / count)
  return centre
}

interface StationLabelDatum {
  readonly station: StationIndexEntry
  readonly displayName: string
  readonly position: THREE.Vector3
  readonly rank: number
  readonly emphasised: boolean
}

interface StationLabelTexture {
  readonly texture: THREE.CanvasTexture
  readonly aspect: number
  readonly anchorX: number
}

function stationLabelTexture(name: string): StationLabelTexture {
  const canvas = document.createElement('canvas')
  const measuringContext = canvas.getContext('2d')
  const font = '500 30px "Helvetica Neue", Helvetica, Arial, sans-serif'
  measuringContext?.save()
  if (measuringContext) measuringContext.font = font
  const measuredWidth = measuringContext?.measureText(name).width ?? name.length * 19
  measuringContext?.restore()
  canvas.width = Math.ceil(THREE.MathUtils.clamp(measuredWidth + 86, 150, 760))
  canvas.height = 92

  const context = canvas.getContext('2d')
  if (context) {
    context.font = font
    context.textBaseline = 'middle'
    context.shadowColor = 'rgba(5, 4, 16, 0.95)'
    context.shadowBlur = 10
    context.lineWidth = 7
    context.strokeStyle = 'rgba(5, 4, 16, 0.9)'
    context.strokeText(name, 62, 46)
    context.fillStyle = '#f8f7ff'
    context.fillText(name, 62, 46)
    context.beginPath()
    context.arc(31, 46, 6, 0, Math.PI * 2)
    context.fillStyle = '#8dfaff'
    context.shadowColor = '#8dfaff'
    context.shadowBlur = 18
    context.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return {
    texture,
    aspect: canvas.width / canvas.height,
    anchorX: 31 / canvas.width,
  }
}

function StationTapTarget({
  stations,
  projectedStops,
  cameraFraming,
  onSelectStation,
}: {
  readonly stations: readonly StationIndexEntry[]
  readonly projectedStops: readonly ProjectedStop[]
  readonly cameraFraming: MapCameraFraming
  readonly onSelectStation?: (station: StationIndexEntry) => void
}) {
  const { camera, gl } = useThree()
  const rankedStations = useMemo(() => rankStationsForLabels(stations), [stations])

  useEffect(() => {
    if (!onSelectStation) return
    const element = gl.domElement
    const activePointers = new Map<
      number,
      { x: number; y: number; pointerType: string }
    >()
    let multiPointerGesture = false

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
      })
      if (activePointers.size > 1) multiPointerGesture = true
      element.setPointerCapture(event.pointerId)
    }

    const finishPointer = (event: PointerEvent, cancelled: boolean) => {
      const start = activePointers.get(event.pointerId)
      activePointers.delete(event.pointerId)
      const wasMultiPointerGesture = multiPointerGesture
      if (activePointers.size === 0) multiPointerGesture = false
      if (!start || cancelled || wasMultiPointerGesture) return
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
        return
      }

      const semanticHeight = stationLabelCameraHeight(
        camera.position.y,
        cameraFraming,
      )
      const rankLimit = Math.min(
        rankedStations.length,
        stationLabelRankLimit(semanticHeight),
      )
      const rect = element.getBoundingClientRect()
      const projected = new THREE.Vector3()
      const screenPoints = rankedStations
        .slice(0, rankLimit)
        .flatMap((station, index) => {
          projected.copy(stationCentre(station, projectedStops)).project(camera)
          if (
            projected.z < -1 ||
            projected.z > 1 ||
            projected.x < -1.05 ||
            projected.x > 1.05 ||
            projected.y < -1.05 ||
            projected.y > 1.05
          ) {
            return []
          }
          const x = (projected.x * 0.5 + 0.5) * rect.width
          const y = (-projected.y * 0.5 + 0.5) * rect.height
          const screenHeight = stationLabelScreenHeight(false, false)
          const labelWidth = stationLabelScreenWidth(
            stationLabelText(station.name, cameraFraming),
            screenHeight,
          )
          const labelLeft = x - screenHeight * 0.34
          return [
            { index, x, y },
            { index, x: labelLeft + labelWidth * 0.48, y },
            { index, x: labelLeft + labelWidth * 0.86, y },
          ]
        })
      const selectedIndex = stationIndexAtScreenPoint(
        event.clientX - rect.left,
        event.clientY - rect.top,
        screenPoints,
        stationTapRadius(start.pointerType),
      )
      const station =
        selectedIndex === undefined ? undefined : rankedStations[selectedIndex]
      if (station) onSelectStation(station)
    }

    const onPointerUp = (event: PointerEvent) => finishPointer(event, false)
    const onPointerCancel = (event: PointerEvent) => finishPointer(event, true)
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('pointercancel', onPointerCancel)
    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [camera, cameraFraming, gl, onSelectStation, projectedStops, rankedStations])

  return null
}

function StationLabels({
  stations,
  snapshot,
  projectedStops,
  selectedRoute,
  selectedStation,
  selectedTrain,
  cameraFraming,
}: {
  readonly stations: readonly StationIndexEntry[]
  readonly snapshot: NetworkSnapshot
  readonly projectedStops: readonly ProjectedStop[]
  readonly selectedRoute?: NetworkRouteIndexEntry
  readonly selectedStation?: StationIndexEntry
  readonly selectedTrain?: NetworkTrain
  readonly cameraFraming: MapCameraFraming
}) {
  const { camera, size } = useThree()
  const sprites = useRef<Array<THREE.Sprite | null>>([])
  const textures = useRef(new Map<string, StationLabelTexture>())
  const retainedStationNames = useRef(new Set<string>())
  const previousCameraPosition = useRef(new THREE.Vector3())
  const previousCameraQuaternion = useRef(new THREE.Quaternion())
  const cameraWasSampled = useRef(false)
  const cameraStableSeconds = useRef(Number.POSITIVE_INFINITY)
  const routeStationNames = useMemo(() => {
    const stopIndexes = selectedTrain
      ? selectedTrain.stops.map(([stopIndex]) => stopIndex)
      : (selectedRoute?.stopIndexes ?? [])
    return new Set(
      stopIndexes
        .map((stopIndex) => snapshot.stops[stopIndex]?.[2])
        .filter((name): name is string => Boolean(name)),
    )
  }, [selectedRoute, selectedTrain, snapshot.stops])
  const labels = useMemo(() => {
    const ranked = rankStationsForLabels(stations)
    const stationByName = new Map(ranked.map((station) => [station.name, station]))
    const ordered: StationIndexEntry[] = []
    const usedNames = new Set<string>()
    const add = (station: StationIndexEntry | undefined) => {
      if (!station || usedNames.has(station.name)) return
      usedNames.add(station.name)
      ordered.push(station)
    }

    add(selectedStation)
    routeStationNames.forEach((name) => add(stationByName.get(name)))
    ranked.forEach(add)

    return ordered.map((station) => {
      const centre = stationCentre(station, projectedStops)
      return {
        station,
        displayName: stationLabelText(station.name, cameraFraming),
        position: new THREE.Vector3(centre.x, STATION_SURFACE_Y, centre.z),
        rank: ranked.indexOf(station),
        emphasised:
          station.name === selectedStation?.name || routeStationNames.has(station.name),
      } satisfies StationLabelDatum
    })
  }, [cameraFraming, projectedStops, routeStationNames, selectedStation, stations])

  useEffect(
    () => () => {
      textures.current.forEach(({ texture }) => texture.dispose())
      textures.current.clear()
    },
    [],
  )

  useEffect(() => {
    retainedStationNames.current.clear()
  }, [cameraFraming, selectedRoute, selectedStation, selectedTrain])

  useFrame((_, delta) => {
    const semanticHeight = stationLabelCameraHeight(
      camera.position.y,
      cameraFraming,
    )
    const cameraMoved = cameraWasSampled.current && (
      previousCameraPosition.current.distanceToSquared(camera.position) > 0.000025 ||
      1 - Math.abs(previousCameraQuaternion.current.dot(camera.quaternion)) > 0.000001
    )
    cameraWasSampled.current = true
    previousCameraPosition.current.copy(camera.position)
    previousCameraQuaternion.current.copy(camera.quaternion)
    cameraStableSeconds.current = cameraMoved
      ? 0
      : cameraStableSeconds.current + delta
    const canRepopulate = stationLabelsCanRepopulate(cameraStableSeconds.current)
    const budget = stableStationLabelBudget(
      stationLabelBudget(semanticHeight),
      retainedStationNames.current.size,
      canRepopulate,
    )
    const rankLimit = stationLabelRankLimit(semanticHeight)
    const projected = new THREE.Vector3()
    const viewPosition = new THREE.Vector3()
    const candidates: Array<{
      index: number
      x: number
      y: number
      distance: number
      depth: number
      priority: number
      rank: number
      retained: boolean
    }> = []

    sprites.current.forEach((sprite) => {
      if (sprite) sprite.visible = false
    })

    labels.forEach((label, index) => {
      const retained = retainedStationNames.current.has(label.station.name)
      if ((selectedTrain || selectedRoute) && !label.emphasised) return
      if (!label.emphasised && !retained && !canRepopulate) return
      if (
        !label.emphasised &&
        (label.rank < 0 || label.rank >= rankLimit) &&
        (canRepopulate || !retained)
      ) return

      viewPosition.copy(label.position).applyMatrix4(camera.matrixWorldInverse)
      projected.copy(label.position).project(camera)
      if (
        projected.z < -1 ||
        projected.z > 1 ||
        projected.x < -1.08 ||
        projected.x > 1.08 ||
        projected.y < -1.08 ||
        projected.y > 1.08
      ) {
        return
      }
      candidates.push({
        index,
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
        distance: camera.position.distanceTo(label.position),
        depth: Math.max(0.01, -viewPosition.z),
        priority:
          label.station.name === selectedStation?.name ? 0 : label.emphasised ? 1 : 2,
        rank: label.rank,
        retained,
      })
    })

    candidates.sort((first, second) =>
      compareStationLabelCandidates(
        {
          name: labels[first.index].station.name,
          rank: first.rank,
          priority: first.priority,
          retained: first.retained,
          distance: first.distance,
        },
        {
          name: labels[second.index].station.name,
          rank: second.rank,
          priority: second.priority,
          retained: second.retained,
          distance: second.distance,
        },
      ),
    )
    const occupied: Array<{ left: number; right: number; top: number; bottom: number }> = []
    const visibleTextureNames = new Set<string>()
    const nextRetainedStationNames = new Set<string>()
    const verticalFieldOfView =
      camera instanceof THREE.PerspectiveCamera ? camera.fov : 44
    let visible = 0

    for (const candidate of candidates) {
      if (visible >= budget || visible >= MAX_STATION_LABELS) break
      const label = labels[candidate.index]
      const selected = label.station.name === selectedStation?.name
      const screenHeight = stationLabelScreenHeight(selected, label.emphasised)
      const width = stationLabelScreenWidth(label.displayName, screenHeight)
      const box = {
        left: candidate.x - screenHeight * 0.34,
        right: candidate.x + width - screenHeight * 0.34,
        top: candidate.y - screenHeight * 0.5,
        bottom: candidate.y + screenHeight * 0.5,
      }
      const overlaps = occupied.some(
        (other) =>
          box.left < other.right + 5 &&
          box.right > other.left - 5 &&
          box.top < other.bottom + 4 &&
          box.bottom > other.top - 4,
      )
      if (overlaps) continue

      const sprite = sprites.current[visible]
      if (!sprite) continue
      let textureEntry = textures.current.get(label.station.name)
      if (!textureEntry) {
        textureEntry = stationLabelTexture(label.displayName)
        textures.current.set(label.station.name, textureEntry)
      } else {
        textures.current.delete(label.station.name)
        textures.current.set(label.station.name, textureEntry)
      }
      visibleTextureNames.add(label.station.name)
      nextRetainedStationNames.add(label.station.name)
      sprite.visible = true
      sprite.position.copy(label.position)
      sprite.center.set(textureEntry.anchorX, 0.5)
      const worldHeight = stationLabelWorldHeight(
        candidate.depth,
        verticalFieldOfView,
        size.height,
        screenHeight,
      )
      sprite.scale.set(textureEntry.aspect * worldHeight, worldHeight, 1)
      const material = sprite.material as THREE.SpriteMaterial
      if (material.map !== textureEntry.texture) {
        material.map = textureEntry.texture
        material.needsUpdate = true
      }
      material.opacity = label.emphasised ? 1 : 0.78
      occupied.push(box)
      visible += 1
    }

    retainedStationNames.current = nextRetainedStationNames

    if (textures.current.size > 192) {
      for (const [name, entry] of textures.current) {
        if (visibleTextureNames.has(name)) continue
        entry.texture.dispose()
        textures.current.delete(name)
        if (textures.current.size <= 192) break
      }
    }
  })

  return (
    <>
      {Array.from({ length: MAX_STATION_LABELS }, (_, index) => (
        <sprite
          key={index}
          ref={(sprite) => {
            sprites.current[index] = sprite
          }}
          visible={false}
          renderOrder={MAP_LAYER.stationLabel}
        >
          <spriteMaterial
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </>
  )
}

interface TrainLabelTexture {
  readonly texture: THREE.CanvasTexture
  readonly aspect: number
}

function createTrainLabelTexture(label: string, color: string): TrainLabelTexture {
  const canvas = document.createElement('canvas')
  const measuringContext = canvas.getContext('2d')
  const font = '500 27px "DM Mono", monospace'
  if (measuringContext) measuringContext.font = font
  const measuredWidth = measuringContext?.measureText(label).width ?? label.length * 17
  canvas.width = Math.ceil(THREE.MathUtils.clamp(measuredWidth + 88, 190, 720))
  canvas.height = 74

  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = 'rgba(5, 4, 16, 0.82)'
    context.beginPath()
    context.roundRect(5, 6, canvas.width - 10, canvas.height - 12, 10)
    context.fill()
    context.strokeStyle = 'rgba(193, 204, 255, 0.35)'
    context.lineWidth = 2
    context.stroke()

    context.beginPath()
    context.arc(31, 37, 6, 0, Math.PI * 2)
    context.fillStyle = color
    context.shadowColor = color
    context.shadowBlur = 15
    context.fill()

    context.font = font
    context.textBaseline = 'middle'
    context.shadowColor = 'rgba(5, 4, 16, 0.95)'
    context.shadowBlur = 7
    context.fillStyle = '#f8f7ff'
    context.fillText(label, 56, 38)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return { texture, aspect: canvas.width / canvas.height }
}

function trainLabelText(train: NetworkTrain, selected: boolean): string {
  const identity = train.shortName
    ? `${train.route} · ${train.shortName}`
    : train.route
  const delay = train.realtime?.delaySeconds
  const realtimeSuffix =
    train.realtime?.status === 'adjusted' && delay
      ? ` · ${delay > 0 ? '+' : '−'}${Math.round(Math.abs(delay) / 60)}′`
      : ''
  return selected
    ? `${identity}${realtimeSuffix} → ${train.headsign}`
    : `${identity}${realtimeSuffix}`
}

function TrainLabels({
  snapshot,
  projectedStops,
  projectedPaths,
  selectedTrain,
  selectedRoute,
  selectedStation,
  selectedCategory,
  airCategorySelected,
  trainLabelMode,
  isPlaying,
  time,
  playbackRate,
  trainTimeIndex,
  cameraFraming,
}: NationalNetworkSceneProps & {
  readonly projectedStops: readonly ProjectedStop[]
  readonly projectedPaths: readonly ProjectedNetworkPath[]
  readonly trainTimeIndex: TrainTimeIndex
}) {
  const { camera, size } = useThree()
  const lakeAvoidingPaths = useContext(LakeAvoidingPathsContext)
  const sprites = useRef<Array<THREE.Sprite | null>>([])
  const textures = useRef(new Map<string, TrainLabelTexture>())
  const retainedTrainIds = useRef(new Set<string>())
  const localTime = useRef(time)
  const selectedStationTrainIds = useMemo(
    () => new Set(selectedStation?.trainIds ?? []),
    [selectedStation],
  )
  const selectedRouteTrainIds = useMemo(
    () => new Set(selectedRoute?.trainIds ?? []),
    [selectedRoute],
  )

  useEffect(() => {
    localTime.current = time
  }, [time])

  useEffect(
    () => () => {
      textures.current.forEach(({ texture }) => texture.dispose())
      textures.current.clear()
    },
    [],
  )

  useFrame((_, delta) => {
    if (isPlaying) {
      localTime.current += delta * playbackRate
      if (localTime.current > snapshot.metadata.windowEnd) {
        localTime.current = snapshot.metadata.windowStart
      }
    }

    sprites.current.forEach((sprite) => {
      if (sprite) sprite.visible = false
    })
    const semanticCameraHeight = regionalCameraHeight(
      camera.position.y,
      cameraFraming,
    )
    const labelBudget = airCategorySelected
      ? 0
      : selectedTrain
      ? trainLabelMode === 'off'
        ? 0
        : 1
      : trainLabelBudget(semanticCameraHeight, trainLabelMode)
    if (!labelBudget) {
      retainedTrainIds.current.clear()
      return
    }

    const projected = new THREE.Vector3()
    const viewPosition = new THREE.Vector3()
    const candidates: Array<{
      train: NetworkTrain
      position: ProjectedStop
      x: number
      y: number
      depth: number
      selected: boolean
      retained: boolean
      arrivalOpacity: number
    }> = []

    for (const train of trainsNearTime(trainTimeIndex, localTime.current)) {
      const selected = train.id === selectedTrain?.id
      if (selectedTrain && !selected) continue
      if (selectedRoute && !selectedRouteTrainIds.has(train.id)) continue
      if (!selected && selectedStation && !selectedStationTrainIds.has(train.id)) continue
      if (!selected && selectedCategory && train.category !== selectedCategory) continue
      const focused = Boolean(
        selected || selectedRoute || selectedStation || selectedCategory,
      )
      if (
        !vehicleIsVisibleAtZoom(
          train.category,
          camera.position.y,
          cameraFraming,
          focused,
        )
      ) {
        continue
      }
      if (
        !selected &&
        !focused &&
        !selectedCategory &&
        trainLabelMode === 'auto' &&
        !categoryIsVisibleInAutoMode(train.category, semanticCameraHeight)
      ) {
        continue
      }

      const arrivalOpacity = trainLabelArrivalOpacity(
        localTime.current,
        train.end,
        playbackRate,
      )
      if (arrivalOpacity <= 0) continue
      const position = projectedTrainPosition(
        train,
        Math.min(localTime.current, train.end),
        projectedStops,
        projectedPaths,
        lakeAvoidingPaths,
      )
      if (!position) continue
      projected.set(position[0], 0.76, position[2])
      viewPosition.copy(projected).applyMatrix4(camera.matrixWorldInverse)
      projected.project(camera)
      if (
        projected.z < -1 ||
        projected.z > 1 ||
        projected.x < -1.08 ||
        projected.x > 1.08 ||
        projected.y < -1.08 ||
        projected.y > 1.08
      ) {
        continue
      }
      candidates.push({
        train,
        position,
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
        depth: Math.max(0.01, -viewPosition.z),
        selected,
        retained: retainedTrainIds.current.has(train.id),
        arrivalOpacity,
      })
    }

    candidates.sort(
      (first, second) =>
        Number(second.selected) - Number(first.selected) ||
        compareTrainLabelCandidates(
          {
            id: first.train.id,
            category: first.train.category,
            retained: first.retained,
          },
          {
            id: second.train.id,
            category: second.train.category,
            retained: second.retained,
          },
        ),
    )

    const occupied: Array<{ left: number; right: number; top: number; bottom: number }> = []
    const visibleTextureKeys = new Set<string>()
    const nextRetainedTrainIds = new Set<string>()
    const verticalFieldOfView =
      camera instanceof THREE.PerspectiveCamera ? camera.fov : 44
    let visible = 0

    for (const candidate of candidates) {
      if (visible >= labelBudget || visible >= MAX_TRAIN_LABELS) break
      const text = trainLabelText(candidate.train, candidate.selected)
      const screenHeight = trainLabelScreenHeight(
        size.width,
        candidate.selected,
        semanticCameraHeight,
      )
      const width = trainLabelScreenWidth(text, screenHeight)
      const box = {
        left: candidate.x - width / 2,
        right: candidate.x + width / 2,
        top: candidate.y - screenHeight / 2,
        bottom: candidate.y + screenHeight / 2,
      }
      const overlaps = occupied.some(
        (other) =>
          box.left < other.right + 5 &&
          box.right > other.left - 5 &&
          box.top < other.bottom + 4 &&
          box.bottom > other.top - 4,
      )
      if (overlaps && !candidate.selected) continue

      const sprite = sprites.current[visible]
      if (!sprite) continue
      const textureKey = `${candidate.train.category}:${text}`
      let textureEntry = textures.current.get(textureKey)
      if (!textureEntry) {
        textureEntry = createTrainLabelTexture(
          text,
          SERVICE_COLORS[candidate.train.category],
        )
        textures.current.set(textureKey, textureEntry)
      } else {
        textures.current.delete(textureKey)
        textures.current.set(textureKey, textureEntry)
      }
      visibleTextureKeys.add(textureKey)
      nextRetainedTrainIds.add(candidate.train.id)

      sprite.visible = true
      sprite.position.set(candidate.position[0], 0.76, candidate.position[2])
      const worldHeight = stationLabelWorldHeight(
        candidate.depth,
        verticalFieldOfView,
        size.height,
        screenHeight,
      )
      sprite.scale.set(textureEntry.aspect * worldHeight, worldHeight, 1)
      const material = sprite.material as THREE.SpriteMaterial
      if (material.map !== textureEntry.texture) {
        material.map = textureEntry.texture
        material.needsUpdate = true
      }
      material.opacity = (candidate.selected ? 1 : 0.9) * candidate.arrivalOpacity
      occupied.push(box)
      visible += 1
    }

    retainedTrainIds.current = nextRetainedTrainIds

    if (textures.current.size > 180) {
      for (const [key, entry] of textures.current) {
        if (visibleTextureKeys.has(key)) continue
        entry.texture.dispose()
        textures.current.delete(key)
        if (textures.current.size <= 180) break
      }
    }
  })

  return (
    <>
      {Array.from({ length: MAX_TRAIN_LABELS }, (_, index) => (
        <sprite
          key={index}
          ref={(sprite) => {
            sprites.current[index] = sprite
          }}
          visible={false}
          renderOrder={MAP_LAYER.trainLabel}
        >
          <spriteMaterial
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </>
  )
}

function SelectedStationRouteLayer({
  category,
  pathGeometry,
  stopGeometry,
  haloTexture,
  coreTexture,
}: {
  readonly category: ServiceCategory
  readonly pathGeometry: THREE.BufferGeometry
  readonly stopGeometry: THREE.BufferGeometry
  readonly haloTexture: THREE.Texture
  readonly coreTexture: THREE.Texture
}) {
  const glowMaterial = useRef<THREE.LineBasicMaterial>(null)

  useFrame(({ clock }) => {
    if (!glowMaterial.current) return
    const pulse = Math.sin(clock.elapsedTime * 1.55) * 0.5 + 0.5
    glowMaterial.current.opacity = 0.18 + pulse * 0.13
  })

  const color = SERVICE_COLORS[category]
  return (
    <group>
      <lineSegments
        geometry={pathGeometry}
        renderOrder={MAP_LAYER.selectionCore}
      >
        <lineBasicMaterial
          color={color}
          transparent
          opacity={1}
          blending={THREE.NormalBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </lineSegments>
      <lineSegments
        geometry={pathGeometry}
        renderOrder={MAP_LAYER.selectionGlow}
      >
        <lineBasicMaterial
          ref={glowMaterial}
          color="#ffffff"
          transparent
          opacity={0.24}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </lineSegments>
      <points
        geometry={stopGeometry}
        renderOrder={MAP_LAYER.selectionStopGlow}
      >
        <pointsMaterial
          color={color}
          map={haloTexture}
          size={4.2}
          transparent
          opacity={0.36}
          alphaTest={0.01}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          sizeAttenuation={false}
          toneMapped={false}
          fog={false}
        />
      </points>
      <points
        geometry={stopGeometry}
        renderOrder={MAP_LAYER.selectionStopCore}
      >
        <pointsMaterial
          color="#ffffff"
          map={coreTexture}
          size={1.7}
          transparent
          opacity={0.88}
          alphaTest={0.02}
          blending={THREE.NormalBlending}
          depthTest={false}
          depthWrite={false}
          sizeAttenuation={false}
          toneMapped={false}
          fog={false}
        />
      </points>
    </group>
  )
}

function SelectedStationPulse({ centre }: { readonly centre: THREE.Vector3 }) {
  const meshes = useRef<Array<THREE.Mesh | null>>([])
  const materials = useRef<Array<THREE.MeshBasicMaterial | null>>([])
  const origin = useMemo(
    () => new THREE.Vector3(centre.x, 0.29, centre.z),
    [centre],
  )

  useFrame(({ camera, clock, size }) => {
    if (!(camera instanceof THREE.PerspectiveCamera) || size.height <= 0) return
    const distance = camera.position.distanceTo(origin)
    const visibleWorldHeight =
      2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
    const worldUnitsPerPixel = visibleWorldHeight / size.height

    for (let index = 0; index < STATION_SELECTION_PULSE_COUNT; index += 1) {
      const mesh = meshes.current[index]
      const material = materials.current[index]
      if (!mesh || !material) continue
      const frame = stationSelectionPulseFrame(clock.elapsedTime, index)
      mesh.scale.setScalar(frame.radiusPixels * worldUnitsPerPixel)
      material.opacity = frame.opacity
    }
  })

  return (
    <group position={origin}>
      {Array.from({ length: STATION_SELECTION_PULSE_COUNT }, (_, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            meshes.current[index] = mesh
          }}
          rotation={[Math.PI / 2, 0, 0]}
          renderOrder={MAP_LAYER.focusMarkerGlow}
        >
          <torusGeometry args={[1, 0.026, 6, 72]} />
          <meshBasicMaterial
            ref={(material) => {
              materials.current[index] = material
            }}
            color="#8dfaff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function SelectedStationRoutes({
  station,
  snapshot,
  projectedStops,
  projectedPaths,
  selectedCategory,
}: {
  readonly station: StationIndexEntry
  readonly snapshot: NetworkSnapshot
  readonly projectedStops: readonly ProjectedStop[]
  readonly projectedPaths: readonly ProjectedNetworkPath[]
  readonly selectedCategory?: ServiceCategory
}) {
  const lakeAvoidingPaths = useContext(LakeAvoidingPathsContext)
  const textures = useMemo(
    () => ({
      halo: trainLightTexture('halo'),
      core: trainLightTexture('spark'),
    }),
    [],
  )
  const lines = useMemo(() => {
    const trainIds = new Set(station.trainIds)
    const pathsByCategory = new Map<ServiceCategory, Map<string, number[]>>()
    const stopsByCategory = new Map<ServiceCategory, Set<number>>()
    for (const train of snapshot.trains) {
      if (!trainIds.has(train.id)) continue
      if (selectedCategory && train.category !== selectedCategory) continue
      const categoryPaths = pathsByCategory.get(train.category) ?? new Map()
      const categoryStops = stopsByCategory.get(train.category) ?? new Set()
      train.stops.forEach(([stopIndex]) => categoryStops.add(stopIndex))
      for (let index = 1; index < train.stops.length; index += 1) {
        const firstIndex = train.stops[index - 1][0]
        const secondIndex = train.stops[index][0]
        const pathIndex = train.pathSegments?.[index - 1]
        const key =
          pathIndex === undefined || pathIndex === null
            ? firstIndex < secondIndex
              ? `${firstIndex}:${secondIndex}`
              : `${secondIndex}:${firstIndex}`
            : `path:${pathIndex}`
        if (categoryPaths.has(key)) continue
        const points = segmentPoints(
          train,
          index - 1,
          projectedStops,
          projectedPaths,
          lakeAvoidingPaths,
        )
        if (points.length < 2) continue
        const positions: number[] = []
        appendLineSegments(positions, points, 0.14)
        categoryPaths.set(key, positions)
      }
      pathsByCategory.set(train.category, categoryPaths)
      stopsByCategory.set(train.category, categoryStops)
    }

    return [...pathsByCategory.entries()].map(([category, paths]) => {
      const pathGeometry = new THREE.BufferGeometry()
      pathGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([...paths.values()].flat(), 3),
      )
      const stopPositions = [...(stopsByCategory.get(category) ?? [])].flatMap(
        (stopIndex) => {
          const stop = projectedStops[stopIndex]
          return stop ? [stop[0], 0.2, stop[2]] : []
        },
      )
      const stopGeometry = new THREE.BufferGeometry()
      stopGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(stopPositions, 3),
      )
      return { category, pathGeometry, stopGeometry }
    })
  }, [
    projectedPaths,
    projectedStops,
    lakeAvoidingPaths,
    selectedCategory,
    snapshot.trains,
    station.trainIds,
  ])

  useEffect(
    () => () =>
      lines.forEach(({ pathGeometry, stopGeometry }) => {
        pathGeometry.dispose()
        stopGeometry.dispose()
      }),
    [lines],
  )

  useEffect(
    () => () => {
      textures.halo.dispose()
      textures.core.dispose()
    },
    [textures],
  )

  const centre = useMemo(
    () => stationCentre(station, projectedStops),
    [projectedStops, station],
  )
  const centreGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([centre.x, 0.3, centre.z], 3),
    )
    return geometry
  }, [centre])

  useEffect(() => () => centreGeometry.dispose(), [centreGeometry])

  return (
    <>
      {lines.map(({ category, pathGeometry, stopGeometry }) => (
        <SelectedStationRouteLayer
          key={category}
          category={category}
          pathGeometry={pathGeometry}
          stopGeometry={stopGeometry}
          haloTexture={textures.halo}
          coreTexture={textures.core}
        />
      ))}
      <SelectedStationPulse centre={centre} />
      <points
        geometry={centreGeometry}
        renderOrder={MAP_LAYER.focusMarkerGlow}
      >
        <pointsMaterial
          color="#8dfaff"
          map={textures.halo}
          size={25}
          transparent
          opacity={0.78}
          alphaTest={0.01}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          sizeAttenuation={false}
          toneMapped={false}
          fog={false}
        />
      </points>
      <points
        geometry={centreGeometry}
        renderOrder={MAP_LAYER.focusMarkerCore}
      >
        <pointsMaterial
          color="#ffffff"
          map={textures.core}
          size={5.4}
          transparent
          opacity={1}
          alphaTest={0.02}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          sizeAttenuation={false}
          toneMapped={false}
          fog={false}
        />
      </points>
      <group position={[centre.x, 0.28, centre.z]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.055, 8, 48]} />
          <meshBasicMaterial color="#ffffff" blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color="#ffffff" emissive="#8dfaff" emissiveIntensity={5} />
        </mesh>
        <pointLight color="#8dfaff" intensity={7} distance={5} />
      </group>
    </>
  )
}

function TrainSwarm({
  snapshot,
  projectedStops,
  projectedPaths,
  selectedTrain,
  selectedRoute,
  isPlaying,
  time,
  onTime,
  playbackRate,
  selectedCategory,
  airCategorySelected,
  selectedStation,
  trainTimeIndex,
  cameraFraming,
}: NationalNetworkSceneProps & {
  readonly projectedStops: readonly ProjectedStop[]
  readonly projectedPaths: readonly ProjectedNetworkPath[]
  readonly trainTimeIndex: TrainTimeIndex
}) {
  const lakeAvoidingPaths = useContext(LakeAvoidingPathsContext)
  const points = useRef<THREE.Points>(null)
  const glow = useRef<THREE.Points>(null)
  const localTime = useRef(time)
  const lastReport = useRef(0)
  const selectedStationTrainIds = useMemo(
    () => new Set(selectedStation?.trainIds ?? []),
    [selectedStation],
  )
  const selectedRouteTrainIds = useMemo(
    () => new Set(selectedRoute?.trainIds ?? []),
    [selectedRoute],
  )
  const lightTextures = useMemo(
    () => ({
      halo: trainLightTexture('halo'),
      orb: trainLightTexture('orb'),
      spark: trainLightTexture('spark'),
      realtime: realtimeRingTexture(),
      tram: vehicleGlyphTexture('tram'),
      bus: vehicleGlyphTexture('bus'),
    }),
    [],
  )
  const palette = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(SERVICE_COLORS).map(([category, color]) => [
          category,
          new THREE.Color(color),
        ]),
      ) as Record<ServiceCategory, THREE.Color>,
    [],
  )
  const geometries = useMemo(() => {
    const categoryCounts: Record<VehicleMarkerKind, number> = {
      rail: 0,
      tram: 0,
      bus: 0,
    }
    snapshot.trains.forEach((train) => {
      categoryCounts[vehicleMarkerKind(train.category)] += 1
    })
    return Object.fromEntries(
      VEHICLE_MARKER_KINDS.map((kind) => {
        const geometry = new THREE.BufferGeometry()
        const length = categoryCounts[kind] * 3
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array(length), 3),
        )
        geometry.setAttribute(
          'color',
          new THREE.BufferAttribute(new Float32Array(length), 3),
        )
        geometry.setDrawRange(0, 0)
        return [kind, geometry]
      }),
    ) as Record<VehicleMarkerKind, THREE.BufferGeometry>
  }, [snapshot.trains])
  const realtimeGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(snapshot.trains.length * 3), 3),
    )
    geometry.setDrawRange(0, 0)
    return geometry
  }, [snapshot.trains])

  useEffect(() => {
    localTime.current = time
  }, [time])

  useEffect(
    () => () => {
      lightTextures.halo.dispose()
      lightTextures.orb.dispose()
      lightTextures.spark.dispose()
      lightTextures.realtime.dispose()
      lightTextures.tram.dispose()
      lightTextures.bus.dispose()
    },
    [lightTextures],
  )

  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose())
      realtimeGeometry.dispose()
    },
    [geometries, realtimeGeometry],
  )

  useFrame((state, delta) => {
    if (isPlaying) {
      localTime.current += delta * playbackRate
      if (localTime.current > snapshot.metadata.windowEnd) {
        localTime.current = snapshot.metadata.windowStart
      }
    }

    const activeCounts: Record<VehicleMarkerKind, number> = {
      rail: 0,
      tram: 0,
      bus: 0,
    }
    let activeRealtimeCount = 0
    for (const train of trainsNearTime(trainTimeIndex, localTime.current)) {
      const focused = Boolean(
        selectedTrain?.id === train.id ||
          (selectedRoute && selectedRouteTrainIds.has(train.id)) ||
          (selectedStation && selectedStationTrainIds.has(train.id)) ||
          selectedCategory === train.category,
      )
      if (
        !vehicleIsVisibleAtZoom(
          train.category,
          state.camera.position.y,
          cameraFraming,
          focused,
        )
      ) {
        continue
      }
      const position = projectedTrainPosition(
        train,
        localTime.current,
        projectedStops,
        projectedPaths,
        lakeAvoidingPaths,
      )
      if (!position) continue
      const markerKind = vehicleMarkerKind(train.category)
      const mutableGeometry = geometries[markerKind]
      const positionAttribute = mutableGeometry.getAttribute(
        'position',
      ) as THREE.BufferAttribute
      const colorAttribute = mutableGeometry.getAttribute(
        'color',
      ) as THREE.BufferAttribute
      const mutablePositions = positionAttribute.array as Float32Array
      const mutableColors = colorAttribute.array as Float32Array
      const offset = activeCounts[markerKind] * 3
      mutablePositions.set(position, offset)
      const color = palette[train.category] ?? palette.other
      const stationIncludesTrain =
        !selectedStation || selectedStationTrainIds.has(train.id)
      const categoryIncludesTrain =
        !selectedCategory || selectedCategory === train.category
      const routeIncludesTrain =
        !selectedRoute || selectedRouteTrainIds.has(train.id)
      const intensity = airCategorySelected
        ? 0.025
        : selectedTrain
        ? selectedTrain.id === train.id
          ? 1
          : 0.025
        : !stationIncludesTrain || !categoryIncludesTrain || !routeIncludesTrain
          ? 0.025
          : 1
      mutableColors[offset] = color.r * intensity
      mutableColors[offset + 1] = color.g * intensity
      mutableColors[offset + 2] = color.b * intensity
      activeCounts[markerKind] += 1
      if (train.realtime?.status === 'adjusted') {
        const realtimePositions = realtimeGeometry.getAttribute('position')
          .array as Float32Array
        realtimePositions.set(position, activeRealtimeCount * 3)
        activeRealtimeCount += 1
      }
    }

    VEHICLE_MARKER_KINDS.forEach((kind) => {
      const mutableGeometry = geometries[kind]
      mutableGeometry.getAttribute('position').needsUpdate = true
      mutableGeometry.getAttribute('color').needsUpdate = true
      mutableGeometry.setDrawRange(0, activeCounts[kind])
    })
    realtimeGeometry.getAttribute('position').needsUpdate = true
    realtimeGeometry.setDrawRange(0, activeRealtimeCount)
    if (points.current) points.current.frustumCulled = false
    if (glow.current) glow.current.frustumCulled = false

    if (state.clock.elapsedTime - lastReport.current > 0.1) {
      lastReport.current = state.clock.elapsedTime
      onTime(localTime.current)
    }
  })

  return (
    <>
      {VEHICLE_MARKER_KINDS.map((kind) => {
        const isCityVehicle = kind === 'tram' || kind === 'bus'
        const glyphTexture =
          kind === 'tram'
            ? lightTextures.tram
            : kind === 'bus'
              ? lightTextures.bus
              : lightTextures.orb
        return (
          <group key={kind}>
            <points
              ref={kind === 'rail' ? glow : undefined}
              geometry={geometries[kind]}
              frustumCulled={false}
              renderOrder={MAP_LAYER.vehicleGlow}
            >
              <pointsMaterial
                vertexColors
                map={lightTextures.halo}
                size={isCityVehicle ? 7.5 : 9}
                transparent
                opacity={
                  selectedTrain ||
                  selectedRoute ||
                  selectedCategory ||
                  selectedStation ||
                  airCategorySelected
                    ? 0.055
                    : isCityVehicle
                      ? 0.11
                      : 0.15
                }
                alphaTest={0.005}
                depthTest={false}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                sizeAttenuation={false}
                toneMapped={false}
              />
            </points>
            <points
              ref={kind === 'rail' ? points : undefined}
              geometry={geometries[kind]}
              frustumCulled={false}
              renderOrder={MAP_LAYER.vehicleCore}
            >
              <pointsMaterial
                vertexColors
                map={glyphTexture}
                size={kind === 'rail' ? 4.6 : 6.2}
                transparent
                opacity={isCityVehicle ? 0.95 : 0.9}
                alphaTest={0.035}
                depthTest={false}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                sizeAttenuation={false}
                toneMapped={false}
              />
            </points>
            {kind === 'rail' && (
              <points
                geometry={geometries[kind]}
                frustumCulled={false}
                renderOrder={MAP_LAYER.vehicleSpark}
              >
                <pointsMaterial
                  vertexColors
                  map={lightTextures.spark}
                  size={1.8}
                  transparent
                  opacity={1}
                  alphaTest={0.025}
                  depthTest={false}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  sizeAttenuation={false}
                  toneMapped={false}
                />
              </points>
            )}
          </group>
        )
      })}
      <points
        geometry={realtimeGeometry}
        frustumCulled={false}
        renderOrder={MAP_LAYER.focusMarkerGlow}
      >
        <pointsMaterial
          color="#8dfaff"
          map={lightTextures.realtime}
          size={10}
          transparent
          opacity={0.9}
          alphaTest={0.02}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation={false}
          toneMapped={false}
        />
      </points>
    </>
  )
}

function VehicleTrails({
  snapshot,
  projectedStops,
  projectedPaths,
  selectedTrain,
  selectedRoute,
  selectedCategory,
  airCategorySelected,
  selectedStation,
  isPlaying,
  time,
  playbackRate,
  trainTimeIndex,
  cameraFraming,
}: NationalNetworkSceneProps & {
  readonly projectedStops: readonly ProjectedStop[]
  readonly projectedPaths: readonly ProjectedNetworkPath[]
  readonly trainTimeIndex: TrainTimeIndex
}) {
  const lakeAvoidingPaths = useContext(LakeAvoidingPathsContext)
  const localTime = useRef(time)
  const lastUpdate = useRef(-1)
  const selectedStationTrainIds = useMemo(
    () => new Set(selectedStation?.trainIds ?? []),
    [selectedStation],
  )
  const selectedRouteTrainIds = useMemo(
    () => new Set(selectedRoute?.trainIds ?? []),
    [selectedRoute],
  )
  const palette = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(SERVICE_COLORS).map(([category, color]) => [
          category,
          new THREE.Color(color),
        ]),
      ) as Record<ServiceCategory, THREE.Color>,
    [],
  )
  const geometries = useMemo(
    () =>
      Array.from({ length: VEHICLE_TRAIL_SEGMENTS }, () => {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(
            new Float32Array(snapshot.trains.length * 6),
            3,
          ),
        )
        geometry.setAttribute(
          'color',
          new THREE.BufferAttribute(
            new Float32Array(snapshot.trains.length * 6),
            3,
          ),
        )
        geometry.setDrawRange(0, 0)
        return geometry
      }),
    [snapshot.trains.length],
  )

  useEffect(() => {
    localTime.current = time
  }, [time])

  useEffect(
    () => () => {
      geometries.forEach((geometry) => geometry.dispose())
    },
    [geometries],
  )

  useFrame(({ clock, camera }, delta) => {
    if (isPlaying) {
      localTime.current += delta * playbackRate
      if (localTime.current > snapshot.metadata.windowEnd) {
        localTime.current = snapshot.metadata.windowStart
      }
    }
    if (clock.elapsedTime - lastUpdate.current < 1 / 30) return
    lastUpdate.current = clock.elapsedTime

    const sampleTimes = vehicleTrailSampleTimes(localTime.current)
    const segmentCounts = new Array<number>(VEHICLE_TRAIL_SEGMENTS).fill(0)
    const positionArrays = geometries.map(
      (geometry) =>
        geometry.getAttribute('position').array as Float32Array,
    )
    const colorArrays = geometries.map(
      (geometry) => geometry.getAttribute('color').array as Float32Array,
    )

    for (const train of trainsNearTime(trainTimeIndex, localTime.current)) {
      if (airCategorySelected) continue
      if (selectedTrain && train.id !== selectedTrain.id) continue
      if (selectedRoute && !selectedRouteTrainIds.has(train.id)) continue
      if (selectedCategory && train.category !== selectedCategory) continue
      if (selectedStation && !selectedStationTrainIds.has(train.id)) continue
      if (
        !vehicleIsVisibleAtZoom(
          train.category,
          camera.position.y,
          cameraFraming,
          Boolean(selectedTrain || selectedRoute || selectedCategory || selectedStation),
        )
      ) {
        continue
      }

      const samples = sampleTimes.map((sampleTime) =>
        projectedTrainPosition(
          train,
          sampleTime,
          projectedStops,
          projectedPaths,
          lakeAvoidingPaths,
        ),
      )
      const color = palette[train.category] ?? palette.other

      for (let index = 0; index < VEHICLE_TRAIL_SEGMENTS; index += 1) {
        const current = samples[index]
        const previous = samples[index + 1]
        if (!current || !previous) continue
        const distanceSquared =
          (current[0] - previous[0]) ** 2 +
          (current[2] - previous[2]) ** 2
        if (distanceSquared < 0.000001) continue

        const offset = segmentCounts[index] * 6
        positionArrays[index].set(current, offset)
        positionArrays[index].set(previous, offset + 3)
        colorArrays[index].set(
          [color.r, color.g, color.b, color.r, color.g, color.b],
          offset,
        )
        segmentCounts[index] += 1
      }
    }

    geometries.forEach((geometry, index) => {
      geometry.getAttribute('position').needsUpdate = true
      geometry.getAttribute('color').needsUpdate = true
      geometry.setDrawRange(0, segmentCounts[index] * 2)
    })
  })

  const opacity = [0.4, 0.22, 0.1]
  return (
    <group position={[0, -0.035, 0]}>
      {geometries.map((geometry, index) => (
        <lineSegments
          key={index}
          geometry={geometry}
          frustumCulled={false}
          renderOrder={3 + index}
        >
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={opacity[index]}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
      ))}
    </group>
  )
}

function SelectedTrainMarker({
  train,
  time,
  projectedStops,
  projectedPaths,
}: {
  readonly train: NetworkTrain
  readonly time: number
  readonly projectedStops: readonly ProjectedStop[]
  readonly projectedPaths: readonly ProjectedNetworkPath[]
}) {
  const lakeAvoidingPaths = useContext(LakeAvoidingPathsContext)
  const marker = useRef<THREE.Group>(null)
  const color = SERVICE_COLORS[train.category]

  useFrame((state) => {
    if (!marker.current) return
    const position = projectedTrainPosition(
      train,
      time,
      projectedStops,
      projectedPaths,
      lakeAvoidingPaths,
    )
    marker.current.visible = Boolean(position)
    if (!position) return
    marker.current.position.set(...position)
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.12
    marker.current.scale.setScalar(pulse)
  })

  return (
    <group ref={marker}>
      <mesh renderOrder={MAP_LAYER.focusMarkerCore}>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={4}
          transparent
          opacity={1}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <pointLight color={color} intensity={7} distance={4.5} />
    </group>
  )
}

function NetworkCamera({
  selectedTrain,
  time,
  isPlaying,
  playbackRate,
  projectedStops,
  projectedPaths,
  cameraCommand,
  selectedStation,
  cameraFraming,
  mapFocus,
  selectedAirTrack,
  airProjection,
}: {
  readonly selectedTrain?: NetworkTrain
  readonly time: number
  readonly isPlaying: boolean
  readonly playbackRate: number
  readonly projectedStops: readonly ProjectedStop[]
  readonly projectedPaths: readonly ProjectedNetworkPath[]
  readonly cameraCommand?: MapCameraCommand
  readonly selectedStation?: StationIndexEntry
  readonly cameraFraming: MapCameraFraming
  readonly mapFocus: THREE.Vector3
  readonly selectedAirTrack?: AirTrack
  readonly airProjection: NetworkProjection
}) {
  const { camera, gl, size } = useThree()
  const lakeAvoidingPaths = useContext(LakeAvoidingPathsContext)
  const desiredPosition = useMemo(() => new THREE.Vector3(0, 37, 26), [])
  const desiredTarget = useMemo(() => new THREE.Vector3(), [])
  const currentTarget = useMemo(() => new THREE.Vector3(), [])
  const mapTarget = useRef(new THREE.Vector3())
  const distanceScale = useRef(1)
  const localTime = useRef(time)
  const directTouch = useRef(false)
  const lastCommand = useRef(0)
  const viewportAspect = size.height > 0 ? size.width / size.height : 1
  const minimumDistanceScale = minimumMapDistanceScale(
    cameraFraming,
    viewportAspect,
  )

  useEffect(() => {
    localTime.current = time
  }, [time])

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || size.height <= 0) return
    const fieldOfView = mapCameraFieldOfView(viewportAspect)
    const focalLength =
      (0.5 * camera.getFilmHeight()) /
      Math.tan(THREE.MathUtils.degToRad(fieldOfView * 0.5))
    camera.setFocalLength(focalLength)
  }, [camera, size.height, viewportAspect])

  useEffect(() => {
    distanceScale.current = Math.max(
      minimumDistanceScale,
      distanceScale.current,
    )
  }, [minimumDistanceScale])

  useEffect(() => {
    mapTarget.current.copy(mapFocus)
    distanceScale.current = homeMapDistanceScale(cameraFraming)
  }, [cameraFraming, mapFocus])

  useEffect(() => {
    if (!cameraCommand || cameraCommand.id === lastCommand.current) return
    lastCommand.current = cameraCommand.id
    if (cameraCommand.action === 'reset') {
      mapTarget.current.copy(mapFocus)
      distanceScale.current = homeMapDistanceScale(cameraFraming)
      return
    }
    if (cameraCommand.action === 'reveal-station') {
      if (!selectedStation) return
      const centre = stationCentre(selectedStation, projectedStops)
      camera.updateMatrixWorld()
      if (mapSelectionNeedsReveal(centre.clone().project(camera))) {
        mapTarget.current.copy(centre)
      }
      return
    }
    const multiplier = cameraCommand.action === 'zoom-in' ? 0.78 : 1.28
    distanceScale.current = applyMapZoom(
      distanceScale.current,
      multiplier,
      minimumDistanceScale,
    )
  }, [
    camera,
    cameraCommand,
    cameraFraming,
    mapFocus,
    minimumDistanceScale,
    projectedStops,
    selectedStation,
  ])

  useEffect(() => {
    const element = gl.domElement
    const pointers = new Map<
      number,
      { x: number; y: number; pointerType: string }
    >()
    let pinchDistance: number | undefined

    const onPointerDown = (event: PointerEvent) => {
      if (selectedTrain || selectedAirTrack || (event.pointerType === 'mouse' && event.button !== 0)) return
      pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
      })
      if (event.pointerType === 'touch') directTouch.current = true
      element.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId)
      if (!previous || selectedTrain || selectedAirTrack) return
      pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        pointerType: previous.pointerType,
      })
      if (pointers.size === 1) {
        const panScale = mapPanScale(
          distanceScale.current,
          previous.pointerType,
        )
        mapTarget.current.x -= (event.clientX - previous.x) * panScale
        mapTarget.current.z -= (event.clientY - previous.y) * panScale
        mapTarget.current.x = THREE.MathUtils.clamp(mapTarget.current.x, -25, 25)
        mapTarget.current.z = THREE.MathUtils.clamp(mapTarget.current.z, -16, 16)
      } else if (pointers.size === 2) {
        const [first, second] = [...pointers.values()]
        const nextDistance = Math.hypot(first.x - second.x, first.y - second.y)
        if (pinchDistance && nextDistance > 0) {
          distanceScale.current = applyMapZoom(
            distanceScale.current,
            pinchDistance / nextDistance,
            minimumDistanceScale,
          )
        }
        pinchDistance = nextDistance
      }
      event.preventDefault()
    }
    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      directTouch.current = [...pointers.values()].some(
        (pointer) => pointer.pointerType === 'touch',
      )
      if (pointers.size < 2) pinchDistance = undefined
    }
    const onWheel = (event: WheelEvent) => {
      if (selectedTrain || selectedAirTrack) return
      distanceScale.current = applyMapZoom(
        distanceScale.current,
        mapWheelZoomMultiplier(event.deltaY, event.deltaMode),
        minimumDistanceScale,
      )
      event.preventDefault()
    }

    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('pointercancel', onPointerUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointercancel', onPointerUp)
      element.removeEventListener('wheel', onWheel)
    }
  }, [gl, minimumDistanceScale, selectedAirTrack, selectedTrain])

  useFrame((_, delta) => {
    if (isPlaying) {
      localTime.current += delta * playbackRate
    }
    const trainPosition = selectedTrain
      ? projectedTrainPosition(
          selectedTrain,
          localTime.current,
          projectedStops,
          projectedPaths,
          lakeAvoidingPaths,
        )
      : undefined
    const airState = selectedAirTrack
      ? positionForAirTrack(selectedAirTrack, localTime.current)
      : undefined
    const airPosition = airState
      ? projectAirPosition(airState, airProjection)
      : undefined
    if (trainPosition) {
      desiredTarget.set(trainPosition[0], 0, trainPosition[2])
      desiredPosition.set(trainPosition[0] + 4.2, 4.8, trainPosition[2] + 6.5)
    } else if (airPosition && airState) {
      const heading = THREE.MathUtils.degToRad(airState.headingDegrees)
      const forwardX = Math.sin(heading)
      const forwardZ = -Math.cos(heading)
      desiredTarget.set(...airPosition)
      desiredPosition.set(
        airPosition[0] - forwardX * 5.5 + 2.4,
        airPosition[1] + 4.2,
        airPosition[2] - forwardZ * 5.5 + 2.4,
      )
    } else {
      desiredTarget.copy(mapTarget.current)
      desiredPosition.set(
        mapTarget.current.x,
        37 * distanceScale.current,
        mapTarget.current.z + 26 * distanceScale.current,
      )
    }

    const damping =
      1 -
      Math.exp(
        -delta *
          mapCameraDampingRate(
            Boolean(trainPosition || airPosition),
            directTouch.current,
          ),
      )
    camera.position.lerp(desiredPosition, damping)
    currentTarget.lerp(desiredTarget, damping)
    camera.lookAt(currentTarget)
    camera.updateMatrixWorld()
  }, -1)

  return null
}

function NetworkWorld(props: NationalNetworkSceneProps) {
  const projection = useMemo(
    () => createNetworkProjection(props.referenceSnapshot),
    [props.referenceSnapshot],
  )
  const projectedStops = useMemo(
    () => projectStops(props.snapshot, projection),
    [projection, props.snapshot],
  )
  const projectedPaths = useMemo(
    () => projectPaths(props.snapshot, projection),
    [projection, props.snapshot],
  )
  const contextProjectedStops = useMemo(
    () =>
      props.contextSnapshot
        ? projectStops(props.contextSnapshot, projection)
        : undefined,
    [projection, props.contextSnapshot],
  )
  const contextProjectedPaths = useMemo(
    () =>
      props.contextSnapshot
        ? projectPaths(props.contextSnapshot, projection)
        : undefined,
    [projection, props.contextSnapshot],
  )
  const projectedLakeRings = useMemo(
    () =>
      props.lakes?.lakes.flatMap((lake) =>
        lake.polygons.flatMap((polygon) => {
          const outerRing = polygon[0]
          return outerRing
            ? [
                outerRing.map((coordinate) =>
                  projectCoordinate(coordinate, projection),
                ),
              ]
            : []
        }),
      ) ?? [],
    [projection, props.lakes],
  )
  const lakeAvoidingPaths = useMemo(
    () =>
      createLakeAvoidingPathMap(
        props.snapshot.edges,
        props.snapshot.edgePaths,
        projectedStops,
        projectedLakeRings,
      ),
    [
      projectedLakeRings,
      projectedStops,
      props.snapshot.edgePaths,
      props.snapshot.edges,
    ],
  )
  const mapFocus = useMemo(() => {
    const { bounds } = props.snapshot
    const centre: BoundaryCoordinate = [
      (bounds.minLongitude + bounds.maxLongitude) / 2,
      (bounds.minLatitude + bounds.maxLatitude) / 2,
    ]
    const [x, , z] = projectCoordinate(centre, projection)
    return new THREE.Vector3(x, 0, z)
  }, [projection, props.snapshot])
  const hasContext = Boolean(props.contextSnapshot && contextProjectedStops)
  const trainTimeIndex = useMemo(
    () =>
      buildTrainTimeIndex(
        props.snapshot.trains,
        props.snapshot.metadata.windowStart,
        props.snapshot.metadata.windowEnd,
        VEHICLE_TRAIL_SEGMENTS * VEHICLE_TRAIL_STEP_SECONDS,
      ),
    [props.snapshot],
  )

  return (
    <LakeAvoidingPathsContext.Provider value={lakeAvoidingPaths}>
      <fog attach="fog" args={['#050410', 34, 69]} />
      <ambientLight intensity={0.85} color="#7d87ff" />
      <NationalGround />
      {props.lakes && (
        <LakeLayer
          lakes={props.lakes}
          projection={projection}
          subdued={Boolean(
            props.selectedTrain ||
              props.selectedRoute ||
              props.selectedStation ||
              props.selectedCategory ||
              props.airCategorySelected ||
              props.roadCategorySelected
          )}
        />
      )}
      {props.boundary && (
        <CountryBorder
          boundary={props.boundary}
          projection={projection}
          subdued={Boolean(
            props.selectedTrain ||
              props.selectedRoute ||
              props.selectedStation ||
              props.selectedCategory ||
              props.airCategorySelected ||
              props.roadCategorySelected ||
              hasContext
          )}
        />
      )}
      {props.contextSnapshot && contextProjectedStops && contextProjectedPaths && (
        <RailGraph
          snapshot={props.contextSnapshot}
          projectedStops={contextProjectedStops}
          projectedPaths={contextProjectedPaths}
          cameraFraming="switzerland"
          subdued
          lakeAvoidingPaths={EMPTY_LAKE_AVOIDING_PATHS}
          showTraffic={false}
        />
      )}
      <RailGraph
        snapshot={props.snapshot}
        projectedStops={projectedStops}
        projectedPaths={projectedPaths}
        cameraFraming={props.cameraFraming}
        lakeAvoidingPaths={lakeAvoidingPaths}
        subdued={Boolean(
          props.selectedTrain ||
            props.selectedRoute ||
            props.selectedStation ||
            props.selectedCategory ||
            props.airCategorySelected ||
            props.roadCategorySelected
        )}
      />
      {props.roadSnapshot && (
        <RoadTrafficLayer
          snapshot={props.roadSnapshot}
          time={props.time}
          isPlaying={props.isPlaying}
          playbackRate={props.playbackRate}
          projection={projection}
          subdued={Boolean(
            props.selectedTrain ||
              props.selectedRoute ||
              props.selectedStation ||
              props.selectedCategory ||
              props.airCategorySelected
          )}
        />
      )}
      {props.airSnapshot && (
        <AirTrafficLayer
          snapshot={props.airSnapshot}
          time={props.time}
          isPlaying={props.isPlaying}
          playbackRate={props.playbackRate}
          projection={projection}
          selectedTrackId={props.selectedAirTrack?.id}
          onSelectTrack={props.onSelectAirTrack}
          labelMode={props.trainLabelMode}
          subdued={Boolean(
            props.selectedTrain ||
              props.selectedRoute ||
              props.selectedStation ||
              props.selectedCategory ||
              props.roadCategorySelected
          )}
        />
      )}
      {props.selectedTrain && (
        <>
          <SelectedRoute
            train={props.selectedTrain}
            projectedStops={projectedStops}
            projectedPaths={projectedPaths}
          />
          <SelectedTrainMarker
            train={props.selectedTrain}
            time={props.time}
            projectedStops={projectedStops}
            projectedPaths={projectedPaths}
          />
        </>
      )}
      {props.selectedRoute && (
        <SelectedLinePaths
          route={props.selectedRoute}
          snapshot={props.snapshot}
          projectedStops={projectedStops}
          projectedPaths={projectedPaths}
        />
      )}
      {props.selectedStation && (
        <SelectedStationRoutes
          station={props.selectedStation}
          snapshot={props.snapshot}
          projectedStops={projectedStops}
          projectedPaths={projectedPaths}
          selectedCategory={props.selectedCategory}
        />
      )}
      <VehicleTrails
        {...props}
        projectedStops={projectedStops}
        projectedPaths={projectedPaths}
        trainTimeIndex={trainTimeIndex}
      />
      <TrainSwarm
        {...props}
        projectedStops={projectedStops}
        projectedPaths={projectedPaths}
        trainTimeIndex={trainTimeIndex}
      />
      <TrainLabels
        {...props}
        projectedStops={projectedStops}
        projectedPaths={projectedPaths}
        trainTimeIndex={trainTimeIndex}
      />
      <StationLabels
        stations={props.stations}
        snapshot={props.snapshot}
        projectedStops={projectedStops}
        selectedRoute={props.selectedRoute}
        selectedStation={props.selectedStation}
        selectedTrain={props.selectedTrain}
        cameraFraming={props.cameraFraming}
      />
      <StationTapTarget
        stations={props.stations}
        projectedStops={projectedStops}
        cameraFraming={props.cameraFraming}
        onSelectStation={props.onSelectStation}
      />
      <NetworkCamera
        selectedTrain={props.selectedTrain}
        time={props.time}
        isPlaying={props.isPlaying}
        playbackRate={props.playbackRate}
        projectedStops={projectedStops}
        projectedPaths={projectedPaths}
        cameraCommand={props.cameraCommand}
        selectedStation={props.selectedStation}
        cameraFraming={props.cameraFraming}
        mapFocus={mapFocus}
        selectedAirTrack={props.selectedAirTrack}
        airProjection={projection}
      />
    </LakeAvoidingPathsContext.Provider>
  )
}

export function NationalNetworkScene(props: NationalNetworkSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 37, 26], fov: 44, near: 0.1, far: 120 }}
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#050410']} />
      <NetworkWorld {...props} />
    </Canvas>
  )
}
