import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  aggregateDirection,
  swissDateAndTime,
} from './compile-astra-road-study.mjs'

const DEFAULT_INPUT = 'recordings/astra-national'
const DEFAULT_TOPOLOGY = 'public/data/swiss-road-topology.json'
const DEFAULT_OUTPUT = 'public/data/swiss-road-national-recorded.json'
const MINIMUM_SITE_COVERAGE = 0.6
const MAXIMUM_MINUTE_GAP_SECONDS = 75

function rounded(value) {
  return Math.round(value * 10) / 10
}

function validateRecordedMinutes(records, tableVersions, minimumSamples) {
  if (!records.length) throw new Error('No sufficiently complete ASTRA minutes were found')
  if (tableVersions.size !== 1 || !Number.isInteger([...tableVersions][0])) {
    throw new Error('National study must use one Measurement Site Table version')
  }
  const dates = new Set(records.map(({ date }) => date))
  if (dates.size !== 1) {
    throw new Error('National study must contain one Europe/Zurich service date')
  }
  for (let index = 1; index < records.length; index += 1) {
    const gap =
      (Date.parse(records[index].measurementTime) -
        Date.parse(records[index - 1].measurementTime)) /
      1_000
    if (gap > MAXIMUM_MINUTE_GAP_SECONDS) {
      throw new Error(
        `National study is not continuous (${Math.round(gap)} second gap after ${records[index - 1].measurementTime})`,
      )
    }
  }
  if (records.length < minimumSamples) {
    throw new Error(
      `National study has ${records.length} complete minutes; ${minimumSamples} required`,
    )
  }
}

export function compileNationalRoadStudy(
  snapshots,
  topology,
  { serviceDate, minimumSamples = 60 } = {},
) {
  const acceptedSites = topology.sites.filter(
    ({ match }) =>
      match.confidence === 'high' || match.confidence === 'continuity',
  )
  if (!acceptedSites.length) throw new Error('Topology has no accepted ASTRA sites')
  const siteIndex = new Map(
    acceptedSites.map((site, index) => [site.id, index]),
  )
  const tableVersions = new Set()
  const byMinute = new Map()
  for (const snapshot of snapshots) {
    if (snapshot?.metadata?.measurementKind !== 'recorded') continue
    if (
      snapshot.metadata.recordingScope &&
      snapshot.metadata.recordingScope !== 'national'
    ) {
      continue
    }
    tableVersions.add(snapshot.metadata.measurementSiteTableVersion)
    for (const measurement of snapshot.measurements ?? []) {
      const local = swissDateAndTime(measurement.measurementTime)
      if (serviceDate && local.date !== serviceDate) continue
      const entry = byMinute.get(measurement.measurementTime) ?? []
      entry.push(measurement)
      byMinute.set(measurement.measurementTime, entry)
    }
  }

  const records = [...byMinute.entries()]
    .map(([measurementTime, measurements]) => {
      const local = swissDateAndTime(measurementTime)
      const values = acceptedSites.flatMap((site, index) => {
        const conditions = aggregateDirection(measurements, [site.detectorIds])
        if (!Number.isFinite(conditions.lightFlowPerHour)) return []
        return [
          [
            index,
            rounded(conditions.lightFlowPerHour),
            rounded(conditions.lightSpeedKmh),
            rounded(conditions.heavyFlowPerHour),
            rounded(conditions.heavySpeedKmh),
          ],
        ]
      })
      return {
        measurementTime,
        date: local.date,
        time: local.seconds,
        coverage: values.length / acceptedSites.length,
        values,
      }
    })
    .filter(({ coverage }) => coverage >= MINIMUM_SITE_COVERAGE)
    .sort((left, right) => left.measurementTime.localeCompare(right.measurementTime))

  validateRecordedMinutes(records, tableVersions, minimumSamples)
  const tableVersion = [...tableVersions][0]
  const sections = topology.sections.flatMap((section) => {
    const fromSiteIndex = siteIndex.get(section.fromSiteId)
    const toSiteIndex = siteIndex.get(section.toSiteId)
    return fromSiteIndex === undefined || toSiteIndex === undefined
      ? []
      : [
          {
            id: section.id,
            road: section.road,
            direction: section.direction,
            fromSiteIndex,
            toSiteIndex,
            distanceKm: section.distanceKm,
          },
        ]
  })

  return {
    metadata: {
      publisher: 'Federal Roads Office (ASTRA / FEDRO)',
      serviceDate: records[0].date,
      windowStart: records[0].time,
      windowEnd: records.at(-1).time,
      sourceUrl:
        'https://opentransportdata.swiss/en/cookbook/road-traffic-cookbook/rt-road-traffic-counters/',
      measurementSiteTableVersion: tableVersion,
      measurementKind: 'recorded',
      model: 'Section traffic-flow reconstruction / no vehicle tracking',
      sampleIntervalSeconds: 60,
      acceptedSites: acceptedSites.length,
      sections: sections.length,
      minimumSiteCoverage: rounded(
        Math.min(...records.map(({ coverage }) => coverage)),
      ),
      firstMeasurementTime: records[0].measurementTime,
      lastMeasurementTime: records.at(-1).measurementTime,
      completeMinutes: records.length,
    },
    siteIds: acceptedSites.map(({ id }) => id),
    sections,
    minutes: records.map(({ time, values }) => [time, values]),
  }
}

function argumentValue(name) {
  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: npm run data:road:compile:national -- [--input=recordings/astra-national] [--topology=public/data/swiss-road-topology.json] [--output=public/data/swiss-road-national-recorded.json] [--date=YYYY-MM-DD] [--minimum-samples=60]',
    )
    return
  }
  const input = resolve(argumentValue('input') ?? DEFAULT_INPUT)
  const topologyPath = resolve(argumentValue('topology') ?? DEFAULT_TOPOLOGY)
  const output = resolve(argumentValue('output') ?? DEFAULT_OUTPUT)
  const filenames = (await readdir(input))
    .filter((filename) => filename.endsWith('.json'))
    .sort()
  const snapshots = await Promise.all(
    filenames.map(async (filename) =>
      JSON.parse(await readFile(resolve(input, filename), 'utf8')),
    ),
  )
  const topology = JSON.parse(await readFile(topologyPath, 'utf8'))
  const artifact = compileNationalRoadStudy(snapshots, topology, {
    serviceDate: argumentValue('date'),
    minimumSamples: Number(argumentValue('minimum-samples') ?? 60),
  })
  await writeFile(output, `${JSON.stringify(artifact)}\n`)
  console.log(
    `Wrote ${output}: ${artifact.metadata.completeMinutes} minutes across ${artifact.metadata.acceptedSites} accepted sites and ${artifact.metadata.sections} directional sections`,
  )
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  await main()
}
