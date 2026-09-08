import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditUnmatchedRoads, loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'
import { buildCantonalRoadTopology, projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'
import { DIRECTION_GATES, directionDestination, orientDestination } from './validate-cantonal-road-directions.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const round = value => Math.round(value * 100) / 100

export function auditHenggartRoad(inputs, batchScope, source, scope) {
  if (scope.schemaVersion !== 1 || scope.batchScopeSha256 !== digest(batchScope) || scope.classifiedSourceSha256 !== digest(source)) throw new Error('Henggart review scope changed')
  const batch = auditUnmatchedRoads(inputs, batchScope)
  const station = inputs.geometry.stations.find(s => s.id === 'ZH.CH:1997')
  const record = batch.stations.find(s => s.id === station.id)
  if (station.geometryStatus !== 'ambiguous-road' || record.candidates.slice(0, 2).map(c => c.featureId).join('|') !== '3117|6531') throw new Error('Henggart competing geometry changed')
  const url = new URL(source.url)
  if (url.origin !== 'https://maps.zh.ch' || url.pathname !== '/wfs/TBAStrZHWFS' || url.searchParams.get('TYPENAMES') !== 'ms:haupt-und-nebenstrassen' || url.searchParams.get('SRSNAME') !== 'EPSG:2056' || url.searchParams.get('BBOX') !== '2693900,1267900,2694400,1268400,EPSG:2056') throw new Error('Unexpected Henggart classified source')
  const classified = validateGeoCollection(source.collection, 'Henggart classified roads')
  if (classified.length !== 2 || classified.map(f => f.properties.achsnummer).sort().join('|') !== '15|A4') throw new Error('Henggart classified identities changed')
  const rebuilt = buildCantonalRoadTopology(inputs.catalog, inputs.sources.stations, source.collection, { collectors: inputs.sources.collectors })
  if (digest(rebuilt.stations.find(s => s.id === station.id)) !== digest(station) || rebuilt.paths.some(p => digest(p) !== digest(inputs.geometry.paths.find(old => old.id === p.id)))) throw new Error('Henggart original classified match or paths changed')
  const axes = record.candidates.slice(0, 2).map(c => {
    const f = inputs.sources.axes.features.find(f => f.properties.strass_id === c.featureId)
    const hit = projectOnRoad(station.preciseLv95, f.geometry.coordinates)
    const a = f.geometry.coordinates[hit.edge], b = f.geometry.coordinates[hit.edge + 1]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    return { featureId: c.featureId, road: c.roadNumber, ownership: c.ownership, roadClass: c.roadClass, distanceMetres: round(hit.distance), projectedLv95: hit.projected, storedTangent: [(b[0] - a[0]) / length, (b[1] - a[1]) / length], pointsLv95: f.geometry.coordinates }
  })
  // Evaluate a candidate path without changing the station match or constructing
  // an approved topology. This diagnostic can expose further blockers only.
  const candidate = station.candidates.find(c => c.road === 'ZH:15' && c.eligible)
  const path = inputs.geometry.paths.find(p => p.id === candidate?.pathId)
  if (!path || station.detectorDescriptions.length !== 2) throw new Error('Henggart candidate or detectors changed')
  const points = path.points.map(([lon, lat]) => wgs84ToLv95(lon, lat))
  const conditionalDetectors = station.detectorDescriptions.map(d => {
    const name = directionDestination(d.description)
    const place = inputs.directions.places.entries.find(p => p.name === name)
    if (!place) throw new Error(`Missing Henggart destination: ${name}`)
    const check = orientDestination(station.preciseLv95, points, place.candidates)
    return { ...d, ...check, bearingGatePasses: Number.isFinite(check.bearingAgreement) && Math.abs(check.bearingAgreement) >= DIRECTION_GATES.minimumBearingAgreement && Math.sign(check.bearingAgreement) === Math.sign(check.offsetSeparationMetres) }
  })
  const pairs = inputs.coverage.candidatePairs.filter(p => [p.from, p.to].includes(station.id))
  if (pairs.length !== 2 || pairs.map(p => `${p.from}|${p.to}`).sort().join(';') !== 'ZH.CH:1997|ZH.CH:1900;ZH.CH:4789|ZH.CH:1997') throw new Error('Henggart candidate coverage changed')
  const candidatePairs = pairs.map(p => {
    const otherId = p.from === station.id ? p.to : p.from
    const other = inputs.geometry.stations.find(s => s.id === otherId)
    const observed = inputs.coverage.stationSummaries.find(s => s.id === otherId)
    const collector = inputs.sources.collectors.find(c => c.uID?.id === `M${otherId.slice(-4)}`)
    if (!other || !observed || !collector || collector.name !== other.name || collector.collectorStatus !== other.collectorStatus || collector.detectors.length !== other.detectorDescriptions.length || !other.detectorDescriptions.every(d => collector.detectors.some(c => c.uID?.id === collector.uID.id && `${otherId}.${c.uID.sub?.id?.padStart(2, '0')}` === d.id && c.name === d.description))) throw new Error(`Henggart neighbour collector evidence changed: ${otherId}`)
    return { from: p.from, to: p.to, pathId: p.pathId, distanceMetres: p.distanceMetres, completeMinutes: p.completeMinutes, longestRunMinutes: p.longestRunMinutes, hourWindows: p.hourWindows, publicationStatus: 'not-admitted', otherEndpoint: { id: otherId, name: other.name, collectorStatus: other.collectorStatus, directionAudit: inputs.directions.stationAudit.find(s => s.id === otherId), detectorIssueMinutes: observed.detectorIssueMinutes } }
  })
  return {
    schemaVersion: 1, status: 'review-only-no-publication', scope,
    stationId: station.id, name: station.name, stationPointLv95: station.preciseLv95,
    originalGeometryStatus: station.geometryStatus, originalCandidates: station.candidates,
    axes, competingAxisMarginMetres: record.competingAxisMarginMetres,
    storedTangentAgreement: round(axes[0].storedTangent.reduce((sum, n, i) => sum + n * axes[1].storedTangent[i], 0)),
    geometryFinding: 'Detailed axes run locally alongside each other at the station. The A4 competitor is retained: its 14.54 m separation is below the unchanged 15 m ambiguity margin. Opposite vertex order is not a detector travel-direction reference.',
    bindingStatus: 'independent-station-to-road-binding-required',
    conditionalDirectionCheck: { status: 'diagnostic-only-assuming-ZH-15', pathId: path.id, gates: DIRECTION_GATES, detectors: conditionalDetectors },
    candidatePairs,
    requiredEvidence: [
      'An independent station-specific road binding identifying 1997 on ZH 15 beside the A4; retain the original ambiguous match until reviewed.',
      'Independent direction evidence for both Henggart detectors. The candidate-path diagnostic fails the Winterthur bearing and the Schaffhausen off-axis and bearing checks. Neither supplies an anchor for an opposing-lane extent review.',
      'For the southern candidate, independently resolve both Neftenbach 4789 destination checks, then review the section and junctions. For the northern candidate, Adlikon 1900 also needs complete observations and Schaffhausen direction evidence.',
    ],
    limitation: 'All direction results at 1997 are conditional diagnostics, not approvals. Geometry proximity, local parallelism, collector destination labels and observation windows do not override the existing gates. No station is moved and no topology, direction mapping or playback is emitted.',
  }
}

async function main() {
  const read = async file => JSON.parse(await readFile(file, 'utf8'))
  const report = auditHenggartRoad(await loadUnmatchedRoadInputs(), await read('data/cantonal-unmatched-road-scope.json'), await read('data/henggart-road-review-sources.json'), await read('data/henggart-road-review-scope.json'))
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/henggart-road-review.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ bindingStatus: report.bindingStatus, conditionalDirections: report.conditionalDirectionCheck.detectors.map(d => ({ id: d.id, status: d.status, bearingAgreement: d.bearingAgreement })), pairs: report.candidatePairs.map(p => ({ from: p.from, to: p.to, longestRunMinutes: p.longestRunMinutes })) }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
