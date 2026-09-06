#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

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
    const pathRemap = snapshot.paths.map((path) => {
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
      edgePaths.push(pathRemap[snapshot.edgePaths?.[index] ?? index])
    })
    trains.push(...snapshot.trains.map((train) => ({
      ...train,
      stops: train.stops.map(([stopIndex, arrival, departure]) => [stopRemap[stopIndex], arrival, departure]),
      pathSegments: train.pathSegments?.map((pathIndex) => pathRemap[pathIndex]),
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
      publisher: 'Transport for London',
      feedVersion: `all-change-rail-led:${retrievedAt.slice(0, 10)}`,
      serviceDate: first.metadata.serviceDate,
      windowStart: first.metadata.windowStart,
      windowEnd: first.metadata.windowEnd,
      focusTime: first.metadata.focusTime,
      sourceUrl: 'https://tfl.gov.uk/info-for/open-data-users/our-open-data',
      sourceSha256: sha256(sources),
      retrievedAt,
      license: 'Transport for London Data Service terms and conditions',
      licenseUrl: 'https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service',
      model: 'Composite TfL recurring timetable and public timetable-PDF interpolation / not realtime',
      note: note ?? `${snapshots.length} representative rail-led studies merged into one contract. This proves cross-mode composition; it is not yet a complete or bidirectional London service claim.`,
      modes,
      sources,
      geometry: {
        publisher: 'Transport for London',
        feedVersion: `all-change-rail-led:${retrievedAt.slice(0, 10)}`,
        sourceUrl: 'https://api.tfl.gov.uk',
        sourceSha256: sha256(sources.map(({ geometrySourceSha256 }) => geometrySourceSha256)),
        model: 'Deduplicated TfL branch paths from component fixtures',
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

async function main() {
  const argv = process.argv.slice(2)
  const outputIndex = argv.indexOf('--output')
  if (outputIndex < 0 || !argv[outputIndex + 1]) {
    throw new Error('Usage: node scripts/merge-network-snapshots.mjs --output target.json input.json [input.json ...]')
  }
  const output = argv[outputIndex + 1]
  const retrievedAtIndex = argv.indexOf('--retrieved-at')
  const retrievedAt = retrievedAtIndex < 0 ? new Date().toISOString() : argv[retrievedAtIndex + 1]
  const noteIndex = argv.indexOf('--note')
  const note = noteIndex < 0 ? undefined : argv[noteIndex + 1]
  const optionIndexes = new Set([outputIndex, outputIndex + 1])
  if (retrievedAtIndex >= 0) {
    optionIndexes.add(retrievedAtIndex)
    optionIndexes.add(retrievedAtIndex + 1)
  }
  if (noteIndex >= 0) {
    optionIndexes.add(noteIndex)
    optionIndexes.add(noteIndex + 1)
  }
  const inputs = argv.filter((_, index) => !optionIndexes.has(index))
  if (!inputs.length) throw new Error('At least one input snapshot is required')
  const snapshots = await Promise.all(inputs.map(async (input) =>
    JSON.parse(await readFile(resolve(input), 'utf8'))))
  const merged = mergeNetworkSnapshots(snapshots, { retrievedAt, note })
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(merged)}\n`)
  console.log(`Wrote ${output}: ${merged.trains.length} journeys / ${merged.stops.length} stops / ${merged.paths.length} paths / ${merged.metadata.modes.length} modes`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
