import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { loadLuzernBoats } from './luzern-boat-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const json = async p => JSON.parse(await readFile(p)), audit = await json('data/luzern-study-audit.json')
const boats = await loadLuzernBoats(audit.policy.boatFallback), stops = new Map(boats.inputs.stops.map(s => [s.stop_id, s]))
const coord = id => { const s = stops.get(id); return [+s.stop_lon, +s.stop_lat] }
const panels = [
  { pattern: 'bc4b5960463e19f1f791', title: 'Hallwilersee · complete 7-call circuit' },
  { pattern: 'e73dedbec0bb24abf736', title: 'Hallwilersee · complete Sunday 9-call circuit' },
  { pattern: '59818ee86bd94f352d0e', title: 'Luzern–Kehrsiten · admitted shuttle' },
  { pattern: '0df0bf8b8c62b09e644e', title: 'Luzern–Meggenhorn · complete 6-call journey' },
  { pairNames: ['Greppen', 'Meggen (See)'], title: 'Greppen–Meggen · rejected land crossing', rejected: true },
  { pairNames: ['Seengen (See)', 'Meisterschwanden Delphin'], title: 'Hallwilersee · disclosed dock-area discrepancies', detail: true },
]
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1510" viewBox="0 0 1400 1510"><style>text{font-family:Arial,sans-serif;fill:#253b49}.title{font-size:20px;font-weight:600}.small{font-size:14px}</style><rect width="1400" height="1510" fill="#f3f6f8"/><text x="25" y="35" class="title">Luzern · cartographic shipping geometry and shoreline review</text><text x="25" y="60" class="small">Teal: admitted path · red: rejected path · orange: outside-water intervals · numbered dots: original GTFS calls</text>'
for (const [i, panel] of panels.entries()) {
  let ids, paths, results
  if (panel.pattern) {
    const p = boats.patterns.find(p => p.id === panel.pattern); assert(p)
    ids = p.stopIds; results = ids.slice(1).map((id, j) => boats.pairs.get(JSON.stringify([p.routeId, ids[j], id])))
    assert(results.every(r => r.path)); paths = results.map(r => r.path)
  } else {
    const [key, r] = [...boats.pairs].find(([key]) => { const [, a, b] = JSON.parse(key); return stops.get(a).stop_name === panel.pairNames[0] && stops.get(b).stop_name === panel.pairNames[1] })
    ids = JSON.parse(key).slice(1); results = [r]
    if (r.path) paths = [r.path]
    else { const path = matchBaselSegment(boats.lakes.get(r.lake).graph, ...ids.map(coord), boats.policy.limits).path; assert.equal(sha256(JSON.stringify(path)), r.rejectedGeometrySha256); paths = [path] }
  }
  const lake = boats.lakes.get(results[0].lake), points = paths.flat(), cos = Math.cos(points[0][1] * Math.PI / 180)
  const extent = panel.detail ? [coord(ids[0]), ...results[0].water.outsideIntervals.filter(r => r.dock === 0).flatMap(r => r.endpoints)] : points
  const xs = extent.map(p => p[0] * cos), ys = extent.map(p => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const x = i % 2 * 700, y = 80 + Math.floor(i / 2) * 445, scale = Math.min(585 / (maxX - minX || .001), 290 / (maxY - minY || .001))
  const pos = p => [x + 350 + (p[0] * cos - (minX + maxX) / 2) * scale, y + 215 - (p[1] - (minY + maxY) / 2) * scale]
  const line = (p, color, width = 2.5) => `<polyline points="${p.map(p => pos(p).map(n => n.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}"/>`
  svg += `<rect x="${x + 10}" y="${y}" width="680" height="430" rx="8" fill="white" stroke="#ccd7df"/><text x="${x + 24}" y="${y + 29}" class="title">${panel.title}</text><defs><clipPath id="c${i}"><rect x="${x + 24}" y="${y + 45}" width="650" height="325"/></clipPath></defs><g clip-path="url(#c${i})">`
  for (const polygon of lake.polygons) {
    const d = polygon.map(ring => ring.map((p, i) => `${i ? 'L' : 'M'}${pos(p).map(n => n.toFixed(2)).join(' ')}`).join(' ') + ' Z').join(' ')
    svg += `<path d="${d}" fill="#e6f1f7" stroke="#9dbbca" stroke-width="1" fill-rule="evenodd"/>`
  }
  for (const path of paths) svg += line(path, panel.rejected ? '#c33f47' : '#008580')
  for (const result of results) for (const interval of result.water.outsideIntervals) svg += line(interval.endpoints, '#da8117', panel.detail ? 5 : 4)
  const groups = new Map()
  for (const [j, id] of ids.entries()) { const p = coord(id), key = p.join(','); if (!groups.has(key)) groups.set(key, { p, labels: [] }); groups.get(key).labels.push(j + 1) }
  for (const { p, labels } of groups.values()) { const [px, py] = pos(p); svg += `<circle cx="${px}" cy="${py}" r="3.5" fill="white" stroke="#263f50"/><text x="${px + 7}" y="${py - 7}" class="small">${labels.join('/')}</text>` }
  svg += '</g>'
  const note = panel.rejected ? 'Whole Sunday journey excluded · remote land interval outside both dock zones' : panel.detail ? 'Outside-water intervals are allowed only wholly within one 150 m dock zone' : `${ids.length} original calls · complete pattern retained · maximum dock attachment ${Math.max(...results.map(r => r.maximumSnapMetres)).toFixed(1)} m`
  svg += `<text x="${x + 24}" y="${y + 398}" class="small">${note}</text><text x="${x + 24}" y="${y + 418}" class="small">Generalized source linework · 2007 shoreline · not navigational geometry</text>`
}
svg += '<text x="25" y="1450" class="small">Shipping: © swisstopo · shoreline: © FOEN, swisstopo · timetable: SBB / opentransportdata.swiss</text><text x="25" y="1475" class="small">Geometry retrieved 2026-09-09 · source API gives no individual feature survey date · all shoreline rings retained</text><text x="25" y="1498" class="small">Dock discrepancies are explicit cartographic limitations, not evidence that boats travel over land.</text></svg>\n'
await writeFile('docs/luzern-boat-review.svg', svg)
