import { readFile, writeFile } from 'node:fs/promises'
const a = JSON.parse(await readFile('data/fribourg-audit/bulle.json'))
const nodes = new Map(a.sourceInventory.nodes.map(n => [n.id, n.coordinate]))
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="#1759a7"/></marker></defs><rect width="1200" height="900" fill="white"/><g font-family="Arial,sans-serif" fill="#183347"><text x="30" y="40" font-size="25" font-weight="700">Bulle: follow the directed station exit from platforms L and M</text><text x="30" y="72" font-size="16">TPF 258 / 454 • six complete contributing contexts • original calls and six-minute Bulle–Vuadens intervals</text>`
for (const [i, g] of a.assessments.entries()) {
  const left = 30 + i * 600, top = 140, width = 540, height = 420
  const xy = p => [left + (p[0] - 7.05145) / 0.0019 * width, top + height - (p[1] - 46.6198) / 0.0011 * height]
  const line = ps => ps.map((p, j) => `${j ? 'L' : 'M'}${xy(p).map(n => n.toFixed(2)).join(',')}`).join(' ')
  svg += `<defs><clipPath id="map${i}"><rect x="${left}" y="${top}" width="${width}" height="${height}" rx="10"/></clipPath></defs><text x="${left}" y="117" font-size="19" font-weight="700">${i ? '454 from M / 15898' : '258 from L / 15884'} → Vuadens</text><g clip-path="url(#map${i})"><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#f3f6f8"/>`
  for (const w of a.sourceInventory.ways) svg += `<path d="${line(w.nodes.map(id => nodes.get(id)))}" fill="none" stroke="#c6cdd1" stroke-width="6"/>`
  for (const ps of new Set(g.originalPaths.map(p => JSON.stringify(p.path)))) svg += `<path d="${line(JSON.parse(ps))}" fill="none" stroke="#c55b67" stroke-width="2" stroke-dasharray="6 5"/>`
  svg += `<path d="${line(g.commonTail.slice(0, 2))}" fill="none" stroke="#327653" stroke-width="4"/><path d="${line(g.prefix.path)}" fill="none" stroke="#1759a7" stroke-width="3"/>`
  for (const index of [4, 12, 28]) svg += `<path d="${line(g.prefix.path.slice(index, index + 3))}" fill="none" stroke="#1759a7" stroke-width="3" marker-end="url(#arrow)"/>`
  for (const [p, label, offset] of [[g.prefix.path[0], i ? 'M' : 'L', 15], [g.commonTail[0], 'Fixed Pâla join', -12]]) {
    const [x, y] = xy(p); svg += `<circle cx="${x}" cy="${y}" r="5" fill="white" stroke="#183347" stroke-width="2"/><text x="${x + 10}" y="${y + offset}" font-size="14">${label}</text>`
  }
  svg += `</g><text x="${left}" y="592" font-size="15">Local exit: ${g.prefix.lengthMetres.toFixed(1)} m • original-platform connector ${g.prefix.attachmentMetres.toFixed(1)} m</text><text x="${left}" y="618" font-size="15">Source-to-tail join: ${(g.prefix.joinMetres * 100).toFixed(1)} cm • full pair ${(g.lengthMetres / 1000).toFixed(3)} km</text><text x="${left}" y="644" font-size="15">25 original tail vertices retained; destination connector 2.3 cm.</text>`
}
const notes = ['Blue: reconstructed forward source roads. Green: unchanged common path towards Vuadens (continues outside view).', 'Dashed red: differing original matcher paths. Grey: source roads, including opposing approaches used only as context.', 'Seven no-U-turn relations checked against traversed transitions. TPF station roads require explicit bus=designated.', '© OpenStreetMap contributors • ODbL 1.0 • selected road/node edits predate both fixtures; survey vintage unknown.', 'TPF station plan created 2026-02-09 confirms 258 at L and 454 at M. No schematic map geometry extracted.', 'This is inferred road geometry, not operator-certified running lanes or temporary traffic arrangements.']
for (const [i, t] of notes.entries()) svg += `<text x="30" y="${710 + i * 26}" font-size="14">${t}</text>`
svg += '</g></svg>'
await writeFile('docs/assets/fribourg-bulle.svg', svg + '\n')
