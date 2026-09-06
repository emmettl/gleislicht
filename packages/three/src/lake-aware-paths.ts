import {
  prepareProjectedPath,
  type ProjectedNetworkPath,
  type ProjectedPathPoint,
} from './network-paths.ts'

interface RingBounds {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

interface PreparedLakeRing {
  readonly points: readonly ProjectedPathPoint[]
  readonly bounds: RingBounds
}

interface RingIntersection {
  readonly edgeIndex: number
  readonly progress: number
  readonly point: ProjectedPathPoint
}

const INTERSECTION_EPSILON = 1e-7
const MIN_WATER_CROSSING = 0.18
const MAX_DETOUR_RATIO = 4

export type LakeAvoidingPathMap = ReadonlyMap<string, ProjectedNetworkPath>

function pathKey(fromIndex: number, toIndex: number): string {
  return `${fromIndex}:${toIndex}`
}

function pointDistance(
  first: ProjectedPathPoint,
  second: ProjectedPathPoint,
): number {
  return Math.hypot(first[0] - second[0], first[2] - second[2])
}

function pathLength(points: readonly ProjectedPathPoint[]): number {
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    length += pointDistance(points[index - 1], points[index])
  }
  return length
}

function ringBounds(points: readonly ProjectedPathPoint[]): RingBounds {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY
  points.forEach(([x, , z]) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  })
  return { minX, maxX, minZ, maxZ }
}

function boundsOverlapSegment(
  bounds: RingBounds,
  first: ProjectedPathPoint,
  second: ProjectedPathPoint,
): boolean {
  return !(
    Math.max(first[0], second[0]) < bounds.minX ||
    Math.min(first[0], second[0]) > bounds.maxX ||
    Math.max(first[2], second[2]) < bounds.minZ ||
    Math.min(first[2], second[2]) > bounds.maxZ
  )
}

function segmentIntersections(
  first: ProjectedPathPoint,
  second: ProjectedPathPoint,
  ring: readonly ProjectedPathPoint[],
): readonly RingIntersection[] {
  const directionX = second[0] - first[0]
  const directionZ = second[2] - first[2]
  const intersections: RingIntersection[] = []

  for (let edgeIndex = 0; edgeIndex < ring.length; edgeIndex += 1) {
    const edgeStart = ring[edgeIndex]
    const edgeEnd = ring[(edgeIndex + 1) % ring.length]
    const edgeX = edgeEnd[0] - edgeStart[0]
    const edgeZ = edgeEnd[2] - edgeStart[2]
    const denominator = directionX * edgeZ - directionZ * edgeX
    if (Math.abs(denominator) < INTERSECTION_EPSILON) continue

    const offsetX = edgeStart[0] - first[0]
    const offsetZ = edgeStart[2] - first[2]
    const segmentProgress = (offsetX * edgeZ - offsetZ * edgeX) / denominator
    const edgeProgress = (offsetX * directionZ - offsetZ * directionX) / denominator
    if (
      segmentProgress <= INTERSECTION_EPSILON ||
      segmentProgress >= 1 - INTERSECTION_EPSILON ||
      edgeProgress < -INTERSECTION_EPSILON ||
      edgeProgress > 1 + INTERSECTION_EPSILON
    ) {
      continue
    }

    if (
      intersections.some(
        (intersection) =>
          Math.abs(intersection.progress - segmentProgress) < 1e-5,
      )
    ) {
      continue
    }
    intersections.push({
      edgeIndex,
      progress: segmentProgress,
      point: [
        first[0] + directionX * segmentProgress,
        first[1] + (second[1] - first[1]) * segmentProgress,
        first[2] + directionZ * segmentProgress,
      ],
    })
  }

  return intersections.sort((firstHit, secondHit) =>
    firstHit.progress - secondHit.progress
  )
}

