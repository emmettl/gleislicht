import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { createOrbitalTunnelMatcher } from './orbital-tunnels.mjs'
import { STUDY_SOURCES } from './build-study-summaries.mjs'
import { discoverOrbitalSources, readOrbitalSource } from './orbital-sources.mjs'

// Stable names and duplicate precedence. Discovery also includes new public
// full-day feeds that have not yet been added to the atlas study selector.
export const ORBITAL_SOURCES = [...STUDY_SOURCES.map(([id, file]) => ({ id, file })),
  ...['luzern', 'zug', 'thurgau'].map(id => ({ id, file: `${id}-region/2026-09-04/${id}-region-day-manifest.json` })),
]
export const ORBITAL_CATEGORIES = ['international', 'intercity', 'interregio', 'regional-express', 's-bahn', 'regional', 'tram', 'metro', 'bus', 'ferry', 'cableway', 'funicular', 'other']
export const orbitalCoordinate = ([lon, lat]) => [(lon - 8.23) * Math.cos(46.8 * Math.PI / 180) * 12, -(lat - 46.8) * 12]

export function orbitalIdentity(train, date) {
  let id = train.id.replace(/^\d{4}-\d{2}-\d{2}:/, '')
  const preceding = id.match(/^service:(\d{4}-\d{2}-\d{2}):(.*)$/)
  if (preceding) id = decodeURIComponent(preceding[2])
  // Keep the departure suffix of each representative frequency instance.
  return `${preceding || train.sourceServiceDate && train.sourceServiceDate < date ? 'previous:' : ''}${id.replace(/:run:\d+$/, '')}`
}

// Keep all stop arrival/departure times. Simplify only the intervening geometry.
function simplify(points, tolerance = 0.008) {
  if (points.length < 3) return points
  const kept = new Uint8Array(points.length); kept[0] = kept[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop(), p = points[a], q = points[b]
    const dx = q[0] - p[0], dz = q[1] - p[1], len = dx * dx + dz * dz
    let far = -1, max = tolerance * tolerance
    for (let i = a + 1; i < b; i++) {
      const r = points[i], u = len ? Math.max(0, Math.min(1, ((r[0] - p[0]) * dx + (r[1] - p[1]) * dz) / len)) : 0
      const d = (r[0] - p[0] - dx * u) ** 2 + (r[1] - p[1] - dz * u) ** 2
      if (d > max) { max = d; far = i }
    }
    if (far !== -1) { kept[far] = 1; stack.push([a, far], [far, b]) }
  }
  return points.filter((_, i) => kept[i])
}

export function orbitalTrajectory(train, network, cache = new Map()) {
  const knots = []
  const add = (time, p) => {
    time = Math.round(time * 1000) / 1000
    if (!Number.isFinite(time) || !p?.every(Number.isFinite)) throw new Error(`Invalid orbital coordinate: ${train.id}`)
    if (knots.length && time < knots.at(-3)) throw new Error(`Nonchronological orbital journey: ${train.id}`)
    if (knots.length && time === knots.at(-3)) knots.splice(-3)
    knots.push(time, p[0], p[1])
  }
  const stops = train.stops
  add(stops[0][1], orbitalCoordinate(network.stops[stops[0][0]]))
  for (let i = 0; i < stops.length - 1; i++) {
    const [from, , departure] = stops[i], [to, arrival] = stops[i + 1]
    const a = orbitalCoordinate(network.stops[from]), b = orbitalCoordinate(network.stops[to])
    add(departure, a)
    const index = train.pathSegments?.[i]
    let line = [a, b]
    if (index != null && network.paths?.[index]?.length >= 2) {
      if (!cache.has(index)) cache.set(index, simplify(network.paths[index].map(orbitalCoordinate)))
      line = cache.get(index)
      const distance = p => Math.hypot(p[0] - a[0], p[1] - a[1])
      if (distance(line.at(-1)) < distance(line[0])) line = [...line].reverse()
      line = [a, ...line, b]
    }
    const lengths = [0]
    for (let j = 1; j < line.length; j++) lengths.push(lengths.at(-1) + Math.hypot(line[j][0] - line[j - 1][0], line[j][1] - line[j - 1][1]))
    const total = lengths.at(-1)
    if (arrival > departure && total > 0) for (let j = 1; j < line.length - 1; j++) add(departure + (arrival - departure) * lengths[j] / total, line[j])
    add(arrival, b)
  }
  add(stops.at(-1)[2], orbitalCoordinate(network.stops[stops.at(-1)[0]]))
  return knots
}

