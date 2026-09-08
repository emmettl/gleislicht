import { readFile, writeFile } from 'node:fs/promises'
const a = JSON.parse(await readFile('data/fribourg-audit/portalban.json'))
const nodes = new Map(a.sourceInventory.nodes.map(n => [n.id, n.coordinate]))
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="#1759a7"/></marker></defs><rect width="1200" height="800" fill="white"/><g font-family="Arial,sans-serif" fill="#183347"><text x="30" y="40" font-size="25" font-weight="700">Portalban: retain the street bends between school and village</text><text x="30" y="72" font-size="16">TPF 544 • two directed original platform pairs • all nine contributing full contexts</text>`
for (const [i, g] of a.assessments.entries()) {
  const left = 30 + i * 600, top = 140, width = 540, height = 360
  const xy = p => [left + (p[0] - 6.9549) / 0.00155 * width, top + height - (p[1] - 46.91755) / 0.00073 * height]
  const line = ps => ps.map((p, j) => `${j ? 'L' : 'M'}${xy(p).map(n => n.toFixed(2)).join(',')}`).join(' ')
  svg += `<defs><clipPath id="map${i}"><rect x="${left}" y="${top}" width="${width}" height="${height}" rx="10"/></clipPath></defs><text x="${left}" y="117" font-size="19" font-weight="700">${i ? 'Village 15627 → école 1 / towards Fribourg' : 'École 1 → village 15626 / towards Gletterens'}</text><g clip-path="url(#map${i})"><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#f3f6f8"/>`
  for (const w of a.sourceInventory.ways) svg += `<path d="${line(w.nodes.map(id => nodes.get(id)))}" fill="none" stroke="#c6cdd1" stroke-width="7"/>`
  for (const ps of new Set(g.originalPaths.map(p => JSON.stringify(p.path)))) svg += `<path d="${line(JSON.parse(ps))}" fill="none" stroke="#c55b67" stroke-width="2" stroke-dasharray="6 5"/>`
  svg += `<path d="${line(g.path)}" fill="none" stroke="#1759a7" stroke-width="3"/>`
  for (const index of [5, 10]) svg += `<path d="${line(g.path.slice(index, index + 3))}" fill="none" stroke="#1759a7" stroke-width="3" marker-end="url(#arrow)"/>`
  for (const [j, s] of a.policy.pairs[i].stops.entries()) {
    const [x, y] = xy(s)
    svg += `<circle cx="${x}" cy="${y}" r="5" fill="white" stroke="#183347" stroke-width="2"/><text x="${x + 10}" y="${y - 12}" font-size="14">${j ? 'To' : 'From'} ${s[2].split(', ')[1]}</text>`
  }
  svg += `</g><text x="${left}" y="532" font-size="15">${g.lengthMetres.toFixed(1)} m • ${g.path.length} vertices • ${g.contributingPatterns.length} complete contexts</text><text x="${left}" y="558" font-size="15">Original-call attachments: ${g.attachments.map(p => p.gapMetres.toFixed(1)).join(' / ')} m</text><text x="${left}" y="584" font-size="15">Every added journey retains its one-minute interval.</text>`
}
const notes = ['Blue: reconstructed OSM street geometry. Dashed red: differing original matcher paths retained as rejected evidence.', 'Grey: Chemin du Four → Chemin du Ruisseau → La Râpe. Exact street-node joins; no generic limit change.', '© OpenStreetMap contributors • ODbL 1.0 • selected way edits 2025-06-15 to 2026-01-17; survey vintage unknown.', 'TPF TRAFIC: annual timetable supports both call orders. Original GTFS platform identities, coordinates and times retained.', 'Street-centreline inference does not establish bus lanes, a school platform position or a physical turnaround.', 'Friday adds 12 journeys. Sunday has no school-call patterns and retains all 34 admitted route-544 journeys.']
for (const [i, t] of notes.entries()) svg += `<text x="30" y="${640 + i * 26}" font-size="14">${t}</text>`
svg += '</g></svg>'
await writeFile('docs/assets/fribourg-portalban.svg', svg + '\n')
