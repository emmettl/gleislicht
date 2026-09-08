import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { aargauRoadMatcher } from './aargau-road-geometry.mjs'

const read = async file => JSON.parse(await readFile(file, 'utf8'))
const date = '2026-09-04', patternId = '1aa7430503a1ed2ceeb6', segmentIndex = 4
const audit = await read(`fixtures/aargau/${date}/audit.json`)
const manifest = await read(`fixtures/aargau/${date}/aargau-region-day-manifest.json`)
const raw = JSON.parse(gunzipSync(await readFile(`data/aargau/${date}-timetable.json.gz`)))
const pattern = audit.patterns.find(p => p.id === patternId); assert(pattern)
const stops = pattern.stopIds.map(id => manifest.stops.find(s => s[4] === id))
const train = raw.trains.find(t => t.routeId === pattern.routeId && JSON.stringify(t.calls.map(c => c[0])) === JSON.stringify(pattern.stopIds))
const segment = pattern.segments[segmentIndex]
const roads = aargauRoadMatcher(await read('data/aargau-road-cache.json'))
const replacement = roads.matchPattern({ ...train, stops: stops.map((_, i) => [i, 0, 0]) }, stops)[segmentIndex]
assert.equal(train.calls[segmentIndex + 1][1] - train.calls[segmentIndex][2], 180)
assert.equal(pattern.source.featureId, 43)
assert.equal(segment.geometrySource, 'agis')
if (process.argv[2] && process.argv[2] !== '--check') await writeFile('data/aargau-alignment-sources/postauto-changes-2026.html.gz', gzipSync(await readFile(process.argv[2]), { level: 9 }))
const evidence = [
  { file: 'data/aargau-alignment-sources/50.136-2026.pdf', url: 'https://widgets.oev-info.ch/publikation/jahresfpl/50.136.pdf', publisher: 'opentransportdata.swiss / official timetable field, PostAuto AG', sourceDate: '2025-12-03', page: 2,
    finding: 'Field 50.136, course 36051: 11:44 departure via Frick Ebnet, then Gipf-Oberfrick and directly Wölflinswil with no Wittnau branch calls. The annual PDF has 11:48 to 11:51 on the reviewed pair; pinned September GTFS has 11:50 to 11:53. Both allocate three minutes. GTFS times remain authoritative in the feed.' },
  { file: 'data/aargau-alignment-sources/oberes-fricktal-2026.pdf', url: 'https://www.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/nordschweiz/liniennetz-oberes-fricktal-26.pdf?vs=4', publisher: 'PostAuto AG / A-Welle / TNW', validFrom: '2025-12-14', page: 1,
    finding: 'The operator map distinguishes the direct Gipf-Oberfrick–Wölflinswil corridor from the Wittnau Obere Gasse branch. This schematic corroborates itinerary choice, not exact lane geometry.' },
  { file: 'data/aargau-alignment-sources/postauto-changes-2026.html.gz', url: 'https://fahrplanwechsel.postauto.ch/de/mittelland/aargau', publisher: 'PostAuto AG', validFrom: '2025-12-14', sourceDate: null,
    finding: 'The 2026 service-change page confirms line 136 has separate express and Wittnau workings. For line 136 it is context, not sole evidence for the exact midday trip. For line 358 it explicitly says the Monday–Friday 14:45, 15:45 and 16:45 departures from Baldingen run directly from Bad Zurzach Seesteg to Bahnhof for the S27 connection.' },
  { file: 'data/aargau-alignment-sources/50.344-2026.pdf', url: 'https://widgets.oev-info.ch/publikation/jahresfpl/50.344.pdf', publisher: 'opentransportdata.swiss / official timetable field, PostAuto AG', sourceDate: '2025-11-07', page: 1,
    finding: 'Reviewed as a remaining lead: distinguishes direct early trips, Benzenschwil branch and school workings. No line 344 correction is admitted by this policy.' },
  { file: 'data/aargau-alignment-sources/freiamt-2026.pdf', url: 'https://www.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/nordschweiz/liniennetz-freiamt-26.pdf', publisher: 'PostAuto AG / A-Welle', validFrom: '2025-12-14', page: 1,
    finding: 'Line 344 schematic shows the Benzenschwil spur and the Wallenschwil/Rüstenschwil corridor. Sparse-call alternatives remain under review; this map alone does not establish their exact roads.' }
]
evidence.push(
  { file: 'data/aargau-alignment-sources/50.358-2026.pdf', url: 'https://widgets.oev-info.ch/publikation/jahresfpl/50.358.pdf', publisher: 'opentransportdata.swiss / official timetable field, PostAuto AG', sourceDate: '2025-11-07', pages: [1, 2],
    finding: 'Courses 35836, 35840 and 35846 depart Baldingen at 14:45, 15:45 and 16:45. Seesteg departures 14:53, 15:53 and 16:53 reach Bahnhof three minutes later, without Oberflecken, Höfli or Thermalbad calls. These exact times agree with the pinned September GTFS.' },
  { file: 'data/aargau-alignment-sources/baden-nord-2026.pdf', url: 'https://www.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/nordschweiz/liniennetz-baden-nord-26.pdf?vs=2', publisher: 'PostAuto AG / A-Welle', validFrom: '2025-12-14', page: 1,
    finding: 'Schematic context for the local Zurzach and Baldingen/Böbikon branches. It does not certify exact road or lane geometry; the explicit service-change notice establishes the reviewed direct variant.' })
