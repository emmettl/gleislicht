import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  roadConditionsAtTime,
  roadDistanceTravelledKm,
  visualVehicleCount,
  type RoadTopologySnapshot,
  type RoadTrafficSnapshot,
} from '../domain/road.ts'
import type { NetworkProjection } from './NationalNetworkScene.tsx'
import { createGlowPointTexture } from './glow-point-texture.ts'

const LIGHT_COLOR = new THREE.Color('#fff1cf')
const HEAVY_COLOR = new THREE.Color('#ff9d52')
const MAX_LIGHT_PER_DIRECTION = 110
const MAX_HEAVY_PER_DIRECTION = 32

function RoadTopology({
  snapshot,
  projection,
  subdued,
  selectedRoadId,
}: {
  readonly snapshot: RoadTopologySnapshot
  readonly projection: NetworkProjection
  readonly subdued: boolean
  readonly selectedRoadId?: string
}) {
  const pointTexture = useMemo(() => createGlowPointTexture(), [])
  const geometry = useMemo(() => {
    const mainlinePoints: THREE.Vector3[] = []
    const connectorPoints: THREE.Vector3[] = []
    const selectedMainlinePoints: THREE.Vector3[] = []
    const selectedConnectorPoints: THREE.Vector3[] = []
    for (const path of snapshot.paths) {
      const target = path.mainline ? mainlinePoints : connectorPoints
      const selectedTarget = path.mainline
        ? selectedMainlinePoints
        : selectedConnectorPoints
      for (let index = 1; index < path.points.length; index += 1) {
        const first = projectRoadCoordinate(
          path.points[index - 1],
          projection,
          0.065,
        )
        const second = projectRoadCoordinate(path.points[index], projection, 0.065)
        target.push(first, second)
        if (path.road === selectedRoadId) selectedTarget.push(first, second)
      }
    }
    const seenStations = new Set<string>()
    const seenSelectedStations = new Set<string>()
    const selectedSitePoints: THREE.Vector3[] = []
    const sitePoints = snapshot.sites.flatMap((site) => {
      if (
        (site.match.confidence !== 'high' &&
          site.match.confidence !== 'continuity') ||
        !site.match.projectedCoordinate ||
        seenStations.has(site.stationId)
      ) {
        return []
      }
      seenStations.add(site.stationId)
      const point = projectRoadCoordinate(
        site.match.projectedCoordinate,
        projection,
        0.085,
      )
      if (
        site.match.road === selectedRoadId &&
        !seenSelectedStations.has(site.stationId)
      ) {
        selectedSitePoints.push(point)
        seenSelectedStations.add(site.stationId)
      }
      return [point]
    })
    return {
      mainline: new THREE.BufferGeometry().setFromPoints(mainlinePoints),
      connectors: new THREE.BufferGeometry().setFromPoints(connectorPoints),
      sites: new THREE.BufferGeometry().setFromPoints(sitePoints),
      selectedMainline: new THREE.BufferGeometry().setFromPoints(
        selectedMainlinePoints,
      ),
      selectedConnectors: new THREE.BufferGeometry().setFromPoints(
        selectedConnectorPoints,
      ),
      selectedSites: new THREE.BufferGeometry().setFromPoints(selectedSitePoints),
    }
  }, [projection, selectedRoadId, snapshot.paths, snapshot.sites])

  useEffect(
    () => () => {
      geometry.mainline.dispose()
      geometry.connectors.dispose()
      geometry.sites.dispose()
      geometry.selectedMainline.dispose()
      geometry.selectedConnectors.dispose()
      geometry.selectedSites.dispose()
    },
    [geometry],
  )

  useEffect(() => () => pointTexture.dispose(), [pointTexture])

  return (
    <group>
      <lineSegments geometry={geometry.connectors} renderOrder={3}>
        <lineBasicMaterial
          color="#bc8058"
          transparent
          opacity={selectedRoadId ? 0.003 : subdued ? 0.008 : 0.018}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments geometry={geometry.mainline} renderOrder={3}>
        <lineBasicMaterial
          color="#ffb36b"
          transparent
          opacity={selectedRoadId ? 0.008 : subdued ? 0.018 : 0.062}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <points geometry={geometry.sites} renderOrder={4}>
        <pointsMaterial
          map={pointTexture}
          color="#ffd18d"
          size={0.1}
          sizeAttenuation
          transparent
          opacity={selectedRoadId ? 0.05 : subdued ? 0.08 : 0.34}
          alphaTest={0.015}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      {selectedRoadId && (
        <>
          <lineSegments geometry={geometry.selectedConnectors} renderOrder={7}>
            <lineBasicMaterial
              color="#ff9d52"
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </lineSegments>
          <lineSegments geometry={geometry.selectedMainline} renderOrder={8}>
            <lineBasicMaterial
              color="#fff1cf"
              transparent
              opacity={0.92}
              blending={THREE.AdditiveBlending}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </lineSegments>
          <points geometry={geometry.selectedSites} renderOrder={9}>
            <pointsMaterial
              map={pointTexture}
              color="#ffbc70"
              size={0.15}
              sizeAttenuation
              transparent
              opacity={0.86}
              alphaTest={0.015}
              blending={THREE.AdditiveBlending}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </points>
        </>
      )}
    </group>
  )
}

