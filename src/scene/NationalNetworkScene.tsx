import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type {
  BoundaryCoordinate,
  SwissBoundary,
} from '../domain/boundary.ts'
import {
  positionForTrain,
  SERVICE_COLORS,
  type NetworkSnapshot,
  type NetworkTrain,
  type ServiceCategory,
  type StationIndexEntry,
} from '../domain/network.ts'
import {
  MAX_STATION_LABELS,
  rankStationsForLabels,
  stationLabelBudget,
} from './station-labels.ts'
import {
  categoryIsVisibleInAutoMode,
  MAX_TRAIN_LABELS,
  trainLabelBudget,
  trainLabelPriority,
  type TrainLabelMode,
} from './train-labels.ts'
import { applyMapZoom } from './map-camera.ts'

export type MapCameraAction = 'zoom-in' | 'zoom-out' | 'reset'

export interface MapCameraCommand {
  readonly id: number
  readonly action: MapCameraAction
}

interface NationalNetworkSceneProps {
  readonly boundary?: SwissBoundary
  readonly snapshot: NetworkSnapshot
  readonly isPlaying: boolean
  readonly time: number
  readonly selectedTrain?: NetworkTrain
  readonly onTime: (time: number) => void
  readonly cameraCommand?: MapCameraCommand
  readonly playbackRate: number
  readonly selectedCategory?: ServiceCategory
  readonly selectedStation?: StationIndexEntry
  readonly stations: readonly StationIndexEntry[]
  readonly trainLabelMode: TrainLabelMode
}

type ProjectedStop = readonly [x: number, y: number, z: number]

interface NetworkProjection {
  readonly centreLongitude: number
  readonly centreLatitude: number
  readonly longitudeScale: number
  readonly scale: number
}

function createNetworkProjection(snapshot: NetworkSnapshot): NetworkProjection {
  const { bounds } = snapshot
  const centreLongitude = (bounds.minLongitude + bounds.maxLongitude) / 2
  const centreLatitude = (bounds.minLatitude + bounds.maxLatitude) / 2
  const longitudeScale = Math.cos((centreLatitude * Math.PI) / 180)
  const projectedWidth =
    (bounds.maxLongitude - bounds.minLongitude) * longitudeScale
  return {
    centreLongitude,
    centreLatitude,
    longitudeScale,
    scale: 51 / projectedWidth,
  }
}

function projectCoordinate(
  [longitude, latitude]: BoundaryCoordinate,
  projection: NetworkProjection,
  height = 0,
): ProjectedStop {
  return [
    (longitude - projection.centreLongitude) *
      projection.longitudeScale *
      projection.scale,
    height,
    -(latitude - projection.centreLatitude) * projection.scale,
  ]
}

function projectStops(snapshot: NetworkSnapshot): readonly ProjectedStop[] {
  const projection = createNetworkProjection(snapshot)
  return snapshot.stops.map(([longitude, latitude]) =>
    projectCoordinate([longitude, latitude], projection),
  )
}

function projectedTrainPosition(
  train: NetworkTrain,
  time: number,
  projectedStops: readonly ProjectedStop[],
): ProjectedStop | undefined {
  const position = positionForTrain(train, time)
  if (!position) return undefined
  const from = projectedStops[position.fromStop]
  const to = projectedStops[position.toStop]
  if (!from || !to) return undefined
  return [
    THREE.MathUtils.lerp(from[0], to[0], position.progress),
    0.2,
    THREE.MathUtils.lerp(from[2], to[2], position.progress),
  ]
}

function NationalGround() {
  return (
    <group position={[0, -0.11, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[64, 36, 64, 36]} />
        <meshBasicMaterial color="#090b1f" transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[64, 36, 64, 36]} />
        <meshBasicMaterial color="#424b98" transparent opacity={0.1} wireframe />
      </mesh>
    </group>
  )
}

