import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { gunzipSync } from 'node:zlib'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_BUCKET = 'gleislicht-observations'
const DEFAULT_OUTPUT = 'recordings/london-operations'

function argument(name) {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function dateString(date) {
  return date.toISOString().slice(0, 10)
}

export function adjacentUtcPartitions(serviceDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    throw new Error('--date must use YYYY-MM-DD')
  }
  const midday = Date.parse(`${serviceDate}T12:00:00Z`)
  if (!Number.isFinite(midday)) throw new Error('--date is not a valid date')
  return [-1, 0, 1].map((offset) =>
    dateString(new Date(midday + offset * 86_400_000)),
  )
}

export function previousLondonDate(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const midday = Date.parse(`${today}T12:00:00Z`)
  return dateString(new Date(midday - 86_400_000))
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function client() {
  const accountId = requiredEnvironment('CLOUDFLARE_ACCOUNT_ID')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: requiredEnvironment('R2_ACCESS_KEY_ID'),
      secretAccessKey: requiredEnvironment('R2_SECRET_ACCESS_KEY'),
    },
  })
}

async function keysForPrefix(s3, bucket, prefix) {
  const keys = []
  let continuationToken
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )
    keys.push(...(page.Contents ?? []).flatMap(({ Key }) => (Key ? [Key] : [])))
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (continuationToken)
  return keys
}

function decodedJson(bytes) {
  const compressed = bytes[0] === 0x1f && bytes[1] === 0x8b
  const body = compressed ? gunzipSync(bytes) : bytes
  return JSON.parse(Buffer.from(body).toString('utf8'))
}

async function download(s3, bucket, key, outputDirectory) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!response.Body) throw new Error(`R2 returned an empty body for ${key}`)
  const bytes = Buffer.from(await response.Body.transformToByteArray())
  const snapshot = decodedJson(bytes)
  const filename = basename(key).replace(/\.json\.gz$/, '.json')
  await writeFile(resolve(outputDirectory, filename), `${JSON.stringify(snapshot)}\n`, {
    mode: 0o600,
  })
}

async function inBatches(values, size, task) {
  for (let index = 0; index < values.length; index += size) {
    await Promise.all(values.slice(index, index + size).map(task))
  }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: npm run data:london:operations:export -- [--date=YYYY-MM-DD] [--bucket=gleislicht-observations] [--output=recordings/london-operations]',
    )
    return
  }
  const serviceDate = argument('date') ?? previousLondonDate()
  const bucket = argument('bucket') ?? DEFAULT_BUCKET
  const outputDirectory = resolve(argument('output') ?? DEFAULT_OUTPUT)
  const s3 = client()
  const keys = (
    await Promise.all(
      adjacentUtcPartitions(serviceDate).map((date) =>
        keysForPrefix(s3, bucket, `london/tfl-operations/${date}/`),
      ),
    )
  )
    .flat()
    .filter((key) => key.endsWith('.json.gz'))
    .sort()

  if (!keys.length) {
    throw new Error(`No London operations recordings found around ${serviceDate}`)
  }
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 })
  await chmod(outputDirectory, 0o700)
  await inBatches(keys, 12, (key) => download(s3, bucket, key, outputDirectory))
  console.log(
    `Exported ${keys.length} R2 snapshots around London service date ${serviceDate} to ${outputDirectory}`,
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
