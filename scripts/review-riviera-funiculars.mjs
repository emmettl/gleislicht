import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { loadRivieraFuniculars } from './riviera-funicular-geometry.mjs'

const { source } = await loadRivieraFuniculars()
const manifest = JSON.parse(await readFile('data/riviera-region/2026-09-13/riviera-region-day-manifest.json', 'utf8'))
const trains = (await Promise.all(manifest.chunks.map(async chunk => JSON.parse(await readFile(`data/riviera-region/2026-09-13/${chunk.path}`, 'utf8')).trains))).flat()
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="800"><rect width="1440" height="800" fill="#0b1020"/><style>text{font-family:Arial;fill:#e8efff}</style><text x="24" y="36" font-size="24">Riviera funicular geometry · 13 September 2026</text><text x="24" y="66" font-size="15">Grey: official FOT axis · cyan: scheduled paths · white: GTFS stops · pink: stop attachments</text>'
for (const [i, policy] of source.routes.entries()) {
  const report = manifest.metadata.funicularGeometry.routes.find(row => row.routeId === policy.routeId)
  assert(report && report.maximumSnapMetres <= policy.maximumSnapMetres)
  const axis = policy.segment.lines[0], coordinates = [...axis, ...report.stops.map(stop => stop.coordinate)]
  const west = Math.min(...coordinates.map(p => p[0])), east = Math.max(...coordinates.map(p => p[0]))
  const south = Math.min(...coordinates.map(p => p[1])), north = Math.max(...coordinates.map(p => p[1]))
  const cos = Math.cos((south + north) / 2 * Math.PI / 180)
  const scale = Math.min(320 / ((east - west) * cos), 410 / (north - south))
  const x = 24 + i * 472, y = 90
  const xy = p => [x + 226 + (p[0] - (west + east) / 2) * cos * scale, y + 290 - (p[1] - (south + north) / 2) * scale]
  const line = points => points.map((p, j) => `${j ? 'L' : 'M'}${xy(p).map(v => v.toFixed(2)).join(' ')}`).join(' ')
  svg += `<rect x="${x}" y="${y}" width="448" height="650" fill="#101a2d" stroke="#35445e"/><text x="${x + 14}" y="${y + 28}" font-size="18">${escape(policy.feature.name)}</text><text x="${x + 14}" y="${y + 51}" font-size="13">FOT ${policy.installation} · ${report.trips} journeys · north ↑</text><path d="${line(axis)}" fill="none" stroke="#8996ad" stroke-width="7"/>`
  const paths = new Set(trains.filter(t => t.routeId === policy.routeId).flatMap(t => t.pathSegments))
  assert(paths.size > 0)
  for (const id of paths) svg += `<path d="${line(manifest.paths[id])}" fill="none" stroke="#5ef3ee" stroke-width="2"/>`
  for (const [j, stop] of report.stops.entries()) {
    const [sx, sy] = xy(stop.coordinate)
    svg += `<path d="${line([stop.coordinate, stop.point])}" stroke="#ff94bb" stroke-width="3"/><circle cx="${sx}" cy="${sy}" r="4" fill="white"/><text x="${sx + 8}" y="${sy - 6}" font-size="12">${j + 1}</text><text x="${x + 14}" y="${y + 522 + j * 18}" font-size="13">${j + 1}. ${escape(stop.name)} · ${stop.snapMetres.toFixed(1)} m</text>`
  }
}
svg += '<text x="24" y="773" font-size="14">© Federal Office of Transport. Source axes are 2D: no passing loops, elevation, live positions or operator verification.</text></svg>'
await writeFile('docs/assets/riviera-funicular-geometry-review.svg', svg)
