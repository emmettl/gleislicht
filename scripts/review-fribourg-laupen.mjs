import { readFile, writeFile } from 'node:fs/promises'
const a = JSON.parse(await readFile('data/fribourg-audit/laupen.json'))
const nodes = new Map(a.sourceInventory.nodes.map(n => [n.id, n.coordinate]))
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
const colours = ['#215aa8', '#734caa', '#c26312']
const points = a.assessments.flatMap(p => p.path)
function panel(x, y, w, h, bounds) {
  const [xmin, ymin, xmax, ymax] = bounds
  const scale = Math.min(w / ((xmax - xmin) * 0.684), h / (ymax - ymin))
  const dx = (w - (xmax - xmin) * 0.684 * scale) / 2, dy = (h - (ymax - ymin) * scale) / 2
  const xy = p => [x + dx + (p[0] - xmin) * 0.684 * scale, y + h - dy - (p[1] - ymin) * scale]
  const line = ps => ps.map((p, i) => `${i ? 'L' : 'M'}${xy(p).map(n => n.toFixed(2)).join(',')}`).join(' ')
  let svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#f4f6f8"/>`
  for (const way of a.sourceInventory.ways) svg += `<path d="${line(way.nodes.map(id => nodes.get(id)))}" stroke="#c4ccd4" stroke-width="5" fill="none"/>`
  for (const [i, p] of a.assessments.entries()) svg += `<path d="${line(p.path)}" stroke="${colours[i]}" stroke-width="${i === 0 ? 5 : 2.5}" ${i === 2 ? 'stroke-dasharray="9 5"' : ''} fill="none"/>`
  for (const [i, p] of a.assessments.entries()) for (const f of [0.35, 0.68]) {
    const k = Math.floor((p.path.length - 3) * f)
    svg += `<path d="${line(p.path.slice(k, k + 3))}" stroke="${colours[i]}" stroke-width="2" fill="none" marker-end="url(#arrow${i})"/>`
  }
  return { svg, xy, line }
}
const min = i => Math.min(...points.map(p => p[i])), max = i => Math.max(...points.map(p => p[i]))
const bounds = [min(0) - 0.0006, min(1) - 0.0005, max(0) + 0.0006, max(1) + 0.0005]
const full = panel(30, 135, 750, 570, bounds), inset = panel(815, 180, 355, 275, [7.24125, 46.90105, 7.24265, 46.9019])
function label(panel, p, text, dx = 8, dy = -10) {
  const [x, y] = panel.xy(p)
  return `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="#172e42" stroke-width="2"/><text x="${x + dx}" y="${y + dy}" font-size="13">${esc(text)}</text>`
}
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="860" viewBox="0 0 1200 860"><defs>${colours.map((c, i) => `<marker id="arrow${i}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10" fill="${c}"/></marker>`).join('')}<clipPath id="full"><rect x="30" y="135" width="750" height="570"/></clipPath><clipPath id="inset"><rect x="815" y="180" width="355" height="275"/></clipPath></defs><rect width="1200" height="860" fill="#fff"/><g font-family="Arial,sans-serif" fill="#172e42"><text x="30" y="40" font-size="25" font-weight="700">Laupen: PostAuto 121 western construction bypass</text><text x="30" y="68" font-size="15">Both fixture dates • complete original calls • independently reconstructed directed OSM roads</text>`
for (const [i, text] of ['Arrival 83983: 1.882 km', 'Arrival 602697: 1.914 km', 'Departure 602697: 2.348 km'].entries()) svg += `<path d="M${30 + i * 390},103 h32" stroke="${colours[i]}" stroke-width="4" ${i === 2 ? 'stroke-dasharray="8 4"' : ''}/><text x="${72 + i * 390}" y="108" font-size="14">${text}</text>`
svg += `<g clip-path="url(#full)">${full.svg}</g><g clip-path="url(#inset)">${inset.svg}</g><text x="835" y="161" font-size="17" font-weight="700">Station loop detail</text>`
svg += label(full, a.policy.pairs[0].stops[0], 'Tuftera → Laupen', 10, 20)
svg += label(full, a.policy.pairs[2].stops[1], 'Laupen → Tuftera', 10, 20)
svg += label(full, a.policy.pairs[1].stops[1], 'Laupen Bahnhof', -145, -15)
const bridge = nodes.get('12135658365'); svg += label(full, bridge, 'Western temporary road bridge', 10, -12)
svg += label(inset, a.policy.pairs[0].stops[1], '83983', -55, -18)
svg += label(inset, a.policy.pairs[1].stops[1], '602697', -25, 30)
svg += `<text x="835" y="489" font-size="16" font-weight="700">Three original platform pairs</text>`
const lines = ['Arrival uses the one-way entrance.', 'Departure continues around the loop.', 'Distinct arrival calls are not merged.', '', 'Original platform → source road node:', '5.1 / 4.4 m for arrival 83983', '5.1 / 9.6 m for arrival 602697', '9.6 / 8.4 m for departure 602697', '', 'North is up. Context roads: selected OSM ways.']
for (const [i, line] of lines.entries()) svg += `<text x="835" y="${516 + i * 19}" font-size="13">${esc(line)}</text>`
svg += `<text x="30" y="742" font-size="15" font-weight="700">Source evidence and limits</text><text x="30" y="770" font-size="14">© OpenStreetMap contributors, ODbL 1.0 • 29 retained road ways • object edit dates are not survey dates.</text><text x="30" y="794" font-size="14">Kanton Bern / Gemeinde Laupen works notice identifies the western diversion; its schematic map supplies no geometry.</text><text x="30" y="818" font-size="14">Closed Sense bridge, temporary footbridge and parking shortcuts excluded. Inferred centreline paths; running lanes unverified.</text><text x="30" y="842" font-size="13">Diagram reviews continuity and direction. It is not independent operational evidence or a certification of temporary road access.</text></g></svg>`
await writeFile('docs/assets/fribourg-laupen.svg', svg + '\n')
