import type { NetworkSnapshot } from './network.ts'

export type SpatialLayoutCoordinate = readonly [x: number, y: number]
export type SpatialLayoutStop = readonly [
  sourceId: string,
  x: number,
  y: number,
]

export interface SpatialLayoutSnapshot {
  readonly metadata: {
    readonly id: string
    readonly label: string
    readonly kind: 'topological'
    readonly coordinateSpace: 'normalized'
    readonly sourceNetwork: string
    readonly sourceSha256: string
    readonly overridesSource?: string
    readonly overridesSha256?: string
    readonly feedVersion: string
    readonly model: string
    readonly note: string
  }
  readonly bounds: {
    readonly minX: number
    readonly minY: number
    readonly maxX: number
    readonly maxY: number
  }
  readonly stops: readonly SpatialLayoutStop[]
  /** Path indexes deliberately match the source network's `paths` array. */
  readonly paths: readonly (readonly SpatialLayoutCoordinate[])[]
}

export interface SpatialLayoutCoverage {
  readonly matchedStops: number
  readonly totalStops: number
  readonly matchedPaths: number
  readonly totalPaths: number
}

export function spatialLayoutCoverage(
  network: NetworkSnapshot,
  layout: SpatialLayoutSnapshot,
): SpatialLayoutCoverage {
  const layoutStopIds = new Set(layout.stops.map(([sourceId]) => sourceId))
  const matchedStops = network.stops.reduce(
    (count, stop) => count + Number(Boolean(stop[4] && layoutStopIds.has(stop[4]))),
    0,
  )
  const totalPaths = network.paths?.length ?? 0
  const matchedPaths = Math.min(
    totalPaths,
    layout.paths.filter((path) => path.length >= 2).length,
  )
  return {
    matchedStops,
    totalStops: network.stops.length,
    matchedPaths,
    totalPaths,
  }
}
