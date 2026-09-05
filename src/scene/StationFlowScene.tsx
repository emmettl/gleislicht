import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  platformTrackForCall,
  platformsForCalls,
  stationMotionForCall,
  UNASSIGNED_PLATFORM,
  type HubCall,
  type HubDefinition,
} from '../domain/hub.ts'
import {
  type NetworkSnapshot,
  type NetworkStop,
  type ServiceCategory,
} from '../domain/network.ts'
import { SERVICE_COLORS } from '../theme/visual-language.ts'
import { createGlowPointTexture } from './glow-point-texture.ts'

interface StationFlowSceneProps {
  readonly timeline: NetworkSnapshot['metadata']
  readonly hub: HubDefinition
  readonly calls: readonly HubCall[]
  readonly isPlaying: boolean
  readonly time: number
  readonly onTime: (time: number) => void
  readonly playbackRate: number
  readonly selectedCategory?: ServiceCategory
  readonly platformPrefix: string
}

const flowHorizon = 6 * 60
const trackLength = 43

function rowPosition(index: number, count: number): number {
  const spacing = Math.min(1.18, 19 / Math.max(1, count - 1))
  return (index - (count - 1) / 2) * spacing
}

function approachSide(
  hubStop: NetworkStop,
  neighbourStop: NetworkStop | undefined,
  fallback: number,
): -1 | 1 {
  if (!neighbourStop) return fallback % 2 === 0 ? -1 : 1
  const longitudeScale = Math.cos((hubStop[1] * Math.PI) / 180)
  const eastWest = (neighbourStop[0] - hubStop[0]) * longitudeScale
  const northSouth = neighbourStop[1] - hubStop[1]
  return eastWest + northSouth * 0.38 < 0 ? -1 : 1
}

function createPlatformTexture(
  platform: string,
  platformPrefix: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.font = '600 38px "DM Mono", monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.shadowColor = '#8dfaff'
    context.shadowBlur = 18
    context.fillStyle = '#dffeff'
    context.fillText(
      platform === UNASSIGNED_PLATFORM
        ? `${platformPrefix} ?`
        : `${platformPrefix} ${platform}`,
      128,
      48,
    )
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return texture
}

function PlatformPlan({
  platforms,
  platformPrefix,
}: {
  readonly platforms: readonly string[]
  readonly platformPrefix: string
}) {
  const labels = useMemo(
    () =>
      platforms.map((platform) =>
        createPlatformTexture(platform, platformPrefix),
      ),
    [platformPrefix, platforms],
  )

  useEffect(
    () => () => {
      labels.forEach((label) => label.dispose())
    },
    [labels],
  )

  const depth = Math.max(
    5,
    Math.abs(rowPosition(platforms.length - 1, platforms.length)) * 2 + 3,
  )

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <planeGeometry
          args={[58, depth + 8, 48, Math.max(12, platforms.length * 2)]}
        />
        <meshBasicMaterial color="#202448" wireframe transparent opacity={0.075} />
      </mesh>

      {platforms.map((platform, index) => {
        const z = rowPosition(index, platforms.length)
        const assigned = platform !== UNASSIGNED_PLATFORM
        return (
          <group key={platform} position={[0, 0, z]}>
            <mesh position={[0, 0.015, -0.2]}>
              <boxGeometry args={[trackLength, 0.025, 0.034]} />
              <meshBasicMaterial
                color={assigned ? '#5f78b8' : '#4e526c'}
                transparent
                opacity={0.55}
              />
            </mesh>
            <mesh position={[0, 0.015, 0.2]}>
              <boxGeometry args={[trackLength, 0.025, 0.034]} />
              <meshBasicMaterial
                color={assigned ? '#5f78b8' : '#4e526c'}
                transparent
                opacity={0.55}
              />
            </mesh>
            <mesh position={[0, -0.015, 0]}>
              <boxGeometry args={[trackLength - 4, 0.025, 0.31]} />
              <meshBasicMaterial
                color={assigned ? '#34375d' : '#272938'}
                transparent
                opacity={0.34}
              />
            </mesh>
            <sprite position={[-23.2, 0.58, 0]} scale={[3.2, 1.2, 1]}>
              <spriteMaterial
                map={labels[index]}
                transparent
                depthTest={false}
                opacity={assigned ? 0.9 : 0.46}
              />
            </sprite>
          </group>
        )
      })}

      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.72, 0.13, depth + 1.5]} />
        <meshStandardMaterial
          color="#382b63"
          emissive="#ff5edb"
          emissiveIntensity={1.8}
          transparent
          opacity={0.46}
        />
      </mesh>
      <pointLight color="#ff5edb" intensity={4.5} distance={11} position={[0, 2, 0]} />
    </group>
  )
}

