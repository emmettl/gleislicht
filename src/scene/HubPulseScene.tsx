import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { HubCall, HubDefinition } from '../domain/hub.ts'
import {
  SERVICE_COLORS,
  type NetworkSnapshot,
  type ServiceCategory,
} from '../domain/network.ts'

interface HubPulseSceneProps {
  readonly snapshot: NetworkSnapshot
  readonly hub: HubDefinition
  readonly calls: readonly HubCall[]
  readonly isPlaying: boolean
  readonly time: number
  readonly onTime: (time: number) => void
}

const pulseHorizon = 15 * 60

function directionForStop(
  snapshot: NetworkSnapshot,
  hubStop: number,
  neighbourStop: number | undefined,
  fallback: number,
): number {
  const hub = snapshot.stops[hubStop]
  const neighbour = neighbourStop === undefined ? undefined : snapshot.stops[neighbourStop]
  if (!hub || !neighbour) return fallback
  const longitudeScale = Math.cos((hub[1] * Math.PI) / 180)
  const x = (neighbour[0] - hub[0]) * longitudeScale
  const z = -(neighbour[1] - hub[1])
  return Math.atan2(z, x)
}

function TickMarks() {
  const ticks = useMemo(() => {
    const group = new THREE.Group()
    Array.from({ length: 60 }, (_, index) => {
      const angle = (index / 60) * Math.PI * 2
      const inner = index % 5 === 0 ? 10.25 : 10.45
      const outer = 10.8
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(angle) * inner, Math.sin(angle) * inner, 0),
        new THREE.Vector3(Math.cos(angle) * outer, Math.sin(angle) * outer, 0),
      ])
      const material = new THREE.LineBasicMaterial({
        color: index % 5 === 0 ? '#ff5edb' : '#8992c7',
        transparent: true,
        opacity: index % 5 === 0 ? 0.48 : 0.18,
      })
      group.add(new THREE.Line(geometry, material))
    })
    return group
  }, [])

  useEffect(
    () => () => {
      ticks.children.forEach((tick) => {
        const line = tick as THREE.Line
        line.geometry.dispose()
        ;(line.material as THREE.Material).dispose()
      })
    },
    [ticks],
  )

  return <primitive object={ticks} />
}

function OrbitalRings() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {[3.8, 7.2, 10.6].map((radius, index) => (
        <mesh key={radius}>
          <ringGeometry args={[radius - 0.025, radius + 0.025, 128]} />
          <meshBasicMaterial
            color={index === 1 ? '#8dfaff' : '#786bcb'}
            transparent
            opacity={index === 1 ? 0.28 : 0.17}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      <TickMarks />
    </group>
  )
}

function CorridorSpokes({
  snapshot,
  calls,
}: {
  readonly snapshot: NetworkSnapshot
  readonly calls: readonly HubCall[]
}) {
  const geometries = useMemo(() => {
    const seen = new Set<string>()
    return calls.flatMap((call, index) => {
      const directions = [
        directionForStop(snapshot, call.stop[0], call.previousStop, index),
        directionForStop(snapshot, call.stop[0], call.nextStop, index + Math.PI),
      ]
      return directions.flatMap((angle) => {
        const key = `${Math.round(angle * 28)}:${call.train.category}`
        if (seen.has(key)) return []
        seen.add(key)
        const points = [
          new THREE.Vector3(Math.cos(angle) * 0.8, 0.02, Math.sin(angle) * 0.8),
          new THREE.Vector3(Math.cos(angle) * 12.5, 0.02, Math.sin(angle) * 12.5),
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const material = new THREE.LineBasicMaterial({
          color: SERVICE_COLORS[call.train.category],
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
        })
        return [{ key, line: new THREE.Line(geometry, material) }]
      })
    })
  }, [calls, snapshot])

  useEffect(
    () => () =>
      geometries.forEach(({ line }) => {
        line.geometry.dispose()
        ;(line.material as THREE.Material).dispose()
      }),
    [geometries],
  )

  return geometries.map(({ key, line }) => <primitive key={key} object={line} />)
}

function StationCore({ hub }: { readonly hub: HubDefinition }) {
  const core = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!core.current) return
    const scale = 1 + Math.sin(state.clock.elapsedTime * 2.4) * 0.06
    core.current.scale.setScalar(scale)
    core.current.rotation.y = state.clock.elapsedTime * 0.08
  })
  return (
    <group ref={core}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.65, 0.92, 0.22, 12]} />
        <meshStandardMaterial
          color="#f9f7ff"
          emissive="#ff5edb"
          emissiveIntensity={4}
          wireframe
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
        <torusGeometry args={[1.12, 0.035, 8, 80]} />
        <meshBasicMaterial color="#8dfaff" blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight color="#ff5edb" intensity={9} distance={8} />
      <pointLight color="#8dfaff" intensity={5} distance={12} position={[0, 2, 0]} />
      <object3D name={hub.id} />
    </group>
  )
}

