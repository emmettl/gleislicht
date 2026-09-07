import { createHash } from 'node:crypto'

export function extractNetworkWindow(snapshot, windowStart, windowEnd, focusTime) {
  if (windowStart >= windowEnd) throw new Error('Network window must have positive duration')
  return {
    ...snapshot,
    metadata: {
      ...snapshot.metadata,
      windowStart,
      windowEnd,
      focusTime,
    },
    trains: snapshot.trains.filter(
      (train) => train.start <= windowEnd && train.end >= windowStart,
    ),
  }
}

export function chunkNetworkSnapshot(snapshot, chunkSeconds, chunkDirectoryName) {
  if (!Number.isSafeInteger(chunkSeconds) || chunkSeconds <= 0) {
    throw new Error('Chunk duration must be a positive whole number of seconds')
  }
  if (!Number.isSafeInteger(snapshot.metadata.windowStart) || !Number.isSafeInteger(snapshot.metadata.windowEnd) || snapshot.metadata.windowEnd <= snapshot.metadata.windowStart) {
    throw new Error('Network window must have positive duration in whole seconds')
  }
  const clockId = (time) => `${String(Math.floor(time / 3600)).padStart(2, '0')}h${String(Math.floor(time / 60) % 60).padStart(2, '0')}m${String(time % 60).padStart(2, '0')}s`
  const chunks = []
  for (
    let windowStart = snapshot.metadata.windowStart;
    windowStart < snapshot.metadata.windowEnd;
    windowStart += chunkSeconds
  ) {
    const windowEnd = Math.min(snapshot.metadata.windowEnd, windowStart + chunkSeconds)
    const startHour = String(Math.floor(windowStart / 3600)).padStart(2, '0')
    const endHour = String(Math.ceil(windowEnd / 3600)).padStart(2, '0')
    const id = windowStart % 3600 === 0 && windowEnd % 3600 === 0
      ? `${startHour}-${endHour}`
      : `${clockId(windowStart)}-${clockId(windowEnd)}`
    const trains = snapshot.trains.filter(
      (train) => train.start <= windowEnd && train.end >= windowStart,
    )
    const payload = { windowStart, windowEnd, trains }
    const encoded = JSON.stringify(payload)
    chunks.push({
      descriptor: {
        id,
        windowStart,
        windowEnd,
        path: `${chunkDirectoryName}/${id}.json`,
        tripCount: trains.length,
        bytes: Buffer.byteLength(encoded),
        sha256: createHash('sha256').update(encoded).digest('hex'),
      },
      payload,
    })
  }

  return {
    manifest: {
      metadata: snapshot.metadata,
      bounds: snapshot.bounds,
      stops: snapshot.stops,
      edges: snapshot.edges,
      ...(snapshot.paths ? { paths: snapshot.paths } : {}),
      ...(snapshot.edgePaths ? { edgePaths: snapshot.edgePaths } : {}),
      tripCount: snapshot.trains.length,
      chunks: chunks.map(({ descriptor }) => descriptor),
    },
    chunks,
  }
}
