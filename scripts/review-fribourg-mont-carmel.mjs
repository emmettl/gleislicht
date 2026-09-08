import { readFile, writeFile } from 'node:fs/promises'
const audit = JSON.parse(await readFile('data/fribourg-audit/mont-carmel.json'))
const { geometry, policy, sourceInventory } = audit
const nodes = new Map(sourceInventory.nodes.map(n => [n.id, n.coordinate]))
const all = [...nodes.values(), ...policy.stops.map(s => s.slice(0, 2))]
const west = Math.min(...all.map(p => p[0])), north = Math.max(...all.map(p => p[1]))
const width = (Math.max(...all.map(p => p[0])) - west) * 0.684, height = north - Math.min(...all.map(p => p[1]))
const scale = Math.min(780 / width, 330 / height), dx = (1120 - width * scale) / 2, dy = 145 + (330 - height * scale) / 2
const xy = p => [dx + (p[0] - west) * 0.684 * scale, dy + (north - p[1]) * scale]
const path = ps => ps.map((p, i) => `${i ? 'L' : 'M'}${xy(p).map(n => n.toFixed(2)).join(',')}`).join(' ')
const draw = (ps, color, stroke, extra = '') => `<path d="${path(ps)}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" ${extra}/>`
const original = sourceInventory.ways.map(w => draw(w.nodes.map(id => nodes.get(id)), '#b9c5ce', 10)).join('')
const reviewed = draw(geometry.path, '#b9581e', 4)
const arrows = [4, 10, 16, geometry.path.length - 3].map(i => draw(geometry.path.slice(i, i + 2), '#b9581e', 3, 'marker-end="url(#arrow)"')).join('')
const markers = policy.stops.map((s, i) => {
  const [x, y] = xy(s), label = i ? '15108 · final call' : '15107 · arrival call'
  return `<circle cx="${x}" cy="${y}" r="6" fill="#174b6c" stroke="white" stroke-width="2"/><text x="${x - 165}" y="${y + (i ? 30 : -18)}" font-size="18" font-weight="bold">${label}</text>`
}).join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="660" viewBox="0 0 1120 660"><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="#b9581e"/></marker></defs><rect width="1120" height="660" fill="#f1f5f7"/><g font-family="Arial, sans-serif" fill="#253c4d"><text x="28" y="40" font-size="26" font-weight="bold">TPF 3 · Mont-Carmel terminal movement</text><text x="28" y="72" font-size="16">North up · original platform calls preserved · arrows follow the OSM one-way roads and roundabout</text><text x="28" y="102" font-size="14">Grey: three source ways · orange: reviewed 132.7 m movement · blue: original GTFS call coordinates</text>${original}${reviewed}${arrows}${markers}<text x="28" y="528" font-size="16">74 Friday + 72 Sunday journeys added; all have 60 seconds between these two original calls.</text><text x="28" y="559" font-size="14">Platform-to-source connectors: 5.5 m / 4.6 m. No intersecting restriction in the retained bounding-box response.</text><text x="28" y="589" font-size="14">Inferred centreline turnaround; operator manoeuvre, running lanes and temporary access are not certified.</text><text x="28" y="626" font-size="12">© OpenStreetMap contributors · ODbL 1.0 · public API snapshot acquired 8 September 2026 · timetable: opentransportdata.swiss</text><text x="28" y="646" font-size="12">OSM object edit dates are retained separately; they do not establish physical survey dates.</text></g></svg>`
await writeFile('docs/assets/fribourg-mont-carmel.svg', svg)
console.log('Generated Mont-Carmel terminal source review')
