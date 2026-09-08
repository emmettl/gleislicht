import { createHash } from 'node:crypto'
import { projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const round = value => Math.round(value * 100) / 100
const PATH = 'ZH:340:0176d9b8f03adcfd'

// This review removes disproved candidate associations in a private copy.
// It never moves a counter, adds a road, or approves a travel direction.
export function reviewMunicipalRoadBindings(inputs, scope, { bindings, bbox }) {
  if (scope.schemaVersion !== 1 || ['geometry', 'catalog', 'directions', 'coverage', 'sources'].some(key => scope.hashes[key] !== digest(inputs[key]))) throw new Error('Municipal review inputs changed')
  const { geometry, sources } = inputs
  for (const [key, service, layer] of [['axes', 'TBAStrZHWFS', 'strassenachsen'], ['stations', 'TBAVMSZHWFS', 'verkehrszaehlstellen']]) {
    const url = new URL(sources[key].url)
    if (url.origin !== 'https://maps.zh.ch' || url.pathname !== `/wfs/${service}` || url.searchParams.get('TYPENAMES') !== `ms:${layer}` || url.searchParams.get('SRSNAME') !== 'EPSG:2056' || url.searchParams.get('BBOX') !== bbox) throw new Error('Unexpected Municipal source query')
  }
  const axes = validateGeoCollection(sources.axes.collection, 'Municipal axes')
  const stations = validateGeoCollection(sources.stations.collection, 'Municipal stations')
  if (new Set(axes.map(f => f.properties.strass_id)).size !== axes.length || axes.some(f => f.geometry?.type !== 'LineString' || f.geometry.coordinates.length < 2 || !f.geometry.coordinates.every(p => p.length === 2 && p.every(Number.isFinite) && p[0] > 2400000 && p[0] < 2900000 && p[1] > 1000000 && p[1] < 1400000))) throw new Error('Invalid detailed road axes')
  if (sources.collectors.url !== 'https://vdp.zh.ch/pws/public-service/readCollectorsCfg' || sources.collectors.records.length !== bindings.length) throw new Error('Unexpected Municipal collectors')
  const reviewedGeometry = structuredClone(geometry)
  const stationReviews = bindings.map(({ id, featureId }) => {
    const station = reviewedGeometry.stations.find(s => s.id === id)
    const number = Number(id.split(':')[1])
    const matches = stations.filter(f => f.properties.messst_nr === number)
    const feature = matches[0]
    if (!station || station.geometryStatus !== 'off-network' || station.match !== null || station.candidates.length !== 1 || station.candidates[0].pathId !== PATH) throw new Error('Original Municipal road association changed')
    if (matches.length !== 1 || feature.geometry?.type !== 'Point' || feature.geometry.coordinates.length !== 2 || !feature.geometry.coordinates.every(Number.isFinite) || Math.hypot(...feature.geometry.coordinates.map((n, i) => n - station.preciseLv95[i])) > 0.01) throw new Error('Municipal station point changed')
    const collectors = sources.collectors.records.filter(c => c.uID.id === `M${id.slice(-4)}`)
    const collector = collectors[0]
    if (collectors.length !== 1 || collector.name !== station.name || collector.collectorStatus !== 'ACTIVE' || collector.detectors.length !== station.detectorDescriptions.length || !station.detectorDescriptions.every(d => collector.detectors.some(c => c.uID.id === collector.uID.id && `${id}.${c.uID.sub.id.padStart(2, '0')}` === d.id && c.name === d.description))) throw new Error('Municipal collector identity changed')
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

