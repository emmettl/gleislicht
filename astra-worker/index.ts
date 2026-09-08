import roadTopology from '../public/data/swiss-road-topology.json'
import { pullMeasuredData } from '../scripts/astra-measured-data.mjs'
import { A1_ZURICH_SITE_FILTERS } from '../scripts/astra-road-study-config.mjs'
import cantonalCatalog from '../data/zurich-cantonal-road-counters.json'
import { cantonalSiteReferences, scopedRecordedSnapshot, validateRecordingScope } from '../scripts/astra-recording-scopes.mjs'
import type { RecordingScope } from '../scripts/astra-recording-scopes.mjs'
import type { AstraSnapshot } from '../scripts/astra-measured-data.mjs'

interface Env {
  readonly ASTRA_API_KEY: string
  readonly OBSERVATIONS: R2Bucket
  readonly COLLECTING_ENABLED?: string
  readonly RECORDING_SCOPE?: RecordingScope
  readonly ADDITIONAL_RECORDING_SCOPE?: 'zurich-cantonal'
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

export function scopesFrom(env: Pick<Env, 'RECORDING_SCOPE' | 'ADDITIONAL_RECORDING_SCOPE'>): RecordingScope[] {
  const scope = validateRecordingScope(env.RECORDING_SCOPE ?? 'a1-zurich')
  if (env.ADDITIONAL_RECORDING_SCOPE && env.ADDITIONAL_RECORDING_SCOPE !== 'zurich-cantonal') {
    throw new Error('ADDITIONAL_RECORDING_SCOPE must be zurich-cantonal')
  }
  return [...new Set([scope, ...(env.ADDITIONAL_RECORDING_SCOPE ? [env.ADDITIONAL_RECORDING_SCOPE] : [])])]
}

export function referencesFor(scope: RecordingScope): readonly string[] {
  if (scope === 'zurich-cantonal') return cantonalSiteReferences(cantonalCatalog)
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

export async function archiveScope(env: Pick<Env, 'OBSERVATIONS'>, snapshot: AstraSnapshot, scope: RecordingScope, siteReferences: readonly string[]): Promise<void> {
  const recordedSnapshot = scopedRecordedSnapshot(snapshot, scope, siteReferences, cantonalCatalog)
  const newestMeasurementTime = recordedSnapshot.measurements.map(({ measurementTime }) => measurementTime).sort().at(-1)!
  const key = objectKey(scope, newestMeasurementTime)
  if (await env.OBSERVATIONS.head(key)) {
    console.log(`Already recorded ${scope} ${newestMeasurementTime}`)
    return
  }
  await env.OBSERVATIONS.put(key, await gzip(`${JSON.stringify(recordedSnapshot)}\n`), {
    httpMetadata: { contentType: 'application/json', contentEncoding: 'gzip' },
    customMetadata: {
      measurementTime: newestMeasurementTime,
      publicationTime: snapshot.metadata.publicationTime,
      recordingScope: scope,
    },
  })
  console.log(`Recorded ${scope}: ${recordedSnapshot.measurements.length} detectors for ${newestMeasurementTime}`)
}

export async function archiveScopes(env: Pick<Env, 'OBSERVATIONS'>, snapshot: AstraSnapshot, scopes: readonly RecordingScope[]): Promise<void> {
  const failures = []
  for (const scope of scopes) {
    try {
      await archiveScope(env, snapshot, scope, referencesFor(scope))
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length) throw new AggregateError(failures, 'One or more road recording scopes failed', { cause: failures[0] })
}

async function recordAstra(env: Env, scheduledTime: number): Promise<void> {
  if (env.COLLECTING_ENABLED !== 'true') {
    console.log('ASTRA collection is paused')
    return
  }
  if (!env.ASTRA_API_KEY) throw new Error('ASTRA_API_KEY is not configured')

  await waitForPublication(scheduledTime)
  const scopes = scopesFrom(env)
  const siteReferences = [...new Set(scopes.flatMap((scope) => referencesFor(scope)))]
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const { snapshot } = await pullMeasuredData({
      apiKey: env.ASTRA_API_KEY,
      siteReferences,
      signal: controller.signal,
    })
    await archiveScopes(env, snapshot, scopes)
  } finally {
    clearTimeout(timeout)
  }
}

export default {
  async scheduled(controller, env, context): Promise<void> {
    context.waitUntil(recordAstra(env, controller.scheduledTime))
  },
} satisfies ExportedHandler<Env>
