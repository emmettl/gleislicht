/* oxlint-disable react/immutability -- GPU uniforms and textures are updated in the R3F frame loop. */
import { useEffect, useMemo, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitalPlayback } from './OrbitalScene.tsx'
import { cloudFramePair, cloudTextureFrame, type CloudField } from './orbital-clouds.ts'
import { orbitalXZ } from './orbital-terrain.ts'
import { orbitalSun } from './orbital-sun.ts'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fragmentShader = `
  uniform sampler2D fieldA;
  uniform sampler2D fieldB;
  uniform float blend;
  uniform float strength;
  uniform float daylight;
  uniform float illumination;
  uniform vec2 grid;
  uniform vec2 extent;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }
  void main() {
    // The mesh spans sample centres. Texture sampling must also hit their centres.
    vec2 sampleUv = (vUv * (grid - 1.0) + 0.5) / grid;
    vec4 field = mix(texture2D(fieldA, sampleUv), texture2D(fieldB, sampleUv), blend);
    float coverage = field.r / max(field.a, 0.001);
    vec2 p = vUv * vec2(105.0, 45.0);
    // Stationary detail only: motion comes from interpolation of observed fields.
    float detail = 0.55*noise(p) + 0.3*noise(p*2.03) + 0.15*noise(p*4.07);
    float body = smoothstep(0.0, 0.3, coverage - detail * (1.0-coverage) * 0.62);
    // Feather in world units so all four sides dissolve over the same distance.
    // Broad, stationary variation breaks up the rectangular outline; multiplying
    // the two fades also softens corners instead of leaving a sharp diagonal join.
    vec2 borderDistance = min(vUv, 1.0-vUv) * extent;
    float featherWidth = 2.6 + 1.8 * noise(p * 0.13 + vec2(17.0, 9.0));
    vec2 feather = smoothstep(vec2(0.0), vec2(featherWidth), borderDistance);
    float edge = feather.x * feather.y;
    float alpha = body * coverage * field.a * strength * edge;
    if (alpha < 0.0005) discard;
    vec3 color = mix(vec3(0.25,0.33,0.46), vec3(0.82,0.89,0.94), daylight);
    color *= (0.88 + detail * 0.2) * illumination;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export default function OrbitalClouds({ field, playback, opacity, sunlight }: { field: CloudField; playback: MutableRefObject<OrbitalPlayback>; opacity: number; sunlight: boolean }) {
  const resources = useMemo(() => {
    const { columns, rows, bounds } = field.manifest
    const texture = (frame: number) => {
      const result = new THREE.DataTexture(cloudTextureFrame(field, frame), columns, rows, THREE.RGBAFormat)
      result.magFilter = THREE.LinearFilter; result.minFilter = THREE.LinearFilter; result.needsUpdate = true
      return result
    }
    const a = texture(0), b = texture(1)
    const [west, south] = orbitalXZ(bounds.west, bounds.south), [east, north] = orbitalXZ(bounds.east, bounds.north)
    const uniforms = { fieldA: { value: a }, fieldB: { value: b }, blend: { value: 0 }, strength: { value: 0.65 }, daylight: { value: 1 }, illumination: { value: 1 }, grid: { value: new THREE.Vector2(columns, rows) }, extent: { value: new THREE.Vector2(east - west, south - north) } }
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    const geometry = new THREE.PlaneGeometry(east - west, south - north)
    // Illustrative high cloud sheet, above exaggerated Alpine summits. No measured height is claimed.
    geometry.rotateX(-Math.PI / 2); geometry.translate((west + east) / 2, 3.25, (south + north) / 2)
    return { a, b, material, geometry, frame: 0 }
  // Opacity is a uniform, not a reason to reallocate the field.
  }, [field])
  useEffect(() => () => { resources.a.dispose(); resources.b.dispose(); resources.material.dispose(); resources.geometry.dispose() }, [resources])
  useFrame(() => {
    const [first, second, blend] = cloudFramePair(playback.current.time)
    if (resources.frame !== first) {
      resources.a.image.data!.set(cloudTextureFrame(field, first)); resources.a.needsUpdate = true
      resources.b.image.data!.set(cloudTextureFrame(field, second)); resources.b.needsUpdate = true
      resources.frame = first
    }
    const uniforms = resources.material.uniforms
    uniforms.blend.value = blend; uniforms.strength.value = opacity
    uniforms.daylight.value = sunlight ? THREE.MathUtils.smoothstep(orbitalSun(playback.current.time).altitude, -8, 18) : 0.75
    // Dim the clouds' light through dusk without changing their observed cover
    // or transparency. The neutral, sunlight-off view keeps its usual brightness.
    uniforms.illumination.value = sunlight ? 0.25 + 0.75 * uniforms.daylight.value : 1
  })
  return <mesh geometry={resources.geometry} material={resources.material} raycast={() => {}} />
}
