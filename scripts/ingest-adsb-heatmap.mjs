#!/usr/bin/env node

import { gunzipSync } from 'node:zlib'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

const MAGIC = 0x0e7f7c9d
const CALLSIGN_MARKER = 0x40000000
const NON_ICAO_MARKER = 0x01000000
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

function decodeCallsign(buffer, offset) {
  return buffer
    .subarray(offset + 8, offset + 16)
    .toString('ascii')
    .replaceAll('\0', '')
    .trim()
    .toUpperCase()
}

function round(value, digits) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function decodeSlice(buffer, options, records) {
  let timestamp
  const callsigns = new Map()
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = options.bounds

  for (let offset = 0; offset + 16 <= buffer.length; offset += 16) {
    const encodedAddress = buffer.readUInt32LE(offset)
    const encodedLatitude = buffer.readInt32LE(offset + 4)
    if (encodedAddress === MAGIC) {
      const high = BigInt(buffer.readInt32LE(offset + 4))
      const low = BigInt(buffer.readUInt32LE(offset + 8))
      timestamp = Number((high << 32n) | low)
      continue
    }
    if (!timestamp || (encodedLatitude & CALLSIGN_MARKER) !== 0) {
      if ((encodedLatitude & CALLSIGN_MARKER) !== 0) {
        callsigns.set(encodedAddress & 0xffffff, decodeCallsign(buffer, offset))
      }
      continue
    }
    if ((encodedAddress & NON_ICAO_MARKER) !== 0) continue

    const longitude = buffer.readInt32LE(offset + 8) / 1_000_000
    const latitude = encodedLatitude / 1_000_000
    if (
      longitude < minLongitude ||
      longitude > maxLongitude ||
      latitude < minLatitude ||
      latitude > maxLatitude
    ) continue

    const encodedAltitude = buffer.readInt16LE(offset + 12)
    const encodedSpeed = buffer.readInt16LE(offset + 14)
    if (encodedAltitude < 0 || encodedSpeed < 0) continue

    const address = encodedAddress & 0xffffff
    const id = address.toString(16).padStart(6, '0')
    const serviceDayStartUtc =
      Date.parse(`${options.serviceDate}T00:00:00Z`) -
      options.utcOffsetHours * 3600 * 1000
    const localSeconds = Math.round((timestamp - serviceDayStartUtc) / 1000)
    if (
      localSeconds < options.windowStart ||
      localSeconds > options.windowEnd
    ) continue
    const record = records.get(id) ?? { id, callsign: '', samples: [] }
    record.callsign = callsigns.get(address) || record.callsign
    record.samples.push([
      localSeconds,
      round(longitude, 5),
      round(latitude, 5),
      encodedAltitude * 25,
      round(encodedSpeed / 10, 1),
      record.callsign,
    ])
    records.set(id, record)
  }
}

function metadataFor(options) {
  return {
    publisher: 'ADSB.lol',
    serviceDate: options.serviceDate,
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
    sourceUrl: `https://github.com/adsblol/globe_history_${options.serviceDate.slice(0, 4)}/releases/tag/v${options.serviceDate.replaceAll('-', '.')}-planes-readsb-prod-0`,
    license: 'ODbL 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    model: 'Observed ADS-B / MLAT heatmap positions replayed at 10-second resolution',
    note: 'Ground, non-ICAO, low-speed and low-altitude signals are excluded; altitude is rendered with explicit vertical compression.',
    sampleIntervalSeconds: 10,
  }
}

function boundsFor(options) {
  return {
    minLongitude: options.bounds[0],
    minLatitude: options.bounds[1],
    maxLongitude: options.bounds[2],
    maxLatitude: options.bounds[3],
  }
}

