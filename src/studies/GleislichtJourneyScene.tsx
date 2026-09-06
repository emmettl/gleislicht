import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { CorridorSnapshot } from '../domain/corridor.ts'
import {
  vehicleKindForSwissCorridor,
  type SwitzerlandCorridorVehicleKind,
} from '../editions/switzerland-corridors.ts'

interface GleislichtSceneProps {
  readonly corridor?: CorridorSnapshot
  readonly isPlaying: boolean
  readonly progress: number
  readonly speedKmh?: number
  readonly onProgress: (progress: number) => void
  readonly onEnvironment?: (environment: JourneyEnvironment) => void
}

export interface JourneyEnvironment {
  readonly progress: number
  readonly tunnel: number
  readonly tunnelName?: string
  readonly openness: number
  readonly speed: number
  readonly region: 'plateau' | 'lake' | 'alpine'
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

function makeRouteLineRange(
  curve: THREE.CatmullRomCurve3,
  start: number,
  end: number,
  color: string,
  opacity: number,
): THREE.Line {
  const count = Math.max(8, Math.ceil((end - start) * 520))
  const points = Array.from({ length: count + 1 }, (_, index) =>
    curve.getPointAt(THREE.MathUtils.lerp(start, end, index / count)),
  )
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
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

function TunnelInfrastructure({
  corridor,
  curve,
}: {
  readonly corridor: CorridorSnapshot
  readonly curve: THREE.CatmullRomCurve3
}) {
  const tunnels = useMemo(
    () => corridor.route.tunnels ?? [],
    [corridor.route.tunnels],
  )
  const lines = useMemo(
    () =>
      tunnels.map((tunnel) =>
        makeRouteLineRange(
          curve,
          tunnel.startProgress,
          tunnel.endProgress,
          '#ff77df',
          0.9,
        ),
      ),
    [curve, tunnels],
  )
  const portals = useMemo(
    () =>
      tunnels.flatMap((tunnel) =>
        [tunnel.startProgress, tunnel.endProgress].map((progress, index) => {
          const position = curve.getPointAt(progress)
          const tangent = curve.getTangentAt(progress).normalize()
          const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            tangent,
          )
          return { id: `${tunnel.id}-${index}`, position, quaternion }
        }),
      ),
    [curve, tunnels],
  )
  useEffect(
    () => () =>
      lines.forEach((line) => {
        line.geometry.dispose()
        ;(line.material as THREE.Material).dispose()
      }),
    [lines],
  )
  if (!tunnels.length) return null
  return (
    <group>
      {lines.map((line, index) => (
        <primitive key={tunnels[index].id} object={line} renderOrder={9} />
      ))}
      {portals.map((portal) => (
        <group
          key={portal.id}
          position={portal.position}
          quaternion={portal.quaternion}
        >
          <mesh renderOrder={10}>
            <torusGeometry args={[0.13, 0.012, 8, 24]} />
            <meshBasicMaterial
              color="#ff8ae6"
              transparent
              opacity={0.72}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function sampleTerrainLocal(corridor: CorridorSnapshot, x: number, z: number) {
  const column = Math.max(
    0,
    Math.min(
      corridor.terrain.columns - 1,
      Math.round(
        ((x + corridor.terrain.widthMetres / 2) / corridor.terrain.widthMetres) *
          (corridor.terrain.columns - 1),
      ),
    ),
  )
  const row = Math.max(
    0,
    Math.min(
      corridor.terrain.rows - 1,
      Math.round(
        ((z + corridor.terrain.depthMetres / 2) / corridor.terrain.depthMetres) *
          (corridor.terrain.rows - 1),
      ),
    ),
  )
  return corridor.terrain.elevations[row * corridor.terrain.columns + column]
}

function terrainOpennessProfile(
  corridor: CorridorSnapshot | undefined,
  curve: THREE.CatmullRomCurve3,
) {
  if (!corridor) return [0.7]
  const radius = corridor.id === 'kiental-griesalp' ? 420 : 900
  const scale = horizontalScale(corridor)
  return Array.from({ length: 129 }, (_, index) => {
    const point = curve.getPointAt(index / 128)
    const routeElevation =
      corridor.terrain.minElevation + point.y * verticalScale(corridor)
    let rise = 0
    for (let direction = 0; direction < 8; direction += 1) {
      const angle = (direction / 8) * Math.PI * 2
      const elevation = sampleTerrainLocal(
        corridor,
        point.x * scale + Math.cos(angle) * radius,
        point.z * scale + Math.sin(angle) * radius,
      )
      rise += Math.max(0, elevation - routeElevation)
    }
    return THREE.MathUtils.clamp(1 - rise / 8 / 620, 0.08, 1)
  })
}

function routeRegion(corridor: CorridorSnapshot | undefined, progress: number) {
  if (corridor?.id === 'kiental-griesalp' || progress > 0.72) return 'alpine'
  if (progress >= 0.28) return 'lake'
  return 'plateau'
}

function activeTunnel(corridor: CorridorSnapshot | undefined, progress: number) {
  return corridor?.route.tunnels?.find(
    (tunnel) => progress >= tunnel.startProgress && progress <= tunnel.endProgress,
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

function RailVehicle() {
  const windowOffsets = [
    -1.02,
    -0.68,
    -0.34,
    0.2,
    0.54,
    0.88,
    1.48,
    1.82,
    2.16,
    2.5,
    2.84,
    3.18,
  ]
  return (
    <group scale={0.42}>
      <mesh position={[0, 0.37, -0.08]}>
        <boxGeometry args={[0.56, 0.5, 2.45]} />
        <meshStandardMaterial
          color="#f2f7ff"
          emissive="#6c6fff"
          emissiveIntensity={2.4}
          wireframe
        />
      </mesh>
      <mesh position={[0, 0.37, 2.42]}>
        <boxGeometry args={[0.56, 0.5, 2.38]} />
        <meshStandardMaterial
          color="#f2f7ff"
          emissive="#6c6fff"
          emissiveIntensity={2.4}
          wireframe
        />
      </mesh>
      <mesh
        position={[0, 0.34, 3.74]}
        rotation={[Math.PI / 2, Math.PI / 4, 0]}
      >
        <coneGeometry args={[0.38, 0.42, 4]} />
        <meshStandardMaterial
          color="#fff4ff"
          emissive="#ff4fdf"
          emissiveIntensity={3.4}
          wireframe
        />
      </mesh>
      <mesh position={[0, 0.67, -0.16]}>
        <boxGeometry args={[0.44, 0.07, 2.02]} />
        <meshBasicMaterial color="#9afcff" transparent opacity={0.22} />
      </mesh>
      <mesh position={[0, 0.67, 2.42]}>
        <boxGeometry args={[0.44, 0.07, 1.98]} />
        <meshBasicMaterial color="#9afcff" transparent opacity={0.22} />
      </mesh>
      <mesh position={[0, 0.37, -0.2]}>
        <boxGeometry args={[0.59, 0.52, 0.035]} />
        <meshBasicMaterial
          color="#ff78df"
          transparent
          opacity={0.72}
          wireframe
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.4, 3.624]}>
        <planeGeometry args={[0.38, 0.24]} />
        <meshBasicMaterial
          color="#8dfaff"
          transparent
          opacity={0.88}
          toneMapped={false}
        />
      </mesh>
      {[-1, 1].flatMap((side) =>
        windowOffsets.map((offset) => (
          <mesh
            key={`${side}-${offset}`}
            position={[side * 0.284, 0.43, offset]}
            rotation={[0, side * Math.PI / 2, 0]}
          >
            <planeGeometry args={[0.25, 0.16]} />
            <meshBasicMaterial
              color={offset > 0.8 ? '#ff78df' : '#8dfaff'}
              transparent
              opacity={0.84}
              toneMapped={false}
            />
          </mesh>
        )),
      )}
      {[-0.82, 0.72, 1.68, 2.94].map((z) => (
        <group key={z} position={[0, 0.13, z]}>
          <mesh>
            <boxGeometry args={[0.54, 0.14, 0.34]} />
            <meshBasicMaterial color="#160e29" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.39, -1.306]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.32, 0.3]} />
        <meshBasicMaterial
          color="#88eaff"
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </mesh>
      {[-0.16, 0.16].map((x) => (
        <mesh key={x} position={[x, 0.27, -1.325]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#ff4fdf" toneMapped={false} />
        </mesh>
      ))}
      <group position={[0, 0.75, -0.28]}>
        <mesh position={[-0.1, 0.14, 0]} rotation={[0, 0, -0.56]}>
          <boxGeometry args={[0.025, 0.38, 0.025]} />
          <meshBasicMaterial color="#ff78df" toneMapped={false} />
        </mesh>
        <mesh position={[0.1, 0.14, 0]} rotation={[0, 0, 0.56]}>
          <boxGeometry args={[0.025, 0.38, 0.025]} />
          <meshBasicMaterial color="#ff78df" toneMapped={false} />
        </mesh>
        <mesh position={[0.1, 0.43, 0]} rotation={[0, 0, -0.56]}>
          <boxGeometry args={[0.025, 0.38, 0.025]} />
          <meshBasicMaterial color="#ff78df" toneMapped={false} />
        </mesh>
        <mesh position={[-0.1, 0.43, 0]} rotation={[0, 0, 0.56]}>
          <boxGeometry args={[0.025, 0.38, 0.025]} />
          <meshBasicMaterial color="#ff78df" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <boxGeometry args={[0.46, 0.025, 0.05]} />
          <meshBasicMaterial color="#fff4ff" toneMapped={false} />
        </mesh>
      </group>
      <pointLight
        color="#ff4fdf"
        intensity={8}
        distance={5}
        position={[0, 0.5, 3.84]}
      />
      <pointLight
        color="#78f7ff"
        intensity={5}
        distance={4}
        position={[0, 0.38, -1.1]}
      />
    </group>
  )
}

function PostBusVehicle() {
  const sideWindows = [-0.42, -0.12, 0.18, 0.48]
  return (
    <group scale={0.62}>
      <mesh position={[0, 0.36, 0]}>
        <boxGeometry args={[0.62, 0.58, 1.42]} />
        <meshStandardMaterial
          color="#fff3c4"
          emissive="#ff9b43"
          emissiveIntensity={2.5}
          wireframe
        />
      </mesh>
      <mesh position={[0, 0.69, -0.03]}>
        <boxGeometry args={[0.5, 0.08, 1.18]} />
        <meshBasicMaterial color="#ffe4a0" transparent opacity={0.22} />
      </mesh>
      <mesh position={[0, 0.43, 0.714]}>
        <planeGeometry args={[0.46, 0.3]} />
        <meshBasicMaterial color="#8dfaff" transparent opacity={0.86} toneMapped={false} />
      </mesh>
      {[-1, 1].flatMap((side) =>
        sideWindows.map((offset) => (
          <mesh
            key={`${side}-${offset}`}
            position={[side * 0.314, 0.47, offset]}
            rotation={[0, side * Math.PI / 2, 0]}
          >
            <planeGeometry args={[0.22, 0.24]} />
            <meshBasicMaterial color="#8dfaff" transparent opacity={0.72} toneMapped={false} />
          </mesh>
        )),
      )}
      {[-0.45, 0.45].flatMap((z) =>
        [-1, 1].map((side) => (
          <mesh
            key={`${z}-${side}`}
            position={[side * 0.35, 0.16, z]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.13, 0.13, 0.09, 10]} />
            <meshBasicMaterial color="#23152b" />
          </mesh>
        )),
      )}
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.26, 0.73]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshBasicMaterial color="#fff3a6" toneMapped={false} />
        </mesh>
      ))}
      <pointLight color="#ff9b43" intensity={7} distance={4} position={[0, 0.48, 0.9]} />
      <pointLight color="#78f7ff" intensity={4} distance={3} position={[0, 0.4, -0.7]} />
    </group>
  )
}

function JourneyVehicle({ kind }: { readonly kind: SwitzerlandCorridorVehicleKind }) {
  return kind === 'bus' ? <PostBusVehicle /> : <RailVehicle />
}

function MovingWorld({
  corridor,
  isPlaying,
  progress,
  speedKmh = 96,
  onProgress,
  onEnvironment,
}: GleislichtSceneProps) {
  const train = useRef<THREE.Group>(null)
  const localProgress = useRef(progress)
  const lastReport = useRef(0)
  const { camera } = useThree()
  const alpine = corridor?.id === 'kiental-griesalp'
  const vehicleKind = vehicleKindForSwissCorridor(corridor)
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
  const cameraLookTarget = useMemo(() => new THREE.Vector3(), [])
  const routePosition = useMemo(() => new THREE.Vector3(), [])
  const routeTangent = useMemo(() => new THREE.Vector3(), [])
  const directionStart = useMemo(() => new THREE.Vector3(), [])
  const directionEnd = useMemo(() => new THREE.Vector3(), [])
  const desiredDirection = useMemo(() => new THREE.Vector3(), [])
  const smoothedDirection = useMemo(() => new THREE.Vector3(0, 0, -1), [])
  const side = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const forward = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  const vehicleQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const cameraReady = useRef(false)
  const lastCameraProgress = useRef(progress)
  const tunnelAmount = useRef(0)
  const opennessProfile = useMemo(
    () => terrainOpennessProfile(corridor, routeCurve),
    [corridor, routeCurve],
  )
  const backgroundColors = useMemo(
    () => ({
      plateau: new THREE.Color('#050410'),
      lake: new THREE.Color('#020b18'),
      alpine: new THREE.Color(alpine ? '#070b12' : '#06100f'),
      tunnel: new THREE.Color('#010105'),
    }),
    [alpine],
  )
  const fogColors = useMemo(
    () => ({
      plateau: new THREE.Color('#071226'),
      lake: new THREE.Color('#06304a'),
      alpine: new THREE.Color(alpine ? '#14211f' : '#10252a'),
      tunnel: new THREE.Color('#07030c'),
    }),
    [alpine],
  )
  const nextBackground = useMemo(() => new THREE.Color(), [])
  const nextFog = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    localProgress.current = progress
  }, [progress])
  useEffect(() => {
    cameraReady.current = false
    lastCameraProgress.current = localProgress.current
  }, [routeCurve])
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
    const tunnel = activeTunnel(corridor, current)
    tunnelAmount.current = THREE.MathUtils.damp(
      tunnelAmount.current,
      tunnel ? 1 : 0,
      5.5,
      delta,
    )
    const region = routeRegion(corridor, current)
    const tunnelMix = tunnelAmount.current
    const background = state.scene.background as THREE.Color
    const fog = state.scene.fog as THREE.Fog
    nextBackground.copy(backgroundColors[region]).lerp(backgroundColors.tunnel, tunnelMix)
    nextFog.copy(fogColors[region]).lerp(fogColors.tunnel, tunnelMix)
    background.lerp(nextBackground, 1 - Math.exp(-delta * 1.8))
    fog.color.lerp(nextFog, 1 - Math.exp(-delta * 2.2))
    routeCurve.getPointAt(current, routePosition)
    routeCurve.getTangentAt(current, routeTangent).normalize()
    if (train.current) {
      train.current.position.copy(routePosition)
      vehicleQuaternion.setFromUnitVectors(forward, routeTangent)
      train.current.quaternion.slerp(
        vehicleQuaternion,
        1 - Math.exp(-delta * 6),
      )
    }
    const directionSpan = alpine ? 0.012 : 0.009
    routeCurve.getPointAt(Math.max(0, current - directionSpan), directionStart)
    routeCurve.getPointAt(Math.min(1, current + directionSpan), directionEnd)
    desiredDirection.subVectors(directionEnd, directionStart).normalize()
    const progressJumped = Math.abs(current - lastCameraProgress.current) > 0.075
    lastCameraProgress.current = current
    if (!cameraReady.current || progressJumped) {
      smoothedDirection.copy(desiredDirection)
    } else {
      smoothedDirection
        .lerp(desiredDirection, 1 - Math.exp(-delta * 0.8))
        .normalize()
    }
    side.crossVectors(smoothedDirection, up).normalize()
    const cameraStyle = !corridor
      ? { behind: 2.15, height: 2.8, ahead: 5, sweep: 0.22 }
      : alpine
      ? { behind: 1.35, height: 1.15, ahead: 1.15, sweep: 0.24 }
      : region === 'lake'
        ? { behind: 2.55, height: 1.32, ahead: 2.35, sweep: 0.52 }
        : region === 'alpine'
          ? { behind: 1.82, height: 1.02, ahead: 1.55, sweep: 0.3 }
          : { behind: 2.15, height: 0.92, ahead: 1.65, sweep: 0.22 }
    const sweep =
      ((vehicleKind === 'train' ? 0.38 : 0) +
        Math.sin(current * Math.PI * 5) * cameraStyle.sweep) *
      (1 - tunnelMix)
    cameraPosition
      .copy(routePosition)
      .addScaledVector(
        smoothedDirection,
        -THREE.MathUtils.lerp(cameraStyle.behind, 0.72, tunnelMix),
      )
      .addScaledVector(side, sweep)
      .addScaledVector(
        up,
        THREE.MathUtils.lerp(cameraStyle.height, 0.34, tunnelMix),
      )
    cameraTarget
      .copy(routePosition)
      .addScaledVector(
        smoothedDirection,
        THREE.MathUtils.lerp(cameraStyle.ahead, 1.35, tunnelMix),
      )
      .addScaledVector(up, 0.12)
    if (!cameraReady.current || progressJumped) {
      camera.position.copy(cameraPosition)
      cameraLookTarget.copy(cameraTarget)
      cameraReady.current = true
    } else {
      camera.position.lerp(cameraPosition, 1 - Math.exp(-delta * 1.45))
      cameraLookTarget.lerp(cameraTarget, 1 - Math.exp(-delta * 0.7))
    }
    camera.lookAt(cameraLookTarget)
    if (state.clock.elapsedTime - lastReport.current > 0.1) {
      lastReport.current = state.clock.elapsedTime
      onProgress(current)
      onEnvironment?.({
        progress: current,
        tunnel: tunnelMix,
        tunnelName: tunnel?.name,
        openness: opennessProfile[Math.round(current * (opennessProfile.length - 1))],
        speed: THREE.MathUtils.clamp(speedKmh / 160, 0, 1),
        region,
      })
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
      {corridor && <TunnelInfrastructure corridor={corridor} curve={routeCurve} />}
      <group ref={train}>
        <JourneyVehicle kind={vehicleKind} />
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
