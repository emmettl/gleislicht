#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const RAIL_LED_MODES = ['tube', 'elizabeth-line', 'overground', 'dlr', 'tram']

const DEFAULT_OUTPUT = 'fixtures/tfl/all-change-rail-led-catalogue.json'
const HIERARCHY_SAMPLES = [
  ['oxford-circus', '940GZZLUOXC'],
  ['bank-dlr', '940GZZDLBNK'],
  ['abbey-wood', '910GABWDXR'],
]

function argument(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : argv[index + 1]
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function apiUrl(path) {
  const url = new URL(path, 'https://api.tfl.gov.uk')
  if (process.env.TFL_API_KEY) url.searchParams.set('app_key', process.env.TFL_API_KEY)
  return url
}

async function fetchJson(path) {
  const url = apiUrl(path)
  const response = await fetch(url, {
    headers: { 'user-agent': 'Motion Studies data compiler (offline research)' },
  })
  if (!response.ok) throw new Error(`TfL request failed (${response.status}) for ${url.origin}${url.pathname}`)
  return response.json()
}

export function summariseRouteSequence(routeSequence) {
  const branches = routeSequence.orderedLineRoutes ?? []
  return {
    direction: routeSequence.direction,
    stationCount: routeSequence.stations?.length ?? 0,
    sourceSha256: sha256(routeSequence),
    branches: branches.map((branch, index) => ({
      name: branch.name.replaceAll('&harr;', '↔').replaceAll(/\s+/g, ' ').trim(),
      serviceType: branch.serviceType,
      stopIds: branch.naptanIds,
      geometrySha256: sha256(routeSequence.lineStrings?.[index] ?? null),
    })),
  }
}

export function summariseStopHierarchy(label, requestedId, stopPoint) {
  const children = stopPoint.children ?? []
  const childTypeCounts = children.reduce((counts, { stopType }) => {
    const type = stopType ?? 'Unknown'
    counts[type] = (counts[type] ?? 0) + 1
    return counts
  }, {})
  return {
    label,
    requestedId,
    resolvedId: stopPoint.id,
    name: stopPoint.commonName,
    type: stopPoint.stopType,
    childTypeCounts,
    children: children.map((child) => ({
      id: child.id,
      name: child.commonName,
      type: child.stopType,
      platformName: child.platformName ?? null,
      indicator: child.indicator ?? null,
    })),
    sourceSha256: sha256(stopPoint),
  }
}

async function inBatches(items, size, task) {
  const results = []
  for (let index = 0; index < items.length; index += size) {
    results.push(...await Promise.all(items.slice(index, index + size).map(task)))
  }
  return results
}

export async function buildRailLedCatalogue({ retrievedAt = new Date().toISOString() } = {}) {
  const linesPath = `/Line/Mode/${RAIL_LED_MODES.join(',')}`
  const lines = await fetchJson(linesPath)
  const topology = await inBatches(lines, 4, async (line) => {
    const directions = await Promise.all(['outbound', 'inbound'].map(async (direction) => {
      const routeSequence = await fetchJson(`/Line/${encodeURIComponent(line.id)}/Route/Sequence/${direction}`)
      return summariseRouteSequence(routeSequence)
    }))
    return {
      id: line.id,
      name: line.name,
      mode: line.modeName,
      directions,
    }
  })
  const hierarchies = await Promise.all(HIERARCHY_SAMPLES.map(async ([label, stopId]) =>
    summariseStopHierarchy(label, stopId, await fetchJson(`/StopPoint/${stopId}`))))

  return {
    metadata: {
      publisher: 'Transport for London',
      retrievedAt,
      sourceUrl: `https://api.tfl.gov.uk${linesPath}`,
      sourceSha256: sha256(lines),
      license: 'Transport for London Data Service terms and conditions',
      licenseUrl: 'https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service',
      model: 'Rail-led line, branch and NaPTAN hierarchy catalogue / not a movement study',
      note: 'Topology for every currently advertised TfL tube, Elizabeth line, London Overground, DLR and tram line. Stop hierarchy samples prove interchange, access-area and platform structure without claiming complete platform naming.',
    },
    modes: RAIL_LED_MODES,
    lines: topology,
    stopHierarchySamples: hierarchies,
    movementProofs: [
      { mode: 'tube', status: 'compiled', lines: ['bakerloo', 'northern'], fixtures: ['all-change-bakerloo-morning.json', 'all-change-northern-morden-morning.json'] },
      { mode: 'dlr', status: 'compiled', lines: ['dlr'], fixtures: ['all-change-dlr-bank-morning.json'] },
      { mode: 'tram', status: 'compiled', lines: ['tram'], fixtures: ['all-change-tram-beckenham-morning.json'] },
      { mode: 'elizabeth-line', status: 'compiled-from-pdf', lines: ['elizabeth'], fixtures: ['all-change-elizabeth-morning.json'], note: 'The Unified API timetable probe from Abbey Wood returned no timetable endpoint; the official current public timetable PDF supplies the bounded movement proof.' },
      { mode: 'overground', status: 'compiled-from-pdf', lines: ['lioness'], fixtures: ['all-change-lioness-morning.json'], note: 'The Unified API timetable probe from Stratford on Mildmay returned no timetable endpoint; the official current Lioness public timetable PDF supplies the bounded movement proof. The remaining five Overground lines are catalogued topology only.' },
    ],
  }
}

async function main() {
  const output = argument(process.argv.slice(2), 'output', DEFAULT_OUTPUT)
  const catalogue = await buildRailLedCatalogue({
    retrievedAt: argument(process.argv.slice(2), 'retrieved-at', new Date().toISOString()),
  })
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(catalogue)}\n`)
  const branchCount = catalogue.lines.reduce((total, line) =>
    total + line.directions.reduce((subtotal, direction) => subtotal + direction.branches.length, 0), 0)
  console.log(`Wrote ${output}: ${catalogue.lines.length} lines / ${branchCount} directional branches / ${catalogue.stopHierarchySamples.length} hierarchy samples`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
