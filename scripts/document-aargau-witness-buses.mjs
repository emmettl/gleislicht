import assert from 'node:assert/strict'
import { readFile,writeFile } from 'node:fs/promises'
import { readJson } from './aargau-seasonal.mjs'
import { hashFile } from './inventory-aargau.mjs'
const inventory=await readJson('data/aargau-witnesses/bus-inventory.json'),policy=await readJson('data/aargau-witness-ava-policy.json'),closure=await readJson('data/aargau-witness-oberentfelden-policy.json'),event=await readJson('data/aargau-witness-schupfart-policy.json'),lenzburg=await readJson('data/aargau-witness-lenzburg-policy.json'),review=await readJson('data/aargau-witnesses/lenzburg-review-summary.json')
assert.equal(review.policySha256,await hashFile('data/aargau-witness-lenzburg-policy.json'))
for(const [file,sha]of Object.entries(lenzburg.files))assert.equal(await hashFile(file),sha)
for(const [file,sha]of Object.entries(event.files))assert.equal(await hashFile(file),sha)
assert.equal(review.previousReviewSha256,await hashFile('data/aargau-witnesses/schupfart-review-summary.json'))
for(const [file,sha]of Object.entries(closure.files))assert.equal(await hashFile(file),sha)
for(const [file,sha]of Object.entries(inventory.files))assert.equal(await hashFile(file),sha)
for(const [file,sha]of Object.entries(policy.files))assert.equal(await hashFile(file),sha)
const detour=await readJson('data/aargau-witnesses/oberentfelden-detour-review.json')
for(const [file,sha]of Object.entries(detour.files))assert.equal(await hashFile(file),sha)
const fmt=n=>n.toLocaleString('en-US'),table=(heads,rows)=>`| ${heads.join(' | ')} |\n| ${heads.map(()=>'---').join(' | ')} |\n${rows.map(r=>`| ${r.join(' | ')} |`).join('\n')}`
const current=new Map(review.routes.map(r=>[r.routeId,r])),counts=r=>Object.fromEntries([...new Set(r.segments.map(s=>s.disposition))].map(d=>[d,r.segments.filter(s=>s.disposition===d).length*r.templates.length]))
const timing=policy.patterns.flatMap(r=>r.segments.filter(s=>s.disposition==='hold-source-timing').map(s=>({pattern:r.id,from:r.stops[s.index][2],to:r.stops[s.index+1][2],occurrences:r.templates.length,...s})))
const reviewedIds=new Set([...policy.patterns,...event.patterns,...lenzburg.patterns].map(p=>p.id)),backlog=inventory.patterns.filter(p=>!reviewedIds.has(p.id))
assert.equal(backlog.length,60);assert.equal(new Set(backlog.map(p=>p.routeId)).size,11);assert.equal(backlog.reduce((n,p)=>n+p.templates.length*(p.stops.length-1),0),1705)
const doc=`# Aargau annual witness bus review

The [complete bus inventory](../data/aargau-witnesses/bus-inventory.json) accounts for **16 route records, 86 full directed platform patterns, 1,384 archived trip templates and 7,187 adjacent-call occurrences** left after the annual rail review. Fifteen route records are replacement buses; the PostAuto EXT record serves the Schupfart event corridor. Route identities and complete active service-date lists come from the independently verified GTFS archive, not public line labels. All calls outside Aargau remain included. No route is silently omitted.

The first bounded follow-up tests all six patterns of **AVA Ersatzverkehr, agency 7244, route 92-A07-9-j26-1, line EV**. Numerical road matching succeeds on all **4,616** occurrences. The [admission policy](../data/aargau-witness-ava-policy.json) accepts **2,466** April occurrences as inferred road geometry, holds **161** April occurrences for source-time review, and holds all **1,989** September occurrences for diversion review. Every prior **3,801** accepted occurrence is unchanged. A subsequent closure-localization review adds **1,836 September occurrences**, preserving all **6,267** earlier paths and retaining **153** September closure crossings. The Schupfart Festival follow-up adds another **195 occurrences**, preserving all **8,103** earlier paths and holding **12 zero-second intervals**. The May Lenzburg follow-up adds **582 occurrences**, preserving all **8,298** earlier paths and holding **77 stop-distance failures**. Current annual compatibility is **8,880 / 10,988** occurrences: all **194 rail patterns** plus **thirteen bus patterns** are complete. **2,108 bus occurrences across 73 incomplete patterns** remain excluded. This is a separate template candidate; no date-specific regional feed is expanded.

## Every bus route

Each archived trip template is counted once even if its calendar has multiple dates. The civil witness may include the preceding service day: AVA's selected **14 September** witness comes from the **13 September** calendar and continues after midnight. The operator notice ends the replacement period at **14 September, 01:30**, consistent with this distinction. Service dates and civil dates must not be interchanged.

${table(['Route record / line','Agency','Patterns / templates','Source service dates: count, first–last','Selected civil witness','Remaining / original occurrences'],inventory.routes.map(r=>[r.routeId+' / '+r.line,r.agencyId,r.directedPatterns+' / '+r.archivedTripTemplates,r.activeServiceDates.length+': '+r.activeServiceDates[0]+' – '+r.activeServiceDates.at(-1),r.witnessCivilDate,fmt(current.get(r.routeId).missingOccurrences)+' / '+fmt(r.segmentOccurrences)]))}

The machine inventory records every full platform-coordinate chain, direction ID, source course, template digest, active service-date list, civil-date list and original failure assessment. The other **60 patterns / 1,705 occurrences on eleven route records** have not yet received a road review, including two later EV4 patterns on the partly reviewed route. AVA retains 314 held occurrences, Schupfart retains twelve and May Lenzburg retains 77. They remain a source-evidence backlog, not confirmed operating itineraries. The compact first/last dates above do not imply continuous daily service; consult the exact date arrays.

## Dated AVA evidence

AVA's [14 April notice](https://www.aargauverkehr.ch/aktuell/meldungen/wsb-ersatzbusse-zwischen-aarau-und-menziken-1) confirms replacement buses between Aarau and Menziken on **25–26 April 2026**. It substitutes **Aarau, Kantonsspital Ost** for Aarau Torfeld and omits Buchs AG. All four April source patterns use that hospital stop and omit both closed rail stops; the shorter workings turn at Bleien Liebegg. This confirms the service context and specified stop changes, not the precise road itinerary.

AVA's [2 September notice](https://www.aargauverkehr.ch/aktuell/meldungen/wsb-ersatzverkehr-und-bauarbeiten-zwischen-aarau-und-schoeftland) confirms **12–13 September** replacement buses on Aarau–Schöftland. It also closes Aarauerstrasse in Oberentfelden between Isengüetlistrasse and Suhrerstrasse from **11 September, 22:00, to 15 September, 05:00**. A signed diversion is announced. The initial AVA policy held both full September patterns; the municipal evidence below now localizes these holds to the two crossing segments. Neither complete September pattern is admitted. The [operating notice](https://www.aargauverkehr.ch/reisen/betrieb/betriebsmeldungen/uebersicht/s14-ersatzverkehr-aarau-schoeftland-5) states the replacement interval precisely as **12 September, 04:30, through 14 September, 01:30**.

All three original HTML responses, retrieval timestamps, publication dates where stated, raw/compressed SHA-256 values and **© Aargau Verkehr AG (AVA)** attribution are retained in [source metadata](../data/aargau-witness-ava-sources/sources.json). An absent publication date is left null rather than inferred from the service dates.

## September closure localization

The municipality's [7 September notice](https://oberentfelden.ch/erhaltungsmassnahmen-k-208-trasse-aargau-verkehr-ava-abschnitt-isengueetlistrasse-suhrerstrasse) and linked [diversion map, dated 11 August 2026, page 1](https://oberentfelden.ch/sites/default/files/2026-09/Umfahrung%20Baustelle%20AVA.pdf) identify an approximately 180 m closure between the two named junctions. The map was visually inspected for extent and signed-diversion context. It does not certify a complete bus itinerary through the source platforms.

The [localization policy](../data/aargau-witness-oberentfelden-policy.json) extracts **181.505 m** from historical OSM ways **48878570 / 769045499**, bounded by junction nodes **266859069 / 266859071**. The source calls the northern street **Isegüetlistrasse**, whereas the notice spells it **Isengüetlistrasse**; the map and named connected ways establish the same junction. Every coordinate comes from OSM. Source topology is retained and hashed, with no map linework copied into feed geometry.

Every line segment of each existing AVA polyline is tested against every closure segment, including intersections and collinear overlap. A conservative **20 m exclusion buffer** leaves **24 adjacent-call contexts / 1,836 template occurrences** clear, with a minimum distance of **73.713 m**. These unchanged OSM paths are admitted only for the exact **153 archived September templates**, after the original source-time screen. The **two Uerkenbrücke–Engelplatz directions / 153 occurrences** cross the closed corridor and stay excluded. This localizes a known closure; it does not assert that the other roads are operator-certified itineraries or that a new detour has been routed.

${table(['Direction ID','Templates','Added clear occurrences','Held crossing occurrences'],closure.patterns.map(r=>[r.directionId,r.templates.length,r.segments.filter(s=>s.disposition==='admit-clear-of-closure').length*r.templates.length,r.segments.filter(s=>s.disposition==='hold-closed-road-crossing').length*r.templates.length]))}

The [source bundle](../data/aargau-witness-oberentfelden-sources/sources.json) retains original responses, raw/compressed hashes and retrieval timestamps on **8 September 2026**. The municipal notice is attributed to **Gemeinde Oberentfelden**. Map attribution is **© geoPro Suisse AG; © swisstopo; Daten des Kantons Aargau**, with its original rights statement retained. Historical OSM is queried at **2 September 2026, 00:00 UTC**, and remains **© OpenStreetMap contributors; ODbL-1.0**. Its closure coordinates supplement the earlier routing graph; no new geometry is synthesized.

## September detour timing reconciliation

The [directed detour diagnostic](../data/aargau-witnesses/oberentfelden-detour-review.json) follows the signed **Binzmattweg → Suhrenmattstrasse → Suhrerstrasse** corridor using the same historical OSM source. Both directions retain a **120-second** source interval in all **153** templates. Even the junction-to-junction core exceeds it:

${table(['Direction ID','Templates held','Core metres','Minimum tagged-speed seconds','Source seconds'],detour.patterns.map(p=>[p.directionId,p.heldOccurrences,p.detour.metres.toFixed(2),p.detour.taggedMinimumSeconds.toFixed(2),p.sourceSeconds]))}

This is a minimum-time graph calculation, not a shortest-distance estimate. It respects OSM one-way and roundabout directions, removes the closed road edges and uses the mapped numeric speed tags. Both stop approaches, turn/access restrictions, signals, acceleration, congestion and dwell are omitted. Missing speed tags contribute **zero seconds**, including 20.47 m outbound. The retained **30 km/h** Binzmattweg tag materially affects the result. Thus the diagnostic is deliberately optimistic within the signed corridor and still needs source-time reconciliation. OSM tags are not current legal certification; the minute-granularity timetable also does not prove actual running times. No rounding allowance or revised call time is invented. The two crossing directions remain held, with **zero newly admitted occurrences** in this diagnostic.

## Initial directed road-pattern results

This table preserves the first AVA policy's decisions. The subsequent September additions and remaining holds are recorded above.

${table(['Full pattern','Direction ID','Source period / templates','Admitted occurrences','Held occurrences'],policy.patterns.map(r=>{const c=counts(r);return [r.stops[0][2]+' → '+r.stops.at(-1)[2],r.directionId,r.period+' / '+r.templates.length,c['admit-inferred-april']??0,Object.entries(c).filter(([d])=>d!=='admit-inferred-april').map(([d,n])=>n+' '+(d==='hold-source-timing'?'timing':'diversion')).join('; ')||'none']}))}

Full-context routing uses **pfaedle v0.1.6-208-g99f2cd4**, with independent pattern warnings enabled and trie aggregation disabled. The graph combines **Geofabrik Switzerland 2 September 2026** with the earlier **8 September border extract**. Source SHA-256 is **${policy.source.routing.osmSha256}**. It postdates the April services and does not establish their historical running alignment. The configuration, binary hash, complete matcher logs, original shape/stop-time outputs, imported cache and replay hashes are retained in [routing evidence](../data/aargau-witness-ava-sources/routing.json).

There are **zero matcher fallback warnings or rejected hops**, and maximum road projection is **49.89 m**, within the unchanged **120 m** limit. The existing **6× detour bound / 1,500 m allowance** and **5 m simplification** remain unchanged. Paths were also inspected as six complete directed chains. Successful geometry remains explicitly **© OpenStreetMap contributors; ODbL-1.0** inference, not operator-certified routing or physical-direction certification.

## Source-time holds

The candidate applies a conservative **80 km/h required-mean review threshold** to every adjacent interval of every exact source template. This is an audit screen, not a legal limit or a claim that paths below it are physically certified. The source uses minute-granularity calls; no assumed rounding allowance or fabricated dwell time is added. The following two directed pairs in three full contexts are held:

${table(['Pattern','Directed pair','Templates','Source seconds','Road metres','Required mean km/h'],timing.map(s=>[s.pattern,s.from+' → '+s.to,s.occurrences,s.timing.minimumSourceSeconds,s.evidence.pathMetres.toFixed(2),s.timing.maximumRequiredMeanKmh.toFixed(2)]))}

The Teufenthal–Unterkulm Nord endpoints are already **1,538.42 m** apart in a straight line, so its one-minute source interval needs reconciliation beyond merely finding a shorter road path. Bleien Liebegg–Gränichen Oberdorfstrasse is **1,300.49 m** straight-line versus **1,356.28 m** on the candidate road path. Both complete return contexts retain the same held road geometry as evidence. Every original call and time remains unchanged.

## Schupfart Festival: weekday, Sunday and after-midnight patterns

The official [festival travel page](https://www.schupfartfestival.ch/de/festival/index.php) links a [2026 special timetable](https://www.schupfartfestival.ch/docs/de/Fahrplan_Schupfart_2026_V1.pdf?m=1787834203&), alongside older 2025 links that are not used. Page 1 was visually inspected and its **32 advertised bus portions / 113 major calls** independently transcribed, then matched uniquely to all **32 GTFS templates** of **PostAuto 801, route 96-138-1-j26-1, line EXT**. The dates are **Friday 25, Saturday 26 and Sunday 27 September 2026**. All original intermediate calls, complete platform coordinates and out-of-canton stops remain retained. Printed **Eiken, Kirchgasse (Volg)** binds explicitly to GTFS **Eiken, Kirchgasse**; no general name alias is introduced.

Connecting rail services and regular buses are not counted as extra EXT trips. The published transfers at Wegenstetten distinguish the short shuttle from through workings. Returns printed after midnight under Friday/Saturday stay on those event/service dates as **24:xx / 25:xx**. For example, Friday's **01:33** departure is GTFS **25:33** on **25 September**, physically running on Saturday morning. The policy verifies this convention and cannot inherit the older 2025 calendar or another daily-feed instance.

The [event policy](../data/aargau-witness-schupfart-policy.json) tests **all twelve complete directed platform patterns / 207 occurrences** using the same pinned pfaedle binary, configuration and OSM graph as the AVA review. Numerical routing has **zero fallback warnings or rejected hops**, and maximum projection is **54.39 m**. All twelve complete paths were visually inspected. The unchanged **120 m / 6× / 1,500 m / 5 m** geometry limits and **80 km/h** mean-speed review threshold remain in force. **195 inferred OSM occurrences** are admitted: **81 direction 0 / 114 direction 1**. Six additional bus patterns become complete.

${table(['Full pattern ID','Direction','Full endpoint pair','Templates','Admitted / held occurrences'],event.patterns.map(r=>[r.id,r.directionId,r.stops[0][2]+' → '+r.stops.at(-1)[2],r.templates.length,r.segments.filter(s=>s.disposition==='admit-inferred-event-road').length*r.templates.length+' / '+r.segments.filter(s=>s.disposition==='hold-source-timing').length*r.templates.length]))}

The other **twelve occurrences in eight segment contexts** have a literal zero-second interval between different stops. They remain held without invented running time or interpolation. The major-call PDF does not resolve these intermediate-call times:

${table(['Pattern','Directed pair','Templates held','Source seconds','Diagnostic road metres'],event.patterns.flatMap(r=>r.segments.filter(s=>s.disposition==='hold-source-timing').map(s=>[r.id,r.stops[s.index][2]+' → '+r.stops[s.index+1][2],r.templates.length,s.timing.minimumSourceSeconds,s.evidence.pathMetres.toFixed(2)])))}

The [source bundle](../data/aargau-witness-schupfart-sources/sources.json) retains the original HTML and PDF, raw/compressed hashes and retrieval timestamps on **9 September 2026 (Europe/Zurich)**. Attribution is **Schupfart Festival; PostAuto AG**, as branded on the timetable. The PDF metadata records creation and modification at **5 May 2026, 11:59:24 UTC**; verified publication dates remain null. Printed service dates are not publication dates. Full routing outputs and hashes are retained separately; inferred geometry remains **© OpenStreetMap contributors; ODbL-1.0**, with the original **2/8 September 2026** graph provenance. The advertised timetable confirms service context and major calls, not precise roads or legal directions.

## May Lenzburg replacement buses

SBB’s [22 April 2026 notice](https://news.sbb.ch/de/019daf71-e5e3-7f0c-8713-4d64db53c698/bauarbeiten-in-lenzburg-fuehren-zu-einschraenkungen-im-bahnverkehr) confirms the **23–26 May** commissioning closure and replacement buses on **Rupperswil–Lenzburg–Othmarsingen, Hunzenschwil–Lenzburg and Beinwil am See–Lenzburg**. The [reviewed notice record](../data/aargau-witness-lenzburg-sources/notice.json) records publication on **22 April**, retrieval on **9 September 2026 (Europe/Zurich)** and **SBB/CFF/FFS** text attribution. The primary article was read through web retrieval; direct host retrieval returned HTTP 403. Only reviewed facts and a short excerpt are retained, with **no raw HTML archive claimed**. The current project page no longer describes this past closure and is not used as historical evidence.

The notice establishes dates and corridors; **EV labels, exact platforms, every call and calendar come from independently verified GTFS**. It does not publish a complete bus timetable or street itinerary. The [May policy](../data/aargau-witness-lenzburg-policy.json) binds **eight complete directed patterns on four route records / 300 trip templates / 659 occurrences**, with exact service calendars on **23, 24 and 25 May**. After-midnight calls retain their source service-day meaning. This is not a complete civil-day extraction. The two later EV4 Suhr patterns—seven templates / fourteen occurrences with September–October dates—remain outside this policy despite sharing an EV4 route record.

${table(['Pattern ID / line','Direction','Full endpoint pair','Templates','Admitted / held occurrences'],lenzburg.patterns.map(r=>[r.id+' / '+r.line,r.directionId,r.stops[0][2]+' → '+r.stops.at(-1)[2],r.templates.length,r.segments.filter(s=>s.disposition==='admit-inferred-may-road').length*r.templates.length+' / '+r.segments.filter(s=>s.disposition==='hold-road-geometry').length*r.templates.length]))}

EV5 direction 0 calls at **Seon Nord, Bahnhof, platform B**; direction 1 does not. Both full source chains are retained without inserting or reversing calls. All accepted segments pass the unchanged positive-interval and **80 km/h required-mean** screen. **582 inferred OSM occurrences** are admitted: **330 direction 0 / 252 direction 1**, completing six additional bus patterns.

The two full-pattern contexts for **Lenzburg, Bahnhof, platform F → Othmarsingen, Bahnhof** fail the unchanged **120 m** stop-distance limit at **132.24 m**. They account for **58 EV4 + 19 EV9 = 77 held occurrences**. No straight-line replacement or relaxed projection is admitted. Maximum accepted projection is **57.24 m**; the **6× detour bound / 1,500 m allowance / 5 m simplification** are unchanged. All eight directed contexts were visually inspected with rejected segments left absent. The [routing bundle](../data/aargau-witness-lenzburg-sources/routing.json) retains the cache, configuration, full raw outputs, original rejected shapes, logs and hashes for **pfaedle v0.1.6-208-g99f2cd4**, with per-pattern warnings enabled and trie aggregation disabled.

The same **2/8 September 2026 OSM graph** postdates these May services. These paths are road inferences, not certified historical operating itineraries or legal-direction certification. Geometry attribution remains **© OpenStreetMap contributors; ODbL-1.0**. Exact trip-template hashes and complete platform-coordinate chains prevent inheritance by a changed calendar or daily-feed instance.

## Regression and next work

The [candidate audit](../data/aargau-witnesses/lenzburg-review-summary.json) replays the previous Schupfart candidate before applying the May Lenzburg policy, preserves all original stop coordinates and complete calls, verifies exact path endpoints and compares all other source assessments unchanged. The [candidate paths](../data/aargau-witnesses/lenzburg-review-patterns.json.gz) retain the prior rejection information on admitted segments. Held diagnostic paths remain in the separate source bundles; rejected Lenzburg shapes remain only in raw matcher evidence. Exact source-template hashes, calendars, route/agency/mode/direction identities and complete platform chains prevent inheritance by another service or a dated release feed.

Next work is to reconcile the two April timing pairs and the two remaining September closure-crossing directions against the signed road diversion, reconcile Schupfart’s zero-second calls, resolve the Lenzburg platform-F projection failures, and acquire dated evidence and route the remaining 60 bus patterns. The separate **222 September bus-alignment reviews**, civil-day extraction of additional witness dates, DST repeated-hour handling and application release checks also remain open. The original Friday/Sunday and twelve-date seasonal feeds are unchanged; publication readiness remains false. This bus follow-up was checked on **9 September 2026**.

## Reproduction

\`\`\`sh
node scripts/inventory-aargau-witness-buses.mjs --check
node scripts/prepare-aargau-witness-ava.mjs /tmp/aargau-ava-preparation
node scripts/match-postbus-roads.mjs --pfaedle /path/pfaedle --config /path/pfaedle.cfg --osm /path/pinned-roads.osm.pbf --feed /tmp/aargau-ava-preparation/7244 --output /tmp/aargau-ava-matched/7244
# Offline replay uses archived outputs; no routing binary or network is required:
node scripts/package-aargau-witness-ava.mjs --check
node scripts/prepare-aargau-witness-ava-policy.mjs --check
node scripts/review-aargau-witness-ava.mjs --check
node scripts/prepare-aargau-witness-oberentfelden.mjs --check
node scripts/review-aargau-witness-oberentfelden.mjs --check
node scripts/review-aargau-oberentfelden-detour.mjs --check
# Schupfart routing preparation uses the same pinned matcher/configuration/graph:
node scripts/prepare-aargau-witness-schupfart.mjs /tmp/aargau-schupfart-preparation
node scripts/package-aargau-witness-schupfart.mjs --check
node scripts/prepare-aargau-witness-schupfart-policy.mjs --check
node scripts/review-aargau-witness-schupfart.mjs --check
node scripts/prepare-aargau-witness-lenzburg.mjs /tmp/aargau-lenzburg-preparation
node scripts/package-aargau-witness-lenzburg.mjs --check
node scripts/prepare-aargau-witness-lenzburg-policy.mjs --check
node scripts/review-aargau-witness-lenzburg.mjs --check
node scripts/document-aargau-witness-buses.mjs --check
npx vitest run scripts/aargau-witness-lenzburg.test.mjs scripts/aargau-witness-schupfart.test.mjs scripts/aargau-oberentfelden-detour.test.mjs scripts/aargau-witness-oberentfelden.test.mjs scripts/aargau-witness-ava.test.mjs scripts/aargau-road-geometry.test.mjs scripts/enrich-postbus-roads.test.mjs
\`\`\`
`
const file='docs/AARGAU-WITNESS-BUS-REVIEW.md'
if(process.argv.includes('--check'))assert.equal(await readFile(file,'utf8'),doc)
else await writeFile(file,doc)
console.log(`Documented all ${inventory.targetRoutes} witness bus routes; ${review.busMissingOccurrences} occurrences remain`)
