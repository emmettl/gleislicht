import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { hashFile } from './inventory-aargau.mjs'
import { readJson } from './aargau-seasonal.mjs'
const root = 'data/aargau-witnesses'
const inventory = await readJson(`${root}/inventory.json`), geometry = await readJson(`${root}/edge-review-summary.json`), verification = await readJson(`${root}/source-verification.json`)
assert.equal(geometry.inventorySha256, await hashFile(`${root}/inventory.json`))
assert.equal(geometry.sourceVerificationSha256, await hashFile(`${root}/source-verification.json`))
assert.equal(geometry.geometryPatternsSha256, await hashFile(`${root}/${geometry.geometryPatternsFile}`))
assert(verification.passed)
assert.equal(geometry.policySha256, await hashFile('data/aargau-witness-edge-policy.json'))
assert.equal(geometry.previousReviewSha256, await hashFile(`${root}/interlaken-review-summary.json`))
assert.equal(geometry.previousPatternsSha256, await hashFile(`${root}/interlaken-review-patterns.json.gz`))
const fmt = n => n.toLocaleString('en-US')
const table = (headers, rows) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}`
const byRoute = new Map(geometry.routes.map(r => [r.routeId,r]))
const singleDates = inventory.routes.filter(r => r.activeCivilDates.length === 1)
const carryIn = inventory.routes.filter(r => r.witness?.serviceOffset)
const byMode = ['rail', 'bus'].map(mode => {
  const rows = geometry.routes.filter(r => r.mode === mode)
  return [mode, rows.length, fmt(rows.reduce((n,r)=>n+r.archivedTripTemplates,0)), rows.reduce((n,r)=>n+r.directedPatterns,0), fmt(rows.reduce((n,r)=>n+r.compatibleOccurrences,0)), fmt(rows.reduce((n,r)=>n+r.missingOccurrences,0))]
})
const doc = `# Aargau annual calendar witnesses

Checked **${inventory.checkedOn}** against the pinned **GTFS 20260902** archive. **All ${inventory.targetRoutes} routes absent from the twelve-date sample have an active canton-calling journey in the archived timetable year.** A deterministic selection of **${inventory.selectedDates.length} civil dates** provides a witness for every route. No route in this group needs an “inactive for the entire archive” classification.

The complete census retains **${fmt(inventory.archivedCantonTrips)} archived trip templates, ${fmt(verification.completeCalls)} calls and ${geometry.directedPatterns} directed route/platform patterns** for those 45 routes. Each full journey includes its calls outside Aargau. All ${geometry.directedPatterns} patterns are absent from the twelve sampled dates. The source parser and independent verifier each scan all **${fmt(inventory.sourceStopTimeRows)} national stop-time rows**. Calendar exceptions are applied over all **${verification.annualCalendarDates} feed dates**, including selected-day and preceding-service-day civil overlap. The original 289-route canton census is unchanged.

## What these witnesses establish

The archive was published for timetable year 2026, valid **14 December 2025–12 December 2026**. Replaying its calendars identifies scheduled activity in that archive; it does not establish that a historical trip actually operated or that a future trip will run unchanged. The source archive SHA-256 is **${inventory.archiveSha256}**. The [inventory](../data/aargau-witnesses/inventory.json) pins its download URL, feed information, annual active-date counts for each route and an exact source trip for every selected witness. [Complete calls, platforms and calendars](../data/aargau-witnesses/source-patterns.json.gz) and the [independent verification](../data/aargau-witnesses/source-verification.json) are retained with hashes.

These are archived GTFS route records and trip templates, not unique public line numbers or annual journey totals. Nine of the routes occur on only one civil date: **${singleDates.map(r => r.routeId).join(', ')}**. Five selected witnesses overlap midnight from the preceding service date; treating service dates as civil dates would miss or misdate them. No frequency templates occur in this target group. Request-stop boarding and alighting rules are preserved with every call.

## Compact witness-date selection

Dates are selected greedily by the number of still-unwitnessed routes they cover, then earliest date on ties. This is a reproducible compact cover, not a proof that ${inventory.selectedDates.length} is the mathematical minimum. The table counts only the new routes assigned on that step; a selected date can also operate routes already witnessed earlier. These dates have not been turned into whole-canton release feeds.

