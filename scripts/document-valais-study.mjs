import { readFile, writeFile, mkdir } from 'node:fs/promises'
const read=async p=>JSON.parse(await readFile(p,'utf8'))
const s=await read('data/valais-audit/summary.json'),routes=await read('data/valais-audit/routes.json'),policy=await read('data/valais-policy.json'),road=await read('data/valais-road-cache.json')
const n=x=>new Intl.NumberFormat('en-CH').format(x),percent=(a,b)=>(100*a/b).toFixed(1)+'%',table=(headers,rows)=>`| ${headers.join(' | ')} |\n| ${headers.map(()=>'---').join(' | ')} |\n${rows.map(r=>'| '+r.map(c=>String(c??'—').replaceAll('|','/').replaceAll('\n',' ')).join(' | ')+' |').join('\n')}`
const agencyIds=[...new Set(routes.map(r=>r.agencyId))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
const bus=s.days.map(d=>d.groups.filter(g=>g.mode==='bus').reduce((a,g)=>({trips:a.trips+g.trips,admitted:a.admitted+g.admittedTrips}),{trips:0,admitted:0}))
const rail=s.days.map(d=>d.groups.filter(g=>g.mode==='rail').reduce((a,g)=>({trips:a.trips+g.trips,admitted:a.admitted+g.admittedTrips}),{trips:0,admitted:0}))
const operatorRows=agencyIds.map(id=>{const rr=routes.filter(r=>r.agencyId===id);return[id,rr[0].agency,rr.length,...s.days.map(d=>{const groups=d.groups.filter(g=>g.id.startsWith(id+':'));return `${n(groups.reduce((n,g)=>n+g.admittedTrips,0))} / ${n(groups.reduce((n,g)=>n+g.trips,0))}`})]})
const report=`# Valais / Wallis — initial regional study

Reviewed 8 September 2026. **${s.routeCount} annual route records, ${s.agencyCount} GTFS agency identities, all 13 districts.** The initial application feed admits **${n(s.days[0].coverage.admittedTrips)} Friday journeys and ${n(s.days[1].coverage.admittedTrips)} Sunday journeys**, retaining every original call, time and permission. This is a complete census of the scoped pinned timetable and a **partial geometry study**, not a complete canton service feed.

## Application and artifacts

Choose **VS / Valais** in the study browser or network controls. Both **2026-09-04** and **2026-09-06** have a date selector, full civil-day playback, morning extract, original station search and shareable date/time links. The displayed scope and model identify the initial selection and inferred geometry. [Feed index](../public/data/valais-region/index.json), [source attribution](../public/data/valais-region/sources.json), [complete OSM-derived road database](../public/data/valais-region/road-paths.json), [coverage summary](../data/valais-audit/summary.json), [every route and its exclusions](VALAIS-ROUTE-INVENTORY.md).

## Census denominator and complete journeys

The shared streaming census reads **${n(s.census.allYearTrips)} national trip records and ${n(s.census.stopTimeRows)} stop-time rows** in GTFS feed **20260902**, valid 14 December 2025–12 December 2026. Membership requires at least one original call inside the **unsimplified swissBOUNDARIES3D 2026-01 Valais polygon**. There is no operator whitelist or rectangular selection. Separate polygon parts, holes and all 13 district features are preserved as original GeoPackage rows. Parent/platform IDs remain distinct. A bounding rectangle only limits the expensive boundary-distance diagnostic.

The [called and uncalled in-canton stop inventory](../data/valais-audit/stops.json) and each route's full annual in-canton stop/district list establish geographical coverage. Conversion of GTFS WGS84 coordinates to LV95 uses the shared approximate swisstopo formula; original platforms within 10 m of either side of the boundary are flagged in the census. Routes supported only by those calls are marked boundary-sensitive. Jungfraujoch calls bring Jungfraubahn into the Valais census; a station name is never used to assume canton membership.

Whole journeys extend beyond the canton, including foreign termini. A non-stopping train merely passing through does not enter this stop-based census. Geometry gaps outside the canton exclude the **whole journey**. The source call order, repeats, route and agency identities, pickup/drop-off permissions, source-trip IDs and source-service dates survive export. The two-hour chunks repeat overlapping journeys intact; they do not split them into shortened movements. The morning extract is inclusive at its 06:45 and 08:45 boundaries, following the shared chunk library.

${table(['District','Called platform IDs','Annual routes','Routes with admitted journeys'],s.districts.map(d=>[d.district,d.calledPlatforms,d.routeIds.length,d.admittedRouteIds.length]))}

District route counts overlap; every district has admitted initial journeys. This does not mean every valley branch or mode is represented in the movement feed. The all-year route states are ${Object.entries(s.routesByStatus).map(([k,v])=>`**${v} ${k}**`).join(', ')}. Inactive routes remain explicit, including seasonal, night and replacement records.

## Official local-source investigation

The retained [request receipts and hashes](../data/valais-sources/research/requests.json) and [review](../data/valais-sources/research/review.json) record successful acquisition of the current public sources:

- The [cantonal geodata inventory](https://www.vs.ch/documents/17311/17591/Inventaire%2Bdes%2Bg%C3%A9odonn%C3%A9es%2B-%2BInventar%2Bder%2BGeodaten/2fd849d0-ab9f-4bfc-965a-3920ebd18a08), generated **26 August 2026**, lists SDM dataset **376, Transport en commun / Öffentlicher Verkehr**, dated **5 July 2018**. The downloaded PDF's publication and distribution cells are blank. A search-engine snippet suggests a different row state; the preserved actual PDF governs this review.
- The [official geoservices page](https://geo.vs.ch/geoservices) now links a **13 May 2026** internet-geodata access list and the CC_GEO_Publisher catalogue. All **247 public catalogue items** were acquired in three pages, with total, pagination and unique-ID checks. No attributed operational passenger-line export was established.
- The [Route MapServer](https://sit.vs.ch/arcgis/rest/services/Route/MapServer?f=pjson) exposes **12 layers**: road axes/classification, tonnage, traffic sections, projects, cycling, administrative road areas and locality names. Those are not identified bus routes.
- [PDc_mobilite](https://services1.arcgis.com/rMlsWo8szOzlrpCq/arcgis/rest/services/PDc_mobilite/FeatureServer?f=pjson) has nine strategic planning layers, including cable infrastructure and projected rail lines. They do not certify current passenger movements. The tempting zones_dessertes service concerns **electricity networks**, not flexible bus areas.

**No Valais operational line vectors were acquired or used.** Public metadata access is not a vector licence. The unresolved follow-up is a current dataset 376 export from SDM/SGI with operator/line keys, geometry effective date, direction semantics and redistribution terms. No request, order or message has been sent. [TPC's 2026 timetable index](https://tpc.ch/horaires-et-plans-tpc-trains-bus-mobichablais/horaires-a-telecharger/), [TPC network access characteristics](https://tpc.ch/wp-content/uploads/caracteristiques-essent-acces-au-reseau.pdf) and [RegionAlps corridor description](https://www.regionalps.ch/train-valais/martigny-chable-orsieres-1576.html) support route-identity review; schematic maps have not been digitised or represented as coordinate sources.

## Reviewed federal rail infrastructure

The study reuses the retained national **FOT Schienennetz** source, ${s.sources.rail.nodes} exact operating-point nodes and ${s.sources.rail.segments} source segments. Its current [STAC item](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz) still advertises the retained XTF checksum. Catalogue vintage is **6 July 2021**; asset update is **18 January 2025**. Neither timestamp establishes 2026 operational alignment. Every source segment retains Stand and validity fields in the [infrastructure audit](../data/valais-audit/rail-infrastructure.json).

${table(['Reviewed network','Gauge','GTFS agencies','FOT operator scope'],policy.rail.groups.map(g=>[g.id,g.gauge,g.agencyIds.join(', '),g.operators.join(', ')]))}

The policy pins **58 annual rail route identities**, including route ID, agency and passenger label. Standard-gauge SBB/BLS/RegionAlps can use the specified shared infrastructure operators; MGB FO and BVZ remain separate timetable identities. RhB infrastructure allows complete Glacier Express patterns. Mont Blanc Express and TPC use their own reviewed metre-gauge graphs. Gornergrat and Jungfrau rack rail use separate GGB/JB graphs. DFB heritage rail and VerticAlp tourist rail are inventoried but lack a reviewed initial adapter. Replacement buses never inherit a rail path.

Matching uses exact DiDok/operating-point identities, **350 m** maximum station attachment, **120 m** maximum source-node attachment, **5 m** geometry simplification and a path ceiling of max(**4.5× direct distance**, **1,200 m**). Source validity intervals and gauge are checked. Infrastructure paths cannot pass another called node out of order. No generic nearest-line joining or missing-network bridge is added. Original calls select direction on undirected infrastructure; this does not certify a running track.

The review rejected one additional Sunday IC journey: **Olten–Aarau** inferred **40.947 km via Aarburg, Zofingen Nord, Suhr, Lenzburg West and Rupperswil**, against an 11-minute interval. It passed the broad distance bound but lacks credible corridor/diversion evidence. The exact pattern, candidate geometry hash and directed source segment chain are retained; its entire Brig–Zürich journey is excluded. Large Gornergrat hairpins and Entremont curves are different cases, supported by their specific single-operator source corridors. No threshold was widened to improve counts.

## Attributed OSM bus matching

All **994 distinct complete bus patterns**, covering 161 route records active on the two civil days, were prepared together with real agency identities. Pattern identity includes exact route ID and the complete ordered platform IDs **and coordinates**, including repeated stops and foreign calls. The delivered audit additionally distinguishes GTFS direction ID and call permissions. A successful pair in one pattern is never borrowed for a failing pattern, and different path variants remain attached to their original journey.

Roads are the pinned **Geofabrik Switzerland 2 September 2026 + border extract acquired 8 September 2026**, not a mutable latest download. Combined PBF SHA-256: \`${road.metadata.source.osmSha256}\`. Matcher: **pfaedle ${road.metadata.source.matcherCommit}**, unmodified bus profile, **--no-trie -W** so every fallback hop is explicitly logged. The wrapper preserves binary/configuration/source/input/output hashes and [complete compressed matcher evidence](../data/valais-road-evidence). Offline validation reimports every accepted/rejected segment and compares it to the cache.

The retained run reports **${road.agencies.all.cache.report.maxSnapMetres.toFixed(1)} m** as its maximum accepted stop snap and **${road.agencies.all.cache.report.rejectedPatternSegments} rejected pattern segments**. The importer slices repeated/loop stops by monotone shape distances, rejects every logged straight-line fallback, and enforces **120 m** road snaps, max(**6× direct**, **1,500 m**) detour and **5 m** simplification. Stop-access connectors are bounded inferences. Supported OSM bus access, one-way and turn restrictions guide matching, but source errors and temporary diversions remain possible; these are not operator-certified routes.

The initial feed includes Rhône-valley city services, PostAuto side valleys, TPC/TMR/RegionAlps buses, Leukerbad, Sierre-Montana-Crans and Zermatt electric buses where complete patterns pass. Matcher failures include remote mountain access, termini and cross-border extents; all are retained in pattern audits. The full OSM-derived path database is distributed under **ODbL 1.0**, separately from federal geometry and timetable terms.

![Complete admitted geometry across the canton and all 13 districts](assets/valais-geometry-review.png)

The plot presents the complete admitted path set on both days, including side-valley branches, against unsimplified district boundaries. It is a source-geometry overview, without a street basemap; it cannot independently certify every road restriction or temporary routing.

## Coverage against all candidates

${table(['Measure','Friday 4 September','Sunday 6 September'],[
 ['All civil-day instances',...s.days.map(d=>n(d.coverage.trips))],['Exact scheduled instances',...s.days.map(d=>n(d.coverage.scheduledTrips))],['Representative headway instances',...s.days.map(d=>n(d.coverage.representativeHeadwayTrips))],['Admitted complete journeys',...s.days.map(d=>n(d.coverage.admittedTrips))],
 ['Admitted / scheduled candidates',...s.days.map(d=>percent(d.coverage.admittedTrips,d.coverage.scheduledTrips))],['Bus admitted / candidate',...bus.map(d=>`${n(d.admitted)} / ${n(d.trips)}`)],['Rail admitted / candidate',...rail.map(d=>`${n(d.admitted)} / ${n(d.trips)}`)],
 ['Admitted / all directed patterns',...s.days.map(d=>`${d.coverage.admittedPatterns} / ${d.coverage.patterns}`)],['All-context matched / directed pairs',...s.days.map(d=>`${d.coverage.allContextsMatchedDirectedPairs} / ${d.coverage.directedPairs}`)],
 ['Partially matched directed pairs',...s.days.map(d=>d.coverage.partiallyMatchedDirectedPairs)],['Matched / all segment occurrences',...s.days.map(d=>`${n(d.coverage.matchedSegmentOccurrences)} / ${n(d.coverage.segmentOccurrences)}`)],['Matched / scheduled segment occurrences',...s.days.map(d=>`${n(d.coverage.matchedScheduledSegmentOccurrences)} / ${n(d.coverage.scheduledSegmentOccurrences)}`)],
 ['Segments in admitted journeys',...s.days.map(d=>n(d.coverage.admittedSegmentOccurrences))],['Admitted / carry-in journeys',...s.days.map(d=>`${d.admittedCarryInTrips} / ${d.carryInTrips}`)],['Admitted / night-labelled journeys',...s.days.map(d=>`${d.admittedNightTrips} / ${d.nightTrips}`)],['Admitted / repeated-stop patterns',...s.days.map(d=>`${d.admittedRepeatedStopPatterns} / ${d.repeatedStopPatterns}`)],['Admitted outside-canton platform IDs',...s.days.map(d=>d.outOfCantonPlatforms)]])}

Matched segments in otherwise failed journeys count toward **candidate geometry coverage**, not admitted movements. Four route-scoped pairs have mixed outcomes across their full-pattern contexts; the audit counts their actual matched occurrences instead of assigning the whole pair a successful state. Both direction IDs are evaluated. **${s.weekdaySundayPatterns.shared}** patterns are shared between the days, **${s.weekdaySundayPatterns.weekdayOnly}** are Friday-only and **${s.weekdaySundayPatterns.sundayOnly}** Sunday-only.

Civil days include preceding service-day carry-in, calendar exceptions and frequency expansion. Headway instances are representative grids, not exact departures; **none are admitted in this initial geometry scope**. All 105 annual cableway routes, six funicular routes, the water route and tram route stay in the inventory, with inactive/excluded status per date. Services absent from GTFS and unrepresented flexible service areas are outside what this census can prove. Two September dates do not validate winter/holiday/seasonal operation.

### Timing diagnostics

${table(['Diagnostic','Friday','Sunday'],[['Zero-duration admitted segment occurrences',...s.days.map(d=>d.timing.zeroDurationSegmentOccurrences)],['Maximum positive-duration rail km/h',...s.days.map(d=>d.timing.maximumPositiveDurationByMode.rail.kmh.toFixed(1))],['Maximum positive-duration bus km/h',...s.days.map(d=>d.timing.maximumPositiveDurationByMode.bus.kmh.toFixed(1))]])}

Minute-resolution and equal-timestamp calls are preserved. No artificial seconds are inserted. Friday's bus maximum is Gamsen, Landmauer → Eyholz, Ritikapelle; Sunday's is Le Châtelard VS, gare → Tête-Noire, each assigned one minute in the archive. These high implied speeds remain explicit source timing/model limitations, not measured or certified speeds. A geometry pass does not establish physically precise movement at every call.

## Reuse and reproducibility

${table(['Source','Attribution / reuse','Pinned SHA-256'],[['GTFS','SBB / opentransportdata.swiss; publisher terms, not blanket CC',s.sourceHashes.archive],['Boundary','© swisstopo; free-geodata terms',s.sources.boundary.sourceSha256],['Federal rail','© FOT; terms_by link in retained STAC collection, proprietary label preserved',s.sourceHashes.rail],['OSM derived cache','© OpenStreetMap contributors; ODbL 1.0',s.sourceHashes.road]])}

Terms: [timetable](https://opentransportdata.swiss/en/terms-of-use/), [FOT attribution terms](https://opendata.swiss/terms-of-use/#terms_by), [swisstopo](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices), [OSM](https://www.openstreetmap.org/copyright). Gleislicht's transformations include full-canton selection, source projection, bounded connectors, path inference, simplification, coordinate conversion and scheduled interpolation. No local operational Valais geometry licence is implied. Raw local-source research responses and their retrieval timestamps are kept in the repository; source publication timestamps are never substituted for geometry vintage.

The compact timetable fixture, policy, source rows, matcher evidence, route/pattern/pair audits and complete derived roads are retained. The large national ZIP and filtered PBF remain external inputs and are checked by hash when used. Pinned [national download](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip).

\`\`\`sh
# Offline boundary decoding, build, exhaustive evidence/candidate/artifact checks.
python3 scripts/prepare-valais-sources.py
npm run data:valais
npm run data:valais:check
npm run data:valais:docs
npx vitest run scripts/valais-region.test.mjs scripts/luzern-region.test.mjs
npm run build

# Re-scan the pinned national archive (do not replace it with latest).
npm run data:valais:census -- /path/GTFS_FP2026_20260902.zip data/valais-audit/timetable-cache.json.gz
# Re-run roads with the exact pinned software/PBF; changed hashes require review.
node scripts/valais-road-geometry.mjs prepare data/valais-audit/timetable-cache.json.gz /tmp/valais-input
node scripts/match-postbus-roads.mjs --pfaedle /path/pfaedle --osm /path/pinned.osm.pbf --config /path/pfaedle.cfg --feed /tmp/valais-input/all --output /tmp/valais-output/all
node scripts/valais-road-geometry.mjs import /tmp/valais-input /tmp/valais-output
\`\`\`

The checker reconstructs geometry from every bus and rail candidate, compares original full-call identities and permissions against every exported journey, reconciles every annual route's status, checks all 24 chunk hashes and full-day/morning identity, verifies catalogue pagination and response hashes, and reimports original matcher outputs. Tests cover whole-journey rejection, loops/reverse calls, reservation permissions, pattern-dependent failures and Valais deep links/translations. A source or policy change requires rebuilding and rerunning these checks.

## Operator inventory

${table(['Agency ID','GTFS identity','Annual routes','Friday admitted / all','Sunday admitted / all'],operatorRows)}
`
await writeFile('docs/VALAIS-STUDY.md',report)
await writeFile('docs/VALAIS-ROUTE-INVENTORY.md',`# Complete Valais annual route inventory\n\nAll ${routes.length} route records selected from the pinned archive by at least one original call in the canton polygon. Counts are complete civil-day instances; headway candidates are not exact departures. Zero/zero means inactive on that date, not absence from the annual inventory. Source operators, overlapping districts, boundary sensitivity and exact geometry diagnostics are preserved in [routes.json](../data/valais-audit/routes.json) and both day audits. [Study, sources and exclusions](VALAIS-STUDY.md).\n\n${table(['GTFS route ID','Agency','Line','Mode','Districts','Friday admitted / all','Sunday admitted / all','Status / reasons'],routes.map(r=>[r.id,`${r.agencyId} ${r.agency}`,r.name||r.longName,r.type===116?'rack rail':r.mode,r.districts.join(', '),...r.days.map(d=>`${d.admittedTrips} / ${d.trips}`),[r.status,...new Set(r.days.flatMap(d=>d.reasons)),...(r.boundarySensitive?['boundary-sensitive']:[])].join('; ')]))}\n`)
await mkdir('public/data/valais-region',{recursive:true})
await writeFile('public/data/valais-region/coverage.json',JSON.stringify({census:s.census,routeCount:s.routeCount,agencyCount:s.agencyCount,districts:s.districts,routesByStatus:s.routesByStatus,days:s.days.map(d=>({date:d.date,coverage:d.coverage,exclusions:d.exclusions})),scopeLimits:s.scopeLimits},null,2)+'\n')
console.log('Wrote Valais study, every route and public coverage summary')
