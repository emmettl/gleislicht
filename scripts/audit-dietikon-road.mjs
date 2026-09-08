import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditUnmatchedRoads, loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'
import { buildCantonalRoadTopology, projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const round = value => Math.round(value * 100) / 100
export function auditDietikonRoad(inputs, batchScope, source, scope) {
  if (scope.schemaVersion !== 1 || scope.batchScopeSha256 !== digest(batchScope) || scope.classifiedSourceSha256 !== digest(source)) throw new Error('Dietikon review scope changed')
  const batch = auditUnmatchedRoads(inputs, batchScope)
  const url = new URL(source.url)
  if (url.origin !== 'https://maps.zh.ch' || url.pathname !== '/wfs/TBAStrZHWFS' || url.searchParams.get('TYPENAMES') !== 'ms:haupt-und-nebenstrassen' || url.searchParams.get('BBOX') !== '2671300,1251800,2671900,1252500,EPSG:2056') throw new Error('Unexpected Dietikon classified-road source')
  const classified = validateGeoCollection(source.collection, 'Dietikon classified axes')
  if (classified.length !== 2 || classified.map(f => f.properties.achsnummer).sort().join('|') !== '618|618.1') throw new Error('Dietikon classified-road identities changed')
  const rebuilt = buildCantonalRoadTopology(inputs.catalog, inputs.sources.stations, source.collection, { collectors: inputs.sources.collectors })
  if (rebuilt.paths.some(p => {
    const original = inputs.geometry.paths.find(old => old.id === p.id)
    return !original || digest(p) !== digest(original)
  })) throw new Error('Dietikon classified paths changed')
  const station = inputs.geometry.stations.find(s => s.id === 'ZH.CH:1921')
  const audit = batch.stations.find(s => s.id === station.id)
  if (audit.originalGeometryStatus !== 'ambiguous-road' || audit.candidates.slice(0, 2).map(c => c.featureId).join('|') !== '7440|7436') throw new Error('Dietikon competing geometry changed')
  const records = new Map(inputs.catalog.detectors.map(d => [d.id, d]))
  const groups = ['Dietikon', 'Autobahn A1'].map(destinationLabel => ({ destinationLabel, detectors: station.detectorDescriptions.filter(d => d.description.endsWith(`Richtung ${destinationLabel}`)).map(d => ({ ...d, lane: records.get(d.id).lane, alertCDirection: records.get(d.id).direction, coordinate: records.get(d.id).coordinate })) }))
  if (station.detectorDescriptions.length !== 4 || groups.some(g => g.detectors.length !== 2 || g.detectors.map(d => d.lane).sort().join('|') !== 'lane1|lane2')) throw new Error('Dietikon lane groups changed')
  const axes = audit.candidates.slice(0, 2).map(c => {
    const feature = inputs.sources.axes.features.find(f => f.properties.strass_id === c.featureId)
    const hit = projectOnRoad(station.preciseLv95, feature.geometry.coordinates)
    const a = feature.geometry.coordinates[hit.edge], b = feature.geometry.coordinates[hit.edge + 1]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    return { featureId: c.featureId, road: c.roadNumber, distanceMetres: round(hit.distance), projectedLv95: hit.projected, storedTangent: [(b[0] - a[0]) / length, (b[1] - a[1]) / length], pointsLv95: feature.geometry.coordinates }
  })
  const pair = inputs.coverage.candidatePairs.find(p => p.from === station.id && p.to === 'ZH.CH:0214')
  if (!pair) throw new Error('Missing Dietikon–Oetwil coverage')
  const neighbour = inputs.directions.stationAudit.find(s => s.id === pair.to)
  if (neighbour.status === 'validated' || neighbour.detectors.map(d => d.status).join('|') !== 'destination-off-axis|destination-too-close') throw new Error('Oetwil direction evidence changed')
  return {
    schemaVersion: 1, status: 'review-only-no-publication', scope,
    stationId: station.id, name: station.name, stationPointLv95: station.preciseLv95,
    axes, axisProjectionSeparationMetres: round(Math.hypot(...axes[0].projectedLv95.map((n, i) => n - axes[1].projectedLv95[i]))),
    storedTangentAgreement: round(axes[0].storedTangent.reduce((sum, n, i) => sum + n * axes[1].storedTangent[i], 0)),
    detectorGroups: groups,
    bindingStatus: 'detector-to-axis-mapping-not-established',
    geometryFinding: 'Two nearby classified axes run alongside the station point, with opposite local vertex order. The four public detector labels form two lane groups. This is consistent with separate carriageways, but neither the central station point nor vertex order proves a detector-to-axis travel-direction mapping.',
    observations: { from: pair.from, to: pair.to, distanceMetres: pair.distanceMetres, completeMinutes: pair.completeMinutes, longestRunMinutes: pair.longestRunMinutes, hourWindows: pair.hourWindows },
    otherEndpoint: neighbour,
    requiredEvidence: [
      'A station-specific plan or independent detector/channel-to-carriageway reference for all four 1921 detectors, with geographic orientation and both road axes identified.',
      'Independent direction evidence at 0214: Dietikon is off-axis and Oetwil is too close under the existing gates.',
      'After those reviews, audit the connecting section and junctions. The 245-minute window alone does not approve a corridor.',
    ],
    limitation: 'No axis is selected by nearest distance, road-number suffix or stored vertex order. The two-normal-lane extent-review method cannot resolve this four-detector station. No topology, direction mapping or playback is emitted.',
  }
}

export function renderDietikonReview(report) {
  const [e, n] = report.stationPointLv95, scale = 6
  const x = v => 260 + (v - e) * scale, y = v => 310 - (v - n) * scale
  const colors = ['#176e9c', '#ae5523']
  const paths = report.axes.map((axis, i) => `<polyline points="${axis.pointsLv95.map(p => `${x(p[0]).toFixed(2)},${y(p[1]).toFixed(2)}`).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="5"/><line x1="260" y1="310" x2="${x(axis.projectedLv95[0])}" y2="${y(axis.projectedLv95[1])}" stroke="${colors[i]}" stroke-width="2" stroke-dasharray="3 3"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="580" viewBox="0 0 960 580"><rect width="960" height="580" fill="#f7f8fa"/><style>text{font-family:Arial,sans-serif;fill:#243342}.title{font-size:25px;font-weight:bold}.body{font-size:17px}.small{font-size:14px}</style><text x="32" y="42" class="title">Dietikon 1921: two axes, unresolved detector mapping</text><text x="32" y="73" class="body">Official LV95 geometry • local view • no travel direction inferred</text><defs><clipPath id="map"><rect x="32" y="100" width="440" height="410"/></clipPath></defs><rect x="32" y="100" width="440" height="410" fill="white" stroke="#bcc8cf"/><g clip-path="url(#map)">${paths}<circle cx="260" cy="310" r="7" fill="#243342" stroke="white" stroke-width="2"/></g><text x="56" y="136" class="body">N ↑</text><line x1="56" y1="476" x2="116" y2="476" stroke="#243342" stroke-width="3"/><text x="56" y="498" class="small">10 m</text><text x="504" y="135" class="title">Station point between axes</text><text x="504" y="173" class="body">● 1921 public station point</text><text x="504" y="209" class="body" style="fill:${colors[0]}">Blue: ZH 618 — ${report.axes[0].distanceMetres} m from point</text><text x="504" y="241" class="body" style="fill:${colors[1]}">Orange: ZH 618.1 — ${report.axes[1].distanceMetres} m from point</text><text x="504" y="285" class="body">Two lanes labelled toward Dietikon</text><text x="504" y="315" class="body">Two lanes labelled toward Autobahn A1</text><text x="504" y="355" class="small">Labels are not assigned to either coloured axis.</text><text x="504" y="395" class="body">Oetwil 0214 also needs direction evidence.</text><text x="504" y="438" class="body">245 complete minutes ≠ approved section</text><text x="504" y="476" class="small">Source: Kanton Zürich WFS, pinned September 2026</text><text x="32" y="550" class="small">Diagnostic only. The station point is unchanged; dotted lines show nearest projections, not vehicle paths.</text></svg>\n`
}

async function main() {
  const read = async file => JSON.parse(await readFile(file, 'utf8'))
  const report = auditDietikonRoad(await loadUnmatchedRoadInputs(), await read('data/cantonal-unmatched-road-scope.json'), await read('data/dietikon-road-review-sources.json'), await read('data/dietikon-road-review-scope.json'))
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/dietikon-road-review.json', JSON.stringify(report, null, 2) + '\n')
  await writeFile(process.argv.find(a => a.startsWith('--map-output='))?.slice(13) ?? 'docs/assets/dietikon-road-review.svg', renderDietikonReview(report))
  console.log(JSON.stringify({ status: report.status, bindingStatus: report.bindingStatus, otherEndpointStatus: report.otherEndpoint.status, observations: report.observations }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
