import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
const digest = value => hash(JSON.stringify(value))
const round = value => Math.round(value * 100) / 100
const SOURCE_URLS = {
  axes: 'https://maps.zh.ch/wfs/TBAStrZHWFS?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:strassenachsen&SRSNAME=EPSG:2056&OUTPUTFORMAT=application%2Fjson&COUNT=100000',
  stations: 'https://maps.zh.ch/wfs/TBAVMSZHWFS?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:verkehrszaehlstellen&SRSNAME=EPSG:2056&OUTPUTFORMAT=application%2Fjson&COUNT=10000',
  collectors: 'https://vdp.zh.ch/pws/public-service/readCollectorsCfg',
}
const validPoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] > 2400000 && p[0] < 2900000 && p[1] > 1000000 && p[1] < 1400000
const family = axis => axis.ownership === 'Gemeinde' ? 'municipal-road' : axis.ownership === 'Stadt Zürich' ? 'city-road' : /HLS|Hochleistungsstrassen/.test(axis.roadClass) ? 'high-speed-road' : /Hauptverkehrsstrassen|Regionale Verbindungsstrassen/.test(axis.roadClass) ? 'classified-road-ambiguity' : 'unclassified-axis'

export function decodeCompleteRoadSource(compressed, source) {
  const body = gunzipSync(compressed)
  if (hash(body) !== source.responseSha256 || body.length !== source.responseBytes) throw new Error('Complete road source hash mismatch')
  return JSON.parse(body)
}

export async function loadUnmatchedRoadInputs() {
  const read = async file => JSON.parse(await readFile(file, 'utf8'))
  const manifest = await read('data/cantonal-unmatched-sources/manifest.json')
  const sources = {}
  for (const [name, url] of Object.entries(SOURCE_URLS)) {
    const source = manifest.sources[name]
    if (source?.url !== url || source.file !== `data/cantonal-unmatched-sources/${name}.json.gz`) throw new Error('Unexpected complete road source')
    sources[name] = decodeCompleteRoadSource(await readFile(source.file), source)
  }
  return { geometry: await read('public/data/zurich-cantonal-road-topology.json'), catalog: await read('data/zurich-cantonal-road-counters.json'), coverage: await read('data/zurich-cantonal-road-coverage-audit.json'), manifest, sources }
}

