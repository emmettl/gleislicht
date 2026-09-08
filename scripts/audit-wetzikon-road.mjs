import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reviewMunicipalRoadBindings } from './review-municipal-road-bindings.mjs'
import { auditSeegraebenRoad, reviewSeegraebenRoadBindings } from './audit-seegraeben-road.mjs'
import { buildDirectionTopology } from './validate-cantonal-road-directions.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const PATH = 'ZH:340:0176d9b8f03adcfd'
export const wetzikonInputFiles = {
  geometry: 'public/data/zurich-cantonal-road-topology.json',
  catalog: 'data/zurich-cantonal-road-counters.json',
  directions: 'data/zurich-cantonal-road-directions.json',
  coverage: 'data/zurich-cantonal-road-coverage-audit.json',
  sources: 'data/wetzikon-road-review-sources.json',
  seegraebenSources: 'data/seegraeben-road-review-sources.json',
  seegraebenScope: 'data/seegraeben-road-audit-scope.json',
  seegraebenReview: 'data/seegraeben-road-review.json',
}

export function auditWetzikonRoad(inputs, scope) {
  if (scope.schemaVersion !== 1 || Object.keys(wetzikonInputFiles).some(key => scope.hashes[key] !== digest(inputs[key]))) throw new Error('Wetzikon review inputs changed')
  const previousInputs = { geometry: inputs.geometry, catalog: inputs.catalog, directions: inputs.directions, coverage: inputs.coverage, sources: inputs.seegraebenSources }
  const previousReport = auditSeegraebenRoad(previousInputs, inputs.seegraebenScope)
  if (digest(previousReport) !== digest(inputs.seegraebenReview)) throw new Error('Seegräben follow-up evidence changed')
  const { reviewedGeometry } = reviewSeegraebenRoadBindings(previousInputs, inputs.seegraebenScope)
  const wetzikon = reviewMunicipalRoadBindings(inputs, scope, {
    bindings: [{ id: 'ZH.CH:2788', featureId: 2165 }],
    bbox: '2701000,1242500,2702000,1243500,EPSG:2056',
  })
  const reviewedStation = wetzikon.reviewedGeometry.stations.find(s => s.id === 'ZH.CH:2788')
  reviewedGeometry.stations = reviewedGeometry.stations.map(s => s.id === reviewedStation.id ? reviewedStation : s)
  const diagnostic = buildDirectionTopology(reviewedGeometry, inputs.catalog, inputs.directions.places)
  const remaining = diagnostic.sectionAudit.filter(p => p.pathId === PATH && [p.from, p.to].includes('ZH.CH:0188'))
  const rejected = previousReport.newDiagnosticPairs.filter(p => p.pathId === PATH && [p.from, p.to].includes(reviewedStation.id))
  if (rejected.length !== 1 || rejected[0].from !== 'ZH.CH:0188' || rejected[0].to !== reviewedStation.id) throw new Error('Expected Uster–Wetzikon follow-up pair changed')
  if (diagnostic.sectionAudit.some(p => p.pathId === PATH && (p.from === 'ZH.CH:0188' || [p.from, p.to].some(id => ['ZH.CH:2988', 'ZH.CH:0392', 'ZH.CH:2788'].includes(id))))) throw new Error('Reviewed municipal associations remain on the path')
  return {
    schemaVersion: 1, status: 'review-only-no-publication', inputHashes: scope.hashes,
    stationReview: wetzikon.stationReviews[0],
    priorExclusions: previousReport.stationReviews.map(({ id, detailedAxisFeatureId, status }) => ({ id, detailedAxisFeatureId, status })),
    rejectedFollowUpPairs: rejected.map(p => ({ ...p, publicationStatus: 'rejected-wrong-road', reason: 'Counter 2788 measures a municipal Usterstrasse branch, not ZH 340. The apparent 0188–2788 adjacency cannot form a same-road recording.' })),
    remainingPairsTouchingUster: remaining.map(p => ({ ...p, publicationStatus: 'not-admitted', endpointAudits: [p.from, p.to].map(id => diagnostic.stationAudit.find(s => s.id === id)) })),
    easternExtension: { anchorStationId: 'ZH.CH:0188', pathId: PATH, status: 'no-further-counter-on-reviewed-path', reviewedExcludedStations: ['ZH.CH:2988', 'ZH.CH:0392', 'ZH.CH:2788'] },
    limitation: 'This closes the proposed eastward ZH 340 recording from Uster 0188 for the current catalog and reviewed path. It does not prove that other counters or road datasets do not exist. No municipal playback, connecting section, travel direction or observation window is inferred. Original geometry, coverage and prior reviews remain intact.',
  }
}

async function main() {
  const inputs = Object.fromEntries(await Promise.all(Object.entries(wetzikonInputFiles).map(async ([key, file]) => [key, JSON.parse(await readFile(file, 'utf8'))])))
  const scope = JSON.parse(await readFile('data/wetzikon-road-audit-scope.json', 'utf8'))
  const report = auditWetzikonRoad(inputs, scope)
  await writeFile(process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/wetzikon-road-review.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ status: report.status, stationReview: report.stationReview, easternExtension: report.easternExtension }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
