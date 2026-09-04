import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  positionForTrain,
  SERVICE_COLORS,
  type NetworkSnapshot,
  type NetworkTrain,
  type ServiceCategory,
} from '../domain/network.ts'

export type MapCameraAction = 'zoom-in' | 'zoom-out' | 'reset'

export interface MapCameraCommand {
  readonly id: number
  readonly action: MapCameraAction
}

interface NationalNetworkSceneProps {
  readonly snapshot: NetworkSnapshot
  readonly isPlaying: boolean
  readonly time: number
  readonly selectedTrain?: NetworkTrain
  readonly onTime: (time: number) => void
  readonly cameraCommand?: MapCameraCommand
  readonly playbackRate: number
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

function projectedTrainPosition(
  train: NetworkTrain,
  time: number,
  projectedStops: readonly ProjectedStop[],
): ProjectedStop | undefined {
  const position = positionForTrain(train, time)
  if (!position) return undefined
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
  subdued,
}: {
  readonly snapshot: NetworkSnapshot
  readonly projectedStops: readonly ProjectedStop[]
  readonly subdued: boolean
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
          opacity={subdued ? 0.07 : 0.25}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <points geometry={stationGeometry} position={[0, 0.035, 0]}>
        <pointsMaterial
          color="#a18cff"
          size={0.065}
          transparent
          opacity={subdued ? 0.12 : 0.4}
          sizeAttenuation
        />
      </points>
    </>
  )
}

function SelectedRoute({
  train,
  projectedStops,
}: {
  readonly train: NetworkTrain
  readonly projectedStops: readonly ProjectedStop[]
}) {
  const line = useMemo(() => {
    const points = train.stops
      .map(([stopIndex]) => projectedStops[stopIndex])
      .filter((point): point is ProjectedStop => Boolean(point))
      .map(([x, , z]) => new THREE.Vector3(x, 0.12, z))
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: SERVICE_COLORS[train.category],
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    })
    return new THREE.Line(geometry, material)
  }, [projectedStops, train])

  useEffect(
    () => () => {
      line.geometry.dispose()
      ;(line.material as THREE.Material).dispose()
    },
    [line],
  )

  return <primitive object={line} />
}

function TrainSwarm({
  snapshot,
  projectedStops,
  selectedTrain,
  isPlaying,
  time,
  onTime,
  playbackRate,
}: NationalNetworkSceneProps & {
  readonly projectedStops: readonly ProjectedStop[]
}) {
  const points = useRef<THREE.Points>(null)
  const glow = useRef<THREE.Points>(null)
  const localTime = useRef(time)
  const lastReport = useRef(0)
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
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(snapshot.trains.length * 3), 3),
    )
    next.setAttribute(
      'color',
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
      localTime.current += delta * playbackRate
      if (localTime.current > snapshot.metadata.windowEnd) {
        localTime.current = snapshot.metadata.windowStart
      }
    }

    const mutableGeometry = points.current?.geometry
    if (!mutableGeometry) return
    const positionAttribute = mutableGeometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute
    const colorAttribute = mutableGeometry.getAttribute('color') as THREE.BufferAttribute
    const mutablePositions = positionAttribute.array as Float32Array
    const mutableColors = colorAttribute.array as Float32Array
    let active = 0
    for (const train of snapshot.trains) {
      const position = projectedTrainPosition(train, localTime.current, projectedStops)
      if (!position) continue
      const offset = active * 3
      mutablePositions.set(position, offset)
      const color = palette[train.category] ?? palette.other
      const intensity = selectedTrain && selectedTrain.id !== train.id ? 0.11 : 1
      mutableColors[offset] = color.r * intensity
      mutableColors[offset + 1] = color.g * intensity
      mutableColors[offset + 2] = color.b * intensity
      active += 1
    }

    positionAttribute.needsUpdate = true
    colorAttribute.needsUpdate = true
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
          vertexColors
          size={0.72}
          transparent
          opacity={selectedTrain ? 0.1 : 0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      <points ref={points} geometry={geometry}>
        <pointsMaterial
          vertexColors
          size={0.2}
          transparent
          opacity={0.96}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </>
  )
}

function SelectedTrainMarker({
  train,
  time,
  projectedStops,
}: {
  readonly train: NetworkTrain
  readonly time: number
  readonly projectedStops: readonly ProjectedStop[]
}) {
  const marker = useRef<THREE.Group>(null)
  const color = SERVICE_COLORS[train.category]

  useFrame((state) => {
    if (!marker.current) return
    const position = projectedTrainPosition(train, time, projectedStops)
    marker.current.visible = Boolean(position)
    if (!position) return
    marker.current.position.set(...position)
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.12
    marker.current.scale.setScalar(pulse)
  })

  return (
    <group ref={marker}>
      <mesh>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={4}
        />
      </mesh>
      <pointLight color={color} intensity={7} distance={4.5} />
    </group>
  )
}

