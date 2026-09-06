#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import {
  boundsFor,
  cleanStationName,
  linePoints,
  parseClock,
  pathsBetweenStops,
  sourceSha256,
} from './ingest-tfl-line.mjs'

const execFileAsync = promisify(execFile)
const DEFAULT_WINDOW_START = parseClock('06:45')
const DEFAULT_WINDOW_END = parseClock('08:45')

function argument(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : argv[index + 1]
}

function requiredArgument(argv, name) {
  const value = argument(argv, name)
  if (!value) throw new Error(`Missing --${name}`)
  return value
}

function apiUrl(path) {
  const url = new URL(path, 'https://api.tfl.gov.uk')
  if (process.env.TFL_API_KEY) url.searchParams.set('app_key', process.env.TFL_API_KEY)
  return url
}

export async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Motion Studies data compiler (offline research)' },
  })
  if (!response.ok) throw new Error(`TfL request failed (${response.status}) for ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

async function fetchJson(url) {
  return JSON.parse((await fetchBytes(url)).toString('utf8'))
}

export async function extractPdfText(pdfBytes, firstPage, lastPage) {
  const directory = await mkdtemp(join(tmpdir(), 'all-change-pdf-'))
  const pdfPath = join(directory, 'timetable.pdf')
  await writeFile(pdfPath, pdfBytes)
  try {
    const { stdout } = await execFileAsync('pdftotext', [
      '-f', String(firstPage),
      '-l', String(lastPage),
      '-layout',
      pdfPath,
      '-',
    ], { maxBuffer: 16 * 1024 * 1024 })
    return stdout
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function normaliseName(value) {
  return value
    .normalize('NFKD')
    .replaceAll(/[’']/g, '')
    .replaceAll('&', 'and')
    .replaceAll(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function stopCatalogue(routeSequence) {
  return [...(routeSequence.stations ?? []), ...(routeSequence.stopPointSequences ?? [])
    .flatMap(({ stopPoint }) => stopPoint ?? [])]
    .filter((stop, index, stops) => stop?.id && stops.findIndex(({ id }) => id === stop.id) === index)
}

function routeBranch(routeSequence, originId, destinationId) {
  const match = (routeSequence.orderedLineRoutes ?? [])
    .map((branch, branchIndex) => {
      const originIndex = branch.naptanIds?.indexOf(originId) ?? -1
      const destinationIndex = branch.naptanIds?.indexOf(destinationId) ?? -1
      return { branch, branchIndex, originIndex, destinationIndex }
    })
    .filter(({ originIndex, destinationIndex }) => originIndex >= 0 && destinationIndex > originIndex)
    .sort((first, second) =>
      (first.destinationIndex - first.originIndex) - (second.destinationIndex - second.originIndex))[0]
  if (!match) throw new Error(`TfL route sequence has no ${originId} → ${destinationId} branch`)
  return {
    branchIndex: match.branchIndex,
    stopIds: match.branch.naptanIds.slice(match.originIndex, match.destinationIndex + 1),
  }
}

function timeFromPdf(value, previous) {
  let seconds = Number(value.slice(0, 2)) * 3600 + Number(value.slice(2)) * 60
  if (previous !== undefined && seconds + 12 * 3600 < previous) seconds += 24 * 3600
  return seconds
}

function stationRows(page, stops) {
  const aliases = stops
    .flatMap((stop) => {
      const label = cleanStationName(stop.name)
      return [
        label,
        label.replace(/^London /, ''),
        label.replace(/ \(London\)$/, ''),
        label.replace(/ \([^)]*\)$/, ''),
        label.replaceAll(/\bStreet\b/g, 'St').replaceAll(/\bRoad\b/g, 'Rd'),
      ].map((candidate) => ({ stop, label: candidate }))
    })
    .sort((first, second) => second.label.length - first.label.length)
  const rows = new Map()
  for (const [lineIndex, line] of page.split('\n').entries()) {
    const trimmed = line.trimStart()
    const normalisedLine = normaliseName(trimmed)
    const plainLine = line.toLowerCase().replaceAll('’', "'")
    const matches = []
    const leadingAlias = aliases.find(({ label }) => normalisedLine.startsWith(normaliseName(label)))
    if (leadingAlias) matches.push({ alias: leadingAlias, start: line.length - trimmed.length })
    for (const alias of aliases) {
      const start = plainLine.indexOf(alias.label.toLowerCase().replaceAll('’', "'"), 1)
      if (start >= 0 && !matches.some((match) => match.alias.stop.id === alias.stop.id && match.start === start)) {
        matches.push({ alias, start })
      }
    }
    matches.sort((first, second) => first.start - second.start || second.alias.label.length - first.alias.label.length)
    const distinctMatches = matches.filter((match, index) =>
      !matches.slice(0, index).some((candidate) => candidate.start === match.start))
    for (const [matchIndex, match] of distinctMatches.entries()) {
      const end = distinctMatches[matchIndex + 1]?.start ?? line.length
      const segment = line.slice(match.start, end)
      const times = [...segment.matchAll(/\b(?:[01]\d|2[0-4])[0-5]\d\b/g)]
        .map((time) => ({ value: time[0], column: match.start + time.index }))
      if (!times.length) continue
      const existing = rows.get(match.alias.stop.id) ?? []
      existing.push({ lineIndex, times })
      rows.set(match.alias.stop.id, existing)
    }
  }
  return rows
}

function timeAtColumn(rowGroups, column, originLineIndex) {
  const nearestRows = rowGroups
    .filter(({ lineIndex }) => lineIndex >= originLineIndex)
    .map(({ lineIndex, times }) => ({
      lineIndex,
      times: times.filter((time) => Math.abs(time.column - column) <= 1),
    }))
    .filter(({ times }) => times.length)
    .sort((first, second) =>
      Math.abs(first.lineIndex - originLineIndex) - Math.abs(second.lineIndex - originLineIndex))
  const candidates = nearestRows[0]?.times ?? []
  if (!candidates.length) return undefined
  return candidates.map(({ value }) => value)
}

export function parsePdfGridJourneys({
  text,
  stops,
  originId,
  destinationId,
  sectionTitle,
  dayPattern = /Monday(?:s)? to (?:Friday|Fridays|Saturday|Saturdays)(?: \(continued\))?/i,
  allowSkippedStops = false,
}) {
  const journeys = []
  const pages = text.split('\f')
  for (const page of pages) {
    if (!page.toLowerCase().includes(sectionTitle.toLowerCase()) || !dayPattern.test(page)) continue
    const rows = stationRows(page, stops)
    const originRows = rows.get(originId)
    if (!originRows) continue
    const originTimes = originRows.flatMap(({ lineIndex, times }) =>
      times.map((time) => ({ ...time, lineIndex })))
    for (const originTime of originTimes) {
      const calls = []
      let previous
      for (const stop of stops) {
        const values = timeAtColumn(rows.get(stop.id) ?? [], originTime.column, originTime.lineIndex)
        if (!values?.length) continue
        const times = values.map((value) => timeFromPdf(value, previous))
        const arrival = Math.min(...times)
        const departure = Math.max(...times)
        if (previous !== undefined && arrival < previous) continue
        calls.push({ stopId: stop.id, arrival, departure })
        previous = departure
      }
      const hasCompleteCallingPattern = calls.length === stops.length
      const hasBoundedCallingPattern = calls.length >= 2 &&
        calls[0]?.stopId === originId && calls.at(-1)?.stopId === destinationId
      if ((!allowSkippedStops && !hasCompleteCallingPattern) || !hasBoundedCallingPattern) continue
      journeys.push({ column: originTime.column, calls })
    }
  }
  return journeys.filter((journey, index, all) =>
    all.findIndex((candidate) => candidate.calls.map(({ stopId, arrival }) => `${stopId}:${arrival}`).join('|') ===
      journey.calls.map(({ stopId, arrival }) => `${stopId}:${arrival}`).join('|')) === index)
}

export function compileTflPdfProof({
  routeSequence,
  pdfText,
  pdfBytes,
  pdfUrl,
  serviceDate,
  originId,
  destinationId,
  sectionTitle,
  retrievedAt,
  routeUrl,
  validFrom,
  validUntil,
  windowStart = DEFAULT_WINDOW_START,
  windowEnd = DEFAULT_WINDOW_END,
  allowSkippedStops = false,
}) {
  const { branchIndex, stopIds } = routeBranch(routeSequence, originId, destinationId)
  const allStops = stopCatalogue(routeSequence)
  const stopById = new Map(allStops.map((stop) => [stop.id, stop]))
  const sourceStops = stopIds.map((stopId) => {
    const stop = stopById.get(stopId)
    if (!stop) throw new Error(`TfL route sequence is missing stop ${stopId}`)
    return stop
  })
  const journeys = parsePdfGridJourneys({
    text: pdfText,
    stops: sourceStops,
    originId,
    destinationId,
    sectionTitle,
    allowSkippedStops,
  }).filter(({ calls }) => calls.at(-1).arrival >= windowStart && calls[0].departure <= windowEnd)
  if (!journeys.length) throw new Error('TfL PDF timetable produced no auditable journeys in the study window')

  const points = linePoints(routeSequence, branchIndex)
  const compactStops = sourceStops.map((stop) => [
    Number(stop.lon),
    Number(stop.lat),
    cleanStationName(stop.name),
    '',
    stop.id,
  ])
  const stopIndexById = new Map(sourceStops.map((stop, index) => [stop.id, index]))
  const paths = []
  const edges = []
  const pathIndexByPair = new Map()
  const trains = journeys.map((journey, index) => {
    const calledStops = journey.calls.map(({ stopId }) => stopById.get(stopId))
    const journeyPaths = pathsBetweenStops(points, calledStops)
    const pathSegments = journeyPaths.map((path, callIndex) => {
      const from = journey.calls[callIndex].stopId
      const to = journey.calls[callIndex + 1].stopId
      const key = `${from}:${to}`
      let pathIndex = pathIndexByPair.get(key)
      if (pathIndex === undefined) {
        pathIndex = paths.length
        pathIndexByPair.set(key, pathIndex)
        paths.push(path)
        edges.push([stopIndexById.get(from), stopIndexById.get(to)])
      }
      return pathIndex
    })
    return {
      id: `${routeSequence.lineId}:pdf:${originId}:${destinationId}:${journey.calls[0].departure}:${index}`,
      route: routeSequence.lineName,
      headsign: cleanStationName(sourceStops.at(-1).name),
      shortName: routeSequence.lineName,
      category: 'regional',
      mode: routeSequence.mode,
      start: journey.calls[0].departure,
      end: journey.calls.at(-1).arrival,
      stops: journey.calls.map(({ stopId, arrival, departure }) => [stopIndexById.get(stopId), arrival, departure]),
      pathSegments,
    }
  })

  return {
    metadata: {
      publisher: 'Transport for London',
      feedVersion: `tfl-public-timetable-pdf:${retrievedAt.slice(0, 10)}`,
      serviceDate,
      windowStart,
      windowEnd,
      focusTime: Math.round((windowStart + windowEnd) / 2),
      sourceUrl: pdfUrl,
      sourceSha256: createHash('sha256').update(pdfBytes).digest('hex'),
      retrievedAt,
      validFrom,
      validUntil,
      license: 'Transport for London Data Service terms and conditions',
      licenseUrl: 'https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service',
      model: 'TfL public timetable PDF grid extraction / not realtime',
      note: `${sectionTitle}, weekday service; ${journeys.length} ${cleanStationName(sourceStops[0].name)} to ${cleanStationName(sourceStops.at(-1).name)} journeys. PDF columns require both endpoints, official route order and monotonic times${allowSkippedStops ? '; documented non-calling stops may be omitted' : '; every branch stop is required'}.`,
      modes: [routeSequence.mode],
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
    edgePaths: paths.map((_, index) => index),
    trains,
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const line = requiredArgument(argv, 'line')
  const direction = requiredArgument(argv, 'direction')
  const originId = requiredArgument(argv, 'origin')
  const destinationId = requiredArgument(argv, 'destination')
  const sectionTitle = requiredArgument(argv, 'section-title')
  const serviceDate = requiredArgument(argv, 'service-date')
  const output = requiredArgument(argv, 'output')
  const firstPage = Number(argument(argv, 'first-page', '1'))
  const lastPage = Number(argument(argv, 'last-page', String(firstPage)))
  const retrievedAt = argument(argv, 'retrieved-at', new Date().toISOString())
  const routeUrl = apiUrl(`/Line/${encodeURIComponent(line)}/Route/Sequence/${encodeURIComponent(direction)}`)
  const pdfUrl = new URL(requiredArgument(argv, 'pdf-url'))
  const routeSequencePath = argument(argv, 'route-sequence')
  const pdfPath = argument(argv, 'pdf')
  const [routeSequence, pdfBytes] = await Promise.all([
    routeSequencePath ? JSON.parse(await readFile(routeSequencePath, 'utf8')) : fetchJson(routeUrl),
    pdfPath ? readFile(pdfPath) : fetchBytes(pdfUrl),
  ])
  const pdfText = await extractPdfText(pdfBytes, firstPage, lastPage)
  const snapshot = compileTflPdfProof({
    routeSequence,
    pdfText,
    pdfBytes,
    pdfUrl: pdfUrl.toString(),
    serviceDate,
    originId,
    destinationId,
    sectionTitle,
    retrievedAt,
    routeUrl: `${routeUrl.origin}${routeUrl.pathname}`,
    validFrom: argument(argv, 'valid-from'),
    validUntil: argument(argv, 'valid-until'),
    windowStart: parseClock(argument(argv, 'window-start', '06:45')),
    windowEnd: parseClock(argument(argv, 'window-end', '08:45')),
    allowSkippedStops: argv.includes('--allow-skip-stops'),
  })
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(snapshot)}\n`)
  console.log(`Wrote ${output}: ${snapshot.trains.length} ${snapshot.metadata.modes[0]} journeys / ${snapshot.stops.length} stops / ${snapshot.paths.length} matched segments`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
