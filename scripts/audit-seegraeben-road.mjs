import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'
import { buildDirectionTopology } from './validate-cantonal-road-directions.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const round = value => Math.round(value * 100) / 100
const PATH = 'ZH:340:0176d9b8f03adcfd'
const BINDINGS = [{ id: 'ZH.CH:2988', featureId: 7862 }, { id: 'ZH.CH:0392', featureId: 274 }]
export const seegraebenInputFiles = {
  geometry: 'public/data/zurich-cantonal-road-topology.json',
  catalog: 'data/zurich-cantonal-road-counters.json',
  directions: 'data/zurich-cantonal-road-directions.json',
  coverage: 'data/zurich-cantonal-road-coverage-audit.json',
  sources: 'data/seegraeben-road-review-sources.json',
}

// This review removes two disproved candidate associations in a private copy.
// It never moves a counter, adds a road, or approves a travel direction.
export function reviewSeegraebenRoadBindings(inputs, scope) {
  if (scope.schemaVersion !== 1 || Object.keys(seegraebenInputFiles).some(key => scope.hashes[key] !== digest(inputs[key]))) throw new Error('Seegräben review inputs changed')
  const { geometry, sources } = inputs
  for (const [key, service, layer] of [['axes', 'TBAStrZHWFS', 'strassenachsen'], ['stations', 'TBAVMSZHWFS', 'verkehrszaehlstellen']]) {
    const url = new URL(sources[key].url)
    if (url.origin !== 'https://maps.zh.ch' || url.pathname !== `/wfs/${service}` || url.searchParams.get('TYPENAMES') !== `ms:${layer}` || url.searchParams.get('SRSNAME') !== 'EPSG:2056' || url.searchParams.get('BBOX') !== '2700100,1243200,2700800,1243900,EPSG:2056') throw new Error('Unexpected Seegräben source query')
  }
  const axes = validateGeoCollection(sources.axes.collection, 'Seegräben axes')
  const stations = validateGeoCollection(sources.stations.collection, 'Seegräben stations')
  if (new Set(axes.map(f => f.properties.strass_id)).size !== axes.length || axes.some(f => f.geometry?.type !== 'LineString' || f.geometry.coordinates.length < 2 || !f.geometry.coordinates.every(p => p.length === 2 && p.every(Number.isFinite) && p[0] > 2400000 && p[0] < 2900000 && p[1] > 1000000 && p[1] < 1400000))) throw new Error('Invalid detailed road axes')
  if (sources.collectors.url !== 'https://vdp.zh.ch/pws/public-service/readCollectorsCfg' || sources.collectors.records.length !== 2) throw new Error('Unexpected Seegräben collectors')
  const reviewedGeometry = structuredClone(geometry)
  const stationReviews = BINDINGS.map(({ id, featureId }) => {
    const station = reviewedGeometry.stations.find(s => s.id === id)
    const number = Number(id.split(':')[1])
    const matches = stations.filter(f => f.properties.messst_nr === number)
    const feature = matches[0]
    if (!station || station.geometryStatus !== 'off-network' || station.match !== null || station.candidates.length !== 1 || station.candidates[0].pathId !== PATH) throw new Error('Original Seegräben road association changed')
    if (matches.length !== 1 || feature.geometry?.type !== 'Point' || feature.geometry.coordinates.length !== 2 || !feature.geometry.coordinates.every(Number.isFinite) || Math.hypot(...feature.geometry.coordinates.map((n, i) => n - station.preciseLv95[i])) > 0.01) throw new Error('Seegräben station point changed')
    const collectors = sources.collectors.records.filter(c => c.uID.id === `M${id.slice(-4)}`)
    const collector = collectors[0]
    if (collectors.length !== 1 || collector.name !== station.name || collector.collectorStatus !== 'ACTIVE' || collector.detectors.length !== station.detectorDescriptions.length || !station.detectorDescriptions.every(d => collector.detectors.some(c => c.uID.id === collector.uID.id && `${id}.${c.uID.sub.id.padStart(2, '0')}` === d.id && c.name === d.description))) throw new Error('Seegräben collector identity changed')
    const candidates = axes.map(axis => ({ axis, hit: projectOnRoad(station.preciseLv95, axis.geometry.coordinates) })).sort((a, b) => a.hit.distance - b.hit.distance)
    const nearest = candidates[0], competing = candidates[1]
    if (nearest.axis.properties.strass_id !== featureId || nearest.axis.properties.eigentum !== 'Gemeinde' || nearest.axis.properties.stradatnam.trim() !== '' || nearest.hit.distance > 1 || competing.hit.distance - nearest.hit.distance < 15) throw new Error('Municipal road binding is not independently clear')
    const main = candidates.find(c => c.axis.properties.stradatnam.trim() === '340')
    if (!main || main.hit.distance <= 25 || Math.abs(main.hit.distance - station.candidates[0].distanceMetres) > 0.02) throw new Error('ZH 340 separation evidence changed')
    const points = nearest.axis.geometry.coordinates
    const joins = [points[0], points.at(-1)].flatMap(point => candidates.filter(c => c.axis.properties.stradatnam.trim() === '340').map(c => ({ point, featureId: c.axis.properties.strass_id, distance: projectOnRoad(point, c.axis.geometry.coordinates).distance }))).filter(j => j.distance <= 0.01)
    if (!joins.length) throw new Error('Municipal road junction evidence changed')
    station.candidates = []
    station.geometryStatus = 'reviewed-outside-classified-network'
    return {
      id, name: station.name, stationPointLv95: station.preciseLv95,
      status: 'excluded-from-ZH-340', detailedAxisFeatureId: featureId,
      ownership: nearest.axis.properties.eigentum, detailedAxisClass: nearest.axis.properties.strasstyp,
      axisDistanceMetres: round(nearest.hit.distance), nearestCompetingAxisDistanceMetres: round(competing.hit.distance),
      rejectedPathId: PATH, classifiedRoadDistanceMetres: round(main.hit.distance),
      junctions: joins.map(j => ({ pointLv95: j.point, mainRoadFeatureId: j.featureId, distanceMetres: round(j.distance) })),
      evidence: 'Exact station identity and unchanged point lie on a municipality-owned detailed axis, which meets ZH 340 at a separate junction. Collector road and destination labels remain unchanged. No travel direction is inferred.',
    }
  })
  return { reviewedGeometry, stationReviews }
}