function projectRoadCoordinate(
  coordinate: readonly [number, number],
  projection: NetworkProjection,
  height = 0.11,
): THREE.Vector3 {
  return new THREE.Vector3(
    (coordinate[0] - projection.centreLongitude) *
      projection.longitudeScale *
      projection.scale,
    height,
    -(coordinate[1] - projection.centreLatitude) * projection.scale,
  )
}

function RoadDirectionFlow({
  snapshot,
  corridor,
  direction,
  curve,
  time,
  isPlaying,
  playbackRate,
  subdued,
}: {
  readonly snapshot: RoadTrafficSnapshot
  readonly corridor: RoadTrafficSnapshot['corridors'][number]
  readonly direction: RoadTrafficSnapshot['corridors'][number]['directions'][number]
  readonly curve: THREE.CatmullRomCurve3
  readonly time: number
  readonly isPlaying: boolean
  readonly playbackRate: number
  readonly subdued: boolean
}) {
  const localTime = useRef(time)
  const lightsRef = useRef<THREE.InstancedMesh>(null)
  const heavyRef = useRef<THREE.InstancedMesh>(null)
  const transformRef = useRef(new THREE.Object3D())
  const pointRef = useRef(new THREE.Vector3())
  const aheadRef = useRef(new THREE.Vector3())
  const tangentRef = useRef(new THREE.Vector3())
  const vehicleAxisRef = useRef(new THREE.Vector3(0, 1, 0))

  useEffect(() => {
    localTime.current = time
  }, [time])

  useFrame((_, delta) => {
    if (isPlaying) {
      localTime.current += delta * playbackRate
      if (localTime.current > snapshot.metadata.windowEnd) {
        localTime.current = snapshot.metadata.windowStart
      }
    }
    const conditions = roadConditionsAtTime(direction, localTime.current)
    const transform = transformRef.current
    const point = pointRef.current
    const ahead = aheadRef.current
    const tangent = tangentRef.current
    const vehicleAxis = vehicleAxisRef.current
    const lightCount = visualVehicleCount(
      conditions.lightFlowPerHour,
      conditions.lightSpeedKmh,
      corridor.distanceKm,
      snapshot.metadata.visualSampleRate,
      MAX_LIGHT_PER_DIRECTION,
    )
    const heavyCount = visualVehicleCount(
      conditions.heavyFlowPerHour,
      conditions.heavySpeedKmh,
      corridor.distanceKm,
      snapshot.metadata.visualSampleRate * 1.7,
      MAX_HEAVY_PER_DIRECTION,
    )

    const updateMesh = (
      mesh: THREE.InstancedMesh | null,
      count: number,
      vehicle: 'light' | 'heavy',
    ) => {
      if (!mesh) return
      const travelled = roadDistanceTravelledKm(
        direction,
        localTime.current,
        vehicle,
      )
      for (let index = 0; index < count; index += 1) {
        const offset = (index + (vehicle === 'heavy' ? 0.37 : 0.08)) / Math.max(1, count)
        let progress = (offset + travelled / corridor.distanceKm) % 1
        if (direction.reverse) progress = 1 - progress
        curve.getPointAt(progress, point)
        const aheadProgress =
          (progress + (direction.reverse ? -0.001 : 0.001) + 1) % 1
        curve.getPointAt(aheadProgress, ahead)
        transform.position.copy(point)
        transform.position.x += direction.reverse ? -0.045 : 0.045
        tangent.copy(ahead).sub(point).normalize()
        transform.quaternion.setFromUnitVectors(vehicleAxis, tangent)
        const pulse = 0.88 + 0.12 * Math.sin(index * 2.31 + localTime.current * 0.045)
        transform.scale.setScalar(pulse)
        transform.updateMatrix()
        mesh.setMatrixAt(index, transform.matrix)
      }
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
    }

    updateMesh(lightsRef.current, lightCount, 'light')
    updateMesh(heavyRef.current, heavyCount, 'heavy')
  })

  return (
    <>
      <instancedMesh
        ref={lightsRef}
        args={[undefined, undefined, MAX_LIGHT_PER_DIRECTION]}
        renderOrder={5}
        frustumCulled={false}
      >
        <capsuleGeometry args={[0.027, 0.16, 3, 5]} />
        <meshBasicMaterial
          color={LIGHT_COLOR}
          transparent
          opacity={subdued ? 0.07 : 0.84}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={heavyRef}
        args={[undefined, undefined, MAX_HEAVY_PER_DIRECTION]}
        renderOrder={5}
        frustumCulled={false}
      >
        <capsuleGeometry args={[0.045, 0.24, 3, 5]} />
        <meshBasicMaterial
          color={HEAVY_COLOR}
          transparent
          opacity={subdued ? 0.06 : 0.78}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  )
}

