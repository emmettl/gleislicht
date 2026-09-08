import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { hashFile } from './inventory-aargau.mjs'
import { readJson } from './aargau-seasonal.mjs'
const root = 'data/aargau-witnesses'
const inventory = await readJson(`${root}/inventory.json`), geometry = await readJson(`${root}/geometry-summary.json`), verification = await readJson(`${root}/source-verification.json`)
assert.equal(geometry.inventorySha256, await hashFile(`${root}/inventory.json`))
assert.equal(geometry.sourceVerificationSha256, await hashFile(`${root}/source-verification.json`))
assert.equal(geometry.geometryPatternsSha256, await hashFile(`${root}/${geometry.geometryPatternsFile}`))
assert(verification.passed)
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

Compatibility below counts each archived trip template once, across all its complete adjacent calls. It is a separate geometric diagnostic, not the journey total for the selected witness date.

${table(['Route record', 'Operator / line', 'Active civil dates', 'Witness civil date / source course', 'Compatible / all template segments'], inventory.routes.map(r => { const g=byRoute.get(r.routeId); return [r.routeId,r.operator+' / '+r.line,r.activeCivilDates.length,r.witnessDate+' / '+r.witness.shortName,fmt(g.compatibleOccurrences)+' / '+fmt(g.segmentOccurrences)] }))}

The following selected witnesses specifically use the preceding service calendar:

${table(['Route record', 'Witness civil date', 'Source service date', 'Source course'],carryIn.map(r=>[r.routeId,r.witnessDate,r.witness.sourceServiceDate,r.witness.shortName]))}

## Geometry still requiring evidence

The existing pinned sources are compatible with **${fmt(geometry.compatibleOccurrences)} of ${fmt(geometry.segmentOccurrences)} template segment occurrences**. **${geometry.fullyCompatiblePatterns} of ${geometry.directedPatterns} directed patterns** have complete geometry; **${fmt(geometry.missingOccurrences)} occurrences remain unresolved**. All journeys and their exact platform coordinates stay in the denominator. The [geometry audit](../data/aargau-witnesses/geometry-summary.json) enumerates every missing pattern/pair with the original source and fallback rejection reasons. The [pattern detail](../data/aargau-witnesses/geometry-patterns.json.gz) retains admitted paths and source evidence.

${table(['Mode', 'Routes', 'Trip templates', 'Directed patterns', 'Compatible occurrences', 'Unresolved occurrences'],byMode)}

This probe uses AGIS normal lines, accepted full-pattern OSM bus caches and existing reviewed FOT route identities. It admits no new route alias or geometry exception. The September border/platform rules, twelve-date seasonal rules, Simplon journeys and bus alignment corrections retain their exact date scopes and are not applied here. In particular, a witness during a planned disruption does not establish that a normal-line shape is the replacement itinerary. New replacement-bus routes need dated operator and road evidence; rail records outside the existing FOT policy need an exact route and infrastructure review.

Source geometry keeps its existing dates and limitations: **AGIS 23 April 2026**, normal timetable only; FOT catalogue **6 July 2021**, asset update **18 January 2025**, current validity unconfirmed; OSM snapshots and routing evidence remain pinned by the referenced cache/source hashes. Required attribution remains **Timetable: opentransportdata.swiss**, **Daten des Kantons Aargau**, **© swisstopo**, **© OpenStreetMap contributors; ODbL-1.0**, and the original FOT attribution recorded in the machine audit.

The original Friday/Sunday feeds and the twelve-date seasonal geometry results are unchanged. The separate Friday correction candidate still resolves four occurrences on lines 136 and 358; **222 directed bus-pair reviews** remain. Publication readiness remains false. Next work is to obtain geometry evidence for these newly witnessed patterns, then validate full civil-day extracts before adding dates to the release scope.

## Reproduction

\`\`\`sh
python3 scripts/inventory-aargau-witnesses.py /path/GTFS_FP2026_20260902.zip
node scripts/verify-aargau-witnesses.mjs /path/GTFS_FP2026_20260902.zip
node scripts/audit-aargau-witnesses.mjs
node scripts/document-aargau-witnesses.mjs
python3 scripts/aargau-witnesses.test.py
# Append --check to each inventory, verification, audit or documentation command to replay without rewriting.
\`\`\`
`
const file='docs/AARGAU-ANNUAL-WITNESSES.md'
if(process.argv.includes('--check')) { const { readFile } = await import('node:fs/promises'); assert.equal(await readFile(file,'utf8'),doc) }
else await writeFile(file,doc)
console.log(`Documented ${inventory.witnessedRoutes} annual witnesses and ${geometry.directedPatterns} complete directed patterns`)
