#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_WINDOW_START = 6 * 3600 + 45 * 60
const DEFAULT_WINDOW_END = 8 * 3600 + 45 * 60
const DEFAULT_SCHEDULE = 'Monday - Friday'

function argument(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : argv[index + 1]
}

export function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) throw new Error(`Invalid clock time: ${value}`)
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) {
    throw new Error(`Invalid clock time: ${value}`)
  }
  return hours * 3600 + minutes * 60
}

function parseArguments(argv) {
  if (argv.includes('--help')) {
    console.log(
      'Usage: node scripts/ingest-tfl-line.mjs --line bakerloo --direction outbound --origin 940GZZLUEAC --service-date 2026-09-04 --output fixtures/tfl/all-change-bakerloo-morning.json [--route-sequence file --timetable file] [--window-start 06:45 --window-end 08:45]',
    )
    process.exit(0)
  }

  const options = {
    line: argument(argv, 'line'),
    direction: argument(argv, 'direction', 'outbound'),
    origin: argument(argv, 'origin'),
    serviceDate: argument(argv, 'service-date'),
    schedule: argument(argv, 'schedule', DEFAULT_SCHEDULE),
    output: argument(argv, 'output'),
    routeSequencePath: argument(argv, 'route-sequence'),
    timetablePath: argument(argv, 'timetable'),
    retrievedAt: argument(argv, 'retrieved-at', new Date().toISOString()),
    windowStart: parseClock(argument(argv, 'window-start', '06:45')),
    windowEnd: parseClock(argument(argv, 'window-end', '08:45')),
  }

  for (const required of ['line', 'origin', 'serviceDate', 'output']) {
    if (!options[required]) throw new Error(`Missing --${required.replaceAll(/([A-Z])/g, '-$1').toLowerCase()}`)
  }
  if (options.windowStart >= options.windowEnd) {
    throw new Error('--window-start must be earlier than --window-end')
  }
  if (Boolean(options.routeSequencePath) !== Boolean(options.timetablePath)) {
    throw new Error('--route-sequence and --timetable must be supplied together')
  }
  return options
}

function apiUrl(path, apiKey) {
  const url = new URL(path, 'https://api.tfl.gov.uk')
  if (apiKey) url.searchParams.set('app_key', apiKey)
  return url
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Motion Studies data compiler (offline research)' },
  })
  if (!response.ok) {
    throw new Error(`TfL request failed (${response.status}) for ${url.origin}${url.pathname}`)
  }
  return response.json()
}

async function loadSources(options) {
  const routePath = `/Line/${encodeURIComponent(options.line)}/Route/Sequence/${encodeURIComponent(options.direction)}`
  const timetablePath = `/Line/${encodeURIComponent(options.line)}/Timetable/${encodeURIComponent(options.origin)}`
  const routeUrl = apiUrl(routePath, process.env.TFL_API_KEY)
  const timetableUrl = apiUrl(timetablePath, process.env.TFL_API_KEY)

  if (options.routeSequencePath) {
    return {
      routeSequence: JSON.parse(await readFile(options.routeSequencePath, 'utf8')),
      timetable: JSON.parse(await readFile(options.timetablePath, 'utf8')),
      routeUrl: routeUrl.origin + routeUrl.pathname,
      timetableUrl: timetableUrl.origin + timetableUrl.pathname,
    }
  }

  const [routeSequence, timetable] = await Promise.all([
    fetchJson(routeUrl),
    fetchJson(timetableUrl),
  ])
  return {
    routeSequence,
    timetable,
    routeUrl: routeUrl.origin + routeUrl.pathname,
    timetableUrl: timetableUrl.origin + timetableUrl.pathname,
  }
}