function HubTraffic({
  snapshot,
  calls,
  isPlaying,
  time,
  onTime,
}: Omit<HubPulseSceneProps, 'hub'>) {
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
      new THREE.BufferAttribute(new Float32Array(calls.length * 3), 3),
    )
    next.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(calls.length * 3), 3),
    )
    next.setDrawRange(0, 0)
    return next
  }, [calls.length])

  useEffect(() => {
    localTime.current = time
  }, [time])

  useFrame((state, delta) => {
    if (isPlaying) {
      localTime.current += delta * 20
      if (localTime.current > snapshot.metadata.windowEnd) {
        localTime.current = snapshot.metadata.windowStart
      }
    }

    const mutableGeometry = points.current?.geometry
    if (!mutableGeometry) return
    const positions = mutableGeometry.getAttribute('position') as THREE.BufferAttribute
    const colors = mutableGeometry.getAttribute('color') as THREE.BufferAttribute
    const positionArray = positions.array as Float32Array
    const colorArray = colors.array as Float32Array
    let active = 0

    calls.forEach((call, index) => {
      const [hubStop, arrival, departure] = call.stop
      if (
        localTime.current < arrival - pulseHorizon ||
        localTime.current > departure + pulseHorizon
      ) {
        return
      }

      const arriving = localTime.current < arrival
      const dwelling = localTime.current >= arrival && localTime.current <= departure
      const progress = arriving
        ? (arrival - localTime.current) / pulseHorizon
        : (localTime.current - departure) / pulseHorizon
      const direction = arriving
        ? directionForStop(snapshot, hubStop, call.previousStop, index)
        : directionForStop(snapshot, hubStop, call.nextStop, index + Math.PI)
      const radius = dwelling ? 0.35 : 0.55 + THREE.MathUtils.clamp(progress, 0, 1) * 10
      const offset = active * 3
      positionArray[offset] = Math.cos(direction) * radius
      positionArray[offset + 1] = dwelling ? 0.42 : 0.16 + Math.sin(index) * 0.05
      positionArray[offset + 2] = Math.sin(direction) * radius
      const color = palette[call.train.category] ?? palette.other
      colorArray[offset] = color.r
      colorArray[offset + 1] = color.g
      colorArray[offset + 2] = color.b
      active += 1
    })

    positions.needsUpdate = true
    colors.needsUpdate = true
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
          size={1.15}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={points} geometry={geometry}>
        <pointsMaterial
          vertexColors
          size={0.27}
          transparent
          opacity={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  )
}

function HubWorld(props: HubPulseSceneProps) {
  return (
    <>
      <fog attach="fog" args={['#050410', 18, 44]} />
      <ambientLight intensity={0.7} color="#7978d8" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[36, 36, 48, 48]} />
        <meshBasicMaterial color="#272852" wireframe transparent opacity={0.09} />
      </mesh>
      <OrbitalRings />
      <CorridorSpokes snapshot={props.snapshot} calls={props.calls} />
      <StationCore hub={props.hub} />
      <HubTraffic {...props} />
    </>
  )
}

export function HubPulseScene(props: HubPulseSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 15.5, 15.5], fov: 44, near: 0.1, far: 70 }}
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#050410']} />
      <HubWorld {...props} />
    </Canvas>
  )
}