export async function buildOrbitalStudy(root = 'public/data') {
  const read = async file => JSON.parse(await readFile(join(root, file), 'utf8'))
  const coverage = await discoverOrbitalSources(root, ORBITAL_SOURCES)
  const tunnelData = await read('orbital-tunnels.json')
  const tunnels = createOrbitalTunnelMatcher(tunnelData.tunnels, orbitalCoordinate, tunnelData.coarsePassages)
  const journeys = new Map(), sources = []
  for (const { id, file, sha256 } of coverage.selected) {
    const { network, trains, inputSha256 } = await readOrbitalSource(root, { id, file, sha256 }), cache = new Map()
    sources.push({ id, file, sha256, inputSha256, date: network.metadata.serviceDate, feedVersion: network.metadata.feedVersion, journeys: trains.size, metadata: network.metadata })
    for (const train of trains.values()) {
      const key = orbitalIdentity(train, network.metadata.serviceDate), existing = journeys.get(key)
      // Prefer the longest complete representation; deterministic source order breaks ties.
      if (existing && existing.end - existing.start >= train.end - train.start) continue
      journeys.set(key, { source: id, start: train.start, end: train.end, category: ORBITAL_CATEGORIES.indexOf(train.category), knots: orbitalTrajectory(train, network, cache) })
    }
  }
  const output = join(root, 'orbital'), chunks = [], list = [...journeys.values()]
  const retained = new Map()
  for (const journey of list) retained.set(journey.source, (retained.get(journey.source) ?? 0) + 1)
  for (const source of sources) source.retainedJourneys = retained.get(source.id) ?? 0
  for (const journey of list) journey.tunnels = tunnels.intervals(journey.knots, journey.category, journey.start, journey.end)
  await mkdir(output, { recursive: true })
  for (let hour = 0; hour < 24; hour += 2) {
    const start = hour * 3600, end = start + 7200
    // A full 10-minute trailing window is retained on either side of a chunk transition.
    const visible = list.filter(t => t.start < end && t.end >= start - 600)
    const floats = new Float32Array(4 + visible.length * 7 + visible.reduce((n, t) => n + t.knots.length + t.tunnels.length, 0))
    floats.set([2, visible.length, start, end])
    let offset = 4 + visible.length * 7
    visible.forEach((t, i) => {
      floats.set([t.start, t.end, t.category, offset, t.knots.length / 3, offset + t.knots.length, t.tunnels.length / 2], 4 + i * 7)
      floats.set(t.knots, offset); offset += t.knots.length
      floats.set(t.tunnels, offset); offset += t.tunnels.length
    })
    const raw = Buffer.from(floats.buffer), bytes = gzipSync(raw), file = `${String(hour).padStart(2, '0')}.bin.gz`
    await writeFile(join(output, file), bytes)
    chunks.push({ file, start, end, journeys: visible.length, bytes: bytes.length, decodedBytes: raw.length, sha256: createHash('sha256').update(bytes).digest('hex'), decodedSha256: createHash('sha256').update(raw).digest('hex') })
  }
  const active = Array.from({ length: 1440 }, (_, minute) => list.filter(t => t.start <= minute * 60 && t.end >= minute * 60).length)
  const manifest = { version: 1, journeyCount: list.length, categories: ORBITAL_CATEGORIES, dates: [...new Set(sources.map(s => s.date))].sort(), model: 'Composite weekday, deduplicated source journey IDs across saved dates. Longest available journey wins. Scheduled interpolation with geometry simplified to approximately 75 metres; frequency services are representative departures, not tracked vehicles.', sources, chunks, active, tunnels: { ...tunnelData.metadata, ways: tunnelData.tunnels.length, matchedWays: tunnels.matched.size, coarsePassages: [...tunnels.coarseMatched], journeys: list.filter(t => t.tunnels.length).length } }
  await writeFile('data/orbital-tunnel-audit.json', JSON.stringify({ ...manifest.tunnels, matched: tunnelData.tunnels.filter(t => tunnels.matched.has(t.id)).map(t => ({ id: t.id, name: t.name })) }, null, 2) + '\n')
  manifest.coverage = coverage
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest))
  await writeFile('data/orbital-source-audit.json', JSON.stringify({ policy: coverage.policy, sources: sources.map(({ metadata: _metadata, ...source }) => source), excluded: coverage.excluded, journeys: list.length, peak: Math.max(...active), dates: manifest.dates }, null, 2) + '\n')
  console.log(JSON.stringify({ sources: sources.length, journeys: list.length, peak: Math.max(...active), bytes: chunks.reduce((n, c) => n + c.bytes, 0) }))
  return manifest
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildOrbitalStudy()
