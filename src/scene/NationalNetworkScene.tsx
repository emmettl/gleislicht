import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  positionForTrain,
  type NetworkSnapshot,
} from '../domain/network.ts'

interface NationalNetworkSceneProps {
  readonly snapshot: NetworkSnapshot
  readonly isPlaying: boolean
  readonly time: number
  readonly onTime: (time: number) => void
}

type ProjectedStop = readonly [x: number, y: number, z: number]

function projectStops(snapshot: NetworkSnapshot): readonly ProjectedStop[] {
  const { bounds } = snapshot
  const centreLongitude = (bounds.minLongitude + bounds.maxLongitude) / 2
  const centreLatitude = (bounds.minLatitude + bounds.maxLatitude) / 2
  const longitudeScale = Math.cos((centreLatitude * Math.PI) / 180)
  const projectedWidth =
    (bounds.maxLongitude - bounds.minLongitude) * longitudeScale
  const scale = 51 / projectedWidth

  return snapshot.stops.map(([longitude, latitude]) => [
    (longitude - centreLongitude) * longitudeScale * scale,
    0,
    -(latitude - centreLatitude) * scale,
  ])
}

function NationalGround() {
  return (
    <group position={[0, -0.11, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[64, 36, 64, 36]} />
        <meshBasicMaterial color="#090b1f" transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[64, 36, 64, 36]} />
        <meshBasicMaterial color="#424b98" transparent opacity={0.1} wireframe />
      </mesh>
    </group>
  )
}

function RailGraph({
  snapshot,
  projectedStops,
}: {
  readonly snapshot: NetworkSnapshot
  readonly projectedStops: readonly ProjectedStop[]
}) {
  const railGeometry = useMemo(() => {
    const positions = new Float32Array(snapshot.edges.length * 6)
    let writeIndex = 0
    for (const [fromIndex, toIndex] of snapshot.edges) {
      const from = projectedStops[fromIndex]
      const to = projectedStops[toIndex]
      if (!from || !to) continue
      positions.set(from, writeIndex)
      positions.set(to, writeIndex + 3)
      writeIndex += 6
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setDrawRange(0, writeIndex / 3)
    return geometry
  }, [projectedStops, snapshot.edges])

  const stationGeometry = useMemo(() => {
    const positions = new Float32Array(projectedStops.length * 3)
    projectedStops.forEach((stop, index) => positions.set(stop, index * 3))
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [projectedStops])

  return (
    <>
      <lineSegments geometry={railGeometry}>
        <lineBasicMaterial
          color="#7296bb"
          transparent
          opacity={0.25}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <points geometry={stationGeometry} position={[0, 0.035, 0]}>
        <pointsMaterial
          color="#a18cff"
          size={0.065}
          transparent
          opacity={0.4}
          sizeAttenuation
        />
      </points>
    </>
  )
}

function TrainSwarm({
  snapshot,
  projectedStops,
  isPlaying,
  time,
  onTime,
}: NationalNetworkSceneProps & {
  readonly projectedStops: readonly ProjectedStop[]
}) {
  const points = useRef<THREE.Points>(null)
  const glow = useRef<THREE.Points>(null)
  const localTime = useRef(time)
  const lastReport = useRef(0)
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(snapshot.trains.length * 3), 3),
    )
    next.setDrawRange(0, 0)
    return next
  }, [snapshot.trains.length])

  useEffect(() => {
    localTime.current = time
  }, [time])

  useFrame((state, delta) => {
    if (isPlaying) {
      localTime.current += delta * 30
      if (localTime.current > snapshot.metadata.windowEnd) {
        localTime.current = snapshot.metadata.windowStart
      }
    }

    const mutableGeometry = points.current?.geometry
    if (!mutableGeometry) return
    const attribute = mutableGeometry.getAttribute('position') as THREE.BufferAttribute
    const mutablePositions = attribute.array as Float32Array
    let active = 0
    for (const train of snapshot.trains) {
      const trainPosition = positionForTrain(train, localTime.current)
      if (!trainPosition) continue
      const from = projectedStops[trainPosition.fromStop]
      const to = projectedStops[trainPosition.toStop]
      if (!from || !to) continue
      const offset = active * 3
      mutablePositions[offset] = THREE.MathUtils.lerp(
        from[0],
        to[0],
        trainPosition.progress,
      )
      mutablePositions[offset + 1] = 0.18
      mutablePositions[offset + 2] = THREE.MathUtils.lerp(
        from[2],
        to[2],
        trainPosition.progress,
      )
      active += 1
    }

    attribute.needsUpdate = true
    mutableGeometry.setDrawRange(0, active)
    if (points.current) points.current.frustumCulled = false
    if (glow.current) glow.current.frustumCulled = false

    if (state.clock.elapsedTime - lastReport.current > 0.1) {
      lastReport.current = state.clock.elapsedTime
      onTime(localTime.current)
    }
  })

  return (
    <>
      <points ref={glow} geometry={geometry}>
        <pointsMaterial
          color="#ff48d7"
          size={0.7}
          transparent
          opacity={0.13}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      <points ref={points} geometry={geometry}>
        <pointsMaterial
          color="#e9fdff"
          size={0.19}
          transparent
          opacity={0.94}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </>
  )
}

function NetworkWorld(props: NationalNetworkSceneProps) {
  const projectedStops = useMemo(() => projectStops(props.snapshot), [props.snapshot])
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(0, 37, 26)
    camera.lookAt(0, 0, 0)
  }, [camera])

  return (
    <>
      <fog attach="fog" args={['#050410', 34, 69]} />
      <ambientLight intensity={0.85} color="#7d87ff" />
      <NationalGround />
      <RailGraph snapshot={props.snapshot} projectedStops={projectedStops} />
      <TrainSwarm {...props} projectedStops={projectedStops} />
    </>
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
