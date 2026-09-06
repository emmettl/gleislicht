import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_INPUT = 'recordings/london-operations'
const DEFAULT_MANIFEST = 'public/data/all-change-operations-day-manifest.json'
const DEFAULT_CHUNK_DIRECTORY = 'public/data/all-change-operations-day-chunks'

function argument(name) {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

export function londonDateAndTime(isoTimestamp) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function compileOperationsDay(
  snapshots,
  {
    serviceDate,
    minimumSamples = 1_200,
    chunkHours = 2,
    chunkPathPrefix = 'all-change-operations-day-chunks',
  } = {},
) {
  if (!serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    throw new Error('A valid --date=YYYY-MM-DD is required')
  }
  const byMinute = new Map()
  for (const snapshot of snapshots) {
    if (snapshot?.metadata?.kind !== 'observed-operations') continue
    const local = londonDateAndTime(snapshot.metadata.scheduledAt)
    if (local.date !== serviceDate) continue
    byMinute.set(snapshot.metadata.scheduledAt, { snapshot, local })
  }
  const records = [...byMinute.values()].sort((left, right) =>
    left.snapshot.metadata.scheduledAt.localeCompare(
      right.snapshot.metadata.scheduledAt,
    ),
  )
  if (records.length < minimumSamples) {
    throw new Error(
      `London operations day has ${records.length} unique minutes; ${minimumSamples} required`,
    )
  }

  let longestGapSeconds = 0
  for (let index = 1; index < records.length; index += 1) {
    longestGapSeconds = Math.max(
      longestGapSeconds,
      Math.round(
        (Date.parse(records[index].snapshot.metadata.scheduledAt) -
          Date.parse(records[index - 1].snapshot.metadata.scheduledAt)) /
          1_000,
      ),
    )
  }
  const lineIds = [
    ...new Set(
      records.flatMap(({ snapshot }) => snapshot.metadata.lineIds ?? []),
    ),
  ].sort()
  const chunkSeconds = chunkHours * 3_600
  const chunks = []
  for (let windowStart = 0; windowStart < 86_400; windowStart += chunkSeconds) {
    const windowEnd = Math.min(86_400, windowStart + chunkSeconds)
    const frames = records
      .filter(({ local }) => local.seconds >= windowStart && local.seconds < windowEnd)
      .map(({ snapshot, local }) => ({
        time: local.seconds,
        observedAt: snapshot.metadata.collectedAt,
        vehicles: snapshot.vehicles,
        lineStatuses: snapshot.lineStatuses,
      }))
    if (!frames.length) continue
    const id = `${String(windowStart / 3_600).padStart(2, '0')}-${String(windowEnd / 3_600).padStart(2, '0')}`
    const artifact = { windowStart, windowEnd, frames }
    const json = `${JSON.stringify(artifact)}\n`
    chunks.push({
      descriptor: {
        id,
        windowStart,
        windowEnd,
        path: `${chunkPathPrefix}/${id}.json`,
        frameCount: frames.length,
        bytes: Buffer.byteLength(json),
        sha256: sha256(json),
      },
      artifact,
      json,
    })
  }

  const first = records[0].snapshot
  return {
    manifest: {
      metadata: {
        kind: 'observed-operations-day',
        publisher: first.metadata.publisher,
        serviceDate,
        timezone: 'Europe/London',
        sourceUrl: first.metadata.sourceUrl,
        model:
          'Recorded TfL arrival predictions projected between matched stops on static route geometry',
        note:
          'Prediction-derived historical replay; positions are interpolated between predicted stop calls and are not GPS.',
        sampleIntervalSeconds: 60,
        completeMinutes: records.length,
        longestGapSeconds,
        lineIds,
      },
      chunks: chunks.map(({ descriptor }) => descriptor),
    },
    chunks,
  }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: npm run data:london:operations:compile -- --date=YYYY-MM-DD [--input=recordings/london-operations] [--manifest=public/data/all-change-operations-day-manifest.json] [--chunks=public/data/all-change-operations-day-chunks] [--minimum-samples=1200]',
    )
    return
  }
  const serviceDate = argument('date')
  const input = resolve(argument('input') ?? DEFAULT_INPUT)
  const manifestPath = resolve(argument('manifest') ?? DEFAULT_MANIFEST)
  const chunkDirectory = resolve(argument('chunks') ?? DEFAULT_CHUNK_DIRECTORY)
  const minimumSamples = Number(argument('minimum-samples') ?? 1_200)
  const filenames = (await readdir(input))
    .filter((filename) => filename.endsWith('.json'))
    .sort()
  const snapshots = await Promise.all(
    filenames.map(async (filename) =>
      JSON.parse(await readFile(resolve(input, filename), 'utf8')),
    ),
  )
  const result = compileOperationsDay(snapshots, {
    serviceDate,
    minimumSamples,
    chunkPathPrefix: argument('chunk-path-prefix') ??
      'all-change-operations-day-chunks',
  })
  await mkdir(dirname(manifestPath), { recursive: true })
  await mkdir(chunkDirectory, { recursive: true })
  await Promise.all([
    writeFile(manifestPath, `${JSON.stringify(result.manifest)}\n`),
    ...result.chunks.map(({ descriptor, json }) =>
      writeFile(resolve(chunkDirectory, `${descriptor.id}.json`), json),
    ),
  ])
  console.log(
    `Compiled ${result.manifest.metadata.completeMinutes} London operations minutes into ${result.chunks.length} progressive chunks`,
  )
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
