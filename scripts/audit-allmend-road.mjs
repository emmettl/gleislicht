import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditUnmatchedRoads, loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'
import { buildCantonalRoadTopology, projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'
import { buildDirectionTopology } from './validate-cantonal-road-directions.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const round = value => Math.round(value * 100) / 100
export function auditAllmendRoad(inputs, batchScope, source, reviews, scope) {
  if (scope.schemaVersion !== 1 || scope.batchScopeSha256 !== digest(batchScope) || scope.classifiedSourceSha256 !== digest(source) || scope.directionReviewsSha256 !== digest(reviews)) throw new Error('Allmend review scope changed')
  const batch = auditUnmatchedRoads(inputs, batchScope)
  const station = inputs.geometry.stations.find(s => s.id === 'ZH.CH:0197')
  const partner = inputs.geometry.stations.find(s => s.id === 'ZH.CH:4087')
  const collector = inputs.sources.collectors.filter(c => c.uID.id === 'M4087')
  if (collector.length !== 1 || collector[0].name !== partner.name || collector[0].collectorStatus !== partner.collectorStatus || collector[0].detectors.length !== partner.detectorDescriptions.length || !partner.detectorDescriptions.every(d => collector[0].detectors.some(c => c.uID.id === 'M4087' && `${partner.id}.${c.uID.sub.id.padStart(2, '0')}` === d.id && c.name === d.description))) throw new Error('Adliswil collector evidence changed')
  const partnerPoints = inputs.sources.stations.features.filter(f => f.properties.messst_nr === 4087)
  if (partnerPoints.length !== 1 || Math.hypot(...partnerPoints[0].geometry.coordinates.map((v, i) => v - partner.preciseLv95[i])) > 0.01) throw new Error('Adliswil precise station changed')
  const url = new URL(source.url)
  if (url.origin !== 'https://maps.zh.ch' || url.pathname !== '/wfs/TBAStrZHWFS' || url.searchParams.get('TYPENAMES') !== 'ms:haupt-und-nebenstrassen' || url.searchParams.get('BBOX') !== '2681600,1244500,2682200,1245100,EPSG:2056') throw new Error('Unexpected Allmend classified source')
  const classified = validateGeoCollection(source.collection, 'Allmend classified axes')
  if (classified.some(f => f.properties.achsnummer.trim() === '4.1')) throw new Error('City axis is now present; review the changed network')
  const rebuilt = buildCantonalRoadTopology(inputs.catalog, inputs.sources.stations, source.collection, { collectors: inputs.sources.collectors })
  const rebuiltStation = rebuilt.stations.find(s => s.id === station.id)
  if (digest(rebuiltStation) !== digest(station)) throw new Error('Allmend classified match changed')
  const nearest = batch.stations.find(s => s.id === station.id)
  if (nearest.candidates[0].featureId !== 5329 || nearest.candidates[0].ownership !== 'Stadt Zürich' || nearest.candidates[0].roadNumber !== '4.1') throw new Error('Allmend detailed axis changed')
  const featureIds = [5329, 7017, 7020]
  const detailed = featureIds.map(id => inputs.sources.axes.features.find(f => f.properties.strass_id === id))
  if (detailed.some(f => !f)) throw new Error('Missing Allmend junction feature')
  const junction = detailed[0].geometry.coordinates[0]
  if (!detailed.slice(1).every(f => [f.geometry.coordinates[0], f.geometry.coordinates.at(-1)].some(p => Math.hypot(...p.map((v, i) => v - junction[i])) <= 0.01))) throw new Error('Shared Allmend junction changed')
  if (reviews.geometrySha256 !== digest(inputs.geometry) || reviews.catalogSha256 !== digest(inputs.catalog) || reviews.entries.length !== 1 || reviews.entries[0].stationId !== partner.id) throw new Error('Adliswil review must remain station-scoped')
  const reviewed = buildDirectionTopology(inputs.geometry, inputs.catalog, inputs.directions.places, reviews.entries)
  const partnerAudit = reviewed.stationAudit.find(s => s.id === partner.id)
  if (partnerAudit.status !== 'validated') throw new Error('Adliswil directions did not validate')
  if (digest(reviewed.stationAudit.filter(s => s.id !== partner.id)) !== digest(inputs.directions.stationAudit.filter(s => s.id !== partner.id)) || digest(reviewed.sections) !== digest(inputs.directions.sections)) throw new Error('Adliswil review changed unrelated stations or admitted a section')
  const pairs = inputs.coverage.candidatePairs.filter(p => [p.from, p.to].includes(partner.id))
  return {
    schemaVersion: 1, status: 'review-only-no-publication', scope,
    stationId: station.id, name: station.name, stationPointLv95: station.preciseLv95,
    cityAxis: { featureId: 5329, road: '4.1', ownership: 'Stadt Zürich', distanceMetres: nearest.candidates[0].distanceMetres, presentInClassifiedResponse: false },
    sharedJunction: { pointLv95: junction, stationDistanceMetres: round(Math.hypot(...junction.map((v, i) => v - station.preciseLv95[i]))), features: detailed.map(f => ({ featureId: f.properties.strass_id, road: f.properties.stradatnam, roadClass: f.properties.strasstyp, ownership: f.properties.eigentum, distanceMetres: round(projectOnRoad(station.preciseLv95, f.geometry.coordinates).distance) })) },
    originalCandidates: station.candidates,
    geometryStatus: 'city-axis-extension-and-junction-review-required',
    geometryFinding: 'The city-owned 4.1 axis passes through the station and meets both another 4.1 feature and an A3W ramp at a shared vertex 3.6 m away. The classified response omits 4.1 and reproduces the original excluded-road-class result. Connected features near a junction do not establish detector-to-road or travel-direction assignments.',
    detectorDescriptions: station.detectorDescriptions,
    adliswilDirectionReview: { originalStatus: inputs.directions.stationAudit.find(s => s.id === partner.id).status, status: partnerAudit.status, detectors: partnerAudit.detectors },
    candidatePairs: pairs.map(p => ({ from: p.from, to: p.to, distanceMetres: p.distanceMetres, completeMinutes: p.completeMinutes, longestRunMinutes: p.longestRunMinutes, hourWindows: p.hourWindows, publicationStatus: 'not-admitted', endpointAudits: [p.from, p.to].map(id => reviewed.stationAudit.find(s => s.id === id)) })),
    requiredEvidence: 'A reviewed city-axis network connection to ZH 4, a station-specific mapping for all four 0197 detector channels, and a junction/section audit. The separate 1520–4087 option still has a too-close Langnau reference and extent conflict at 1520.',
    limitation: 'The saved 4087 review resolves one station only. Allmend remains unmatched and no additional section is admitted. Original geometry, direction audits and playback artifacts are unchanged; no city-road extension is synthesized from nearest projections.',
  }
}

async function main() {
  const read = async file => JSON.parse(await readFile(file, 'utf8'))
  const report = auditAllmendRoad(await loadUnmatchedRoadInputs(), await read('data/cantonal-unmatched-road-scope.json'), await read('data/allmend-road-review-sources.json'), await read('data/adliswil-road-direction-reviews.json'), await read('data/allmend-road-review-scope.json'))
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/allmend-road-review.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ geometryStatus: report.geometryStatus, adliswilDirectionStatus: report.adliswilDirectionReview.status, candidatePairs: report.candidatePairs.map(({ endpointAudits: _endpointAudits, ...pair }) => pair) }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
