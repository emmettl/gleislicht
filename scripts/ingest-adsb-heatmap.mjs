#!/usr/bin/env node

import { gunzipSync } from 'node:zlib'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

const MAGIC = 0x0e7f7c9d
const CALLSIGN_MARKER = 0x40000000
const NON_ICAO_MARKER = 0x01000000
const DEFAULT_BOUNDS = [5.45, 45.55, 10.75, 48.2]

function parseArguments(argv) {
  const options = {
    inputs: [],
    output: 'public/data/swiss-air-morning.json',
    serviceDate: '2026-09-04',
    utcOffsetHours: 2,
    bounds: DEFAULT_BOUNDS,
    windowStart: 6 * 3600 + 45 * 60,
    windowEnd: 8 * 3600 + 45 * 60,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--input') options.inputs.push(argv[++index])
    else if (argument === '--output') options.output = argv[++index]
    else if (argument === '--service-date') options.serviceDate = argv[++index]
    else if (argument === '--utc-offset') options.utcOffsetHours = Number(argv[++index])
    else if (argument === '--window-start') options.windowStart = parseServiceTime(argv[++index])
    else if (argument === '--window-end') options.windowEnd = parseServiceTime(argv[++index])
    else if (argument === '--bounds') {
      options.bounds = argv[++index].split(',').map(Number)
    } else if (argument === '--help') {
      console.log('Usage: node scripts/ingest-adsb-heatmap.mjs --input 09.bin.ttf ... --window-start 06:45 --window-end 08:45 [--output file]')
      process.exit(0)
    } else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!options.inputs.length) throw new Error('At least one --input heatmap slice is required')
  if (options.bounds.length !== 4 || options.bounds.some(Number.isNaN)) {
    throw new Error('--bounds must be minLon,minLat,maxLon,maxLat')
  }
  if (options.windowStart >= options.windowEnd) {
    throw new Error('--window-start must be earlier than --window-end')
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
    const localSeconds =
      new Date(timestamp).getUTCHours() * 3600 +
      new Date(timestamp).getUTCMinutes() * 60 +
      new Date(timestamp).getUTCSeconds() +
      options.utcOffsetHours * 3600
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
    ])
    records.set(id, record)
  }
}

function transportScaleTrack(record) {
  const samples = record.samples
    .sort((first, second) => first[0] - second[0])
    .filter((sample, index, all) => index === 0 || sample[0] !== all[index - 1][0])
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

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const records = new Map()
  for (const input of options.inputs) {
    const compressed = await readFile(input)
    const buffer = gunzipSync(compressed)
    decodeSlice(buffer, options, records)
    console.log(`Decoded ${basename(input)} (${(compressed.length / 1_048_576).toFixed(1)} MiB)`)
  }
  const tracks = [...records.values()]
    .map(transportScaleTrack)
    .filter(Boolean)
    .sort((first, second) => first.id.localeCompare(second.id))
  const artifact = {
    metadata: {
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
    },
    bounds: {
      minLongitude: options.bounds[0],
      minLatitude: options.bounds[1],
      maxLongitude: options.bounds[2],
      maxLatitude: options.bounds[3],
    },
    tracks,
  }
  await writeFile(options.output, `${JSON.stringify(artifact)}\n`)
  console.log(`Wrote ${tracks.length} aircraft and ${tracks.reduce((sum, track) => sum + track.samples.length, 0)} samples to ${options.output}`)
}

await main()
