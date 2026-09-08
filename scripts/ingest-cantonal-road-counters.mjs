import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAstraMeasurementSites } from './ingest-national-road-topology.mjs'

export const CANTONAL_CATALOG_PATH = 'data/zurich-cantonal-road-counters.json'
export const MEASUREMENT_SITE_SOURCE = 'https://data.opentransportdata.swiss/en/dataset/trafficcounters'

export function buildCantonalCounterCatalog(xml, { sourceUrl = MEASUREMENT_SITE_SOURCE } = {}) {
  const { metadata, records, groups } = parseAstraMeasurementSites(xml, { suppliers: ['ZH.CH'] })
  if (!Number.isInteger(metadata.tableVersion) || !Number.isFinite(Date.parse(metadata.publicationTime))) {
    throw new Error('Measurement Site Table needs a version and publication time')
  }
  if (!records.length) throw new Error('Measurement Site Table contains no ZH.CH counters')
  const seen = new Set()
  const stations = new Map()
  for (const record of records) {
    if (!/^ZH\.CH:[\w-]+[./]\d+$/.test(record.id)) {
      throw new Error(`Unsupported Zürich detector ID: ${record.id}`)
    }
    if (seen.has(record.id)) throw new Error(`Repeated detector: ${record.id}`)
    seen.add(record.id)
    const station = stations.get(record.stationId) ?? { id: record.stationId, detectorIds: [] }
    station.detectorIds.push(record.id)
    stations.set(record.stationId, station)
  }
  const detectors = records.map((record) => {
    const issues = []
    if (!['positive', 'negative'].includes(record.direction)) issues.push('missing-direction')
    if (record.lane === 'emergencyLane') issues.push('emergency-lane')
    const validCoordinate = Number.isFinite(record.longitude) && Number.isFinite(record.latitude) &&
      record.longitude >= 5 && record.longitude <= 11 && record.latitude >= 45 && record.latitude <= 49
    if (!validCoordinate) issues.push('invalid-coordinate')
    return {
      id: record.id,
      stationId: record.stationId,
      coordinate: validCoordinate ? [record.longitude, record.latitude] : null,
      direction: record.direction ?? null,
      lane: record.lane ?? null,
      carriageway: record.carriageway ?? null,
      alertCLocationCode: record.alertCLocationCode ?? null,
      issues,
    }
  }).sort((a, b) => a.id.localeCompare(b.id))
  return {
    metadata: {
      schemaVersion: 1,
      recordingScope: 'zurich-cantonal',
      supplier: 'ZH.CH',
      publisher: 'Tiefbauamt Kanton Zürich',
      sourceUrl,
      sourceSha256: createHash('sha256').update(xml).digest('hex'),
      measurementSiteTableVersion: metadata.tableVersion,
      publicationTime: metadata.publicationTime,
      geometryStatus: 'unmatched',
      note: 'Counter inventory, not road topology or live availability. Source coordinates are coarse. Direction codes refer to Alert-C and do not establish road-path orientation.',
      coverage: {
        stations: stations.size,
        detectors: records.length,
        usableDirectionalGroups: groups.length,
        detectorsWithoutDirection: detectors.filter(({ issues }) => issues.includes('missing-direction')).length,
        detectorsWithInvalidCoordinate: detectors.filter(({ issues }) => issues.includes('invalid-coordinate')).length,
        emergencyLaneDetectors: detectors.filter(({ issues }) => issues.includes('emergency-lane')).length,
      },
    },
    stations: [...stations.values()].map((station) => ({ ...station, detectorIds: station.detectorIds.sort() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    detectors,
    directionalGroups: groups.map(({ lv95: _lv95, ...group }) => group),
  }
}

async function main() {
  const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3)
  if (process.argv.includes('--help')) {
    console.log('Usage: npm run data:road:catalog:cantonal -- --measurement-sites=/path/table.xml [--source-url=https://...] [--output=data/zurich-cantonal-road-counters.json]')
    return
  }
  const input = argument('measurement-sites')
  if (!input) throw new Error('--measurement-sites is required')
  const catalog = buildCantonalCounterCatalog(await readFile(resolve(input), 'utf8'), { sourceUrl: argument('source-url') })
  const output = resolve(argument('output') ?? CANTONAL_CATALOG_PATH)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`)
  console.log(JSON.stringify(catalog.metadata.coverage, null, 2))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
