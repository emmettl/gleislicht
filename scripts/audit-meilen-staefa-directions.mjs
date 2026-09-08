import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { destinationCandidates, orientDestination } from './validate-cantonal-road-directions.mjs'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'
const hash = value => createHash('sha256').update(value).digest('hex')
export function reviewMeilenDestinations(geometry, sources) {
  const candidates = sources.destinations.flatMap(source => {
    const url = new URL(source.url)
    if (!['Rapperswil SG', 'Rapperswil BE'].includes(source.name) || url.origin !== 'https://api3.geo.admin.ch' || url.searchParams.get('searchText') !== source.name || url.searchParams.get('contains') !== 'false' || url.searchParams.get('sr') !== '2056' || hash(JSON.stringify(source.response)) !== source.sha256) throw new Error('Destination source changed')
    return destinationCandidates(source.name, source.response)
  })
  if (sources.destinations.length !== 2 || new Set(candidates.map(c => c.name)).size !== 2) throw new Error('Both qualified destinations are required')
  return ['ZH.CH:0591', 'ZH.CH:1091'].map(stationId => {
    const station = geometry.stations.find(s => s.id === stationId)
    const path = geometry.paths.find(p => p.id === station.match.pathId)
    return { stationId, detectorId: `${stationId}.02`, ...orientDestination(station.preciseLv95, path.points.map(([lon, lat]) => wgs84ToLv95(lon, lat)), candidates) }
  })
}
async function main() {
  const files = ['public/data/zurich-cantonal-road-topology.json', 'data/lakeside-road-review-sources.json']
  const bodies = await Promise.all(files.map(file => readFile(file, 'utf8')))
  const detectors = reviewMeilenDestinations(...bodies.map(body => JSON.parse(body)))
  await writeFile('data/meilen-staefa-direction-review.json', JSON.stringify({ sourceHashes: Object.fromEntries(files.map((file, i) => [file, hash(bodies[i])])), status: 'requires-road-continuation', scope: 'Original Zürich geometry only; the subsequent St. Gallen continuation review is recorded in data/meilen-staefa-continuation-review.json', reason: 'Qualified place names resolve the regional destination, but it remains 2522.39 m from the available road axis, above the unchanged 1500 m gate. Further road-continuation evidence is needed before direction validation.', detectors }, null, 2)+'\n')
  console.log(detectors.map(d => ({ stationId: d.stationId, status: d.status, destinationRoadDistanceMetres: d.destinationRoadDistanceMetres })))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