function NetworkCamera({
  selectedTrain,
  time,
  projectedStops,
  cameraCommand,
}: {
  readonly selectedTrain?: NetworkTrain
  readonly time: number
  readonly projectedStops: readonly ProjectedStop[]
  readonly cameraCommand?: MapCameraCommand
}) {
  const { camera, gl } = useThree()
  const desiredPosition = useMemo(() => new THREE.Vector3(0, 37, 26), [])
  const desiredTarget = useMemo(() => new THREE.Vector3(), [])
  const currentTarget = useMemo(() => new THREE.Vector3(), [])
  const mapTarget = useRef(new THREE.Vector3())
  const distanceScale = useRef(1)
  const lastCommand = useRef(0)

  useEffect(() => {
    if (!cameraCommand || cameraCommand.id === lastCommand.current) return
    lastCommand.current = cameraCommand.id
    if (cameraCommand.action === 'reset') {
      mapTarget.current.set(0, 0, 0)
      distanceScale.current = 1
      return
    }
    const multiplier = cameraCommand.action === 'zoom-in' ? 0.78 : 1.28
    distanceScale.current = THREE.MathUtils.clamp(
      distanceScale.current * multiplier,
      0.3,
      1.7,
    )
  }, [cameraCommand])

  useEffect(() => {
    const element = gl.domElement
    const pointers = new Map<number, { x: number; y: number }>()
    let pinchDistance: number | undefined

    const onPointerDown = (event: PointerEvent) => {
      if (selectedTrain || (event.pointerType === 'mouse' && event.button !== 0)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      element.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId)
      if (!previous || selectedTrain) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size === 1) {
        const panScale = 0.045 * distanceScale.current
        mapTarget.current.x -= (event.clientX - previous.x) * panScale
        mapTarget.current.z -= (event.clientY - previous.y) * panScale
        mapTarget.current.x = THREE.MathUtils.clamp(mapTarget.current.x, -25, 25)
        mapTarget.current.z = THREE.MathUtils.clamp(mapTarget.current.z, -16, 16)
      } else if (pointers.size === 2) {
        const [first, second] = [...pointers.values()]
        const nextDistance = Math.hypot(first.x - second.x, first.y - second.y)
        if (pinchDistance && nextDistance > 0) {
          distanceScale.current = THREE.MathUtils.clamp(
            distanceScale.current * (pinchDistance / nextDistance),
            0.3,
            1.7,
          )
        }
        pinchDistance = nextDistance
      }
      event.preventDefault()
    }
    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (pointers.size < 2) pinchDistance = undefined
    }
    const onWheel = (event: WheelEvent) => {
      if (selectedTrain) return
      distanceScale.current = THREE.MathUtils.clamp(
        distanceScale.current * Math.exp(event.deltaY * 0.0012),
        0.3,
        1.7,
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
  }, [gl, selectedTrain])

  useFrame((_, delta) => {
    const trainPosition = selectedTrain
      ? projectedTrainPosition(selectedTrain, time, projectedStops)
      : undefined
    if (trainPosition) {
      desiredTarget.set(trainPosition[0], 0, trainPosition[2])
      desiredPosition.set(trainPosition[0] + 4.2, 4.8, trainPosition[2] + 6.5)
    } else {
      desiredTarget.copy(mapTarget.current)
      desiredPosition.set(
        mapTarget.current.x,
        37 * distanceScale.current,
        mapTarget.current.z + 26 * distanceScale.current,
      )
    }

    const damping = 1 - Math.exp(-delta * (trainPosition ? 1.7 : 2.3))
    camera.position.lerp(desiredPosition, damping)
    currentTarget.lerp(desiredTarget, damping)
    camera.lookAt(currentTarget)
  })

  return null
}

function NetworkWorld(props: NationalNetworkSceneProps) {
  const projectedStops = useMemo(() => projectStops(props.snapshot), [props.snapshot])

  return (
    <>
      <fog attach="fog" args={['#050410', 34, 69]} />
      <ambientLight intensity={0.85} color="#7d87ff" />
      <NationalGround />
      <RailGraph
        snapshot={props.snapshot}
        projectedStops={projectedStops}
        subdued={Boolean(props.selectedTrain)}
      />
      {props.selectedTrain && (
        <>
          <SelectedRoute train={props.selectedTrain} projectedStops={projectedStops} />
          <SelectedTrainMarker
            train={props.selectedTrain}
            time={props.time}
            projectedStops={projectedStops}
          />
        </>
      )}
      <TrainSwarm {...props} projectedStops={projectedStops} />
      <NetworkCamera
        selectedTrain={props.selectedTrain}
        time={props.time}
        projectedStops={projectedStops}
        cameraCommand={props.cameraCommand}
      />
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
