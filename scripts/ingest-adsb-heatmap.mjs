#!/usr/bin/env node

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ingestAdsbHeatmaps } from '@motionstudies/data/adsb-heatmap'

const DEFAULT_BOUNDS = [5.45, 45.55, 10.75, 48.2]

function parseArguments(argv) {
  const options = {
    inputs: [],
    inputDirectory: undefined,
    output: 'public/data/swiss-air-morning.json',
    serviceDate: '2026-09-04',
    utcOffsetHours: 2,
    bounds: DEFAULT_BOUNDS,
    windowStart: 6 * 3600 + 45 * 60,
    windowEnd: 8 * 3600 + 45 * 60,
    chunkHours: undefined,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--input') options.inputs.push(argv[++index])
    else if (argument === '--input-directory') options.inputDirectory = argv[++index]
    else if (argument === '--output') options.output = argv[++index]
    else if (argument === '--service-date') options.serviceDate = argv[++index]
    else if (argument === '--utc-offset') options.utcOffsetHours = Number(argv[++index])
    else if (argument === '--window-start') options.windowStart = parseServiceTime(argv[++index])
    else if (argument === '--window-end') options.windowEnd = parseServiceTime(argv[++index])
    else if (argument === '--chunk-hours') options.chunkHours = Number(argv[++index])
    else if (argument === '--bounds') {
      options.bounds = argv[++index].split(',').map(Number)
    } else if (argument === '--help') {
      console.log('Usage: node scripts/ingest-adsb-heatmap.mjs (--input 09.bin.ttf ... | --input-directory /path/to/slices) --window-start 06:45 --window-end 08:45 [--chunk-hours 1] [--output file]')
      process.exit(0)
    } else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!options.inputs.length && !options.inputDirectory) {
    throw new Error('At least one --input or --input-directory is required')
  }
  if (options.bounds.length !== 4 || options.bounds.some(Number.isNaN)) {
    throw new Error('--bounds must be minLon,minLat,maxLon,maxLat')
  }
  if (options.windowStart >= options.windowEnd) {
    throw new Error('--window-start must be earlier than --window-end')
  }
  if (
    options.chunkHours !== undefined &&
    (!Number.isInteger(options.chunkHours) || options.chunkHours < 1)
  ) {
    throw new Error('--chunk-hours must be a positive integer')
  }
  return options
}

function parseServiceTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) throw new Error(`Invalid service time: ${value}`)
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) {
    throw new Error(`Invalid service time: ${value}`)
  }
  return hours * 3600 + minutes * 60
}

const options = parseArguments(process.argv.slice(2))
if (options.inputDirectory) {
  options.inputs.push(...(await readdir(options.inputDirectory))
    .filter(name => name.endsWith('.bin.ttf')).sort().map(name => join(options.inputDirectory, name)))
}
const artifact = await ingestAdsbHeatmaps({ ...options, timezone: 'Europe/Zurich', splitTracks: options.chunkHours !== undefined })
console.log(`Wrote ${artifact.trackCount ?? artifact.tracks.length} aircraft to ${options.output}`)
