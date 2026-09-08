import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditUnmatchedRoads, loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'
import { sharedInteriorVertices } from './audit-lindau-2491-road.mjs'
import { buildCantonalRoadTopology, projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'
import { DIRECTION_GATES, directionDestination, orientDestination } from './validate-cantonal-road-directions.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const round = value => Math.round(value * 100) / 100
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const ends = f => [f.geometry.coordinates[0], f.geometry.coordinates.at(-1)]

export function auditStallikonRoad(inputs, batchScope, source, scope) {
  if (scope.schemaVersion !== 1 || scope.batchScopeSha256 !== digest(batchScope) || scope.classifiedSourceSha256 !== digest(source)) throw new Error('Stallikon review scope changed')
  const batch = auditUnmatchedRoads(inputs, batchScope)
  const station = inputs.geometry.stations.find(s => s.id === 'ZH.CH:3387')
  const record = batch.stations.find(s => s.id === station.id)
  if (station.geometryStatus !== 'ambiguous-road' || record.candidates.slice(0, 4).map(c => c.featureId).join('|') !== '3632|6572|6570|3631') throw new Error('Stallikon competing geometry changed')
  const url = new URL(source.url)
  if (url.origin !== 'https://maps.zh.ch' || url.pathname !== '/wfs/TBAStrZHWFS' || url.searchParams.get('TYPENAMES') !== 'ms:haupt-und-nebenstrassen' || url.searchParams.get('SRSNAME') !== 'EPSG:2056' || url.searchParams.get('BBOX') !== '2678000,1244500,2678600,1245200,EPSG:2056') throw new Error('Unexpected Stallikon classified source')
  const classified = validateGeoCollection(source.collection, 'Stallikon classified roads')
  if (classified.length !== 4 || classified.map(f => f.properties.achsnummer).sort().join('|') !== '642|650|A3|A3') throw new Error('Stallikon classified identities changed')
  const rebuilt = buildCantonalRoadTopology(inputs.catalog, inputs.sources.stations, source.collection, { collectors: inputs.sources.collectors })
  if (digest(rebuilt.stations.find(s => s.id === station.id)) !== digest(station) || rebuilt.paths.some(p => digest(p) !== digest(inputs.geometry.paths.find(old => old.id === p.id)))) throw new Error('Stallikon original match or paths changed')
  const byId = new Map(inputs.sources.axes.features.map(f => [f.properties.strass_id, f]))
  const axes = record.candidates.slice(0, 4).map(c => ({ featureId: c.featureId, road: c.roadNumber, ownership: c.ownership, distanceMetres: c.distanceMetres, pointsLv95: byId.get(c.featureId).geometry.coordinates }))
  const crossings = axes.slice(1, 3).map(axis => {
    const points = sharedInteriorVertices(axes[0].pointsLv95, axis.pointsLv95)
    if (points.length !== 1) throw new Error('Stallikon shared XY crossing changed')
    return { mainFeatureId: 3632, motorwayFeatureId: axis.featureId, pointLv95: points[0], stationDistanceMetres: round(distance(station.preciseLv95, points[0])), status: 'shared-horizontal-coordinate-no-junction-inferred' }
  })
  const path = inputs.geometry.paths.find(p => p.id === station.candidates.find(c => c.road === 'ZH:650' && c.eligible)?.pathId)
  if (!path) throw new Error('Missing Stallikon candidate path')
  const points = path.points.map(([lon, lat]) => wgs84ToLv95(lon, lat))
  const conditionalDetectors = station.detectorDescriptions.map(d => {
    const place = inputs.directions.places.entries.find(p => p.name === directionDestination(d.description))
    if (!place) throw new Error('Missing Stallikon detector destination')
    return { ...d, ...orientDestination(station.preciseLv95, points, place.candidates) }
  })
  const pairs = inputs.coverage.candidatePairs.filter(p => [p.from, p.to].includes(station.id))
  const pair = pairs[0], other = inputs.geometry.stations.find(s => s.id === 'ZH.CH:3287')
  if (pairs.length !== 1 || pair.from !== other.id || pair.to !== station.id || pair.pathId !== path.id) throw new Error('Stallikon paired coverage changed')
  const collector = inputs.sources.collectors.find(c => c.uID?.id === 'M3287')
  if (!collector || collector.name !== other.name || collector.collectorStatus !== other.collectorStatus || collector.detectors.length !== other.detectorDescriptions.length || !other.detectorDescriptions.every(d => collector.detectors.some(c => c.uID?.id === collector.uID.id && `${other.id}.${c.uID.sub?.id?.padStart(2, '0')}` === d.id && c.name === d.description))) throw new Error('Stallikon partner collector evidence changed')
  const ringIds = [6268, 6269, 6270], connectorIds = [6271, 6272, 6273]
  const ring = ringIds.map(id => byId.get(id))
  if (ring.some(f => !f || f.properties.stradatnam.trim() !== 'K-001') || connectorIds.some(id => !byId.has(id))) throw new Error('Stallikon roundabout identities changed')
  const ringEnds = ring.flatMap(ends)
  if (ringEnds.some(p => ringEnds.filter(q => distance(p, q) <= 0.01).length !== 2)) throw new Error('Stallikon roundabout ring is not closed')
  const fromOffset = projectOnRoad(other.preciseLv95, points).offset, toOffset = projectOnRoad(station.preciseLv95, points).offset
  const approaches = [3633, 3632, 3631].map(id => {
    const f = byId.get(id), joined = ends(f).filter(p => ringEnds.some(q => distance(p, q) <= 0.01))
    if (joined.length !== 1) throw new Error('Stallikon roundabout approach changed')
    const projection = projectOnRoad(joined[0], points)
    if (projection.offset <= Math.min(fromOffset, toOffset) || projection.offset >= Math.max(fromOffset, toOffset)) throw new Error('Stallikon junction is outside the candidate section')
    return { featureId: id, road: f.properties.stradatnam.trim(), ringJoinLv95: joined[0], projectedOffsetMetres: round(projection.offset), distanceAlongCandidateFrom3287Metres: round(projection.offset - fromOffset) }
  })
  return {
    schemaVersion: 1, status: 'review-only-no-publication', scope,
    stationId: station.id, name: station.name, stationPointLv95: station.preciseLv95,
    originalGeometryStatus: station.geometryStatus, originalCandidates: station.candidates,
    axes, competingAxisMarginMetres: record.competingAxisMarginMetres, crossings,
    bindingStatus: 'independent-station-road-level-review-required',
    conditionalDirectionCheck: { status: 'diagnostic-only-assuming-ZH-650', pathId: path.id, gates: DIRECTION_GATES, detectors: conditionalDetectors },
    candidatePair: { from: pair.from, to: pair.to, pathId: pair.pathId, distanceMetres: pair.distanceMetres, completeMinutes: pair.completeMinutes, longestRunMinutes: pair.longestRunMinutes, hourWindows: pair.hourWindows, publicationStatus: 'not-admitted', otherEndpoint: inputs.directions.stationAudit.find(s => s.id === other.id) },
    interveningJunction: { status: 'roundabout-and-ZH-642-branch-require-section-review', ringFeatureIds: ringIds, schematicConnectorFeatureIds: connectorIds, approaches, limitation: 'Published ring and schematic centre connections are distinct representations. No route through the roundabout, lane assignment or measured turning flow is inferred.' },
    requiredEvidence: [
      'A station-specific binding to the surface road, independently distinguishing the A3 tunnel level. Shared XY geometry cannot resolve road level.',
      'Independent Zürich direction references at both 3387 and 3287. A validated Stallikon detector cannot override Zürich distance, off-axis or bearing failures under the extent-only review method.',
      'After endpoint review, audit the ZH 642 roundabout between the counters and choose reviewed section geometry. The 149-minute paired window does not establish continuous measured through traffic.',
    ],
    limitation: 'The Stallikon result at 3387 passes only under an unapproved ZH 650 assumption. Original station matching, direction archives and thresholds remain unchanged. No topology, direction mapping or playback is emitted.',
  }
}

async function main() {
  const read = async file => JSON.parse(await readFile(file, 'utf8'))
  const report = auditStallikonRoad(await loadUnmatchedRoadInputs(), await read('data/cantonal-unmatched-road-scope.json'), await read('data/stallikon-road-review-sources.json'), await read('data/stallikon-road-review-scope.json'))
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/stallikon-road-review.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ bindingStatus: report.bindingStatus, crossings: report.crossings, conditionalDirections: report.conditionalDirectionCheck.detectors.map(d => ({ id: d.id, status: d.status })), junction: report.interveningJunction.approaches, pairedRunMinutes: report.candidatePair.longestRunMinutes }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
