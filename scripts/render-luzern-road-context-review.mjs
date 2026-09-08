import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const audit = await json('data/luzern-study-audit.json'), day = audit.days[0]
const manifest = await json(`${day.artifacts.directory}/luzern-region-day-manifest.json`)
const trains = new Map()
for (const chunk of manifest.chunks) for (const train of (await json(`${day.artifacts.directory}/${chunk.path}`)).trains) trains.set(train.id, train)
const contexts = day.directedStopPairs.filter(p => p.geometrySource === 'osm-road-pattern-inference').sort((a, b) => a.roadPatternId.localeCompare(b.roadPatternId))
assert.equal(contexts.length, 2)
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="820" viewBox="0 0 1280 820"><style>text{font-family:Arial,sans-serif;fill:#213c50}.small{font-size:14px}.heading{font-size:20px;font-weight:bold}</style><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#b65316"/></marker></defs><rect width="1280" height="820" fill="#f5f8fa"/><text x="25" y="35" font-size="25" font-weight="bold">Hochdorf 105: geometry bound to each complete stop pattern</text><text x="25" y="61" class="small">Friday 4 September 2026 · North up, same scale · Orange: reviewed OSM path · Gray: adjacent journey segments</text>'
for (const [i, pair] of contexts.entries()) {
  const pattern = day.directedPatterns.find(p => p.admitted && p.pairKeys.includes(pair.key)), train = [...trains.values()].find(t => t.patternId === pattern?.id)
  assert(train)
  const offset = pattern.pairKeys.indexOf(pair.key), first = Math.max(0, offset - 1), last = Math.min(train.pathSegments.length, offset + 2), x = i * 640
  const position = p => [x + 300 + (p[0] - 8.2917) * .68 * 95000, 380 - (p[1] - 47.1687) * 95000]
  svg += `<rect x="${x + 12}" y="88" width="616" height="630" rx="8" fill="white" stroke="#d5e0e7"/><text x="${x + 28}" y="120" class="heading">${i ? 'Inbound journey with Bahnhof loop' : 'Outbound journey from the school'}</text><text x="${x + 28}" y="146" class="small">${pattern.trips} scheduled journey${pattern.trips > 1 ? 's' : ''} · ${pattern.stopIds.length} complete source calls</text>`
  for (let j = first; j < last; j++) {
    const points = manifest.paths[train.pathSegments[j]], orange = j === offset
    svg += `<polyline points="${points.map(p => position(p).map(n => n.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${orange ? '#b65316' : '#a8b6c0'}" stroke-width="${orange ? 4 : 2}"${orange ? ' marker-mid="url(#arrow)" marker-end="url(#arrow)"' : ''}/>`
  }
  const labels = new Map()
  for (let j = first; j <= last; j++) {
    const stop = manifest.stops[train.stops[j][0]], entry = labels.get(stop[4]) ?? { stop, calls: [] }
    entry.calls.push(j + 1); labels.set(stop[4], entry)
  }
  for (const { stop, calls } of labels.values()) {
    const [px, py] = position(stop), name = stop[2].replace('Hochdorf, ', ''), right = name === 'Oberstufenzentrum'
    svg += `<circle cx="${px}" cy="${py}" r="5" fill="white" stroke="#213c50"/><text x="${px + (right ? -8 : 8)}" y="${py + (right ? 22 : -10)}" text-anchor="${right ? 'end' : 'start'}" class="small">${calls.join('/')} · ${name}</text>`
  }
  svg += `<text x="${x + 28}" y="642" class="small">Oberstufenzentrum → Bankstrasse: ${pair.lengthMetres.toFixed(1)} m</text><text x="${x + 28}" y="668" class="small">Full routing pattern: ${pair.roadPatternId}</text><text x="${x + 28}" y="694" class="small">Detail view; every other source call remains in the feed.</text>`
}
svg += '<text x="25" y="751" class="small">The common stop pair remains rejected for general reuse. Each orange path is bound to its full ordered source pattern.</text><text x="25" y="775" class="small">Inferred paths, not operator-confirmed street directions or temporary diversions. No snapping or detour limit was relaxed.</text><text x="25" y="800" class="small">© OpenStreetMap contributors (ODbL-1.0) · © rawi Kanton Luzern; © Verkehrsverbund Luzern · Timetable: SBB / opentransportdata.swiss</text></svg>\n'
await writeFile('docs/luzern-road-context-review.svg', svg)
