import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditUnmatchedRoads, loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'
import { buildCantonalRoadTopology, projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'
import { DIRECTION_GATES, destinationCandidates, directionDestination, orientDestination } from './validate-cantonal-road-directions.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const round = value => Math.round(value * 100) / 100
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

// Shared interior XY vertices are crossing evidence, never connectivity or
// road-level evidence. Endpoints and nearby, non-shared vertices are excluded.
export function sharedInteriorVertices(a, b) {
  const result = []
  for (const point of a.slice(1, -1)) {
    if (b.slice(1, -1).some(other => distance(point, other) <= 0.01) && !result.some(other => distance(point, other) <= 0.01)) result.push(point)
  }
  return result.sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

export function auditLindau2491Road(inputs, batchScope, sources, scope) {
  if (scope.schemaVersion !== 1 || scope.batchScopeSha256 !== digest(batchScope) || scope.sourcesSha256 !== digest(sources)) throw new Error('Lindau 2491 review scope changed')
  const batch = auditUnmatchedRoads(inputs, batchScope)
  const station = inputs.geometry.stations.find(s => s.id === 'ZH.CH:2491')
  const record = batch.stations.find(s => s.id === station.id)
  if (station.geometryStatus !== 'ambiguous-road' || record.candidates.slice(0, 3).map(c => c.featureId).join('|') !== '2634|623|614') throw new Error('Lindau competing geometry changed')
  const url = new URL(sources.classified.url)
  if (url.origin !== 'https://maps.zh.ch' || url.pathname !== '/wfs/TBAStrZHWFS' || url.searchParams.get('TYPENAMES') !== 'ms:haupt-und-nebenstrassen' || url.searchParams.get('SRSNAME') !== 'EPSG:2056' || url.searchParams.get('BBOX') !== '2693300,1253800,2693900,1254400,EPSG:2056') throw new Error('Unexpected Lindau classified source')
  const classified = validateGeoCollection(sources.classified.collection, 'Lindau classified roads')
  if (classified.length !== 4 || classified.map(f => f.properties.achsnummer).sort().join('|') !== '1|766|A1|A1') throw new Error('Lindau classified identities changed')
  const rebuilt = buildCantonalRoadTopology(inputs.catalog, inputs.sources.stations, sources.classified.collection, { collectors: inputs.sources.collectors })
  if (digest(rebuilt.stations.find(s => s.id === station.id)) !== digest(station) || rebuilt.paths.some(p => digest(p) !== digest(inputs.geometry.paths.find(old => old.id === p.id)))) throw new Error('Lindau original match or paths changed')
  const originalNames = inputs.directions.places.entries.find(p => p.name === 'Lindau')
  if (sources.names.url !== originalNames.url || !Array.isArray(sources.names.response.results) || sources.names.response.results.length >= 200) throw new Error('Unexpected or saturated Lindau names response')
  const names = destinationCandidates('Lindau', sources.names.response)
  if (digest(names) !== digest(originalNames.candidates) || names.length !== 4) throw new Error('Lindau settlement alternatives changed')
  const axes = record.candidates.slice(0, 3).map(c => {
    const f = inputs.sources.axes.features.find(f => f.properties.strass_id === c.featureId)
    const hit = projectOnRoad(station.preciseLv95, f.geometry.coordinates)
    return { featureId: c.featureId, road: c.roadNumber, ownership: c.ownership, distanceMetres: round(hit.distance), pointsLv95: f.geometry.coordinates }
  })
  const crossings = axes.slice(1).map(axis => {
    const points = sharedInteriorVertices(axes[0].pointsLv95, axis.pointsLv95)
    if (points.length !== 1) throw new Error('Lindau shared interior crossing changed')
    return { mainFeatureId: axes[0].featureId, motorwayFeatureId: axis.featureId, pointLv95: points[0], stationDistanceMetres: round(distance(station.preciseLv95, points[0])), status: 'shared-interior-xy-vertex-not-a-junction-approval' }
  })
  const path = inputs.geometry.paths.find(p => p.id === station.candidates.find(c => c.road === 'ZH:766' && c.eligible)?.pathId)
  if (!path) throw new Error('Missing Lindau candidate path')
  const points = path.points.map(([lon, lat]) => wgs84ToLv95(lon, lat))
  // Candidate checks expose blockers only. No match, alias or topology is made.
  const conditionalDetectors = station.detectorDescriptions.map(d => {
    const place = inputs.directions.places.entries.find(p => p.name === directionDestination(d.description))
    if (!place) throw new Error('Missing Lindau detector destination')
    return { ...d, ...orientDestination(station.preciseLv95, points, place.candidates) }
  })
  const alternativeChecks = [station.id, 'ZH.CH:1320'].map(id => {
    const site = inputs.geometry.stations.find(s => s.id === id)
    return { stationId: id, status: 'individual-alternatives-diagnostic-no-name-selected', alternatives: names.map(name => orientDestination(site.preciseLv95, points, [name])) }
  })
  const pairs = inputs.coverage.candidatePairs.filter(p => [p.from, p.to].includes(station.id))
  if (pairs.length !== 2 || pairs.map(p => `${p.from}|${p.to}`).sort().join(';') !== 'ZH.CH:1292|ZH.CH:2491;ZH.CH:2491|ZH.CH:1320') throw new Error('Lindau candidate coverage changed')
  const candidatePairs = pairs.map(p => {
    const otherId = p.from === station.id ? p.to : p.from
    const other = inputs.geometry.stations.find(s => s.id === otherId)
    const collector = inputs.sources.collectors.find(c => c.uID?.id === `M${otherId.slice(-4)}`)
    if (!other || !collector || collector.name !== other.name || collector.collectorStatus !== other.collectorStatus || collector.detectors.length !== other.detectorDescriptions.length || !other.detectorDescriptions.every(d => collector.detectors.some(c => c.uID?.id === collector.uID.id && `${otherId}.${c.uID.sub?.id?.padStart(2, '0')}` === d.id && c.name === d.description))) throw new Error(`Lindau neighbour collector evidence changed: ${otherId}`)
    return { from: p.from, to: p.to, pathId: p.pathId, distanceMetres: p.distanceMetres, completeMinutes: p.completeMinutes, longestRunMinutes: p.longestRunMinutes, hourWindows: p.hourWindows, publicationStatus: 'not-admitted', otherEndpoint: inputs.directions.stationAudit.find(s => s.id === otherId) }
  })
  return {
    schemaVersion: 1, status: 'review-only-no-publication', scope,
    stationId: station.id, name: station.name, stationPointLv95: station.preciseLv95,
    originalGeometryStatus: station.geometryStatus, originalCandidates: station.candidates,
    axes, competingAxisMarginMetres: record.competingAxisMarginMetres, crossings,
    bindingStatus: 'independent-station-road-level-review-required',
    conditionalDirectionCheck: { status: 'diagnostic-only-assuming-ZH-766', pathId: path.id, gates: DIRECTION_GATES, detectors: conditionalDetectors },
    lindauAlternatives: alternativeChecks, candidatePairs,
    requiredEvidence: [
      'A reviewed station-to-road-level binding at the A1 crossing. Shared XY vertices alone must not create a motorway junction or choose a road.',
      'Independent detector-direction evidence at 2491 and 1320. The local Lindau and Effretikon references are too close; all other exact Lindau alternatives fail off-axis checks. No alias or threshold relaxation resolves these failures.',
      'For the longer candidate, independent Illnau direction evidence at 1292 is needed before reconsidering its Effretikon extent conflict. There is no validated anchor for the existing opposing-lane extent review.',
      'Only after endpoint reviews, audit the connecting section and junctions. The 104-minute observation windows do not approve either corridor.',
    ],
    limitation: 'This is counter 2491 on ZH 766, distinct from counter 0908 on ZH 1. The original geometry and automatic place ambiguity remain unchanged. Individual settlement tests select no destination. No station is moved and no topology, direction mapping or playback is emitted.',
  }
}

async function main() {
  const read = async file => JSON.parse(await readFile(file, 'utf8'))
  const report = auditLindau2491Road(await loadUnmatchedRoadInputs(), await read('data/cantonal-unmatched-road-scope.json'), await read('data/lindau-2491-road-review-sources.json'), await read('data/lindau-2491-road-review-scope.json'))
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/lindau-2491-road-review.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ bindingStatus: report.bindingStatus, crossings: report.crossings, conditionalDirections: report.conditionalDirectionCheck.detectors.map(d => ({ id: d.id, status: d.status })), pairs: report.candidatePairs.map(p => ({ from: p.from, to: p.to, longestRunMinutes: p.longestRunMinutes })) }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