function linePoints(routeSequence) {
  const encoded = routeSequence.lineStrings?.[0]
  if (!encoded) throw new Error('TfL route sequence has no line string')
  const decoded = JSON.parse(encoded)
  let points = decoded
  while (Array.isArray(points) && points.length === 1 && Array.isArray(points[0])) {
    points = points[0]
  }
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error('TfL route sequence line string is malformed')
  }
  return points.map((point) => {
    if (!Array.isArray(point) || point.length < 2) {
      throw new Error('TfL route sequence contains a malformed point')
    }
    return [Number(point[0]), Number(point[1])]
  })
}

function distanceSquared(first, second) {
  const longitudeScale = Math.cos(((first[1] + second[1]) * Math.PI) / 360)
  const longitude = (first[0] - second[0]) * longitudeScale
  const latitude = first[1] - second[1]
  return longitude * longitude + latitude * latitude
}

function nearestMonotonicIndexes(points, stops) {
  const indexes = []
  let searchStart = 0
  for (const stop of stops) {
    const target = [stop.lon, stop.lat]
    let bestIndex = searchStart
    let bestDistance = Number.POSITIVE_INFINITY
    for (let index = searchStart; index < points.length; index += 1) {
      const distance = distanceSquared(points[index], target)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    }
    indexes.push(bestIndex)
    searchStart = bestIndex
  }
  return indexes
}

function pathsBetweenStops(points, stops) {
  const indexes = nearestMonotonicIndexes(points, stops)
  return stops.slice(0, -1).map((stop, index) => {
    const next = stops[index + 1]
    const path = points.slice(indexes[index], indexes[index + 1] + 1)
    const from = [stop.lon, stop.lat]
    const to = [next.lon, next.lat]
    if (!path.length || distanceSquared(path[0], from) > 1e-12) path.unshift(from)
    if (distanceSquared(path.at(-1), to) > 1e-12) path.push(to)
    return path
  })
}

function secondsForJourney(journey) {
  return Number(journey.hour) * 3600 + Number(journey.minute) * 60
}

function boundsFor(stops) {
  return stops.reduce(
    (bounds, stop) => ({
      minLongitude: Math.min(bounds.minLongitude, stop.lon),
      minLatitude: Math.min(bounds.minLatitude, stop.lat),
      maxLongitude: Math.max(bounds.maxLongitude, stop.lon),
      maxLatitude: Math.max(bounds.maxLatitude, stop.lat),
    }),
    {
      minLongitude: Number.POSITIVE_INFINITY,
      minLatitude: Number.POSITIVE_INFINITY,
      maxLongitude: Number.NEGATIVE_INFINITY,
      maxLatitude: Number.NEGATIVE_INFINITY,
    },
  )
}

function cleanStationName(name) {
  return name.replace(/ Underground Station$/, '')
}

