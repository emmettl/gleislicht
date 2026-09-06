import type { NetworkSnapshot } from '../domain/network.ts'
import type {
  SpatialLayoutCoordinate,
  SpatialLayoutSnapshot,
} from '../domain/spatial-layout.ts'
import {
  pointAlongProjectedPath,
  prepareProjectedPath,
  type ProjectedNetworkPath,
  type ProjectedPathPoint,
} from './network-paths.ts'

export interface ProjectedSpatialLayout {
  readonly stops: readonly ProjectedPathPoint[]
  readonly paths: readonly ProjectedNetworkPath[]
  readonly context?: {
    readonly waterPaths: readonly ProjectedNetworkPath[]
  }
}
function layoutProjection(layout: SpatialLayoutSnapshot, targetWidth: number) {
  const width = Math.max(0.000001, layout.bounds.maxX - layout.bounds.minX)
  const centreX = (layout.bounds.minX + layout.bounds.maxX) / 2
  const centreY = (layout.bounds.minY + layout.bounds.maxY) / 2
  const scale = targetWidth / width
  return ([x, y]: SpatialLayoutCoordinate): ProjectedPathPoint => [
    (x - centreX) * scale,
    0,
    -(y - centreY) * scale,
  ]
}

export function projectSpatialLayout(
  network: NetworkSnapshot,
  layout: SpatialLayoutSnapshot,
  geographicStops: readonly ProjectedPathPoint[],
  geographicPaths: readonly ProjectedNetworkPath[],
  targetWidth = 51,
): ProjectedSpatialLayout {
  const project = layoutProjection(layout, targetWidth)
  const stopBySourceId = new Map(
    layout.stops.map(([sourceId, x, y]) => [
      sourceId,
      project([x, y]),
    ] as const),
  )
  const stops = network.stops.map((stop, index) => {
    const sourceId = stop[4]
    return (sourceId ? stopBySourceId.get(sourceId) : undefined) ?? geographicStops[index]
  })
  const paths = geographicPaths.map((geographicPath, index) => {
    const coordinates = layout.paths[index]
    return coordinates?.length >= 2
      ? prepareProjectedPath(coordinates.map(project))
      : geographicPath
  })
  const waterPaths =
    layout.context?.waterPaths
      ?.filter((path) => path.length >= 2)
      .map((path) => prepareProjectedPath(path.map(project))) ?? []
  return {
    stops,
    paths,
    context: waterPaths.length > 0 ? { waterPaths } : undefined,
  }
}

function pointAt(
  path: ProjectedNetworkPath,
  index: number,
  count: number,
): ProjectedPathPoint {
  return (
    pointAlongProjectedPath(path, count <= 1 ? 0 : index / (count - 1)) ??
    path.points[0] ??
    [0, 0, 0]
  )
}

export function blendProjectedSpatialLayout(
  geographicStops: readonly ProjectedPathPoint[],
  geographicPaths: readonly ProjectedNetworkPath[],
  alternate: ProjectedSpatialLayout | undefined,
  mix: number,
): ProjectedSpatialLayout {
  if (!alternate || mix <= 0) {
    return { stops: geographicStops, paths: geographicPaths }
  }
  if (mix >= 1) return alternate

  const progress = Math.min(1, Math.max(0, mix))
  const stops = geographicStops.map((from, index) => {
    const to = alternate.stops[index] ?? from
    return [
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
      from[2] + (to[2] - from[2]) * progress,
    ] as const
  })
  const paths = geographicPaths.map((from, index) => {
    const to = alternate.paths[index] ?? from
    const sampleCount = Math.max(
      2,
      Math.min(32, Math.max(from.points.length, to.points.length)),
    )
    const points = Array.from({ length: sampleCount }, (_, pointIndex) => {
      const first = pointAt(from, pointIndex, sampleCount)
      const second = pointAt(to, pointIndex, sampleCount)
      return [
        first[0] + (second[0] - first[0]) * progress,
        first[1] + (second[1] - first[1]) * progress,
        first[2] + (second[2] - first[2]) * progress,
      ] as const
    })
    return prepareProjectedPath(points)
  })
  return { stops, paths, context: alternate.context }
}
