import { createHash } from 'node:crypto'

function boundsFor(stops) {
  return stops.reduce((bounds, [longitude, latitude]) => ({
    minLongitude: Math.min(bounds.minLongitude, longitude),
    minLatitude: Math.min(bounds.minLatitude, latitude),
    maxLongitude: Math.max(bounds.maxLongitude, longitude),
    maxLatitude: Math.max(bounds.maxLatitude, latitude),
  }), {
    minLongitude: Number.POSITIVE_INFINITY,
    minLatitude: Number.POSITIVE_INFINITY,
    maxLongitude: Number.NEGATIVE_INFINITY,
    maxLatitude: Number.NEGATIVE_INFINITY,
  })
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function mergeNetworkSnapshots(snapshots, {
  retrievedAt = new Date().toISOString(),
  note,
  metadata = {},
  geometryMetadata = {},
} = {}) {
  if (!snapshots.length) throw new Error('At least one network snapshot is required')
  const first = snapshots[0]
  for (const snapshot of snapshots.slice(1)) {
    if (snapshot.metadata.serviceDate !== first.metadata.serviceDate ||
      snapshot.metadata.windowStart !== first.metadata.windowStart ||
      snapshot.metadata.windowEnd !== first.metadata.windowEnd) {
      throw new Error('Network snapshots must share a service date and study window')
    }
  }

  const stops = []
  const stopIndexBySourceId = new Map()
  const paths = []
  const pathIndexByCoordinates = new Map()
  const edges = []
  const edgePaths = []
  const trains = []

  for (const snapshot of snapshots) {
    const stopRemap = snapshot.stops.map((stop) => {
      const sourceId = stop[4] ?? `${stop[0]}:${stop[1]}:${stop[2]}`
      const existing = stopIndexBySourceId.get(sourceId)
      if (existing !== undefined) return existing
      const index = stops.length
      stops.push(stop)
      stopIndexBySourceId.set(sourceId, index)
      return index
    })
    const pathRemap = (snapshot.paths ?? []).map((path) => {
      const key = JSON.stringify(path)
      const existing = pathIndexByCoordinates.get(key)
      if (existing !== undefined) return existing
      const index = paths.length
      paths.push(path)
      pathIndexByCoordinates.set(key, index)
      return index
    })
    snapshot.edges.forEach(([from, to], index) => {
      edges.push([stopRemap[from], stopRemap[to]])
      const sourcePath = snapshot.edgePaths ? snapshot.edgePaths[index] : index
      edgePaths.push(sourcePath == null ? null : pathRemap[sourcePath] ?? null)
    })
    trains.push(...snapshot.trains.map((train) => ({
      ...train,
      stops: train.stops.map(([stopIndex, arrival, departure]) => [stopRemap[stopIndex], arrival, departure]),
      pathSegments: train.pathSegments?.map((pathIndex) => pathIndex === null ? null : pathRemap[pathIndex] ?? null),
    })))
  }

  const sources = snapshots.map(({ metadata }) => ({
    modes: metadata.modes,
    sourceUrl: metadata.sourceUrl,
    sourceSha256: metadata.sourceSha256,
    geometrySourceUrl: metadata.geometry?.sourceUrl,
    geometrySourceSha256: metadata.geometry?.sourceSha256,
    model: metadata.model,
    note: metadata.note,
  }))
  const modes = [...new Set(snapshots.flatMap(({ metadata }) => metadata.modes ?? []))]
  return {
    metadata: {
      ...first.metadata,
      ...metadata,
      serviceDate: first.metadata.serviceDate,
      windowStart: first.metadata.windowStart,
      windowEnd: first.metadata.windowEnd,
      focusTime: first.metadata.focusTime,
      sourceSha256: sha256(sources),
      retrievedAt,
      note: note ?? `${snapshots.length} studies merged into one network.`,
      modes,
      sources,
      geometry: {
        publisher: first.metadata.publisher,
        feedVersion: first.metadata.feedVersion,
        sourceUrl: first.metadata.sourceUrl,
        model: 'Deduplicated paths from component networks',
        ...first.metadata.geometry,
        ...geometryMetadata,
        sourceSha256: sha256(sources.map(({ geometrySourceSha256 }) => geometrySourceSha256)),
        matchedSegments: paths.length,
        totalSegments: paths.length,
      },
    },
    bounds: boundsFor(stops),
    stops,
    edges,
    paths,
    edgePaths,
    trains,
  }
}