${table(['Civil date', 'Weekday', 'New route witnesses'], inventory.selectedDates.map(s => [s.date, new Intl.DateTimeFormat('en-GB',{weekday:'long',timeZone:'UTC'}).format(new Date(s.date+'T12:00:00Z')), s.newlyWitnessedRoutes.length]))}

## Every previously unsampled route

Compatibility below counts each archived trip template once, across all its complete adjacent calls. It uses the separate rail-review candidate and is not the journey total for the selected witness date.

${table(['Route record', 'Operator / line', 'Active civil dates', 'Witness civil date / source course', 'Compatible / all template segments'], inventory.routes.map(r => { const g=byRoute.get(r.routeId); return [r.routeId,r.operator+' / '+r.line,r.activeCivilDates.length,r.witnessDate+' / '+r.witness.shortName,fmt(g.compatibleOccurrences)+' / '+fmt(g.segmentOccurrences)] }))}

The following selected witnesses specifically use the preceding service calendar:

${table(['Route record', 'Witness civil date', 'Source service date', 'Source course'],carryIn.map(r=>[r.routeId,r.witnessDate,r.witness.sourceServiceDate,r.witness.shortName]))}

## Geometry still requiring evidence

The separately scoped rail-review candidate is compatible with **${fmt(geometry.compatibleOccurrences)} of ${fmt(geometry.segmentOccurrences)} template segment occurrences**. **${geometry.fullyCompatiblePatterns} of ${geometry.directedPatterns} directed patterns** have complete geometry; **${fmt(geometry.missingOccurrences)} occurrences remain unresolved**. All journeys and their exact platform coordinates stay in the denominator. The [final rail follow-up audit](../data/aargau-witnesses/edge-review-summary.json) enumerates every missing pattern/pair with the original source and fallback rejection reasons. The [reviewed pattern detail](../data/aargau-witnesses/edge-review-patterns.json.gz) retains admitted paths and source evidence.

${table(['Mode', 'Routes', 'Trip templates', 'Directed patterns', 'Compatible occurrences', 'Unresolved occurrences'],byMode)}

The [original witness baseline](../data/aargau-witnesses/geometry-summary.json) remains unchanged at 12 compatible occurrences and no complete patterns. The [new finite rail policy](../data/aargau-witness-rail-policy.json) reviews **29 exact route records, 194 directed patterns and 635 archived rail trip templates**, adding **3,616 occurrences** and preserving all **12** prior paths. It supplies geometry on **28 route records**; **24 rail routes** had complete template geometry at that stage; the Interlaken follow-up below raises this to **26**. All bus assessments are unchanged.

The policy pins the archive-derived SBB (11), THURBO (65), SOB (82) and Oensingen-Balsthal-Bahn (68) identities, full platform-coordinate chains, source trip/course identities, calls, boarding rules and complete active service-date lists. Every template is checked before the shared pattern cache is used. Each inferred path and its directed FOT segment sequence are hashed and checked on replay. Station attachment remains at **350 m**, source topology attachment at **120 m**, with the existing **4.5× detour bound / 3,000 m allowance** and **5 m source simplification**. Another scheduled operating point cannot be traversed out of order. Accepted geometry is an infrastructure inference, not a certification of the special train's actual corridor, track or diversion.

## Interlaken station hierarchy

The [FOT XTF source](https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf) already records **8519309, Interlaken Ost [Gleis 5–8]**, node **ch14uvag00165678**, as a child of **8507492**, node **ch14uvag00139699**, using its explicit **rUebergeordnet** reference. The generic station parent has no track edges; the connected child reaches Interlaken West through source segment **ch14uvag00087489**. The existing simplified parser omitted the hierarchy, which explains the earlier disconnection.

The [finite Interlaken policy](../data/aargau-witness-interlaken-policy.json) binds only the two exact GTFS platforms: **5**, stop **ch:1:sloid:7492:0:581416**, and **7**, stop **ch:1:sloid:7492:0:460848**. Their distances to the child node are **61.39 m / 70.05 m**, within the unchanged 350 m station limit. Source topology attachment still uses 120 m. This uses the source's explicit station/track-group relationship; no nearby-node or name-only alias is created. Only the internal operating-point lookup changes. Exported platform IDs, coordinates, complete calls and calendars are preserved.

