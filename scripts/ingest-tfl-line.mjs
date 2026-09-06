#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_WINDOW_START = 6 * 3600 + 45 * 60
const DEFAULT_WINDOW_END = 8 * 3600 + 45 * 60
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
    schedule: argument(argv, 'schedule'),
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
  const timetablePath = `/Line/${encodeURIComponent(options.line)}/Timetable/${encodeURIComponent(options.origin)}?direction=${encodeURIComponent(options.direction)}`
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

export function linePoints(routeSequence, lineStringIndex = 0) {
  const encoded = routeSequence.lineStrings?.[lineStringIndex]
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

export function pathsBetweenStops(points, stops) {
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

export function boundsFor(stops) {
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

export function cleanStationName(name) {
  return name.replace(
    / (?:Underground Station|DLR Station|Rail Station|Tram Stop|London Overground Station|Pier)$/,
    '',
  )
}

export function sourceSha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function compileTflLineProof({
  routeSequence,
  timetable,
  serviceDate,
  scheduleName,
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

  const selectedRoutes = (timetable.timetable?.routes ?? [])
    .map((route, routeIndex) => ({
      route,
      routeIndex,
      schedule: selectSchedule(route.schedules ?? [], serviceDate, scheduleName),
    }))
    .filter(({ schedule }) => schedule)
  if (!selectedRoutes.length) {
    throw new Error(`TfL timetable has no suitable ${scheduleName ?? 'weekday'} schedule`)
  }
  const routeStops = [
    ...(routeSequence.stations ?? []),
    ...(routeSequence.stopPointSequences ?? []).flatMap(({ stopPoint }) => stopPoint ?? []),
  ]
  const referencedStopIds = new Set([
    timetable.timetable.departureStopId,
    ...selectedRoutes.flatMap(({ route }) =>
      route.stationIntervals.flatMap(({ intervals }) => intervals.map(({ stopId }) => stopId))),
  ])
  const stopCatalogue = [...(timetable.stops ?? []), ...routeStops]
    .filter((stop, index, stops) => stop?.id && stops.findIndex(({ id }) => id === stop.id) === index)
  const departureStop = stopCatalogue.find(({ id }) => id === timetable.timetable.departureStopId)
  const sourceStops = [departureStop, ...stopCatalogue]
    .filter((stop, index, stops) => stop?.id && referencedStopIds.has(stop.id) && stops.findIndex(({ id }) => id === stop.id) === index)
  if (sourceStops.length < 2) throw new Error('TfL timetable has too few stops')

  const stopIndexById = new Map(sourceStops.map((stop, index) => [stop.id, index]))
  const stopById = new Map(sourceStops.map((stop) => [stop.id, stop]))
  const compactStops = sourceStops.map((stop) => [
    Number(stop.lon),
    Number(stop.lat),
    cleanStationName(stop.name),
    '',
    stop.id,
  ])
  const paths = []
  const edges = []
  const edgePaths = []
  const pathIndexByBranchSegment = new Map()
  const pathSegmentsByIntervalId = new Map()
  const unmatchedBranchPatterns = new Set()
  const trains = []
  for (const { route, routeIndex, schedule } of selectedRoutes) {
    const intervalById = new Map(
      route.stationIntervals.map((stationInterval) => [
        String(stationInterval.id),
        stationInterval.intervals,
      ]),
    )
    for (const [journeyIndex, journey] of schedule.knownJourneys.entries()) {
      const departure = secondsForJourney(journey)
      const intervals = intervalById.get(String(journey.intervalId))
      if (!intervals?.length) continue
      const groupedIntervals = collapseDwellIntervals(intervals)
      const destination = groupedIntervals.at(-1)
      const end = departure + Math.round(destination.arrivalMinutes * 60)
      if (end < windowStart || departure > windowEnd) continue

      const journeyStopIds = [timetable.timetable.departureStopId, ...groupedIntervals.map(({ stopId }) => stopId)]
      const intervalKey = `${routeIndex}:${journey.intervalId}`
      let branch
      try {
        branch = matchBranch(routeSequence, journeyStopIds)
      } catch (error) {
        if (!error.message.includes('has no matching route sequence')) throw error
        unmatchedBranchPatterns.add(intervalKey)
        continue
      }
      let pathSegments = pathSegmentsByIntervalId.get(intervalKey)
      if (!pathSegments) {
        const branchStops = journeyStopIds.map((stopId) => {
          const stop = stopById.get(stopId)
          if (!stop) throw new Error(`TfL branch references unknown stop ${stopId}`)
          return stop
        })
        const branchPaths = pathsBetweenStops(linePoints(routeSequence, branch.lineStringIndex), branchStops)
        pathSegments = branchPaths.map((path, index) => {
          const from = stopIndexById.get(journeyStopIds[index])
          const to = stopIndexById.get(journeyStopIds[index + 1])
          if (from === undefined || to === undefined) throw new Error('TfL branch stop is missing from the stop catalogue')
          const segmentKey = `${branch.lineStringIndex}:${from}:${to}`
          const existingPathIndex = pathIndexByBranchSegment.get(segmentKey)
          if (existingPathIndex !== undefined) return existingPathIndex
          const pathIndex = paths.length
          paths.push(path)
          edges.push([from, to])
          edgePaths.push(pathIndex)
          pathIndexByBranchSegment.set(segmentKey, pathIndex)
          return pathIndex
        })
        pathSegmentsByIntervalId.set(intervalKey, pathSegments)
      }

      const departureStopIndex = stopIndexById.get(timetable.timetable.departureStopId)
      if (departureStopIndex === undefined) throw new Error('TfL departure stop is missing from the stop catalogue')
      const trainStops = [[departureStopIndex, departure, departure]]
      for (const interval of groupedIntervals) {
        const stopIndex = stopIndexById.get(interval.stopId)
        if (stopIndex === undefined) {
          throw new Error(`TfL interval references unknown stop ${interval.stopId}`)
        }
        const arrival = departure + Math.round(interval.arrivalMinutes * 60)
        const stopDeparture = departure + Math.round(interval.departureMinutes * 60)
        trainStops.push([stopIndex, arrival, stopDeparture])
      }
      const destinationStop = sourceStops[trainStops.at(-1)[0]]
      trains.push({
        id: `${routeSequence.lineId}:${routeSequence.direction}:${timetable.timetable.departureStopId}:${departure}:${routeIndex}:${journeyIndex}`,
        route: routeSequence.lineName,
        headsign: cleanStationName(destinationStop.name),
        shortName: routeSequence.lineName,
        category: categoryForMode(routeSequence.mode),
        mode: routeSequence.mode ?? 'tube',
        start: departure,
        end,
        stops: trainStops,
        pathSegments,
      })
    }
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
      note: `${[...new Set(selectedRoutes.map(({ schedule }) => schedule.name))].join(' / ')} departures from ${cleanStationName(stopById.get(timetable.timetable.departureStopId).name)} across ${pathSegmentsByIntervalId.size} branch pattern${pathSegmentsByIntervalId.size === 1 ? '' : 's'}; a bounded adapter proof for Motion Studies 006, not a complete London service-day claim.`,
      modes: [routeSequence.mode ?? 'tube'],
      geometry: {
        publisher: 'Transport for London',
        feedVersion: `tfl-unified-api:${retrievedAt.slice(0, 10)}`,
        sourceUrl: routeUrl,
        sourceSha256: sourceSha256(routeSequence),
        model: 'TfL route-sequence line string split at nearest monotonic NaPTAN stops',
        matchedSegments: paths.length,
        totalSegments: paths.length,
        unmatchedBranchPatterns: unmatchedBranchPatterns.size,
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

function scheduleScore(name, weekday) {
  const normalised = name.toLowerCase()
  const weekdayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][weekday]
  if (normalised === weekdayName) return 100
  if (weekday >= 1 && weekday <= 5 && /monday\s*(?:-|to)\s*friday/.test(normalised)) return 90
  if (weekday >= 1 && weekday <= 4 && /monday\s*(?:-|to)\s*thursday/.test(normalised)) return 85
  if (weekday === 6 && /saturday/.test(normalised)) return 80
  if (weekday === 0 && /sunday/.test(normalised)) return 80
  if (weekday >= 1 && weekday <= 5 && /weekday/.test(normalised)) return 70
  return 0
}

function selectSchedule(schedules, serviceDate, requestedName) {
  if (requestedName) return schedules.find(({ name }) => name === requestedName)
  const weekday = new Date(`${serviceDate}T12:00:00Z`).getUTCDay()
  const ranked = schedules
    .map((schedule) => ({ schedule, score: scheduleScore(schedule.name, weekday) }))
    .sort((first, second) => second.score - first.score)
  return ranked[0]?.score > 0 ? ranked[0].schedule : undefined
}

function collapseDwellIntervals(intervals) {
  const collapsed = []
  for (const interval of intervals) {
    const minutes = Number(interval.timeToArrival)
    const previous = collapsed.at(-1)
    if (previous?.stopId === interval.stopId) {
      previous.departureMinutes = Math.max(previous.departureMinutes, minutes)
    } else {
      collapsed.push({
        stopId: interval.stopId,
        arrivalMinutes: minutes,
        departureMinutes: minutes,
      })
    }
  }
  return collapsed
}

function matchBranch(routeSequence, journeyStopIds) {
  const branches = routeSequence.orderedLineRoutes ?? []
  const exactIndex = branches.findIndex(({ naptanIds }) =>
    naptanIds?.length === journeyStopIds.length &&
    naptanIds.every((stopId, index) => stopId === journeyStopIds[index]))
  if (exactIndex >= 0) return { lineStringIndex: exactIndex, name: branches[exactIndex].name }
  const prefixMatch = branches
    .map((branch, lineStringIndex) => ({ branch, lineStringIndex }))
    .filter(({ branch }) =>
      branch.naptanIds?.length >= journeyStopIds.length &&
      journeyStopIds.every((stopId, index) => stopId === branch.naptanIds[index]))
    .sort((first, second) => first.branch.naptanIds.length - second.branch.naptanIds.length)[0]
  if (prefixMatch) return { lineStringIndex: prefixMatch.lineStringIndex, name: prefixMatch.branch.name }
  const subsequenceMatch = branches
    .map((branch, lineStringIndex) => ({ branch, lineStringIndex }))
    .filter(({ branch }) => {
      let journeyIndex = 0
      for (const stopId of branch.naptanIds ?? []) {
        if (stopId === journeyStopIds[journeyIndex]) journeyIndex += 1
        if (journeyIndex === journeyStopIds.length) return true
      }
      return false
    })
    .sort((first, second) => first.branch.naptanIds.length - second.branch.naptanIds.length)[0]
  if (subsequenceMatch) {
    return { lineStringIndex: subsequenceMatch.lineStringIndex, name: subsequenceMatch.branch.name }
  }
  if (routeSequence.lineStrings?.length === 1) return { lineStringIndex: 0, name: routeSequence.lineName }
  throw new Error(`TfL timetable branch ${journeyStopIds[0]} → ${journeyStopIds.at(-1)} has no matching route sequence`)
}

function categoryForMode(mode) {
  if (mode === 'tram') return 'tram'
  if (mode === 'river-bus') return 'ferry'
  if (mode === 'cable-car') return 'cableway'
  if (mode === 'elizabeth-line' || mode === 'overground') return 'rail'
  return 'metro'
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
