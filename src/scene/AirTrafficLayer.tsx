import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  positionForAirTrack,
  type AirSnapshot,
} from '../domain/air.ts'
import {
  airportAirTrackIds,
  type StudyAirport,
} from '../domain/airport.ts'
import {
  projectAirPosition,
  type AirProjection,
} from './air-projection.ts'
import {
  airLabelBudget,
  airLabelScreenHeight,
  airLabelScreenWidth,
  compareAirLabelCandidates,
  MAX_AIR_LABELS,
} from './air-labels.ts'
import { stationLabelWorldHeight } from './station-labels.ts'
import type { TrainLabelMode } from './train-labels.ts'

const AIR_COLOR = new THREE.Color('#ff5edb')
const SELECTED_AIR_COLOR = new THREE.Color('#fff5ff')
const SUBDUED_AIR_COLOR = new THREE.Color('#160a1d')
const TRAIL_SECONDS = 180
const MAX_SAMPLE_GAP_SECONDS = 45

interface CurrentAircraft {
  readonly track: AirSnapshot['tracks'][number]
  readonly position: NonNullable<ReturnType<typeof positionForAirTrack>>
  readonly projected: readonly [number, number, number]
}

interface AirLabelTexture {
  readonly texture: THREE.CanvasTexture
  readonly aspect: number
}

function currentAircraft(
  snapshot: AirSnapshot,
  time: number,
  projection: AirProjection,
): readonly CurrentAircraft[] {
  return snapshot.tracks.flatMap((track) => {
    const position = positionForAirTrack(track, time)
    return position
      ? [{ track, position, projected: projectAirPosition(position, projection) }]
      : []
  })
}

function latestObservedSample(
  track: AirSnapshot['tracks'][number],
  time: number,
) {
  let low = 0
  let high = track.samples.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (track.samples[middle][0] <= time) low = middle
    else high = middle - 1
  }
  return track.samples[low]
}

