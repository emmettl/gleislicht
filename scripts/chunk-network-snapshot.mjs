#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function argument(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : argv[index + 1]
}

function parseClock(value) {
  const [hours, minutes = 0] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new Error(`Invalid clock value ${value}`)
  }
  return hours * 3600 + minutes * 60
}

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true })
  await new Promise((resolvePromise, rejectPromise) => {
    const output = createWriteStream(filePath)
    output.once('error', rejectPromise)
    output.once('finish', resolvePromise)
    output.end(JSON.stringify(value))
  })
}

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
  if (!Number.isFinite(chunkSeconds) || chunkSeconds <= 0) {
    throw new Error('Chunk duration must be a positive number of seconds')
  }
  const chunks = []
  for (
    let windowStart = snapshot.metadata.windowStart;
    windowStart < snapshot.metadata.windowEnd;
    windowStart += chunkSeconds
  ) {
    const windowEnd = Math.min(snapshot.metadata.windowEnd, windowStart + chunkSeconds)
    const startHour = String(Math.floor(windowStart / 3600)).padStart(2, '0')
    const endHour = String(Math.ceil(windowEnd / 3600)).padStart(2, '0')
    const id = `${startHour}-${endHour}`
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

async function main() {
  const argv = process.argv.slice(2)
  const input = argument(argv, 'input')
  const manifestOutput = argument(argv, 'manifest')
  const openingOutput = argument(argv, 'opening')
  if (!input || !manifestOutput || !openingOutput) {
    throw new Error(
      'Usage: node scripts/chunk-network-snapshot.mjs --input day.json --manifest day-manifest.json --opening morning.json [--chunk-hours 2] [--opening-start 06:45] [--opening-end 08:45] [--focus 07:45]',
    )
  }
  const snapshot = JSON.parse(await readFile(resolve(input), 'utf8'))
  const manifestPath = resolve(manifestOutput)
  const outputDirectory = dirname(manifestPath)
  const outputStem = basename(manifestPath, extname(manifestPath)).replace(/-manifest$/, '')
  const chunkDirectoryName = `${outputStem}-chunks`
  const { manifest, chunks } = chunkNetworkSnapshot(
    snapshot,
    Number(argument(argv, 'chunk-hours', '2')) * 3600,
    chunkDirectoryName,
  )
  const opening = extractNetworkWindow(
    snapshot,
    parseClock(argument(argv, 'opening-start', '06:45')),
    parseClock(argument(argv, 'opening-end', '08:45')),
    parseClock(argument(argv, 'focus', '07:45')),
  )
  await Promise.all([
    writeJson(manifestPath, manifest),
    writeJson(resolve(openingOutput), opening),
    ...chunks.map(({ descriptor, payload }) =>
      writeJson(join(outputDirectory, descriptor.path), payload),
    ),
  ])
  console.log(
    `Wrote ${manifestOutput}, ${chunks.length} progressive chunks and ${opening.trains.length} opening journeys.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