async function writeChunkedArtifacts(options, tracks) {
  const chunkSeconds = options.chunkHours * 3600
  const chunks = []
  const outputDirectory = dirname(options.output)
  const manifestStem = basename(options.output, '.json').replace(/-manifest$/, '')
  const overlapBefore = 180
  const overlapAfter = 45

  for (
    let windowStart = options.windowStart;
    windowStart < options.windowEnd;
    windowStart += chunkSeconds
  ) {
    const windowEnd = Math.min(options.windowEnd, windowStart + chunkSeconds)
    const id = String(Math.floor(windowStart / chunkSeconds)).padStart(2, '0')
    const path = `${manifestStem}-${id}.json`
    const chunkTracks = tracks
      .map((track) => {
        const samples = track.samples.filter(
          (sample) =>
            sample[0] >= windowStart - overlapBefore &&
            sample[0] <= windowEnd + overlapAfter,
        )
        if (samples.length < 2) return undefined
        return {
          ...track,
          start: samples[0][0],
          end: samples.at(-1)[0],
          samples,
        }
      })
      .filter(Boolean)
    const chunk = { windowStart, windowEnd, tracks: chunkTracks }
    await writeFile(join(outputDirectory, path), `${JSON.stringify(chunk)}\n`)
    const sampleCount = chunkTracks.reduce(
      (sum, track) => sum + track.samples.length,
      0,
    )
    chunks.push({
      id,
      windowStart,
      windowEnd,
      path,
      trackCount: chunkTracks.length,
      sampleCount,
    })
    console.log(`Wrote ${path}: ${chunkTracks.length} aircraft / ${sampleCount} samples`)
  }

  const aircraft = tracks.map((track) => ({
    id: track.id,
    icaoAddress: track.icaoAddress ?? track.id,
    callsign: track.callsign,
    start: track.start,
    end: track.end,
    chunkIds: chunks
      .filter(
        (chunk) => track.end >= chunk.windowStart && track.start <= chunk.windowEnd,
      )
      .map((chunk) => chunk.id),
  }))
  const manifest = {
    metadata: metadataFor(options),
    bounds: boundsFor(options),
    trackCount: tracks.length,
    sampleCount: tracks.reduce((sum, track) => sum + track.samples.length, 0),
    aircraft,
    chunks,
  }
  await writeFile(options.output, `${JSON.stringify(manifest)}\n`)
  console.log(`Wrote ${tracks.length} indexed aircraft and ${chunks.length} chunks to ${options.output}`)
}

function transportScaleTrack(record) {
  const samples = record.samples
    .sort((first, second) => first[0] - second[0])
    .filter((sample, index, all) => index === 0 || sample[0] !== all[index - 1][0])
    .map((sample) => sample.slice(0, 5))
  if (samples.length < 4) return undefined
  const maximumSpeed = Math.max(...samples.map((sample) => sample[4]))
  const maximumAltitude = Math.max(...samples.map((sample) => sample[3]))
  const airlineCallsign = /^[A-Z]{2,4}\d[A-Z0-9]*$/.test(record.callsign)
  if (maximumSpeed < 120 || maximumAltitude < 1_500) return undefined
  if (!airlineCallsign && (maximumSpeed < 250 || maximumAltitude < 10_000)) return undefined
  return {
    id: record.id,
    callsign: record.callsign || record.id.toUpperCase(),
    start: samples[0][0],
    end: samples.at(-1)[0],
    samples,
  }
}

function transportScaleTracks(record) {
  const ordered = record.samples
    .sort((first, second) => first[0] - second[0])
    .filter((sample, index, all) => index === 0 || sample[0] !== all[index - 1][0])
  const segments = []
  let current = []
  let currentCallsign = ''

  for (const sample of ordered) {
    const callsign = sample[5]
    const previous = current.at(-1)
    const callsignChanged = callsign && currentCallsign && callsign !== currentCallsign
    const longGap = previous && sample[0] - previous[0] > 30 * 60
    if (current.length && (callsignChanged || longGap)) {
      segments.push({ callsign: currentCallsign, samples: current })
      current = []
      currentCallsign = ''
    }
    if (callsign) currentCallsign = callsign
    current.push(sample)
  }
  if (current.length) segments.push({ callsign: currentCallsign, samples: current })

  return segments
    .map((segment) => {
      const base = transportScaleTrack({
        id: record.id,
        callsign: segment.callsign || record.callsign,
        samples: segment.samples,
      })
      if (!base) return undefined
      return {
        ...base,
        id: `${record.id}-${base.start}`,
        icaoAddress: record.id,
      }
    })
    .filter(Boolean)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.inputDirectory) {
    const entries = await readdir(options.inputDirectory)
    options.inputs.push(
      ...entries
        .filter((entry) => entry.endsWith('.bin.ttf'))
        .sort()
        .map((entry) => join(options.inputDirectory, entry)),
    )
  }
  if (!options.inputs.length) throw new Error('No heatmap slices were found')
  const records = new Map()
  for (const input of options.inputs) {
    const compressed = await readFile(input)
    const buffer = gunzipSync(compressed)
    decodeSlice(buffer, options, records)
    console.log(`Decoded ${basename(input)} (${(compressed.length / 1_048_576).toFixed(1)} MiB)`)
  }
  const tracks = [...records.values()]
    .flatMap((record) =>
      options.chunkHours
        ? transportScaleTracks(record)
        : [transportScaleTrack(record)].filter(Boolean),
    )
    .sort((first, second) => first.id.localeCompare(second.id))
  if (options.chunkHours) {
    await writeChunkedArtifacts(options, tracks)
    return
  }
  const artifact = {
    metadata: metadataFor(options),
    bounds: boundsFor(options),
    tracks,
  }
  await writeFile(options.output, `${JSON.stringify(artifact)}\n`)
  console.log(`Wrote ${tracks.length} aircraft and ${tracks.reduce((sum, track) => sum + track.samples.length, 0)} samples to ${options.output}`)
}

await main()
