import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

// Diagnostic only: measure disconnected components without changing geometry.
const bytes = await readFile('data/fribourg-sources/decoded.json.gz')
const source = JSON.parse(gunzipSync(bytes))
const features = []
for (const id of [128, 22, 16, 10]) {
  const feature = source.lines.find(f => f.properties.OBJECTID === id)
  const paths = feature.geometry.coordinates, parent = new Map(), points = new Map()
  const key = p => JSON.stringify(p)
  for (const path of paths) for (const point of path) { parent.set(key(point), key(point)); points.set(key(point), point) }
  const root = p => { while (parent.get(p) !== p) { parent.set(p, parent.get(parent.get(p))); p = parent.get(p) } return p }
  for (const path of paths) for (let i = 1; i < path.length; i++) parent.set(root(key(path[i - 1])), root(key(path[i])))
  const components = [...new Set([...parent.keys()].map(root))]
  const ends = [...new Set(paths.flatMap(path => [key(path[0]), key(path.at(-1))]))].map(p => points.get(p))
  const edges = paths.flatMap((path, part) => path.slice(1).map((b, i) => ({ a: path[i], b, part, edge: i })))
  const nearest = new Map()
  for (const point of ends) for (const { a, b, part, edge } of edges) {
    const from = components.indexOf(root(key(point))), to = components.indexOf(root(key(a)))
    if (from === to) continue
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const fraction = dx || dy ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0
    const projection = [a[0] + fraction * dx, a[1] + fraction * dy]
    const metres = Math.hypot(point[0] - projection[0], point[1] - projection[1]), pair = [from, to].sort((a, b) => a - b).join(':')
    if (!nearest.has(pair) || metres < nearest.get(pair).metres) nearest.set(pair, { components: [from, to], metres, point, projection, targetPart: part, targetEdge: edge, fraction })
  }
  features.push({ sourceId: id, name: feature.properties.NOM_LIGNE, parts: paths.length, components: components.length,
    nearestEndpointToOtherComponent: [...nearest.values()].sort((a, b) => a.metres - b.metres) })
}
await writeFile('data/fribourg-audit/topology-followup.json', JSON.stringify({
  sourceSha256: createHash('sha256').update(bytes).digest('hex'), sourceCrs: 'EPSG:2056',
  method: 'Original exact-vertex components; minimum source-part endpoint to segment distance for each component pair. This diagnoses gaps, not physical connectivity or road direction.', features,
}, null, 2) + '\n')
console.log('Recorded original-source component gaps for lines 1, 9, 2 and S20/S21')
