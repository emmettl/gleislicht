import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { SEASONAL_GAP_POLICY, seasonalGapSources, seasonalGapEvaluator, isWaldshutClosure } from './aargau-seasonal-gaps.mjs'

const read = async file => JSON.parse(await readFile(file, 'utf8'))
const selection = await read('data/aargau-seasonal-gap-sources/selection.json')
const sources = await seasonalGapSources()
const platformPolicy = await read('data/aargau-platform-policy.json')
const rules = [], inputTimetableHashes = {}, fixtures = new Map()
const verification = await read('data/aargau-seasonal/input/source-verification.json')
for (const selected of selection.rules) {
  const { date, patternId, kind } = selected
  assert(!['2026-09-04', '2026-09-06'].includes(date))
  const file = `data/aargau-seasonal/input/${date}-timetable.json.gz`
  if (!fixtures.has(date)) {
    inputTimetableHashes[date] = await hashFile(file)
    assert.equal(inputTimetableHashes[date], verification.fixtures[`${date}-timetable.json.gz`])
    fixtures.set(date, JSON.parse(gunzipSync(await readFile(file))))
  }
  const raw = fixtures.get(date)
  const pattern = t => createHash('sha256').update(JSON.stringify([t.routeId, t.directionId, t.calls.map(c => c[0])])).digest('hex').slice(0, 20)
  const trains = raw.trains.filter(t => pattern(t) === patternId); assert(trains.length)
  const train = trains[0], stops = train.calls.map(c => raw.stops.find(s => s[4] === c[0])); assert(stops.every(Boolean))
  const rule = { id: `${date}-${patternId}`, date, patternId, kind, agencyId: train.agencyId, mode: train.category, routeId: train.routeId, line: train.route, directionId: train.directionId, stops, occurrences: trains.length }
  if (kind === 'brugg-service-loop') assert.deepEqual(stops, platformPolicy.patterns.find(p => p.fix === kind).stops)
  if (kind === 'bern-platform-49') {
    assert.deepEqual(stops.slice(1), platformPolicy.patterns.find(p => p.fix === kind).stops.slice(1))
    assert(['ch:1:sloid:3000:8:15', 'ch:1:sloid:3000:9:17', 'ch:1:sloid:3000:10:18'].includes(stops[0][4]))
  }
  if (kind === 'waldshut') assert(!isWaldshutClosure(date))
  const segments = seasonalGapEvaluator({ rules: [rule] }, sources, date)(rule, train, stops)
  rule.segments = selected.pairs.map(([a, b]) => {
    const index = stops.findIndex((s, i) => s[4] === a && stops[i + 1]?.[4] === b); assert(index >= 0)
    const { path, ...evidence } = segments?.[index] ?? {}; assert(path)
    assert.deepEqual(path[0], stops[index].slice(0, 2)); assert.deepEqual(path.at(-1), stops[index + 1].slice(0, 2))
    return { index, pathSha256: geometryDigest(path), evidence }
  })
  rules.push(rule)
}
assert.equal(rules.length, 63)
assert.equal(rules.reduce((n, r) => n + r.occurrences * r.segments.length, 0), 583)
const files = ['data/aargau-seasonal-gap-sources/selection.json', 'data/aargau-seasonal-gap-sources/50.368-2026.pdf',
  'data/aargau-seasonal/input/inventory.json', 'data/aargau-seasonal/input/source-verification.json',
  'data/aargau-sources/lines.json.gz', 'data/aargau-sources/sources.json', 'data/aargau-line-crosswalk.json',
  'data/aargau-platform-policy.json', ...Object.keys(platformPolicy.files),
  'data/aargau-rail-policy.json', 'data/aargau-rail-sources/source.json',
  'data/aargau-supplemental-sources/thurbo-closures-2026.html.gz']
