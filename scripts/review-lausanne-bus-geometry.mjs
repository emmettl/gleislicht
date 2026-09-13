import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { parseCsvLine } from '@motionstudies/data/gtfs'
import { distanceMetres, sliceShape } from './enrich-postbus-roads.mjs'

const arg = name => process.argv[process.argv.indexOf(`--${name}`) + 1]
for (const name of ['matched', 'cache', 'graph', 'output']) assert(process.argv.includes(`--${name}`), `Missing --${name}`)
const csv = async name => {
  const [header, ...lines] = (await readFile(join(arg('matched'), name), 'utf8')).trim().split(/\r?\n/).map(parseCsvLine)
  return lines.map(row => Object.fromEntries(header.map((key, i) => [key, row[i]])))
}
const input = JSON.parse(await readFile(join(arg('matched'), 'patterns.json')))
const cache = JSON.parse(await readFile(arg('cache')))
const graphBytes = await readFile(arg('graph'))
const graph = JSON.parse(graphBytes).features.filter(f => f.geometry.type === 'LineString')
const trips = new Map((await csv('trips.txt')).map(row => [row.trip_id, row.shape_id]))
const shapes = new Map(), times = new Map()
for (const row of await csv('shapes.txt')) {
  const points = shapes.get(row.shape_id) ?? []
  points.push([+row.shape_pt_lon, +row.shape_pt_lat, +row.shape_dist_traveled, +row.shape_pt_sequence]); shapes.set(row.shape_id, points)
}
for (const points of shapes.values()) points.sort((a, b) => a[3] - b[3])
for (const row of await csv('stop_times.txt')) {
  const list = times.get(row.trip_id) ?? []
  list.push({ sequence: +row.stop_sequence, distance: +row.shape_dist_traveled }); times.set(row.trip_id, list)
}
for (const list of times.values()) list.sort((a, b) => a.sequence - b.sequence)
const snaps = new Map()
for (const pattern of input.patterns) {
  const shape = shapes.get(trips.get(pattern.id)), calls = times.get(pattern.id)
  for (let i = 1; i < pattern.stops.length; i++) {
    const road = sliceShape(shape, calls[i - 1].distance, calls[i].distance)
    assert(road, 'Missing source shape')
    for (const [index, point] of [[i - 1, road[0]], [i, road.at(-1)]]) {
      const stop = input.stops[pattern.stops[index][0]], metres = distanceMetres(stop, point)
      if (metres > (snaps.get(stop[4])?.metres ?? -1)) snaps.set(stop[4], { id: stop[4], name: stop[2], stop: stop.slice(0, 2), road: point, metres, route: pattern.route, pattern: pattern.id })
    }
  }
}
const ranked = [...snaps.values()].sort((a, b) => b.metres - a.metres)
const used = new Set(), panels = []
for (const snap of ranked) {
  if (used.has(snap.name)) continue
  panels.push({ name: `${snap.name} · ${snap.metres.toFixed(1)} m`, centre: snap.stop, radius: .0026, routes: [snap.route], snap })
  used.add(snap.name)
  if (panels.length === 3) break
}
for (const [name, pattern, routes, radius] of [
  ['Renens station · directions', /Renens VD, gare$/, ['31', '32'], .006],
  ['Flon / Bel-Air · line 18', /Lausanne, Bel-Air$/, ['18'], .004],
  ['Saint-François · lines 1 / 9', /Lausanne, St-François/, ['1', '9'], .004],
  ['Croisettes · hill routes 45 / 64', /Epalinges, Croisettes/, ['45', '64'], .006],
  ['Vers-chez-les-Blanc · night service N2', /Lausanne, Vers-chez-les-Blanc$/, ['N2'], .008],
]) {
  const stop = input.stops.find(stop => pattern.test(stop[2])); assert(stop, name)
  panels.push({ name, centre: stop.slice(0, 2), radius, routes })
}
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const dates = input.metadata.serviceDates ?? [input.metadata.serviceDate]
const dateLabel = dates.length > 1 ? `${dates[0]}–${dates.at(-1)}` : dates[0]
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1700" viewBox="0 0 1100 1700"><rect width="1100" height="1700" fill="#080e19"/><style>text{font-family:Arial,sans-serif;fill:#e1e9f5} .road{fill:none;stroke:#526078;stroke-width:1.6} .path{fill:none;stroke-width:2.5}</style><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="#fff"/></marker></defs><text x="28" y="34" font-size="23">Lausanne bus alignment review · civil dates ' + esc(dateLabel) + '</text><text x="28" y="61" font-size="13">Grey: OSM routing graph · colour: inferred bus paths · white: timetable platforms · pink: road connector</text>'
for (const [index, panel] of panels.entries()) {
  const x = 24 + (index % 2) * 548, y = 88 + Math.floor(index / 2) * 388, w = 528, h = 354
  const bounds = [panel.centre[0] - panel.radius, panel.centre[1] - panel.radius * .69, panel.centre[0] + panel.radius, panel.centre[1] + panel.radius * .69]
  panel.bounds = bounds
  const inside = p => p[0] >= bounds[0] && p[0] <= bounds[2] && p[1] >= bounds[1] && p[1] <= bounds[3]
  const project = p => [(x + (p[0] - bounds[0]) / (bounds[2] - bounds[0]) * w).toFixed(1), (y + 35 + (bounds[3] - p[1]) / (bounds[3] - bounds[1]) * (h - 35)).toFixed(1)]
  const line = points => points.map((p, i) => `${i ? 'L' : 'M'}${project(p).join(' ')}`).join('')
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0c1626" stroke="#344256"/><text x="${x + 10}" y="${y + 23}" font-size="15">${esc(panel.name)}</text><clipPath id="clip${index}"><rect x="${x}" y="${y + 35}" width="${w}" height="${h - 35}"/></clipPath><g clip-path="url(#clip${index})">`
  for (const feature of graph) if (feature.geometry.coordinates.some(inside)) svg += `<path class="road" d="${line(feature.geometry.coordinates)}"/>`
  const pathIds = new Set(), stopIds = new Set()
  for (const pattern of input.patterns.filter(p => panel.routes.includes(p.route))) {
    const color = panel.routes.indexOf(pattern.route) ? '#ffbd65' : '#60e1eb'
    for (const id of cache.patterns[pattern.id]) if (id !== null && !pathIds.has(id) && cache.paths[id].some(inside)) {
      pathIds.add(id); svg += `<path class="path" stroke="${color}" d="${line(cache.paths[id])}" marker-end="url(#arrow)"/>`
    }
    for (const [id] of pattern.stops) stopIds.add(id)
  }
  let labels = 0
  for (const id of stopIds) {
    const stop = input.stops[id]; if (!inside(stop)) continue
    const [px, py] = project(stop)
    svg += `<circle cx="${px}" cy="${py}" r="3" fill="#fff"/>`
    if (labels++ < 5) svg += `<text x="${+px + 5}" y="${+py - 6}" font-size="10">${esc(stop[2].replace(/^Lausanne, |^Epalinges, |^Renens VD, /, ''))}</text>`
  }
  if (panel.snap) svg += `<path d="${line([panel.snap.stop, panel.snap.road])}" fill="none" stroke="#ff5eac" stroke-width="4"/>`
  assert(pathIds.size, `No paths visible in ${panel.name}`)
  svg += '</g>'
}
svg += '<text x="28" y="1668" font-size="13">© OpenStreetMap contributors · ODbL 1.0. Review against the matching source; not independent operator verification.</text></svg>'
await mkdir(arg('output'), { recursive: true })
await writeFile(join(arg('output'), 'lausanne-bus-review.svg'), svg)
await writeFile(join(arg('output'), 'lausanne-bus-review.json'), JSON.stringify({ schemaVersion: 1, serviceDates: input.metadata.serviceDates, graphSha256: createHash('sha256').update(graphBytes).digest('hex'), matcher: cache.metadata.matcher, maximumSnapMetres: ranked[0].metres, largestSnaps: ranked.slice(0, 20), panels }, null, 2) + '\n')
console.log(JSON.stringify({ largestSnaps: ranked.slice(0, 5), panels: panels.map(p => p.name) }, null, 2))
