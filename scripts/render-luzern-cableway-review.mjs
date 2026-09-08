import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
const json = async path => JSON.parse(await readFile(path, 'utf8'))
const audit = await json('data/luzern-study-audit.json'), day = audit.days[0], manifest = await json(`${day.artifacts.directory}/luzern-region-day-manifest.json`)
const trains = new Map()
for (const chunk of manifest.chunks) for (const t of (await json(`${day.artifacts.directory}/${chunk.path}`)).trains) trains.set(t.id, t)
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
const choices = [['273', '2500', null, '0'], ['283', '2503'], ['283', '2505'], ['13600', '2516'], ['13600', '2517'], ['273', '2500', null, '1']]
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1440" viewBox="0 0 1400 1440"><style>text{font-family:Arial,sans-serif;fill:#19354a}.title{font-size:19px;font-weight:bold}.small{font-size:13px}</style><rect width="1400" height="1440" fill="#f7fafc"/><text x="25" y="32" font-size="24" font-weight="bold">Luzern: federal cableway geometry review · 4 September 2026</text><text x="25" y="56" class="small">Purple: FOT cableway axis · Gray: cantonal alignment · Circles: ordered source calls · North up; independent panel scales</text>'
for (let i = 0; i < choices.length; i++) {
  const [agency, line, focus, direction] = choices[i]
  const pattern = day.directedPatterns.filter(p => p.admitted && p.agencyId === agency && p.line === line && (direction === undefined || p.directionId === direction) && (!focus || focus.every(s => p.stopNames.includes(s)))).sort((a, b) => b.stopIds.length - a.stopIds.length || a.id.localeCompare(b.id))[0]
  assert(pattern)
  const train = [...trains.values()].find(t => t.patternId === pattern.id)
  assert(train)
  const range = focus ? focus.map(s => pattern.stopNames.indexOf(s)).sort((a, b) => a - b) : [0, train.stops.length - 1]
  const paths = train.pathSegments.slice(range[0], range[1]).map((p, n) => ({ points: manifest.paths[p], source: train.geometrySources[n + range[0]] }))
  const points = paths.flatMap(p => p.points), cos = Math.cos(points.reduce((n, p) => n + p[1], 0) / points.length * Math.PI / 180)
  const xs = points.map(p => p[0] * cos), ys = points.map(p => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const x = i % 2 * 700, y = 80 + Math.floor(i / 2) * 435, scale = Math.min(600 / (maxX - minX || .001), 290 / (maxY - minY || .001))
  const position = p => [x + 350 + (p[0] * cos - (minX + maxX) / 2) * scale, y + 230 - (p[1] - (minY + maxY) / 2) * scale]
  svg += `<rect x="${x + 10}" y="${y}" width="680" height="420" rx="8" fill="white" stroke="#d6e0e8"/><text x="${x + 25}" y="${y + 27}" class="title">${agency} · ${line}${focus ? ' · Gotthard corridor detail' : ''}</text><text x="${x + 25}" y="${y + 49}" class="small">${escape(pattern.stopNames[range[0]])} → ${escape(pattern.stopNames[range[1]])}</text>`
  for (const p of paths) svg += `<polyline points="${p.points.map(p => position(p).map(n => n.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${p.source === 'fot-cableway-inference' ? '#7840ad' : '#9ca8b4'}" stroke-width="2.5"/>`
  for (let n = range[0]; n <= range[1]; n++) { const [px, py] = position(manifest.stops[train.stops[n][0]]); svg += `<circle cx="${px}" cy="${py}" r="3" fill="white" stroke="#29475c"/>` }
  for (const [index, label] of [[range[0], 'START'], [range[1], 'END']]) { const [px, py] = position(manifest.stops[train.stops[index][0]]), right = px > x + 600; svg += `<text x="${px + (right ? -6 : 6)}" y="${py - 8}" text-anchor="${right ? 'end' : 'start'}" class="small">${label}</text>` }
  svg += `<text x="${x + 25}" y="${y + 402}" class="small">${focus ? 'Detail view; full feed retains' : 'Full journey retains'} ${train.stops.length} calls · 2D source axis, not observed cabins or a vertical profile</text>`
}
svg += '<text x="25" y="1410" class="small">© Federal Office of Transport (FOT) · © rawi Kanton Luzern; © Verkehrsverbund Luzern · Timetable: SBB / opentransportdata.swiss</text><text x="25" y="1430" class="small">Used installation Stand: 2025-01-01 · Catalogue: 2025-11-07 · Asset update: 2026-01-29 · No cable sag/elevation model</text></svg>\n'
await writeFile('docs/luzern-cableway-review.svg', svg)
