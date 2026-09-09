/* oxlint-disable react/immutability -- R3F updates caller-owned typed GPU buffers and a mutable playback ref inside useFrame. */
import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import OrbitalClouds from './OrbitalClouds.tsx'
import type { CloudField } from './orbital-clouds.ts'
import OrbitalLighting from './OrbitalLighting.tsx'
import OrbitalSnowMaterial from './OrbitalSnowMaterial.tsx'
import OrbitalCityLabels from './OrbitalCityLabels.tsx'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { orbitalFlight } from './orbital-flight.ts'
import { ORBITAL_COLORS, orbitalJourneyOpacity, orbitalPosition, orbitalTunnelOpacity, orbitalSurfaceIntervals, type OrbitalChunk } from './orbital-data.ts'
import { createOrbitalSurface, orbitalLandIndices, orbitalXZ, ORBITAL_HEIGHT_SCALE, type OrbitalSurface, type OrbitalTerrain } from './orbital-terrain.ts'

export interface OrbitalPlayback { time: number; playing: boolean; speed: number; trail: number; drift: boolean; ready: boolean; categories: boolean[] }
export interface OrbitalGeography { rings: number[][][]; lakes: { id: string; polygons: number[][][][] }[] }
const coordinate = ([lon, lat]: number[], height = 0): [number, number, number] => [(lon - 8.23) * Math.cos(46.8 * Math.PI / 180) * 12, height, -(lat - 46.8) * 12]

function Camera({ playback, reset, altitude, formatAltitude }: { formatAltitude: (height: number) => string; playback: MutableRefObject<OrbitalPlayback>; reset: number; altitude: RefObject<HTMLOutputElement | null> }) {
  const { camera, gl, size } = useThree()
  const controlRef = useRef<OrbitControls | null>(null)
  const altitudeElapsed = useRef(0.1)
  const framing = useRef<{ scale: number; reset: number } | null>(null)
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controlRef.current = controls
    controls.enableDamping = true; controls.dampingFactor = 0.055
    controls.minDistance = 4; controls.maxDistance = 110
    controls.maxPolarAngle = Math.PI * 0.46; controls.minPolarAngle = 0.1
    controls.autoRotateSpeed = 0.1; controls.zoomSpeed = 0.65
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN
    if (window.matchMedia('(pointer: coarse)').matches) controls.screenSpacePanning = false
    const stopDrift = () => { playback.current.drift = false }
    controls.addEventListener('start', stopDrift)
    const handle = { capture: () => ({ position: camera.position.toArray(), target: controls.target.toArray(), fov: (camera as THREE.PerspectiveCamera).fov }), restore: () => {} }
    orbitalFlight.orbit = handle
    return () => {
      if (orbitalFlight.orbit === handle) orbitalFlight.orbit = null
      controls.removeEventListener('start', stopDrift); controls.dispose(); controlRef.current = null
    }
  }, [camera, gl, playback])
  useEffect(() => {
    const scale = Math.max(1, 1.25 / (size.width / size.height))
    const controls = controlRef.current, previous = framing.current
    if (controls) controls.maxDistance = 110 * scale
    if (previous && previous.reset === reset && controls) {
      // Resize the framing while preserving the angle and panned location.
      camera.position.sub(controls.target).multiplyScalar(scale / previous.scale).add(controls.target)
    } else {
      camera.position.set(0, 39 * scale, 24 * scale)
      controls?.target.set(0, 0, 0)
    }
    framing.current = { scale, reset }; controls?.update()
  }, [camera, size.width, size.height, reset])
  useFrame((_, delta) => {
    const controls = controlRef.current
    const pose = orbitalFlight.pose
    if (controls && pose) {
      controls.enabled = false
      camera.position.fromArray(pose.position); controls.target.fromArray(pose.target)
      camera.lookAt(controls.target)
      if (camera instanceof THREE.PerspectiveCamera) { camera.fov = pose.fov; camera.updateProjectionMatrix() }
      camera.updateMatrixWorld()
    } else if (controls) {
      controls.enabled = orbitalFlight.phase === 'orbital'
      controls.autoRotate = controls.enabled && playback.current.drift
      if (controls.enabled) controls.update(Math.min(delta, 0.1))
    }
    altitudeElapsed.current += delta
    if (altitude.current && altitudeElapsed.current >= 0.1) {
      // Invert the same vertical scale used by terrain elevations. Camera y is
      // height above the sea-level plane, not distance to the orbit target.
      const value = formatAltitude(camera.position.y / ORBITAL_HEIGHT_SCALE / 1000)
      if (altitude.current.textContent !== value) altitude.current.textContent = value
      altitudeElapsed.current = 0
    }
  })
  return null
}

