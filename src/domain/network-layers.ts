import type {
  InterchangeComplex,
  NetworkPath,
  NetworkSnapshot,
  NetworkStop,
} from './network.ts'

function mergeInterchangeComplexes(
  snapshots: readonly NetworkSnapshot[],
): NetworkSnapshot['metadata']['interchangeStudy'] {
  const studies = snapshots.flatMap(({ metadata }) =>
    metadata.interchangeStudy ? [metadata.interchangeStudy] : [],
  )
  if (!studies.length) return undefined
  const complexes = new Map<string, InterchangeComplex>()
  for (const study of studies) {
    for (const complex of study.complexes) {
      const existing = complexes.get(complex.id)
      if (!existing) {
        complexes.set(complex.id, complex)
        continue
      }
      const links = new Map(
        [...existing.links, ...complex.links].map((link) => [
          `${link.fromStopId}:${link.toStopId}:${link.minimumTransferSeconds}`,
          link,
        ]),
      )
      complexes.set(complex.id, {
        ...existing,
        stopIds: [...new Set([...existing.stopIds, ...complex.stopIds])],
        links: [...links.values()],
      })
    }
  }
  return {
    model: studies.map(({ model }) => model).join(' '),
    complexes: [...complexes.values()],
  }
}

/**
 * Combines independently loaded data layers without changing their source IDs.
 * This is intentionally a runtime composition: each source artifact retains an
 * independent payload budget and can remain outside the opening request graph.
 */
export function mergeNetworkLayers(
  snapshots: readonly NetworkSnapshot[],
): NetworkSnapshot {
  const primary = snapshots[0]
  if (!primary) throw new Error('At least one network layer is required')
  for (const snapshot of snapshots.slice(1)) {
    if (
      snapshot.metadata.serviceDate !== primary.metadata.serviceDate ||
      snapshot.metadata.windowStart !== primary.metadata.windowStart ||
      snapshot.metadata.windowEnd !== primary.metadata.windowEnd
    ) {
      throw new Error('Network layers must share a service date and study window')
    }
  }

  const stops: NetworkStop[] = []
  const stopIndexByIdentity = new Map<string, number>()
  const paths: NetworkPath[] = []
  const pathIndexByCoordinates = new Map<string, number>()
  const edges: Array<readonly [number, number]> = []
  const edgePaths: Array<number | null> = []
  const trains: NetworkSnapshot['trains'][number][] = []
  const trainIds = new Set<string>()

  for (const snapshot of snapshots) {
    const stopRemap = snapshot.stops.map((stop) => {
      const identity = stop[4] ?? `${stop[0]}:${stop[1]}:${stop[2]}`
      const existing = stopIndexByIdentity.get(identity)
      if (existing !== undefined) return existing
      const index = stops.length
      stops.push(stop)
      stopIndexByIdentity.set(identity, index)
      return index
    })
    const pathRemap = (snapshot.paths ?? []).map((path) => {
      const identity = JSON.stringify(path)
      const existing = pathIndexByCoordinates.get(identity)
      if (existing !== undefined) return existing
      const index = paths.length
      paths.push(path)
      pathIndexByCoordinates.set(identity, index)
      return index
    })
    snapshot.edges.forEach(([from, to], edgeIndex) => {
      edges.push([stopRemap[from], stopRemap[to]])
      const sourcePathIndex = snapshot.edgePaths?.[edgeIndex]
      edgePaths.push(
        sourcePathIndex === null || sourcePathIndex === undefined
          ? null
          : (pathRemap[sourcePathIndex] ?? null),
      )
    })
    for (const train of snapshot.trains) {
      if (trainIds.has(train.id)) continue
      trainIds.add(train.id)
      trains.push({
        ...train,
        stops: train.stops.map(([stopIndex, arrival, departure]) => [
          stopRemap[stopIndex],
          arrival,
          departure,
        ]),
        pathSegments: train.pathSegments?.map((pathIndex) =>
          pathIndex === null ? null : (pathRemap[pathIndex] ?? null),
        ),
      })
    }
  }

  const geometry = primary.metadata.geometry
    ? {
        ...primary.metadata.geometry,
        model: `Runtime composition of ${snapshots.length} independently loaded geometry layers`,
        matchedSegments: edgePaths.filter((pathIndex) => pathIndex !== null).length,
        totalSegments: edges.length,
        resolvedStops: stops.length,
        totalStops: stops.length,
      }
    : undefined

  return {
    metadata: {
      ...primary.metadata,
      feedVersion: snapshots.map(({ metadata }) => metadata.feedVersion).join('+'),
      model: snapshots.map(({ metadata }) => metadata.model).join(' + '),
      note: `${snapshots.length} independently loaded network layers composed in the browser.`,
      modes: [...new Set(snapshots.flatMap(({ metadata }) => metadata.modes ?? []))],
      localRouteIds: [
        ...new Set(
          snapshots.flatMap(({ metadata }) => metadata.localRouteIds ?? []),
        ),
      ],
      interchangeStudy: mergeInterchangeComplexes(snapshots),
      geometry,
    },
    bounds: {
      minLongitude: Math.min(...snapshots.map(({ bounds }) => bounds.minLongitude)),
      minLatitude: Math.min(...snapshots.map(({ bounds }) => bounds.minLatitude)),
      maxLongitude: Math.max(...snapshots.map(({ bounds }) => bounds.maxLongitude)),
      maxLatitude: Math.max(...snapshots.map(({ bounds }) => bounds.maxLatitude)),
    },
    stops,
    edges,
    paths,
    edgePaths,
    trains,
  }
}