function createAirLabelTexture(label: string): AirLabelTexture {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const font = '500 26px "DM Mono", ui-monospace, monospace'
  const horizontalPadding = 25
  const markerWidth = 18
  const height = 58
  if (!context) {
    canvas.width = 180
    canvas.height = height
  } else {
    context.font = font
    canvas.width = Math.ceil(
      context.measureText(label).width + horizontalPadding * 2 + markerWidth,
    )
    canvas.height = height
    context.clearRect(0, 0, canvas.width, canvas.height)

    context.fillStyle = 'rgba(8, 5, 22, 0.68)'
    context.strokeStyle = 'rgba(255, 94, 219, 0.32)'
    context.lineWidth = 1.5
    context.beginPath()
    context.roundRect(1, 1, canvas.width - 2, canvas.height - 2, 7)
    context.fill()
    context.stroke()

    context.save()
    context.translate(21, height / 2)
    context.rotate(Math.PI / 4)
    context.fillStyle = '#ff5edb'
    context.fillRect(-4, -4, 8, 8)
    context.restore()

    context.font = font
    context.textBaseline = 'middle'
    context.shadowColor = 'rgba(255, 94, 219, 0.55)'
    context.shadowBlur = 5
    context.fillStyle = '#f7dff5'
    context.fillText(label, horizontalPadding + markerWidth, height / 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return { texture, aspect: canvas.width / canvas.height }
}

function AirTrafficLabels({
  aircraftRef,
  mode,
  selectedTrackId,
  airportTrackIds,
}: {
  readonly aircraftRef: { readonly current: readonly CurrentAircraft[] }
  readonly mode: TrainLabelMode
  readonly selectedTrackId?: string
  readonly airportTrackIds?: ReadonlySet<string>
}) {
  const { camera, size } = useThree()
  const sprites = useRef<Array<THREE.Sprite | null>>([])
  const textures = useRef(new Map<string, AirLabelTexture>())
  const retainedTrackIds = useRef(new Set<string>())

  useEffect(
    () => () => {
      textures.current.forEach(({ texture }) => texture.dispose())
      textures.current.clear()
    },
    [],
  )

  useFrame(() => {
    sprites.current.forEach((sprite) => {
      if (sprite) sprite.visible = false
    })
    const labelBudget = airLabelBudget(
      camera.position.y,
      mode,
      Boolean(selectedTrackId),
    )
    if (!labelBudget) {
      retainedTrackIds.current.clear()
      return
    }

    const projected = new THREE.Vector3()
    const viewPosition = new THREE.Vector3()
    const candidates = aircraftRef.current.flatMap((item) => {
      const selected = item.track.id === selectedTrackId
      if (selectedTrackId && !selected) return []
      if (airportTrackIds && !airportTrackIds.has(item.track.id)) return []
      projected.set(...item.projected)
      viewPosition.copy(projected).applyMatrix4(camera.matrixWorldInverse)
      projected.project(camera)
      if (
        projected.z < -1 ||
        projected.z > 1 ||
        projected.x < -1.08 ||
        projected.x > 1.08 ||
        projected.y < -1.08 ||
        projected.y > 1.08
      ) {
        return []
      }
      return [{
        item,
        selected,
        retained: retainedTrackIds.current.has(item.track.id),
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
        depth: Math.max(0.01, -viewPosition.z),
      }]
    })

    candidates.sort(
      (first, second) =>
        Number(second.selected) - Number(first.selected) ||
        compareAirLabelCandidates(
          {
            id: first.item.track.id,
            callsign: first.item.track.callsign,
            retained: first.retained,
          },
          {
            id: second.item.track.id,
            callsign: second.item.track.callsign,
            retained: second.retained,
          },
        ),
    )

    const occupied: Array<{ left: number; right: number; top: number; bottom: number }> = []
    const nextRetainedTrackIds = new Set<string>()
    const visibleTextureKeys = new Set<string>()
    const verticalFieldOfView =
      camera instanceof THREE.PerspectiveCamera ? camera.fov : 44
    let visible = 0

    for (const candidate of candidates) {
      if (visible >= labelBudget || visible >= MAX_AIR_LABELS) break
      const label = candidate.item.track.callsign
      const screenHeight = airLabelScreenHeight(
        size.width,
        candidate.selected,
        camera.position.y,
      )
      const width = airLabelScreenWidth(label, screenHeight)
      const box = {
        left: candidate.x - width / 2,
        right: candidate.x + width / 2,
        top: candidate.y - screenHeight / 2,
        bottom: candidate.y + screenHeight / 2,
      }
      const overlaps = occupied.some(
        (other) =>
          box.left < other.right + 6 &&
          box.right > other.left - 6 &&
          box.top < other.bottom + 5 &&
          box.bottom > other.top - 5,
      )
      if (overlaps && !candidate.selected) continue

      const sprite = sprites.current[visible]
      if (!sprite) continue
      let textureEntry = textures.current.get(label)
      if (!textureEntry) {
        textureEntry = createAirLabelTexture(label)
        textures.current.set(label, textureEntry)
      } else {
        textures.current.delete(label)
        textures.current.set(label, textureEntry)
      }
      visibleTextureKeys.add(label)
      nextRetainedTrackIds.add(candidate.item.track.id)

      sprite.visible = true
      sprite.position.set(...candidate.item.projected)
      const worldHeight = stationLabelWorldHeight(
        candidate.depth,
        verticalFieldOfView,
        size.height,
        screenHeight,
      )
      sprite.scale.set(textureEntry.aspect * worldHeight, worldHeight, 1)
      const material = sprite.material as THREE.SpriteMaterial
      if (material.map !== textureEntry.texture) {
        material.map = textureEntry.texture
        material.needsUpdate = true
      }
      material.opacity = candidate.selected ? 0.96 : 0.62
      occupied.push(box)
      visible += 1
    }

    retainedTrackIds.current = nextRetainedTrackIds
    if (textures.current.size > 96) {
      for (const [key, entry] of textures.current) {
        if (visibleTextureKeys.has(key)) continue
        entry.texture.dispose()
        textures.current.delete(key)
        if (textures.current.size <= 96) break
      }
    }
  })

  return Array.from({ length: MAX_AIR_LABELS }, (_, index) => (
    <sprite
      key={index}
      ref={(sprite) => {
        sprites.current[index] = sprite
      }}
      visible={false}
      renderOrder={17}
    >
      <spriteMaterial
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  ))
}

function AirportFocusMarker({
  airport,
  projection,
}: {
  readonly airport: StudyAirport
  readonly projection: AirProjection
}) {
  const group = useRef<THREE.Group>(null)
  const position = useMemo(
    () =>
      projectAirPosition(
        {
          longitude: airport.longitude,
          latitude: airport.latitude,
          altitudeFeet: 0,
        },
        projection,
      ),
    [airport, projection],
  )

  useFrame(({ clock }) => {
    if (!group.current) return
    const pulse = 1 + (Math.sin(clock.elapsedTime * 2.4) + 1) * 0.18
    group.current.scale.setScalar(pulse)
  })

  return (
    <group ref={group} position={position} renderOrder={19}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.38, 48]} />
        <meshBasicMaterial
          color={AIR_COLOR}
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.65, 64]} />
        <meshBasicMaterial
          color={AIR_COLOR}
          transparent
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight color={AIR_COLOR} intensity={2.4} distance={3.2} />
    </group>
  )
}

