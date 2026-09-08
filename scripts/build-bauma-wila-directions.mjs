import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDirectionTopology, destinationCandidates, orientDestination } from './validate-cantonal-road-directions.mjs'
import { junctionCandidates } from './audit-cantonal-road-junctions.mjs'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
const digest = value => hash(JSON.stringify(value))
const STATIONS = ['ZH.CH:3588', 'ZH.CH:1623']
const PATH = 'ZH:15:84dba2b1e4cc6ff9'

export function buildBaumaWilaDirections(geometry, catalog, baseline, sources, review, inventory) {
  if (review.schemaVersion !== 1 || review.geometrySha256 !== digest(geometry) || review.catalogSha256 !== digest(catalog) || review.placesSha256 !== digest(baseline.places) || review.sourcesSha256 !== digest(sources) || review.inventorySha256 !== digest(inventory)) throw new Error('Bauma–Wila review inputs changed')
  if (review.stations.length !== 2 || new Set(review.stations.map(s => s.id)).size !== 2 || review.stations.some(s => !STATIONS.includes(s.id))) throw new Error('Unexpected Bauma–Wila review scope')
  const names = ['Wald', 'Wald AR', 'Wald BE', 'Wald ZH']
  if (sources.destinations.length !== 4 || sources.destinations.map(s => s.name).sort().join('|') !== names.join('|')) throw new Error('All Wald searches are required')
  const representations = sources.destinations.flatMap(source => {
    const url = new URL(source.url)
    if (url.origin !== 'https://api3.geo.admin.ch' || url.pathname !== '/rest/services/ech/MapServer/find' || url.searchParams.get('layer') !== 'ch.swisstopo.swissnames3d' || url.searchParams.get('searchText') !== source.name || url.searchParams.get('contains') !== 'false' || url.searchParams.get('sr') !== '2056' || source.sha256 !== digest(source.response)) throw new Error('Unexpected Wald source')
    // The broad search exceeds the generic result cap. Its completeness is
    // checked against the full downloadable inventory below, not assumed.
    return source.response.results.flatMap(feature => destinationCandidates(source.name, { results: [feature] }))
  })
  const candidates = [...new Map(representations.map(c => [`${c.name}:${c.bounds.join(':')}`, c])).values()]
  if (inventory.schemaVersion !== 1 || inventory.rows.length !== 25 || candidates.length !== inventory.rows.length || new Set(inventory.rows.map(r => r.UUID)).size !== inventory.rows.length) throw new Error('Wald inventory coverage changed')
  const covered = new Set()
  for (const row of inventory.rows) {
    const matches = candidates.filter(c => c.name === row.NAME && Number(row.E) >= c.bounds[0] && Number(row.E) <= c.bounds[2] && Number(row.N) >= c.bounds[1] && Number(row.N) <= c.bounds[3])
    if (row.OBJEKTKLASSE_TLM !== 'TLM_SIEDLUNGSNAME' || matches.length !== 1 || covered.has(matches[0])) throw new Error('Wald inventory crosswalk is not one-to-one')
    covered.add(matches[0])
  }
  const path = geometry.paths.find(p => p.id === PATH)
  if (!path?.axisName.includes('Wald')) throw new Error('Missing named Wald road axis')
  const points = path.points.map(p => wgs84ToLv95(...p))
  const automatic = buildDirectionTopology(geometry, catalog, baseline.places)
  const destinationReviews = []
  for (const pin of review.stations) {
    const audit = automatic.stationAudit.find(s => s.id === pin.id)
    const station = geometry.stations.find(s => s.id === pin.id)
    const records = catalog.detectors.filter(d => station.detectorIds.includes(d.id))
    if (audit.pathId !== PATH || digest(audit.detectors) !== pin.detectorAuditSha256 || audit.detectors.length !== 2 || records.length !== 2 || records.some(d => d.carriageway !== 'mainCarriageway' || d.lane !== 'lane1') || audit.detectors.find(d => d.id === `${pin.id}.01`)?.direction !== 'positive' || audit.detectors.find(d => d.id === `${pin.id}.02`)?.description !== 'Normalspur Richtung Wald') throw new Error('Bauma–Wila station evidence changed')
    const regional = orientDestination(station.preciseLv95, points, candidates)
    const alternatives = candidates.map(c => ({ ...orientDestination(station.preciseLv95, points, [c]), destination: c }))
    // This is an explicit homonym review, not a global nearest-place fallback.
    // Exactly one alternative must pass every gate in the opposing direction.
    // A passing alternative in the anchor direction can only be excluded when
    // the catalog independently confirms two opposing normal main-road lanes.
    const accepted = alternatives.filter(a => a.status === 'validated' && a.direction === 'negative')
    const sameDirection = alternatives.filter(a => a.status === 'validated' && a.direction === 'positive')
    const opposingLanes = new Set(records.map(d => d.direction)).size === 2 && records.every(d => ['positive', 'negative'].includes(d.direction))
    if (regional.status !== 'ambiguous-destination' || accepted.length !== 1 || accepted[0].destination.name !== 'Wald ZH' || (sameDirection.length && !opposingLanes)) throw new Error('Wald destination is not uniquely supported by the road')
    for (const alternative of sameDirection) alternative.reviewExclusion = 'Same path direction as validated Winterthur anchor; catalog confirms opposing normal lanes'
    destinationReviews.push({ stationId: pin.id, originalStatus: audit.detectors[1].status, qualifiedRegionalStatus: regional.status, method: 'explicit-qualified-destination-road-review', alternatives, selected: 'Wald ZH', anchorDetectorId: `${pin.id}.01` })
  }
  const places = { ...baseline.places, entries: baseline.places.entries.map(e => e.name === 'Wald' ? { ...e, candidates: candidates.filter(c => c.name === 'Wald ZH') } : e) }
  const topology = buildDirectionTopology(geometry, catalog, baseline.places, [], new Map(STATIONS.map(id => [id, { places }])))
  for (const item of destinationReviews) {
    const station = topology.stationAudit.find(s => s.id === item.stationId)
    if (station.status !== 'validated') throw new Error('Bauma–Wila direction still unresolved')
    station.detectors.find(d => d.id === `${station.id}.02`).review = item
  }
  const section = topology.sections.find(s => s.fromSiteId === `${STATIONS[0]}:axis-positive` && s.toSiteId === `${STATIONS[1]}:axis-positive`)
  if (!section) throw new Error('Bauma–Wila section is not continuous')
  const url = new URL(sources.junctions.url), bounds = url.searchParams.get('BBOX')?.split(',')
  if (url.origin !== 'https://maps.zh.ch' || url.pathname !== '/wfs/TBAStrZHWFS' || url.searchParams.get('TYPENAMES') !== 'ms:strassenachsen' || url.searchParams.get('SRSNAME') !== 'EPSG:2056' || bounds?.length !== 5 || bounds[4] !== 'EPSG:2056' || !bounds.slice(0, 4).map(Number).every(Number.isFinite)) throw new Error('Unexpected junction source')
  const [west, south, east, north] = bounds.map(Number)
  if (section.path.map(p => wgs84ToLv95(...p)).some(([x, y]) => x < west || x > east || y < south || y > north)) throw new Error('Junction extract does not cover the section')
  const junctions = junctionCandidates(section.path, '15', sources.junctions.collection)
  const excluded = geometry.stations.find(s => s.id === 'ZH.CH:2891')
  const excludedReview = { stationId: excluded.id, status: 'not-admitted', qualifiedDestinationResult: orientDestination(excluded.preciseLv95, points, candidates.filter(c => c.name === 'Wald ZH')) }
  return { topology, destinationReviews, junctions, excludedReview }
}