This supplies all **162** formerly rejected Interlaken occurrences across **59** exact directed patterns: **160 IC81** occurrences on route **91-81-A-j26-1** and **2 EXT** occurrences on **91-4T-Y-j26-1**. The source GTFS direction IDs count **79 / 83** for **0 / 1**; these are source identifiers, not a geographic-direction convention. The [regression](../data/aargau-witnesses/interlaken-review-summary.json) preserves all **3,628** previously accepted occurrences and every other source assessment. Both directions and both platforms are tested. An absent parent reference, changed platform group, coordinates, template, calendar or geometry cannot inherit the rule.

The child node states validity from **13 December 2015**, edit date **27 May 2021**, and data date **6 July 2021**; the parent was edited **2 July 2021**. The archived raw node records are included in the policy, and the entire source file is hashed. The asset's **18 January 2025** update is distinct from these record dates. These records establish the source hierarchy, not current running-track validity. All paths remain explicitly inferred infrastructure geometry.

## Bern platform 50 and Waldshut–Koblenz

The [final finite rail policy](../data/aargau-witness-edge-policy.json) fills the remaining **11 rail occurrences in seven full directed patterns**, preserving all **3,790** previously accepted occurrences and every other assessment. All **194 rail patterns on 29 route records** now have complete infrastructure geometry. These additions stay in the separate annual-template candidate.

**Correction:** the earlier witness audit called the Bern platform “49”. These four archived templates actually call **platform 50**, stop **ch:1:sloid:7000:55:50**. The GTFS source, calls and platform coordinates were always correct. The original September platform-49 rules remain valid for their own different calls.

The archived [SBB station plan](../data/aargau-witness-edge-sources/sbb-bern-plan-2026-08.pdf), exterior view on page 3, places platforms 49/50 at the western end. Its printed date is **August 2026**, retrieved **8 September 2026**. It is station-layout evidence, not surveyed switches or proof of a June/July operating alignment; it postdates two reviewed templates. Attribution on the plan is **© OpenStreetMap © SBB 08/2026**.

Platform 50 is **427.77 m** from the generic FOT station point, beyond the unchanged 350 m guard, but only **38.59 m** from the pinned western station curve **ch14uvag00087328**. The adapter projects onto that one curve within **75 m**, then splits its interior at **371.07 m** from the western source end. Both source endpoints, the station-centre node and all other edges retain their original geometry. The internal node and its synthetic lookup number **9990050** are explicitly marked as derived, never exported as a GTFS or source operating-point identity. The platform connector remains inferred.

The Fribourg arrival must use the western half and cannot pass through Bern's centre; the subsequent departure uses the centre-side half. This prevents an artificial out-and-back path at an intermediate call. The other three reviewed approaches use only the centre-side half. Every old accepted segment in these full journeys remains unchanged.

${table(['Route / course', 'Active source service dates', 'Newly compatible adjacent calls'],[
 ['91-3A-Y-j26-1 / 31025','2026-06-30','Fribourg platform 2 → Bern 50; Bern 50 → Lenzburg 1'],
 ['91-3A-Y-j26-1 / 31569','2026-07-14','Bern 50 → Olten 2'],
 ['91-4U-Y-j26-1 / 2382','2026-08-16 and 2026-09-27','Burgdorf 2 → Bern 50; two distinct full upstream platform patterns'],
 ['91-36-B-j26-1 / 22891, 22893, 22895','2026-04-13 through 2026-04-16','Waldshut 5 → Koblenz 4'],
 ['91-36-B-j26-1 / 22884','2026-04-13 through 2026-04-16','Koblenz 3 → Waldshut 5'],
 ['91-36-B-j26-1 / 22886, 22888','2026-04-13 through 2026-04-16','Koblenz 4 → Waldshut 5'],
])}

