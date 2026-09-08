import { readFile, writeFile } from 'node:fs/promises'
const a = JSON.parse(await readFile('data/fribourg-audit/boltigen.json'))
const nodes = new Map(a.sourceInventory.nodes.map(n => [n.id, n.coordinate]))
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="#1759a7"/></marker></defs><rect width="1200" height="900" fill="white"/><g font-family="Arial,sans-serif" fill="#183347"><text x="30" y="40" font-size="26" font-weight="700">Boltigen: preserve the road’s hairpins in both directions</text><text x="30" y="72" font-size="16">TPF 259 • original directed platform pairs • 4 and 6 September 2026</text>`
for (const [i, g] of a.assessments.entries()) {
  const left = 30 + i * 600, top = 140, width = 540, height = 465
  const xy = p => [left + (p[0] - 7.3467) / 0.0065 * width, top + height - (p[1] - 46.5919) / 0.00385 * height]
  const line = ps => ps.map((p, j) => `${j ? 'L' : 'M'}${xy(p).map(n => n.toFixed(2)).join(',')}`).join(' ')
  svg += `<defs><clipPath id="map${i}"><rect x="${left}" y="${top}" width="${width}" height="${height}" rx="10"/></clipPath></defs><text x="${left}" y="117" font-size="19" font-weight="700">${i ? 'Schüpfen → Schüpfboden / towards Boltigen' : 'Schüpfboden → Schüpfen / towards Jaun'}</text><g clip-path="url(#map${i})"><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#f3f6f8"/><path d="${line(a.sourceInventory.way.nodes.map(id => nodes.get(id)))}" fill="none" stroke="#bec8cf" stroke-width="7"/><path d="${line(g.comparison.path)}" fill="none" stroke="#df983a" stroke-width="5"/><path d="${line(g.path)}" fill="none" stroke="#1759a7" stroke-width="2"/>`
  for (const ps of [g.path.slice(0, 2), g.path.slice(-2)]) svg += `<path d="${line(ps)}" fill="none" stroke="#993046" stroke-width="3" stroke-dasharray="4 3"/>`
  for (const index of [23, 48]) svg += `<path d="${line(g.path.slice(index, index + 3))}" fill="none" stroke="#1759a7" stroke-width="2" marker-end="url(#arrow)"/>`
  for (const [j, s] of a.policy.pairs[i].stops.entries()) {
    const [x, y] = xy(s), right = s[0] > 7.35
    svg += `<circle cx="${x}" cy="${y}" r="5" fill="white" stroke="#183347" stroke-width="2"/><text x="${x + (right ? -8 : 8)}" y="${y + 23}" text-anchor="${right ? 'end' : 'start'}" font-size="14">${j ? 'To' : 'From'} ${s[4].split(':').at(-1)}</text>`
  }
  svg += `</g><text x="${left}" y="637" font-size="15">${g.lengthMetres.toFixed(1)} m • ${g.path.length} vertices • ${i ? '120' : '60'}-second timetable interval</text><text x="${left}" y="662" font-size="15">Original-call attachments: ${g.attachments.map(p => p.gapMetres.toFixed(1)).join(' / ')} m</text><text x="${left}" y="687" font-size="15">Maximum compared vertex gap: ${Math.max(g.comparison.bernToOsmMetres, g.comparison.osmToBernMetres).toFixed(1)} m</text>`
}
const notes = ['Blue: emitted OSM road inference. Orange: independently matched Bern TPF line 20_259 (diagnostic only).', 'Grey: full source road context. Dashed red: original-call connectors. General matcher limits remain unchanged.', '© OpenStreetMap contributors • ODbL 1.0 • road 584938515 edited 2025-12-30; survey vintage unknown.', 'Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern', 'Bern data updated 2026-01-01; package published 2026-07-09; free use with attribution. TPF timetable valid 14.12.25–12.12.26.', 'Vertex comparison does not certify lane accuracy. Original platform identities and times are preserved.']
for (const [i, t] of notes.entries()) svg += `<text x="30" y="${739 + i * 26}" font-size="14">${escape(t)}</text>`
svg += '</g></svg>'
await writeFile('docs/assets/fribourg-boltigen.svg', svg + '\n')
