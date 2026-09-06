import bindings from 'gtfs-realtime-bindings'
import type {
  RealtimeSnapshot,
  RealtimeStopUpdate,
  RealtimeTripRelationship,
  RealtimeTripUpdate,
} from '@motionstudies/core/domain/realtime.ts'

const SOURCE_URL = 'https://api.opentransportdata.swiss/la/gtfs-rt'
const USER_AGENT = 'gleislicht/0.0.1 (+https://emmettl.github.io/gleislicht/)'

interface Env {
  readonly OPENTRANSPORTDATA_API_KEY: string
  readonly STATIC_FEED_VERSION: string
  readonly ALLOWED_ORIGINS?: string
  readonly OBSERVATIONS: R2Bucket
}

const LATEST_OBJECT_KEY = 'gtfs-rt/latest.json'

function relationship(
  value: number | null | undefined,
): RealtimeTripRelationship | undefined {
  if (value === 1 || value === 8) return 'added'
  if (value === 3) return 'cancelled'
  if (value === 7) return 'deleted'
  return value === 0 ? 'scheduled' : undefined
}

function stopRelationship(
  value: number | null | undefined,
): RealtimeStopUpdate['scheduleRelationship'] {
  if (value === 1) return 'skipped'
  if (value === 2) return 'no-data'
  return value === 0 ? 'scheduled' : undefined
}

function serviceDate(value: string | null | undefined): string | undefined {
  return value && /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : undefined
}

function zurichDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = (env.ALLOWED_ORIGINS ?? 'https://emmettl.github.io')
    .split(',')
    .map((value) => value.trim())
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function json(
  value: unknown,
  status: number,
  request: Request,
  env: Env,
): Response {
  return Response.json(value, {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Cache-Control': 'public, max-age=30, s-maxage=30',
    },
  })
}

export function normalizeFeed(
  bytes: ArrayBuffer,
  receivedAt: string,
  staticFeedVersion: string,
): RealtimeSnapshot {
  const feed = bindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(bytes),
  )
  const updates: RealtimeTripUpdate[] = []
  let datedService: string | undefined
  for (const entity of feed.entity) {
    const tripUpdate = entity.tripUpdate
    if (!tripUpdate?.trip.tripId) continue
    datedService ??= serviceDate(tripUpdate.trip.startDate)
    updates.push({
      tripId: tripUpdate.trip.tripId,
      startDate: tripUpdate.trip.startDate || undefined,
      scheduleRelationship: relationship(
        tripUpdate.trip.scheduleRelationship,
      ),
      delaySeconds: tripUpdate.delay ?? undefined,
      stopTimeUpdates: (tripUpdate.stopTimeUpdate ?? []).map((stop) => ({
        stopId: stop.stopId || undefined,
        stopSequence: stop.stopSequence || undefined,
        scheduleRelationship: stopRelationship(stop.scheduleRelationship),
        arrivalDelay: stop.arrival?.delay ?? undefined,
        departureDelay: stop.departure?.delay ?? undefined,
      })),
    })
  }
  const timestampSeconds = Number(feed.header.timestamp?.toString() ?? 0)
  return {
    metadata: {
      kind: 'live',
      generatedAt: timestampSeconds
        ? new Date(timestampSeconds * 1000).toISOString()
        : receivedAt,
      receivedAt,
      staticFeedVersion,
      serviceDate: datedService ?? zurichDate(),
      sourceUrl: SOURCE_URL,
      model: 'GTFS-RT Trip Updates normalized at the edge; no vehicle positions',
    },
    updates,
  }
}

async function refreshRealtime(env: Env): Promise<void> {
  if (!env.OPENTRANSPORTDATA_API_KEY || !env.STATIC_FEED_VERSION) {
    throw new Error('Realtime feed is not configured')
  }

  const upstream = await fetch(SOURCE_URL, {
    headers: {
      Authorization: `Bearer ${env.OPENTRANSPORTDATA_API_KEY}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/x-protobuf',
      'Accept-Encoding': 'gzip, br',
    },
    redirect: 'follow',
  })
  if (!upstream.ok) {
    throw new Error(`Realtime upstream returned ${upstream.status}`)
  }

  const receivedAt = new Date().toISOString()
  const snapshot = normalizeFeed(
    await upstream.arrayBuffer(),
    receivedAt,
    env.STATIC_FEED_VERSION,
  )
  await env.OBSERVATIONS.put(LATEST_OBJECT_KEY, JSON.stringify(snapshot), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=30',
    },
    customMetadata: {
      generatedAt: snapshot.metadata.generatedAt,
      receivedAt,
      staticFeedVersion: env.STATIC_FEED_VERSION,
    },
  })
}

export default {
  async scheduled(_controller, env, context): Promise<void> {
    context.waitUntil(refreshRealtime(env))
  },

  async fetch(request: Request, env: Env, context: ExecutionContext) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) })
    }
    const url = new URL(request.url)
    if (request.method !== 'GET' || url.pathname !== '/realtime.json') {
      return json({ error: 'Not found' }, 404, request, env)
    }
    const cache = (caches as CacheStorage & { readonly default: Cache }).default
    const cached = await cache.match(request)
    if (cached) return cached

    const latest = await env.OBSERVATIONS.get(LATEST_OBJECT_KEY)
    if (!latest) {
      return json({ error: 'Realtime snapshot is not available yet' }, 503, request, env)
    }
    const headers = new Headers()
    latest.writeHttpMetadata(headers)
    headers.set('ETag', latest.httpEtag)
    headers.set('Cache-Control', 'public, max-age=30, s-maxage=30')
    for (const [name, value] of Object.entries(corsHeaders(request, env))) {
      headers.set(name, value)
    }
    const response = new Response(latest.body, { headers })
    context.waitUntil(cache.put(request, response.clone()))
    return response
  },
} satisfies ExportedHandler<Env>