The six SBB **S36** templates reuse only **AGIS feature 364, part 0**, whose source identity remains **11 / rail / S41**, itinerary Waldshut–Koblenz–Bad Zurzach–Bülach–Winterthur. This is an explicit corridor association, not a global S41-to-S36 relabelling. All three full two-stop patterns project in their own directed order onto the same feature, including both Koblenz platforms; the sliced source distance is **3,275.13 m**, with maximum endpoint projection **55.97 m**, within the unchanged **120 m** guard. The source direction label is unspecified; coordinate order is forward for Waldshut departures and reversed for Koblenz departures.

These April 13–16 templates lie outside the archived operator notice's **14 September–2 October** Koblenz–Waldshut closure. The notice does not certify April operation. The **23 April 2026** AGIS normal-line snapshot also postdates these templates. Accepted paths establish compatibility with the archived corridor, not the historical tracks actually used. The earlier date-scoped THURBO rule is unchanged and is not inherited by SBB.

Every added path, directed source segment, projection, full platform chain and exact template digest is pinned. Changed calls, source courses, calendars, coordinates, daily-feed instances or relaxed limits cannot inherit this policy. Replay verifies both border directions, all ten exact templates, western and centre-side Bern approaches, and unchanged original source topology outside the one split curve.

## Remaining exclusions

There are **no unresolved rail occurrences** in this annual-template candidate. The **86 bus patterns on 16 routes** still have **7,187 unresolved template occurrences**. Dated operator and road evidence remains necessary for their replacement and special workings; all 86 remain incomplete.

This candidate uses the existing AGIS and OSM baseline plus exact-template FOT, Interlaken hierarchy, Bern projection and Waldshut corridor policies. The September border/platform rules, twelve-date seasonal rules, Simplon journeys and bus alignment corrections retain their exact date scopes and are not applied here. In particular, a witness during a planned disruption does not establish that a normal-line shape is the replacement itinerary. New replacement-bus routes need dated operator and road evidence.

Source geometry keeps its existing dates and limitations: **AGIS 23 April 2026**, normal timetable only; FOT catalogue **6 July 2021**, asset update **18 January 2025**, current validity unconfirmed; OSM snapshots and routing evidence remain pinned by the referenced cache/source hashes. Required attribution remains **Timetable: opentransportdata.swiss**, **Daten des Kantons Aargau**, **© swisstopo**, **© OpenStreetMap contributors; ODbL-1.0**, and the original FOT attribution recorded in the machine audit.

The original Friday/Sunday feeds and the twelve-date seasonal geometry results are unchanged. The separate Friday correction candidate still resolves four occurrences on lines 136 and 358; **222 directed bus-pair reviews** remain. Publication readiness remains false. Next work is to obtain geometry evidence for these newly witnessed patterns, then validate full civil-day extracts before adding dates to the release scope.

## Reproduction

\`\`\`sh
python3 scripts/inventory-aargau-witnesses.py /path/GTFS_FP2026_20260902.zip
node scripts/verify-aargau-witnesses.mjs /path/GTFS_FP2026_20260902.zip
node scripts/audit-aargau-witnesses.mjs
node scripts/prepare-aargau-witness-rail.mjs
node scripts/review-aargau-witness-rail.mjs
node scripts/prepare-aargau-witness-interlaken.mjs
node scripts/review-aargau-witness-interlaken.mjs
node scripts/prepare-aargau-witness-edges.mjs
node scripts/review-aargau-witness-edges.mjs
node scripts/document-aargau-witnesses.mjs
python3 scripts/aargau-witnesses.test.py
npx vitest run scripts/aargau-witness-edges.test.mjs scripts/aargau-witness-interlaken.test.mjs scripts/aargau-witness-rail.test.mjs scripts/aargau-rail-geometry.test.mjs
# Append --check to each inventory, verification, audit or documentation command to replay without rewriting.
\`\`\`
`
const file='docs/AARGAU-ANNUAL-WITNESSES.md'
if(process.argv.includes('--check')) { const { readFile } = await import('node:fs/promises'); assert.equal(await readFile(file,'utf8'),doc) }
else await writeFile(file,doc)
console.log(`Documented ${inventory.witnessedRoutes} annual witnesses and ${geometry.directedPatterns} directed patterns (${geometry.fullyCompatiblePatterns} with complete geometry)`)
