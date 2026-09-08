import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { sha256 } from './download-luzern-sources.mjs'
const read = async p => JSON.parse(await readFile(p, 'utf8'))
const save = async (p,v) => writeFile(p,JSON.stringify(v,null,2)+'\n')
const audit = await read('data/st-gallen-audit/local-report.json')
assert(audit.validation.passed)
const pct = (n,d) => d ? `${(100*n/d).toFixed(1)}%` : '—'
const num = n => n.toLocaleString('en-CH')
const sum = (items,k) => items.reduce((n,r)=>n+r[k],0)
const clean = s => String(s ?? '').replaceAll('|','/').replaceAll('\n',' ')
const table = (headers, rows) => ['| '+headers.join(' | ')+' |','| '+headers.map(()=> '---').join(' | ')+' |',...rows.map(r=>'| '+r.map(clean).join(' | ')+' |')].join('\n')
await writeFile('data/st-gallen-sources/sources.json', await readFile('data/st-gallen-sources/local/sources.json'))
const {inventory,sourceInventory,days,...summary}=audit
await mkdir('data/st-gallen-audit',{recursive:true})
await save('data/st-gallen-audit/routes.json',inventory)
await save('data/st-gallen-audit/source-lines.json',sourceInventory)
for (const day of days) await save(`data/st-gallen-audit/${day.date}.json`,day)
summary.days=days.map(({directedPatterns:_p,directedStopPairs:_s,routes:_r,...day})=>day)
summary.files={}
if (audit.policy.geometryRepairs?.repairs.length) {
  const path='data/st-gallen-topology-review.json', review=await read(path)
  assert.deepEqual(review.sourceHashes,audit.sourceHashes,'Stale topology regression report')
  summary.topologyReview={path,sha256:sha256(await readFile(path))}
}
const detourPath='data/st-gallen-detour-review.json', detours=await read(detourPath)
assert.deepEqual(detours.sourceHashes,audit.sourceHashes,'Stale detour review sources')
for (const day of days) assert.equal(detours.days.find(d=>d.date===day.date)?.dayAuditSha256,sha256(JSON.stringify(day)),'Stale detour review day')
summary.detourReview={path:detourPath,sha256:sha256(await readFile(detourPath))}
const endpointPath='data/st-gallen-endpoint-review.json', endpoints=await read(endpointPath)
assert.deepEqual(endpoints.sourceHashes,audit.sourceHashes,'Stale endpoint review sources')
for (const day of days) assert.equal(endpoints.days.find(d=>d.date===day.date)?.dayAuditSha256,sha256(JSON.stringify(day)),'Stale endpoint review day')
summary.endpointReview={path:endpointPath,sha256:sha256(await readFile(endpointPath))}
const vmobilPath='data/st-gallen-vmobil-review.json', vmobil=await read(vmobilPath)
assert.deepEqual(vmobil.sourceHashes,audit.sourceHashes,'Stale Vorarlberg review sources')
for (const day of days) assert.equal(vmobil.days.find(d=>d.date===day.date)?.dayAuditSha256,sha256(JSON.stringify(day)),'Stale Vorarlberg review day')
summary.vmobilReview={path:vmobilPath,sha256:sha256(await readFile(vmobilPath))}
const anchorPath='data/st-gallen-stop-anchor-review.json', anchorReview=await read(anchorPath)
assert.deepEqual(anchorReview.sourceHashes,audit.sourceHashes,'Stale stop-anchor regression')
summary.stopAnchorReview={path:anchorPath,sha256:sha256(await readFile(anchorPath))}
const sharedPath='data/st-gallen-shared-corridor-review.json', sharedReview=await read(sharedPath)
assert.deepEqual(sharedReview.sourceHashes,audit.sourceHashes,'Stale shared-corridor regression')
summary.sharedCorridorReview={path:sharedPath,sha256:sha256(await readFile(sharedPath))}
const vaduzPath='data/st-gallen-vaduz-review.json', vaduzReview=await read(vaduzPath)
assert.deepEqual(vaduzReview.sourceHashes,audit.sourceHashes,'Stale Vaduz regression')
summary.vaduzReview={path:vaduzPath,sha256:sha256(await readFile(vaduzPath))}
for(const name of ['routes.json','source-lines.json',...days.map(d=>d.date+'.json')]) summary.files[name]={sha256:sha256(await readFile(join('data/st-gallen-audit',name)))}
await save('data/st-gallen-audit/summary.json',summary)
const index={schemaVersion:1,region:'st-gallen',label:'St. Gallen canton — admitted complete stop patterns',localOnly:true,redistributionApproved:false,
  sourceHashes:audit.sourceHashes,attribution: audit.catalogue.attribution.concat(['Timetable: SBB / opentransportdata.swiss','Canton boundary: © swisstopo',
    ...new Set((audit.policy.stopAnchors??[]).flatMap(c=>c.evidence.map(e=>`Stop rendering anchor evidence: ${e.publisher}`))),
    ...new Set((audit.policy.sharedCorridors??[]).flatMap(c=>c.evidence.map(e=>`Supporting corridor evidence: ${e.publisher}`)))]),
  timetable:{version:audit.feed.feed_version,start:audit.feed.feed_start_date,end:audit.feed.feed_end_date},
  sources:'../st-gallen-sources/sources.json',audit:'../st-gallen-audit/summary.json',
  stopAnchors:audit.stopAnchors,stopAnchorSources:(audit.policy.stopAnchors??[]).flatMap(c=>c.evidence),
  days:await Promise.all(days.map(async d=>({date:d.date,manifest:`local/${d.date}/st-gallen-region-day-manifest.json`,morning:`local/${d.date}/st-gallen-region-morning.json`,
    manifestSha256:sha256(await readFile(join(d.artifacts.directory,'st-gallen-region-day-manifest.json'))),
    morningSha256:sha256(await readFile(join(d.artifacts.directory,'st-gallen-region-morning.json'))),
    trips:d.admittedTrips,patterns:d.admittedPatterns}))),
  note:'Feed payloads and original/decoded AL_OEV source vectors are generated locally and ignored by Git; they are excluded from public site assets. Resolve publisher permission before redistribution.'}
