import * as THREE from 'three'
import { cloudFramePair, cloudTextureFrame, type CloudField } from './orbital-clouds.ts'
import { orbitalXZ } from './orbital-terrain.ts'
import { orbitalSun } from './orbital-sun.ts'

// Lower cloud deck, with clearance above the exaggerated Alpine summits.
export const ORBITAL_CLOUD_HEIGHT = 2.75

// Shared by the visible clouds and their terrain projection, including the
// missing-data mask and feathered boundary. No second shadow-map pass is needed.
export const ORBITAL_CLOUD_GLSL = `
  uniform sampler2D orbitalCloudA;
  uniform sampler2D orbitalCloudB;
  uniform float orbitalCloudBlend;
  uniform vec2 orbitalCloudGrid;
  uniform vec2 orbitalCloudExtent;
  float orbitalCloudHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float orbitalCloudNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(orbitalCloudHash(i), orbitalCloudHash(i+vec2(1,0)), f.x), mix(orbitalCloudHash(i+vec2(0,1)), orbitalCloudHash(i+vec2(1,1)), f.x), f.y);
  }
  vec2 orbitalCloudDensity(vec2 uv) {
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec2(0.0);
    vec2 sampleUv = (uv * (orbitalCloudGrid - 1.0) + 0.5) / orbitalCloudGrid;
    vec4 field = mix(texture2D(orbitalCloudA, sampleUv), texture2D(orbitalCloudB, sampleUv), orbitalCloudBlend);
    float coverage = field.r / max(field.a, 0.001);
    vec2 p = uv * vec2(105.0, 45.0);
    float detail = 0.55*orbitalCloudNoise(p) + 0.3*orbitalCloudNoise(p*2.03) + 0.15*orbitalCloudNoise(p*4.07);
    float body = smoothstep(0.0, 0.3, coverage - detail * (1.0-coverage) * 0.62);
    vec2 borderDistance = min(uv, 1.0-uv) * orbitalCloudExtent;
    float featherWidth = 2.6 + 1.8 * orbitalCloudNoise(p * 0.13 + vec2(17.0, 9.0));
    vec2 feather = smoothstep(vec2(0.0), vec2(featherWidth), borderDistance);
    return vec2(body * coverage * field.a * feather.x * feather.y, detail);
  }
`

export function createCloudMaterialResources(field: CloudField) {
  const { columns, rows, bounds } = field.manifest
  const texture = (frame: number) => {
    const result = new THREE.DataTexture(cloudTextureFrame(field, frame), columns, rows, THREE.RGBAFormat)
    result.magFilter = THREE.LinearFilter; result.minFilter = THREE.LinearFilter; result.needsUpdate = true
    return result
  }
  const [west, south] = orbitalXZ(bounds.west, bounds.south), [east, north] = orbitalXZ(bounds.east, bounds.north)
  const a = texture(0), b = texture(1)
  const uniforms = {
    orbitalCloudA: { value: a }, orbitalCloudB: { value: b }, orbitalCloudBlend: { value: 0 },
    orbitalCloudGrid: { value: new THREE.Vector2(columns, rows) },
    orbitalCloudExtent: { value: new THREE.Vector2(east - west, south - north) },
    orbitalCloudOrigin: { value: new THREE.Vector2(west, south) },
    orbitalCloudSunSlope: { value: new THREE.Vector2() },
    orbitalCloudShadow: { value: 0 },
    strength: { value: 0.65 }, daylight: { value: 1 }, illumination: { value: 1 },
  }
  return { field, a, b, uniforms, west, south, east, north, frame: 0, time: NaN, opacity: NaN, sunlight: false }
}
export type CloudMaterialResources = ReturnType<typeof createCloudMaterialResources>

export function updateCloudMaterialResources(resources: CloudMaterialResources, time: number, opacity: number, sunlight: boolean) {
  if (resources.time === time && resources.opacity === opacity && resources.sunlight === sunlight) return
  resources.time = time; resources.opacity = opacity; resources.sunlight = sunlight
  const [first, second, blend] = cloudFramePair(time)
  if (resources.frame !== first) {
    resources.a.image.data!.set(cloudTextureFrame(resources.field, first)); resources.a.needsUpdate = true
    resources.b.image.data!.set(cloudTextureFrame(resources.field, second)); resources.b.needsUpdate = true
    resources.frame = first
  }
  const uniforms = resources.uniforms, sun = orbitalSun(time)
  uniforms.orbitalCloudBlend.value = blend; uniforms.strength.value = opacity
  uniforms.daylight.value = sunlight ? THREE.MathUtils.smoothstep(sun.altitude, -8, 18) : 0.75
  uniforms.illumination.value = sunlight ? 0.25 + 0.75 * uniforms.daylight.value : 1
  // Trace from the terrain towards the sun to find the cloud above that ray.
  // Fade the projection near the horizon, where the long rays leave this domain.
  const up = Math.max(0.1, sun.direction[1])
  uniforms.orbitalCloudSunSlope.value.set(sun.direction[0] / up, sun.direction[2] / up)
  uniforms.orbitalCloudShadow.value = sunlight ? 0.18 * opacity * THREE.MathUtils.smoothstep(sun.altitude, 0, 12) : 0
}

export function disposeCloudMaterialResources(resources: CloudMaterialResources) {
  resources.a.dispose(); resources.b.dispose()
}
