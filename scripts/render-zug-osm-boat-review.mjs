import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadZugOsmBoats } from './zug-osm-boats.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const policy = JSON.parse(await readFile('data/zug-policy.json')), bytes = await readFile('data/zug-timetable.json.gz')
const boats = await loadZugOsmBoats(policy.boatOsm, policy.boat, JSON.parse(gunzipSync(bytes)), sha256(bytes))
const lakes = JSON.parse(await readFile(`${policy.boat.sourceDirectory}/lakes.json`)), lake = policy.boat.lakes.find(l => l.id === 'zugersee')
const polygons = lake.shorelineFeatureIds.flatMap(id => lakes.results.find(f => String(f.id) === String(id)).geometry.coordinates)
const colours = ['#ac4326', '#196ea0'], parts = []
function panel(id, x, y, w, h, box, title) {
  const [west, south, east, north] = box, cos = Math.cos((south + north) / 2 * Math.PI / 180), scale = Math.min(w / ((east - west) * cos), h / (north - south))
  const project = p => [x + w / 2 + (p[0] - (west + east) / 2) * cos * scale, y + h / 2 - (p[1] - (south + north) / 2) * scale]
  const line = points => points.map(p => project(p).map(v => v.toFixed(2)).join(',')).join(' ')
  parts.push(`<text x="${x}" y="${y - 12}" font-size="15" font-weight="600">${title}</text><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e8e9df" stroke="#ced5cd"/><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id})">`)
  for (const polygon of polygons) parts.push(`<path d="${polygon.map(r => 'M' + line(r) + 'Z').join(' ')}" fill="#d9edf1" fill-rule="evenodd" stroke="#8eb5bd" stroke-width="1.1"/>`)
  for (const [i, pair] of boats.pairs.entries()) {
    parts.push(`<polyline points="${line(pair.path)}" fill="none" stroke="${colours[i]}" stroke-width="3"/>`)
    for (const interval of pair.water.outsideIntervals) parts.push(`<polyline points="${line(interval.endpoints)}" stroke="#d73b9a" stroke-width="5" fill="none"/>`)
    for (const p of [pair.path[0], pair.path.at(-1)]) { const [px, py] = project(p); parts.push(`<circle cx="${px}" cy="${py}" r="4" stroke="${colours[i]}" stroke-width="2" fill="white"/>`) }
    if (id !== 'overview') for (const p of [pair.path[1], pair.path.at(-2)]) { const [px, py] = project(p); parts.push(`<rect x="${px - 3}" y="${py - 3}" width="6" height="6" fill="${colours[i]}"/>`) }
  }
  parts.push('</g>')
  return (text, p, dx, dy) => { const [px, py] = project(p); parts.push(`<text x="${px + dx}" y="${py + dy}" class="label">${text}</text>`) }
}
const label = panel('overview', 30, 116, 465, 476, [8.435, 47.037, 8.551, 47.187], 'Two direct paths · original source vertices')
label('Zug Bahnhofsteg', boats.pairs[0].path[0], -126, -12)
label('Walchwil', boats.pairs[0].path.at(-1), 10, 8)
label('Risch', boats.pairs[1].path[0], -40, -10)
panel('walchwil', 530, 116, 435, 214, [8.5119, 47.09935, 8.5131, 47.10005], 'Walchwil · 5.07 m dock attachment')
panel('risch', 530, 378, 435, 214, [8.4675, 47.1335, 8.4690, 47.1343], 'Risch · 24.34 m dock attachment')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="768" viewBox="0 0 1000 768"><style>text{font-family:Arial,sans-serif;fill:#243a37}.label{font-size:13px;paint-order:stroke;stroke:#edf2ed;stroke-width:3px;stroke-linejoin:round}</style><rect width="1000" height="768" fill="#fafbf7"/><text x="30" y="38" font-size="27" font-weight="600">Zugersee: the missing direct crossings</text><text x="30" y="68" font-size="14">One Friday and two Sunday trips added · 4 / 6 September 2026 · all lake trips now covered</text>${parts.join('')}<path d="M30 620h26" stroke="${colours[0]}" stroke-width="4"/><text x="66" y="625" font-size="14">Zug → Walchwil: 8.884 km / 33 min</text><path d="M530 620h26" stroke="${colours[1]}" stroke-width="4"/><text x="566" y="625" font-size="14">Risch → Zug: 5.417 km / 20 min</text><text x="30" y="658" font-size="13">Circles: original GTFS stops. Squares: mapped dock nodes. Pink: disclosed outside-water intervals.</text><text x="30" y="684" font-size="13">Every outside interval lies in an actual endpoint dock zone. Inferred paths; no sailing-lane certification.</text><text x="30" y="718" font-size="12">Ferry paths: © OpenStreetMap contributors · ODbL 1.0 · historical snapshot 2026-09-02 00:00 UTC</text><text x="30" y="742" font-size="12">Shoreline: © FOEN, swisstopo · status 2007-01-01 · timetable: SBB / opentransportdata.swiss · Gleislicht</text></svg>`
await writeFile('docs/assets/zug-osm-boat-review.svg', svg)
console.log('Wrote docs/assets/zug-osm-boat-review.svg')
