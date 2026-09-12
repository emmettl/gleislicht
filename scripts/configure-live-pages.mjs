import { appendFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAXIMUM_HEALTH_AGE_MS = 150_000

function argument(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

export function liveCompatibility(snapshot, health, now = Date.now()) {
  if (health?.status !== 'ok') return { compatible: false, reason: 'worker-not-ready' }
  const generatedAt = Date.parse(health.generatedAt)
  if (
    !Number.isFinite(generatedAt) ||
    now - generatedAt < 0 ||
    now - generatedAt > MAXIMUM_HEALTH_AGE_MS
  ) {
    return { compatible: false, reason: 'worker-stale' }
  }
  if (snapshot?.metadata?.feedVersion !== health.staticFeedVersion) {
    return { compatible: false, reason: 'feed-version' }
  }
  if (snapshot?.metadata?.serviceDate !== health.serviceDate) {
    return { compatible: false, reason: 'service-date' }
  }
  return { compatible: true }
}

export async function checkLiveEndpoint(snapshot, endpoint, fetcher = fetch) {
  try {
    const response = await fetcher(new URL('/health', endpoint), {
      headers: { Origin: 'https://motionstudies.app' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return { compatible: false, reason: `worker-http-${response.status}` }
    return liveCompatibility(snapshot, await response.json())
  } catch {
    // Realtime is optional. A network failure or invalid health response must
    // not prevent a validated static timetable from being published.
    return { compatible: false, reason: 'worker-unavailable' }
  }
}

async function main() {
  const endpoint = argument('endpoint')
  const snapshotPath = argument('snapshot')
  const githubEnv = argument('github-env')
  if (!endpoint || !snapshotPath) {
    throw new Error(
      'Usage: node scripts/configure-live-pages.mjs --endpoint <worker-url> --snapshot <network.json> [--github-env <path>]',
    )
  }

  const snapshot = JSON.parse(await readFile(resolve(snapshotPath), 'utf8'))
  // A prepared calendar makes the endpoint a recoverable runtime capability.
  // It must be enabled before the new static release is visible to the Worker.
  // Runtime date/version/freshness checks still gate every applied update.
  const calendarPath = argument('calendar')
  let result
  if (calendarPath) {
    const calendar = JSON.parse(await readFile(resolve(calendarPath), 'utf8'))
    if (calendar.schemaVersion !== 1 || calendar.days.length !== 2 || !calendar.days.some(day => day.date === snapshot.metadata.serviceDate && day.feedVersion === snapshot.metadata.feedVersion && /^[a-f0-9]{64}$/.test(day.indexSha256))) throw new Error('Invalid prepared realtime calendar')
    result = { compatible: true }
  } else result = await checkLiveEndpoint(snapshot, endpoint)
  if (!result.compatible) {
    console.log(`Live mode remains disabled: ${result.reason}.`)
    return
  }

  const realtimeUrl = new URL('/realtime.json', endpoint).toString()
  const assignment = `VITE_GLEISLICHT_REALTIME_URL=${realtimeUrl}\n`
  if (githubEnv) {
    await appendFile(resolve(githubEnv), assignment)
  } else {
    process.stdout.write(assignment)
  }
  console.log(
    `Live mode enabled for ${snapshot.metadata.serviceDate}, static feed ${snapshot.metadata.feedVersion}.`,
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
