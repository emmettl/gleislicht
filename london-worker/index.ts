import type {
  ObservedLineStatus,
  ObservedTransitVehicle,
  TransitOperationsSnapshot,
} from '@motionstudies/core/domain/operations.ts'

const TFL_API_ORIGIN = 'https://api.tfl.gov.uk'
const DEFAULT_LINES = ['victoria', 'jubilee', 'elizabeth'] as const
const LATEST_OBJECT_KEY = 'london/tfl-operations/latest.json'
const USER_AGENT =
  'motionstudies-all-change/0.0.1 (+https://emmettl.github.io/gleislicht/london.html)'

interface Env {
  readonly TFL_API_KEY?: string
  readonly OBSERVATIONS: R2Bucket
  readonly COLLECTING_ENABLED?: string
  readonly LINES?: string
  readonly ALLOWED_ORIGINS?: string
}

interface TflPrediction {
  readonly vehicleId?: string
  readonly lineId?: string
  readonly lineName?: string
  readonly modeName?: string
  readonly naptanId?: string
  readonly stationName?: string
  readonly platformName?: string
  readonly destinationNaptanId?: string
  readonly destinationName?: string
  readonly direction?: string
  readonly currentLocation?: string
  readonly towards?: string
  readonly timestamp?: string
  readonly expectedArrival?: string
  readonly timeToStation?: number
}

interface TflStatus {
  readonly statusSeverity?: number
  readonly statusSeverityDescription?: string
  readonly reason?: string
}

interface TflLine {
  readonly id?: string
  readonly name?: string
  readonly lineStatuses?: readonly TflStatus[]
}

function configuredLines(env: Env): readonly string[] {
  const lines = (env.LINES ?? DEFAULT_LINES.join(','))
    .split(',')
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set(lines)]
}

function apiUrl(path: string, apiKey?: string): string {
  const url = new URL(path, TFL_API_ORIGIN)
  if (apiKey) url.searchParams.set('app_key', apiKey)
  return url.toString()
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
      'Cache-Control': 'public, max-age=20, s-maxage=20',
    },
  })
}

async function fetchJson<T>(
  path: string,
  apiKey: string | undefined,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(apiUrl(path, apiKey), {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal,
  })
  if (!response.ok) throw new Error(`TfL ${path} returned ${response.status}`)
  return response.json<T>()
}

export function normalizePredictions(
  predictions: readonly TflPrediction[],
): readonly ObservedTransitVehicle[] {
  const vehicles = new Map<
    string,
    {
      vehicle: Omit<ObservedTransitVehicle, 'predictions'>
      predictions: Map<string, ObservedTransitVehicle['predictions'][number]>
    }
  >()

  for (const prediction of predictions) {
    const vehicleId = prediction.vehicleId?.trim()
    const lineId = prediction.lineId?.trim().toLowerCase()
    const stopId = prediction.naptanId?.trim()
    const expectedArrival = prediction.expectedArrival?.trim()
    const observedAt = prediction.timestamp?.trim()
    if (
      !vehicleId ||
      !lineId ||
      !stopId ||
      !expectedArrival ||
      !observedAt ||
      typeof prediction.timeToStation !== 'number' ||
      prediction.timeToStation < 0
    ) {
      continue
    }

    const key = `${lineId}:${vehicleId}`
    const record = vehicles.get(key) ?? {
      vehicle: {
        id: key,
        lineId,
        lineName: prediction.lineName?.trim() || lineId,
        modeName: prediction.modeName?.trim() || undefined,
        destinationStopId:
          prediction.destinationNaptanId?.trim() || undefined,
        destinationName: prediction.destinationName?.trim() || undefined,
        direction: prediction.direction?.trim() || undefined,
        currentLocation: prediction.currentLocation?.trim() || undefined,
        towards: prediction.towards?.trim() || undefined,
        observedAt,
      },
      predictions: new Map(),
    }
    const stopPrediction = {
      stopId,
      stopName: prediction.stationName?.trim() || stopId,
      platformName: prediction.platformName?.trim() || undefined,
      expectedArrival,
      secondsToStop: Math.round(prediction.timeToStation),
    }
    const predictionKey = `${stopId}:${expectedArrival}`
    const duplicate = record.predictions.get(predictionKey)
    if (!duplicate || duplicate.secondsToStop > stopPrediction.secondsToStop) {
      record.predictions.set(predictionKey, stopPrediction)
    }
    vehicles.set(key, record)
  }

  return [...vehicles.values()]
    .map(({ vehicle, predictions: vehiclePredictions }) => ({
      ...vehicle,
      predictions: [...vehiclePredictions.values()].sort(
        (first, second) =>
          first.secondsToStop - second.secondsToStop ||
          first.stopId.localeCompare(second.stopId, 'en'),
      ),
    }))
    .filter(({ predictions: vehiclePredictions }) => vehiclePredictions.length)
    .sort(
      (first, second) =>
        first.lineId.localeCompare(second.lineId, 'en') ||
        first.id.localeCompare(second.id, 'en'),
    )
}