export function auditSeegraebenRoad(inputs, scope) {
  const { reviewedGeometry, stationReviews } = reviewSeegraebenRoadBindings(inputs, scope)
  const { geometry, catalog, directions, coverage } = inputs
  const baseline = buildDirectionTopology(geometry, catalog, directions.places)
  if (digest(baseline.stationAudit) !== digest(directions.stationAudit) || digest(baseline.sectionAudit) !== digest(directions.sectionAudit)) throw new Error('Baseline direction evidence changed')
  const revised = buildDirectionTopology(reviewedGeometry, catalog, directions.places)
  // New adjacency is only a research lead. Deleting a false candidate never
  // authorizes connecting the surrounding counters or publishing a section.
  const key = p => `${p.pathId}:${p.from}:${p.to}`
  const originalKeys = new Set(baseline.sectionAudit.map(key)), revisedKeys = new Set(revised.sectionAudit.map(key))
  const removedPairs = coverage.candidatePairs.filter(p => originalKeys.has(key(p)) && !revisedKeys.has(key(p))).map(p => ({ ...p, publicationStatus: 'rejected-wrong-road', reason: 'At least one endpoint measures a municipal branch, not ZH 340.' }))
  return {
    schemaVersion: 1, status: 'review-only-no-publication', inputHashes: scope.hashes,
    stationReviews, removedPairs,
    newDiagnosticPairs: revised.sectionAudit.filter(p => !originalKeys.has(key(p))).map(p => ({ ...p, publicationStatus: 'not-admitted', endpoints: [p.from, p.to].map(id => ({ id, name: geometry.stations.find(s => s.id === id)?.name, status: revised.stationAudit.find(s => s.id === id)?.status })) })),
    limitation: 'The original coverage and direction archives remain intact. These exclusions apply only to the two reviewed station-to-ZH-340 associations. New adjacent pairs still require geometry, direction, observation and junction reviews. No playback or topology is emitted.',
  }
}

async function main() {
  const inputs = Object.fromEntries(await Promise.all(Object.entries(seegraebenInputFiles).map(async ([key, file]) => [key, JSON.parse(await readFile(file, 'utf8'))])))
  const scope = JSON.parse(await readFile('data/seegraeben-road-audit-scope.json', 'utf8'))
  const result = auditSeegraebenRoad(inputs, scope)
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/seegraeben-road-review.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ status: result.status, reviewedStations: result.stationReviews.length, removedPairs: result.removedPairs.length, newDiagnosticPairs: result.newDiagnosticPairs }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
