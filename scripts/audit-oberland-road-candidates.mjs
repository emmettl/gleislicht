import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDirectionTopology, destinationCandidates, directionDestination, orientDestination } from './validate-cantonal-road-directions.mjs'
import { reviewCantonalDirection } from './review-cantonal-road-direction.mjs'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
const digest = value => hash(JSON.stringify(value))
const NAMES = ['Gossau SG', 'Gossau ZH', 'Pfäffikon SZ', 'Pfäffikon ZH', 'Wetzikon TG', 'Wetzikon ZH']
const BASES = ['Gossau', 'Pfäffikon', 'Wetzikon']

export function auditOberlandRoadCandidates(inputs, scope) {
  if (scope.schemaVersion !== 1 || Object.keys(inputs).some(key => scope.hashes[key] !== digest(inputs[key]))) throw new Error('Oberland audit inputs changed')
  const { geometry, catalog, baseline, coverage, sources, inventory } = inputs
  if (sources.destinations.length !== 6 || sources.destinations.map(s => s.name).sort().join('|') !== NAMES.join('|')) throw new Error('All six settlement searches are required')
  const candidates = sources.destinations.flatMap(source => {
    const url = new URL(source.url)
    if (url.origin !== 'https://api3.geo.admin.ch' || url.pathname !== '/rest/services/ech/MapServer/find' || url.searchParams.get('layer') !== 'ch.swisstopo.swissnames3d' || url.searchParams.get('searchText') !== source.name || url.searchParams.get('contains') !== 'false' || url.searchParams.get('sr') !== '2056' || source.sha256 !== digest(source.response)) throw new Error('Unexpected settlement source')
    return destinationCandidates(source.name, source.response)
  })
  if (inventory.schemaVersion !== 1 || inventory.rows.length !== 6 || candidates.length !== 6 || new Set(inventory.rows.map(r => r.UUID)).size !== 6) throw new Error('Settlement inventory coverage changed')
  const covered = new Set()
  for (const row of inventory.rows) {
    const matches = candidates.filter(c => c.name === row.NAME && Number(row.E) >= c.bounds[0] && Number(row.E) <= c.bounds[2] && Number(row.N) >= c.bounds[1] && Number(row.N) <= c.bounds[3])
    if (row.OBJEKTKLASSE_TLM !== 'TLM_SIEDLUNGSNAME' || matches.length !== 1 || covered.has(matches[0])) throw new Error('Settlement inventory crosswalk is not one-to-one')
    covered.add(matches[0])
  }
  const automatic = buildDirectionTopology(geometry, catalog, baseline.places)
  if (digest(automatic.stationAudit) !== digest(baseline.stationAudit)) throw new Error('Baseline detector audit changed')
  const audits = new Map(automatic.stationAudit.map(s => [s.id, s]))
  const affected = new Set(automatic.stationAudit.filter(s => s.detectors.some(d => BASES.includes(directionDestination(d.description)))).map(s => s.id))
  const pairs = coverage.candidatePairs.filter(p => p.longestRunMinutes >= 60 && (affected.has(p.from) || affected.has(p.to)))
  const ids = new Set(pairs.flatMap(p => [p.from, p.to]))
  const paths = new Map(geometry.paths.map(p => [p.id, p.points.map(p => wgs84ToLv95(...p))]))
  const stations = new Map(geometry.stations.map(s => [s.id, s]))
  // Optimistic diagnostic only: would the Zürich-qualified destination be
  // sufficient even if a later explicit homonym review established its identity?
  // This context is never returned as a topology or used to publish a recording.
  const places = { ...baseline.places, entries: baseline.places.entries.map(e => BASES.includes(e.name) ? { ...e, candidates: candidates.filter(c => c.name === `${e.name} ZH`) } : e) }
  const diagnostics = buildDirectionTopology(geometry, catalog, baseline.places, [], new Map([...ids].map(id => [id, { places }])))
  const records = new Map(catalog.detectors.map(d => [d.id, d]))
  const stationReports = [...ids].sort().map(id => {
    const original = audits.get(id), diagnostic = diagnostics.stationAudit.find(s => s.id === id), station = stations.get(id)
    const aliases = original.detectors.filter(d => BASES.includes(directionDestination(d.description))).map(d => {
      const name = directionDestination(d.description), options = candidates.filter(c => c.name.startsWith(`${name} `))
      return { detectorId: d.id, originalStatus: d.status, regionalResult: orientDestination(station.preciseLv95, paths.get(original.pathId), options), alternatives: options.map(c => ({ ...orientDestination(station.preciseLv95, paths.get(original.pathId), [c]), destination: c })) }
    })
    let reviewMethodCouldApply = false
    const anchor = diagnostic.detectors.find(d => d.status === 'validated'), pending = diagnostic.detectors.find(d => d.status === 'destination-extent-conflict')
    if (anchor && pending) {
      try {
        reviewCantonalDirection(station, diagnostic.detectors, records, { stationId: id, pathId: diagnostic.pathId, road: diagnostic.road, detectorAuditSha256: digest(diagnostic.detectors), method: 'opposing-main-carriageway-lanes', anchorDetectorId: anchor.id, reviewedDetectorId: pending.id })
        reviewMethodCouldApply = true
      } catch { /* An inapplicable review is a remaining blocker, never an override. */ }
    }
    return { id, name: station.name, originalStatus: original.status, qualifiedZhDiagnostic: { status: diagnostic.status, detectors: diagnostic.detectors }, aliases, existingOpposingLaneMethodCouldApply: reviewMethodCouldApply, furtherEvidenceRequired: diagnostic.status !== 'validated' && !reviewMethodCouldApply }
  })
  const reports = new Map(stationReports.map(s => [s.id, s]))
  const candidatePairs = pairs.map(pair => ({ ...pair, publicationStatus: 'not-admitted', furtherEvidenceRequired: [pair.from, pair.to].some(id => reports.get(id).furtherEvidenceRequired), diagnosticBlockers: [pair.from, pair.to].map(id => ({ stationId: id, status: reports.get(id).qualifiedZhDiagnostic.status, existingOpposingLaneMethodCouldApply: reports.get(id).existingOpposingLaneMethodCouldApply, detectors: reports.get(id).qualifiedZhDiagnostic.detectors.filter(d => d.status !== 'validated').map(({ id, description, status }) => ({ id, description, status })) })) }))
  return { status: 'review-only-no-publication', inputHashes: scope.hashes, summary: { settlementCandidates: candidates.length, stations: stationReports.length, candidatePairs: candidatePairs.length, pairsStillRequiringEvidence: candidatePairs.filter(p => p.furtherEvidenceRequired).length }, stationReports, candidatePairs, limitation: 'Zürich-qualified results are optimistic diagnostics, not approved homonym mappings. Complete observations, name resolution and applicable review methods do not by themselves authorize playback. No topology, recording catalog or playback artifact is emitted.' }
}

async function main() {
  const files = { geometry: 'public/data/zurich-cantonal-road-topology.json', catalog: 'data/zurich-cantonal-road-counters.json', baseline: 'data/zurich-cantonal-road-directions.json', coverage: 'data/zurich-cantonal-road-coverage-audit.json', sources: 'data/oberland-road-review-sources.json', inventory: 'data/oberland-road-settlement-inventory.json' }
  const inputs = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) => [key, JSON.parse(await readFile(file, 'utf8'))])))
  const scope = JSON.parse(await readFile('data/oberland-road-audit-scope.json', 'utf8'))
  const result = auditOberlandRoadCandidates(inputs, scope)
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/oberland-road-candidate-audit.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result.summary, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
