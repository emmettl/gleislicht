import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  positionForAirTrack,
  type AirSnapshot,
} from '../domain/air.ts'
import {
  projectAirPosition,
  type AirProjection,
} from './air-projection.ts'

const AIR_COLOR = new THREE.Color('#ff5edb')
const SELECTED_AIR_COLOR = new THREE.Color('#fff5ff')
const TRAIL_SECONDS = 180
const MAX_SAMPLE_GAP_SECONDS = 45

function currentAircraft(
  snapshot: AirSnapshot,
  time: number,
  projection: AirProjection,
) {
  return snapshot.tracks.flatMap((track) => {
    const position = positionForAirTrack(track, time)
    return position
      ? [{ track, position, projected: projectAirPosition(position, projection) }]
      : []
  })
}

export function AirTrafficLayer({
  snapshot,
  time,
  projection,
  selectedTrackId,
  onSelectTrack,
}: {
  readonly snapshot: AirSnapshot
  readonly time: number
  readonly projection: AirProjection
  readonly selectedTrackId?: string
  readonly onSelectTrack?: (trackId: string) => void
}) {
  const aircraft = useMemo(
    () => currentAircraft(snapshot, time, projection),
    [projection, snapshot, time],
  )
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const wingRef = useRef<THREE.InstancedMesh>(null)
  const hitRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const body = bodyRef.current
    const wing = wingRef.current
    const hit = hitRef.current
    if (!body || !wing || !hit) return

    const transform = new THREE.Object3D()
    for (const [index, item] of aircraft.entries()) {
      const isSelected = item.track.id === selectedTrackId
      transform.position.set(...item.projected)
      transform.rotation.set(
        0,
        THREE.MathUtils.degToRad(item.position.headingDegrees),
        0,
      )

      transform.scale.set(
        isSelected ? 1.8 : 1,
        isSelected ? 1.2 : 1,
        isSelected ? 1.4 : 1,
      )
      transform.updateMatrix()
      body.setMatrixAt(index, transform.matrix)
      body.setColorAt(index, isSelected ? SELECTED_AIR_COLOR : AIR_COLOR)

      transform.scale.set(
        isSelected ? 1.6 : 1,
        isSelected ? 1.2 : 1,
        1,
      )
      transform.updateMatrix()
      wing.setMatrixAt(index, transform.matrix)
      wing.setColorAt(index, AIR_COLOR)

      transform.scale.setScalar(1)
      transform.updateMatrix()
      hit.setMatrixAt(index, transform.matrix)
    }
    for (const mesh of [body, wing, hit]) {
      mesh.count = aircraft.length
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [aircraft, selectedTrackId])
  const trailGeometry = useMemo(() => {
    const positions: number[] = []
    const colors: number[] = []
    for (const track of snapshot.tracks) {
      const samples = track.samples.filter(
        (sample) => sample[0] <= time && sample[0] >= time - TRAIL_SECONDS,
      )
      for (let index = 1; index < samples.length; index += 1) {
        const from = samples[index - 1]
        const to = samples[index]
        if (to[0] - from[0] > MAX_SAMPLE_GAP_SECONDS) continue
        const fromPoint = projectAirPosition(
          { longitude: from[1], latitude: from[2], altitudeFeet: from[3] },
          projection,
        )
        const toPoint = projectAirPosition(
          { longitude: to[1], latitude: to[2], altitudeFeet: to[3] },
          projection,
        )
        positions.push(...fromPoint, ...toPoint)
        const fromFade = Math.max(0.08, 1 - (time - from[0]) / TRAIL_SECONDS)
        const toFade = Math.max(0.08, 1 - (time - to[0]) / TRAIL_SECONDS)
        const fromColor = AIR_COLOR.clone().multiplyScalar(fromFade * 0.58)
        const toColor = AIR_COLOR.clone().multiplyScalar(toFade * 0.58)
        colors.push(
          fromColor.r,
          fromColor.g,
          fromColor.b,
          toColor.r,
          toColor.g,
          toColor.b,
        )
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    )
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geometry
  }, [projection, snapshot.tracks, time])
  useEffect(() => () => trailGeometry.dispose(), [trailGeometry])

  const selectedAircraft = aircraft.find(
    ({ track }) => track.id === selectedTrackId,
  )

  return (
    <group
      onPointerDown={(event) => {
        if (event.instanceId === undefined) return
        event.stopPropagation()
        const track = aircraft[event.instanceId]?.track
        if (track) onSelectTrack?.(track.id)
      }}
    >
      <lineSegments geometry={trailGeometry} renderOrder={22}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, snapshot.tracks.length]}
        renderOrder={24}
      >
        <boxGeometry args={[0.055, 0.035, 0.64]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.52}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={wingRef}
        args={[undefined, undefined, snapshot.tracks.length]}
        renderOrder={24}
      >
        <boxGeometry args={[0.36, 0.025, 0.035]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={hitRef}
        args={[undefined, undefined, snapshot.tracks.length]}
      >
        <sphereGeometry args={[0.62, 6, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      {selectedAircraft && (
        <pointLight
          position={selectedAircraft.projected}
          color="#ff5edb"
          intensity={4}
          distance={4}
        />
      )}
    </group>
  )
}