const policy = { schemaVersion: 1, checkedOn: '2026-09-08',
  scope: 'Finite seasonal compatibility extension only: exact date, agency, mode, route, direction, full platform coordinates, segment indices, source evidence and path hashes. Fill prior gaps only. Original September policies, feeds and corrected Friday candidate are unchanged. Geometry vintage does not establish historical or future operation.',
  inputTimetableHashes, files: Object.fromEntries(await Promise.all([...new Set(files)].map(async file => [file, await hashFile(file)]))),
  attribution: ['Timetable: opentransportdata.swiss', 'Daten des Kantons Aargau', 'FOT/BAV: Swiss rail infrastructure network', '© OpenStreetMap contributors, ODbL-1.0'],
  evidence: {
    brugg: { file: 'data/aargau-seasonal-gap-sources/50.368-2026.pdf', publisher: 'Official timetable field / PostAuto AG', url: 'https://widgets.oev-info.ch/publikation/jahresfpl/50.368.pdf', sourceDate: '2025-11-07', timetableYear: 2026, visuallyReviewedPage: 1,
      finding: 'The annual timetable distinguishes outbound workings via Wildischachen and Aare AG before Aquarena from those skipping that loop. All four selected weekday full coordinate chains equal the original September pattern. Preserve the directed connected OSM relation and 120 m full-pattern guard. Annual itinerary evidence does not date the OSM geometry.' },
    bern: { ...platformPolicy.evidence.bern,
      finding: 'Seven selected arrivals share the exact Baden–Brugg–Aarau–Olten–Bern platform-coordinate tail. Zürich departure platform is 15, 17 or 18. The additional platform 18 changes no terminal identity or approach. Each full pattern is separately pinned. The original 350 m rail guard stays in force; only the reviewed 33.9 m projection onto the Bern western terminal segment supplies platform 49.' },
    waldshut: { publisher: 'Thurbo', file: 'data/aargau-supplemental-sources/thurbo-closures-2026.html.gz', url: 'https://www.thurbo.ch/erkunden/ausblick/thurboleben/ki-baustellen/', sourceDate: '2026-05', closure: ['2026-09-14', '2026-10-02'],
      finding: 'Rechecked 8 September: the May 2026 notice identifies S36 and the Koblenz–Waldshut closure. All ten selected additional dates lie outside that interval. Each full pattern must project on one AGIS feature 364 part before either exact border pair is sliced. The closure interval is also blocked explicitly; no general permission for all other dates is inferred.' },
    rail: { publisher: 'FOT/BAV', file: 'data/aargau-rail-sources/source.json', catalogueDate: '2021-07-06', assetUpdated: '2025-01-18', currentValidityConfirmed: false,
      finding: 'Four exact SBB route IDs from independently verified annual GTFS: RE26 Basel–Luzern, IC Olten–Lugano via Freiamt, IC Zürich–Lausanne/Genève-Aéroport and EXT Mühlau–Luzern in both directions. Nine full patterns pass exact unique operating-point identities, ordered topology, 350 m station attachments, 120 m source attachments and unchanged detour limits. These are infrastructure inferences, not operator-certified running tracks; 25 October remains a DST wall-clock audit only.' },
    exclusion: { routeId: '91-29-Y-j26-1', dates: ['2026-04-03', '2026-08-01'], directedPair: ['ch:1:sloid:1609:3:6', '8301003'], from: 'Brig', to: 'Domodossola (I)',
      finding: 'The pinned FOT network has no node with operating-point number 8301003 and no Domodossola named node. No name alias or nearest boundary-node substitution is admitted. Two complete journeys retain a null final leg; cross-border source geometry and identity evidence are still needed.' },
  }, rules }
if (process.argv.includes('--check')) assert.deepEqual(await read(SEASONAL_GAP_POLICY), policy)
else await writeFile(SEASONAL_GAP_POLICY, JSON.stringify(policy, null, 2) + '\n')
console.log('Verified 63 exact seasonal rules covering 583 previously missing occurrences')