export function normalizeStatuses(
  lines: readonly TflLine[],
): readonly ObservedLineStatus[] {
  return lines
    .flatMap((line) => {
      if (!line.id || !line.name) return []
      const status = [...(line.lineStatuses ?? [])].sort(
        (first, second) =>
          (first.statusSeverity ?? Number.POSITIVE_INFINITY) -
          (second.statusSeverity ?? Number.POSITIVE_INFINITY),
      )[0]
      if (!status || typeof status.statusSeverity !== 'number') return []
      return [
        {
          lineId: line.id,
          lineName: line.name,
          severity: status.statusSeverity,
          severityDescription:
            status.statusSeverityDescription?.trim() || 'Unknown',
          reason: status.reason?.trim() || undefined,
        },
      ]
    })
    .sort((first, second) => first.lineId.localeCompare(second.lineId, 'en'))
}

export function operationsObjectKey(scheduledAt: string): string {
  const date = scheduledAt.slice(0, 10)
  const timestamp = scheduledAt.replaceAll(':', '-').replaceAll('.', '-')
  return `london/tfl-operations/${date}/${timestamp}.json.gz`
}

async function gzip(value: string): Promise<ArrayBuffer> {
  const compressed = new Blob([value])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return new Response(compressed).arrayBuffer()
}

async function collectOperations(
  env: Env,
  scheduledTime: number,
): Promise<TransitOperationsSnapshot> {
  const lines = configuredLines(env)
  if (!lines.length) throw new Error('No TfL lines are configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)
  try {
    const [linePredictions, statuses] = await Promise.all([
      Promise.all(
        lines.map((line) =>
          fetchJson<readonly TflPrediction[]>(
            `/Line/${encodeURIComponent(line)}/Arrivals`,
            env.TFL_API_KEY,
            controller.signal,
          ),
        ),
      ),
      fetchJson<readonly TflLine[]>(
        `/Line/${lines.map(encodeURIComponent).join(',')}/Status`,
        env.TFL_API_KEY,
        controller.signal,
      ),
    ])
    const collectedAt = new Date().toISOString()
    return {
      metadata: {
        kind: 'observed-operations',
        publisher: 'Transport for London',
        sourceUrl: `${TFL_API_ORIGIN}/Line/{line}/Arrivals`,
        collectedAt,
        scheduledAt: new Date(scheduledTime).toISOString(),
        lineIds: lines,
        model:
          'TfL arrival-prediction observations grouped by vehicle; positions derived between predicted stops, not GPS',
      },
      vehicles: normalizePredictions(linePredictions.flat()),
      lineStatuses: normalizeStatuses(statuses),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function recordOperations(env: Env, scheduledTime: number): Promise<void> {
  if (env.COLLECTING_ENABLED !== 'true') {
    console.log('London operations collection is paused')
    return
  }
  const snapshot = await collectOperations(env, scheduledTime)
  const value = `${JSON.stringify(snapshot)}\n`
  const key = operationsObjectKey(snapshot.metadata.scheduledAt)
  await Promise.all([
    env.OBSERVATIONS.put(key, await gzip(value), {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
        contentEncoding: 'gzip',
      },
      customMetadata: {
        collectedAt: snapshot.metadata.collectedAt,
        scheduledAt: snapshot.metadata.scheduledAt,
        lineIds: snapshot.metadata.lineIds.join(','),
        vehicleCount: String(snapshot.vehicles.length),
      },
    }),
    env.OBSERVATIONS.put(LATEST_OBJECT_KEY, value, {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: 'public, max-age=20',
      },
      customMetadata: {
        collectedAt: snapshot.metadata.collectedAt,
        scheduledAt: snapshot.metadata.scheduledAt,
        lineIds: snapshot.metadata.lineIds.join(','),
        vehicleCount: String(snapshot.vehicles.length),
      },
    }),
  ])
  console.log(
    `Recorded ${snapshot.vehicles.length} observed TfL vehicles across ${snapshot.metadata.lineIds.length} lines`,
  )
}

async function health(request: Request, env: Env): Promise<Response> {
  const latest = await env.OBSERVATIONS.head(LATEST_OBJECT_KEY)
  if (!latest) return json({ status: 'waiting' }, 503, request, env)
  return json(
    {
      status: 'ok',
      collectedAt: latest.customMetadata?.collectedAt,
      scheduledAt: latest.customMetadata?.scheduledAt,
      lineIds: latest.customMetadata?.lineIds?.split(',') ?? [],
      vehicleCount: Number(latest.customMetadata?.vehicleCount ?? 0),
    },
    200,
    request,
    env,
  )
}

export default {
  async scheduled(controller, env, context): Promise<void> {
    context.waitUntil(recordOperations(env, controller.scheduledTime))
  },

  async fetch(request: Request, env: Env, context: ExecutionContext) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      })
    }
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/health') {
      return health(request, env)
    }
    if (request.method !== 'GET' || url.pathname !== '/operations.json') {
      return json({ error: 'Not found' }, 404, request, env)
    }

    const cache = (caches as CacheStorage & { readonly default: Cache }).default
    const cached = await cache.match(request)
    if (cached) return cached
    const latest = await env.OBSERVATIONS.get(LATEST_OBJECT_KEY)
    if (!latest) {
      return json(
        { error: 'London operations snapshot is not available yet' },
        503,
        request,
        env,
      )
    }
    const headers = new Headers()
    latest.writeHttpMetadata(headers)
    headers.set('ETag', latest.httpEtag)
    headers.set('Cache-Control', 'public, max-age=20, s-maxage=20')
    for (const [name, value] of Object.entries(corsHeaders(request, env))) {
      headers.set(name, value)
    }
    const response = new Response(latest.body, { headers })
    context.waitUntil(cache.put(request, response.clone()))
    return response
  },
} satisfies ExportedHandler<Env>