function shorelineArc(
  ring: readonly ProjectedPathPoint[],
  entry: RingIntersection,
  exit: RingIntersection,
  forward: boolean,
): readonly ProjectedPathPoint[] {
  const points: ProjectedPathPoint[] = [entry.point]
  let index = forward
    ? (entry.edgeIndex + 1) % ring.length
    : entry.edgeIndex
  const finalIndex = forward
    ? exit.edgeIndex
    : (exit.edgeIndex + 1) % ring.length
  const step = forward ? 1 : -1

  for (let guard = 0; guard < ring.length; guard += 1) {
    points.push(ring[index])
    if (index === finalIndex) break
    index = (index + step + ring.length) % ring.length
  }
  points.push(exit.point)
  return points
}

/**
 * Replaces an obvious long chord through a lake with the shorter shoreline arc.
 * Small crossings remain untouched because they may represent a real bridge.
 */
function lakeAvoidingPathFromPreparedRings(
  first: ProjectedPathPoint,
  second: ProjectedPathPoint,
  preparedRings: readonly PreparedLakeRing[],
): readonly ProjectedPathPoint[] | undefined {
  let strongestDetour:
    | { crossing: number; points: readonly ProjectedPathPoint[] }
    | undefined
  for (const ring of preparedRings) {
    if (!boundsOverlapSegment(ring.bounds, first, second)) continue
    const intersections = segmentIntersections(first, second, ring.points)
    if (intersections.length < 2) continue
    const entry = intersections[0]
    const exit = intersections.at(-1)
    if (!exit) continue
    const crossing = pointDistance(entry.point, exit.point)
    if (crossing < MIN_WATER_CROSSING) continue

    const forwardArc = shorelineArc(ring.points, entry, exit, true)
    const reverseArc = shorelineArc(ring.points, entry, exit, false)
    const arc =
      pathLength(forwardArc) <= pathLength(reverseArc)
        ? forwardArc
        : reverseArc
    const directLength = pointDistance(first, second)
    const detour = [first, ...arc, second]
    if (pathLength(detour) > directLength * MAX_DETOUR_RATIO) continue
    if (!strongestDetour || crossing > strongestDetour.crossing) {
      strongestDetour = { crossing, points: detour }
    }
  }

  return strongestDetour?.points
}

export function lakeAvoidingPath(
  first: ProjectedPathPoint,
  second: ProjectedPathPoint,
  lakeRings: readonly (readonly ProjectedPathPoint[])[],
): readonly ProjectedPathPoint[] | undefined {
  const preparedRings: PreparedLakeRing[] = lakeRings
    .filter((ring) => ring.length >= 3)
    .map((points) => ({ points, bounds: ringBounds(points) }))
  return lakeAvoidingPathFromPreparedRings(first, second, preparedRings)
}

export function createLakeAvoidingPathMap(
  edges: readonly (readonly [number, number])[],
  edgePaths: readonly (number | null)[] | undefined,
  projectedStops: readonly ProjectedPathPoint[],
  lakeRings: readonly (readonly ProjectedPathPoint[])[],
): LakeAvoidingPathMap {
  const paths = new Map<string, ProjectedNetworkPath>()
  const preparedRings: PreparedLakeRing[] = lakeRings
    .filter((ring) => ring.length >= 3)
    .map((points) => ({ points, bounds: ringBounds(points) }))
  edges.forEach(([fromIndex, toIndex], edgeIndex) => {
    if (edgePaths?.[edgeIndex] !== undefined && edgePaths[edgeIndex] !== null) {
      return
    }
    const first = projectedStops[fromIndex]
    const second = projectedStops[toIndex]
    if (!first || !second) return
    const detour = lakeAvoidingPathFromPreparedRings(
      first,
      second,
      preparedRings,
    )
    if (!detour) return
    paths.set(pathKey(fromIndex, toIndex), prepareProjectedPath(detour))
    paths.set(
      pathKey(toIndex, fromIndex),
      prepareProjectedPath([...detour].reverse()),
    )
  })
  return paths
}

export function lakeAvoidingPathForStops(
  paths: LakeAvoidingPathMap,
  fromIndex: number,
  toIndex: number,
): ProjectedNetworkPath | undefined {
  return paths.get(pathKey(fromIndex, toIndex))
}
