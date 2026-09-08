import { readFile, writeFile } from 'node:fs/promises'
const a = JSON.parse(await readFile('data/fribourg-audit/broc.json'))
const nodes = new Map(a.sourceInventory.nodes.map(n => [n.id, n.coordinate]))
const xy = p => [55 + (p[0] - 7.0977) / 0.0013 * 510, 540 - (p[1] - 46.6036) / 0.00075 * 430]
const line = ps => ps.map((p, i) => `${i ? 'L' : 'M'}${xy(p).map(n => n.toFixed(2)).join(',')}`).join(' ')
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="700" viewBox="0 0 1120 700"><defs><clipPath id="map"><rect x="30" y="110" width="565" height="455" rx="10"/></clipPath><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="#215aa8"/></marker></defs><rect width="1120" height="700" fill="#fff"/><g font-family="Arial,sans-serif" fill="#183347"><text x="30" y="40" font-size="25" font-weight="700">Broc-Village: original arrival call → platform B</text><text x="30" y="73" font-size="15">TPF 260 • 4 and 6 September 2026 • both calls and their eight-minute interval retained</text><g clip-path="url(#map)"><rect x="30" y="110" width="565" height="455" fill="#f3f6f8"/>`
for (const way of a.sourceInventory.ways) svg += `<path d="${line(way.nodes.map(id => nodes.get(id)))}" fill="none" stroke="#b4bfc7" stroke-width="7"/>`
svg += `<path d="${line(a.geometry.path.slice(1, 3))}" fill="none" stroke="#215aa8" stroke-width="4" marker-end="url(#arrow)"/>`
for (const ps of [a.geometry.path.slice(0, 2), a.geometry.path.slice(2)]) svg += `<path d="${line(ps)}" fill="none" stroke="#bc6516" stroke-width="3" stroke-dasharray="5 4"/>`
for (const [i, s] of a.policy.stops.entries()) {
  const [x, y] = xy(s)
  svg += `<circle cx="${x}" cy="${y}" r="6" fill="#fff" stroke="#183347" stroke-width="2"/><text x="${x + (i ? 12 : -145)}" y="${y + (i ? -8 : 24)}" font-size="14">${i ? 'Departure B / 19835' : 'Arrival record 10'}</text>`
}
svg += `</g><text x="625" y="142" font-size="19" font-weight="700">A short, source-backed connection</text>`
const notes = ['Grey: original station road context', 'Blue: 9.2 m along one-way OSM road 1395561049', 'Dashed: original-call connectors, 8.0 m / 4.4 m', 'Total inferred geometry: 21.6 m', '', 'TPF’s plan identifies B for Charmey–Jaun.', 'The unlabelled arrival is not assigned to A.', 'The timetable keeps separate arrival/departure rows.', '', 'All ten full route patterns were reviewed.', 'Only the two contributing contexts change.', 'Reverse calls and platform C remain unchanged.', '', 'No loop or turnaround is introduced.', 'The eight-minute wait is not proof of movement.', 'Original coordinates and times are preserved.']
for (const [i, t] of notes.entries()) svg += `<text x="625" y="${178 + i * 23}" font-size="14">${t}</text>`
svg += `<text x="30" y="604" font-size="14">© OpenStreetMap contributors, ODbL 1.0 • selected object edits predate both fixtures; survey vintage unknown.</text><text x="30" y="629" font-size="14">TPF platform plan and timetable are identity / call-order evidence only. No schematic map geometry extracted.</text><text x="30" y="654" font-size="14">Inference is scoped to the original directed pair: at most 10 m per attachment and 35 m total. General limits unchanged.</text><text x="30" y="679" font-size="13">Diagram checks geometry continuity. It does not establish the vehicle’s physical arrival position or movement during its wait.</text></g></svg>`
await writeFile('docs/assets/fribourg-broc.svg', svg + '\n')
