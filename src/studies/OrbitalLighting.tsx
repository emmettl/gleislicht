/* oxlint-disable react/immutability -- Light properties are animated in R3F's frame loop. */
import { useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitalPlayback } from './OrbitalScene.tsx'
import { orbitalSun } from './orbital-sun.ts'

const ease = (value: number, low: number, high: number) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}
const WARM = new THREE.Color('#ffab63'), DAY = new THREE.Color('#fff5e5')
const NIGHT_SKY = new THREE.Color('#829ac2'), DAY_SKY = new THREE.Color('#c1daff')

export default function OrbitalLighting({ sunlight, playback }: { sunlight: boolean; playback: MutableRefObject<OrbitalPlayback> }) {
  const sun = useRef<THREE.DirectionalLight>(null), sky = useRef<THREE.HemisphereLight>(null)
  const key = useRef<THREE.DirectionalLight>(null), fill = useRef<THREE.DirectionalLight>(null), moon = useRef<THREE.DirectionalLight>(null)
  const blend = useRef(0)
  useFrame((_, delta) => {
    if (!sun.current || !sky.current || !key.current || !fill.current || !moon.current) return
    blend.current += ((sunlight ? 1 : 0) - blend.current) * (1 - Math.exp(-6 * Math.min(delta, 0.1)))
    const mix = blend.current
    key.current.intensity = 2.3 * (1 - mix); fill.current.intensity = 0.45 * (1 - mix); moon.current.intensity = 0.5 * (1 - mix)
    if (mix < 0.0001 && !sunlight) { sun.current.intensity = 0; sky.current.intensity = 0.55; sky.current.color.copy(NIGHT_SKY); return }
    const position = orbitalSun(playback.current.time)
    // A parallel light at the national centre. Twilight/colour are an artistic
    // clear-sky approximation; the geometric sun is off below the horizon.
    const daylight = ease(position.altitude, -6, 12)
    const direct = ease(position.altitude, 0, 12)
    sun.current.position.set(...position.direction).multiplyScalar(80)
    sun.current.intensity = 4.5 * direct * mix
    sun.current.color.copy(WARM).lerp(DAY, ease(position.altitude, 0, 30))
    sky.current.intensity = 0.55 + (0.12 + daylight * 1.5 - 0.55) * mix
    sky.current.color.copy(NIGHT_SKY).lerp(DAY_SKY, daylight * mix)
  })
  return <>
    <hemisphereLight ref={sky} args={['#829ac2', '#090d18', 0.55]} />
    <directionalLight ref={key} position={[-18, 12, -24]} color="#b6cae2" intensity={2.3} />
    <directionalLight ref={fill} position={[24, 9, 18]} color="#406285" intensity={0.45} />
    <directionalLight ref={moon} position={[0, 22, -14]} color="#a3cce4" intensity={0.5} />
    <directionalLight ref={sun} intensity={0} castShadow={sunlight}
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-28} shadow-camera-right={28}
      shadow-camera-top={28} shadow-camera-bottom={-28} shadow-camera-near={1} shadow-camera-far={130}
      shadow-bias={-0.00005} shadow-normalBias={0.015} />
  </>
}
