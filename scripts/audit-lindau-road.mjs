import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'
import { buildDirectionTopology, orientDestination } from './validate-cantonal-road-directions.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
export function auditLindauRoad(geometry, catalog, directions, coverage, sources) {
  if (hash(JSON.stringify(sources.collector.record)) !== sources.collector.recordSha256 || hash(JSON.stringify(sources.axes.collection)) !== sources.axes.collectionSha256) throw new Error('Lindau source hash mismatch')
  const station = geometry.stations.find(s => s.id === 'ZH.CH:0908')
  const automatic = buildDirectionTopology(geometry, catalog, directions.places)
  const audit = automatic.stationAudit.find(s => s.id === station.id)
  const collector = sources.collector.record
  if (collector.uID.id !== 'M0908' || collector.detectors.length !== station.detectorDescriptions.length || !station.detectorDescriptions.every(d => collector.detectors.some(c => `${station.id}.${c.uID.sub.id.padStart(2, '0')}` === d.id && c.name === d.description))) throw new Error('Lindau detector descriptions changed')
  const axes = validateGeoCollection(sources.axes.collection, 'Lindau road axes').filter(f => f.properties.stradatnam?.trim() === '1')
  const nearby = axes.map(feature => ({ feature, hit: projectOnRoad(station.preciseLv95, feature.geometry.coordinates) })).filter(e => e.hit?.distance <= 5)
  if (nearby.length !== 1) throw new Error('Lindau detailed axis is ambiguous')
  const detailedAxis = nearby[0]
  const detailedDirections = audit.detectors.map(d => {
    const result = orientDestination(station.preciseLv95, detailedAxis.feature.geometry.coordinates, [d.destination])
    return { detectorId: d.id, status: result.status, bearingAgreement: result.bearingAgreement, destinationDistanceMetres: result.destinationDistanceMetres }
  })
  const pair = coverage.candidatePairs.find(p => [p.from, p.to].includes(station.id) && [p.from, p.to].includes('ZH.CH:2092'))
  if (!pair) throw new Error('Missing Bassersdorf–Lindau coverage evidence')
  return {
    stationId: station.id, name: station.name, pathId: station.match.pathId,
    publicationStatus: audit.status === 'validated' ? 'requires-new-review' : 'direction-unresolved',
    reason: 'Neither Lindau detector has an independently validated direction. The opposing-lane review used at Wallisellen requires a validated anchor and cannot resolve this station. Detailed road-axis bearing is diagnostic evidence, not a detector-to-travel-direction survey.',
    automaticDetectors: audit.detectors,
    detailedGeometry: { sourceFeatureId: detailedAxis.feature.properties.strass_id, distanceMetres: detailedAxis.hit.distance, directions: detailedDirections, note: 'Detailed feature vertex order may differ from the stored classified road path. Compare absolute bearing agreement, not the sign.' },
    observations: { from: pair.from, to: pair.to, distanceMetres: pair.distanceMetres, completeMinutes: pair.completeMinutes, longestRunMinutes: pair.longestRunMinutes, hourWindows: pair.hourWindows },
    requiredEvidence: 'A detector-specific surveyed direction or independently verified directional reference tied to this station and road path; then a new explicit, pinned review and section/junction audit before publication.',
  }
}
async function main() {
  const files = ['public/data/zurich-cantonal-road-topology.json', 'data/zurich-cantonal-road-counters.json', 'data/zurich-cantonal-road-directions.json', 'data/zurich-cantonal-road-coverage-audit.json', 'data/lindau-road-review-sources.json']
  const bodies = await Promise.all(files.map(file => readFile(file, 'utf8')))
  const report = auditLindauRoad(...bodies.map(body => JSON.parse(body)))
  const result = { metadata: { schemaVersion: 1, sourceHashes: Object.fromEntries(files.map((file, i) => [file, hash(bodies[i])])), sourceFetchedAt: JSON.parse(bodies[4]).fetchedAt }, ...report }
  await writeFile('data/lindau-road-review.json', JSON.stringify(result, null, 2)+'\n')
  console.log(JSON.stringify({ status: report.publicationStatus, observations: report.observations, detailedGeometry: report.detailedGeometry }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
