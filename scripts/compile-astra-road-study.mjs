import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  A1_ZURICH_DIRECTIONS,
  A1_ZURICH_PATH,
} from './astra-road-study-config.mjs'

const DEFAULT_INPUT = 'recordings/astra'
const DEFAULT_OUTPUT = 'public/data/swiss-road-recorded.json'
const MINIMUM_DIRECTION_COVERAGE = 0.6
const MAXIMUM_MINUTE_GAP_SECONDS = 75

function median(values) {
  if (!values.length) return undefined
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function aggregateVehicleClass(measurements, flowKey, speedKey) {
  const usable = measurements.filter(
    (measurement) =>
      Number.isFinite(measurement[flowKey]) &&
      measurement[flowKey] >= 0 &&
      Number.isFinite(measurement[speedKey]) &&
      measurement[speedKey] >= 0,
  )
  if (!usable.length) return undefined
  const flow = usable.reduce((sum, measurement) => sum + measurement[flowKey], 0)
  const weightedSpeed = usable.reduce(
    (sum, measurement) => sum + measurement[speedKey] * measurement[flowKey],
    0,
  )
  return {
    flow,
    speed:
      flow > 0
        ? weightedSpeed / flow
        : usable.reduce((sum, measurement) => sum + measurement[speedKey], 0) /
          usable.length,
  }
}

export function aggregateDirection(measurements, detectorGroups) {
  const byId = new Map(measurements.map((measurement) => [measurement.siteId, measurement]))
  const sites = detectorGroups.flatMap((detectorIds) => {
    const lanes = detectorIds.flatMap((id) => {
      const measurement = byId.get(id)
      return measurement ? [measurement] : []
    })
    const light = aggregateVehicleClass(lanes, 'lightFlowPerHour', 'lightSpeedKmh')
    const heavy = aggregateVehicleClass(lanes, 'heavyFlowPerHour', 'heavySpeedKmh')
    return light && heavy ? [{ light, heavy }] : []
  })
  const coverage = sites.length / detectorGroups.length
  if (coverage < MINIMUM_DIRECTION_COVERAGE) return { coverage }
  return {
    coverage,
    lightFlowPerHour: median(sites.map(({ light }) => light.flow)),
    lightSpeedKmh: median(sites.map(({ light }) => light.speed)),
    heavyFlowPerHour: median(sites.map(({ heavy }) => heavy.flow)),
    heavySpeedKmh: median(sites.map(({ heavy }) => heavy.speed)),
  }
}

export function swissDateAndTime(isoTimestamp) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(isoTimestamp))
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {})
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    seconds:
      Number(parts.hour) * 3_600 + Number(parts.minute) * 60 + Number(parts.second),
  }
}

function rounded(value) {
  return Math.round(value * 10) / 10
}

