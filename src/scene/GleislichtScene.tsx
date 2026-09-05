import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { CorridorSnapshot } from '../domain/corridor.ts'

interface GleislichtSceneProps {
  readonly corridor?: CorridorSnapshot
  readonly isPlaying: boolean
  readonly progress: number
  readonly onProgress: (progress: number) => void
}

const HORIZONTAL_METRES_PER_UNIT = 1800
const VERTICAL_METRES_PER_UNIT = 390

function horizontalScale(corridor?: CorridorSnapshot) {
  return corridor?.id === 'kiental-griesalp' ? 650 : HORIZONTAL_METRES_PER_UNIT
}

function verticalScale(corridor: CorridorSnapshot) {
  return corridor.id === 'kiental-griesalp' ? 300 : VERTICAL_METRES_PER_UNIT
}

const fallbackRouteCurve = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-1.5, 0.25, 38),
    new THREE.Vector3(1.8, 0.12, 25),
    new THREE.Vector3(-0.8, 0.4, 13),
    new THREE.Vector3(2.2, 0.7, 1),
    new THREE.Vector3(-2.4, 1.2, -12),
    new THREE.Vector3(0.6, 1.7, -25),
    new THREE.Vector3(-1.2, 2.2, -40),
  ],
  false,
  'catmullrom',
  0.35,
)

function elevationToWorld(elevation: number, corridor: CorridorSnapshot) {
  return (elevation - corridor.terrain.minElevation) / verticalScale(corridor)
}

function routeCurveFor(corridor?: CorridorSnapshot) {
  if (!corridor?.route.points.length) return fallbackRouteCurve
  return new THREE.CatmullRomCurve3(
    corridor.route.points.map(
      ([x, z, elevation]) =>
        new THREE.Vector3(
          x / horizontalScale(corridor),
          elevationToWorld(elevation, corridor) + 0.055,
          z / horizontalScale(corridor),
        ),
    ),
    false,
    'centripetal',
    0.18,
  )
}

function makeRouteLine(
  curve: THREE.CatmullRomCurve3,
  color: string,
  opacity: number,
): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(520))
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  return new THREE.Line(geometry, material)
}

function TerrainMeshes({
  geometry,
  alpine = false,
}: {
  readonly geometry: THREE.PlaneGeometry
  readonly alpine?: boolean
}) {
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color={alpine ? '#10131b' : '#070b1b'}
          roughness={0.94}
          metalness={0.06}
        />
      </mesh>
      <mesh geometry={geometry} position={[0, 0.018, 0]}>
        <meshBasicMaterial
          color={alpine ? '#4f7d79' : '#5665bd'}
          transparent
          opacity={0.2}
          wireframe
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

function FallbackTerrain() {
  const geometry = useMemo(() => {
    const next = new THREE.PlaneGeometry(58, 96, 72, 124)
    next.rotateX(-Math.PI / 2)
    const positions = next.attributes.position
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index)
      const z = positions.getZ(index)
      const valley = Math.pow(Math.abs(x) / 8.5, 1.7) * 3.9
      const ridge =
        Math.sin(x * 0.48 + z * 0.12) * 1.4 +
        Math.cos(x * 0.19 - z * 0.29) * 0.9 +
        Math.sin(z * 0.52) * 0.36
      const distanceFade = THREE.MathUtils.smoothstep(Math.abs(x), 1.5, 7)
      positions.setY(index, Math.max(-0.45, valley + ridge * distanceFade - 0.7))
    }
    next.computeVertexNormals()
    return next
  }, [])
  return <TerrainMeshes geometry={geometry} />
}

function MeasuredTerrain({ corridor }: { readonly corridor: CorridorSnapshot }) {
  const geometry = useMemo(() => {
    const stride = window.matchMedia('(max-width: 700px)').matches ? 2 : 1
    const columns = Math.ceil((corridor.terrain.columns - 1) / stride) + 1
    const rows = Math.ceil((corridor.terrain.rows - 1) / stride) + 1
    const next = new THREE.PlaneGeometry(
      corridor.terrain.widthMetres / horizontalScale(corridor),
      corridor.terrain.depthMetres / horizontalScale(corridor),
      columns - 1,
      rows - 1,
    )
    next.rotateX(-Math.PI / 2)
    const positions = next.attributes.position
    for (let index = 0; index < positions.count; index += 1) {
      const column = index % columns
      const row = Math.floor(index / columns)
      const sourceColumn = Math.min(
        corridor.terrain.columns - 1,
        Math.round((column / (columns - 1)) * (corridor.terrain.columns - 1)),
      )
      const sourceRow = Math.min(
        corridor.terrain.rows - 1,
        Math.round((row / (rows - 1)) * (corridor.terrain.rows - 1)),
      )
      const elevation =
        corridor.terrain.elevations[
          sourceRow * corridor.terrain.columns + sourceColumn
        ]
      positions.setY(index, elevationToWorld(elevation, corridor))
    }
    next.computeVertexNormals()
    return next
  }, [corridor])
  return <TerrainMeshes geometry={geometry} alpine={corridor.id === 'kiental-griesalp'} />
}

