#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileTflLineProof, parseClock } from './ingest-tfl-line.mjs'
import { mergeNetworkSnapshots } from './merge-network-snapshots.mjs'

const DEFAULT_MODES = ['tube', 'dlr', 'tram']

function argument(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : argv[index + 1]
}

function apiUrl(path) {
  const url = new URL(path, 'https://api.tfl.gov.uk')
  if (process.env.TFL_API_KEY) url.searchParams.set('app_key', process.env.TFL_API_KEY)
  return url
}

async function fetchJson(path) {
  const url = apiUrl(path)
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'user-agent': 'Motion Studies data compiler (offline research)' },
    })
    if (response.ok) return response.json()
    if (response.status !== 429 || attempt === 6) {
      throw new Error(`TfL request failed (${response.status}) for ${url.origin}${url.pathname}`)
    }
    const retryAfter = Number(response.headers.get('retry-after'))
    await new Promise((resolveDelay) => setTimeout(
      resolveDelay,
      Number.isFinite(retryAfter) ? retryAfter * 1000 : attempt * 1500,
    ))
  }
  throw new Error(`TfL request exhausted retries for ${url.origin}${url.pathname}`)
}

export function planUnifiedApiCoverage(catalogue, modes = DEFAULT_MODES) {
  const selectedModes = new Set(modes)
  return catalogue.lines
    .filter(({ mode }) => selectedModes.has(mode))
    .flatMap((line) => line.directions.flatMap((direction) => {
      const origins = [...new Set(direction.branches.map(({ stopIds }) => stopIds[0]).filter(Boolean))]
      return origins.map((origin) => ({
        lineId: line.id,
        lineName: line.name,
        mode: line.mode,
        direction: direction.direction,
        origin,
        branchCount: direction.branches.filter(({ stopIds }) => stopIds[0] === origin).length,
      }))
    }))
}

async function inBatches(items, size, task, pauseMs = 0) {
  const results = []
  for (let index = 0; index < items.length; index += size) {
    results.push(...await Promise.all(items.slice(index, index + size).map(task)))
    if (pauseMs > 0 && index + size < items.length) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, pauseMs))
    }
  }
  return results
}

export async function compileUnifiedApiLattice({
  catalogue,
  serviceDate,
  retrievedAt = new Date().toISOString(),
  windowStart = parseClock('06:45'),
  windowEnd = parseClock('08:45'),
  modes = DEFAULT_MODES,
  loadJson = fetchJson,
  batchSize = 2,
  pauseMs = 400,
}) {
  const coveragePlan = planUnifiedApiCoverage(catalogue, modes)
  if (!coveragePlan.length) throw new Error('TfL catalogue produced no movement coverage tasks')

  const routeSequences = new Map()
  const routeKeys = [...new Set(coveragePlan.map(({ lineId, direction }) => `${lineId}:${direction}`))]
  await inBatches(routeKeys, batchSize, async (key) => {
    const [lineId, direction] = key.split(':')
    routeSequences.set(key, await loadJson(`/Line/${encodeURIComponent(lineId)}/Route/Sequence/${direction}`))
  }, pauseMs)

  const results = await inBatches(coveragePlan, batchSize, async (task) => {
    const routePath = `/Line/${encodeURIComponent(task.lineId)}/Route/Sequence/${task.direction}`
    const timetablePath = `/Line/${encodeURIComponent(task.lineId)}/Timetable/${encodeURIComponent(task.origin)}?direction=${encodeURIComponent(task.direction)}`
    try {
      const timetable = await loadJson(timetablePath)
      const snapshot = compileTflLineProof({
        routeSequence: routeSequences.get(`${task.lineId}:${task.direction}`),
        timetable,
        serviceDate,
        windowStart,
        windowEnd,
        retrievedAt,
        routeUrl: `${apiUrl(routePath).origin}${apiUrl(routePath).pathname}`,
        timetableUrl: `${apiUrl(timetablePath).origin}${apiUrl(timetablePath).pathname}`,
      })
      return { task, snapshot }
    } catch (error) {
      if (error.message.includes('has no suitable weekday schedule') ||
        error.message.includes('produced no journeys in the study window')) {
        return { task, inactiveReason: error.message }
      }
      throw new Error(`${task.lineName} ${task.direction} from ${task.origin}: ${error.message}`, { cause: error })
    }
  }, pauseMs)
  const snapshots = results.flatMap(({ snapshot }) => snapshot ? [snapshot] : [])
  const inactiveOrigins = results.flatMap(({ task, inactiveReason }) => inactiveReason
    ? [{ lineId: task.lineId, direction: task.direction, origin: task.origin, reason: inactiveReason }]
    : [])
  if (!snapshots.length) throw new Error('TfL coverage plan produced no active movement snapshots')

  const merged = mergeNetworkSnapshots(snapshots, {
    retrievedAt,
    note: `Every advertised ${modes.join(', ')} line compiled from each directional branch origin in the catalogue for the shared morning window. Short turns remain distinct through their source interval and path identities. Elizabeth line and London Overground are compiled separately from public timetable PDFs.`,
  })
  const trainIds = new Set()
  for (const train of merged.trains) {
    if (trainIds.has(train.id)) throw new Error(`Duplicate movement identity ${train.id}`)
    trainIds.add(train.id)
  }
  merged.metadata.coverage = {
    status: inactiveOrigins.length
      ? 'audited-with-inactive-origins'
      : 'complete-for-unified-api-modes',
    modes,
    lineCount: new Set(coveragePlan.map(({ lineId }) => lineId)).size,
    directionCount: new Set(coveragePlan.map(({ lineId, direction }) => `${lineId}:${direction}`)).size,
    originCount: coveragePlan.length,
    activeOriginCount: snapshots.length,
    inactiveOrigins,
    advertisedBranchCount: coveragePlan.reduce((total, { branchCount }) => total + branchCount, 0),
    compiledSnapshotCount: snapshots.length,
  }
  return merged
}

async function main() {
  const argv = process.argv.slice(2)
  const cataloguePath = argument(argv, 'catalogue', 'fixtures/tfl/all-change-rail-led-catalogue.json')
  const output = argument(argv, 'output', 'fixtures/tfl/all-change-unified-morning.json')
  const serviceDate = argument(argv, 'service-date', '2026-09-04')
  const modes = argument(argv, 'modes', DEFAULT_MODES.join(',')).split(',').filter(Boolean)
  const lattice = await compileUnifiedApiLattice({
    catalogue: JSON.parse(await readFile(resolve(cataloguePath), 'utf8')),
    serviceDate,
    retrievedAt: argument(argv, 'retrieved-at', new Date().toISOString()),
    windowStart: parseClock(argument(argv, 'window-start', '06:45')),
    windowEnd: parseClock(argument(argv, 'window-end', '08:45')),
    modes,
    batchSize: Number(argument(argv, 'batch-size', '2')),
    pauseMs: Number(argument(argv, 'pause-ms', '400')),
  })
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(lattice)}\n`)
  console.log(
    `Wrote ${output}: ${lattice.trains.length} journeys / ${lattice.stops.length} stops / ${lattice.paths.length} paths / ${lattice.metadata.coverage.lineCount} lines / ${lattice.metadata.coverage.directionCount} directions`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