export function auditUnmatchedRoads(inputs, scope) {
  if (scope.schemaVersion !== 1 || ['geometry', 'catalog', 'coverage', 'manifest', 'sources'].some(key => scope.hashes[key] !== digest(inputs[key]))) throw new Error('Unmatched-road audit inputs changed')
  const { geometry, catalog, coverage, sources, manifest } = inputs
  if (manifest.schemaVersion !== 1 || Object.entries(SOURCE_URLS).some(([key, url]) => manifest.sources[key]?.url !== url)) throw new Error('Complete source URLs changed')
  const axes = validateGeoCollection(sources.axes, 'Complete detailed axes')
  const points = validateGeoCollection(sources.stations, 'Complete station inventory')
  if (axes.some(f => !Number.isInteger(f.properties.strass_id) || f.geometry?.type !== 'LineString' || f.geometry.coordinates.length < 2 || !f.geometry.coordinates.every(validPoint)) || new Set(axes.map(f => f.properties.strass_id)).size !== axes.length) throw new Error('Invalid detailed-axis geometry or duplicate identity')
  if (points.some(f => !Number.isInteger(f.properties.messst_nr) || f.geometry?.type !== 'Point' || !validPoint(f.geometry.coordinates)) || new Set(points.map(f => f.properties.messst_nr)).size !== points.length) throw new Error('Invalid station inventory or duplicate identity')
  if (!Array.isArray(sources.collectors) || !sources.collectors.length) throw new Error('Missing collector inventory')
  const stationPoints = new Map(points.map(f => [f.properties.messst_nr, f]))
  const stationCoverage = new Map(coverage.stationSummaries.map(s => [s.id, s]))
  const selected = geometry.stations.filter(s => s.geometryStatus !== 'matched')
  const reports = selected.map(station => {
    const configured = catalog.stations.find(s => s.id === station.id)
    const collectors = sources.collectors.filter(c => c.uID?.id === `M${station.id.slice(-4)}`), collector = collectors[0]
    if (!configured || digest(configured.detectorIds) !== digest(station.detectorIds) || collectors.length !== 1 || collector.name !== station.name || collector.collectorStatus !== station.collectorStatus || collector.detectors.length !== station.detectorDescriptions.length || !station.detectorDescriptions.every(d => collector.detectors.some(c => c.uID?.id === collector.uID.id && `${station.id}.${c.uID.sub?.id?.padStart(2, '0')}` === d.id && c.name === d.description))) throw new Error(`Collector evidence changed: ${station.id}`)
    const point = stationPoints.get(Number(station.id.split(':')[1]))
    if (point && station.preciseLv95 && Math.hypot(...point.geometry.coordinates.map((n, i) => n - station.preciseLv95[i])) > 0.01) throw new Error(`Station coordinate changed: ${station.id}`)
    if (!point && station.preciseLv95) throw new Error(`Previously located station disappeared: ${station.id}`)
    const observed = stationCoverage.get(station.id)
    if (!observed) throw new Error(`Missing archived station coverage: ${station.id}`)
    const related = coverage.candidatePairs.filter(p => [p.from, p.to].includes(station.id))
    const base = { id: station.id, name: station.name, originalGeometryStatus: station.geometryStatus, publicationStatus: 'not-admitted', collectorIdentityMatches: true, originalCandidates: station.candidates ?? [], observations: { completeMinutes: observed.completeMinutes, longestRunMinutes: observed.longestRunMinutes }, archivedCandidatePairs: related.map(p => ({ from: p.from, to: p.to, pathId: p.pathId, distanceMetres: p.distanceMetres, longestRunMinutes: p.longestRunMinutes, status: p.status })) }
    if (!point) return { ...base, family: 'missing-station', evidenceStatus: 'station-id-required', candidates: [], nextEvidence: 'An exact public station-ID join or separately reviewed precise station source. Coarse detector coordinates cannot replace it.' }
    // Rank every detailed feature before retaining the closest five. Motorway,
    // planned and municipal features all compete, including adjacent fragments.
    const ranked = axes.map(f => ({ featureId: f.properties.strass_id, roadNumber: f.properties.stradatnam?.trim() ?? '', ownership: f.properties.eigentum, roadClass: f.properties.strasstyp, ...projectOnRoad(point.geometry.coordinates, f.geometry.coordinates) })).sort((a, b) => a.distance - b.distance || a.featureId - b.featureId)
    const nearest = ranked[0], margin = ranked[1].distance - nearest.distance
    const category = family(nearest)
    const evidenceStatus = nearest.distance <= 1 && margin >= 15 ? 'clear-local-axis-lead' : 'competing-axes-require-review'
    const nextEvidence = category === 'high-speed-road' ? 'Retain the high-speed-road exclusion; this is not a cantonal main-road expansion candidate.' : category === 'municipal-road' ? 'Review the municipal branch and junction before excluding a specific classified-road association; proximity alone cannot approve a road or direction.' : category === 'city-road' ? 'Review the city-owned axis against the classified network, ownership/scope and neighbouring sections. The detailed class is not an automatic playback approval.' : 'Resolve the competing roads with independent junction, carriageway or grade-separation evidence. Keep the 15 m ambiguity margin unchanged.'
    return { ...base, family: category, evidenceStatus, pointStatus: station.preciseLv95 ? 'unchanged' : 'new-station-requires-review', stationPointLv95: point.geometry.coordinates, nearestAxisDistanceMetres: round(nearest.distance), competingAxisMarginMetres: round(margin), candidates: ranked.slice(0, 5).map(c => ({ featureId: c.featureId, roadNumber: c.roadNumber, ownership: c.ownership, roadClass: c.roadClass, distanceMetres: round(c.distance), projectedLv95: c.projected })), nextEvidence }
  })
  return {
    schemaVersion: 1, status: 'batch-triage-no-publication', inputHashes: scope.hashes,
    summary: { unmatchedStations: reports.length, completeDetailedAxes: axes.length, completeStationPoints: points.length, completeCollectorRecords: sources.collectors.length, families: Object.fromEntries([...new Set(reports.map(r => r.family))].sort().map(f => [f, reports.filter(r => r.family === f).length])) },
    stations: reports,
    limitation: 'Families and nearest-axis leads are diagnostic. No candidates are removed, station points moved, direction gates relaxed, or topology/playback emitted. All source axes compete. Archived coverage does not establish a same-road pair. Previously scoped exclusions remain separate reviewed evidence.',
  }
}

async function main() {
  const inputs = await loadUnmatchedRoadInputs()
  const scope = JSON.parse(await readFile('data/cantonal-unmatched-road-scope.json', 'utf8'))
  const result = auditUnmatchedRoads(inputs, scope)
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/cantonal-unmatched-road-audit.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result.summary, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