async function main() {
  const files = ['public/data/zurich-cantonal-road-topology.json', 'data/zurich-cantonal-road-counters.json', 'data/zurich-cantonal-road-directions.json', 'data/bauma-wila-review-sources.json', 'data/bauma-wila-direction-scope.json', 'data/bauma-wald-settlement-inventory.json']
  const bodies = await Promise.all(files.map(f => readFile(f, 'utf8')))
  const { topology, ...review } = buildBaumaWilaDirections(...bodies.map(b => JSON.parse(b)))
  topology.metadata.directionReviewSha256 = hash(bodies[4])
  topology.metadata.directionInputHashes = Object.fromEntries(files.map((f, i) => [f, hash(bodies[i])]))
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? '/tmp/bauma-wila-directions.json', JSON.stringify(topology) + '\n')
  const report = { status: 'validated-for-pilot', sourceHashes: topology.metadata.directionInputHashes, ...review, sections: topology.sections.filter(s => s.road === 'ZH:15').map(({ path, ...s }) => ({ ...s, pathPoints: path.length })), limitation: 'Explicit station-scoped homonym inference. Geometric junction candidates are not surveyed turns or an inventory of all private access. Turning flows and individual trajectories are not measured.' }
  await writeFile('data/bauma-wila-review.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ status: report.status, sections: report.sections, junctions: review.junctions.map(({ offsetMetres, axes }) => ({ offsetMetres, axes })) }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