function StationTraffic({
  calls,
  platforms,
  isPlaying,
  time,
  onTime,
  timeline,
  playbackRate,
  selectedCategory,
}: Omit<StationFlowSceneProps, 'hub'> & { readonly platforms: readonly string[] }) {
  const points = useRef<THREE.Points>(null)
  const glow = useRef<THREE.Points>(null)
  const localTime = useRef(time)
  const lastReport = useRef(0)
  const pointTexture = useMemo(() => createGlowPointTexture(), [])
  const platformRows = useMemo(
    () =>
      new Map(
        platforms.map((platform, index) => [
          platform,
          rowPosition(index, platforms.length),
        ]),
      ),
    [platforms],
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

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => pointTexture.dispose(), [pointTexture])

  useFrame((state, delta) => {
    if (isPlaying) {
      localTime.current += delta * playbackRate
      if (localTime.current > timeline.windowEnd) {
        localTime.current = timeline.windowStart
      }
    }

    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute
    const positionArray = positions.array as Float32Array
    const colorArray = colors.array as Float32Array
    let active = 0

    calls.forEach((call, index) => {
      const motion = stationMotionForCall(
        call,
        localTime.current,
        flowHorizon,
        timeline.windowEnd - timeline.windowStart,
      )
      if (!motion) return

      const previousSide = approachSide(call.hubStop, call.previousStop, index)
      const nextSide = approachSide(call.hubStop, call.nextStop, index + 1)
      const x =
        motion.phase === 'approaching'
          ? previousSide * (1 - motion.progress) * 20
          : motion.phase === 'departing'
            ? nextSide * motion.progress * 20
            : Math.sin(index * 2.7) * 0.19
      const z = platformRows.get(platformTrackForCall(call)) ?? 0
      const offset = active * 3
      positionArray[offset] = x
      positionArray[offset + 1] = motion.phase === 'dwelling' ? 0.38 : 0.24
      positionArray[offset + 2] = z
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
    geometry.setDrawRange(0, active)
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
          size={1.32}
          transparent
          opacity={0.19}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={points} geometry={geometry}>
        <pointsMaterial
          map={pointTexture}
          vertexColors
          size={0.3}
          transparent
          opacity={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  )
}

function StationWorld(
  props: StationFlowSceneProps & { readonly platforms: readonly string[] },
) {
  return (
    <>
      <fog attach="fog" args={['#050410', 25, 69]} />
      <ambientLight intensity={0.72} color="#7879d8" />
      <PlatformPlan
        platforms={props.platforms}
        platformPrefix={props.platformPrefix}
      />
      <StationTraffic {...props} platforms={props.platforms} />
      <object3D name={props.hub.id} />
    </>
  )
}

export function StationFlowScene(props: StationFlowSceneProps) {
  const platforms = useMemo(() => platformsForCalls(props.calls), [props.calls])
  const cameraHeight = Math.max(25, platforms.length * 1.15)

  return (
    <Canvas
      camera={{ position: [0, cameraHeight, 29], fov: 43, near: 0.1, far: 90 }}
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#050410']} />
      <StationWorld {...props} platforms={platforms} />
    </Canvas>
  )
}