function CountryBorder({
  boundary,
  snapshot,
  subdued,
}: {
  readonly boundary: SwissBoundary
  readonly snapshot: NetworkSnapshot
  readonly subdued: boolean
}) {
  const tubes = useMemo(() => {
    const projection = createNetworkProjection(snapshot)
    return boundary.rings.flatMap((ring, index) => {
      const coordinates =
        ring.length > 1 &&
        ring[0][0] === ring[ring.length - 1][0] &&
        ring[0][1] === ring[ring.length - 1][1]
          ? ring.slice(0, -1)
          : ring
      if (coordinates.length < 4) return []
      const points = coordinates.map((coordinate) => {
        const [x, y, z] = projectCoordinate(coordinate, projection, 0.075)
        return new THREE.Vector3(x, y, z)
      })
      const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5)
      const segments = THREE.MathUtils.clamp(points.length * 2, 24, 920)
      return [{
        id: `${index}:${coordinates.length}`,
        glow: new THREE.TubeGeometry(curve, segments, 0.13, 5, true),
        core: new THREE.TubeGeometry(curve, segments, 0.026, 5, true),
      }]
    })
  }, [boundary.rings, snapshot])

  useEffect(
    () => () => {
      tubes.forEach(({ glow, core }) => {
        glow.dispose()
        core.dispose()
      })
    },
    [tubes],
  )

  return (
    <group>
      {tubes.map(({ id, glow, core }) => (
        <group key={id}>
          <mesh geometry={glow}>
            <meshBasicMaterial
              color="#56e9ff"
              transparent
              opacity={subdued ? 0.035 : 0.12}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              fog={false}
            />
          </mesh>
          <mesh geometry={core} renderOrder={2}>
            <meshBasicMaterial
              color="#b9fbff"
              transparent
              opacity={subdued ? 0.28 : 0.84}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              fog={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function RailGraph({
  snapshot,
  projectedStops,
  subdued,
}: {
  readonly snapshot: NetworkSnapshot
  readonly projectedStops: readonly ProjectedStop[]
  readonly subdued: boolean
}) {
  const railGeometry = useMemo(() => {
    const positions = new Float32Array(snapshot.edges.length * 6)
    let writeIndex = 0
    for (const [fromIndex, toIndex] of snapshot.edges) {
      const from = projectedStops[fromIndex]
      const to = projectedStops[toIndex]
      if (!from || !to) continue
      positions.set(from, writeIndex)
      positions.set(to, writeIndex + 3)
      writeIndex += 6
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setDrawRange(0, writeIndex / 3)
    return geometry
  }, [projectedStops, snapshot.edges])

  const stationGeometry = useMemo(() => {
    const positions = new Float32Array(projectedStops.length * 3)
    projectedStops.forEach((stop, index) => positions.set(stop, index * 3))
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [projectedStops])

  return (
    <>
      <lineSegments geometry={railGeometry}>
        <lineBasicMaterial
          color="#7296bb"
          transparent
          opacity={subdued ? 0.07 : 0.25}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <points geometry={stationGeometry} position={[0, 0.035, 0]}>
        <pointsMaterial
          color="#a18cff"
          size={0.065}
          transparent
          opacity={subdued ? 0.12 : 0.4}
          sizeAttenuation
        />
      </points>
    </>
  )
}

function trainLightTexture(kind: 'halo' | 'orb' | 'spark'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(43, 39, 0, 48, 48, 46)
    if (kind === 'halo') {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
      gradient.addColorStop(0.12, 'rgba(255, 255, 255, 0.72)')
      gradient.addColorStop(0.34, 'rgba(255, 255, 255, 0.3)')
      gradient.addColorStop(0.72, 'rgba(255, 255, 255, 0.07)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    } else if (kind === 'orb') {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.18, 'rgba(255, 255, 255, 0.98)')
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.78)')
      gradient.addColorStop(0.76, 'rgba(255, 255, 255, 0.3)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    } else {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.32, 'rgba(255, 255, 255, 0.96)')
      gradient.addColorStop(0.68, 'rgba(255, 255, 255, 0.18)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    }
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

function SelectedRoute({
  train,
  projectedStops,
}: {
  readonly train: NetworkTrain
  readonly projectedStops: readonly ProjectedStop[]
}) {
  const line = useMemo(() => {
    const points = train.stops
      .map(([stopIndex]) => projectedStops[stopIndex])
      .filter((point): point is ProjectedStop => Boolean(point))
      .map(([x, , z]) => new THREE.Vector3(x, 0.12, z))
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: SERVICE_COLORS[train.category],
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    })
    return new THREE.Line(geometry, material)
  }, [projectedStops, train])

  useEffect(
    () => () => {
      line.geometry.dispose()
      ;(line.material as THREE.Material).dispose()
    },
    [line],
  )

  return <primitive object={line} />
}

function stationCentre(
  station: StationIndexEntry,
  projectedStops: readonly ProjectedStop[],
): THREE.Vector3 {
  const centre = new THREE.Vector3()
  let count = 0
  station.stopIndexes.forEach((stopIndex) => {
    const stop = projectedStops[stopIndex]
    if (!stop) return
    centre.x += stop[0]
    centre.z += stop[2]
    count += 1
  })
  if (count) centre.multiplyScalar(1 / count)
  return centre
}

interface StationLabelDatum {
  readonly station: StationIndexEntry
  readonly position: THREE.Vector3
  readonly texture: THREE.CanvasTexture
  readonly aspect: number
  readonly rank: number
  readonly emphasised: boolean
}

function stationLabelTexture(name: string): {
  texture: THREE.CanvasTexture
  aspect: number
} {
  const canvas = document.createElement('canvas')
  const measuringContext = canvas.getContext('2d')
  const font = '500 30px "DM Mono", monospace'
  measuringContext?.save()
  if (measuringContext) measuringContext.font = font
  const measuredWidth = measuringContext?.measureText(name).width ?? name.length * 19
  measuringContext?.restore()
  canvas.width = Math.ceil(THREE.MathUtils.clamp(measuredWidth + 86, 220, 760))
  canvas.height = 92

  const context = canvas.getContext('2d')
  if (context) {
    context.font = font
    context.textBaseline = 'middle'
    context.shadowColor = 'rgba(5, 4, 16, 0.95)'
    context.shadowBlur = 10
    context.lineWidth = 7
    context.strokeStyle = 'rgba(5, 4, 16, 0.9)'
    context.strokeText(name, 62, 46)
    context.fillStyle = '#f8f7ff'
    context.fillText(name, 62, 46)
    context.beginPath()
    context.arc(31, 46, 6, 0, Math.PI * 2)
    context.fillStyle = '#8dfaff'
    context.shadowColor = '#8dfaff'
    context.shadowBlur = 18
    context.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return { texture, aspect: canvas.width / canvas.height }
}

function StationLabels({
  stations,
  snapshot,
  projectedStops,
  selectedStation,
  selectedTrain,
}: {
  readonly stations: readonly StationIndexEntry[]
  readonly snapshot: NetworkSnapshot
  readonly projectedStops: readonly ProjectedStop[]
  readonly selectedStation?: StationIndexEntry
  readonly selectedTrain?: NetworkTrain
}) {
  const { camera, size } = useThree()
  const sprites = useRef<Array<THREE.Sprite | null>>([])
  const routeStationNames = useMemo(() => {
    if (!selectedTrain) return new Set<string>()
    return new Set(
      selectedTrain.stops
        .map(([stopIndex]) => snapshot.stops[stopIndex]?.[2])
        .filter((name): name is string => Boolean(name)),
    )
  }, [selectedTrain, snapshot.stops])
  const labels = useMemo(() => {
    const ranked = rankStationsForLabels(stations)
    const stationByName = new Map(ranked.map((station) => [station.name, station]))
    const ordered: StationIndexEntry[] = []
    const usedNames = new Set<string>()
    const add = (station: StationIndexEntry | undefined) => {
      if (!station || usedNames.has(station.name)) return
      usedNames.add(station.name)
      ordered.push(station)
    }

    add(selectedStation)
    routeStationNames.forEach((name) => add(stationByName.get(name)))
    ranked.slice(0, MAX_STATION_LABELS).forEach(add)

    return ordered.map((station) => {
      const { texture, aspect } = stationLabelTexture(station.name)
      const centre = stationCentre(station, projectedStops)
      return {
        station,
        position: new THREE.Vector3(centre.x, 0.48, centre.z),
        texture,
        aspect,
        rank: ranked.indexOf(station),
        emphasised:
          station.name === selectedStation?.name || routeStationNames.has(station.name),
      } satisfies StationLabelDatum
    })
  }, [projectedStops, routeStationNames, selectedStation, stations])

  useEffect(
    () => () => {
      labels.forEach(({ texture }) => texture.dispose())
    },
    [labels],
  )

  useFrame(() => {
    const budget = stationLabelBudget(camera.position.y)
    const projected = new THREE.Vector3()
    const candidates: Array<{
      index: number
      x: number
      y: number
      distance: number
      priority: number
    }> = []

    labels.forEach((label, index) => {
      const sprite = sprites.current[index]
      if (!sprite) return
      sprite.visible = false
      if (selectedTrain && !label.emphasised) return
      if (!label.emphasised && (label.rank < 0 || label.rank >= budget)) return

      projected.copy(label.position).project(camera)
      if (
        projected.z < -1 ||
        projected.z > 1 ||
        projected.x < -1.08 ||
        projected.x > 1.08 ||
        projected.y < -1.08 ||
        projected.y > 1.08
      ) {
        return
      }
      candidates.push({
        index,
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
        distance: camera.position.distanceTo(label.position),
        priority:
          label.station.name === selectedStation?.name ? 0 : label.emphasised ? 1 : 2,
      })
    })

    candidates.sort(
      (first, second) =>
        first.priority - second.priority || first.distance - second.distance,
    )
    const occupied: Array<{ left: number; right: number; top: number; bottom: number }> = []
    const worldHeight = 0.7 * THREE.MathUtils.clamp(camera.position.y / 37, 0.48, 1)

    for (const candidate of candidates) {
      const label = labels[candidate.index]
      const width = THREE.MathUtils.clamp(label.station.name.length * 7 + 24, 62, 190)
      const box = {
        left: candidate.x - width / 2,
        right: candidate.x + width / 2,
        top: candidate.y - 11,
        bottom: candidate.y + 11,
      }
      const overlaps = occupied.some(
        (other) =>
          box.left < other.right + 5 &&
          box.right > other.left - 5 &&
          box.top < other.bottom + 4 &&
          box.bottom > other.top - 4,
      )
      if (overlaps) continue

      const sprite = sprites.current[candidate.index]
      if (!sprite) continue
      sprite.visible = true
      sprite.scale.set(label.aspect * worldHeight, worldHeight, 1)
      ;(sprite.material as THREE.SpriteMaterial).opacity = label.emphasised ? 1 : 0.78
      occupied.push(box)
    }
  })

  return (
    <>
      {labels.map((label, index) => (
        <sprite
          key={label.station.name}
          ref={(sprite) => {
            sprites.current[index] = sprite
          }}
          position={label.position}
          renderOrder={10}
        >
          <spriteMaterial
            map={label.texture}
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </>
  )
}

interface TrainLabelTexture {
  readonly texture: THREE.CanvasTexture
  readonly aspect: number
}

function createTrainLabelTexture(label: string, color: string): TrainLabelTexture {
  const canvas = document.createElement('canvas')
  const measuringContext = canvas.getContext('2d')
  const font = '500 27px "DM Mono", monospace'
  if (measuringContext) measuringContext.font = font
  const measuredWidth = measuringContext?.measureText(label).width ?? label.length * 17
  canvas.width = Math.ceil(THREE.MathUtils.clamp(measuredWidth + 88, 190, 720))
  canvas.height = 74

  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = 'rgba(5, 4, 16, 0.82)'
    context.beginPath()
    context.roundRect(5, 6, canvas.width - 10, canvas.height - 12, 10)
    context.fill()
    context.strokeStyle = 'rgba(193, 204, 255, 0.35)'
    context.lineWidth = 2
    context.stroke()

    context.beginPath()
    context.arc(31, 37, 6, 0, Math.PI * 2)
    context.fillStyle = color
    context.shadowColor = color
    context.shadowBlur = 15
    context.fill()

    context.font = font
    context.textBaseline = 'middle'
    context.shadowColor = 'rgba(5, 4, 16, 0.95)'
    context.shadowBlur = 7
    context.fillStyle = '#f8f7ff'
    context.fillText(label, 56, 38)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return { texture, aspect: canvas.width / canvas.height }
}

function trainLabelText(train: NetworkTrain, selected: boolean): string {
  const identity = train.shortName
    ? `${train.route} · ${train.shortName}`
    : train.route
  return selected ? `${identity} → ${train.headsign}` : identity
}

function TrainLabels({
  snapshot,
  projectedStops,
  selectedTrain,
  selectedStation,
  selectedCategory,
  trainLabelMode,
  isPlaying,
  time,
  playbackRate,
}: NationalNetworkSceneProps & {
  readonly projectedStops: readonly ProjectedStop[]
}) {
  const { camera, size } = useThree()
  const sprites = useRef<Array<THREE.Sprite | null>>([])
  const textures = useRef(new Map<string, TrainLabelTexture>())
  const localTime = useRef(time)
  const selectedStationTrainIds = useMemo(
    () => new Set(selectedStation?.trainIds ?? []),
    [selectedStation],
  )

  useEffect(() => {
    localTime.current = time
  }, [time])

  useEffect(
    () => () => {
      textures.current.forEach(({ texture }) => texture.dispose())
      textures.current.clear()
    },
    [],
  )

  useFrame((_, delta) => {
    if (isPlaying) {
      localTime.current += delta * playbackRate
      if (localTime.current > snapshot.metadata.windowEnd) {
        localTime.current = snapshot.metadata.windowStart
      }
    }

    sprites.current.forEach((sprite) => {
      if (sprite) sprite.visible = false
    })
    const labelBudget = selectedTrain
      ? trainLabelMode === 'off'
        ? 0
        : 1
      : trainLabelBudget(camera.position.y, trainLabelMode)
    if (!labelBudget) return

    const projected = new THREE.Vector3()
    const candidates: Array<{
      train: NetworkTrain
      position: ProjectedStop
      x: number
      y: number
      distance: number
      selected: boolean
    }> = []

    for (const train of snapshot.trains) {
      const selected = train.id === selectedTrain?.id
      if (selectedTrain && !selected) continue
      if (!selected && selectedStation && !selectedStationTrainIds.has(train.id)) continue
      if (!selected && selectedCategory && train.category !== selectedCategory) continue
      if (
        !selected &&
        !selectedCategory &&
        trainLabelMode === 'auto' &&
        !categoryIsVisibleInAutoMode(train.category, camera.position.y)
      ) {
        continue
      }

      const position = projectedTrainPosition(train, localTime.current, projectedStops)
      if (!position) continue
      projected.set(position[0], 0.76, position[2]).project(camera)
      if (
        projected.z < -1 ||
        projected.z > 1 ||
        projected.x < -1.08 ||
        projected.x > 1.08 ||
        projected.y < -1.08 ||
        projected.y > 1.08
      ) {
        continue
      }
      candidates.push({
        train,
        position,
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
        distance: camera.position.distanceTo(projected.set(position[0], 0.76, position[2])),
        selected,
      })
    }

    candidates.sort(
      (first, second) =>
        Number(second.selected) - Number(first.selected) ||
        trainLabelPriority(first.train.category) -
          trainLabelPriority(second.train.category) ||
        first.distance - second.distance,
    )

    const occupied: Array<{ left: number; right: number; top: number; bottom: number }> = []
    const visibleTextureKeys = new Set<string>()
    const worldHeight = 0.62 * THREE.MathUtils.clamp(camera.position.y / 37, 0.5, 1)
    let visible = 0

    for (const candidate of candidates) {
      if (visible >= labelBudget || visible >= MAX_TRAIN_LABELS) break
      const text = trainLabelText(candidate.train, candidate.selected)
      const width = THREE.MathUtils.clamp(text.length * 6.4 + 28, 68, 210)
      const box = {
        left: candidate.x - width / 2,
        right: candidate.x + width / 2,
        top: candidate.y - 12,
        bottom: candidate.y + 12,
      }
      const overlaps = occupied.some(
        (other) =>
          box.left < other.right + 5 &&
          box.right > other.left - 5 &&
          box.top < other.bottom + 4 &&
          box.bottom > other.top - 4,
      )
      if (overlaps && !candidate.selected) continue

      const sprite = sprites.current[visible]
      if (!sprite) continue
      const textureKey = `${candidate.train.category}:${text}`
      let textureEntry = textures.current.get(textureKey)
      if (!textureEntry) {
        textureEntry = createTrainLabelTexture(
          text,
          SERVICE_COLORS[candidate.train.category],
        )
        textures.current.set(textureKey, textureEntry)
      } else {
        textures.current.delete(textureKey)
        textures.current.set(textureKey, textureEntry)
      }
      visibleTextureKeys.add(textureKey)

      sprite.visible = true
      sprite.position.set(candidate.position[0], 0.76, candidate.position[2])
      sprite.scale.set(textureEntry.aspect * worldHeight, worldHeight, 1)
      const material = sprite.material as THREE.SpriteMaterial
      if (material.map !== textureEntry.texture) {
        material.map = textureEntry.texture
        material.needsUpdate = true
      }
      material.opacity = candidate.selected ? 1 : 0.9
      occupied.push(box)
      visible += 1
    }

    if (textures.current.size > 180) {
      for (const [key, entry] of textures.current) {
        if (visibleTextureKeys.has(key)) continue
        entry.texture.dispose()
        textures.current.delete(key)
        if (textures.current.size <= 180) break
      }
    }
  })

  return (
    <>
      {Array.from({ length: MAX_TRAIN_LABELS }, (_, index) => (
        <sprite
          key={index}
          ref={(sprite) => {
            sprites.current[index] = sprite
          }}
          visible={false}
          renderOrder={12}
        >
          <spriteMaterial
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </>
  )
}

function SelectedStationRoutes({
  station,
  snapshot,
  projectedStops,
  selectedCategory,
}: {
  readonly station: StationIndexEntry
  readonly snapshot: NetworkSnapshot
  readonly projectedStops: readonly ProjectedStop[]
  readonly selectedCategory?: ServiceCategory
}) {
  const lines = useMemo(() => {
    const trainIds = new Set(station.trainIds)
    const edgesByCategory = new Map<ServiceCategory, Map<string, number[]>>()
    for (const train of snapshot.trains) {
      if (!trainIds.has(train.id)) continue
      if (selectedCategory && train.category !== selectedCategory) continue
      const categoryEdges = edgesByCategory.get(train.category) ?? new Map()
      for (let index = 1; index < train.stops.length; index += 1) {
        const firstIndex = train.stops[index - 1][0]
        const secondIndex = train.stops[index][0]
        const key =
          firstIndex < secondIndex
            ? `${firstIndex}:${secondIndex}`
            : `${secondIndex}:${firstIndex}`
        if (categoryEdges.has(key)) continue
        const first = projectedStops[firstIndex]
        const second = projectedStops[secondIndex]
        if (!first || !second) continue
        categoryEdges.set(key, [
          first[0],
          0.14,
          first[2],
          second[0],
          0.14,
          second[2],
        ])
      }
      edgesByCategory.set(train.category, categoryEdges)
    }

    return [...edgesByCategory.entries()].map(([category, edges]) => {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([...edges.values()].flat(), 3),
      )
      return { category, geometry }
    })
  }, [projectedStops, selectedCategory, snapshot.trains, station.trainIds])

  useEffect(
    () => () => lines.forEach(({ geometry }) => geometry.dispose()),
    [lines],
  )

  const centre = useMemo(
    () => stationCentre(station, projectedStops),
    [projectedStops, station],
  )

  return (
    <>
      {lines.map(({ category, geometry }) => (
        <lineSegments key={category} geometry={geometry}>
          <lineBasicMaterial
            color={SERVICE_COLORS[category]}
            transparent
            opacity={0.92}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      ))}
      <group position={[centre.x, 0.28, centre.z]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.055, 8, 48]} />
          <meshBasicMaterial color="#ffffff" blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color="#ffffff" emissive="#8dfaff" emissiveIntensity={5} />
        </mesh>
        <pointLight color="#8dfaff" intensity={7} distance={5} />
      </group>
    </>
  )
}

function TrainSwarm({
  snapshot,
  projectedStops,
  selectedTrain,
  isPlaying,
  time,
  onTime,
  playbackRate,
  selectedCategory,
  selectedStation,
}: NationalNetworkSceneProps & {
  readonly projectedStops: readonly ProjectedStop[]
}) {
  const points = useRef<THREE.Points>(null)
  const glow = useRef<THREE.Points>(null)
  const localTime = useRef(time)
  const lastReport = useRef(0)
  const selectedStationTrainIds = useMemo(
    () => new Set(selectedStation?.trainIds ?? []),
    [selectedStation],
  )
  const lightTextures = useMemo(
    () => ({
      halo: trainLightTexture('halo'),
      orb: trainLightTexture('orb'),
      spark: trainLightTexture('spark'),
    }),
    [],
  )
  const palette = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(SERVICE_COLORS).map(([category, color]) => [
          category,
          new THREE.Color(color),
        ]),
      ) as Record<ServiceCategory, THREE.Color>,
    [],
  )
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(snapshot.trains.length * 3), 3),
    )
    next.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(snapshot.trains.length * 3), 3),
    )
    next.setDrawRange(0, 0)
    return next
  }, [snapshot.trains.length])

  useEffect(() => {
    localTime.current = time
  }, [time])

  useEffect(
    () => () => {
      lightTextures.halo.dispose()
      lightTextures.orb.dispose()
      lightTextures.spark.dispose()
    },
    [lightTextures],
  )

  useFrame((state, delta) => {
    if (isPlaying) {
      localTime.current += delta * playbackRate
      if (localTime.current > snapshot.metadata.windowEnd) {
        localTime.current = snapshot.metadata.windowStart
      }
    }

    const mutableGeometry = points.current?.geometry
    if (!mutableGeometry) return
    const positionAttribute = mutableGeometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute
    const colorAttribute = mutableGeometry.getAttribute('color') as THREE.BufferAttribute
    const mutablePositions = positionAttribute.array as Float32Array
    const mutableColors = colorAttribute.array as Float32Array
    let active = 0
    for (const train of snapshot.trains) {
      const position = projectedTrainPosition(train, localTime.current, projectedStops)
      if (!position) continue
      const offset = active * 3
      mutablePositions.set(position, offset)
      const color = palette[train.category] ?? palette.other
      const stationIncludesTrain =
        !selectedStation || selectedStationTrainIds.has(train.id)
      const categoryIncludesTrain =
        !selectedCategory || selectedCategory === train.category
      const intensity = selectedTrain
        ? selectedTrain.id === train.id
          ? 1
          : 0.11
        : !stationIncludesTrain || !categoryIncludesTrain
          ? 0.08
          : 1
      mutableColors[offset] = color.r * intensity
      mutableColors[offset + 1] = color.g * intensity
      mutableColors[offset + 2] = color.b * intensity
      active += 1
    }

    positionAttribute.needsUpdate = true
    colorAttribute.needsUpdate = true
    mutableGeometry.setDrawRange(0, active)
    if (points.current) points.current.frustumCulled = false
    if (glow.current) glow.current.frustumCulled = false

    if (state.clock.elapsedTime - lastReport.current > 0.1) {
      lastReport.current = state.clock.elapsedTime
      onTime(localTime.current)
    }
  })

  return (
    <>
      <points ref={glow} geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          vertexColors
          map={lightTextures.halo}
          size={0.9}
          transparent
          opacity={selectedTrain || selectedCategory || selectedStation ? 0.12 : 0.18}
          alphaTest={0.005}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
      <points ref={points} geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          vertexColors
          map={lightTextures.orb}
          size={0.28}
          transparent
          opacity={0.92}
          alphaTest={0.015}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
      <points geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          vertexColors
          map={lightTextures.spark}
          size={0.095}
          transparent
          opacity={1}
          alphaTest={0.025}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
    </>
  )
}

function SelectedTrainMarker({
  train,
  time,
  projectedStops,
}: {
  readonly train: NetworkTrain
  readonly time: number
  readonly projectedStops: readonly ProjectedStop[]
}) {
  const marker = useRef<THREE.Group>(null)
  const color = SERVICE_COLORS[train.category]

  useFrame((state) => {
    if (!marker.current) return
    const position = projectedTrainPosition(train, time, projectedStops)
    marker.current.visible = Boolean(position)
    if (!position) return
    marker.current.position.set(...position)
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.12
    marker.current.scale.setScalar(pulse)
  })

  return (
    <group ref={marker}>
      <mesh>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={4}
        />
      </mesh>
      <pointLight color={color} intensity={7} distance={4.5} />
    </group>
  )
}

function NetworkCamera({
  selectedTrain,
  time,
  projectedStops,
  cameraCommand,
  selectedStation,
}: {
  readonly selectedTrain?: NetworkTrain
  readonly time: number
  readonly projectedStops: readonly ProjectedStop[]
  readonly cameraCommand?: MapCameraCommand
  readonly selectedStation?: StationIndexEntry
}) {
  const { camera, gl } = useThree()
  const desiredPosition = useMemo(() => new THREE.Vector3(0, 37, 26), [])
  const desiredTarget = useMemo(() => new THREE.Vector3(), [])
  const currentTarget = useMemo(() => new THREE.Vector3(), [])
  const mapTarget = useRef(new THREE.Vector3())
  const distanceScale = useRef(1)
  const lastCommand = useRef(0)

  useEffect(() => {
    if (!cameraCommand || cameraCommand.id === lastCommand.current) return
    lastCommand.current = cameraCommand.id
    if (cameraCommand.action === 'reset') {
      mapTarget.current.set(0, 0, 0)
      distanceScale.current = 1
      return
    }
    const multiplier = cameraCommand.action === 'zoom-in' ? 0.78 : 1.28
    distanceScale.current = applyMapZoom(distanceScale.current, multiplier)
  }, [cameraCommand])

  useEffect(() => {
    if (!selectedStation) return
    const centre = stationCentre(selectedStation, projectedStops)
    mapTarget.current.copy(centre)
    distanceScale.current = 0.55
  }, [projectedStops, selectedStation])

  useEffect(() => {
    const element = gl.domElement
    const pointers = new Map<number, { x: number; y: number }>()
    let pinchDistance: number | undefined

    const onPointerDown = (event: PointerEvent) => {
      if (selectedTrain || (event.pointerType === 'mouse' && event.button !== 0)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      element.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId)
      if (!previous || selectedTrain) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size === 1) {
        const panScale = 0.045 * distanceScale.current
        mapTarget.current.x -= (event.clientX - previous.x) * panScale
        mapTarget.current.z -= (event.clientY - previous.y) * panScale
        mapTarget.current.x = THREE.MathUtils.clamp(mapTarget.current.x, -25, 25)
        mapTarget.current.z = THREE.MathUtils.clamp(mapTarget.current.z, -16, 16)
      } else if (pointers.size === 2) {
        const [first, second] = [...pointers.values()]
        const nextDistance = Math.hypot(first.x - second.x, first.y - second.y)
        if (pinchDistance && nextDistance > 0) {
          distanceScale.current = applyMapZoom(
            distanceScale.current,
            pinchDistance / nextDistance,
          )
        }
        pinchDistance = nextDistance
      }
      event.preventDefault()
    }
    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (pointers.size < 2) pinchDistance = undefined
    }
    const onWheel = (event: WheelEvent) => {
      if (selectedTrain) return
      distanceScale.current = applyMapZoom(
        distanceScale.current,
        Math.exp(event.deltaY * 0.0012),
      )
      event.preventDefault()
    }

    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('pointercancel', onPointerUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointercancel', onPointerUp)
      element.removeEventListener('wheel', onWheel)
    }
  }, [gl, selectedTrain])

  useFrame((_, delta) => {
    const trainPosition = selectedTrain
      ? projectedTrainPosition(selectedTrain, time, projectedStops)
      : undefined
    if (trainPosition) {
      desiredTarget.set(trainPosition[0], 0, trainPosition[2])
      desiredPosition.set(trainPosition[0] + 4.2, 4.8, trainPosition[2] + 6.5)
    } else {
      desiredTarget.copy(mapTarget.current)
      desiredPosition.set(
        mapTarget.current.x,
        37 * distanceScale.current,
        mapTarget.current.z + 26 * distanceScale.current,
      )
    }

    const damping = 1 - Math.exp(-delta * (trainPosition ? 1.7 : 2.3))
    camera.position.lerp(desiredPosition, damping)
    currentTarget.lerp(desiredTarget, damping)
    camera.lookAt(currentTarget)
  })

  return null
}

function NetworkWorld(props: NationalNetworkSceneProps) {
  const projectedStops = useMemo(() => projectStops(props.snapshot), [props.snapshot])

  return (
    <>
      <fog attach="fog" args={['#050410', 34, 69]} />
      <ambientLight intensity={0.85} color="#7d87ff" />
      <NationalGround />
      {props.boundary && (
        <CountryBorder
          boundary={props.boundary}
          snapshot={props.snapshot}
          subdued={Boolean(props.selectedTrain || props.selectedStation)}
        />
      )}
      <RailGraph
        snapshot={props.snapshot}
        projectedStops={projectedStops}
        subdued={Boolean(props.selectedTrain || props.selectedStation)}
      />
      {props.selectedTrain && (
        <>
          <SelectedRoute train={props.selectedTrain} projectedStops={projectedStops} />
          <SelectedTrainMarker
            train={props.selectedTrain}
            time={props.time}
            projectedStops={projectedStops}
          />
        </>
      )}
      {props.selectedStation && (
        <SelectedStationRoutes
          station={props.selectedStation}
          snapshot={props.snapshot}
          projectedStops={projectedStops}
          selectedCategory={props.selectedCategory}
        />
      )}
      <TrainSwarm {...props} projectedStops={projectedStops} />
      <TrainLabels {...props} projectedStops={projectedStops} />
      <StationLabels
        stations={props.stations}
        snapshot={props.snapshot}
        projectedStops={projectedStops}
        selectedStation={props.selectedStation}
        selectedTrain={props.selectedTrain}
      />
      <NetworkCamera
        selectedTrain={props.selectedTrain}
        time={props.time}
        projectedStops={projectedStops}
        cameraCommand={props.cameraCommand}
        selectedStation={props.selectedStation}
      />
    </>
  )
}

export function NationalNetworkScene(props: NationalNetworkSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 37, 26], fov: 44, near: 0.1, far: 120 }}
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#050410']} />
      <NetworkWorld {...props} />
    </Canvas>
  )
}
