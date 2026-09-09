import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { ORBITAL_CLOUD_GLSL, ORBITAL_CLOUD_HEIGHT, type CloudMaterialResources } from './orbital-cloud-material.ts'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fragmentShader = `
  ${ORBITAL_CLOUD_GLSL}
  uniform float strength;
  uniform float daylight;
  uniform float illumination;
  varying vec2 vUv;
  void main() {
    vec2 cloud = orbitalCloudDensity(vUv);
    float alpha = cloud.x * strength;
    if (alpha < 0.0005) discard;
    vec3 color = mix(vec3(0.25,0.33,0.46), vec3(0.82,0.89,0.94), daylight);
    color *= (0.88 + cloud.y * 0.2) * illumination;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export default function OrbitalClouds({ resources }: { resources: CloudMaterialResources }) {
  const { material, geometry } = useMemo(() => {
    const { west, east, south, north, uniforms } = resources
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    const geometry = new THREE.PlaneGeometry(east - west, south - north)
    // Illustrative high cloud sheet, above exaggerated Alpine summits.
    geometry.rotateX(-Math.PI / 2); geometry.translate((west + east) / 2, ORBITAL_CLOUD_HEIGHT, (south + north) / 2)
    return { material, geometry }
  }, [resources])
  useEffect(() => () => { material.dispose(); geometry.dispose() }, [material, geometry])
  return <mesh geometry={geometry} material={material} raycast={() => {}} />
}
