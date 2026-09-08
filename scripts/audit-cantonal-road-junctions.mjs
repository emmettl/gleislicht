import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'
import { projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'

export function junctionCandidates(path, roadAxis, collection) {
  const features = validateGeoCollection(collection, 'junction road axes')
  const points = path.map(([lon, lat]) => wgs84ToLv95(lon, lat))
  const candidates = []
  for (const feature of features) {
    if (feature.geometry?.type !== 'LineString') throw new Error('Unexpected road-axis geometry')
    const axis = feature.properties.stradatnam?.trim()
    if (axis === roadAxis) continue
    for (const coordinate of [feature.geometry.coordinates[0], feature.geometry.coordinates.at(-1)]) {
      const hit = projectOnRoad(coordinate, points)
      if (hit.distance > 15 || hit.offset < 25 || hit.offset > hit.totalLength - 25) continue
      candidates.push({ axis: axis || 'municipal', sourceId: feature.properties.strass_id, coordinate, offsetMetres: hit.offset, separationMetres: hit.distance })
    }
  }
  const groups = []
  for (const candidate of candidates.sort((a, b) => a.offsetMetres - b.offsetMetres)) {
    const group = groups.at(-1)
    if (group && candidate.offsetMetres - group.members.at(-1).offsetMetres <= 30) group.members.push(candidate)
    else groups.push({ members: [candidate] })
  }
  return groups.map(({ members }) => ({
    offsetMetres: Math.round(members.reduce((n, m) => n + m.offsetMetres, 0) / members.length),
    axes: [...new Set(members.map(m => m.axis))].sort(),
    sourceIds: [...new Set(members.map(m => m.sourceId))].sort((a, b) => a - b),
    members,
    status: 'geometric-junction-candidate',
  }))
}
async function main() {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  const sources = JSON.parse(await readFile(arg('sources') ?? 'data/zurich-cantonal-road-junction-sources.json', 'utf8'))
  const reports = sources.entries.map(entry => {
    if (createHash('sha256').update(JSON.stringify(entry.collection)).digest('hex') !== entry.sha256) throw new Error('Junction source hash mismatch')
    return { id: entry.id, road: entry.road, sourceUrl: entry.url, sourceSha256: entry.sha256, junctions: junctionCandidates(entry.path, entry.road.slice(3), entry.collection) }
  })
  await writeFile(arg('output') ?? 'data/zurich-cantonal-road-junction-audit.json', JSON.stringify({ metadata: { schemaVersion: 1, fetchedAt: sources.fetchedAt, method: 'Other-axis endpoints within 15 m of the counter path; group approaches within 30 m along the path; exclude 25 m at counter ends.', limitation: 'Geometric candidates, not surveyed legal turn movements. The official road model omits some municipal roads and private access. No junction flow is measured.' }, reports }) + '\n')
  console.log(JSON.stringify(reports.map(r => ({ id: r.id, junctions: r.junctions.map(j => ({ offsetMetres: j.offsetMetres, axes: j.axes })) })), null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
