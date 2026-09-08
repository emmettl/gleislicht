// Screening evidence only. This never supplies paths to the regional feed.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { inWater, distanceMetres } from './water-paths.mjs'

const directory = 'data/thurgau-water-review'
await mkdir(directory, { recursive: true })
const bytes = process.argv[2] ? await readFile(process.argv[2]) : gunzipSync(await readFile(`${directory}/lake-artifact.json.gz`))
const artifact = JSON.parse(bytes), lake = artifact.lakes.find(l => l.id === '124' && l.name === 'Bodensee')
if (!lake) throw new Error('Missing reviewed lake identity')
await writeFile(`${directory}/lake-artifact.json.gz`, gzipSync(bytes, { mtime: 0 }))
const raw = JSON.parse(gunzipSync(await readFile('data/thurgau-audit/timetable-cache.json.gz')))
const boatRoutes = new Set(raw.routes.filter(r => r.mode === 'ferry').map(r => r.id)), stops = new Map()
const days = raw.snapshots.map(d => {
  const trains = d.trains.filter(t => boatRoutes.has(t.routeId))
  for (const t of trains) for (const [i] of t.stops) stops.set(d.stops[i][4], d.stops[i])
  return { date: d.metadata.serviceDate, journeys: trains.length, routes: [...new Set(trains.map(t => t.routeId))].sort() }
})
if (boatRoutes.size !== 7 || days.some(d => !d.journeys)) throw new Error('Changed ferry scope')
function shoreDistance(stop) {
  if (lake.polygons.some(p => inWater(stop, p))) return 0
  let nearest = Infinity
  const scale = Math.cos(stop[1] * Math.PI / 180)
  for (const polygon of lake.polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], dx = (b[0] - a[0]) * scale, dy = b[1] - a[1]
    const norm = dx * dx + dy * dy
    if (!norm) continue
    const t = Math.max(0, Math.min(1, ((stop[0] - a[0]) * scale * dx + (stop[1] - a[1]) * dy) / norm))
    nearest = Math.min(nearest, distanceMetres(stop, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]))
  }
  return nearest
}
const report = { reviewed: '2026-09-08', artifactSha256: createHash('sha256').update(bytes).digest('hex'),
  source: artifact.metadata, lakeId: lake.id, days,
  decision: 'screened-not-admitted',
  reasons: ['Existing display artifact uses 60 m shoreline simplification and labels its reference edition 2007; its geometry is not an acquired unsimplified dock/river routing source.',
    'Lake area geometry alone does not establish boat alignments or connecting Rhine channels. Full river and foreign dock calls must remain intact.',
    'Distances below screen the existing display polygon only; they are not verified dock-access links or a proposal to relax an admission limit.'],
  nextEvidence: 'Acquire unsimplified water geometry including islands, connecting Rhine channels and foreign docks; verify attribution, dates, full directed dock chains and inferred access offsets before enabling a separate water adapter.',
  stops: [...stops.values()].map(s => ({ id: s[4], name: s[2], coordinate: s.slice(0, 2), inDisplayLake: lake.polygons.some(p => inWater(s, p)), distanceToDisplayWaterMetres: shoreDistance(s) })).sort((a, b) => a.id.localeCompare(b.id)) }
await writeFile(`${directory}/review.json`, JSON.stringify(report, null, 2) + '\n')
console.log({ days, stops: stops.size, outsideDisplayLake: report.stops.filter(s => !s.inDisplayLake).length, fartherThan150Metres: report.stops.filter(s => s.distanceToDisplayWaterMetres > 150).length })