export function RoadTrafficLayer({
  snapshot,
  topology,
  time,
  isPlaying,
  playbackRate,
  projection,
  subdued = false,
  selectedRoadId,
}: {
  readonly snapshot: RoadTrafficSnapshot
  readonly topology?: RoadTopologySnapshot
  readonly time: number
  readonly isPlaying: boolean
  readonly playbackRate: number
  readonly projection: NetworkProjection
  readonly subdued?: boolean
  readonly selectedRoadId?: string
}) {
  const corridors = useMemo(
    () =>
      snapshot.corridors.map((corridor) => {
        const points = corridor.path.map((coordinate) =>
          projectRoadCoordinate(coordinate, projection),
        )
        const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
        const roadPoints = curve.getPoints(180)
        const roadSegments = roadPoints.flatMap((point, index) =>
          index ? [roadPoints[index - 1], point] : [],
        )
        const road = new THREE.BufferGeometry().setFromPoints(roadSegments)
        return { corridor, curve, road }
      }),
    [projection, snapshot.corridors],
  )

  useEffect(
    () => () => corridors.forEach(({ road }) => road.dispose()),
    [corridors],
  )

  return (
    <group>
      {topology && (
        <RoadTopology
          snapshot={topology}
          projection={projection}
          subdued={subdued}
          selectedRoadId={selectedRoadId}
        />
      )}
      {corridors.map(({ corridor, curve, road }) => {
        const corridorRoad = corridor.road.replace(/^A/, 'N')
        const corridorSubdued =
          subdued || Boolean(selectedRoadId && selectedRoadId !== corridorRoad)
        return (
        <group key={corridor.id}>
          <lineSegments geometry={road} renderOrder={4}>
            <lineBasicMaterial
              color="#c78a60"
              transparent
              opacity={corridorSubdued ? 0.012 : 0.15}
              depthWrite={false}
            />
          </lineSegments>
          {corridor.directions.map((direction) => (
            <RoadDirectionFlow
              key={direction.id}
              snapshot={snapshot}
              corridor={corridor}
              direction={direction}
              curve={curve}
              time={time}
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              subdued={corridorSubdued}
            />
          ))}
        </group>
        )
      })}
    </group>
  )
}
