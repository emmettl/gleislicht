import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

interface GleislichtSceneProps {
  readonly isPlaying: boolean
  readonly progress: number
  readonly onProgress: (progress: number) => void
}

const routeCurve = new THREE.CatmullRomCurve3(
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

function makeRouteLine(color: string, opacity: number): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(routeCurve.getPoints(280))
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
  })
  return new THREE.Line(geometry, material)
}

function Terrain() {
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

  return (
    <group position={[0, -0.45, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#080b1e" roughness={0.92} metalness={0.08} />
      </mesh>
      <mesh geometry={geometry} position={[0, 0.025, 0]}>
        <meshBasicMaterial
          color="#4850a8"
          transparent
          opacity={0.2}
          wireframe
        />
      </mesh>
    </group>
  )
}

function SignalField() {
  const geometry = useMemo(() => {
    const points: number[] = []
    for (let index = 0; index < 260; index += 1) {
      const angle = index * 2.399
      const radius = 9 + (index % 23) * 0.82
      points.push(
        Math.cos(angle) * radius,
        3.2 + ((index * 17) % 31) * 0.56,
        44 - ((index * 29) % 96),
      )
    }
    return new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points, 3),
    )
  }, [])

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#af8dff"
        size={0.052}
        transparent
        opacity={0.52}
        sizeAttenuation
      />
    </points>
  )
}

function Train() {
  return (
    <group>
      {[-1.32, -0.44, 0.44, 1.32].map((offset, index) => (
        <group key={offset} position={[0, 0.38, offset]}>
          <mesh>
            <boxGeometry args={[0.68, 0.62, 0.78]} />
            <meshStandardMaterial
              color="#fff4ff"
              emissive={index === 0 ? '#ff4fdf' : '#806cff'}
              emissiveIntensity={3.8}
              wireframe
            />
          </mesh>
          <mesh position={[0, 0.04, 0]} scale={1.035}>
            <boxGeometry args={[0.68, 0.62, 0.78]} />
            <meshBasicMaterial color="#9afcff" transparent opacity={0.07} />
          </mesh>
        </group>
      ))}
      <pointLight color="#ff4fdf" intensity={10} distance={8} position={[0, 0.6, 1.7]} />
      <pointLight color="#78f7ff" intensity={6} distance={7} position={[0, 0.4, -1.6]} />
    </group>
  )
}

function MovingWorld({
  isPlaying,
  progress,
  onProgress,
}: GleislichtSceneProps) {
  const train = useRef<THREE.Group>(null)
  const localProgress = useRef(progress)
  const lastReport = useRef(0)
  const { camera } = useThree()
  const rail = useMemo(() => makeRouteLine('#8dfaff', 0.9), [])
  const railGlow = useMemo(() => makeRouteLine('#e34cff', 0.28), [])
  const cameraPosition = useMemo(() => new THREE.Vector3(), [])
  const cameraTarget = useMemo(() => new THREE.Vector3(), [])
  const routePosition = useMemo(() => new THREE.Vector3(), [])
  const routeTangent = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    localProgress.current = progress
  }, [progress])

  useFrame((state, delta) => {
    if (isPlaying) {
      localProgress.current = (localProgress.current + delta * 0.018) % 1
    }

    const current = localProgress.current
    routeCurve.getPointAt(current, routePosition)
    routeCurve.getTangentAt(current, routeTangent).normalize()

    if (train.current) {
      train.current.position.copy(routePosition)
      train.current.lookAt(routePosition.clone().add(routeTangent))
    }

    cameraPosition
      .copy(routePosition)
      .addScaledVector(routeTangent, -6.6)
      .add(new THREE.Vector3(0, 2.8, 0))
    cameraTarget.copy(routePosition).addScaledVector(routeTangent, 5)

    camera.position.lerp(cameraPosition, 1 - Math.exp(-delta * 2.7))
    camera.lookAt(cameraTarget)

    if (state.clock.elapsedTime - lastReport.current > 0.1) {
      lastReport.current = state.clock.elapsedTime
      onProgress(current)
    }
  })

  return (
    <>
      <fog attach="fog" args={['#050410', 12, 76]} />
      <ambientLight intensity={0.35} color="#8fa0ff" />
      <directionalLight position={[-9, 15, 8]} color="#757eff" intensity={1.4} />
      <hemisphereLight args={['#9b70ff', '#060511', 0.9]} />
      <Terrain />
      <SignalField />
      <primitive object={railGlow} position={[0, 0.05, 0]} scale={[1.01, 1.01, 1.01]} />
      <primitive object={rail} position={[0, 0.08, 0]} />
      <group ref={train}>
        <Train />
      </group>
    </>
  )
}

export function GleislichtScene(props: GleislichtSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 3, 45], fov: 58, near: 0.1, far: 130 }}
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#050410']} />
      <MovingWorld {...props} />
    </Canvas>
  )
}