export function compileRoadStudy(
  snapshots,
  { serviceDate, minimumSamples = 60 } = {},
) {
  const minuteRecords = new Map()
  const tableVersions = new Set()
  for (const snapshot of snapshots) {
    if (snapshot?.metadata?.measurementKind !== 'recorded') continue
    tableVersions.add(snapshot.metadata.measurementSiteTableVersion)
    for (const measurement of snapshot.measurements ?? []) {
      const { date } = swissDateAndTime(measurement.measurementTime)
      if (serviceDate && date !== serviceDate) continue
      const entry = minuteRecords.get(measurement.measurementTime) ?? []
      entry.push(measurement)
      minuteRecords.set(measurement.measurementTime, entry)
    }
  }

  const records = [...minuteRecords.entries()]
    .map(([measurementTime, measurements]) => {
      const local = swissDateAndTime(measurementTime)
      return {
        measurementTime,
        local,
        directions: A1_ZURICH_DIRECTIONS.map((direction) => ({
          direction,
          conditions: aggregateDirection(measurements, direction.detectorGroups),
        })),
      }
    })
    .filter(({ directions }) =>
      directions.every(({ conditions }) =>
        Number.isFinite(conditions.lightFlowPerHour),
      ),
    )
    .sort((left, right) => left.measurementTime.localeCompare(right.measurementTime))

  if (!records.length) throw new Error('No complete ASTRA minutes were found')
  if (
    tableVersions.size !== 1 ||
    !Number.isInteger([...tableVersions][0])
  ) {
    throw new Error('Recorded study must use one valid Measurement Site Table version')
  }
  const tableVersion = [...tableVersions][0]
  const dates = new Set(records.map(({ local }) => local.date))
  if (dates.size !== 1) {
    throw new Error('Recorded study must contain one Europe/Zurich service date')
  }
  for (let index = 1; index < records.length; index += 1) {
    const gap =
      (Date.parse(records[index].measurementTime) -
        Date.parse(records[index - 1].measurementTime)) /
      1_000
    if (gap > MAXIMUM_MINUTE_GAP_SECONDS) {
      throw new Error(
        `Recorded study is not continuous (${Math.round(gap)} second gap after ${records[index - 1].measurementTime})`,
      )
    }
  }
  if (records.length < minimumSamples) {
    throw new Error(
      `Recorded study has ${records.length} complete minutes; ${minimumSamples} required`,
    )
  }

  const resolvedServiceDate = records[0].local.date
  const coverages = records.flatMap(({ directions }) =>
    directions.map(({ conditions }) => conditions.coverage),
  )
  return {
    metadata: {
      publisher: 'Federal Roads Office (ASTRA / FEDRO)',
      serviceDate: resolvedServiceDate,
      windowStart: records[0].local.seconds,
      windowEnd: records.at(-1).local.seconds,
      sourceUrl:
        'https://opentransportdata.swiss/en/cookbook/road-traffic-cookbook/rt-road-traffic-counters/',
      measurementSiteUrl:
        'https://data.opentransportdata.swiss/en/dataset/trafficcounters',
      measurementSiteTableVersion: tableVersion,
      measurementKind: 'recorded',
      model: 'Traffic-flow reconstruction / no vehicle tracking',
      note:
        'Flow and speed are recorded ASTRA one-minute aggregates. Rendered particles are a synthetic reconstruction, not tracked vehicles.',
      sampleIntervalSeconds: 60,
      visualSampleRate: 0.055,
      recording: {
        firstMeasurementTime: records[0].measurementTime,
        lastMeasurementTime: records.at(-1).measurementTime,
        completeMinutes: records.length,
        minimumDirectionCoverage: rounded(Math.min(...coverages)),
      },
    },
    corridors: [
      {
        id: 'a1-zurich',
        name: 'A1 Zürich · Winterthur ↔ Aargau',
        road: 'A1',
        distanceKm: 41.8,
        path: A1_ZURICH_PATH,
        directions: A1_ZURICH_DIRECTIONS.map((direction, directionIndex) => ({
          id: direction.id,
          label: direction.label,
          reverse: direction.reverse,
          detectorIds: direction.detectorGroups.flat(),
          samples: records.map(({ local, directions }) => {
            const conditions = directions[directionIndex].conditions
            return [
              local.seconds,
              rounded(conditions.lightFlowPerHour),
              rounded(conditions.lightSpeedKmh),
              rounded(conditions.heavyFlowPerHour),
              rounded(conditions.heavySpeedKmh),
            ]
          }),
        })),
      },
    ],
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
      'Usage: npm run data:road:compile -- [--input=recordings/astra] [--output=public/data/swiss-road-recorded.json] [--date=YYYY-MM-DD] [--minimum-samples=60]',
    )
    return
  }
  const input = resolve(argumentValue('input') ?? DEFAULT_INPUT)
  const output = resolve(argumentValue('output') ?? DEFAULT_OUTPUT)
  const minimumSamples = Number(argumentValue('minimum-samples') ?? 60)
  const filenames = (await readdir(input))
    .filter((filename) => filename.endsWith('.json'))
    .sort()
  const snapshots = await Promise.all(
    filenames.map(async (filename) =>
      JSON.parse(await readFile(resolve(input, filename), 'utf8')),
    ),
  )
  const artifact = compileRoadStudy(snapshots, {
    serviceDate: argumentValue('date'),
    minimumSamples,
  })
  await writeFile(output, `${JSON.stringify(artifact)}\n`)
  console.log(
    `Wrote ${output} (${artifact.metadata.recording.completeMinutes} measured minutes, minimum directional coverage ${Math.round(artifact.metadata.recording.minimumDirectionCoverage * 100)}%)`,
  )
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  await main()
}