export function AirTrafficLayer({
  snapshot,
  time,
  isPlaying,
  playbackRate,
  projection,
  selectedTrackId,
  selectedAirport,
  onSelectTrack,
  labelMode,
  subdued = false,
}: {
  readonly snapshot: AirSnapshot
  readonly time: number
  readonly isPlaying: boolean
  readonly playbackRate: number
  readonly projection: AirProjection
  readonly selectedTrackId?: string
  readonly selectedAirport?: StudyAirport
  readonly onSelectTrack?: (trackId: string) => void
  readonly labelMode: TrainLabelMode
  readonly subdued?: boolean
}) {
  const localTime = useRef(time)
  const aircraftRef = useRef<readonly CurrentAircraft[]>(
    currentAircraft(snapshot, time, projection),
  )
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const wingRef = useRef<THREE.InstancedMesh>(null)
  const hitRef = useRef<THREE.InstancedMesh>(null)
  const selectedLightRef = useRef<THREE.PointLight>(null)
  const airportTrackIds = useMemo(
    () =>
      selectedAirport
        ? airportAirTrackIds(snapshot.tracks, selectedAirport)
        : undefined,
    [selectedAirport, snapshot.tracks],
  )
  const trailHeadGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(snapshot.tracks.length * 6), 3),
    )
    geometry.setDrawRange(0, 0)
    return geometry
  }, [snapshot.tracks.length])

  useEffect(() => () => trailHeadGeometry.dispose(), [trailHeadGeometry])

  useEffect(() => {
    localTime.current = time
  }, [time])

  useFrame((_, delta) => {
    if (isPlaying) {
      localTime.current += delta * playbackRate
      if (localTime.current > snapshot.metadata.windowEnd) {
        localTime.current = snapshot.metadata.windowStart
      }
    }
    const aircraft = currentAircraft(snapshot, localTime.current, projection)
    aircraftRef.current = aircraft
    const body = bodyRef.current
    const wing = wingRef.current
    const hit = hitRef.current
    if (!body || !wing || !hit) return

    const transform = new THREE.Object3D()
    const trailHeadPositions = trailHeadGeometry.getAttribute('position')
      .array as Float32Array
    let trailHeadCount = 0
    for (const [index, item] of aircraft.entries()) {
      const isSelected = item.track.id === selectedTrackId
      const servesSelectedAirport =
        !airportTrackIds || airportTrackIds.has(item.track.id)
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
      body.setColorAt(
        index,
        isSelected
          ? SELECTED_AIR_COLOR
          : servesSelectedAirport
            ? AIR_COLOR
            : SUBDUED_AIR_COLOR,
      )

      transform.scale.set(
        isSelected ? 1.6 : 1,
        isSelected ? 1.2 : 1,
        1,
      )
      transform.updateMatrix()
      wing.setMatrixAt(index, transform.matrix)
      wing.setColorAt(
        index,
        servesSelectedAirport ? AIR_COLOR : SUBDUED_AIR_COLOR,
      )

      transform.scale.setScalar(1)
      transform.updateMatrix()
      hit.setMatrixAt(index, transform.matrix)

      const latestSample = latestObservedSample(item.track, localTime.current)
      if (
        latestSample &&
        localTime.current > latestSample[0] &&
        localTime.current - latestSample[0] <= MAX_SAMPLE_GAP_SECONDS
      ) {
        const from = projectAirPosition(
          {
            longitude: latestSample[1],
            latitude: latestSample[2],
            altitudeFeet: latestSample[3],
          },
          projection,
        )
        const offset = trailHeadCount * 6
        trailHeadPositions.set(from, offset)
        trailHeadPositions.set(item.projected, offset + 3)
        trailHeadCount += 1
      }
    }
    for (const mesh of [body, wing, hit]) {
      mesh.count = aircraft.length
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    trailHeadGeometry.getAttribute('position').needsUpdate = true
    trailHeadGeometry.setDrawRange(0, trailHeadCount * 2)
    const selectedAircraft = aircraft.find(
      ({ track }) => track.id === selectedTrackId,
    )
    if (selectedLightRef.current) {
      selectedLightRef.current.visible = Boolean(selectedAircraft)
      if (selectedAircraft) {
        selectedLightRef.current.position.set(...selectedAircraft.projected)
      }
    }
  })
  const trailGeometry = useMemo(() => {
    const positions: number[] = []
    const colors: number[] = []
    for (const track of snapshot.tracks) {
      const servesSelectedAirport =
        !airportTrackIds || airportTrackIds.has(track.id)
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
        const emphasis = servesSelectedAirport ? 0.78 : 0.025
        const fromColor = AIR_COLOR.clone().multiplyScalar(fromFade * emphasis)
        const toColor = AIR_COLOR.clone().multiplyScalar(toFade * emphasis)
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
  }, [airportTrackIds, projection, snapshot.tracks, time])
  useEffect(() => () => trailGeometry.dispose(), [trailGeometry])

  return (
    <>
      <group
      onPointerDown={(event) => {
        if (event.instanceId === undefined) return
        event.stopPropagation()
        const track = aircraftRef.current[event.instanceId]?.track
        if (track) onSelectTrack?.(track.id)
      }}
    >
      <lineSegments geometry={trailGeometry} renderOrder={15}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={subdued ? 0.08 : 0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments
        geometry={trailHeadGeometry}
        renderOrder={15}
        frustumCulled={false}
      >
        <lineBasicMaterial
          color={AIR_COLOR}
          transparent
          opacity={subdued ? 0.08 : 0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, snapshot.tracks.length]}
        renderOrder={18}
        frustumCulled={false}
      >
        <boxGeometry args={[0.055, 0.035, 0.64]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={subdued ? 0.08 : 0.52}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={wingRef}
        args={[undefined, undefined, snapshot.tracks.length]}
        renderOrder={18}
        frustumCulled={false}
      >
        <boxGeometry args={[0.36, 0.025, 0.035]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={subdued ? 0.06 : 0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={hitRef}
        args={[undefined, undefined, snapshot.tracks.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.62, 6, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <pointLight
        ref={selectedLightRef}
        visible={false}
        color="#ff5edb"
        intensity={4}
        distance={4}
      />
      </group>
      <AirTrafficLabels
        aircraftRef={aircraftRef}
        mode={subdued ? 'off' : labelMode}
        selectedTrackId={selectedTrackId}
        airportTrackIds={airportTrackIds}
      />
      {selectedAirport && (
        <AirportFocusMarker airport={selectedAirport} projection={projection} />
      )}
    </>
  )
}
