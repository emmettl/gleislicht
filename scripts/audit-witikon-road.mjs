import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditUnmatchedRoads, loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'
import { buildCantonalRoadTopology, projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const round = value => Math.round(value * 100) / 100
const ends = feature => [feature.geometry.coordinates[0], feature.geometry.coordinates.at(-1)]

// Endpoint connectivity only. Crossings, near misses and road-number equality
// do not create edges. Vertex order is irrelevant and implies no travel direction.
export function connectedRoadFeatures(features, seedId) {
  if (new Set(features.map(f => f.properties.strass_id)).size !== features.length || !features.some(f => f.properties.strass_id === seedId)) throw new Error('Invalid named-road component identities')
  const reached = new Set([seedId]), queue = [features.find(f => f.properties.strass_id === seedId)]
  while (queue.length) {
    const current = queue.shift()
    for (const candidate of features) {
      if (reached.has(candidate.properties.strass_id) || !ends(current).some(a => ends(candidate).some(b => distance(a, b) <= 0.01))) continue
      reached.add(candidate.properties.strass_id)
      queue.push(candidate)
    }
  }
  return [...reached].sort((a, b) => a - b)
}

export function auditWitikonRoad(inputs, batchScope, source, scope) {
  if (scope.schemaVersion !== 1 || scope.batchScopeSha256 !== digest(batchScope) || scope.classifiedSourceSha256 !== digest(source)) throw new Error('Witikon review scope changed')
  const batch = auditUnmatchedRoads(inputs, batchScope)
  const station = inputs.geometry.stations.find(s => s.id === 'ZH.CH:1101')
  const point = station.preciseLv95
  const record = batch.stations.find(s => s.id === station.id)
  if (record.candidates[0].featureId !== 7870 || record.candidates[0].roadNumber !== '30051' || record.candidates[0].ownership !== 'Stadt Zürich') throw new Error('Witikon city-axis evidence changed')
  const url = new URL(source.url)
  if (url.origin !== 'https://maps.zh.ch' || url.pathname !== '/wfs/TBAStrZHWFS' || url.searchParams.get('TYPENAMES') !== 'ms:haupt-und-nebenstrassen' || url.searchParams.get('BBOX') !== '2688600,1246200,2689200,1246600,EPSG:2056') throw new Error('Unexpected Witikon classified source')
  const classified = validateGeoCollection(source.collection, 'Witikon classified roads')
  if (classified.length !== 1 || classified[0].properties.achsnummer !== '742') throw new Error('Witikon classified network changed')
  const rebuilt = buildCantonalRoadTopology(inputs.catalog, inputs.sources.stations, source.collection, { collectors: inputs.sources.collectors })
  if (digest(rebuilt.stations.find(s => s.id === station.id)) !== digest(station)) throw new Error('Witikon original station match changed')
  const city = inputs.sources.axes.features.find(f => f.properties.strass_id === 7870)
  const canton = inputs.sources.axes.features.find(f => f.properties.strass_id === 2697)
  const connection = city.geometry.coordinates.at(-1)
  if (!canton || canton.properties.stradatnam.trim() !== '742' || !ends(canton).some(p => distance(p, connection) <= 0.01) || distance(classified[0].geometry.coordinates[0], connection) > 0.01) throw new Error('City-to-canton endpoint connection changed')
  const selected = inputs.sources.axes.features.filter(f => ['30051', '742'].includes(f.properties.stradatnam.trim()))
  const componentIds = connectedRoadFeatures(selected, 7870)
  const component = selected.filter(f => componentIds.includes(f.properties.strass_id))
  const coverage = new Map(inputs.coverage.stationSummaries.map(s => [s.id, s]))
  const relatedCounters = inputs.geometry.stations.filter(s => s.preciseLv95).flatMap(s => {
    const nearest = selected.map(f => ({ featureId: f.properties.strass_id, hit: projectOnRoad(s.preciseLv95, f.geometry.coordinates) })).sort((a, b) => a.hit.distance - b.hit.distance || a.featureId - b.featureId)[0]
    if (nearest.hit.distance > 25) return []
    const observed = coverage.get(s.id)
    if (!observed) throw new Error(`Missing station coverage: ${s.id}`)
    const componentDistance = Math.min(...component.map(f => projectOnRoad(s.preciseLv95, f.geometry.coordinates).distance))
    return [{ id: s.id, name: s.name, nearestDetailedFeatureId: nearest.featureId, nearestDistanceMetres: round(nearest.hit.distance), withinReviewedComponentTolerance: componentDistance <= 25, distanceToReviewedComponentMetres: round(componentDistance), originalGeometryStatus: s.geometryStatus, observations: { completeMinutes: observed.completeMinutes, longestRunMinutes: observed.longestRunMinutes, detectorIssueMinutes: observed.detectorIssueMinutes }, directionAudit: inputs.directions.stationAudit.find(a => a.id === s.id) }]
  }).sort((a, b) => a.id.localeCompare(b.id))
  const connectedCounters = relatedCounters.filter(s => s.withinReviewedComponentTolerance)
  if (connectedCounters.length !== 1 || connectedCounters[0].id !== station.id) throw new Error('Named-road counter candidates changed; review paired coverage')
  const cityHit = projectOnRoad(point, city.geometry.coordinates)
  return {
    schemaVersion: 1, status: 'review-only-no-publication', scope,
    stationId: station.id, name: station.name, stationPointLv95: point,
    localConnection: { cityRoad: '30051', cityFeatureId: 7870, cantonRoad: '742', cantonFeatureId: 2697, sharedEndpointLv95: connection, stationToConnectionMetres: round(cityHit.totalLength - cityHit.offset), cityFeatureLengthMetres: round(cityHit.totalLength), cityAxisDistanceMetres: round(cityHit.distance), classifiedAxisDistanceMetres: station.candidates[0].distanceMetres, status: 'exact-endpoint-connection-observed' },
    namedRoadNetwork: { roadNumbers: ['30051', '742'], sourceFeatureCount: selected.length, componentFeatureIds: componentIds, componentFeatureCount: component.length, otherFeatureIds: selected.filter(f => !componentIds.includes(f.properties.strass_id)).map(f => f.properties.strass_id).sort((a, b) => a - b), endpointToleranceMetres: 0.01, counterSearchToleranceMetres: 25 },
    relatedCounters,
    recordingReadiness: 'no-supported-counter-pair',
    requiredEvidence: 'An independently reviewed second counter and simultaneous complete observations on a reviewed connecting route, followed by direction and junction checks. City-road inclusion alone is insufficient.',
    limitation: 'Connectivity is restricted to the published 30051 and 742 features and their endpoints; this is not a claim that the wider road network is disconnected. No links across other road numbers, geometry gaps or line crossings are synthesized. Nearby counters and station-only coverage do not establish a playback pair. No station is moved and no topology, travel direction or playback is emitted.',
  }
}

async function main() {
  const read = async file => JSON.parse(await readFile(file, 'utf8'))
  const result = auditWitikonRoad(await loadUnmatchedRoadInputs(), await read('data/cantonal-unmatched-road-scope.json'), await read('data/witikon-road-review-sources.json'), await read('data/witikon-road-review-scope.json'))
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/witikon-road-review.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ localConnection: result.localConnection, componentFeatures: result.namedRoadNetwork.componentFeatureCount, relatedCounters: result.relatedCounters.map(s => ({ id: s.id, connected: s.withinReviewedComponentTolerance, completeMinutes: s.observations.completeMinutes })), recordingReadiness: result.recordingReadiness }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
