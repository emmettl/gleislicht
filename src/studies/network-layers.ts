import type { NetworkSnapshot } from '@motionstudies/core/domain/network'

/** Preserve the clock and geographic bounds for independently rendered layers. */
export function networkWithRailVisibility(snapshot: NetworkSnapshot, visible: boolean): NetworkSnapshot {
  return visible ? snapshot : {
    ...snapshot,
    stops: [],
    edges: [],
    paths: [],
    edgePaths: [],
    trains: [],
  }
}

/** Add a timetable layer, remapping its local stop and geometry references. */
export function networkWithTimetableLayer(base: NetworkSnapshot, layer?: NetworkSnapshot): NetworkSnapshot {
  if (!layer) return base
  const stopOffset = base.stops.length
  const pathOffset = base.paths?.length ?? 0
  const pathIndex = (index: number | null) => index === null ? null : index + pathOffset
  return {
    ...base,
    stops: [...base.stops, ...layer.stops],
    edges: [...base.edges, ...layer.edges.map(([from, to]) => [from + stopOffset, to + stopOffset] as const)],
    paths: [...(base.paths ?? []), ...(layer.paths ?? [])],
    edgePaths: [
      ...base.edges.map((_, index) => base.edgePaths?.[index] ?? null),
      ...layer.edges.map((_, index) => pathIndex(layer.edgePaths?.[index] ?? null)),
    ],
    trains: [...base.trains, ...layer.trains.map(train => ({
      ...train,
      stops: train.stops.map(([stop, arrival, departure]) => [stop + stopOffset, arrival, departure] as const),
      pathSegments: train.pathSegments?.map(pathIndex),
    }))],
  }
}