function Geography({ geography, terrain, surface, sunlight, snowEnabled, snowline }: { snowEnabled: boolean; snowline: number; geography: OrbitalGeography; terrain: OrbitalTerrain; surface: OrbitalSurface; sunlight: boolean }) {
  const geometry = useMemo(() => {
    const outline: number[] = [], shore: number[] = [], waterPositions: number[] = [], waterIndices: number[] = []
    const land = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(surface.positions, 3))
    const rings = geography.rings.map(ring => ring.map(([lon, lat]) => orbitalXZ(lon, lat)))
    land.setIndex(new THREE.BufferAttribute(orbitalLandIndices(surface, rings), 1))
    // Share positions, with a coarser index for the extra shadow pass. The
    // visible terrain keeps its full resolution.
    const shadow = new THREE.BufferGeometry().setAttribute('position', land.getAttribute('position'))
    shadow.setIndex(new THREE.BufferAttribute(orbitalLandIndices(surface, rings, Math.ceil((surface.columns - 1) / 768)), 1))
    const colors = new Float32Array(surface.positions.length)
    const low = new THREE.Color('#122132'), high = new THREE.Color('#405267'), snow = new THREE.Color('#748595'), color = new THREE.Color()
    for (let i = 0; i < terrain.elevations.length; i++) {
      const elevation = terrain.elevations[i]
      color.copy(low).lerp(high, Math.min(1, Math.max(0, (elevation - 350) / 2800)))
      if (elevation > 2800) color.lerp(snow, Math.min(0.7, (elevation - 2800) / 1800))
      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b
    }
    land.setAttribute('color', new THREE.BufferAttribute(colors, 3)); land.computeVertexNormals()
    for (const ring of geography.rings) for (let i = 1; i < ring.length; i++) {
      const a = coordinate(ring[i - 1]), b = coordinate(ring[i]), steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.06))
      for (let step = 0; step < steps; step++) for (const t of [step / steps, (step + 1) / steps]) {
        const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t
        outline.push(x, surface.height(x, z) + 0.015, z)
      }
    }
    for (const lake of geography.lakes) for (const polygon of lake.polygons) {
      const rings = polygon.map(ring => ring.map(p => { const [x, , z] = coordinate(p); return new THREE.Vector2(x, -z) }))
      const shape = new THREE.Shape(rings[0]); rings.slice(1).forEach(hole => shape.holes.push(new THREE.Path(hole)))
      const mesh = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), positions = mesh.getAttribute('position')
      const level = (terrain.lakeElevations?.[lake.id] ?? 0) * ORBITAL_HEIGHT_SCALE + 0.012
      const base = waterPositions.length / 3
      for (let i = 0; i < positions.count; i++) waterPositions.push(positions.getX(i), level, positions.getZ(i))
      if (mesh.index) for (let i = 0; i < mesh.index.count; i++) waterIndices.push(base + mesh.index.getX(i))
      for (const ring of polygon) for (let i = 1; i < ring.length; i++) shore.push(...coordinate(ring[i - 1], level + 0.003), ...coordinate(ring[i], level + 0.003))
      mesh.dispose()
    }
    const water = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3))
    water.setIndex(waterIndices); water.computeVertexNormals()
    return { outline: new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(outline, 3)), land, shadow, water, shore: new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(shore, 3)) }
  }, [geography, terrain, surface])
  useEffect(() => () => Object.values(geometry).forEach(g => g.dispose()), [geometry])
  return <group>
    <mesh geometry={geometry.land} receiveShadow={sunlight}><OrbitalSnowMaterial enabled={snowEnabled} altitude={snowline} /></mesh>
    {sunlight && <mesh geometry={geometry.shadow} castShadow><meshBasicMaterial colorWrite={false} depthWrite={false} /></mesh>}
    <mesh geometry={geometry.water} receiveShadow={sunlight}><meshPhongMaterial color="#123b56" specular="#355570" shininess={65} side={THREE.DoubleSide} /></mesh>
    <lineSegments geometry={geometry.shore}><lineBasicMaterial color="#65a5c4" transparent opacity={0.28} depthWrite={false} /></lineSegments>
    <lineSegments geometry={geometry.outline}><lineBasicMaterial color="#63899b" transparent opacity={0.2} depthWrite={false} /></lineSegments>
  </group>
}

