import { readFile, writeFile } from 'node:fs/promises'
import { loadLuzernBorderRail } from './luzern-border-rail.mjs'
const policy = JSON.parse(await readFile('data/luzern-policy.json'))
const border = await loadLuzernBorderRail(policy.borderRailFallback)
const [reverse, forward] = [...border.pairs.values()]
const panels = [
  { title: 'Kreuzlingen → Konstanz', path: forward.path, note: 'Full 1,284 m path · KR → KRGR → KODB · all source vertices retained' },
  { title: 'Konstanz → Kreuzlingen', path: reverse.path, note: 'Reverse direction independently rebuilt · KODB → KRGR → KR' },
  { title: 'Kreuzlingen · GTFS platform 2', path: forward.path.slice(0, 9), note: '47.3 m station connector · original GTFS platform retained', start: true },
  { title: 'Konstanz · original GTFS stop', path: forward.path.slice(-9), note: '77.9 m station connector · original GTFS stop retained', end: true },
]
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1080" viewBox="0 0 1400 1080"><style>text{font-family:Arial,sans-serif;fill:#233d50}.title{font-size:22px;font-weight:600}.small{font-size:15px}</style><rect width="1400" height="1080" fill="#f3f6f8"/><text x="25" y="38" class="title">Luzern · SBB Konstanz border geometry review</text><text x="25" y="64" class="small">Teal: publisher curve · orange: GTFS station attachments · red: original timetable stop</text>'
for (const [i, panel] of panels.entries()) {
  const p = panel.path, cos = Math.cos(p[0][1] * Math.PI / 180), xs = p.map(p => p[0] * cos), ys = p.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const x = i % 2 * 700, y = 85 + Math.floor(i / 2) * 445
  const scale = Math.min(570 / (maxX - minX || .001), 295 / (maxY - minY || .001))
  const pos = p => [x + 350 + (p[0] * cos - (minX + maxX) / 2) * scale, y + 235 - (p[1] - (minY + maxY) / 2) * scale]
  const line = (path, color) => `<polyline points="${path.map(p => pos(p).map(n => n.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="3"/>`
  svg += `<rect x="${x + 10}" y="${y}" width="680" height="430" rx="8" fill="white" stroke="#d6e0e8"/><text x="${x + 25}" y="${y + 29}" class="title">${panel.title}</text>`
  svg += line(p, '#087f88')
  if (i < 2 || panel.start) svg += line(p.slice(0, 2), '#ce7614')
  if (i < 2 || panel.end) svg += line(p.slice(-2), '#ce7614')
  const labels = i < 2 ? [[p[0], 'START'], [p.at(-1), 'END']] : [[panel.start ? p[0] : p.at(-1), 'GTFS'], [panel.start ? p[1] : p.at(-2), 'SBB endpoint']]
  for (const [pt, label] of labels) { const [px, py] = pos(pt); svg += `<circle cx="${px}" cy="${py}" r="4" fill="#b53435"/><text x="${px + 9}" y="${py - 9}" class="small">${label}</text>` }
  svg += `<text x="${x + 25}" y="${y + 410}" class="small">${panel.note}</text>`
}
svg += '<text x="25" y="1010" class="small">SBB Infrastructure / data.sbb.ch · terms_by · catalogue modified 2026-07-29 · data processed 2026-09-02</text><text x="25" y="1035" class="small">Retrieved 2026-09-08 · timetable: SBB / opentransportdata.swiss · no individual feature survey date established</text><text x="25" y="1060" class="small">Graphical station alignments and bounded connectors; no basemap, platform-track or signalling certification.</text></svg>\n'
await writeFile('docs/luzern-border-rail-review.svg', svg)
