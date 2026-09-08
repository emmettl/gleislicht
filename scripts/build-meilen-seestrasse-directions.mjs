import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMeilenDirections } from './build-meilen-staefa-directions.mjs'
import { buildDirectionTopology, destinationCandidates } from './validate-cantonal-road-directions.mjs'
import { junctionCandidates } from './audit-cantonal-road-junctions.mjs'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
const digest = value => hash(JSON.stringify(value))
const STATIONS = ['ZH.CH:0491', 'ZH.CH:0591']

export function buildMeilenSeestrasseDirections(geometry, catalog, baseline, sources, continuation, review, junctionSource) {
  if (review.schemaVersion !== 1 || review.geometrySha256 !== digest(geometry) || review.catalogSha256 !== digest(catalog) || review.continuationSha256 !== digest(continuation) || review.junctionSourceSha256 !== digest(junctionSource)) throw new Error('Meilen review inputs changed')
  // Reuse the complete source, join and destination validation of the original
  // continuation review, then apply it only to this separately pinned counter pair.
  const verified = buildMeilenDirections(geometry, catalog, baseline, sources, continuation)
  if (review.stations.length !== 2 || new Set(review.stations.map(s => s.id)).size !== 2 || review.stations.some(s => !STATIONS.includes(s.id))) throw new Error('Unexpected Meilen review scope')
  const automatic = buildDirectionTopology(geometry, catalog, baseline.places)
  for (const station of review.stations) {
    const audit = automatic.stationAudit.find(s => s.id === station.id)
    if (audit?.pathId !== continuation.pathId || digest(audit.detectors) !== station.detectorAuditSha256 || audit.detectors.find(d => d.id === `${station.id}.01`)?.direction !== 'negative') throw new Error('Meilen station evidence changed')
  }
  const original = geometry.paths.find(p => p.id === continuation.pathId)
  const extension = continuation.collection.features.find(f => f.properties.GmlID === continuation.selectedFeatureId).geometry.coordinates[0].slice().reverse()
  const points = [...original.points.map(p => wgs84ToLv95(...p)), ...extension]
  const candidates = sources.destinations.flatMap(s => destinationCandidates(s.name, s.response))
  const places = { ...baseline.places, entries: baseline.places.entries.map(e => e.name === 'Rapperswil' ? { ...e, candidates } : e) }
  const topology = buildDirectionTopology(geometry, catalog, baseline.places, [], new Map(STATIONS.map(id => [id, { points, places }])))
  for (const id of STATIONS) {
    const station = topology.stationAudit.find(s => s.id === id)
    if (station.status !== 'validated' || station.detectors.find(d => d.id === `${id}.02`)?.direction !== 'positive') throw new Error('Meilen direction still unresolved')
    station.detectors.find(d => d.id === `${id}.02`).review = { method: 'qualified-destination-and-official-axis-continuation', originalStatus: 'unresolved-destination', continuationFeatureId: continuation.selectedFeatureId }
  }
  const section = topology.sections.find(s => s.fromSiteId === `${STATIONS[0]}:axis-positive` && s.toSiteId === `${STATIONS[1]}:axis-positive`)
  if (!section) throw new Error('Meilen counter section is not continuous')
  const url = new URL(junctionSource.url)
  const bounds = url.searchParams.get('BBOX')?.split(',')
  if (url.origin !== 'https://maps.zh.ch' || url.pathname !== '/wfs/TBAStrZHWFS' || url.searchParams.get('TYPENAMES') !== 'ms:strassenachsen' || url.searchParams.get('SRSNAME') !== 'EPSG:2056' || bounds?.length !== 5 || bounds[4] !== 'EPSG:2056' || !bounds.slice(0, 4).map(Number).every(Number.isFinite)) throw new Error('Unexpected junction source')
  const [west, south, east, north] = bounds.map(Number)
  if (section.path.map(p => wgs84ToLv95(...p)).some(([x, y]) => x < west || x > east || y < south || y > north)) throw new Error('Junction extract does not cover the section')
  const junctions = junctionCandidates(section.path, '17', junctionSource.collection)
  topology.metadata.directionContinuation = { ...verified.metadata.directionContinuation, stationIds: STATIONS }
  return { topology, junctions }
}

async function main() {
  const files = ['public/data/zurich-cantonal-road-topology.json', 'data/zurich-cantonal-road-counters.json', 'data/zurich-cantonal-road-directions.json', 'data/lakeside-road-review-sources.json', 'data/meilen-staefa-axis-continuation.json', 'data/meilen-seestrasse-direction-scope.json', 'data/meilen-seestrasse-junction-source.json']
  const bodies = await Promise.all(files.map(f => readFile(f, 'utf8')))
  const { topology, junctions } = buildMeilenSeestrasseDirections(...bodies.map(b => JSON.parse(b)))
  topology.metadata.directionReviewSha256 = hash(bodies[5])
  topology.metadata.directionInputHashes = Object.fromEntries(files.map((f, i) => [f, hash(bodies[i])]))
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? '/tmp/meilen-seestrasse-directions.json', JSON.stringify(topology) + '\n')
  const report = { status: 'validated-for-pilot', sourceHashes: topology.metadata.directionInputHashes, continuation: topology.metadata.directionContinuation, detectors: topology.stationAudit.filter(s => STATIONS.includes(s.id)), sections: topology.sections.filter(s => s.road === 'ZH:17').map(({ path, ...s }) => ({ ...s, pathPoints: path.length })), junctions, limitation: 'Geometric junction candidates, not surveyed turns or an inventory of all private access. Turning flows and individual trajectories are not measured.' }
  await writeFile('data/meilen-seestrasse-review.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ status: report.status, sections: report.sections, junctions: junctions.map(({ offsetMetres, axes }) => ({ offsetMetres, axes })) }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
