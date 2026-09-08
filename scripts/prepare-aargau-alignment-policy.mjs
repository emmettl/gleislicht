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
if (process.argv[2]) await writeFile('data/aargau-alignment-sources/postauto-changes-2026.html.gz', gzipSync(await readFile(process.argv[2]), { level: 9 }))
const evidence = [
  { file: 'data/aargau-alignment-sources/50.136-2026.pdf', url: 'https://widgets.oev-info.ch/publikation/jahresfpl/50.136.pdf', publisher: 'opentransportdata.swiss / official timetable field, PostAuto AG', sourceDate: '2025-12-03', page: 2,
    finding: 'Field 50.136, course 36051: 11:44 departure via Frick Ebnet, then Gipf-Oberfrick and directly Wölflinswil with no Wittnau branch calls. The annual PDF has 11:48 to 11:51 on the reviewed pair; pinned September GTFS has 11:50 to 11:53. Both allocate three minutes. GTFS times remain authoritative in the feed.' },
  { file: 'data/aargau-alignment-sources/oberes-fricktal-2026.pdf', url: 'https://www.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/nordschweiz/liniennetz-oberes-fricktal-26.pdf?vs=4', publisher: 'PostAuto AG / A-Welle / TNW', validFrom: '2025-12-14', page: 1,
    finding: 'The operator map distinguishes the direct Gipf-Oberfrick–Wölflinswil corridor from the Wittnau Obere Gasse branch. This schematic corroborates itinerary choice, not exact lane geometry.' },
  { file: 'data/aargau-alignment-sources/postauto-changes-2026.html.gz', url: 'https://fahrplanwechsel.postauto.ch/de/mittelland/aargau', publisher: 'PostAuto AG', validFrom: '2025-12-14', sourceDate: null,
    finding: 'The 2026 service-change page confirms line 136 has separate express and Wittnau workings. It is context, not sole evidence for the exact midday trip.' },
  { file: 'data/aargau-alignment-sources/50.344-2026.pdf', url: 'https://widgets.oev-info.ch/publikation/jahresfpl/50.344.pdf', publisher: 'opentransportdata.swiss / official timetable field, PostAuto AG', sourceDate: '2025-11-07', page: 1,
    finding: 'Reviewed as a remaining lead: distinguishes direct early trips, Benzenschwil branch and school workings. No line 344 correction is admitted by this policy.' },
  { file: 'data/aargau-alignment-sources/freiamt-2026.pdf', url: 'https://www.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/nordschweiz/liniennetz-freiamt-26.pdf', publisher: 'PostAuto AG / A-Welle', validFrom: '2025-12-14', page: 1,
    finding: 'Line 344 schematic shows the Benzenschwil spur and the Wallenschwil/Rüstenschwil corridor. Sparse-call alternatives remain under review; this map alone does not establish their exact roads.' }
]
const files = ['data/aargau-road-cache.json', ...evidence.map(e => e.file)]
const policy = { schemaVersion: 1, checkedOn: '2026-09-08',
  scope: 'One reviewed Friday directed stop pattern and one adjacent segment only. Replace the pinned AGIS path containing an unserved branch with the pinned full-pattern OSM inference. No generic speed-based admission, route alias or distance-limit change. The archived September feed remains unchanged; use this policy to build a separate review candidate.',
  inputTimetableHashes: { [date]: await hashFile(`data/aargau/${date}-timetable.json.gz`) },
  files: Object.fromEntries(await Promise.all(files.map(async file => [file, await hashFile(file)]))), evidence,
  rules: [{ id: '136-wittnau-bypass', date, patternId, agencyId: pattern.agencyId, routeId: pattern.routeId, line: pattern.line, mode: pattern.mode, directionId: pattern.gtfsDirectionId,
    stops, segmentIndex, sourceFeatureId: 43, sourcePart: 0,
    originalPathSha256: geometryDigest(manifest.paths[segment.pathIndex]), replacementPathSha256: geometryDigest(replacement.path),
    originalMetres: segment.pathMetres, replacementMetres: replacement.pathMetres, sourceTravelSeconds: 180,
    originalImpliedKph: segment.pathMetres / 180 * 3.6, replacementImpliedKph: replacement.pathMetres / 180 * 3.6,
    reason: 'AGIS part traverses the Wittnau branch absent from this exact source stop pattern. The operator timetable and map corroborate the direct working; the 6.9 km branch path is inconsistent with its three-minute source interval. The replacement is still an OSM inference, not measured vehicle travel.' }] }
await writeFile('data/aargau-alignment-policy.json', JSON.stringify(policy, null, 2) + '\n')
console.log(policy.rules.map(({ id, originalMetres, replacementMetres }) => ({ id, originalMetres, replacementMetres })))