const priorPolicyFile = 'data/aargau-alignment-sources/pre-358-policy.json'
const priorRegressionFile = 'data/aargau-alignment-sources/pre-358-regression.json'
const files = ['data/aargau-road-cache.json', ...evidence.map(e => e.file), priorPolicyFile, priorRegressionFile]
const policy = { schemaVersion: 1, checkedOn: '2026-09-08',
  scope: 'Two reviewed Friday directed stop patterns, one adjacent segment in each, covering four occurrences only. Line 358 additionally requires the three exact source journeys and complete call times. Replace the pinned AGIS path containing an unserved branch with the pinned full-pattern OSM inference. No generic speed-based admission, route alias or distance-limit change. The archived September feed remains unchanged; use this policy to build a separate review candidate.',
  inputTimetableHashes: { [date]: await hashFile(`data/aargau/${date}-timetable.json.gz`) },
  files: Object.fromEntries(await Promise.all(files.map(async file => [file, await hashFile(file)]))), evidence,
  rules: [{ id: '136-wittnau-bypass', date, patternId, agencyId: pattern.agencyId, routeId: pattern.routeId, line: pattern.line, mode: pattern.mode, directionId: pattern.gtfsDirectionId,
    stops, segmentIndex, sourceFeatureId: 43, sourcePart: 0,
    originalPathSha256: geometryDigest(manifest.paths[segment.pathIndex]), replacementPathSha256: geometryDigest(replacement.path),
    originalMetres: segment.pathMetres, replacementMetres: replacement.pathMetres, sourceTravelSeconds: 180,
    originalImpliedKph: segment.pathMetres / 180 * 3.6, replacementImpliedKph: replacement.pathMetres / 180 * 3.6,
    reason: 'AGIS part traverses the Wittnau branch absent from this exact source stop pattern. The operator timetable and map corroborate the direct working; the 6.9 km branch path is inconsistent with its three-minute source interval. The replacement is still an OSM inference, not measured vehicle travel.' }] }
const direct = audit.patterns.find(p => p.id === 'ba67a6b897cd1bf0b14f'); assert(direct)
const directStops = direct.stopIds.map(id => manifest.stops.find(s => s[4] === id))
const journeys = raw.trains.filter(t => t.routeId === direct.routeId && t.directionId === direct.gtfsDirectionId && JSON.stringify(t.calls.map(c => c[0])) === JSON.stringify(direct.stopIds))
assert.deepEqual(journeys.map(t => t.shortName).sort(), ['35836', '35840', '35846'])
assert.deepEqual(journeys.map(t => t.start).sort((a,b) => a-b), [53100, 56700, 60300])
for (const t of journeys) {
  assert.equal(t.calls[5][2], t.start + 480)
  assert.equal(t.calls[6][1] - t.calls[5][2], 180)
}
assert.equal(direct.source.featureId, 193); assert.equal(direct.source.part, 1)
const original = direct.segments[5]; assert.equal(original.geometrySource, 'agis')
const bypass = roads.matchPattern({ ...journeys[0], stops: directStops.map((_, i) => [i, 0, 0]) }, directStops)[5]
assert(bypass?.path)
policy.rules.push({ id: '358-seesteg-direct', date, patternId: direct.id, agencyId: direct.agencyId, routeId: direct.routeId, line: direct.line, mode: direct.mode, directionId: direct.gtfsDirectionId,
  stops: directStops, segmentIndex: 5, sourceFeatureId: 193, sourcePart: 1,
  journeys: journeys.map(({ sourceTripId, sourceServiceDate, shortName, calls }) => ({ sourceTripId, sourceServiceDate, shortName, calls })),
  originalPathSha256: geometryDigest(manifest.paths[original.pathIndex]), replacementPathSha256: geometryDigest(bypass.path),
  originalMetres: original.pathMetres, replacementMetres: bypass.pathMetres, sourceTravelSeconds: 180,
  reason: 'PostAuto explicitly identifies these three weekday afternoon departures as direct Seesteg–Bahnhof workings for the S27 connection. Field 50.358 confirms their exact courses and times with no local-loop calls. AGIS feature 193 part 1 retains the local loop; replace only this final segment with the pinned full-pattern OSM direct inference. Earlier Baldingen–Rekingen geometry remains unresolved and unchanged; the replacement is not measured vehicle travel.' })
policy.expectedOccurrencesByRule = { '136-wittnau-bypass': 1, '358-seesteg-direct': 3 }
policy.previousReview = { policyFile: priorPolicyFile, regressionFile: priorRegressionFile }
const priorPolicy = await read(priorPolicyFile), priorRegression = await read(priorRegressionFile)
assert.equal(await hashFile(priorPolicyFile), priorRegression.policySha256)
for (const r of priorPolicy.rules) assert.deepEqual(policy.rules.find(now => now.id === r.id), r)
if (process.argv.includes('--check')) assert.deepEqual(await read('data/aargau-alignment-policy.json'), policy)
else await writeFile('data/aargau-alignment-policy.json', JSON.stringify(policy, null, 2) + '\n')
console.log(policy.rules.map(({ id, originalMetres, replacementMetres }) => ({ id, originalMetres, replacementMetres })))