function CorridorLakes({ corridor }: { readonly corridor: CorridorSnapshot }) {
  const lakes = useMemo(
    () =>
      corridor.lakes.flatMap((lake) => {
        const [outerRing, ...holes] = lake.rings
        if (!outerRing || outerRing.length < 4) return []
        const shape = new THREE.Shape(
          outerRing.map(
            ([x, z]) =>
              new THREE.Vector2(
                x / horizontalScale(corridor),
                -z / horizontalScale(corridor),
              ),
          ),
        )
        holes.forEach((ring) => {
          if (ring.length < 4) return
          shape.holes.push(
            new THREE.Path(
              ring.map(
                ([x, z]) =>
                  new THREE.Vector2(
                  x / horizontalScale(corridor),
                  -z / horizontalScale(corridor),
                  ),
              ),
            ),
          )
        })
        return [
          {
            id: lake.id,
            geometry: new THREE.ShapeGeometry(shape),
            height: elevationToWorld(lake.elevation, corridor) + 0.032,
          },
        ]
      }),
    [corridor],
  )
  useEffect(() => () => lakes.forEach((lake) => lake.geometry.dispose()), [lakes])
  return (
    <group>
      {lakes.map((lake) => (
        <mesh
          key={lake.id}
          geometry={lake.geometry}
          position={[0, lake.height, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial
            color="#063255"
            transparent
            opacity={0.68}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

function StationBeacons({
  corridor,
  curve,
}: {
  readonly corridor: CorridorSnapshot
  readonly curve: THREE.CatmullRomCurve3
}) {
  const positions = useMemo(
    () => corridor.route.stops.map((stop) => curve.getPointAt(stop.progress)),
    [corridor.route.stops, curve],
  )
  return (
    <group>
      {positions.map((position, index) => (
        <group key={corridor.route.stops[index].name} position={position}>
          <mesh position={[0, 0.045, 0]}>
            <sphereGeometry args={[0.035, 9, 7]} />
            <meshBasicMaterial color="#b8ffff" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.004, 0.012, 0.42, 6]} />
            <meshBasicMaterial
              color={
                index === 0 || index === positions.length - 1
                  ? '#ff57dd'
                  : '#7ff8ff'
              }
              transparent
              opacity={0.44}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function SignalField() {
  const geometry = useMemo(() => {
    const points: number[] = []
    for (let index = 0; index < 210; index += 1) {
      const angle = index * 2.399
      const radius = 11 + (index % 23) * 0.9
      points.push(
        Math.cos(angle) * radius,
        5 + ((index * 17) % 31) * 0.62,
        34 - ((index * 29) % 76),
      )
    }
    return new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points, 3),
    )
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#af8dff"
        size={0.045}
        transparent
        opacity={0.46}
        sizeAttenuation
      />
    </points>
  )
}

function Train({ alpine }: { readonly alpine: boolean }) {
  const offsets = alpine ? [-0.48, 0.34] : [-1.08, -0.36, 0.36, 1.08]
  return (
    <group scale={alpine ? 0.58 : 0.72}>
      {offsets.map((offset, index) => (
        <group key={offset} position={[0, 0.2, offset * 0.42]}>
          <mesh>
            <boxGeometry args={[0.38, 0.28, 0.38]} />
            <meshStandardMaterial
              color={alpine ? '#fff3c4' : '#fff4ff'}
              emissive={alpine ? '#ff9b43' : index === 0 ? '#ff4fdf' : '#806cff'}
              emissiveIntensity={3.6}
              wireframe
            />
          </mesh>
          <mesh position={[0, 0.02, 0]} scale={1.045}>
            <boxGeometry args={[0.38, 0.28, 0.38]} />
            <meshBasicMaterial color="#9afcff" transparent opacity={0.065} />
          </mesh>
        </group>
      ))}
      <pointLight color={alpine ? '#ff9b43' : '#ff4fdf'} intensity={8} distance={5} position={[0, 0.5, 0.8]} />
      <pointLight color="#78f7ff" intensity={5} distance={4} position={[0, 0.35, -0.8]} />
    </group>
  )
}

function MovingWorld({ corridor, isPlaying, progress, onProgress }: GleislichtSceneProps) {
  const train = useRef<THREE.Group>(null)
  const localProgress = useRef(progress)
  const lastReport = useRef(0)
  const { camera } = useThree()
  const alpine = corridor?.id === 'kiental-griesalp'
  const routeCurve = useMemo(() => routeCurveFor(corridor), [corridor])
  const rail = useMemo(
    () => makeRouteLine(routeCurve, alpine ? '#fff2b3' : '#b9ffff', 0.92),
    [alpine, routeCurve],
  )
  const railGlow = useMemo(
    () => makeRouteLine(routeCurve, alpine ? '#ff8c42' : '#ff4fdf', 0.32),
    [alpine, routeCurve],
  )
  const cameraPosition = useMemo(() => new THREE.Vector3(), [])
  const cameraTarget = useMemo(() => new THREE.Vector3(), [])
  const routePosition = useMemo(() => new THREE.Vector3(), [])
  const routeTangent = useMemo(() => new THREE.Vector3(), [])
  const side = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useEffect(() => {
    localProgress.current = progress
  }, [progress])
  useEffect(
    () => () => {
      rail.geometry.dispose()
      ;(rail.material as THREE.Material).dispose()
      railGlow.geometry.dispose()
      ;(railGlow.material as THREE.Material).dispose()
    },
    [rail, railGlow],
  )

  useFrame((state, delta) => {
    if (isPlaying) localProgress.current = (localProgress.current + delta * 0.012) % 1
    const current = localProgress.current
    routeCurve.getPointAt(current, routePosition)
    routeCurve.getTangentAt(current, routeTangent).normalize()
    if (train.current) {
      train.current.position.copy(routePosition)
      train.current.lookAt(routePosition.clone().add(routeTangent))
    }
    side.crossVectors(routeTangent, up).normalize()
    const sweep = Math.sin(current * Math.PI * 5) * 0.22
    cameraPosition
      .copy(routePosition)
      .addScaledVector(routeTangent, alpine ? -1.35 : -2.15)
      .addScaledVector(side, sweep)
      .addScaledVector(up, alpine ? 1.15 : corridor ? 0.92 : 2.8)
    cameraTarget
      .copy(routePosition)
      .addScaledVector(routeTangent, alpine ? 1.15 : corridor ? 1.65 : 5)
      .addScaledVector(up, 0.12)
    camera.position.lerp(cameraPosition, 1 - Math.exp(-delta * 2.35))
    camera.lookAt(cameraTarget)
    if (state.clock.elapsedTime - lastReport.current > 0.1) {
      lastReport.current = state.clock.elapsedTime
      onProgress(current)
    }
  })

  return (
    <>
      <fog attach="fog" args={[alpine ? '#070b12' : '#040410', corridor ? 5 : 12, alpine ? 27 : corridor ? 34 : 76]} />
      <ambientLight intensity={0.34} color={alpine ? '#9bc2b9' : '#8fa0ff'} />
      <directionalLight position={[-9, 15, 8]} color={alpine ? '#ffc47a' : '#757eff'} intensity={1.35} />
      <hemisphereLight args={[alpine ? '#86bfb0' : '#9b70ff', '#050511', 0.82]} />
      {corridor ? <MeasuredTerrain corridor={corridor} /> : <FallbackTerrain />}
      {corridor && <CorridorLakes corridor={corridor} />}
      <SignalField />
      <primitive object={railGlow} renderOrder={4} />
      <primitive object={rail} renderOrder={5} />
      {corridor && <StationBeacons corridor={corridor} curve={routeCurve} />}
      <group ref={train}>
        <Train alpine={alpine} />
      </group>
    </>
  )
}

export function GleislichtScene(props: GleislichtSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 3, 45], fov: 58, near: 0.06, far: 150 }}
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#040410']} />
      <MovingWorld {...props} />
    </Canvas>
  )
}