await save('data/st-gallen-region/index.json',index)
const agencies=[...new Set(inventory.map(r=>r.agencyId))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
const groups=agencies.map(id=>{
 const rr=inventory.filter(r=>r.agencyId===id)
 return [id,rr[0].agency,[...new Set(rr.map(r=>r.mode))].join(', '),rr.length,...days.map(d=>{const gg=d.groups.filter(g=>g.id.startsWith(id+':'));return `${num(sum(gg,'admittedTrips'))} / ${num(sum(gg,'trips'))}`})]
})
const byMode=[...new Set(inventory.map(r=>r.mode))].sort().map(mode=>[mode,inventory.filter(r=>r.mode===mode).length,...days.map(d=>{const gg=d.groups.filter(g=>g.mode===mode);return `${num(sum(gg,'admittedTrips'))}/${num(sum(gg,'trips'))}; ${pct(sum(gg,'matchedSegmentOccurrences'),sum(gg,'segmentOccurrences'))}`})])
const reasons=[...new Set(days.flatMap(d=>Object.keys(d.exclusionReasons)))].sort()
const sourceCounts=['rail','bus','city','mountain','boat'].map(layer=>[layer,sourceInventory.filter(s=>s.layer===layer).length,sourceInventory.filter(s=>s.layer===layer&&s.gtfsRoutes.length).length,sourceInventory.filter(s=>s.layer===layer&&s.candidateRouteAdmittedTrips).length])
const admissionRows=inventory.filter(r=>r.days.some(d=>d.admittedTrips)).map(r=>[r.agencyId,r.routeId,r.line,...r.days.map(d=>`${d.admittedTrips}/${d.trips}`)])
const noFixture=inventory.filter(r=>r.days.every(d=>!d.trips))
const routeAppendix = `# St. Gallen: complete annual route and source inventory

Generated from the pinned census and validated audit. See [the study](ST-GALLEN-STUDY.md) for scope, source dates, attribution, licence restrictions and method. Counts are civil-day movement instances; exact_times=0 headway instances are representative, not scheduled departures. A partially admitted route emits only complete passing patterns.

## All ${inventory.length} annual route records

${table(['Agency','GTFS route ID','Mode','Line','Annual source trips',...days.map(d=>d.date+' admitted/all; status'),'Exclusion reasons on fixtures'],inventory.map(r=>[r.agencyId,r.routeId,r.mode,r.line,r.annualTripRecords,...r.days.map(d=>`${d.admittedTrips}/${d.trips}; ${d.status}`),[...new Set(r.days.flatMap(d=>d.reasons))].join(', ') || (r.days.every(d=>!d.trips)?'Inactive on both fixtures; annual service retained':'—')]))}

## All ${sourceInventory.length} official AL_OEV source features

Keys combine the pinned archive layer and record index; they are not guaranteed stable across source refreshes. A candidate graph may contain several features, so its associated admitted-trip count does not claim that each trip uses every feature. Day/night offer and subsidy eligibility are retained independently of geometry admission.

${table(['Source key','Operator','Offer','Subsidised','Source designation','Matched GTFS routes','Status'],sourceInventory.map(s=>[s.key,s.properties.BETREIBER,s.properties.ANGEBOT,s.properties.BERECHTIGT,s.properties.LINIENNAME,s.gtfsRoutes.join(', ') || '—',s.status]))}

Every exact mapping rationale and exception is preserved in [source-lines.json](../data/st-gallen-audit/source-lines.json) and [the policy](../data/st-gallen-policy.json). Source geometry and local feed payloads are not redistributed by this appendix.
`
await writeFile('docs/ST-GALLEN-ROUTE-INVENTORY.md',routeAppendix)
const doc=`# St. Gallen canton: source adapter and regional-feed audit

Audit date: **8 September 2026**. Starting point: [Swiss source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#sg). The complete annual pinned-timetable census contains **${inventory.length} route records across ${agencies.length} agency identities**. Geometry admission is partial: all admitted complete directed patterns pass numerical validation; this is not complete cantonal motion coverage or certification of road travel directions.

[Regional feed index](../data/st-gallen-region/index.json) · [Readable full route/source inventory](ST-GALLEN-ROUTE-INVENTORY.md) · [Audit summary](../data/st-gallen-audit/summary.json) · [Every annual route and exclusion](../data/st-gallen-audit/routes.json) · [Every source feature and mapping](../data/st-gallen-audit/source-lines.json). Full ordered-pattern and directed-pair evidence: ${days.map(d=>`[${d.date}](../data/st-gallen-audit/${d.date}.json)`).join(' · ')}.

## Scope and entire-canton denominator

The census streams **${num(audit.scope.annualStopTimeRows)} annual national stop-time rows** and selects **${num(audit.scope.annualScopedTripRecords)} trip records** with at least one source call in the complete swisstopo SG MultiPolygon. All polygon components and holes are preserved; bounding-box filtering is only a preliminary speedup. There are **${num(audit.scope.cantonStopRecords)} GTFS stop records** inside the polygon, of which **${num(audit.scope.calledCantonStopRecords)}** are called in the annual source. Parent/platform records are not presented as unique physical stops.

No agency allowlist defines canton membership. Every selected trip retains its full ordered calls outside SG, including neighbouring cantons and foreign endpoints. Nonstopping through traffic and services absent from national GTFS are outside this measured census; no straight-line crossing approximation is used. This is the whole SG canton, not the city alone and not the six-canton OSTWIND tariff area.

The geographical review includes St. Gallen/Rorschach and the Appenzell interfaces; Fürstenland/Wil; Toggenburg; Rheintal; Werdenberg; Sarganserland; and See-Gaster/Rapperswil-Jona. These names are review groupings, not hand-drawn inclusion boundaries. The operator/mode table below exposes all resulting feed identities, including national operators, replacement services, foreign operators, local municipal services and mountain/lake operators. Rail journeys towards Zürich/Luzern, Lake Constance/Lindau, and the Liechtenstein/Austria corridors are retained whole and fail admission if their external calls lack geometry.

The fixture dates are Friday **4 September 2026** and Sunday **6 September 2026**, each 00:00–24:00 Europe/Zurich with preceding-service-day spillover. Calendar exceptions apply. Trips continue beyond the civil window in their source calls but are displayed only in intersecting windows. Frequencies are expanded on the source-anchored interval grid; exact_times=0 instances are explicitly representative headway movements, not scheduled departures. Prior-arrangement pickup/drop-off rules exclude complete patterns from unconditional animation. ${noFixture.length} annual route records are inactive on both civil-day fixtures and remain in the inventory. Two September dates do not establish winter, summer-pass, holiday or annual geometry completeness.

## Acquisition, dates and attribution

The obsolete share/download endpoint was replaced by the current [public AL_OEV archive download](https://data.geo.sg.ch/public.php/dav/files/RMgBWPofwkaCawf/Geodaten/3%20-%20Bev%C3%B6lkerung%20und%20Wirtschaft/P%20-%20Verkehr/AbgeltungsberechtigteLinien/AbgeltungsberechtigteLinien_AL_OEV_shp.zip), verified against the filenames in the official share. All **226 features in five layers** were acquired, including records marked not subsidised; the subsidy flag is not an admission filter.

${table(['Source layer','Features','Mapped to annual SG routes','Candidate graph for admitted trips'],sourceCounts)}

The archive directory, component timestamps and supplied data-description PDF are dated **24 March 2026**. This is the export/documentation date of the 2026 timetable alignment; no per-feature survey date is supplied. The live description PDF was dated 3 September 2026 when inspected, which does not update the geometry in the March archive. Retrieval timestamps are recorded separately in [the source catalogue](../data/st-gallen-sources/sources.json). The SG metadata web page was modified 10 March 2026. The boundary API does not expose a dataset-edition date in this response; no 2026 boundary vintage is invented.

The national timetable is release **${audit.feed.feed_version}**, valid ${audit.feed.feed_start_date}–${audit.feed.feed_end_date}, from the [official GTFS dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020). It has no shapes.txt. Pinned hashes:

- GTFS ZIP: \`${audit.sourceHashes.archive}\`.
- AL_OEV ZIP: \`${audit.policy.sourceArchiveSha256}\`.
- Full SG boundary response: \`${audit.sourceHashes.boundary}\`.

Attribution: **SBB / opentransportdata.swiss** for timetable data; **© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG** for AL_OEV; **© swisstopo** for the boundary and underlying swissTNE Base alignment. Timetable reuse follows the [platform terms](https://opentransportdata.swiss/en/terms-of-use/), including attribution and refreshing raw data. This is a pinned reproducible study, not a continuously refreshed service.

The source archive includes Datennutzungsbestimmungen.pdf (1 June 2019). The [current SG terms](https://www.sg.ch/bauen/geoinformation/datenbezug/agb.html), whose page says last modified 12 January 2022, retain the distinction between permitted application display and redistribution/own geoservices requiring express permission (current clause 18; supplied clause 20). No dataset-specific open licence or additional redistribution grant was supplied. **The generated regional feed and raw/decoded vectors remain local, outside public assets and ignored by Git.** The tracked index, adapter and audit make the result reviewable and reproducible. A future publication needs the publisher's permission question resolved; this report does not claim an open-data licence. Permitted display must carry attribution, data currency, lack of legal effect and the publisher's accuracy/completeness/liability disclaimer.

## Adapter and directed-pattern validation

The source is EPSG:2056 LV95 PolyLine plus UTF-8 DBF. The adapter checks complete component/record counts and coordinate ranges, preserves multipart segments and attributes, then uses the existing swisstopo approximate LV95→WGS84 polynomial (metre-level accuracy), rounding to seven decimal places without simplification. Source bytes and each decoded collection are hashed. Archive identity is pinned in [the review policy](../data/st-gallen-policy.json).

Operator codes, passenger-facing designations and modes jointly select a graph. KURSBUCHNR and numeric LINIENNR are not assumed to be GTFS line numbers: rail S21/S22, bus B24/N30 and night services retain their prefixes. Explicit record-name-checked exceptions bridge BOS Swiss sections to LIEmobil, LIEmobil's 12 Eilkurs to 12E, AB N21 to feed B21, Walensee table 3901 to feed BAT, BOS source lines 403/164 to their Buchserberg/Vorarlberg publishers, and individually reviewed N-prefixed or N-suffixed source night lines to numeric GTFS designations. The sole ZVV label maps specifically to VZO 885; BBO 624 maps to the municipal St. Gallenkappel feed identity. Every source feature retains raw operator, offer period, subsidy flag, source name, mapping rationale and resulting route IDs in the source inventory. Multiple same-line source parts can form one graph; counts of graph-candidate features do not mean every trip traverses every feature.

Graphs connect **only exact shared vertices** on the same reviewed operator/line. Geometric crossings are not automatically junctions. One reviewed **7.37 m** source-edge repair connects the two disconnected components of BOS line 321 at Balgach. It copies exactly two existing line-301 edges, independently present in line 322 and N31/N32; both ends are existing target vertices. The policy stores pinned record/part/vertex references rather than redistributing coordinates. Validation requires matching source names/operators, identical corroborating slices, disconnected target components and a 15 m cap. No proximity joins, invented gap bridges or national road/rail fallbacks are applied. Three other small gaps (LIEmobil 37, PostAuto 190 and night 741) have no corroborated short source path and remain excluded. [Repair regression](../data/st-gallen-topology-review.json) records the before/after results and unchanged existing journeys. The nearest projection of each ordered stop pair must be within **120 m**; routing uses source edges and permits another disconnected source part's projection only within **5 m** of the nearest snap. Paths exceeding max(1,200 m, 4.5 × direct stop distance), collapsed paths, disconnected components and missing lines are rejected. Short endpoint connectors are explicitly inferred, not measured alignments.

Pattern identity includes route, direction_id, every ordered stop ID and pickup/drop-off rules. Every pair is evaluated in its actual direction, including loops and return paths; if any pair fails, the **entire trip pattern** is excluded. Source direction_id alone is never treated as proof of legal direction. AL_OEV expressly does not encode travel direction: successful patterns are inferred alignments, with no one-way street, lane, track, temporary-diversion or water-navigability certification. Sparse boat/cableway linework is retained at its source resolution. Every excluded route, pattern and pair keeps a specific failure reason; nothing is silently cropped to improve coverage.

The first [documented shared corridor](ST-GALLEN-SHARED-CORRIDOR-REVIEW.md) restores PostAuto line 210 between St. Gallen Bahnhof and Tübach Schulstrasse using the official line-211 record. PostAuto's network map, valid from 14 December 2025 and retrieved 8 September 2026, confirms the common corridor through Mörschwil. This is restricted to 64 individually reviewed directed route/platform pairs, adjacent names in the approved stop sequence, pinned output geometry hashes and the unchanged numerical limits. It applies only after a primary endpoint-gap failure; every passing primary path is preserved. The donor's Horn branch is outside the approved pairs. Shared-corridor source, operator, name, coordinate or path changes fail validation. No general operator-wide fallback is enabled. The [incremental regression](../data/st-gallen-shared-corridor-review.json) confirms all 10,500 Friday and 7,264 Sunday previously admitted journeys remain identical, including the line-321 repair.

## Measured results


A second [documented shared corridor](ST-GALLEN-VADUZ-REVIEW.md) restores the two line-24 pairs between Vaduz Lettstrasse and Post. LIEmobil's July 2026 network map corroborates the corridor and its 2024 annual report confirms joint operation with Bus Ostschweiz and the December 2024 extension. Only the exact reviewed target feature override, agency 805, route 92-24-C-j26-1, two fixture dates and two platform-pair geometry hashes qualify. The line-11 AL_OEV record supplies the missing alignment. The separate [Vaduz regression](../data/st-gallen-vaduz-review.json), against baaf1da, adds 28 Friday trips in two directed patterns and no Sunday trips; every previous journey and matched pair is unchanged.

One [reviewed stop rendering anchor](ST-GALLEN-STOP-ANCHOR-REVIEW.md) resolves the coordinate discrepancy at Dornbirn Treffpunkt a.d.Ach for line 164. It uses the exact published Vorarlberg platform coordinate as a representative stop-level anchor, with the opposite platform within 9 m. The original Swiss coordinate remains in the policy/audit and the source timetable file is untouched. The adapter pins both source bytes and schedule evidence, restricts use to line 164 on the two reviewed dates, and rejects new route usage or changed source coordinates. Every original call, ID, time and existing admitted path is preserved. The [incremental anchor regression](../data/st-gallen-stop-anchor-review.json), against commit 2e0c599, records the 58 Friday / 26 Sunday line-164 additions and the subsequent 28 / 0 line-24 additions; the original anchor step added two directed patterns per date. AL_OEV linework, the 120 m snap limit and detour limits remain unchanged. This is a representative rendering anchor, not a direction-specific platform assignment or an authoritative correction to the Swiss feed.

${table(['Metric',...days.map(d=>d.date)], [
 ['Civil-day movement instances',...days.map(d=>num(d.trips))],
 ['Admitted movement instances',...days.map(d=>`${num(d.admittedTrips)} (${pct(d.admittedTrips,d.trips)})`)],
 ['Excluded movement instances',...days.map(d=>num(d.excludedTrips))],
 ['Complete directed patterns admitted / evaluated',...days.map(d=>`${num(d.admittedPatterns)} / ${num(d.patterns)}`)],
 ['Directed route-stop pairs matched / evaluated',...days.map(d=>`${num(d.matchedDirectedPairs)} / ${num(d.directedPairs)} (${pct(d.matchedDirectedPairs,d.directedPairs)})`)],
 ['All segment occurrences matched / evaluated',...days.map(d=>`${num(d.matchedSegmentOccurrences)} / ${num(d.segmentOccurrences)} (${pct(d.matchedSegmentOccurrences,d.segmentOccurrences)})`)],
 ['Scheduled segment occurrences matched / evaluated',...days.map(d=>`${num(d.matchedScheduledSegmentOccurrences)} / ${num(d.scheduledSegmentOccurrences)} (${pct(d.matchedScheduledSegmentOccurrences,d.scheduledSegmentOccurrences)})`)],
 ['Representative headway movements admitted / evaluated',...days.map(d=>`${num(d.admittedHeadwayTrips)} / ${num(d.representativeHeadwayTrips)}`)],
 ['Admitted movements using reviewed source repair',...days.map(d=>num(d.admittedTripsUsingRepair))],
 ['Admitted movements using reviewed shared corridor',...days.map(d=>num(d.admittedTripsUsingSharedCorridor))],
 ['Directed pairs using reviewed shared corridor',...days.map(d=>num(d.sharedCorridorDirectedPairs))],
 ['Admitted movements using reviewed stop anchor',...days.map(d=>num(d.admittedTripsUsingStopAnchor))],
 ['Directed pairs using reviewed stop anchor',...days.map(d=>num(d.anchoredDirectedPairs))],
 ['Preceding-day carry-ins admitted / evaluated',...days.map(d=>`${num(d.admittedCarryInTrips)} / ${num(d.carryInTrips)}`)],
])}

Pair and occurrence coverage includes matches inside excluded patterns, so it is distinct from emitted complete-trip coverage. All excluded modes remain in the denominators; frequent mountain headway instances must not be mistaken for scheduled departures.

${table(['Mode','Annual route records',...days.map(d=>d.date+' admitted/all movements; pair-occurrence coverage')],byMode)}

### Every agency identity

${table(['GTFS ID','Raw feed agency name','Modes','Annual routes',...days.map(d=>d.date+' admitted/all movements')],groups)}

### Exclusions

${table(['Failure reason',...days.map(d=>d.date+' affected trips')],reasons.map(r=>[r,...days.map(d=>d.exclusionReasons[r]??0)]))}

Reasons overlap when a pattern has multiple failures. Missing-line includes outside-source modes, long-distance/national rail, replacement buses, unbridged operator/designation identities and tourist services beyond the subsidised-line scope; this does not assert that no other geometry exists. Full reason sets and inactive dates are attached to every annual route in routes.json. Every source feature without an annual match or admitted fixture is also retained in source-lines.json.

The [bus detour review](ST-GALLEN-DETOUR-REVIEW.md) replays all seven remaining bus pairs rejected for implausible detours, affecting 128 Friday and 59 Sunday trips. It compares every nearby edge projection and the operator's combined regional bus linework. The 352/353 and 432 failures persist. Line 400 has a shorter candidate using a 33.30 m edge from line 429/430, but it lacks the evidence required for admission. Operator notices retrieved on 8 September document construction overlapping both fixture dates. All these patterns remain excluded; the [machine-readable review](../data/st-gallen-detour-review.json) pins the evidence snapshots, diagnostic results and affected patterns without redistributing geometry.

The [bus endpoint review](ST-GALLEN-ENDPOINT-REVIEW.md) replays every remaining bus endpoint-gap pair and checks other individual regional/city records mapped to the same agency. It covers ${endpoints.pairs.length} distinct directed pairs, affecting ${endpoints.days.map(d=>d.affectedTrips).join(' Friday / ')} Sunday complete trips. Operator evidence for lines 323 and 705 does not establish an admissible replacement alignment. The official Vorarlberg July sample contains line-164 shapes but no line 323; those external shapes are inventoried only. Candidate paths do not authorize a route fallback. All reviewed endpoint failures remain excluded with the unchanged 120 m limit. The [machine-readable review](../data/st-gallen-endpoint-review.json) pins every pair, candidate hash, evidence date and affected-pattern total.

### Admitted route records

Each value is admitted/all civil-day movement instances. Partial routes still exclude every failed full pattern. The complete inventory includes excluded and inactive routes as well.

${table(['Agency','GTFS route ID','Line',...days.map(d=>d.date)],admissionRows)}

## Regional feed and reproducibility

The local feed contains date-specific full-day manifests, twelve two-hour chunks and 06:45–08:45 morning snapshots (focus 07:45), using the existing compact network schema. Paths, stops, timing, source stop sequences, call rules, route/operator IDs, source-service-day and frequency metadata are preserved. Each chunk has its byte length and SHA-256 in the manifest; the regional index pins both manifest and morning snapshot. Empty chunks are valid. There is no UI-selection change, realtime integration or deployment in this data deliverable.

Run from the repository root with Node 24+, Python 3, curl, unzip and the installed project dependencies. The source decoder adds no Python packages. A refreshed archive may require explicit policy review; do not update hashes merely to silence a failure.

\`\`\`sh
# Acquire full sources; archive and vectors are kept in the ignored local cache.
python3 scripts/prepare-st-gallen-sources.py
# Or re-decode the exact saved snapshot without changing dates:
# python3 scripts/prepare-st-gallen-sources.py --inspect-cache

# Supply the pinned national ZIP; inspect docs/DATA-PIPELINE.md for acquisition.
node --max-old-space-size=8192 scripts/st-gallen-timetable.mjs \\
  /private/tmp/GTFS_FP2026_20260902.zip \\
  data/st-gallen-sources/local/boundary.json \\
  data/st-gallen-sources/local/timetable.json

node --max-old-space-size=8192 scripts/build-st-gallen-region.mjs
node scripts/check-st-gallen-region.mjs
node scripts/document-st-gallen-study.mjs
node scripts/check-st-gallen-region.mjs --audit-only
npx vitest run scripts/st-gallen-region.test.mjs scripts/st-gallen-shared-corridors.test.mjs scripts/st-gallen-vmobil.test.mjs scripts/st-gallen-stop-anchors.test.mjs
\`\`\`

The saved detour review is bound to the exact source hashes and day audits. To replay its geometry diagnostics with the original cached operator pages, run \`node scripts/review-st-gallen-detours.mjs --check\`. On a fresh cache, \`node scripts/review-st-gallen-detours.mjs --fetch-evidence\` acquires the current public pages and regenerates the review; it cannot recreate historical webpage bytes. Inspect changed notices, dates and hashes before regenerating the study. These pages support stop order and operating context, not replacement route geometry.

The endpoint review has the same source/day binding. Run \`node scripts/review-st-gallen-endpoints.mjs --check\` with the original evidence cache, or \`--fetch-evidence\` to acquire and inspect current snapshots. Its audit-only validation rejects missing pairs, foreign-agency candidates, incorrect affected totals and stale day bindings, even if the report's outer file hash is updated.

The [Vorarlberg line-164 review](ST-GALLEN-VMOBIL-REVIEW.md) additionally compares active calendars, every ordered call and time, and directed shape-distance slices against the Swiss fixtures. Both sources have 58 Friday / 26 Sunday trips with identical call times, but Treffpunkt a.d.Ach differs by 673–679 m and Messekreuzung toward Dornbirn by 143 m. External geometry does not resolve these source-coordinate discrepancies. The separately reviewed [Treffpunkt rendering anchor](ST-GALLEN-STOP-ANCHOR-REVIEW.md) now admits all 58 / 26 trips on unchanged AL_OEV geometry, preserving the original Swiss coordinate in the audit. No external shapes are admitted. Run \`node scripts/review-st-gallen-vmobil.mjs --check\` to replay the pinned July ZIP; shape clipping, calendar exceptions and name normalization have dedicated tests in \`scripts/st-gallen-vmobil.test.mjs\`.

The full checker verifies source hashes, annual-route reconciliation, every admitted and excluded source pattern, unchanged source calls/times/sequences, frequency and carry-in metadata, directed path endpoints, per-pair path hashes, shared-corridor source replay and provenance, chunk overlap consistency, morning-window membership and operator/mode/route/pair-occurrence totals. The audit-only check works from tracked files without the large source cache. The geometry regression compares against the feed and policy from commit 2351822: every previously admitted movement, call and path and every previously matched pair must be unchanged, and only the reviewed line-321, line-210, line-164 and line-24 patterns may be added. Run \`node scripts/check-st-gallen-topology-regression.mjs BASELINE_FEED_DIRECTORY BASELINE_AUDIT_JSON\` after building both versions with the exported \`buildStGallenRegion\` function and their respective policies. For the incremental line-210 regression, add \`--shared\` and supply the baseline from commit 7926448; only line-210 (66 Friday / 35 Sunday) and subsequently reviewed line-164 (58 / 26) and line-24 (28 / 0) trips may be added. The saved reports record the pinned baselines and result hashes. The supporting map is acquired by the source-preparation command; use \`python3 scripts/prepare-st-gallen-sources.py --shared-evidence-only\` to acquire it without refreshing the original source catalogue.

Regression tests cover operator isolation, misleading timetable-book numbers, prefix handling, changed overrides, polygon holes/components, preceding-day service, conditional calls, disconnected source geometry reversed artifact paths, and rejection of changed donor geometry, already-connected targets, unreviewed lengths and cross-operator repairs.

Shared-corridor tests additionally reject unapproved routes, platforms, directions and stop names, changed geometry hashes, duplicate approvals and source-operator/name changes; they verify that passing primary geometry is never replaced. Joint-operation tests require evidence, an exact reviewed target identity, route and fixture dates; unrelated operator changes still fail.

Pending scope is explicit: unresolved geometry exclusions; seasonal and holiday validation; road/track/boat direction and plausibility review; publication rights; future refresh/realtime/UI work. Passing numerical checks establishes the stated admitted feed, not complete or observed cantonal transport movement.
`
await writeFile('docs/ST-GALLEN-STUDY.md',doc)
await writeFile('data/st-gallen-region/README.md','# St. Gallen regional feed\n\nSee [the audit](../../docs/ST-GALLEN-STUDY.md) and [index](index.json). Payloads are present locally under `local/` after the build and are intentionally ignored by Git pending publisher redistribution permission. The index pins their manifest and morning hashes. Run the documented pipeline to regenerate.\n')
await writeFile('data/st-gallen-sources/README.md','# St. Gallen source snapshot\n\n[Source catalogue](sources.json) records exact URLs, dates, hashes, transformation and reuse restrictions. Full raw ZIP, five decoded layers, supplied PDFs and timetable cache live in ignored `local/`. The [study](../../docs/ST-GALLEN-STUDY.md) documents acquisition and reproduction. Raw and derived source vectors are not bundled as public assets.\n')
console.log(JSON.stringify({routes:inventory.length,agencies:agencies.length,admittedRouteRecords:admissionRows.length,days:index.days},null,2))
