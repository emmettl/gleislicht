import { readFile, writeFile } from 'node:fs/promises'
import { checkZugRegion } from './check-zug-region.mjs'

await checkZugRegion()
const audit = JSON.parse(await readFile('data/zug-study-audit.json','utf8'))
const count = n => n.toLocaleString('en-CH')
const percent = (a,b) => `${(100*a/b).toFixed(2)}%`
const table = (headers,rows) => [`| ${headers.join(' | ')} |`,`| ${headers.map(()=>'---').join(' | ')} |`,...rows.map(row=>`| ${row.join(' | ')} |`)].join('\n')
const days = audit.days
const source = audit.catalogue
const expansionIds = new Set(audit.policy.roadExpansion.routes.map(r=>r.routeId))
const lines = [...new Set(audit.sourceInventory.map(s=>s.line))].sort((a,b)=>Number(a)-Number(b))
const text = `# Zug canton: source adapter, regional feed and admission audit

Inventory and source review: **8 September 2026**. Start point: [Swiss transit source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#zg).

**The annual timetable inventory covers the whole canton. The regional bus, rail, funicular and shipping feed has partial geometry coverage, including explicitly attributed OSM bus inference.** It admits only complete directed stop patterns passing the numerical source checks, on Friday **4 September 2026** and Sunday **6 September 2026**. Admission is not certification of a current 2026 alignment, one-way street, running track or temporary diversion.

## Scope and evidence

All **${audit.annualRouteRecords} annual route records**, **${audit.annualAgencies} feed agencies**, **${count(audit.scope.annualScopedTripRecords)} annual trip records** and all **11 municipalities** are inventoried. The census streams **${count(audit.scope.annualStopTimeRows)} national stop-time rows**, without an operator whitelist. It selects every annual trip with at least one stop inside the complete official Zug multipolygon, then retains the whole selected trip including out-of-canton and foreign termini. No-stop through traffic is outside this passenger-service scope.

The polygon contains **${audit.scope.cantonStopRecords} GTFS stop records**, of which **${audit.scope.calledCantonStopRecords}** have annual calls. These are source records, including platform/station identities, not a count of unique physical stations. Annual route-to-canton-stop membership is retained even for routes inactive on both test dates. A census of this feed does not establish coverage of private, unrepresented or demand-responsive services.

- [Machine audit](../data/zug-study-audit.json): every route, source feature/line membership, municipality, directed pattern, pair, exclusion, geometry hash, operator/mode denominator and daily occurrence count.
- [Pinned extracted timetable](../data/zug-timetable.json.gz): complete calls and times for both civil days, annual route membership and source hashes.
- [Source catalogue](../data/zug-sources/sources.json), [preserved acquisition records](../data/zug-sources/acquisition.json), [policy and identity crosswalk](../data/zug-policy.json).
- [Friday feed](../public/data/zug-region/2026-09-04/zug-region-day-manifest.json), [Sunday feed](../public/data/zug-region/2026-09-06/zug-region-day-manifest.json). Each has twelve two-hour chunks and a 06:45–08:45 morning snapshot. The existing compact network schema is used. UI selection, scheduled refresh and deployment are not part of these artifacts.

## Dates, attribution and source reconciliation

The national timetable is release **${audit.feed.feed_version}**, valid **${audit.feed.feed_start_date}–${audit.feed.feed_end_date}**, SHA-256 **${audit.sourceHashes.archive}**. [Official GTFS dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [pinned archive](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip), [timetable terms](https://opentransportdata.swiss/en/terms-of-use/). Credit: **SBB / opentransportdata.swiss**. Gleislicht publishes the derived results under its own authorship. The feed has no shapes.txt.

The [official Buslinien archive](https://services.geo.zg.ch/datarepo/Buslinien/data.zip) is preserved as [buslinien.zip](../data/zug-sources/buslinien.zip), SHA-256 **${source.sources.find(s=>s.file==='buslinien.zip').sha256}**. It contains **175 LineStrings**, **${lines.length} distinct line labels** and **${audit.sourceInventory.length} feature/line memberships**. Comma-separated labels identify shared segments, not complete directed route shapes. The archive's HTTP Last-Modified is **${source.archiveLastModified}**; the GeoPackage's internal last_change is **${source.geopackageLastChange}**. Neither is a proven 2026 alignment date.

The complete current WFS tooltip layer and its independent hits count both contain **175** records. Every t_id, exact line-label string, vertex count and ordered LV95 coordinate matches the archive within **1 mm** (maximum ordinate difference **${source.comparison.maximumCoordinateDeltaMetres.toFixed(9)} m**). WFS feature IDs differ from GeoPackage row IDs, so they are not used as a crosswalk. Raw [WFS](../data/zug-sources/wfs.gml), [hits](../data/zug-sources/wfs-hits.xml) and [capabilities](../data/zug-sources/capabilities.xml) are retained with retrieval times and hashes. The current WFS repeats old geometry; its retrieval date is not a new vintage. Planning/vehicle-length layers are not mixed into this source.

Credit for bus geometry: **Quelle: GIS Kanton Zug**. The [official terms](https://zg.ch/de/planen-bauen/geoinformation/geoinformationen-nutzen/nutzungsbedingungen) permit commercial and noncommercial use with source credit; no generic Creative Commons licence is assigned. [Terms snapshot](../data/zug-sources/terms.html). Canton boundary: current official swisstopo feature 9, retained losslessly as returned; its API attributes do not declare an edition. Municipal polygons: **swissBOUNDARIES3D 2026-01**, all eleven original GeoPackage rows retained in [municipality-rows.json.gz](../data/zug-sources/municipality-rows.json.gz). Credit: **© swisstopo**, [terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices).

The [ZVB 2026 line directory](https://www.zvb.ch/fahrplan/fahrplan-zvb-2026/) is retained for identity review. GTFS agency 839 maps to the explicitly listed ZVB source line labels; 801 maps only to PostAuto 73, 110 and 280. There is no prefix/substring matching, agency-wide geometry admission or automatic renumbering. Historic source line **528** has no annual Zug-calling GTFS route and is not silently assigned to 525/526.

## Federal rail expansion

The [preserved federal rail source](../data/zug-rail-sources/source.json) adds **529 Friday** and **431 Sunday** complete SBB/SOB trips to the bus baseline. Source credit: **© Federal Office of Transport (FOT)**. The source collection links [attribution terms](https://opendata.swiss/terms-of-use/#terms_by); its literal STAC licence field is retained as proprietary, without substituting a Creative Commons licence. The [catalogue](../data/zug-rail-sources/catalogue.json), [collection metadata](../data/zug-rail-sources/collection.json) and [original compressed XTF](../data/zug-rail-sources/network.xtf.gz) are preserved. [Official federal dataset](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz).

The XML SHA-256 is **${audit.railSource.sha256}**, verified against the published multihash. Catalogue datetime is **${audit.railSource.catalogueDate}**, asset-updated timestamp **${audit.railSource.assetUpdated}**, catalogue checked **${audit.railSource.catalogueCheckedOn}**. All **3,424 source segments** carry an internal Stand of **2021-07-06**. These timestamps do not prove September 2026 validity. The audit records every segment's gauge, infrastructure operator, validity fields, endpoint attachment and admission disposition: **1,814** segments enter the candidate graph, **1,604** fail standard-gauge selection and **6** exceed the source topology attachment limit. Funiculars are not in this dataset.

The adapter admits only explicitly inventoried SBB/SOB route identities and **mm1435** source segments. It uses exact Swiss operating-point numbers, rejecting missing/ambiguous identities; there is no name or nearest-station fallback. Source endpoints connect through declared node references with attachments at most **120 m**; GTFS stations may attach to their exact operating point within **350 m**. Source linework is simplified at **5 m in LV95** and transformed by the existing parser to six-decimal WGS84 coordinates. These operating-point and station connectors are inferred geometry.

Each adjacent-call search blocks all other known scheduled operating points in the full pattern, preventing a shortcut through a later or earlier call. The detour limit is **max(3,000 m, 4.5 × direct distance)**, including station attachments. Each accepted pair retains ordered source segment IDs and node references. Rail contexts with different complete stop sequences remain distinct in the cache and audit. This validates numerical corridor continuity and stop order, not actual running-track choice, freight/passenger access rights, temporary diversions or observed movement. International trip calls are retained in full even when their missing foreign geometry causes exclusion.

## SBB graphical rail supplement

The [SBB graphical network](https://data.sbb.ch/explore/dataset/linie-mit-polygon/) provides a separate official source for two failed corridors. Four selected source records retain their full curves, with no edits to the federal graph or its gauge attributes. This adds **${days[0].admittedTripsUsingRailSupplement} Friday / ${days[1].admittedTripsUsingRailSupplement} Sunday trips**, completing every fixture pattern of **S26, RE6 and IR75**. Their full trips and all out-of-canton calls are retained.

The source investigation distinguishes three findings:

- The original federal segment **ch14uvag00087837**, Däniken SO–Däniken Ost, carries **mm1000** over kilometre 45.673–46.100. The [current federal API response](../data/zug-sbb-rail-sources/federal-daeniken.json) repeats that value. The existing standard-gauge filter correctly excludes it. SBB's graphical records classify the same corridor as **N**, explicitly defined by the [retained schema](../data/zug-sbb-rail-sources/metadata.json) as normal gauge. The alternative uses complete SBB DK–DKO and DKO–SCOE curves on infrastructure line 540, leaving the conflicting federal record unchanged.
- SBB line 822 supplies continuous **KR–KRGR–KODB** geometry, including the crossing from Kreuzlingen Grenze into Konstanz. The policy explicitly crosswalks GTFS operating-point IDs **8506131 / 8014586** to SBB codes **KR / KODB**. The federal source's lack of a foreign operating point is preserved as the failed primary attempt.
- The separate SBB dataset named **linie** represents line 540 with only two endpoint coordinates; it is not usable alignment evidence. The graphical dataset also contains schematic foreign records: the Como S. Giovanni–Chiasso Olimpino I portion has only two vertices. Such records cannot close EC's full Chiasso–Como gap. Both rejected source investigations remain preserved.

The acquisition retains all **seven** line-540 records and all **59** records returned by the Konstanz/Como search, with returned totals checked against page lengths and duplicate identities rejected. Every one of these 66 records has an inventory entry; only four are selected. Source keys combine infrastructure line number, start/end operating-point codes and kilometre interval. No public-service line-number guess selects geometry. Both selected corridors are contiguous at exactly equal source endpoint coordinates; geometric crossings or proximity cannot join them.

${table(['Infrastructure line','From → to','Source vertices','Selected corridor'],audit.railSupplementInventory.filter(r=>r.usedBy.length).map(r=>[r.line,`${r.from} → ${r.to}`,r.vertices,r.usedBy.join(', ')]))}

Däniken–Schönenwerd uses reviewed GTFS IDs **8502111 / 8502112** and SBB codes **DK / SCOE**. The policy allows only SBB agency 11's exact S26/RE6 route records there and its exact IR75 route record at Konstanz. Ordered timetable calls orient the full source curve. Source features provide short operating-point codes; the numeric GTFS-to-code mappings are explicit reviewed crosswalks, not source-supplied numeric joins or name-based fallback. Endpoint connectors are measured and must stay within **100 m**, stricter than the base rail adapter's 350 m limit. Paths must remain below **max(1,500 m, twice the direct distance)**. Each pair retains source keys, corridor, endpoint attachment lengths, numeric stop identities, a geometry hash and its original federal failure. Successful pre-existing pair paths remain unchanged. These are inferred operating-point/platform attachments, not certified running-track choices or observed movements.

[Source catalogue](../data/zug-sbb-rail-sources/sources.json), [line 540 records](../data/zug-sbb-rail-sources/line540.json), [foreign review](../data/zug-sbb-rail-sources/foreign-review.json), [rejected schematic line](../data/zug-sbb-rail-sources/schematic-line540.json) and [terms snapshot](../data/zug-sbb-rail-sources/terms.html) are retained with original URLs and hashes. Publisher: **SBB Infrastructure**. Credit: **SBB Infrastructure / data.sbb.ch**. Metadata rights allow commercial and noncommercial use with reference required (terms_by); [SBB terms](https://data.sbb.ch/page/licence/) require citing data.sbb.ch and publishing derived work under the user's own authorship. The regional feed is a dated Gleislicht derivation.

Graphical dataset modified timestamp: **${audit.railSupplementSource.modified}**; data processed: **${audit.railSupplementSource.dataProcessed}**; metadata processed: **${audit.railSupplementSource.metadataProcessed}**; retrieved: **${audit.railSupplementSource.retrieved}**. These are publication/processing timestamps, not individual alignment survey dates or a guarantee that September diversions are represented. Any refresh must preserve new evidence and revalidate the explicit crosswalks and source paths.

## Zugerbergbahn federal alignment

The federal cableway layer adds **72 Friday** and **70 Sunday** complete Zugerbergbahn trips, covering both directed two-stop patterns on each civil day. Admission requires the exact GTFS route 93-256-6-j26-1, agency 158, line 2566 and type 1400, mapped to installation **61.051**, operator **ZBB**, LineString **676**. The entire bounded API response contains this line and its two terminal point features, **3254 / 3248**; every feature is retained and inventoried. The original 22-vertex WGS84 curve remains intact. No intermediate stop, interpolated elevation, cable sag or observed vehicle position is invented.

The two source operating-point numbers **8502291 (Schönegg)** and **8502292 (Zugerberg)** match the GTFS DiDok identities exactly. Both source station coordinates equal the line's endpoints. Each path includes an explicit short connector from its exact GTFS stop coordinate to that endpoint (approximately 1.3 m, with a **25 m** rejection limit), the full curve in source-call order, then the connector to the other GTFS stop. Reverse calls reverse the curve; names and nearest-station guesses cannot select an installation. Length must stay below **max(1,500 m, twice the direct distance)**. Each accepted pair records installation, feature, operating-point identities, attachment lengths and a geometry hash.

[Original API response](../data/zug-mountain-sources/identify.json), [layer schema](../data/zug-mountain-sources/layer.json), [collection metadata](../data/zug-mountain-sources/collection.json) and [source catalogue with query URLs and hashes](../data/zug-mountain-sources/sources.json) are retained. Retrieval: **${audit.mountainSource.retrieved}**. Collection temporal date: **${audit.mountainSource.collectionDate}**; collection updated: **${audit.mountainSource.collectionUpdated}**. The API features have no individual source date; these collection timestamps do not establish September 2026 alignment validity. Attribution: **${audit.mountainSource.attribution}**. The collection's literal licence is **proprietary**, with linked [attribution terms](https://opendata.swiss/en/terms-of-use/#terms_by). No alternate generic licence is assigned. [Official collection](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.seilbahnen-bundeskonzession).

## Zugersee and Ägerisee shipping inference

The [swissTLMRegio transportation layer](https://api3.geo.admin.ch/rest/services/ech/MapServer/ch.swisstopo.vec200-transportation-oeffentliche-verkehr?lang=en) supplies generalized passenger-shipping linework. We retain all **35 shipping records** in the regional envelope and independently reconcile **11 Zugersee** and **seven Ägerisee** records against tighter lake queries. Other transportation sublayers may be capped; these queries establish the reviewed regional shipping inventory, not a national transportation census. All original responses, schema, catalogue, shoreline metadata, terms, URLs and SHA-256 hashes are in [the boat source catalogue](../data/zug-boat-sources/sources.json).

The source has no GTFS operator or passenger-line identity. The adapter therefore uses explicit reviewed lake/route mappings: **agency 186 / line 3660 / route 94-366-0-j26-1**, and **agency 179 / line 3661 / route 94-366-1-j26-1**, both type 1000. Each mapping lists the exact allowed GTFS dock IDs. It never selects another lake by nearest geometry or a matching name. Shared source vertices create an undirected graph; crossings and nearby endpoints add no connection. Source-call order determines direction. Every repeated Ägerisee call survives. The graph matcher rounds output to seven decimal places, retains source bends, and adds explicit GTFS dock connectors. Per-pair candidate feature IDs describe the whole lake graph, not a claim that every candidate segment was traversed.

The mode-specific attachment limit is **200 m** (largest admitted snap **157.82 m**); detours must stay below **max(1,200 m, three times direct distance)**. The bus tolerance remains 120 m. A source line is insufficient by itself: every path segment is split at every intersection with the unsimplified Vector25 shoreline, including island holes and all polygon parts. Zugersee uses both source records **91 and 92**, GEWISS 9175; Ägerisee uses **116**, GEWISS 9270. An outside-water interval is allowed only when both ends lie inside the same **200 m zone around an actual endpoint dock**. These are disclosed cartographic dock-area discrepancies, not claims of water containment or current dock access. The largest individual admitted outside interval is **78.85 m**. Intervals away from docks reject the pair and every complete trip requiring it; the adapter does not invent a replacement water path.

${table(['Lake / line','Friday admitted / all trips','Sunday admitted / all trips','Friday admitted / all patterns','Sunday admitted / all patterns'], audit.policy.boat.routes.map(r=>{const ds=days.map(d=>d.directedPatterns.filter(p=>p.routeId===r.routeId));return [r.lake+' / '+r.line,...ds.map(ps=>ps.filter(p=>p.admitted).reduce((n,p)=>n+p.trips,0)+'/'+ps.reduce((n,p)=>n+p.trips,0)),...ds.map(ps=>ps.filter(p=>p.admitted).length+'/'+ps.length)]}))}

This adds **eight Friday trips and eleven Sunday trips**. Across all boat candidates, **20/21 Friday** and **25/27 Sunday** unique directed pairs pass. Zug Bahnhofsteg → Walchwil remains excluded on both dates; Risch → Zug Bahnhofsteg also fails on Sunday. Their selected source paths have approximately **159 m / 153 m** outside the shoreline away from either endpoint dock. The rejected path hash and exact outside intervals remain in the machine audit. All three Ägerisee trips and both complete repeat-stop patterns pass on each date.

Shipping credit: **© swisstopo**; shoreline validation: **© FOEN, swisstopo**. The [swisstopo free-geodata terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices) require source attribution; the preserved STAC catalogue's literal licence remains **proprietary**, not an invented Creative Commons licence. These are Gleislicht cartographic inferences, not operator-certified lanes or navigation instructions.

Retrieved **${audit.boatSource.retrieved}**. Shipping collection temporal extent: **${audit.boatSource.collectionTemporalExtent[0].join(' – ')}**; collection updated: **${audit.boatSource.collectionUpdated}**. Shipping features supply no individual vintage. The [shoreline layer metadata](../data/zug-boat-sources/shoreline-legend.html) states **1 January 2007**; the [FOEN product description](https://www.bafu.admin.ch/en/the-swiss-hydrographic-network) identifies the Vector25 reference network. Neither retrieval nor collection processing timestamps establish September 2026 geometry validity. Seasonal shipping dates remain outside this two-day validation.

${table(['Shipping source UUID','Vertices','Selected lake / exclusion'], audit.boatInventory.map(f=>[f.id.trim(),f.vertices,f.lakes.join(', ')||'outside the two reviewed lake graphs']))}

## Neighbouring official bus source

Five exact-identity Luzern bus features were evaluated against the entire Zug timetable scope. The [supplement catalogue](../data/zug-luzern-sources/sources.json) preserves original URL, retrieval time and SHA-256 for the complete **114-feature** upstream page, its independent ID list, the operator enumeration, metadata and terms. The five selected features are checked byte-for-value against that page; no geometry edits or new connections are introduced. Source vintage is **26 May 2026**, all five FP_JAHR values are **2026**, and acquisition was **8 September 2026**. This is a reviewed source vintage, not a guarantee that every September diversion is represented.

Credit: **© rawi Kanton Luzern; © Verkehrsverbund Luzern**, **Open-By**. [Official product metadata](https://daten.geo.lu.ch/produkt/oevxxxxx_col_v5), [terms](https://geoportal.lu.ch/Nutzungsbedingungen). The service performs EPSG:2056 to WGS84 conversion; its returned GeoJSON coordinates are retained without simplification. Local TU codes 11/3/4 map explicitly to GTFS agencies 820/801/839; TU=11 must not be mistaken for SBB agency 11.

Successful original Zug pairs remain unchanged. Only a failed pair can use the entire adjacent-call path of its exact mapped Luzern operator/line. The tolerance remains 120 m; source graphs are never spliced at a midpoint or joined to fill a gap. Source changes occur only at preserved GTFS stops, whose coordinates anchor both paths. Every attempt retains its original Zug failure and the supplemental result, including failures. This adds **156 Friday trips** and **94 Sunday trips** to the preceding bus/rail release (2,767 / 1,680 trips).

${table(['Source feature','Agency / line','Friday trips using source','Sunday trips using source','Disposition'],audit.supplementInventory.map(s=>[s.feature,`${s.agencyId} / ${s.line}`,...s.days.map(d=>d.admittedTrips),s.days.some(d=>d.admittedTrips)?'complete trips admitted':'attempted; no complete trip admitted']))}

For 73, the Luzern corridor supplies the missing Luzern end while existing Zug geometry supplies Rotkreuz stop pairs that fail projection against Luzern alone. For 110, the supplement supplies the Hochdorf station pair. Line 23 has no original Zug line identity and uses the complete mapped Luzern route. The official source still fails for 653 around Hohle Gasse/Ebnet and the weekday Plaza/station branch, and for N73 around Luzernerhof/Brüelstrasse. These failed official attempts remain in the inventory; the separately reviewed OSM fallback below completes those patterns. Trip counts in this table mean use of successful Luzern segments and overlap the OSM-assisted trip counts; they must not be added together. Source-feature, route, per-day attempted/matched pair and occurrence totals are retained in supplementInventory.

## Complete-pattern road fallback for 653 and N73

The [Zug road cache](../data/zug-road-cache.json) is produced from a fresh, scoped matcher run, not a reuse of a successful long branch for an untested short branch. It covers **all six complete 653 patterns** and **both N73 patterns** across the two civil dates, including the Küssnacht station/Plaza variants and both full Weggis extensions. All ordered platform identities, coordinates and cross-canton calls enter the matcher. Policy pins exact route, agency and GTFS type (653: 700; N73: 705). A missing or changed complete pattern rejects cache reuse.

Source: **${audit.roadSource.source.description}**; OSM extract SHA-256 **${audit.roadSource.source.osmSha256}**. Attribution **© OpenStreetMap contributors**, **ODbL-1.0**, [licence and attribution](https://www.openstreetmap.org/copyright), [Geofabrik source](https://download.geofabrik.de/europe/switzerland.html). These are inferred road paths, not operator-verified route shapes or proof that September diversions are represented. The new matcher run was made **8 September 2026**, using pfaedle commit **${audit.roadSource.source.matcherCommit}**, bus mode, explicit fallback warnings and disabled trie aggregation. The matcher configuration and per-agency original input, warning log, shapes, trip/stop-time mapping and run hashes are retained in [road evidence](../data/zug-road-evidence/). The pinned PBF and matcher binary are needed only to rerun matching; ordinary validation reimports the retained matcher outputs offline.

Only pairs failing both available official sources can use the road fallback. Every complete input-pattern occurrence of a route-specific directed stop pair must produce a valid **byte-identical path**; one failed or conflicting occurrence rejects the shared candidate. Import rejects matcher fallback hops, distant endpoints, collapsed paths and excess detours. Final paths keep the existing **max(1,200 m, 4.5 × direct distance)** ceiling; imported linework has a 5 m simplification tolerance and is anchored to the exact timetable stop coordinates. Source changes occur at GTFS calls. The audit retains the original Zug failure and the Luzern failure under officialFailure for every road attempt, alongside road pattern IDs, context counts and geometry hashes. Existing successful official pair hashes were compared with the preceding committed release and remain unchanged.

This admits **126 additional Friday trips** (all 653), and **62 additional Sunday trips** (60 on 653 and two N73). Both N73 trips belong to the preceding service day and intersect the Sunday civil day; neither is converted into a new Sunday service departure. Both directions are represented, with **six additional Friday directed patterns** and **four Sunday patterns**. Six Friday and four Sunday directed pairs use roads; two 653 pairs occur on both dates, so there are eight distinct road pairs overall.

${table(['Line','From → to','Inferred length','Complete-pattern contexts'], [...new Map(days.flatMap(d=>d.directedStopPairs.filter(p=>p.geometrySource==='osm-road-inference'&&p.matched&&!expansionIds.has(p.routeId))).map(p=>[p.key,p])).values()].map(p=>[p.line,`${p.from} → ${p.to}`,`${p.lengthMetres.toFixed(1)} m`,p.roadContextOccurrences]))}

## Remaining bus branches and night services

A second, separately pinned [road cache](../data/zug-road-expansion-cache.json) and [matcher evidence](../data/zug-road-expansion-evidence/) cover **all 19 remaining incomplete bus route records**: 18 ZVB routes and GTFS agency 7231's EV1 replacement bus. The preparation retains **73 complete patterns** (71 ZVB, two EV1), including already-admitted branches on those routes. All original calls, coordinates, carry-in service dates and call rules survive admission. Road source date, ODbL attribution, binary/configuration hashes, import limits and consensus rules are the same as above. Each agency was independently matched on **8 September 2026**. The two road cache scopes must be disjoint; the original 653/N73 evidence remains unchanged.

This adds **${days[0].admittedTripsUsingRoadExpansion} Friday** and **${days[1].admittedTripsUsingRoadExpansion} Sunday** trips, raising the feed to **${count(days[0].admittedTrips)} / ${count(days[1].admittedTrips)}**. Road paths replace only failed official adjacent-call paths, so a complete trip may still use successful official geometry elsewhere. Every previously matched pair from the preceding committed feed retains its geometry hash. Scope here is the two source civil dates, not a claim of seasonal bus completeness or verified September diversions.

${table(['Agency / line','Friday admitted / source','Sunday admitted / source','Remaining reasons'],audit.inventory.filter(r=>expansionIds.has(r.routeId)).map(r=>[`${r.agencyId} / ${r.line}`,...r.days.map(d=>`${d.admittedTrips} / ${d.trips}`),[...new Set(r.days.flatMap(d=>d.reasons))].join(', ')||'none on fixtures']))}

The remaining bus exclusions are specific:

- **604, Zug Grienbach:** the official stop projection fails at roughly 155 m. The road matcher places Grienbach **188.7 m** from its returned shape, beyond the unchanged 120 m limit. Both adjacent pairs fail; **67 Friday / 38 Sunday** complete trips remain excluded.
- **619, Unterägeri Zentrum–Chlösterli, both directions:** pfaedle reports fallback hops. Those inferred direct hops are rejected during import; **8 Friday / 9 Sunday** trips remain excluded. Other 619 patterns pass (**30 / 16 trips**).
- **N6, Hünenberg Dorf–Sins Bahnhof:** complete input patterns disagree on this directed pair's road path. Consensus rejects it, retaining **3 Sunday excluded trips**, while three other N6 trips pass. A convenient successful branch cannot substitute for this conflicting context.

The raw road run also rejects two Walchwil 626 segments (missing shape and a 149.2 m snap), but the official Zug source already supplies those pairs successfully. The road fallback supplies only its different, previously collapsed official pair; all eight complete Friday 626 trips therefore pass the combined source checks. This distinction is preserved in the road cache's import report and the feed's per-pair provenance.

## Geometry and directed stop-pattern method

Decode the original EPSG:2056 GeoPackage with strict geometry/schema checks. Transform XY with the existing swisstopo approximate LV95-to-WGS84 polynomial at full floating precision; no simplification. Graph identity uses seven decimal places. Shared source vertices connect only within the exact mapped line. Geometric crossings do not create junctions. The source has no direction attribute: shortest connected source corridors are oriented by the ordered GTFS calls and remain inferred alignments.

Every pair must pass **120 m** maximum stop projection, connectivity, and a detour bound of **max(1,200 m, 4.5 × direct distance)**. Alternative source-part projections may add at most **5 m** to the nearest projection. Paths include the short stop-to-source projection connectors; those are inferred access geometry, not measured trajectories. Collapsed paths fail. Full repeated-stop sequences, branches, direction_id and pickup/drop-off rules form distinct patterns. A failure in any pair excludes the entire pattern. Prior-arrangement pickup/drop-off codes 2/3 also exclude a pattern from unconditional animation; none occur in these fixtures.

Three explicitly reviewed source discontinuities are joined by short inferred connectors, pinned to exact source feature IDs and vertex indices. Each includes an existing source endpoint, stays within identical line memberships, connects distinct original components and is less than one metre. No general nearest-neighbour gap filling is enabled.

${table(['Join','Lines','Length','Source vertices'],audit.policy.topologyJoins.joins.map(j=>[j.id,j.lines.join(', '),`${j.metres.toFixed(3)} m`,j.vertices.map(v=>`feature ${v.featureId} / vertex ${v.index}`).join(' → ')]))}

The audit and feed metadata retain the join policy; affected pairs carry geometryRepairIds and inferredJoinMetres. **${days[0].admittedTripsUsingRepair} Friday trips** and **${days[1].admittedTripsUsingRepair} Sunday trips** use these connectors. Their small lengths do not establish lawful street direction. The initial bus-only release admitted 1,668 Friday trips and 1,009 Sunday trips without these connectors; the joins raised its bus admission to 2,238 and 1,249. The subsequent rail expansion is counted separately below.

## Weekday and Sunday results

Calendar exceptions and preceding service-day spillover are applied. The civil day is 00:00–24:00 Europe/Zurich. Source identities and negative carry-in times are preserved; no source call is trimmed. Friday after-midnight night departures belonging to Friday service fall on Saturday's civil day; Sunday's N1–N6 and N73 departures include Saturday service carry-in. Calendar active-source counts therefore differ from civil-day counts. Frequency templates would retain source-anchored headway semantics; both selected fixtures contain zero representative headway trips.

${table(['Measure',...days.map(d=>d.date)], [
  ['Civil-day trips',...days.map(d=>count(d.trips))],
  ['Admitted / excluded trips',...days.map(d=>`${count(d.admittedTrips)} / ${count(d.excludedTrips)}`)],
  ['Admitted / all directed patterns',...days.map(d=>`${d.admittedPatterns} / ${d.patterns}`)],
  ['Matched / all routing-context pairs',...days.map(d=>`${d.matchedDirectedPairs} / ${d.directedPairs} (${percent(d.matchedDirectedPairs,d.directedPairs)})`)],
  ['Fully matched / all unique directed route-stop pairs',...days.map(d=>`${d.fullyMatchedUniqueDirectedRouteStopPairs} / ${d.uniqueDirectedRouteStopPairs}`)],
  ['Matched / all scheduled segment occurrences',...days.map(d=>`${count(d.matchedSegmentOccurrences)} / ${count(d.segmentOccurrences)} (${percent(d.matchedSegmentOccurrences,d.segmentOccurrences)})`)],
  ['All / admitted carry-in trips',...days.map(d=>`${d.carryInTrips} / ${d.admittedCarryInTrips}`)],
])}

Rail pair routing depends on the complete ordered pattern, so days[].directedPairs and group pair counts include pattern context for rail. Bus pairs retain the route/from/to key. The separate uniqueDirectedRouteStopPairs count collapses context; fullyMatchedUniqueDirectedRouteStopPairs requires success in every tested context. These denominators must not be confused when comparing the original bus-only release with this expansion. Matched occurrences include good pairs on ultimately excluded patterns. They are not a percentage of admitted full trips. All modes and excluded operators stay in the denominator. Every emitted trip has a non-null, correctly oriented path for every adjacent source call.

${table(['Date','Agency / mode','Trips admitted / all','Patterns admitted / all','Pairs matched / all','Occurrences matched / all'],days.flatMap(d=>d.groups.map(g=>[d.date,`${g.id} — ${g.agency}`,`${g.admittedTrips} / ${g.trips}`,`${g.admittedPatterns} / ${g.patterns}`,`${g.matchedDirectedPairs} / ${g.directedPairs}`,`${g.matchedSegmentOccurrences} / ${g.segmentOccurrences}`])))}

Failures are also broken down by operator/mode, reason, unique directed route-stop pair, scheduled occurrence, affected pattern and trip in days[].groups[].failures. A trip can have several reasons; affected-trip counts across reasons must not be summed.

## All municipalities

Counts overlap: a whole trip or annual route can serve several municipalities. These rows must not be summed into a canton total. Stop counts include uncalled source stop records. Source polygons retain holes and all parts; all 945 canton stop records have municipal membership.

${table(['Municipality','Source stops','Annual route records','Friday admitted / all trips','Sunday admitted / all trips'],audit.municipalityReview.map(m=>[m.name,m.cantonStopIds.length,m.annualRouteIds.length,...m.days.map(d=>`${d.admittedTrips} / ${d.trips}`)]))}

Neuheim now has admitted Sunday service: road inference completes 631 and N2 patterns beyond the old official line geometry. Municipality counts include full trips calling in each area and may overlap across municipalities.

## Complete annual route admission/exclusion inventory

Each row is an exact GTFS route_id, not a unique passenger-facing line. Counts are admitted/all civil-day trips; “inactive” means no trip overlaps that day, not nonexistent or excluded from the annual census.

${table(['GTFS route ID','Agency','Line / mode','Annual trips','Friday','Sunday','Failure reasons'],audit.inventory.map(r=>[r.routeId,r.agencyId,`${r.line} / ${r.mode}`,r.annualTripRecords,...r.days.map(d=>d.trips?`${d.admittedTrips}/${d.trips}`:'inactive'),[...new Set(r.days.flatMap(d=>d.reasons))].join(', ')||'—']))}

Principal exclusions: complete EC patterns still lack credible alignment geometry for Chiasso–Como S. Giovanni; the preserved federal source has no exact foreign operating point and the examined SBB foreign record is schematic. S26, RE6 and IR75 are now complete on both fixtures through the explicit SBB supplement. Zugersee retains one Friday and two Sunday trips with remote shoreline crossings; every Ägerisee trip on the two fixtures passes the shipping checks. Bus exclusions remain limited to the specific 604, 619 and N6 failures above. Full pair details, source call identities and stop names are in the machine audit.

## Every source line label

${table(['Source label','Segment memberships','Mapped agencies','Annual matched route IDs'],lines.map(line=>{
  const items=audit.sourceInventory.filter(s=>s.line===line)
  return [line,items.length,[...new Set(items.flatMap(s=>s.agencyIds??[]))].join(', ')||'unmapped',[...new Set(items.flatMap(s=>s.gtfsRoutes))].join(', ')||'none']
}))}

## Reproduction and verification

The durable source bytes and extracted two-day timetable are in the repository. No live service or credentials are needed for offline reproduction. Refreshing a source is a new review: preserve new bytes, reconcile versions, recheck terms and identity mapping, and update the pinned policy deliberately.

\`\`\`sh
# Decode and reconcile the preserved archive and WFS; no network.
npm run data:zug:sources

# Optional full national re-census (requires the pinned archive).
npm run data:zug:census -- /private/tmp/GTFS_FP2026_20260902.zip \\
  data/zug-sources/boundary.json data/zug-timetable.json.gz

npm run data:zug
npm run data:zug:check
npm run data:zug:report
python3 -m unittest discover -s scripts -p test_prepare_zug_sources.py
npx vitest run scripts/zug-boat-geometry.test.mjs scripts/zug-sbb-rail-supplement.test.mjs scripts/zug-road-geometry.test.mjs scripts/luzern-road-geometry.test.mjs scripts/enrich-postbus-roads.test.mjs scripts/zug-mountain-geometry.test.mjs scripts/zug-region.test.mjs scripts/zug-bus-supplement.test.mjs scripts/zug-rail-geometry.test.mjs scripts/luzern-region.test.mjs \\
  scripts/civil-day.test.mjs scripts/gtfs-frequencies.test.mjs
\`\`\`

To regenerate only the scoped road evidence, prepare with the pinned timetable/policy, run the matcher for each listed agency, then import. Changing matcher outputs requires reviewing and updating the cache hash in policy; it never silently refreshes a committed source.

\`\`\`sh
node scripts/zug-road-geometry.mjs prepare data/zug-timetable.json.gz data/zug-policy.json /private/tmp/zug-road-feed
# Repeat for agencies 839 and 801:
node scripts/match-postbus-roads.mjs --pfaedle /private/tmp/gleislicht-pfaedle/build/pfaedle \\
  --osm /private/tmp/gleislicht-postbus-roads.osm.pbf --config data/zug-road-evidence/pfaedle.cfg \\
  --feed /private/tmp/zug-road-feed/839 --output /private/tmp/zug-road-matched/839
node scripts/zug-road-geometry.mjs import /private/tmp/zug-road-feed /private/tmp/zug-road-matched \\
  data/zug-road-cache.json data/zug-road-evidence
# The independent expansion uses policy key roadExpansion:
node scripts/zug-road-geometry.mjs prepare data/zug-timetable.json.gz data/zug-policy.json /private/tmp/zug-road-expansion-feed roadExpansion
# Match agencies 839 and 7231 into /private/tmp/zug-road-expansion-matched as above.
node scripts/zug-road-geometry.mjs import /private/tmp/zug-road-expansion-feed /private/tmp/zug-road-expansion-matched \\
  data/zug-road-expansion-cache.json data/zug-road-expansion-evidence
\`\`\`

The checker verifies source/policy/timetable hashes, annual census totals, all directed patterns including exclusions, all rematched pair hashes, source-specific bus alternatives, full road-pattern scope and retained matcher warning/shape replay, exact funicular installation/operating-point matches, selected SBB rail source records and rail pattern contexts, unique/context pair totals, operator and route aggregates, source call/timing replay, carry-in identities, path endpoints, morning membership and every chunk hash/length. Tests reject duplicate/truncated WFS responses, changed labels/coordinates, wrong operator joins, substring matching, arbitrary gaps/crossings, unreviewed topology joins and reversed or missing paths.

Remaining scope limits: two September dates do not validate winter, holiday, summer boat or all seasonal/engineering patterns. The old line geometry has no proven 2026 validity and has not been certified against street-direction restrictions or diversions. The feed is scheduled interpolation with explicit inferred projection/topology pieces. It is not observed vehicle movement. Full cantonal motion coverage remains incomplete.
`
await writeFile('docs/ZUG-STUDY.md',text)
console.log('Wrote docs/ZUG-STUDY.md after successful source and artifact validation')
