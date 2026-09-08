import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

// Rebuild from the saved public OSM response; normal builds never query Overpass.
const sourceFile = 'data/orbital-tunnel-sources/osm.json.gz'
const bytes = await readFile(sourceFile), source = JSON.parse(gunzipSync(bytes))
const tunnels = source.elements.filter(e => e.type === 'way' && e.geometry?.length >= 2 && ['rail', 'narrow_gauge', 'subway', 'funicular'].includes(e.tags?.railway) && e.tags.tunnel && e.tags.tunnel !== 'no').map(e => ({
  id: e.id, name: e.tags['tunnel:name'] ?? e.tags.name ?? '', railway: e.tags.railway,
  coordinates: e.geometry.map(p => [p.lon, p.lat]),
}))
// The Swiss mirror clips at the border. Retain the already pinned public
// Simplon extract for the Italian half and its southern portal.
const simplonFile = 'data/aargau-simplon-sources/osm.json.gz'
const simplonBytes = await readFile(simplonFile), simplon = JSON.parse(gunzipSync(simplonBytes))
const nodes = new Map(simplon.elements.filter(e => e.type === 'node').map(e => [e.id, [e.lon, e.lat]]))
const simplonWays = simplon.elements.filter(e => e.type === 'way' && e.tags?.railway === 'rail' && e.tags.tunnel === 'yes' && /Simplontunnel|Traforo del Sempione/.test(e.tags['tunnel:name'] ?? e.tags.name ?? ''))
const known = new Set(tunnels.map(t => t.id))
for (const e of simplonWays) if (!known.has(e.id)) tunnels.push({ id: e.id, name: e.tags['tunnel:name'] ?? e.tags.name, railway: 'rail', coordinates: e.nodes.map(id => nodes.get(id)) })
const portal = (id, end) => {
  const way = tunnels.find(t => t.id === id)
  if (!way) throw new Error(`Missing reviewed portal way ${id}`)
  return end === 'first' ? way.coordinates[0] : way.coordinates.at(-1)
}
// Reviewed long, coarse timetable chords. Project the real portals onto that
// chord only if it passes close to BOTH portals in the correct direction.
// This does not remap or replace any source timetable geometry.
const summit = tunnels.filter(t => t.name === 'Gotthard-Scheiteltunnel').flatMap(t => t.coordinates).sort((a, b) => a[1] - b[1])
const coarsePassages = [
  { name: 'Simplon', portals: [portal(795403745, 'first'), portal(795403748, 'last')], sourceWays: [795403745, 795403748] },
  { name: 'Gotthard summit', portals: [summit[0], summit.at(-1)], sourceName: 'Gotthard-Scheiteltunnel' },
]
const metadata = {
  source: 'https://overpass.osm.ch/api/interpreter', retrieved: '2026-09-08',
  supplement: { sourceFile: simplonFile, sha256: createHash('sha256').update(simplonBytes).digest('hex'), snapshot: '2026-09-08T00:00:00Z' },
  sourceFile, sha256: createHash('sha256').update(bytes).digest('hex'),
  sourceState: source.osm3s, attribution: '© OpenStreetMap contributors', license: 'https://www.openstreetmap.org/copyright',
  queryFile: 'data/orbital-tunnel-sources/query.overpass',
  model: 'Mapped rail-tunnel centre lines, current Swiss Overpass extract; not a historical timetable-date snapshot or surveyed vertical alignment.',
}
await writeFile('public/data/orbital-tunnels.json', JSON.stringify({ version: 1, metadata, tunnels, coarsePassages }))
console.log(JSON.stringify({ tunnels: tunnels.length, ...metadata }))
