import roadTopology from '../public/data/swiss-road-topology.json'
import { pullMeasuredData } from '../scripts/astra-measured-data.mjs'
import { A1_ZURICH_SITE_FILTERS } from '../scripts/astra-road-study-config.mjs'

type RecordingScope = 'a1-zurich' | 'national'

interface Env {
  readonly ASTRA_API_KEY: string
  readonly OBSERVATIONS: R2Bucket
  readonly COLLECTING_ENABLED?: string
  readonly RECORDING_SCOPE?: RecordingScope
}

interface RoadTopology {
  readonly sites: readonly {
    readonly stationId: string
    readonly match: { readonly confidence: string }
  }[]
}

const ACCEPTED_MATCHES = new Set(['high', 'continuity', 'authoritative'])
const PUBLICATION_OFFSET_MS = 24_000

export function nationalSiteReferences(topology: RoadTopology): string[] {
  return [
    ...new Set(
      topology.sites
        .filter(({ match }) => ACCEPTED_MATCHES.has(match.confidence))
        .map(({ stationId }) => `${stationId}/#`),
    ),
  ].sort()
}

export function objectKey(scope: RecordingScope, measurementTime: string): string {
  const date = measurementTime.slice(0, 10)
  const timestamp = measurementTime.replaceAll(':', '-').replaceAll('.', '-')
  return `astra/${scope}/${date}/${timestamp}.json.gz`
}

function scopeFrom(env: Env): RecordingScope {
  const scope = env.RECORDING_SCOPE ?? 'a1-zurich'
  if (scope !== 'a1-zurich' && scope !== 'national') {
    throw new Error(`Unknown recording scope: ${scope}`)
  }
  return scope
}

function referencesFor(scope: RecordingScope): readonly string[] {
  return scope === 'national'
    ? nationalSiteReferences(roadTopology as RoadTopology)
    : A1_ZURICH_SITE_FILTERS
}

async function waitForPublication(scheduledTime: number): Promise<void> {
  const delay = scheduledTime + PUBLICATION_OFFSET_MS - Date.now()
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

async function gzip(value: string): Promise<ArrayBuffer> {
  const compressed = new Blob([value])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return new Response(compressed).arrayBuffer()
}

async function recordAstra(env: Env, scheduledTime: number): Promise<void> {
  if (env.COLLECTING_ENABLED !== 'true') {
    console.log('ASTRA collection is paused')
    return
  }
  if (!env.ASTRA_API_KEY) throw new Error('ASTRA_API_KEY is not configured')

  await waitForPublication(scheduledTime)
  const scope = scopeFrom(env)
  const siteReferences = referencesFor(scope)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const { snapshot } = await pullMeasuredData({
      apiKey: env.ASTRA_API_KEY,
      siteReferences,
      signal: controller.signal,
    })
    const newestMeasurementTime = snapshot.measurements
      .map(({ measurementTime }) => measurementTime)
      .sort()
      .at(-1)
    if (!newestMeasurementTime) throw new Error('ASTRA snapshot has no timestamp')

    const key = objectKey(scope, newestMeasurementTime)
    if (await env.OBSERVATIONS.head(key)) {
      console.log(`Already recorded ${newestMeasurementTime}`)
      return
    }
    const recordedSnapshot = {
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        recordingScope: scope,
        requestedStationCount: siteReferences.length,
      },
    }
    await env.OBSERVATIONS.put(
      key,
      await gzip(`${JSON.stringify(recordedSnapshot)}\n`),
      {
        httpMetadata: {
          contentType: 'application/json',
          contentEncoding: 'gzip',
        },
        customMetadata: {
          measurementTime: newestMeasurementTime,
          publicationTime: snapshot.metadata.publicationTime,
          recordingScope: scope,
        },
      },
    )
    console.log(
      `Recorded ${snapshot.measurements.length} detector measurements for ${newestMeasurementTime}`,
    )
  } finally {
    clearTimeout(timeout)
  }
}

export default {
  async scheduled(controller, env, context): Promise<void> {
    context.waitUntil(recordAstra(env, controller.scheduledTime))
  },
} satisfies ExportedHandler<Env>
