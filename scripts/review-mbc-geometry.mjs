import { readMbcGeometrySource, osmSegments } from './mbc-supplement-geometry.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseCsvLine, rowsFromArchive } from '@motionstudies/data/gtfs'
import { distanceMetres, sliceShape } from './enrich-postbus-roads.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { lausanneRailNetworks } from './lausanne-rail-geometry.mjs'
import { readPostbusDay } from './prepare-postbus-road-feed.mjs'

const arg = name => process.argv[process.argv.indexOf(`--${name}`) + 1]
for (const name of ['matched', 'cache', 'graph', 'rail', 'archive', 'manifest', 'output']) assert(process.argv.includes(`--${name}`), `Missing --${name}`)
const read = async path => JSON.parse(await readFile(path, 'utf8'))
const csv = async name => {
  const [header, ...lines] = (await readFile(join(arg('matched'), name), 'utf8')).trim().split(/\r?\n/).map(parseCsvLine)
  return lines.map(row => Object.fromEntries(header.map((key, i) => [key, row[i]])))
}
const input = await read(join(arg('matched'), 'patterns.json')), cache = await read(arg('cache'))
const graphBytes = await readFile(arg('graph')), railBytes = await readFile(arg('rail'))
const roads = JSON.parse(graphBytes).features.filter(f => f.geometry.type === 'LineString').map(f => f.geometry.coordinates)
const rail = lausanneRailNetworks(parseRailNetworkXtf(railBytes.toString(), 10)).mbc.map(s => s.points)
const { manifest, trains } = await readPostbusDay(arg('manifest'))
const mbcRouteIds = new Set()
for await (const row of rowsFromArchive(arg('archive'), 'feed_info.txt')) assert.equal(row.feed_version, manifest.metadata.feedVersion)
for await (const row of rowsFromArchive(arg('archive'), 'routes.txt')) if (row.agency_id === '29') mbcRouteIds.add(row.route_id)
const { source: supplementalSource, sha256: supplementalSha256 } = await readMbcGeometrySource()
const funicularTrack = osmSegments(supplementalSource).filter(s => s.tags.railway === 'funicular').map(s => s.points)
const funicularTrains = trains.filter(t => t.category === 'funicular')
const mbcRail = trains.filter(t => mbcRouteIds.has(t.routeId))
assert(mbcRail.length, 'No MBC rail in the expanded study')
const trips = new Map((await csv('trips.txt')).map(row => [row.trip_id, row.shape_id])), shapes = new Map(), times = new Map()
for (const row of await csv('shapes.txt')) { const points = shapes.get(row.shape_id) ?? []; points.push([+row.shape_pt_lon, +row.shape_pt_lat, +row.shape_dist_traveled, +row.shape_pt_sequence]); shapes.set(row.shape_id, points) }
for (const points of shapes.values()) points.sort((a, b) => a[3] - b[3])
for (const row of await csv('stop_times.txt')) { const calls = times.get(row.trip_id) ?? []; calls.push({ sequence: +row.stop_sequence, distance: +row.shape_dist_traveled }); times.set(row.trip_id, calls) }
for (const calls of times.values()) calls.sort((a, b) => a.sequence - b.sequence)
const snaps = new Map()
for (const pattern of input.patterns) {
  const calls = times.get(pattern.id), shape = shapes.get(trips.get(pattern.id))
  for (let i = 1; i < pattern.stops.length; i++) {
    const path = sliceShape(shape, calls?.[i - 1].distance, calls?.[i].distance)
    if (!path) continue
    for (const [index, point] of [[i - 1, path[0]], [i, path.at(-1)]]) {
      const stop = input.stops[pattern.stops[index][0]], metres = distanceMetres(stop, point)
      if (metres > (snaps.get(stop[4])?.metres ?? -1)) snaps.set(stop[4], { id: stop[4], name: stop[2], stop: stop.slice(0, 2), road: point, metres, route: pattern.route })
    }
  }
}
const ranked = [...snaps.values()].sort((a, b) => b.metres - a.metres), panels = [], names = new Set()
for (const snap of ranked) {
  if (names.has(snap.name)) continue
  panels.push({ title: `${snap.name} · ${snap.metres.toFixed(1)} m`, centre: snap.stop, radius: .003, routes: [snap.route], snap })
  names.add(snap.name)
  if (panels.length === 3) break
}
for (const [title, match, routes, radius] of [
  ['La Plantaz · source-relation turnaround', /Tolochenaz, La Plantaz/, ['701'], .004],
  ['Morges station · bus directions', /^Morges, gare$/, ['701', '702', '703'], .004],
  ['Cossonay · bus approaches', /Cossonay-Ville, centre/, ['750', '760'], .008],
]) {
  const stop = input.stops.find(s => match.test(s[2])); assert(stop, title)
  panels.push({ title, centre: stop.slice(0, 2), radius, routes })
}
panels.push({ title: 'MBC railway · Bière and L’Isle branches', centre: [6.416, 46.566], radius: .11, rail: true })
panels.push({ title: 'Morges · rail platforms and La Gottaz', centre: [6.485, 46.514], radius: .013, rail: true })
panels.push({ title: 'Cossonay funicular · complete corridor', centre: [6.5164, 46.609], radius: .009, funi: true })
panels.push({ title: 'Cossonay funicular · passing loop', centre: funicularTrack.find(p => p.length > 6)[3], radius: .0015, funi: true })
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="2160"><rect width="1200" height="2160" fill="#0b1020"/><style>text{font-family:Arial,sans-serif;fill:#e8efff}</style><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0L10 5L0 10" fill="#fff"/></marker></defs><text x="24" y="34" font-size="23">MBC geometry review · 8 September 2026</text><text x="24" y="62" font-size="14">Grey: OSM roads / funicular and FOT rail · cyan: inferred paths · white: platforms · pink: platform connectors</text>'
for (const [i, p] of panels.entries()) {
  const x = 24 + i % 2 * 590, y = 90 + Math.floor(i / 2) * 400, w = 566, h = 370
  const b = [p.centre[0] - p.radius, p.centre[1] - p.radius * .68, p.centre[0] + p.radius, p.centre[1] + p.radius * .68]
  const inside = c => c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3]
  const xy = c => [x + (c[0] - b[0]) / (b[2] - b[0]) * w, y + 32 + (b[3] - c[1]) / (b[3] - b[1]) * (h - 32)]
  const line = points => points.map((c, j) => `${j ? 'L' : 'M'}${xy(c).map(v => v.toFixed(1)).join(' ')}`).join('')
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#101a2d" stroke="#35445e"/><text x="${x + 10}" y="${y + 22}" font-size="15">${esc(p.title)}</text><clipPath id="c${i}"><rect x="${x}" y="${y + 32}" width="${w}" height="${h - 32}"/></clipPath><g clip-path="url(#c${i})">`
  for (const points of p.funi ? funicularTrack : p.rail ? rail : roads) if (points.some(inside)) svg += `<path d="${line(points)}" fill="none" stroke="#758099" stroke-width="3"/>`
  const sourceStops = (p.rail || p.funi) ? manifest.stops : input.stops, paths = (p.rail || p.funi) ? manifest.paths : cache.paths
  const pathIds = new Set(), stopIds = new Set()
  const patterns = p.funi ? funicularTrains : p.rail ? mbcRail : input.patterns.filter(pattern => p.routes.includes(pattern.route))
  for (const pattern of patterns) {
    for (const id of (p.rail || p.funi) ? pattern.pathSegments ?? [] : cache.patterns[pattern.id] ?? []) if (id != null) pathIds.add(id)
    for (const [id] of pattern.stops) stopIds.add(id)
  }
  let visible = 0
  for (const id of pathIds) if (paths[id].some(inside)) { visible++; svg += `<path d="${line(paths[id])}" fill="none" stroke="#5ef3ee" stroke-width="1.5" marker-end="url(#arrow)"/>` }
  assert(visible, `Empty review panel ${p.title}`)
  let labels = 0
  const orderedStops = [...stopIds].sort((a, b) => Number(/^(Bière|L'Isle|Apples|Morges)$/.test(sourceStops[b][2])) - Number(/^(Bière|L'Isle|Apples|Morges)$/.test(sourceStops[a][2])))
  for (const id of orderedStops) if (inside(sourceStops[id])) {
    const [sx, sy] = xy(sourceStops[id]); svg += `<circle cx="${sx}" cy="${sy}" r="2.5" fill="white"/>`
    if (labels++ < 5) svg += `<text x="${sx + 5}" y="${sy - 6}" font-size="11">${esc(sourceStops[id][2])}</text>`
  }
  if (p.snap) svg += `<path d="${line([p.snap.stop, p.snap.road])}" fill="none" stroke="#ff69ae" stroke-width="4"/>`
  svg += '</g>'
}
svg += '<text x="24" y="2130" font-size="14">© OpenStreetMap contributors · ODbL 1.0; Federal Office of Transport. Source alignment review, not operator verification.</text></svg>'
await mkdir(arg('output'), { recursive: true })
await writeFile(join(arg('output'), 'mbc-geometry-review.svg'), svg)
await writeFile(join(arg('output'), 'mbc-geometry-review.json'), JSON.stringify({ serviceDate: input.metadata.serviceDate, graphSha256: createHash('sha256').update(graphBytes).digest('hex'), railSha256: createHash('sha256').update(railBytes).digest('hex'), supplementalSha256, cacheSha256: createHash('sha256').update(await readFile(arg('cache'))).digest('hex'), largestSnaps: ranked.slice(0, 20), rejectedPatternSegments: cache.report.issues, panels }, null, 2) + '\n')
