import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { A1_ZURICH_SITE_FILTERS } from './astra-road-study-config.mjs'
import { pullMeasuredData } from './astra-measured-data.mjs'
import { RECORDING_OUTPUTS, cantonalSiteReferences, scopedRecordedSnapshot, validateRecordingScope } from './astra-recording-scopes.mjs'

const argumentsList = process.argv.slice(2)
const watch = argumentsList.includes('--watch')
const keepRaw = argumentsList.includes('--raw')
const scopeArgument = argumentsList.find((argument) =>
  argument.startsWith('--scope='),
)
const scope = validateRecordingScope(scopeArgument?.slice('--scope='.length) ?? 'a1-zurich')
const catalogPath = resolve(argumentsList.find((argument) => argument.startsWith('--catalog='))?.slice('--catalog='.length) ?? 'data/zurich-cantonal-road-counters.json')
const topologyArgument = argumentsList.find((argument) =>
  argument.startsWith('--topology='),
)
const topologyPath = resolve(
  topologyArgument?.slice('--topology='.length) ??
    'public/data/swiss-road-topology.json',
)
const outputArgument = argumentsList.find((argument) =>
  argument.startsWith('--output='),
)
const outputDirectory = resolve(
  outputArgument?.slice('--output='.length) ??
    RECORDING_OUTPUTS[scope],
)
const apiKey = process.env.ASTRA_API_KEY?.trim()
const help = argumentsList.includes('--help')

function safeTimestamp(value) {
  return value.replaceAll(':', '-').replaceAll('.', '-')
}

async function writeSnapshot() {
  const catalog = scope === 'zurich-cantonal' ? JSON.parse(await readFile(catalogPath, 'utf8')) : undefined
  const siteReferences =
    scope === 'national'
      ? await nationalSiteReferences(topologyPath)
      : scope === 'zurich-cantonal' ? cantonalSiteReferences(catalog) : A1_ZURICH_SITE_FILTERS
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const { xml, snapshot } = await pullMeasuredData({
      apiKey,
      siteReferences,
      signal: controller.signal,
    })
    const recordedSnapshot = scopedRecordedSnapshot(snapshot, scope, siteReferences, catalog)
    const measurementTimes = recordedSnapshot.measurements.map(
      ({ measurementTime }) => measurementTime,
    )
    const newestMeasurementTime = measurementTimes.sort().at(-1)
    const fileStem = safeTimestamp(newestMeasurementTime)
    await mkdir(outputDirectory, { recursive: true, mode: 0o700 })
    await chmod(outputDirectory, 0o700)
    try {
      await writeFile(
        resolve(outputDirectory, `${fileStem}.json`),
        `${JSON.stringify(recordedSnapshot)}\n`,
        { flag: 'wx', mode: 0o600 },
      )
      if (keepRaw) {
        await writeFile(resolve(outputDirectory, `${fileStem}.xml`), xml, {
          flag: 'wx',
          mode: 0o600,
        })
      }
      console.log(
        `Recorded ${snapshot.measurements.length} detector measurements for ${newestMeasurementTime}`,
      )
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      console.log(`Already recorded ${newestMeasurementTime}; leaving it unchanged`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function nationalSiteReferences(path) {
  const topology = JSON.parse(await readFile(path, 'utf8'))
  const accepted = new Set(
    topology.sites
      .filter(
        ({ match }) =>
          match.confidence === 'high' ||
          match.confidence === 'continuity' ||
          match.confidence === 'authoritative',
      )
      .map(({ stationId }) => `${stationId}/#`),
  )
  if (!accepted.size) {
    throw new Error('National topology contains no accepted ASTRA sites')
  }
  return [...accepted].sort()
}

function millisecondsUntilNextPublication() {
  const now = Date.now()
  const nextMinute = Math.floor(now / 60_000 + 1) * 60_000
  return nextMinute + 24_000 - now
}

async function main() {
  if (help) {
    console.log(
      'Usage: ASTRA_API_KEY=... npm run data:road:record -- [--scope=a1-zurich|national|zurich-cantonal] [--catalog=data/zurich-cantonal-road-counters.json] [--watch] [--raw] [--topology=public/data/swiss-road-topology.json] [--output=recordings/astra]',
    )
    return
  }
  if (!apiKey) {
    throw new Error(
      'Set ASTRA_API_KEY in the process environment before recording traffic.',
    )
  }

  await writeSnapshot()
  while (watch) {
    const delay = millisecondsUntilNextPublication()
    console.log(`Next pull in ${Math.ceil(delay / 1000)} seconds`)
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delay))
    try {
      await writeSnapshot()
    } catch (error) {
      console.error(`ASTRA pull failed: ${error instanceof Error ? error.message : error}`)
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  await main()
}
