# Zug canton: source adapter, regional feed and admission audit

Inventory and source review: **8 September 2026**. Start point: [Swiss transit source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#zg).

**The annual timetable inventory covers the whole canton. The regional bus, rail and funicular feed has partial geometry coverage, including explicitly attributed OSM bus inference.** It admits only complete directed stop patterns passing the numerical source checks, on Friday **4 September 2026** and Sunday **6 September 2026**. Admission is not certification of a current 2026 alignment, one-way street, running track or temporary diversion.

## Scope and evidence

All **77 annual route records**, **9 feed agencies**, **22'676 annual trip records** and all **11 municipalities** are inventoried. The census streams **34'499'152 national stop-time rows**, without an operator whitelist. It selects every annual trip with at least one stop inside the complete official Zug multipolygon, then retains the whole selected trip including out-of-canton and foreign termini. No-stop through traffic is outside this passenger-service scope.

The polygon contains **945 GTFS stop records**, of which **620** have annual calls. These are source records, including platform/station identities, not a count of unique physical stations. Annual route-to-canton-stop membership is retained even for routes inactive on both test dates. A census of this feed does not establish coverage of private, unrepresented or demand-responsive services.

- [Machine audit](../data/zug-study-audit.json): every route, source feature/line membership, municipality, directed pattern, pair, exclusion, geometry hash, operator/mode denominator and daily occurrence count.
- [Pinned extracted timetable](../data/zug-timetable.json.gz): complete calls and times for both civil days, annual route membership and source hashes.
- [Source catalogue](../data/zug-sources/sources.json), [preserved acquisition records](../data/zug-sources/acquisition.json), [policy and identity crosswalk](../data/zug-policy.json).
- [Friday feed](../public/data/zug-region/2026-09-04/zug-region-day-manifest.json), [Sunday feed](../public/data/zug-region/2026-09-06/zug-region-day-manifest.json). Each has twelve two-hour chunks and a 06:45–08:45 morning snapshot. The existing compact network schema is used. UI selection, scheduled refresh and deployment are not part of these artifacts.

## Dates, attribution and source reconciliation

The national timetable is release **20260902**, valid **20251214–20261212**, SHA-256 **d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e**. [Official GTFS dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [pinned archive](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip), [timetable terms](https://opentransportdata.swiss/en/terms-of-use/). Credit: **SBB / opentransportdata.swiss**. Gleislicht publishes the derived results under its own authorship. The feed has no shapes.txt.

The [official Buslinien archive](https://services.geo.zg.ch/datarepo/Buslinien/data.zip) is preserved as [buslinien.zip](../data/zug-sources/buslinien.zip), SHA-256 **bcc43b676a4459a6cfa6b330fbe24dd7d66a84238aee4dd9e72a9b95628337a5**. It contains **175 LineStrings**, **29 distinct line labels** and **388 feature/line memberships**. Comma-separated labels identify shared segments, not complete directed route shapes. The archive's HTTP Last-Modified is **2025-09-18T12:11:55Z**; the GeoPackage's internal last_change is **2024-03-26T15:27:03.260Z**. Neither is a proven 2026 alignment date.

The complete current WFS tooltip layer and its independent hits count both contain **175** records. Every t_id, exact line-label string, vertex count and ordered LV95 coordinate matches the archive within **1 mm** (maximum ordinate difference **0.000956368 m**). WFS feature IDs differ from GeoPackage row IDs, so they are not used as a crosswalk. Raw [WFS](../data/zug-sources/wfs.gml), [hits](../data/zug-sources/wfs-hits.xml) and [capabilities](../data/zug-sources/capabilities.xml) are retained with retrieval times and hashes. The current WFS repeats old geometry; its retrieval date is not a new vintage. Planning/vehicle-length layers are not mixed into this source.

Credit for bus geometry: **Quelle: GIS Kanton Zug**. The [official terms](https://zg.ch/de/planen-bauen/geoinformation/geoinformationen-nutzen/nutzungsbedingungen) permit commercial and noncommercial use with source credit; no generic Creative Commons licence is assigned. [Terms snapshot](../data/zug-sources/terms.html). Canton boundary: current official swisstopo feature 9, retained losslessly as returned; its API attributes do not declare an edition. Municipal polygons: **swissBOUNDARIES3D 2026-01**, all eleven original GeoPackage rows retained in [municipality-rows.json.gz](../data/zug-sources/municipality-rows.json.gz). Credit: **© swisstopo**, [terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices).

The [ZVB 2026 line directory](https://www.zvb.ch/fahrplan/fahrplan-zvb-2026/) is retained for identity review. GTFS agency 839 maps to the explicitly listed ZVB source line labels; 801 maps only to PostAuto 73, 110 and 280. There is no prefix/substring matching, agency-wide geometry admission or automatic renumbering. Historic source line **528** has no annual Zug-calling GTFS route and is not silently assigned to 525/526.

## Federal rail expansion

The [preserved federal rail source](../data/zug-rail-sources/source.json) adds **529 Friday** and **431 Sunday** complete SBB/SOB trips to the bus baseline. Source credit: **© Federal Office of Transport (FOT)**. The source collection links [attribution terms](https://opendata.swiss/terms-of-use/#terms_by); its literal STAC licence field is retained as proprietary, without substituting a Creative Commons licence. The [catalogue](../data/zug-rail-sources/catalogue.json), [collection metadata](../data/zug-rail-sources/collection.json) and [original compressed XTF](../data/zug-rail-sources/network.xtf.gz) are preserved. [Official federal dataset](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz).

The XML SHA-256 is **2895811c6c338cdc3d32e946d2861ce58ca72ddde7d700fe9b73f2c393f7b828**, verified against the published multihash. Catalogue datetime is **2021-07-06T00:00:00Z**, asset-updated timestamp **2025-01-18T04:23:13.735821Z**, catalogue checked **2026-09-08**. All **3,424 source segments** carry an internal Stand of **2021-07-06**. These timestamps do not prove September 2026 validity. The audit records every segment's gauge, infrastructure operator, validity fields, endpoint attachment and admission disposition: **1,814** segments enter the candidate graph, **1,604** fail standard-gauge selection and **6** exceed the source topology attachment limit. Funiculars are not in this dataset.

The adapter admits only explicitly inventoried SBB/SOB route identities and **mm1435** source segments. It uses exact Swiss operating-point numbers, rejecting missing/ambiguous identities; there is no name or nearest-station fallback. Source endpoints connect through declared node references with attachments at most **120 m**; GTFS stations may attach to their exact operating point within **350 m**. Source linework is simplified at **5 m in LV95** and transformed by the existing parser to six-decimal WGS84 coordinates. These operating-point and station connectors are inferred geometry.

Each adjacent-call search blocks all other known scheduled operating points in the full pattern, preventing a shortcut through a later or earlier call. The detour limit is **max(3,000 m, 4.5 × direct distance)**, including station attachments. Each accepted pair retains ordered source segment IDs and node references. Rail contexts with different complete stop sequences remain distinct in the cache and audit. This validates numerical corridor continuity and stop order, not actual running-track choice, freight/passenger access rights, temporary diversions or observed movement. International trip calls are retained in full even when their missing foreign geometry causes exclusion.

## SBB graphical rail supplement

The [SBB graphical network](https://data.sbb.ch/explore/dataset/linie-mit-polygon/) provides a separate official source for two failed corridors. Four selected source records retain their full curves, with no edits to the federal graph or its gauge attributes. This adds **62 Friday / 66 Sunday trips**, completing every fixture pattern of **S26, RE6 and IR75**. Their full trips and all out-of-canton calls are retained.

The source investigation distinguishes three findings:

- The original federal segment **ch14uvag00087837**, Däniken SO–Däniken Ost, carries **mm1000** over kilometre 45.673–46.100. The [current federal API response](../data/zug-sbb-rail-sources/federal-daeniken.json) repeats that value. The existing standard-gauge filter correctly excludes it. SBB's graphical records classify the same corridor as **N**, explicitly defined by the [retained schema](../data/zug-sbb-rail-sources/metadata.json) as normal gauge. The alternative uses complete SBB DK–DKO and DKO–SCOE curves on infrastructure line 540, leaving the conflicting federal record unchanged.
- SBB line 822 supplies continuous **KR–KRGR–KODB** geometry, including the crossing from Kreuzlingen Grenze into Konstanz. The policy explicitly crosswalks GTFS operating-point IDs **8506131 / 8014586** to SBB codes **KR / KODB**. The federal source's lack of a foreign operating point is preserved as the failed primary attempt.
- The separate SBB dataset named **linie** represents line 540 with only two endpoint coordinates; it is not usable alignment evidence. The graphical dataset also contains schematic foreign records: the Como S. Giovanni–Chiasso Olimpino I portion has only two vertices. Such records cannot close EC's full Chiasso–Como gap. Both rejected source investigations remain preserved.

The acquisition retains all **seven** line-540 records and all **59** records returned by the Konstanz/Como search, with returned totals checked against page lengths and duplicate identities rejected. Every one of these 66 records has an inventory entry; only four are selected. Source keys combine infrastructure line number, start/end operating-point codes and kilometre interval. No public-service line-number guess selects geometry. Both selected corridors are contiguous at exactly equal source endpoint coordinates; geometric crossings or proximity cannot join them.

| Infrastructure line | From → to | Source vertices | Selected corridor |
| --- | --- | --- | --- |
| 540 | Däniken Ost → Schönenwerd SO | 204 | daeniken-schoenenwerd |
| 540 | Däniken SO → Däniken Ost | 44 | daeniken-schoenenwerd |
| 822 | Kreuzlingen Grenze → Konstanz | 43 | kreuzlingen-konstanz |
| 822 | Kreuzlingen → Kreuzlingen Grenze | 76 | kreuzlingen-konstanz |

Däniken–Schönenwerd uses reviewed GTFS IDs **8502111 / 8502112** and SBB codes **DK / SCOE**. The policy allows only SBB agency 11's exact S26/RE6 route records there and its exact IR75 route record at Konstanz. Ordered timetable calls orient the full source curve. Source features provide short operating-point codes; the numeric GTFS-to-code mappings are explicit reviewed crosswalks, not source-supplied numeric joins or name-based fallback. Endpoint connectors are measured and must stay within **100 m**, stricter than the base rail adapter's 350 m limit. Paths must remain below **max(1,500 m, twice the direct distance)**. Each pair retains source keys, corridor, endpoint attachment lengths, numeric stop identities, a geometry hash and its original federal failure. Successful pre-existing pair paths remain unchanged. These are inferred operating-point/platform attachments, not certified running-track choices or observed movements.

[Source catalogue](../data/zug-sbb-rail-sources/sources.json), [line 540 records](../data/zug-sbb-rail-sources/line540.json), [foreign review](../data/zug-sbb-rail-sources/foreign-review.json), [rejected schematic line](../data/zug-sbb-rail-sources/schematic-line540.json) and [terms snapshot](../data/zug-sbb-rail-sources/terms.html) are retained with original URLs and hashes. Publisher: **SBB Infrastructure**. Credit: **SBB Infrastructure / data.sbb.ch**. Metadata rights allow commercial and noncommercial use with reference required (terms_by); [SBB terms](https://data.sbb.ch/page/licence/) require citing data.sbb.ch and publishing derived work under the user's own authorship. The regional feed is a dated Gleislicht derivation.

Graphical dataset modified timestamp: **2026-07-29T06:16:28+00:00**; data processed: **2026-09-02T03:01:34+00:00**; metadata processed: **2026-09-08T03:00:20.208000+00:00**; retrieved: **2026-09-08**. These are publication/processing timestamps, not individual alignment survey dates or a guarantee that September diversions are represented. Any refresh must preserve new evidence and revalidate the explicit crosswalks and source paths.

## Zugerbergbahn federal alignment

The federal cableway layer adds **72 Friday** and **70 Sunday** complete Zugerbergbahn trips, covering both directed two-stop patterns on each civil day. Admission requires the exact GTFS route 93-256-6-j26-1, agency 158, line 2566 and type 1400, mapped to installation **61.051**, operator **ZBB**, LineString **676**. The entire bounded API response contains this line and its two terminal point features, **3254 / 3248**; every feature is retained and inventoried. The original 22-vertex WGS84 curve remains intact. No intermediate stop, interpolated elevation, cable sag or observed vehicle position is invented.

The two source operating-point numbers **8502291 (Schönegg)** and **8502292 (Zugerberg)** match the GTFS DiDok identities exactly. Both source station coordinates equal the line's endpoints. Each path includes an explicit short connector from its exact GTFS stop coordinate to that endpoint (approximately 1.3 m, with a **25 m** rejection limit), the full curve in source-call order, then the connector to the other GTFS stop. Reverse calls reverse the curve; names and nearest-station guesses cannot select an installation. Length must stay below **max(1,500 m, twice the direct distance)**. Each accepted pair records installation, feature, operating-point identities, attachment lengths and a geometry hash.

[Original API response](../data/zug-mountain-sources/identify.json), [layer schema](../data/zug-mountain-sources/layer.json), [collection metadata](../data/zug-mountain-sources/collection.json) and [source catalogue with query URLs and hashes](../data/zug-mountain-sources/sources.json) are retained. Retrieval: **2026-09-08**. Collection temporal date: **2025-11-07T00:00:00Z**; collection updated: **2026-01-29T06:50:29.460765Z**. The API features have no individual source date; these collection timestamps do not establish September 2026 alignment validity. Attribution: **© Federal Office of Transport (FOT)**. The collection's literal licence is **proprietary**, with linked [attribution terms](https://opendata.swiss/en/terms-of-use/#terms_by). No alternate generic licence is assigned. [Official collection](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.seilbahnen-bundeskonzession).

## Neighbouring official bus source

Five exact-identity Luzern bus features were evaluated against the entire Zug timetable scope. The [supplement catalogue](../data/zug-luzern-sources/sources.json) preserves original URL, retrieval time and SHA-256 for the complete **114-feature** upstream page, its independent ID list, the operator enumeration, metadata and terms. The five selected features are checked byte-for-value against that page; no geometry edits or new connections are introduced. Source vintage is **26 May 2026**, all five FP_JAHR values are **2026**, and acquisition was **8 September 2026**. This is a reviewed source vintage, not a guarantee that every September diversion is represented.

Credit: **© rawi Kanton Luzern; © Verkehrsverbund Luzern**, **Open-By**. [Official product metadata](https://daten.geo.lu.ch/produkt/oevxxxxx_col_v5), [terms](https://geoportal.lu.ch/Nutzungsbedingungen). The service performs EPSG:2056 to WGS84 conversion; its returned GeoJSON coordinates are retained without simplification. Local TU codes 11/3/4 map explicitly to GTFS agencies 820/801/839; TU=11 must not be mistaken for SBB agency 11.

Successful original Zug pairs remain unchanged. Only a failed pair can use the entire adjacent-call path of its exact mapped Luzern operator/line. The tolerance remains 120 m; source graphs are never spliced at a midpoint or joined to fill a gap. Source changes occur only at preserved GTFS stops, whose coordinates anchor both paths. Every attempt retains its original Zug failure and the supplemental result, including failures. This adds **156 Friday trips** and **94 Sunday trips** to the preceding bus/rail release (2,767 / 1,680 trips).

| Source feature | Agency / line | Friday trips using source | Sunday trips using source | Disposition |
| --- | --- | --- | --- | --- |
| A23 | 820 / 23 | 24 | 0 | complete trips admitted |
| B073 | 801 / 73 | 80 | 66 | complete trips admitted |
| B110 | 801 / 110 | 52 | 28 | complete trips admitted |
| B653 | 839 / 653 | 126 | 60 | complete trips admitted |
| B973 | 801 / N73 | 0 | 2 | complete trips admitted |

For 73, the Luzern corridor supplies the missing Luzern end while existing Zug geometry supplies Rotkreuz stop pairs that fail projection against Luzern alone. For 110, the supplement supplies the Hochdorf station pair. Line 23 has no original Zug line identity and uses the complete mapped Luzern route. The official source still fails for 653 around Hohle Gasse/Ebnet and the weekday Plaza/station branch, and for N73 around Luzernerhof/Brüelstrasse. These failed official attempts remain in the inventory; the separately reviewed OSM fallback below completes those patterns. Trip counts in this table mean use of successful Luzern segments and overlap the OSM-assisted trip counts; they must not be added together. Source-feature, route, per-day attempted/matched pair and occurrence totals are retained in supplementInventory.

## Complete-pattern road fallback for 653 and N73

The [Zug road cache](../data/zug-road-cache.json) is produced from a fresh, scoped matcher run, not a reuse of a successful long branch for an untested short branch. It covers **all six complete 653 patterns** and **both N73 patterns** across the two civil dates, including the Küssnacht station/Plaza variants and both full Weggis extensions. All ordered platform identities, coordinates and cross-canton calls enter the matcher. Policy pins exact route, agency and GTFS type (653: 700; N73: 705). A missing or changed complete pattern rejects cache reuse.

Source: **Geofabrik Switzerland 2026-09-02 plus OSM border extract retrieved 2026-09-08**; OSM extract SHA-256 **d5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b**. Attribution **© OpenStreetMap contributors**, **ODbL-1.0**, [licence and attribution](https://www.openstreetmap.org/copyright), [Geofabrik source](https://download.geofabrik.de/europe/switzerland.html). These are inferred road paths, not operator-verified route shapes or proof that September diversions are represented. The new matcher run was made **8 September 2026**, using pfaedle commit **99f2cd466696ecc6bdb73b2b3bb9008557fcb84a**, bus mode, explicit fallback warnings and disabled trie aggregation. The matcher configuration and per-agency original input, warning log, shapes, trip/stop-time mapping and run hashes are retained in [road evidence](../data/zug-road-evidence/). The pinned PBF and matcher binary are needed only to rerun matching; ordinary validation reimports the retained matcher outputs offline.

Only pairs failing both available official sources can use the road fallback. Every complete input-pattern occurrence of a route-specific directed stop pair must produce a valid **byte-identical path**; one failed or conflicting occurrence rejects the shared candidate. Import rejects matcher fallback hops, distant endpoints, collapsed paths and excess detours. Final paths keep the existing **max(1,200 m, 4.5 × direct distance)** ceiling; imported linework has a 5 m simplification tolerance and is anchored to the exact timetable stop coordinates. Source changes occur at GTFS calls. The audit retains the original Zug failure and the Luzern failure under officialFailure for every road attempt, alongside road pattern IDs, context counts and geometry hashes. Existing successful official pair hashes were compared with the preceding committed release and remain unchanged.

This admits **126 additional Friday trips** (all 653), and **62 additional Sunday trips** (60 on 653 and two N73). Both N73 trips belong to the preceding service day and intersect the Sunday civil day; neither is converted into a new Sunday service departure. Both directions are represented, with **six additional Friday directed patterns** and **four Sunday patterns**. Six Friday and four Sunday directed pairs use roads; two 653 pairs occur on both dates, so there are eight distinct road pairs overall.

| Line | From → to | Inferred length | Complete-pattern contexts |
| --- | --- | --- | --- |
| 653 | Immensee, Hohle Gasse → Küssnacht am Rigi, Ebnet | 809.3 m | 3 |
| 653 | Küssnacht am Rigi, Hauptplatz → Küssnacht am Rigi, Plaza | 332.1 m | 1 |
| 653 | Küssnacht am Rigi, Plaza → Küssnacht am Rigi, Bahnhof | 667.8 m | 1 |
| 653 | Küssnacht am Rigi, Bahnhof → Küssnacht am Rigi, Plaza | 643.2 m | 1 |
| 653 | Küssnacht am Rigi, Plaza → Küssnacht am Rigi, Hauptplatz | 320.9 m | 1 |
| 653 | Küssnacht am Rigi, Ebnet → Immensee, Hohle Gasse | 777.3 m | 3 |
| N73 | Luzern, Luzernerhof → Luzern, Brüelstrasse | 2289.4 m | 1 |
| N73 | Luzern, Brüelstrasse → Luzern, Haldensteig | 1890.9 m | 1 |

## Remaining bus branches and night services

A second, separately pinned [road cache](../data/zug-road-expansion-cache.json) and [matcher evidence](../data/zug-road-expansion-evidence/) cover **all 19 remaining incomplete bus route records**: 18 ZVB routes and GTFS agency 7231's EV1 replacement bus. The preparation retains **73 complete patterns** (71 ZVB, two EV1), including already-admitted branches on those routes. All original calls, coordinates, carry-in service dates and call rules survive admission. Road source date, ODbL attribution, binary/configuration hashes, import limits and consensus rules are the same as above. Each agency was independently matched on **8 September 2026**. The two road cache scopes must be disjoint; the original 653/N73 evidence remains unchanged.

This adds **304 Friday** and **202 Sunday** trips, raising the feed to **3'487 / 2'174**. Road paths replace only failed official adjacent-call paths, so a complete trip may still use successful official geometry elsewhere. Every previously matched pair from the preceding committed feed retains its geometry hash. Scope here is the two source civil dates, not a claim of seasonal bus completeness or verified September diversions.

| Agency / line | Friday admitted / source | Sunday admitted / source | Remaining reasons |
| --- | --- | --- | --- |
| 839 / 525 | 36 / 36 | 36 / 36 | none on fixtures |
| 839 / 526 | 11 / 11 | 0 / 0 | none on fixtures |
| 839 / 602 | 98 / 98 | 76 / 76 | none on fixtures |
| 839 / 604 | 66 / 133 | 38 / 76 | road-matcher-rejected |
| 839 / 609 | 84 / 84 | 53 / 53 | none on fixtures |
| 839 / 619 | 30 / 38 | 16 / 25 | road-matcher-rejected |
| 839 / 626 | 8 / 8 | 0 / 0 | none on fixtures |
| 839 / 627 | 18 / 18 | 0 / 0 | none on fixtures |
| 839 / 631 | 97 / 97 | 77 / 77 | none on fixtures |
| 839 / 632 | 86 / 86 | 0 / 0 | none on fixtures |
| 839 / 648 | 135 / 135 | 74 / 74 | none on fixtures |
| 839 / 652 | 64 / 64 | 0 / 0 | none on fixtures |
| 7231 / EV1 | 0 / 0 | 6 / 6 | none on fixtures |
| 839 / N1 | 0 / 0 | 6 / 6 | none on fixtures |
| 839 / N2 | 0 / 0 | 6 / 6 | none on fixtures |
| 839 / N3 | 0 / 0 | 6 / 6 | none on fixtures |
| 839 / N4 | 0 / 0 | 6 / 6 | none on fixtures |
| 839 / N5 | 0 / 0 | 7 / 7 | none on fixtures |
| 839 / N6 | 0 / 0 | 3 / 6 | road-pattern-dependent-path |

The remaining bus exclusions are specific:

- **604, Zug Grienbach:** the official stop projection fails at roughly 155 m. The road matcher places Grienbach **188.7 m** from its returned shape, beyond the unchanged 120 m limit. Both adjacent pairs fail; **67 Friday / 38 Sunday** complete trips remain excluded.
- **619, Unterägeri Zentrum–Chlösterli, both directions:** pfaedle reports fallback hops. Those inferred direct hops are rejected during import; **8 Friday / 9 Sunday** trips remain excluded. Other 619 patterns pass (**30 / 16 trips**).
- **N6, Hünenberg Dorf–Sins Bahnhof:** complete input patterns disagree on this directed pair's road path. Consensus rejects it, retaining **3 Sunday excluded trips**, while three other N6 trips pass. A convenient successful branch cannot substitute for this conflicting context.

The raw road run also rejects two Walchwil 626 segments (missing shape and a 149.2 m snap), but the official Zug source already supplies those pairs successfully. The road fallback supplies only its different, previously collapsed official pair; all eight complete Friday 626 trips therefore pass the combined source checks. This distinction is preserved in the road cache's import report and the feed's per-pair provenance.

## Geometry and directed stop-pattern method

Decode the original EPSG:2056 GeoPackage with strict geometry/schema checks. Transform XY with the existing swisstopo approximate LV95-to-WGS84 polynomial at full floating precision; no simplification. Graph identity uses seven decimal places. Shared source vertices connect only within the exact mapped line. Geometric crossings do not create junctions. The source has no direction attribute: shortest connected source corridors are oriented by the ordered GTFS calls and remain inferred alignments.

Every pair must pass **120 m** maximum stop projection, connectivity, and a detour bound of **max(1,200 m, 4.5 × direct distance)**. Alternative source-part projections may add at most **5 m** to the nearest projection. Paths include the short stop-to-source projection connectors; those are inferred access geometry, not measured trajectories. Collapsed paths fail. Full repeated-stop sequences, branches, direction_id and pickup/drop-off rules form distinct patterns. A failure in any pair excludes the entire pattern. Prior-arrangement pickup/drop-off codes 2/3 also exclude a pattern from unconditional animation; none occur in these fixtures.

Three explicitly reviewed source discontinuities are joined by short inferred connectors, pinned to exact source feature IDs and vertex indices. Each includes an existing source endpoint, stays within identical line memberships, connects distinct original components and is less than one metre. No general nearest-neighbour gap filling is enabled.

| Join | Lines | Length | Source vertices |
| --- | --- | --- | --- |
| riedmatt | 606, 607, 616 | 0.127 m | feature 133 / vertex 0 → feature 72 / vertex 0 |
| birkenhalde | 606, 616, 636 | 0.668 m | feature 80 / vertex 29 → feature 79 / vertex 20 |
| cham-bahnhof | 641 | 0.602 m | feature 85 / vertex 142 → feature 149 / vertex 25 |

The audit and feed metadata retain the join policy; affected pairs carry geometryRepairIds and inferredJoinMetres. **570 Friday trips** and **240 Sunday trips** use these connectors. Their small lengths do not establish lawful street direction. The initial bus-only release admitted 1,668 Friday trips and 1,009 Sunday trips without these connectors; the joins raised its bus admission to 2,238 and 1,249. The subsequent rail expansion is counted separately below.

## Weekday and Sunday results

Calendar exceptions and preceding service-day spillover are applied. The civil day is 00:00–24:00 Europe/Zurich. Source identities and negative carry-in times are preserved; no source call is trimmed. Friday after-midnight night departures belonging to Friday service fall on Saturday's civil day; Sunday's N1–N6 and N73 departures include Saturday service carry-in. Calendar active-source counts therefore differ from civil-day counts. Frequency templates would retain source-anchored headway semantics; both selected fixtures contain zero representative headway trips.

| Measure | 2026-09-04 | 2026-09-06 |
| --- | --- | --- |
| Civil-day trips | 3'597 | 2'263 |
| Admitted / excluded trips | 3'487 / 110 | 2'174 / 89 |
| Admitted / all directed patterns | 345 / 370 | 287 / 314 |
| Matched / all routing-context pairs | 3639 / 3677 (98.97%) | 3244 / 3287 (98.69%) |
| Fully matched / all unique directed route-stop pairs | 1648 / 1675 | 1642 / 1676 |
| Matched / all scheduled segment occurrences | 51'471 / 51'680 (99.60%) | 33'085 / 33'257 (99.48%) |
| All / admitted carry-in trips | 68 / 67 | 133 / 129 |

Rail pair routing depends on the complete ordered pattern, so days[].directedPairs and group pair counts include pattern context for rail. Bus pairs retain the route/from/to key. The separate uniqueDirectedRouteStopPairs count collapses context; fullyMatchedUniqueDirectedRouteStopPairs requires success in every tested context. These denominators must not be confused when comparing the original bus-only release with this expansion. Matched occurrences include good pairs on ultimately excluded patterns. They are not a percentage of admitted full trips. All modes and excluded operators stay in the denominator. Every emitted trip has a non-null, correctly oriented path for every adjacent source call.

| Date | Agency / mode | Trips admitted / all | Patterns admitted / all | Pairs matched / all | Occurrences matched / all |
| --- | --- | --- | --- | --- | --- |
| 2026-09-04 | 11:rail — Schweizerische Bundesbahnen SBB | 573 / 599 | 194 / 207 | 2357 / 2370 | 8158 / 8184 |
| 2026-09-04 | 82:rail — Schweizerische Südostbahn (sob) | 18 / 18 | 11 / 11 | 184 / 184 | 324 / 324 |
| 2026-09-04 | 820:bus — Verkehrsbetriebe Luzern AG | 24 / 24 | 2 / 2 | 38 / 38 | 456 / 456 |
| 2026-09-04 | 839:bus — Zugerland Verkehrsbetriebe | 2616 / 2691 | 120 / 124 | 901 / 905 | 39212 / 39354 |
| 2026-09-04 | 158:mountain — Zugerbergbahn | 72 / 72 | 2 / 2 | 2 / 2 | 72 / 72 |
| 2026-09-04 | 186:boat — Schifffahrtsgesellschaft für den Zugersee AG | 0 / 6 | 0 / 6 | 0 / 14 | 0 / 19 |
| 2026-09-04 | 179:boat — Ägerisee Schifffahrt AG | 0 / 3 | 0 / 2 | 0 / 7 | 0 / 22 |
| 2026-09-04 | 801:bus — PostAuto AG | 184 / 184 | 16 / 16 | 157 / 157 | 3249 / 3249 |
| 2026-09-06 | 11:rail — Schweizerische Bundesbahnen SBB | 480 / 506 | 167 / 178 | 1968 / 1979 | 7305 / 7331 |
| 2026-09-06 | 82:rail — Schweizerische Südostbahn (sob) | 17 / 17 | 12 / 12 | 204 / 204 | 304 / 304 |
| 2026-09-06 | 839:bus — Zugerland Verkehrsbetriebe | 1469 / 1519 | 87 / 93 | 846 / 851 | 22880 / 22968 |
| 2026-09-06 | 7231:bus — SBB Infrastruktur AG Bahnersatz | 6 / 6 | 2 / 2 | 2 / 2 | 6 / 6 |
| 2026-09-06 | 158:mountain — Zugerbergbahn | 70 / 70 | 2 / 2 | 2 / 2 | 70 / 70 |
| 2026-09-06 | 186:boat — Schifffahrtsgesellschaft für den Zugersee AG | 0 / 10 | 0 / 8 | 0 / 20 | 0 / 36 |
| 2026-09-06 | 179:boat — Ägerisee Schifffahrt AG | 0 / 3 | 0 / 2 | 0 / 7 | 0 / 22 |
| 2026-09-06 | 801:bus — PostAuto AG | 132 / 132 | 17 / 17 | 222 / 222 | 2520 / 2520 |

Failures are also broken down by operator/mode, reason, unique directed route-stop pair, scheduled occurrence, affected pattern and trip in days[].groups[].failures. A trip can have several reasons; affected-trip counts across reasons must not be summed.

## All municipalities

Counts overlap: a whole trip or annual route can serve several municipalities. These rows must not be summed into a canton total. Stop counts include uncalled source stop records. Source polygons retain holes and all parts; all 945 canton stop records have municipal membership.

| Municipality | Source stops | Annual route records | Friday admitted / all trips | Sunday admitted / all trips |
| --- | --- | --- | --- | --- |
| Risch | 97 | 31 | 895 / 897 | 489 / 496 |
| Hünenberg | 42 | 7 | 538 / 538 | 237 / 240 |
| Neuheim | 22 | 3 | 183 / 183 | 83 / 83 |
| Steinhausen | 41 | 9 | 514 / 514 | 253 / 253 |
| Oberägeri | 89 | 8 | 429 / 432 | 300 / 303 |
| Baar | 164 | 25 | 1196 / 1263 | 759 / 797 |
| Zug | 262 | 47 | 1885 / 1984 | 1284 / 1360 |
| Menzingen | 33 | 5 | 271 / 271 | 197 / 197 |
| Cham | 109 | 17 | 919 / 922 | 472 / 481 |
| Walchwil | 59 | 5 | 126 / 128 | 84 / 88 |
| Unterägeri | 27 | 6 | 297 / 308 | 213 / 225 |

Neuheim now has admitted Sunday service: road inference completes 631 and N2 patterns beyond the old official line geometry. Municipality counts include full trips calling in each area and may overlap across municipalities.

## Complete annual route admission/exclusion inventory

Each row is an exact GTFS route_id, not a unique passenger-facing line. Counts are admitted/all civil-day trips; “inactive” means no trip overlaps that day, not nonexistent or excluded from the annual census.

| GTFS route ID | Agency | Line / mode | Annual trips | Friday | Sunday | Failure reasons |
| --- | --- | --- | --- | --- | --- | --- |
| 91-1-A-j26-1 | 11 | S1 / rail | 2268 | 153/153 | 84/84 | — |
| 91-2-C-j26-1 | 11 | S2 / rail | 343 | 68/68 | 40/40 | — |
| 91-2-G-j26-1 | 11 | IC2 / rail | 802 | 23/23 | 19/19 | — |
| 91-2-P-j26-1 | 11 | RE2 / rail | 72 | inactive | inactive | — |
| 91-21-D-j26-1 | 11 | IC21 / rail | 17 | inactive | inactive | — |
| 91-24-j26-1 | 11 | S24 / rail | 1524 | 81/81 | 72/72 | — |
| 91-26-j26-1 | 11 | S26 / rail | 2168 | 80/80 | 80/80 | — |
| 91-2A-Y-j26-1 | 11 | EC / rail | 682 | 0/26 | 0/26 | rail-no-exact-operating-point |
| 91-2L-Y-j26-1 | 11 | RE / rail | 59 | 1/1 | 1/1 | — |
| 91-35-Y-j26-1 | 11 | IR / rail | 132 | 6/6 | 1/1 | — |
| 91-46-C-j26-1 | 11 | IR46 / rail | 28 | inactive | 2/2 | — |
| 91-46-j26-1 | 82 | IR46 / rail | 678 | 18/18 | 17/17 | — |
| 91-5-C-j26-1 | 11 | S5 / rail | 1177 | 83/83 | 84/84 | — |
| 91-5-G-j26-1 | 11 | SN5 / rail | 1 | inactive | inactive | — |
| 91-5F-Y-j26-1 | 11 | IC / rail | 227 | inactive | 5/5 | — |
| 91-5G-Y-j26-1 | 11 | EXT / rail | 24 | 1/1 | inactive | — |
| 91-6-W-j26-1 | 11 | RE6 / rail | 68 | inactive | 6/6 | — |
| 91-70-A-j26-1 | 11 | IR70 / rail | 1635 | 37/37 | 37/37 | — |
| 91-75-j26-1 | 11 | IR75 / rail | 1602 | 40/40 | 40/40 | — |
| 91-A6-Y-j26-1 | 82 | EXT / rail | 10 | inactive | inactive | — |
| 91-AI-Y-j26-1 | 11 | EXT / rail | 8 | inactive | inactive | — |
| 91-AP-Y-j26-1 | 11 | EXT / rail | 3 | inactive | inactive | — |
| 91-AS-Y-j26-1 | 11 | EXT / rail | 1 | inactive | inactive | — |
| 91-AW-Y-j26-1 | 11 | EXT / rail | 8 | inactive | 1/1 | — |
| 91-D8-Y-j26-1 | 11 | S / rail | 84 | inactive | inactive | — |
| 91-N7-j26-1 | 11 | N7 / rail | 134 | inactive | 8/8 | — |
| 91-VAE-j26-1 | 82 | VAE / rail | 42 | inactive | inactive | — |
| 92-23-j26-1 | 820 | 23 / bus | 44 | 24/24 | inactive | — |
| 92-525-j26-1 | 839 | 525 / bus | 108 | 36/36 | 36/36 | — |
| 92-526-j26-1 | 839 | 526 / bus | 22 | 11/11 | inactive | — |
| 92-601-A-j26-1 | 839 | 601 / bus | 382 | 140/140 | 115/115 | — |
| 92-602-A-j26-1 | 839 | 602 / bus | 257 | 98/98 | 76/76 | — |
| 92-602-C-j26-1 | 839 | 602 / bus | 1 | 1/1 | inactive | — |
| 92-603-B-j26-1 | 839 | 603 / bus | 414 | 148/148 | 127/127 | — |
| 92-604-B-j26-1 | 839 | 604 / bus | 348 | 66/133 | 38/76 | road-matcher-rejected |
| 92-605-A-j26-1 | 839 | 605 / bus | 128 | 50/50 | 37/37 | — |
| 92-606-j26-1 | 839 | 606 / bus | 392 | 145/145 | 115/115 | — |
| 92-607-j26-1 | 839 | 607 / bus | 214 | 115/115 | inactive | — |
| 92-609-j26-1 | 839 | 609 / bus | 192 | 84/84 | 53/53 | — |
| 92-610-A-j26-1 | 839 | 610 / bus | 172 | 60/60 | 50/50 | — |
| 92-611-B-j26-1 | 839 | 611 / bus | 764 | 143/143 | 117/117 | — |
| 92-612-C-j26-1 | 839 | 612 / bus | 31 | 31/31 | inactive | — |
| 92-613-C-j26-1 | 839 | 613 / bus | 325 | 129/129 | 71/71 | — |
| 92-614-j26-1 | 839 | 614 / bus | 318 | 66/66 | 27/27 | — |
| 92-616-A-j26-1 | 839 | 616 / bus | 62 | 46/46 | inactive | — |
| 92-619-j26-1 | 839 | 619 / bus | 88 | 30/38 | 16/25 | road-matcher-rejected |
| 92-626-A-j26-1 | 839 | 626 / bus | 8 | 8/8 | inactive | — |
| 92-627-j26-1 | 839 | 627 / bus | 18 | 18/18 | inactive | — |
| 92-631-A-j26-1 | 839 | 631 / bus | 250 | 97/97 | 77/77 | — |
| 92-632-j26-1 | 839 | 632 / bus | 136 | 86/86 | inactive | — |
| 92-634-j26-1 | 839 | 634 / bus | 248 | 97/97 | 76/76 | — |
| 92-636-j26-1 | 839 | 636 / bus | 283 | 125/125 | 48/48 | — |
| 92-641-A-j26-1 | 839 | 641 / bus | 350 | 139/139 | 77/77 | — |
| 92-642-j26-1 | 839 | 642 / bus | 250 | 97/97 | 71/71 | — |
| 92-643-j26-1 | 839 | 643 / bus | 362 | 135/135 | 74/74 | — |
| 92-648-j26-1 | 839 | 648 / bus | 284 | 135/135 | 74/74 | — |
| 92-651-j26-1 | 839 | 651 / bus | 176 | 90/90 | inactive | — |
| 92-652-A-j26-1 | 839 | 652 / bus | 118 | 64/64 | inactive | — |
| 92-653-j26-1 | 839 | 653 / bus | 314 | 126/126 | 60/60 | — |
| 92-A04-R-j26-1 | 7231 | EV1 / bus | 10 | inactive | inactive | — |
| 92-A0A-N-j26-1 | 7231 | EV2 / bus | 1 | inactive | inactive | — |
| 92-A0A-W-j26-1 | 158 | EV1 / bus | 36 | inactive | inactive | — |
| 92-EV1-Z-j26-1 | 7231 | EV1 / bus | 203 | inactive | 6/6 | — |
| 92-EV2-S-j26-1 | 7231 | EV2 / bus | 5 | inactive | inactive | — |
| 92-N1-D-j26-1 | 839 | N1 / bus | 6 | inactive | 6/6 | — |
| 92-N2-D-j26-1 | 839 | N2 / bus | 6 | inactive | 6/6 | — |
| 92-N3-E-j26-1 | 839 | N3 / bus | 6 | inactive | 6/6 | — |
| 92-N4-C-j26-1 | 839 | N4 / bus | 6 | inactive | 6/6 | — |
| 92-N5-A-j26-1 | 839 | N5 / bus | 8 | inactive | 7/7 | — |
| 92-N6-A-j26-1 | 839 | N6 / bus | 7 | inactive | 3/6 | road-pattern-dependent-path |
| 93-256-6-j26-1 | 158 | 2566 / mountain | 71 | 72/72 | 70/70 | — |
| 94-366-0-j26-1 | 186 | 3660 / boat | 10 | 0/6 | 0/10 | no-reviewed-boat-geometry |
| 94-366-1-j26-1 | 179 | 3661 / boat | 3 | 0/3 | 0/3 | no-reviewed-boat-geometry |
| 96-180-1-j26-1 | 801 | 280 / bus | 1244 | 52/52 | 36/36 | — |
| 96-352-3-j26-1 | 801 | 73 / bus | 143 | 80/80 | 66/66 | — |
| 96-357-7-j26-1 | 801 | 110 / bus | 53 | 52/52 | 28/28 | — |
| 96-359-A-j26-1 | 801 | N73 / bus | 2 | inactive | 2/2 | — |

Principal exclusions: complete EC patterns still lack credible alignment geometry for Chiasso–Como S. Giovanni; the preserved federal source has no exact foreign operating point and the examined SBB foreign record is schematic. S26, RE6 and IR75 are now complete on both fixtures through the explicit SBB supplement. Zugersee and Ägerisee still have no reviewed water-route geometry. Bus exclusions remain limited to the specific 604, 619 and N6 failures above. Full pair details, source call identities and stop names are in the machine audit.

## Every source line label

| Source label | Segment memberships | Mapped agencies | Annual matched route IDs |
| --- | --- | --- | --- |
| 73 | 4 | 801 | 96-352-3-j26-1 |
| 110 | 5 | 801 | 96-357-7-j26-1 |
| 280 | 5 | 801 | 96-180-1-j26-1 |
| 528 | 11 | unmapped | none |
| 601 | 24 | 839 | 92-601-A-j26-1 |
| 602 | 17 | 839 | 92-602-A-j26-1, 92-602-C-j26-1 |
| 603 | 24 | 839 | 92-603-B-j26-1 |
| 604 | 18 | 839 | 92-604-B-j26-1 |
| 605 | 16 | 839 | 92-605-A-j26-1 |
| 606 | 31 | 839 | 92-606-j26-1 |
| 607 | 19 | 839 | 92-607-j26-1 |
| 609 | 3 | 839 | 92-609-j26-1 |
| 610 | 3 | 839 | 92-610-A-j26-1 |
| 611 | 21 | 839 | 92-611-B-j26-1 |
| 612 | 15 | 839 | 92-612-C-j26-1 |
| 613 | 12 | 839 | 92-613-C-j26-1 |
| 614 | 14 | 839 | 92-614-j26-1 |
| 616 | 19 | 839 | 92-616-A-j26-1 |
| 626 | 4 | 839 | 92-626-A-j26-1 |
| 631 | 11 | 839 | 92-631-A-j26-1 |
| 632 | 13 | 839 | 92-632-j26-1 |
| 634 | 15 | 839 | 92-634-j26-1 |
| 636 | 16 | 839 | 92-636-j26-1 |
| 641 | 5 | 839 | 92-641-A-j26-1 |
| 642 | 13 | 839 | 92-642-j26-1 |
| 643 | 10 | 839 | 92-643-j26-1 |
| 648 | 14 | 839 | 92-648-j26-1 |
| 651 | 17 | 839 | 92-651-j26-1 |
| 653 | 9 | 839 | 92-653-j26-1 |

## Reproduction and verification

The durable source bytes and extracted two-day timetable are in the repository. No live service or credentials are needed for offline reproduction. Refreshing a source is a new review: preserve new bytes, reconcile versions, recheck terms and identity mapping, and update the pinned policy deliberately.

```sh
# Decode and reconcile the preserved archive and WFS; no network.
npm run data:zug:sources

# Optional full national re-census (requires the pinned archive).
npm run data:zug:census -- /private/tmp/GTFS_FP2026_20260902.zip \
  data/zug-sources/boundary.json data/zug-timetable.json.gz

npm run data:zug
npm run data:zug:check
npm run data:zug:report
python3 -m unittest discover -s scripts -p test_prepare_zug_sources.py
npx vitest run scripts/zug-sbb-rail-supplement.test.mjs scripts/zug-road-geometry.test.mjs scripts/luzern-road-geometry.test.mjs scripts/enrich-postbus-roads.test.mjs scripts/zug-mountain-geometry.test.mjs scripts/zug-region.test.mjs scripts/zug-bus-supplement.test.mjs scripts/zug-rail-geometry.test.mjs scripts/luzern-region.test.mjs \
  scripts/civil-day.test.mjs scripts/gtfs-frequencies.test.mjs
```

To regenerate only the scoped road evidence, prepare with the pinned timetable/policy, run the matcher for each listed agency, then import. Changing matcher outputs requires reviewing and updating the cache hash in policy; it never silently refreshes a committed source.

```sh
node scripts/zug-road-geometry.mjs prepare data/zug-timetable.json.gz data/zug-policy.json /private/tmp/zug-road-feed
# Repeat for agencies 839 and 801:
node scripts/match-postbus-roads.mjs --pfaedle /private/tmp/gleislicht-pfaedle/build/pfaedle \
  --osm /private/tmp/gleislicht-postbus-roads.osm.pbf --config data/zug-road-evidence/pfaedle.cfg \
  --feed /private/tmp/zug-road-feed/839 --output /private/tmp/zug-road-matched/839
node scripts/zug-road-geometry.mjs import /private/tmp/zug-road-feed /private/tmp/zug-road-matched \
  data/zug-road-cache.json data/zug-road-evidence
# The independent expansion uses policy key roadExpansion:
node scripts/zug-road-geometry.mjs prepare data/zug-timetable.json.gz data/zug-policy.json /private/tmp/zug-road-expansion-feed roadExpansion
# Match agencies 839 and 7231 into /private/tmp/zug-road-expansion-matched as above.
node scripts/zug-road-geometry.mjs import /private/tmp/zug-road-expansion-feed /private/tmp/zug-road-expansion-matched \
  data/zug-road-expansion-cache.json data/zug-road-expansion-evidence
```

The checker verifies source/policy/timetable hashes, annual census totals, all directed patterns including exclusions, all rematched pair hashes, source-specific bus alternatives, full road-pattern scope and retained matcher warning/shape replay, exact funicular installation/operating-point matches, selected SBB rail source records and rail pattern contexts, unique/context pair totals, operator and route aggregates, source call/timing replay, carry-in identities, path endpoints, morning membership and every chunk hash/length. Tests reject duplicate/truncated WFS responses, changed labels/coordinates, wrong operator joins, substring matching, arbitrary gaps/crossings, unreviewed topology joins and reversed or missing paths.

Remaining scope limits: two September dates do not validate winter, holiday, summer boat or all seasonal/engineering patterns. The old line geometry has no proven 2026 validity and has not been certified against street-direction restrictions or diversions. The feed is scheduled interpolation with explicit inferred projection/topology pieces. It is not observed vehicle movement. Full cantonal motion coverage remains incomplete.
