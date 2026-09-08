import assert from 'node:assert/strict'
import { readFile,writeFile } from 'node:fs/promises'
import { readJson } from './aargau-seasonal.mjs'
import { hashFile } from './inventory-aargau.mjs'
const inventory=await readJson('data/aargau-witnesses/bus-inventory.json'),policy=await readJson('data/aargau-witness-ava-policy.json'),review=await readJson('data/aargau-witnesses/ava-review-summary.json')
assert.equal(review.policySha256,await hashFile('data/aargau-witness-ava-policy.json'))
for(const [file,sha]of Object.entries(inventory.files))assert.equal(await hashFile(file),sha)
for(const [file,sha]of Object.entries(policy.files))assert.equal(await hashFile(file),sha)
const fmt=n=>n.toLocaleString('en-US'),table=(heads,rows)=>`| ${heads.join(' | ')} |\n| ${heads.map(()=>'---').join(' | ')} |\n${rows.map(r=>`| ${r.join(' | ')} |`).join('\n')}`
const current=new Map(review.routes.map(r=>[r.routeId,r])),counts=r=>Object.fromEntries([...new Set(r.segments.map(s=>s.disposition))].map(d=>[d,r.segments.filter(s=>s.disposition===d).length*r.templates.length]))
const timing=policy.patterns.flatMap(r=>r.segments.filter(s=>s.disposition==='hold-source-timing').map(s=>({pattern:r.id,from:r.stops[s.index][2],to:r.stops[s.index+1][2],occurrences:r.templates.length,...s})))
const doc=`# Aargau annual witness bus review

The [complete bus inventory](../data/aargau-witnesses/bus-inventory.json) accounts for **16 route records, 86 full directed platform patterns, 1,384 archived trip templates and 7,187 adjacent-call occurrences** left after the annual rail review. Fifteen route records are replacement buses; the PostAuto EXT record serves the Schupfart event corridor. Route identities and complete active service-date lists come from the independently verified GTFS archive, not public line labels. All calls outside Aargau remain included. No route is silently omitted.

The first bounded follow-up tests all six patterns of **AVA Ersatzverkehr, agency 7244, route 92-A07-9-j26-1, line EV**. Numerical road matching succeeds on all **4,616** occurrences. The [admission policy](../data/aargau-witness-ava-policy.json) accepts **2,466** April occurrences as inferred road geometry, holds **161** April occurrences for source-time review, and holds all **1,989** September occurrences for diversion review. Every prior **3,801** accepted occurrence is unchanged. Current annual compatibility is **6,267 / 10,988** occurrences: all **194 rail patterns** plus **one bus pattern** are complete. **4,721 bus occurrences across 85 incomplete patterns** remain excluded. This is a separate template candidate; no date-specific regional feed is expanded.

## Every bus route

Each archived trip template is counted once even if its calendar has multiple dates. The civil witness may include the preceding service day: AVA's selected **14 September** witness comes from the **13 September** calendar and continues after midnight. The operator notice ends the replacement period at **14 September, 01:30**, consistent with this distinction. Service dates and civil dates must not be interchanged.

${table(['Route record / line','Agency','Patterns / templates','Source service dates: count, first–last','Selected civil witness','Remaining / original occurrences'],inventory.routes.map(r=>[r.routeId+' / '+r.line,r.agencyId,r.directedPatterns+' / '+r.archivedTripTemplates,r.activeServiceDates.length+': '+r.activeServiceDates[0]+' – '+r.activeServiceDates.at(-1),r.witnessCivilDate,fmt(current.get(r.routeId).missingOccurrences)+' / '+fmt(r.segmentOccurrences)]))}

The machine inventory records every full platform-coordinate chain, direction ID, source course, template digest, active service-date list, civil-date list and original failure assessment. The other **15 routes / 80 patterns / 2,571 occurrences** are not newly road-matched in this increment. They remain a source-evidence backlog, not confirmed operating itineraries. The compact first/last dates above do not imply continuous daily service; consult the exact date arrays.

## Dated AVA evidence

AVA's [14 April notice](https://www.aargauverkehr.ch/aktuell/meldungen/wsb-ersatzbusse-zwischen-aarau-und-menziken-1) confirms replacement buses between Aarau and Menziken on **25–26 April 2026**. It substitutes **Aarau, Kantonsspital Ost** for Aarau Torfeld and omits Buchs AG. All four April source patterns use that hospital stop and omit both closed rail stops; the shorter workings turn at Bleien Liebegg. This confirms the service context and specified stop changes, not the precise road itinerary.

AVA's [2 September notice](https://www.aargauverkehr.ch/aktuell/meldungen/wsb-ersatzverkehr-und-bauarbeiten-zwischen-aarau-und-schoeftland) confirms **12–13 September** replacement buses on Aarau–Schöftland. It also closes Aarauerstrasse in Oberentfelden between Isengüetlistrasse and Suhrerstrasse from **11 September, 22:00, to 15 September, 05:00**. A signed diversion is announced but not resolved by this audit. A successful normal-road match therefore cannot admit either September pattern. The [operating notice](https://www.aargauverkehr.ch/reisen/betrieb/betriebsmeldungen/uebersicht/s14-ersatzverkehr-aarau-schoeftland-5) states the replacement interval precisely as **12 September, 04:30, through 14 September, 01:30**.

All three original HTML responses, retrieval timestamps, publication dates where stated, raw/compressed SHA-256 values and **© Aargau Verkehr AG (AVA)** attribution are retained in [source metadata](../data/aargau-witness-ava-sources/sources.json). An absent publication date is left null rather than inferred from the service dates.

## Directed road-pattern results

${table(['Full pattern','Direction ID','Source period / templates','Admitted occurrences','Held occurrences'],policy.patterns.map(r=>{const c=counts(r);return [r.stops[0][2]+' → '+r.stops.at(-1)[2],r.directionId,r.period+' / '+r.templates.length,c['admit-inferred-april']??0,Object.entries(c).filter(([d])=>d!=='admit-inferred-april').map(([d,n])=>n+' '+(d==='hold-source-timing'?'timing':'diversion')).join('; ')||'none']}))}

Full-context routing uses **pfaedle v0.1.6-208-g99f2cd4**, with independent pattern warnings enabled and trie aggregation disabled. The graph combines **Geofabrik Switzerland 2 September 2026** with the earlier **8 September border extract**. Source SHA-256 is **${policy.source.routing.osmSha256}**. It postdates the April services and does not establish their historical running alignment. The configuration, binary hash, complete matcher logs, original shape/stop-time outputs, imported cache and replay hashes are retained in [routing evidence](../data/aargau-witness-ava-sources/routing.json).

There are **zero matcher fallback warnings or rejected hops**, and maximum road projection is **49.89 m**, within the unchanged **120 m** limit. The existing **6× detour bound / 1,500 m allowance** and **5 m simplification** remain unchanged. Paths were also inspected as six complete directed chains. Successful geometry remains explicitly **© OpenStreetMap contributors; ODbL-1.0** inference, not operator-certified routing or physical-direction certification.

## Source-time holds

The candidate applies a conservative **80 km/h required-mean review threshold** to every adjacent interval of every exact source template. This is an audit screen, not a legal limit or a claim that paths below it are physically certified. The source uses minute-granularity calls; no assumed rounding allowance or fabricated dwell time is added. The following two directed pairs in three full contexts are held:

${table(['Pattern','Directed pair','Templates','Source seconds','Road metres','Required mean km/h'],timing.map(s=>[s.pattern,s.from+' → '+s.to,s.occurrences,s.timing.minimumSourceSeconds,s.evidence.pathMetres.toFixed(2),s.timing.maximumRequiredMeanKmh.toFixed(2)]))}

The Teufenthal–Unterkulm Nord endpoints are already **1,538.42 m** apart in a straight line, so its one-minute source interval needs reconciliation beyond merely finding a shorter road path. Bleien Liebegg–Gränichen Oberdorfstrasse is **1,300.49 m** straight-line versus **1,356.28 m** on the candidate road path. Both complete return contexts retain the same held road geometry as evidence. Every original call and time remains unchanged.

## Regression and next work

The [candidate audit](../data/aargau-witnesses/ava-review-summary.json) replays the previous rail candidate before applying AVA, preserves all original stop coordinates and complete calls, verifies exact path endpoints and compares all other source assessments unchanged. The [candidate paths](../data/aargau-witnesses/ava-review-patterns.json.gz) retain the prior rejection information on admitted segments. Held diagnostic paths are preserved only in the separate AVA cache and policy. Exact source-template hashes, calendars, route/agency/mode/direction identities and complete platform chains prevent inheritance by another service or a dated release feed.

Next work is to reconcile the two April timing pairs and September's signed road diversion, then acquire dated evidence and route the remaining 80 bus patterns. The separate **222 September bus-alignment reviews**, civil-day extraction of additional witness dates, DST repeated-hour handling and application release checks also remain open. The original Friday/Sunday and twelve-date seasonal feeds are unchanged; publication readiness remains false.

## Reproduction

\`\`\`sh
node scripts/inventory-aargau-witness-buses.mjs --check
node scripts/prepare-aargau-witness-ava.mjs /tmp/aargau-ava-preparation
node scripts/match-postbus-roads.mjs --pfaedle /path/pfaedle --config /path/pfaedle.cfg --osm /path/pinned-roads.osm.pbf --feed /tmp/aargau-ava-preparation/7244 --output /tmp/aargau-ava-matched/7244
# Offline replay uses archived outputs; no routing binary or network is required:
node scripts/package-aargau-witness-ava.mjs --check
node scripts/prepare-aargau-witness-ava-policy.mjs --check
node scripts/review-aargau-witness-ava.mjs --check
node scripts/document-aargau-witness-buses.mjs --check
npx vitest run scripts/aargau-witness-ava.test.mjs scripts/aargau-road-geometry.test.mjs scripts/enrich-postbus-roads.test.mjs
\`\`\`
`
const file='docs/AARGAU-WITNESS-BUS-REVIEW.md'
if(process.argv.includes('--check'))assert.equal(await readFile(file,'utf8'),doc)
else await writeFile(file,doc)
console.log(`Documented all ${inventory.targetRoutes} witness bus routes; ${review.busMissingOccurrences} occurrences remain`)
