#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileTflLineProof } from './ingest-tfl-line.mjs'
import { mergeNetworkSnapshots } from './merge-network-snapshots.mjs'

const SERVICE_DATE = '2026-09-04'
const RETRIEVED_AT = '2026-09-06T12:00:00.000Z'
const OUTPUT = 'fixtures/tfl/all-change-surface-day.json'

const SERVICES = [
  { line: 'rb1', direction: 'outbound', origin: '930GBSP' },
  { line: 'rb1', direction: 'inbound', origin: '930GBRVS' },
  { line: 'rb4', direction: 'outbound', origin: '930GNEL' },
  { line: 'rb4', direction: 'inbound', origin: '930GCAW' },
  { line: 'rb6', direction: 'outbound', origin: '930GPUT' },
  { line: 'rb6', direction: 'inbound', origin: '930GBRVS' },
  {
    line: 'london-cable-car',
    direction: 'outbound',
    origin: '940GZZALGWP',
  },
  {
    line: 'london-cable-car',
    direction: 'inbound',
    origin: '940GZZALRDK',
  },
]

function apiUrl(path) {
  const url = new URL(path, 'https://api.tfl.gov.uk')
  if (process.env.TFL_API_KEY) {
    url.searchParams.set('app_key', process.env.TFL_API_KEY)
  }
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

export async function compileSurfaceStudy({
  serviceDate = SERVICE_DATE,
  retrievedAt = RETRIEVED_AT,
} = {}) {
  const snapshots = await Promise.all(
    SERVICES.map(async ({ line, direction, origin }) => {
      const routeUrl = apiUrl(
        `/Line/${encodeURIComponent(line)}/Route/Sequence/${direction}`,
      )
      const timetableUrl = apiUrl(
        `/Line/${encodeURIComponent(line)}/Timetable/${encodeURIComponent(origin)}?direction=${direction}`,
      )
      const [routeSequence, timetable] = await Promise.all([
        fetchJson(routeUrl),
        fetchJson(timetableUrl),
      ])
      return compileTflLineProof({
        routeSequence,
        timetable,
        serviceDate,
        windowStart: 0,
        windowEnd: 24 * 3600,
        retrievedAt,
        routeUrl: routeUrl.origin + routeUrl.pathname,
        timetableUrl: timetableUrl.origin + timetableUrl.pathname,
      })
    }),
  )

  return mergeNetworkSnapshots(snapshots, {
    retrievedAt,
    note:
      'A separately loaded Friday surface study: scheduled RB1, RB4 and RB6 river services plus London Cable Car in both directions. Positions are timetable interpolation, not observed craft or cabin telemetry.',
  })
}

async function main() {
  const outputIndex = process.argv.indexOf('--output')
  const output =
    outputIndex >= 0 && process.argv[outputIndex + 1]
      ? process.argv[outputIndex + 1]
      : OUTPUT
  const snapshot = await compileSurfaceStudy()
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(snapshot)}\n`)
  console.log(
    `Wrote ${output}: ${snapshot.trains.length} journeys / ${snapshot.stops.length} stops / ${snapshot.paths.length} paths`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
