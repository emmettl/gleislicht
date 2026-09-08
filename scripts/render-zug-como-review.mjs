import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadZugComoRail } from './zug-como-rail.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const policy = JSON.parse(await readFile('data/zug-policy.json')), bytes = await readFile('data/zug-timetable.json.gz')
const rail = await loadZugComoRail(policy.railComo, JSON.parse(gunzipSync(bytes)), sha256(bytes))
const osm = JSON.parse(gunzipSync(await readFile(`${policy.railComo.sourceDirectory}/osm.json.gz`)))
const nodes = new Map(osm.elements.filter(e => e.type === 'node').map(n => [n.id, [n.lon, n.lat]]))
const eligible = new Set(rail.inventory.filter(w => !w.reason).map(w => w.id))
const ways = osm.elements.filter(e => e.type === 'way' && eligible.has(e.id)).map(w => w.nodes.map(id => nodes.get(id)))
const colours = ['#b64428', '#176b98'], parts = []
const panel = (id, x, y, width, height, bounds, title) => {
  const [west, south, east, north] = bounds, scale = Math.cos((north + south) / 2 * Math.PI / 180)
  const factor = Math.min(width / ((east - west) * scale), height / (north - south))
  const project = p => [x + width / 2 + (p[0] - (west + east) / 2) * scale * factor, y + height / 2 - (p[1] - (south + north) / 2) * factor]
  const line = points => points.map(p => project(p).map(n => n.toFixed(2)).join(',')).join(' ')
  parts.push(`<text x="${x}" y="${y - 16}" class="panel">${title}</text><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#f0f2ed" stroke="#d2d7d0"/><clipPath id="${id}"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath><g clip-path="url(#${id})">`)
  for (const way of ways) parts.push(`<polyline points="${line(way)}" fill="none" stroke="#b9c2ba" stroke-width="1.3"/>`)
  for (const [i, pair] of rail.pairs.entries()) parts.push(`<polyline points="${line(pair.path)}" fill="none" stroke="${colours[i]}" stroke-width="${id === 'overview' ? 3.2 : 2.4}" opacity=".85"/>`)
  for (const [i, pair] of rail.pairs.entries()) for (const point of [pair.path[0], pair.path.at(-1)]) {
    const [px, py] = project(point)
    parts.push(`<circle cx="${px}" cy="${py}" r="5" fill="white" stroke="${colours[i]}" stroke-width="2"/>`)
  }
  parts.push('</g>')
  return (text, point, dx, dy) => { const [px, py] = project(point); parts.push(`<text x="${px + dx}" y="${py + dy}" class="label">${text}</text>`) }
}
const label = panel('overview', 30, 125, 445, 390, [9.023, 45.805, 9.079, 45.836], 'Passenger corridor through Monte Olimpino I')
label('Chiasso', [9.03196729, 45.83187573], -4, -15)
label('Como S. Giovanni', [9.07271488, 45.80896877], -135, 22)
label('Monte Olimpino I', [9.054, 45.822], -110, -15)
const detail = panel('detail', 510, 125, 440, 390, [9.029, 45.829, 9.041, 45.833], 'Chiasso: separate original platform coordinates')
detail('Platform 6 • northbound arrival', [9.03079050, 45.83204473], 0, -20)
detail('Platform 1 • southbound departure', [9.03196729, 45.83187573], 0, 25)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="980" height="665" viewBox="0 0 980 665"><style>text{font-family:Arial,sans-serif;fill:#263931}.panel{font-size:15px;font-weight:600}.label{font-size:12px;paint-order:stroke;stroke:#f0f2ed;stroke-width:3px;stroke-linejoin:round}</style><rect width="980" height="665" fill="#fafbf7"/><text x="30" y="39" font-size="27" font-weight="600">Chiasso–Como: reviewed rail corridor</text><text x="30" y="67" font-size="14">52 complete EC trips • Friday 4 September / Sunday 6 September 2026 • 16 distinct full patterns</text>${parts.join('')}<path d="M30 547h28" stroke="${colours[0]}" stroke-width="4"/><text x="68" y="552" font-size="14">Southbound: 4.124 km / 6 min</text><path d="M510 547h28" stroke="${colours[1]}" stroke-width="4"/><text x="548" y="552" font-size="14">Northbound: 4.229 km / 7 min</text><text x="30" y="588" font-size="13">Grey: eligible mapped rail. Coloured: reviewed paths, including small stop-to-track attachments.</text><text x="30" y="612" font-size="13">Corridor inference; this review does not certify the actual running track or its permitted direction.</text><text x="30" y="641" font-size="12">© OpenStreetMap contributors · ODbL 1.0 · snapshot 2026-09-02 00:00 UTC · retrieved 2026-09-08 · Gleislicht</text></svg>`
await mkdir('docs/assets', { recursive: true })
await writeFile('docs/assets/zug-como-rail-review.svg', svg)
console.log('Wrote docs/assets/zug-como-rail-review.svg')
