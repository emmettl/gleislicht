import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
const json = async path => JSON.parse(await readFile(path, 'utf8'))
const audit = await json('data/luzern-study-audit.json')
const panels = []
for (const day of audit.days) {
  const manifest = await json(`${day.artifacts.directory}/luzern-region-day-manifest.json`), trains = new Map()
  for (const chunk of manifest.chunks) for (const t of (await json(`${day.artifacts.directory}/${chunk.path}`)).trains) trains.set(t.id, t)
  const pairs = new Map(day.directedStopPairs.map(p => [p.key, p]))
  for (const pattern of day.directedPatterns.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometrySource === 'osm-access-road-inference'))) {
    const train = [...trains.values()].find(t => t.patternId === pattern.id)
    const centerIndex = pattern.stopNames.findIndex(n => /Kantonsschule|Witebach|Entlebuch, Bahnhof/.test(n))
    assert(train && centerIndex > 0 && centerIndex < train.stops.length - 1)
    panels.push({ day, manifest, pattern, train, centerIndex })
  }
}
assert.equal(panels.length, 4)
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1320" viewBox="0 0 1400 1320"><style>text{font-family:Arial,sans-serif;fill:#19394b}.small{font-size:14px}.title{font-size:20px;font-weight:bold}</style><rect width="1400" height="1320" fill="#f5f8fa"/><text x="25" y="35" font-size="25" font-weight="bold">Luzern: four complete bus journeys recovered at three stops</text><text x="25" y="62" class="small">Local path details · North up · Same scale · Orange: newly admitted road pair · Gray: existing journey geometry</text>'
for (const [i, p] of panels.entries()) {
  const { day, manifest, pattern, train, centerIndex } = p, cx = i % 2 * 700, cy = 86 + Math.floor(i / 2) * 570
  const center = manifest.stops[train.stops[centerIndex][0]], position = point => [cx + 350 + (point[0] - center[0]) * Math.cos(center[1] * Math.PI / 180) * 100000, cy + 290 - (point[1] - center[1]) * 100000]
  svg += `<rect x="${cx + 12}" y="${cy}" width="676" height="550" rx="8" fill="white" stroke="#d5dfe6"/><text x="${cx + 27}" y="${cy + 30}" class="title">${pattern.line} · ${escape(center[2])}</text><text x="${cx + 27}" y="${cy + 55}" class="small">${day.date} · direction ${pattern.directionId} · ${pattern.stopIds.length} complete source calls</text><defs><clipPath id="clip${i}"><rect x="${cx + 24}" y="${cy + 80}" width="650" height="405"/></clipPath><marker id="arrow${i}" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5" fill="#b55517"/></marker></defs><g clip-path="url(#clip${i})">`
  for (let j = 0; j < train.pathSegments.length; j++) {
    const orange = train.geometrySources[j] === 'osm-access-road-inference', path = manifest.paths[train.pathSegments[j]]
    svg += `<polyline points="${path.map(point => position(point).map(n => n.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${orange ? '#b55517' : '#a8b5be'}" stroke-width="${orange ? 3 : 1.7}"${orange ? ` marker-mid="url(#arrow${i})"` : ''}/>`
  }
  for (let j = 0; j < train.stops.length; j++) {
    const stop = manifest.stops[train.stops[j][0]], [x, y] = position(stop)
    if (x < cx + 30 || x > cx + 635 || y < cy + 95 || y > cy + 475) continue
    svg += `<circle cx="${x}" cy="${y}" r="4" fill="white" stroke="#19394b"/><text x="${x + 8}" y="${y - 9}" class="small">Call ${j + 1}</text>`
  }
  svg += `</g><text x="${cx + 27}" y="${cy + 510}" class="small">${escape(pattern.stopNames[centerIndex - 1])} → call ${centerIndex + 1} →</text><text x="${cx + 27}" y="${cy + 533}" class="small">${escape(pattern.stopNames[centerIndex + 1])} · ${pattern.trips} admitted journey</text>`
}
svg += '<text x="25" y="1255" class="small">All 19 routing patterns retained. 20 m station candidates and edge snapping; measured maximum attachment 15.1 m.</text><text x="25" y="1279" class="small">Inferred roads and short platform attachments; not operator-confirmed street directions or temporary diversions.</text><text x="25" y="1304" class="small">© OpenStreetMap contributors (ODbL-1.0) · © rawi Kanton Luzern; © Verkehrsverbund Luzern · Timetable: SBB / opentransportdata.swiss</text></svg>\n'
await writeFile('docs/luzern-access-road-review.svg', svg)
