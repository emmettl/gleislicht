import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reviewCantonalDirection } from './review-cantonal-road-direction.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const hittnauInputFiles = {
  geometry: 'public/data/zurich-cantonal-road-topology.json',
  catalog: 'data/zurich-cantonal-road-counters.json',
  oberland: 'data/oberland-road-candidate-audit.json',
  sources: 'data/hittnau-road-review-sources.json',
}

export function auditHittnauRoad(inputs, scope) {
  if (scope.schemaVersion !== 1 || Object.keys(hittnauInputFiles).some(key => scope.hashes[key] !== digest(inputs[key]))) throw new Error('Hittnau audit inputs changed')
  const { geometry, catalog, oberland, sources } = inputs
  if (oberland.inputHashes.geometry !== digest(geometry) || oberland.inputHashes.catalog !== digest(catalog) || oberland.status !== 'review-only-no-publication') throw new Error('Oberland evidence is stale')
  const ids = ['ZH.CH:2992', 'ZH.CH:3091']
  const stations = ids.map(id => geometry.stations.find(s => s.id === id))
  if (stations.some(s => !s || s.match?.pathId !== 'ZH:337:81114d194f6ee002' || s.match.road !== 'ZH:337')) throw new Error('Hittnau road binding changed')
  if (sources.collectors.url !== 'https://vdp.zh.ch/pws/public-service/readCollectorsCfg' || sources.collectors.records.length !== 2) throw new Error('Unexpected collector source')
  for (const station of stations) {
    const records = sources.collectors.records.filter(r => r.uID.id === `M${station.id.slice(-4)}`)
    const record = records[0]
    if (records.length !== 1 || record.name !== station.name || record.collectorStatus !== 'ACTIVE' || record.detectors.length !== station.detectorDescriptions.length || !station.detectorDescriptions.every(d => record.detectors.some(c => c.uID.id === record.uID.id && `${station.id}.${c.uID.sub.id.padStart(2, '0')}` === d.id && c.name === d.description))) throw new Error('Hittnau collector identity or detector labels changed')
  }
  const collection = sources.station.collection
  const url = new URL(sources.station.url)
  if (url.origin !== 'https://maps.zh.ch' || url.pathname !== '/wfs/TBAVMSZHWFS' || url.searchParams.get('TYPENAMES') !== 'ms:verkehrszaehlstellen' || url.searchParams.get('SRSNAME') !== 'EPSG:2056' || collection.type !== 'FeatureCollection' || collection.numberMatched !== 1 || collection.features.length !== 1 || collection.crs?.properties?.name !== 'urn:ogc:def:crs:EPSG::2056') throw new Error('Unexpected Hittnau station source')
  const feature = collection.features[0], station = stations[1]
  if (feature.properties.messst_nr !== 3091 || feature.properties.messst_typ !== 'permanent' || feature.geometry.type !== 'Point' || feature.geometry.coordinates.length !== 2 || !feature.geometry.coordinates.every(Number.isFinite) || Math.hypot(...feature.geometry.coordinates.map((n, i) => n - station.preciseLv95[i])) > 0.01) throw new Error('Hittnau station point changed')
  if (Object.keys(feature.properties).sort().join('|') !== ['messst_nr', 'dtv', 'dtv_bezugsjahr', 'messst_typ', 'nt', 'nn', 'v85', 'dsv', 'dlv'].sort().join('|')) throw new Error('Station metadata fields changed; inspect for new evidence')
  if (sources.stationPlan.status !== 'not-obtained' || sources.stationPlan.requiredStationNumber !== 3091 || sources.handbook.exampleStationNumber !== '0124') throw new Error('Station-plan evidence requires a new review')
  const reports = ids.map(id => oberland.stationReports.find(s => s.id === id))
  const pair = oberland.candidatePairs.find(p => p.from === ids[0] && p.to === ids[1] && p.pathId === station.match.pathId)
  if (reports.some(r => !r) || !pair || pair.publicationStatus !== 'not-admitted') throw new Error('Missing Hittnau candidate evidence')
  const detectors = reports[1].qualifiedZhDiagnostic.detectors
  const pending = detectors.find(d => d.id === 'ZH.CH:3091.02')
  if (pending?.status !== 'destination-too-close' || pending.destinationDistanceMetres >= 1500) throw new Error('Hittnau direction diagnostic changed')
  let opposingLaneReviewError
  try {
    reviewCantonalDirection(station, detectors, new Map(catalog.detectors.map(d => [d.id, d])), {
      stationId: station.id, pathId: station.match.pathId, road: station.match.road,
      detectorAuditSha256: digest(detectors), method: 'opposing-main-carriageway-lanes',
      anchorDetectorId: 'ZH.CH:3091.01', reviewedDetectorId: pending.id,
    })
  } catch (error) { opposingLaneReviewError = error.message }
  if (!opposingLaneReviewError) throw new Error('Short-distance detector unexpectedly accepted by extent review')
  return {
    schemaVersion: 1, status: 'review-only-no-publication', inputHashes: scope.hashes,
    stationId: station.id, name: station.name, pathId: station.match.pathId, road: station.match.road,
    sourceChecks: { collectorLabelsMatch: true, preciseStationPointMatches: true, stationPointLv95: feature.geometry.coordinates, publicStationFields: Object.keys(feature.properties).sort(), stationPlanStatus: sources.stationPlan.status, handbookExampleStationNumber: sources.handbook.exampleStationNumber },
    qualifiedZhDiagnostic: reports[1].qualifiedZhDiagnostic,
    destinationAlternatives: reports[1].aliases,
    opposingLaneReview: { status: 'rejected', reason: opposingLaneReviewError },
    observations: { from: pair.from, to: pair.to, distanceMetres: pair.distanceMetres, completeMinutes: pair.completeMinutes, longestRunMinutes: pair.longestRunMinutes, hourWindows: pair.hourWindows },
    requiredEvidence: 'Obtain the station 3091 situation plan or an independently verified directional reference that binds detector 3091.02 to travel on ZH 337. A plan must identify the station, sensor/channel labels, direction arrows and geographic orientation; its date and detector crosswalk must be reviewed.',
    subsequentWork: 'Complete an explicit Pfäffikon ZH/SZ destination review at both endpoints, then a pinned direction review and section/junction audit before compiling playback.',
    limitation: 'The public point, destination labels, generic lane-numbering convention, AlertC signs and complete observations do not establish an independent surveyed direction. No station-specific plan was obtained; this is not evidence that none exists. No topology or playback is emitted.',
  }
}

async function main() {
  const inputs = Object.fromEntries(await Promise.all(Object.entries(hittnauInputFiles).map(async ([key, file]) => [key, JSON.parse(await readFile(file, 'utf8'))])))
  const scope = JSON.parse(await readFile('data/hittnau-road-audit-scope.json', 'utf8'))
  const result = auditHittnauRoad(inputs, scope)
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/hittnau-road-review.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ status: result.status, stationId: result.stationId, observations: result.observations, opposingLaneReview: result.opposingLaneReview }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
