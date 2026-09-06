#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileTflLineProof } from './ingest-tfl-line.mjs'
import { mergeNetworkSnapshots } from './merge-network-snapshots.mjs'

const SERVICE_DATE = '2026-09-04'
const RETRIEVED_AT = '2026-09-06T18:55:00.000Z'
const OUTPUT = 'fixtures/tfl/all-change-bus-day.json'

const SERVICES = [
  {
    line: '26',
    direction: 'outbound',
    origin: '490008264S',
    scheduleName: 'Friday',
  },
  {
    line: '26',
    direction: 'inbound',
    origin: '490000248H',
    scheduleName: 'Friday',
  },
  {
    line: 'n26',
    direction: 'outbound',
    origin: '490000248H',
    scheduleName: 'Mo-Th Nights/Tu-Fr Morning',
    timeOffsetSeconds: -24 * 3600,
  },
  {
    line: 'n26',
    direction: 'inbound',
    origin: '490001063C',
    scheduleName: 'Mo-Th Nights/Tu-Fr Morning',
    timeOffsetSeconds: -24 * 3600,
  },
]

function apiUrl(path) {
  const url = new URL(path, 'https://api.tfl.gov.uk')
  if (process.env.TFL_API_KEY) url.searchParams.set('app_key', process.env.TFL_API_KEY)
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

export async function compileBusStudy({
  serviceDate = SERVICE_DATE,
  retrievedAt = RETRIEVED_AT,
} = {}) {
  const snapshots = []
  for (const {
    line,
    direction,
    origin,
    scheduleName,
    timeOffsetSeconds = 0,
  } of SERVICES) {
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
    snapshots.push(
      compileTflLineProof({
        routeSequence,
        timetable,
        serviceDate,
        scheduleName,
        timeOffsetSeconds,
        windowStart: 0,
        windowEnd: 24 * 3600,
        retrievedAt,
        routeUrl: routeUrl.origin + routeUrl.pathname,
        timetableUrl: timetableUrl.origin + timetableUrl.pathname,
      }),
    )
  }

  const merged = mergeNetworkSnapshots(snapshots, {
    retrievedAt,
    note:
      'A separately loaded Friday street study: route 26 between Victoria and Hackney Wick plus the N26 service visible during the early-Friday night window. Positions are recurring timetable interpolation along TfL route geometry, not observed bus telemetry.',
  })
  const feedVersion = `all-change-bus:${retrievedAt.slice(0, 10)}`
  return {
    ...merged,
    metadata: {
      ...merged.metadata,
      feedVersion,
      model: 'Composite TfL recurring bus timetable interpolation / not realtime',
      geometry: {
        ...merged.metadata.geometry,
        feedVersion,
        model: 'Deduplicated TfL bus route-sequence paths from component directions',
      },
    },
  }
}

async function main() {
  const outputIndex = process.argv.indexOf('--output')
  const output =
    outputIndex >= 0 && process.argv[outputIndex + 1]
      ? process.argv[outputIndex + 1]
      : OUTPUT
  const snapshot = await compileBusStudy()
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(snapshot)}\n`)
  console.log(
    `Wrote ${output}: ${snapshot.trains.length} journeys / ${snapshot.stops.length} stops / ${snapshot.paths.length} paths`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