function sourceSha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function compileTflLineProof({
  routeSequence,
  timetable,
  serviceDate,
  scheduleName = DEFAULT_SCHEDULE,
  windowStart = DEFAULT_WINDOW_START,
  windowEnd = DEFAULT_WINDOW_END,
  retrievedAt,
  routeUrl,
  timetableUrl,
}) {
  if (routeSequence.lineId !== timetable.lineId) {
    throw new Error('TfL route and timetable line IDs disagree')
  }
  if (routeSequence.direction !== timetable.direction) {
    throw new Error('TfL route and timetable directions disagree')
  }

  const route = timetable.timetable?.routes?.[0]
  const schedule = route?.schedules?.find(({ name }) => name === scheduleName)
  if (!route || !schedule) {
    throw new Error(`TfL timetable has no ${scheduleName} schedule`)
  }
  const sourceStops = timetable.stops ?? []
  if (sourceStops.length < 2) throw new Error('TfL timetable has too few stops')
  if (sourceStops[0].id !== timetable.timetable.departureStopId) {
    throw new Error('TfL timetable stops do not begin at the departure stop')
  }

  const stopIndexById = new Map(sourceStops.map((stop, index) => [stop.id, index]))
  const compactStops = sourceStops.map((stop) => [
    Number(stop.lon),
    Number(stop.lat),
    cleanStationName(stop.name),
    '',
    stop.id,
  ])
  const paths = pathsBetweenStops(linePoints(routeSequence), sourceStops)
  const edges = sourceStops.slice(0, -1).map((_, index) => [index, index + 1])
  const edgePaths = paths.map((_, index) => index)
  const intervalById = new Map(
    route.stationIntervals.map((stationInterval) => [
      String(stationInterval.id),
      stationInterval.intervals,
    ]),
  )

  const trains = []
  for (const [journeyIndex, journey] of schedule.knownJourneys.entries()) {
    const departure = secondsForJourney(journey)
    const intervals = intervalById.get(String(journey.intervalId))
    if (!intervals?.length) continue
    const destination = intervals.at(-1)
    const end = departure + Math.round(destination.timeToArrival * 60)
    if (end < windowStart || departure > windowEnd) continue

    const trainStops = [[0, departure, departure]]
    for (const interval of intervals) {
      const stopIndex = stopIndexById.get(interval.stopId)
      if (stopIndex === undefined) {
        throw new Error(`TfL interval references unknown stop ${interval.stopId}`)
      }
      const arrival = departure + Math.round(interval.timeToArrival * 60)
      trainStops.push([stopIndex, arrival, arrival])
    }
    const destinationStop = sourceStops[trainStops.at(-1)[0]]
    trains.push({
      id: `${routeSequence.lineId}:${routeSequence.direction}:${departure}:${journeyIndex}`,
      route: routeSequence.lineName,
      headsign: cleanStationName(destinationStop.name),
      shortName: routeSequence.lineName,
      category: 'metro',
      mode: routeSequence.mode ?? 'tube',
      start: departure,
      end,
      stops: trainStops,
      pathSegments: trainStops.slice(1).map((_, index) => index),
    })
  }
  if (!trains.length) throw new Error('TfL timetable produced no journeys in the study window')

  return {
    metadata: {
      publisher: 'Transport for London',
      feedVersion: `tfl-unified-api:${retrievedAt.slice(0, 10)}`,
      serviceDate,
      windowStart,
      windowEnd,
      focusTime: Math.round((windowStart + windowEnd) / 2),
      sourceUrl: timetableUrl,
      sourceSha256: sourceSha256(timetable),
      retrievedAt,
      license: 'Transport for London Data Service terms and conditions',
      licenseUrl: 'https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service',
      model: 'TfL recurring weekday timetable interpolation / not realtime',
      note: `${scheduleName} departures from ${cleanStationName(sourceStops[0].name)}; a bounded adapter proof for Motion Studies 006, not a complete London service-day claim.`,
      modes: [routeSequence.mode ?? 'tube'],
      geometry: {
        publisher: 'Transport for London',
        feedVersion: `tfl-unified-api:${retrievedAt.slice(0, 10)}`,
        sourceUrl: routeUrl,
        sourceSha256: sourceSha256(routeSequence),
        model: 'TfL route-sequence line string split at nearest monotonic NaPTAN stops',
        matchedSegments: paths.length,
        totalSegments: paths.length,
      },
    },
    bounds: boundsFor(sourceStops),
    stops: compactStops,
    edges,
    paths,
    edgePaths,
    trains,
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const sources = await loadSources(options)
  const snapshot = compileTflLineProof({
    ...sources,
    serviceDate: options.serviceDate,
    scheduleName: options.schedule,
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
    retrievedAt: options.retrievedAt,
  })
  await mkdir(dirname(resolve(options.output)), { recursive: true })
  await writeFile(resolve(options.output), `${JSON.stringify(snapshot)}\n`)
  console.log(
    `Wrote ${options.output}: ${snapshot.trains.length} ${snapshot.metadata.modes[0]} journeys / ${snapshot.stops.length} stops / ${snapshot.paths.length} matched segments`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