const TRAIL_STEPS = 20
function Movement({ chunk, playback, surface, onStats }: { chunk: OrbitalChunk; surface: OrbitalSurface; playback: MutableRefObject<OrbitalPlayback>; onStats: (active: number, fps: number, time: number) => void }) {
  const color = useMemo(() => ORBITAL_COLORS.map(c => new THREE.Color(c)), [])
  const texture = useMemo(() => {
    const size = 32, pixels = new Uint8Array(size * size * 4)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1)
      pixels.set([255, 255, 255, Math.round(Math.max(0, 1 - radius) ** 2 * 255)], (y * size + x) * 4)
    }
    const result = new THREE.DataTexture(pixels, size, size)
    result.magFilter = THREE.LinearFilter; result.minFilter = THREE.LinearFilter; result.needsUpdate = true
    return result
  }, [])
  const buffers = useMemo(() => {
    const capacity = chunk.journeys.length
    const points = new THREE.BufferGeometry(), tails = new THREE.BufferGeometry()
    const trailCapacity = capacity * TRAIL_STEPS + chunk.journeys.reduce((total, journey) => total + journey.tunnelCount, 0)
    points.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage))
    points.setAttribute('color', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage))
    tails.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailCapacity * 6), 3).setUsage(THREE.DynamicDrawUsage))
    tails.setAttribute('color', new THREE.BufferAttribute(new Float32Array(trailCapacity * 6), 3).setUsage(THREE.DynamicDrawUsage))
    points.setDrawRange(0, 0); tails.setDrawRange(0, 0)
    return { points, tails }
  }, [chunk])
  const scratch = useMemo(() => new Float32Array(6), [])
  const surfaceIntervals = useMemo(() => new Float64Array((chunk.journeys.reduce((max, j) => Math.max(max, j.tunnelCount), 0) + 1) * 2), [chunk])
  const stats = useRef({ elapsed: 0, frames: 0 })
  const categoryOpacity = useRef(new Float32Array(playback.current.categories.map(enabled => enabled ? 1 : 0)))
  const lastVisibleTime = useRef(chunk.start)
  useEffect(() => () => { buffers.points.dispose(); buffers.tails.dispose() }, [buffers])
  useEffect(() => () => texture.dispose(), [texture])
  useFrame((_, delta) => {
    const p = playback.current
    // Stop at the block edge until the next block arrives; never animate missing data.
    if (p.playing && p.ready && !document.hidden) p.time = Math.min(p.time + Math.min(delta, 0.1) * p.speed, chunk.end)
    if (p.ready) lastVisibleTime.current = Math.min(p.time, 86399)
    const time = lastVisibleTime.current, positions = buffers.points.getAttribute('position') as THREE.BufferAttribute
    const colors = buffers.points.getAttribute('color') as THREE.BufferAttribute
    const trailPositions = buffers.tails.getAttribute('position') as THREE.BufferAttribute
    const trailColors = buffers.tails.getAttribute('color') as THREE.BufferAttribute
    let active = 0, visible = 0, vertices = 0
    for (let category = 0; category < categoryOpacity.current.length; category++) {
      const target = p.categories[category] ? 1 : 0
      categoryOpacity.current[category] += (target - categoryOpacity.current[category]) * (1 - Math.exp(-Math.min(delta, 0.1) * 12))
    }
    for (const train of chunk.journeys) {
      const modeOpacity = categoryOpacity.current[train.category]
      if (modeOpacity < 0.001) continue
      if (train.start > time || train.end < time - p.trail) continue
      const c = color[train.category]
      if (orbitalPosition(chunk.data, train, time, positions.array as Float32Array, active * 3)) {
        positions.setY(active, surface.height(positions.getX(active), positions.getZ(active)) + 0.035)
        const opacity = orbitalJourneyOpacity(train.start, train.end, time, p.speed) * modeOpacity * orbitalTunnelOpacity(chunk.data, train, time, p.speed)
        colors.setXYZ(active, c.r * opacity, c.g * opacity, c.b * opacity); active++
        if (p.categories[train.category]) visible++
      }
      if (p.trail <= 0) continue
      const tailEnd = Math.min(time, train.end), tailStart = Math.max(time - p.trail, train.start)
      if (tailEnd <= tailStart) continue
      for (let step = 1; step <= TRAIL_STEPS; step++) {
        const t = tailEnd - (tailEnd - tailStart) * step / TRAIL_STEPS
        const previousTime = tailEnd - (tailEnd - tailStart) * (step - 1) / TRAIL_STEPS
        const pieces = orbitalSurfaceIntervals(chunk.data, train, t, previousTime, surfaceIntervals)
        for (let piece = 0; piece < pieces; piece++) {
          const a = surfaceIntervals[piece * 2], b = surfaceIntervals[piece * 2 + 1]
          orbitalPosition(chunk.data, train, a, scratch, 0)
          orbitalPosition(chunk.data, train, b, scratch, 3)
          scratch[1] = surface.height(scratch[0], scratch[2]) + 0.035
          scratch[4] = surface.height(scratch[3], scratch[5]) + 0.035
          trailPositions.setXYZ(vertices, scratch[0], scratch[1], scratch[2])
          trailPositions.setXYZ(vertices + 1, scratch[3], scratch[4], scratch[5])
          const fadeA = Math.max(0, 1 - (time - a) / p.trail) * 0.55 * modeOpacity * orbitalJourneyOpacity(train.start, train.end, a, p.speed) * orbitalTunnelOpacity(chunk.data, train, a, p.speed)
          const fadeB = Math.max(0, 1 - (time - b) / p.trail) * 0.55 * modeOpacity * orbitalJourneyOpacity(train.start, train.end, b, p.speed) * orbitalTunnelOpacity(chunk.data, train, b, p.speed)
          trailColors.setXYZ(vertices, c.r * fadeA, c.g * fadeA, c.b * fadeA)
          trailColors.setXYZ(vertices + 1, c.r * fadeB, c.g * fadeB, c.b * fadeB)
          vertices += 2
        }
      }
    }
    for (const [attribute, count] of [[positions, active * 3], [colors, active * 3], [trailPositions, vertices * 3], [trailColors, vertices * 3]] as const) {
      attribute.clearUpdateRanges(); if (count) attribute.addUpdateRange(0, count); attribute.needsUpdate = true
    }
    buffers.points.setDrawRange(0, active); buffers.tails.setDrawRange(0, vertices)
    stats.current.elapsed += delta; stats.current.frames++
    if (stats.current.elapsed >= 0.25) {
      onStats(visible, Math.round(stats.current.frames / stats.current.elapsed), p.time)
      stats.current = { elapsed: 0, frames: 0 }
    }
  })
  return <group>
    <lineSegments geometry={buffers.tails} frustumCulled={false}><lineBasicMaterial vertexColors transparent opacity={0.65} blending={THREE.AdditiveBlending} depthWrite={false} /></lineSegments>
    <points geometry={buffers.points} frustumCulled={false}><pointsMaterial map={texture} vertexColors size={8} sizeAttenuation={false} transparent opacity={0.48} blending={THREE.AdditiveBlending} depthWrite={false} /></points>
    <points geometry={buffers.points} frustumCulled={false}><pointsMaterial map={texture} vertexColors size={2.6} sizeAttenuation={false} transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} /></points>
  </group>
}
export default function OrbitalScene({ geography, terrain, movementSource, playback, reset, onStats, sunlight, cityLabels, cameraAltitude, snowEnabled, snowline, formatAltitude, cloudField, cloudOpacity }: { cloudField?: CloudField; cloudOpacity: number; formatAltitude: (height: number) => string; cameraAltitude: RefObject<HTMLOutputElement | null>; snowEnabled: boolean; snowline: number; cityLabels: RefObject<HTMLDivElement | null>; sunlight: boolean; geography: OrbitalGeography; terrain: OrbitalTerrain; movementSource: () => OrbitalChunk | undefined; playback: MutableRefObject<OrbitalPlayback>; reset: number; onStats: (active: number, fps: number, time: number) => void }) {
  const chunk = movementSource()
  const surface = useMemo(() => createOrbitalSurface(terrain), [terrain])
  return <>
    <color attach="background" args={['#03060d']} />
    <Camera playback={playback} reset={reset} altitude={cameraAltitude} formatAltitude={formatAltitude} />
    <OrbitalCityLabels surface={surface} root={cityLabels} />
    <OrbitalLighting sunlight={sunlight} playback={playback} />
    <Geography geography={geography} terrain={terrain} surface={surface} sunlight={sunlight} snowEnabled={snowEnabled} snowline={snowline} />
    {cloudField && <OrbitalClouds field={cloudField} playback={playback} opacity={cloudOpacity} sunlight={sunlight} />}
    {chunk && <Movement key={chunk.start} chunk={chunk} playback={playback} surface={surface} onStats={onStats} />}
  </>
}
