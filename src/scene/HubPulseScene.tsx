import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { HubCall, HubDefinition } from '../domain/hub.ts'
import {
  SERVICE_COLORS,
  type NetworkStop,
  type NetworkSnapshot,
  type ServiceCategory,
} from '../domain/network.ts'
import { createGlowPointTexture } from './glow-point-texture.ts'

interface HubPulseSceneProps {
  readonly timeline: NetworkSnapshot['metadata']
  readonly hub: HubDefinition
  readonly calls: readonly HubCall[]
  readonly isPlaying: boolean
  readonly time: number
  readonly onTime: (time: number) => void
  readonly playbackRate: number
  readonly selectedCategory?: ServiceCategory
  readonly showTaktOverlay: boolean
}

const pulseHorizon = 15 * 60

function textSprite(
  text: string,
  color: string,
  scale: readonly [number, number],
): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = 'rgba(5, 4, 16, 0.9)'
    context.strokeStyle = 'rgba(141, 250, 255, 0.58)'
    context.lineWidth = 2
    context.beginPath()
    context.roundRect(3, 3, 506, 90, 14)
    context.fill()
    context.stroke()
    context.fillStyle = color
    context.font = '700 31px Helvetica, Arial, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.shadowColor = color
    context.shadowBlur = 12
    context.fillText(text, 256, 49, 472)
    context.shadowBlur = 0
    context.fillText(text, 256, 49, 472)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    fog: false,
    toneMapped: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(scale[0], scale[1], 1)
  sprite.renderOrder = 12
  return sprite
}

function disposeTextSprite(sprite: THREE.Sprite) {
  const material = sprite.material as THREE.SpriteMaterial
  material.map?.dispose()
  material.dispose()
}

function directionForStop(
  hubStop: NetworkStop,
  neighbourStop: NetworkStop | undefined,
  fallback: number,
): number {
  if (!neighbourStop) return fallback
  const longitudeScale = Math.cos((hubStop[1] * Math.PI) / 180)
  const x = (neighbourStop[0] - hubStop[0]) * longitudeScale
  const z = -(neighbourStop[1] - hubStop[1])
  return Math.atan2(z, x)
}

