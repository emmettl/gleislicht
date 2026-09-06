import { appendFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAXIMUM_HEALTH_AGE_MS = 3 * 60_000

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
  const healthUrl = new URL('/health', endpoint)
  const response = await fetch(healthUrl, {
    headers: { Origin: 'https://emmettl.github.io' },
  })
  if (!response.ok) {
    console.log(`Live mode remains disabled: Worker health returned ${response.status}.`)
    return
  }
  const health = await response.json()
  const result = liveCompatibility(snapshot, health)
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
    `Live mode enabled for ${health.serviceDate}, static feed ${health.staticFeedVersion}.`,
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
