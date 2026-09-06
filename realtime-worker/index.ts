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

function zurichDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
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
  const currentServiceDate = zurichDate(new Date(receivedAt))
  const compactServiceDate = currentServiceDate.replaceAll('-', '')
  for (const entity of feed.entity) {
    const tripUpdate = entity.tripUpdate
    if (!tripUpdate?.trip.tripId) continue
    if (
      tripUpdate.trip.startDate &&
      tripUpdate.trip.startDate !== compactServiceDate
    ) {
      continue
    }
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
      serviceDate: currentServiceDate,
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
      serviceDate: snapshot.metadata.serviceDate,
    },
  })
}

async function health(request: Request, env: Env): Promise<Response> {
  const latest = await env.OBSERVATIONS.head(LATEST_OBJECT_KEY)
  if (!latest) {
    return json({ status: 'waiting' }, 503, request, env)
  }
  return json(
    {
      status: 'ok',
      generatedAt: latest.customMetadata?.generatedAt,
      receivedAt: latest.customMetadata?.receivedAt,
      staticFeedVersion: latest.customMetadata?.staticFeedVersion,
      serviceDate: latest.customMetadata?.serviceDate,
    },
    200,
    request,
    env,
  )
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
    if (request.method === 'GET' && url.pathname === '/health') {
      return health(request, env)
    }
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