function TickMarks() {
  const ticks = useMemo(() => {
    const group = new THREE.Group()
    Array.from({ length: 60 }, (_, index) => {
      const angle = (index / 60) * Math.PI * 2
      const quarter = index % 15 === 0
      const hour = index % 5 === 0
      const inner = quarter ? 9.82 : hour ? 10.14 : 10.44
      const outer = 10.86
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(angle) * inner, Math.sin(angle) * inner, 0),
        new THREE.Vector3(Math.cos(angle) * outer, Math.sin(angle) * outer, 0),
      ])
      const material = new THREE.LineBasicMaterial({
        color: quarter ? '#e9feff' : hour ? '#ff5edb' : '#8992c7',
        transparent: true,
        opacity: quarter ? 0.92 : hour ? 0.5 : 0.2,
        blending: THREE.AdditiveBlending,
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

function ClockHands({
  time,
  isPlaying,
  playbackRate,
  timeline,
}: Pick<HubPulseSceneProps, 'time' | 'isPlaying' | 'playbackRate' | 'timeline'>) {
  const hourHand = useRef<THREE.Group>(null)
  const minuteHand = useRef<THREE.Group>(null)
  const secondHand = useRef<THREE.Group>(null)
  const localTime = useRef(time)

  useEffect(() => {
    localTime.current = time
  }, [time])

  useFrame((_, delta) => {
    if (isPlaying) {
      localTime.current += delta * playbackRate
      if (localTime.current > timeline.windowEnd) {
        localTime.current = timeline.windowStart
      }
    }

    const timeOfDay = ((localTime.current % 86_400) + 86_400) % 86_400
    const hourAngle = (timeOfDay / 43_200) * Math.PI * 2
    const minuteAngle = ((timeOfDay % 3_600) / 3_600) * Math.PI * 2
    const secondAngle = ((timeOfDay % 60) / 60) * Math.PI * 2
    if (hourHand.current) hourHand.current.rotation.y = -hourAngle
    if (minuteHand.current) minuteHand.current.rotation.y = -minuteAngle
    if (secondHand.current) secondHand.current.rotation.y = -secondAngle
  })

  return (
    <group>
      <group ref={hourHand} position={[0, 0.32, 0]}>
        <mesh position={[0, 0, -2.15]}>
          <boxGeometry args={[0.3, 0.08, 4.3]} />
          <meshBasicMaterial
            color="#ff5edb"
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      <group ref={minuteHand} position={[0, 0.4, 0]}>
        <mesh position={[0, 0, -3.65]}>
          <boxGeometry args={[0.16, 0.07, 7.3]} />
          <meshBasicMaterial
            color="#e9feff"
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      <group ref={secondHand} position={[0, 0.48, 0]}>
        <mesh position={[0, 0, -4.15]}>
          <boxGeometry args={[0.055, 0.055, 8.3]} />
          <meshBasicMaterial
            color="#ff416c"
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh position={[0, 0, -7.28]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshBasicMaterial color="#ff416c" />
        </mesh>
        <mesh position={[0, 0, 0.82]}>
          <boxGeometry args={[0.055, 0.055, 1.64]} />
          <meshBasicMaterial color="#ff416c" />
        </mesh>
      </group>
      <mesh position={[0, 0.57, 0]}>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshBasicMaterial color="#f5feff" />
      </mesh>
      <pointLight color="#ff416c" intensity={2.8} distance={7} position={[0, 1, 0]} />
    </group>
  )
}

function ClockFace(
  props: Pick<
    HubPulseSceneProps,
    'time' | 'isPlaying' | 'playbackRate' | 'timeline' | 'showTaktOverlay'
  >,
) {
  return (
    <>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {[3.8, 7.2, 10.72].map((radius, index) => (
          <mesh key={radius}>
            <ringGeometry
              args={[
                radius - (index === 2 ? 0.055 : 0.022),
                radius + (index === 2 ? 0.055 : 0.022),
                128,
              ]}
            />
            <meshBasicMaterial
              color={index === 2 ? '#e9feff' : index === 1 ? '#8dfaff' : '#786bcb'}
              transparent
              opacity={index === 2 ? 0.42 : index === 1 ? 0.16 : 0.1}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
        <TickMarks />
      </group>
      {props.showTaktOverlay && <QuarterHourOverlay />}
      <ClockHands {...props} />
    </>
  )
}

function QuarterHourOverlay() {
  const labels = useMemo(
    () =>
      [':00', ':15', ':30', ':45'].map((label, index) => {
        const angle = Math.PI / 2 - (index / 4) * Math.PI * 2
        const sprite = textSprite(label, index === 0 ? '#f9f7ff' : '#ff8be7', [1.7, 0.42])
        sprite.position.set(Math.cos(angle) * 4.5, 0.72, Math.sin(angle) * 4.5)
        return sprite
      }),
    [],
  )

  useEffect(() => () => labels.forEach(disposeTextSprite), [labels])

  return labels.map((sprite, index) => (
    <primitive key={index} object={sprite} />
  ))
}

function HubDestinationLabels({ calls }: { readonly calls: readonly HubCall[] }) {
  const labels = useMemo(() => {
    const bins = new Map<
      number,
      { angle: number; destinations: Map<string, number> }
    >()
    calls.forEach((call, index) => {
      if (!call.nextStop) return
      const angle = directionForStop(call.hubStop, call.nextStop, index)
      const normalized = (angle + Math.PI * 2) % (Math.PI * 2)
      const bin = Math.round((normalized / (Math.PI * 2)) * 18) % 18
      const current = bins.get(bin) ?? {
        angle,
        destinations: new Map<string, number>(),
      }
      current.destinations.set(
        call.train.headsign,
        (current.destinations.get(call.train.headsign) ?? 0) + 1,
      )
      bins.set(bin, current)
    })

    return [...bins.values()]
      .map(({ angle, destinations }) => {
        const [destination, count] = [...destinations.entries()].sort(
          (first, second) => second[1] - first[1],
        )[0]
        return { angle, destination, count }
      })
      .sort((first, second) => second.count - first.count)
      .slice(0, 9)
      .map(({ angle, destination }) => {
        const label = destination.length > 24 ? `${destination.slice(0, 23)}…` : destination
        const sprite = textSprite(label, '#c9fcff', [3.65, 0.68])
        sprite.position.set(Math.cos(angle) * 12.35, 0.8, Math.sin(angle) * 12.35)
        return sprite
      })
  }, [calls])

  useEffect(() => () => labels.forEach(disposeTextSprite), [labels])

  return labels.map((sprite, index) => (
    <primitive key={index} object={sprite} />
  ))
}

function CorridorSpokes({
  calls,
  selectedCategory,
}: {
  readonly calls: readonly HubCall[]
  readonly selectedCategory?: ServiceCategory
}) {
  const geometries = useMemo(() => {
    const seen = new Set<string>()
    return calls.flatMap((call, index) => {
      const directions = [
        directionForStop(call.hubStop, call.previousStop, index),
        directionForStop(call.hubStop, call.nextStop, index + Math.PI),
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
          opacity:
            selectedCategory && selectedCategory !== call.train.category ? 0.025 : 0.12,
          blending: THREE.AdditiveBlending,
        })
        return [{ key, line: new THREE.Line(geometry, material) }]
      })
    })
  }, [calls, selectedCategory])

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
  calls,
  isPlaying,
  time,
  onTime,
  timeline,
  playbackRate,
  selectedCategory,
}: Omit<HubPulseSceneProps, 'hub'>) {
  const points = useRef<THREE.Points>(null)
  const glow = useRef<THREE.Points>(null)
  const localTime = useRef(time)
  const lastReport = useRef(0)
  const pointTexture = useMemo(() => createGlowPointTexture(), [])
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

  useEffect(
    () => () => {
      geometry.dispose()
      pointTexture.dispose()
    },
    [geometry, pointTexture],
  )

  useFrame((state, delta) => {
    if (isPlaying) {
      localTime.current += delta * playbackRate
      if (localTime.current > timeline.windowEnd) {
        localTime.current = timeline.windowStart
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
      const cycle = timeline.windowEnd - timeline.windowStart
      const midpoint = (call.arrival + call.departure) / 2
      const cycleOffset = Math.round((localTime.current - midpoint) / cycle) * cycle
      const arrival = call.arrival + cycleOffset
      const departure = call.departure + cycleOffset
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
        ? directionForStop(call.hubStop, call.previousStop, index)
        : directionForStop(call.hubStop, call.nextStop, index + Math.PI)
      const radius = dwelling ? 0.35 : 0.55 + THREE.MathUtils.clamp(progress, 0, 1) * 10
      const offset = active * 3
      positionArray[offset] = Math.cos(direction) * radius
      positionArray[offset + 1] = dwelling ? 0.42 : 0.16 + Math.sin(index) * 0.05
      positionArray[offset + 2] = Math.sin(direction) * radius
      const color = palette[call.train.category] ?? palette.other
      const intensity =
        selectedCategory && selectedCategory !== call.train.category ? 0.025 : 1
      colorArray[offset] = color.r * intensity
      colorArray[offset + 1] = color.g * intensity
      colorArray[offset + 2] = color.b * intensity
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
          map={pointTexture}
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
          map={pointTexture}
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
      <ClockFace
        time={props.time}
        isPlaying={props.isPlaying}
        playbackRate={props.playbackRate}
        timeline={props.timeline}
        showTaktOverlay={props.showTaktOverlay}
      />
      <CorridorSpokes
        calls={props.calls}
        selectedCategory={props.selectedCategory}
      />
      <StationCore hub={props.hub} />
      <HubDestinationLabels calls={props.calls} />
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
