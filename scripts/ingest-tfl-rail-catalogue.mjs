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
    if (index + size < items.length) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 400))
    }
  }
  return results
}

export async function buildRailLedCatalogue({ retrievedAt = new Date().toISOString() } = {}) {
  const linesPath = `/Line/Mode/${RAIL_LED_MODES.join(',')}`
  const lines = await fetchJson(linesPath)
  const topology = await inBatches(lines, 2, async (line) => {
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
      { mode: 'tube', status: 'compiled-all-lines-bidirectional', lines: topology.filter(({ mode }) => mode === 'tube').map(({ id }) => id), fixtures: ['all-change-unified-morning.json'] },
      { mode: 'dlr', status: 'compiled-all-lines-bidirectional', lines: ['dlr'], fixtures: ['all-change-unified-morning.json'] },
      { mode: 'tram', status: 'compiled-all-lines-bidirectional', lines: ['tram'], fixtures: ['all-change-unified-morning.json'] },
      { mode: 'elizabeth-line', status: 'compiled-bidirectional-bounded', lines: ['elizabeth'], fixtures: ['all-change-elizabeth-morning.json', 'all-change-elizabeth-eastbound-morning.json'], note: 'The Unified API has no timetable endpoint for this mode; the official current public timetable PDF supplies bounded movement studies in both directions.' },
      { mode: 'overground', status: 'compiled-bidirectional-bounded', lines: ['lioness'], fixtures: ['all-change-lioness-morning.json', 'all-change-lioness-northbound-morning.json'], note: 'The Unified API has no timetable endpoint for this mode; the official current Lioness PDF supplies bounded movement studies in both directions. The remaining five Overground lines are catalogued topology only.' },
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
