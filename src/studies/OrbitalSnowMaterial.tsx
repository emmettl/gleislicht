/* oxlint-disable react/immutability -- Uniforms are animated in R3F's frame loop. */
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MeshStandardMaterial } from 'three'
import { ORBITAL_HEIGHT_SCALE, ORBITAL_RELIEF } from './orbital-terrain.ts'

export default function OrbitalSnowMaterial({ enabled, altitude }: { enabled: boolean; altitude: number }) {
  const { material, uniforms } = useMemo(() => {
    const uniforms = {
      orbitalSnowline: { value: 2600 },
      orbitalSnowAmount: { value: 0 },
      orbitalSnowColor: { value: new Color('#e1edf4') },
    }
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.08 })
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = `varying vec3 vOrbitalGround;\nvarying vec3 vOrbitalSlope;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vOrbitalGround = position;
          // Undo display exaggeration when estimating a slope's snow retention.
          vOrbitalSlope = normalize(vec3(normal.x / ${ORBITAL_RELIEF.toFixed(1)}, normal.y, normal.z / ${ORBITAL_RELIEF.toFixed(1)}));`)
      shader.fragmentShader = `uniform float orbitalSnowline;
        uniform float orbitalSnowAmount;
        uniform vec3 orbitalSnowColor;
        varying vec3 vOrbitalGround;
        varying vec3 vOrbitalSlope;
        ${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
          float elevation = vOrbitalGround.y / ${ORBITAL_HEIGHT_SCALE.toFixed(12)};
          vec2 ground = vOrbitalGround.xz;
          // Stable patches soften the altitude boundary; this is a visual
          // simulation, not a measured snowpack or weather model.
          float patches = sin(ground.x * 17.1 + sin(ground.y * 9.2)) * sin(ground.y * 14.3)
            + 0.35 * sin(ground.x * 53.0 + ground.y * 41.0);
          float edge = orbitalSnowline + patches * 70.0;
          float cover = smoothstep(edge - 120.0, edge + 120.0, elevation);
          float retention = smoothstep(0.45, 0.85, normalize(vOrbitalSlope).y);
          float snow = cover * retention * orbitalSnowAmount;
          diffuseColor.rgb = mix(diffuseColor.rgb, orbitalSnowColor, snow * 0.96);`)
    }
    material.customProgramCacheKey = () => 'orbital-snow-v1'
    return { material, uniforms }
  }, [])
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-10 * Math.min(delta, 0.1))
    uniforms.orbitalSnowline.value += (altitude - uniforms.orbitalSnowline.value) * blend
    uniforms.orbitalSnowAmount.value += ((enabled ? 1 : 0) - uniforms.orbitalSnowAmount.value) * blend
  })
  useEffect(() => () => material.dispose(), [material])
  return <primitive object={material} attach="material" />
}
