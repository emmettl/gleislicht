import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { A1_ZURICH_SITE_FILTERS } from './astra-road-study-config.mjs'
import { pullMeasuredData } from './astra-measured-data.mjs'

const argumentsList = process.argv.slice(2)
const watch = argumentsList.includes('--watch')
const keepRaw = argumentsList.includes('--raw')
const outputArgument = argumentsList.find((argument) =>
  argument.startsWith('--output='),
)
const outputDirectory = resolve(
  outputArgument?.slice('--output='.length) ?? 'recordings/astra',
)
const apiKey = process.env.ASTRA_API_KEY?.trim()
const help = argumentsList.includes('--help')

function safeTimestamp(value) {
  return value.replaceAll(':', '-').replaceAll('.', '-')
}

async function writeSnapshot() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const { xml, snapshot } = await pullMeasuredData({
      apiKey,
      siteReferences: A1_ZURICH_SITE_FILTERS,
      signal: controller.signal,
    })
    const measurementTimes = snapshot.measurements.map(
      ({ measurementTime }) => measurementTime,
    )
    const newestMeasurementTime = measurementTimes.sort().at(-1)
    const fileStem = safeTimestamp(newestMeasurementTime)
    await mkdir(outputDirectory, { recursive: true })
    try {
      await writeFile(
        resolve(outputDirectory, `${fileStem}.json`),
        `${JSON.stringify(snapshot)}\n`,
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

function millisecondsUntilNextPublication() {
  const now = Date.now()
  const nextMinute = Math.floor(now / 60_000 + 1) * 60_000
  return nextMinute + 24_000 - now
}

if (help) {
  console.log(
    'Usage: ASTRA_API_KEY=... npm run data:road:record -- [--watch] [--raw] [--output=recordings/astra]',
  )
} else {
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
