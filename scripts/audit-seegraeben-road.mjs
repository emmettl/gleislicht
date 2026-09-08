import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reviewMunicipalRoadBindings } from './review-municipal-road-bindings.mjs'
import { buildDirectionTopology } from './validate-cantonal-road-directions.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const BINDINGS = [{ id: 'ZH.CH:2988', featureId: 7862 }, { id: 'ZH.CH:0392', featureId: 274 }]
export const seegraebenInputFiles = {
  geometry: 'public/data/zurich-cantonal-road-topology.json',
  catalog: 'data/zurich-cantonal-road-counters.json',
  directions: 'data/zurich-cantonal-road-directions.json',
  coverage: 'data/zurich-cantonal-road-coverage-audit.json',
  sources: 'data/seegraeben-road-review-sources.json',
}

export function reviewSeegraebenRoadBindings(inputs, scope) {
  return reviewMunicipalRoadBindings(inputs, scope, { bindings: BINDINGS, bbox: '2700100,1243200,2700800,1243900,EPSG:2056' })
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
