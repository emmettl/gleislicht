import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { aargauRoadMatcher } from './aargau-road-geometry.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { hashFile } from './inventory-aargau.mjs'

const read = async f => JSON.parse(await readFile(f, 'utf8'))
const date = '2026-09-04', output = 'data/aargau-seasonal/344-alignment-followup.json'
const audit = await read(`fixtures/aargau/${date}/audit.json`), manifest = await read(`fixtures/aargau/${date}/aargau-region-day-manifest.json`)
const raw = JSON.parse(gunzipSync(await readFile(`data/aargau/${date}-timetable.json.gz`)))
const roads = aargauRoadMatcher(await read('data/aargau-road-cache.json'))
const rows = []
for (const [patternId, segmentIndex, courses] of [['4f68b304264b654efa3c', 5, ['34403', '34405']], ['e4a289f9cee3b5733926', 0, ['34409']]]) {
  const pattern = audit.patterns.find(p => p.id === patternId); assert(pattern)
  const stops = pattern.stopIds.map(id => manifest.stops.find(s => s[4] === id))
  const trains = raw.trains.filter(t => t.routeId === pattern.routeId && JSON.stringify(t.calls.map(c => c[0])) === JSON.stringify(pattern.stopIds))
  assert.deepEqual(trains.map(t => t.shortName).sort(), courses)
  const alternative = roads.matchPattern({ ...trains[0], stops: stops.map((_, i) => [i, 0, 0]) }, stops)[segmentIndex]
  assert(alternative.path)
  const original = pattern.segments[segmentIndex]
  const journeys = trains.map(t => {
    const seconds = t.calls[segmentIndex + 1][1] - t.calls[segmentIndex][2]
    assert.equal(seconds, segmentIndex === 5 ? 300 : 240)
    return { sourceTripId: t.sourceTripId, course: t.shortName, calls: t.calls, seconds,
      agisImpliedKph: original.pathMetres / seconds * 3.6, osmImpliedKph: alternative.pathMetres / seconds * 3.6 }
  })
  rows.push({ date, patternId, routeId: pattern.routeId, agencyId: pattern.agencyId, directionId: pattern.gtfsDirectionId, stops, segmentIndex, journeys,
    agis: { featureId: pattern.source.featureId, metres: original.pathMetres, pathSha256: geometryDigest(manifest.paths[original.pathIndex]) },
    osm: { metres: alternative.pathMetres, pathSha256: geometryDigest(alternative.path) },
    decision: 'unresolved-retain-original', reason: 'The official annual timetable matches the exact early course numbers and calls. The sparse-stop interval is compatible with different road itineraries; elapsed time and a schematic map alone do not certify the road choice. No source path is replaced.' })
}
const files = [`fixtures/aargau/${date}/audit.json`, `fixtures/aargau/${date}/aargau-region-day-manifest.json`, `data/aargau/${date}-timetable.json.gz`, 'data/aargau-road-cache.json', 'data/aargau-alignment-sources/50.344-2026.pdf', 'data/aargau-alignment-sources/freiamt-2026.pdf']
const report = { schemaVersion: 1, checkedOn: '2026-09-08', source: { timetableField: '50.344', sourceDate: '2025-11-07', page: 1, courses: ['34403', '34405', '34409'] },
  files: Object.fromEntries(await Promise.all(files.map(async f => [f, await hashFile(f)]))), rows, correctedOccurrences: 0,
  requiredEvidence: 'A dated operator road itinerary for courses 34403/34405 and 34409, or an equivalent route-specific source that distinguishes the direct corridor from the Wallenschwil/Rüstenschwil branch.' }
if (process.argv.includes('--check')) assert.deepEqual(await read(output), report)
else await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log('Line 344: three exact source journeys reviewed; two alignment decisions remain unresolved; no geometry replaced')
