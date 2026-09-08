import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDirectionTopology, destinationCandidates } from './validate-cantonal-road-directions.mjs'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'
const hash = value => createHash('sha256').update(value).digest('hex')
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const STATIONS = ['ZH.CH:0591', 'ZH.CH:1091']

export function buildMeilenDirections(geometry, catalog, baseline, sources, review) {
  if (review.schemaVersion !== 1 || review.pathId !== 'ZH:17:48a84c6fa4e6ad9c' || review.placesSha256 !== hash(JSON.stringify(baseline.places)) || review.collectionSha256 !== hash(JSON.stringify(review.collection))) throw new Error('Continuation evidence changed')
  const url = new URL(review.url)
  if (url.origin !== 'https://services.geo.sg.ch' || url.pathname !== '/wss/service/SG00098_WFS/guest' || url.searchParams.get('TYPENAMES') !== 'SG00098:Kantonsstrassen' || url.searchParams.get('SRSNAME') !== 'EPSG:2056' || review.collection.crs?.properties?.name !== 'EPSG:2056') throw new Error('Unexpected continuation source or CRS')
  const features = review.collection.features.filter(f => f.properties?.GmlID === review.selectedFeatureId && f.properties?.Nummer === 'KS17')
  if (features.length !== 1 || review.selectedFeatureId !== 'Kantonsstrassen.8' || review.reverse !== true || features[0].geometry?.type !== 'MultiLineString' || features[0].geometry.coordinates.length !== 1) throw new Error('Ambiguous road continuation')
  const extension = [...features[0].geometry.coordinates[0]].reverse()
  if (extension.length < 2 || extension.some((p, i) => p.length !== 2 || !p.every(Number.isFinite) || p[0] < 2400000 || p[0] > 2900000 || p[1] < 1000000 || p[1] > 1400000 || (i > 0 && distance(extension[i - 1], p) > 500))) throw new Error('Invalid road continuation geometry')
  const originalPath = geometry.paths.find(p => p.id === review.pathId)
  const points = originalPath.points.map(([lon, lat]) => wgs84ToLv95(lon, lat))
  const joinMetres = distance(points.at(-1), extension[0])
  if (joinMetres > 5 || distance(points.at(-1), extension.at(-1)) < 500) throw new Error('Road continuation does not join the original endpoint')
  if (review.stations.length !== 2 || new Set(review.stations.map(s => s.id)).size !== 2 || review.stations.some(s => !STATIONS.includes(s.id))) throw new Error('Unexpected reviewed station')
  const candidates = sources.destinations.flatMap(source => {
    const u = new URL(source.url)
    if (!['Rapperswil SG', 'Rapperswil BE'].includes(source.name) || u.origin !== 'https://api3.geo.admin.ch' || u.searchParams.get('layer') !== 'ch.swisstopo.swissnames3d' || u.searchParams.get('searchText') !== source.name || u.searchParams.get('contains') !== 'false' || u.searchParams.get('sr') !== '2056' || source.sha256 !== hash(JSON.stringify(source.response))) throw new Error('Destination evidence changed')
    return destinationCandidates(source.name, source.response)
  })
  if (sources.destinations.length !== 2 || new Set(candidates.map(c => c.name)).size !== 2) throw new Error('Both regional alternatives are required')
  const automatic = buildDirectionTopology(geometry, catalog, baseline.places)
  for (const station of review.stations) {
    const audit = automatic.stationAudit.find(s => s.id === station.id)
    if (audit.pathId !== review.pathId || hash(JSON.stringify(audit.detectors)) !== station.detectorAuditSha256 || audit.detectors.find(d => d.id === `${station.id}.01`)?.status !== 'validated') throw new Error('Pinned station evidence changed')
  }
  const places = { ...baseline.places, entries: baseline.places.entries.map(entry => entry.name === 'Rapperswil' ? { ...entry, candidates } : entry) }
  const contexts = new Map(STATIONS.map(id => [id, { points: [...points, ...extension], places }]))
  const result = buildDirectionTopology(geometry, catalog, baseline.places, [], contexts)
  for (const stationId of STATIONS) {
    const station = result.stationAudit.find(s => s.id === stationId)
    if (station.status !== 'validated' || station.detectors.find(d => d.id === `${stationId}.02`)?.direction !== 'positive') throw new Error('Reviewed direction still fails geometry checks')
    station.detectors.find(d => d.id === `${stationId}.02`).review = { method: 'qualified-destination-and-official-axis-continuation', originalStatus: 'unresolved-destination', continuationFeatureId: review.selectedFeatureId }
  }
  result.metadata.directionContinuation = { pathId: review.pathId, stationIds: STATIONS, sourceUrl: review.url, featureId: review.selectedFeatureId, joinMetres, note: 'Continuation is used only for direction verification. Playback sections retain original Zürich geometry.' }
  return result
}
async function main() {
  const files = ['public/data/zurich-cantonal-road-topology.json', 'data/zurich-cantonal-road-counters.json', 'data/zurich-cantonal-road-directions.json', 'data/lakeside-road-review-sources.json', 'data/meilen-staefa-axis-continuation.json']
  const bodies = await Promise.all(files.map(file => readFile(file, 'utf8')))
  const values = bodies.map(body => JSON.parse(body)), review = values[4]
  if (hash(bodies[0]) !== review.baseGeometrySha256 || hash(bodies[1]) !== review.catalogSha256) throw new Error('Pinned topology or catalog changed')
  const result = buildMeilenDirections(...values)
  result.metadata.directionReviewSha256 = hash(bodies[4])
  result.metadata.directionInputHashes = Object.fromEntries(files.map((file, i) => [file, hash(bodies[i])]))
  const output = process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? '/tmp/meilen-staefa-directions.json'
  await writeFile(output, JSON.stringify(result)+'\n')
  await writeFile('data/meilen-staefa-continuation-review.json', JSON.stringify({ status: 'validated-for-pilot', sourceHashes: result.metadata.directionInputHashes, continuation: result.metadata.directionContinuation, detectors: result.stationAudit.filter(s => STATIONS.includes(s.id)), sections: result.sections.filter(s => s.road === 'ZH:17').map(({ path, ...section }) => ({ ...section, pathPoints: path.length })), limitation: 'Two geometric junction areas were reviewed separately. Individual trajectories and turning flows are not measured.' }, null, 2)+'\n')
  console.log(JSON.stringify({ ...result.metadata.directionCoverage, continuation: result.metadata.directionContinuation }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
