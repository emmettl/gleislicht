# Luzern cantonal transit source adapter and audit

Built on 8 September 2026, starting from [the national source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#lu). **The entire pinned national timetable was scanned for Luzern membership: 203 route records, 24 feed agencies and 100'275 annual trip records.** The delivered regional feeds contain **9'184 Friday and 7'008 Sunday journeys**, on 126 and 139 routes respectively. 158 distinct route records have an admitted pattern on at least one date.

Only complete directed stop patterns with usable geometry are admitted. This is a complete **inventory of the scoped archive**, and a measured **partial regional motion feed**. It is not complete cantonal geometry, year-round validation or direction-certified street routing. The underlying official linework is undirected; the validation below establishes ordered source-call compatibility and plausible connected corridors.

## Deliverables

- [Friday 4 September full-day manifest](../public/data/luzern-region/2026-09-04/luzern-region-day-manifest.json) and [morning snapshot](../public/data/luzern-region/2026-09-04/luzern-region-morning.json).
- [Sunday 6 September full-day manifest](../public/data/luzern-region/2026-09-06/luzern-region-day-manifest.json) and [morning snapshot](../public/data/luzern-region/2026-09-06/luzern-region-morning.json).
- [Machine-readable audit](../data/luzern-study-audit.json): every annual route, every source line, every fixture directed pattern and route-specific directed pair, with occurrences, admission, failures and source references.
- [Source snapshot catalogue](../data/luzern-sources/sources.json): raw GeoJSON pages, complete merged collections, object-ID responses, field/domain schemas, HTML metadata/terms and canton polygon, all hashed and retained in the repository.
- [Reviewed policy and operator crosswalk](../data/luzern-policy.json), [adapter](../scripts/luzern-line-geometry.mjs), [timetable census](../scripts/luzern-timetable.mjs), [builder](../scripts/build-luzern-region.mjs) and [independent artifact checker](../scripts/check-luzern-region.mjs).

The manifests use the existing network snapshot format with twelve two-hour chunks; chunk paths are relative to their manifest directory. They are data artifacts, not a new selectable UI study. Existing study selection, refresh and deployment are separate work. No website deployment is part of this data delivery.

## Canton and timetable scope

The geographical test is point-in-MultiPolygon against the complete swisstopo Luzern feature, including its separate pieces and holes. Its bounding box is only a prefilter. The census scans **34'499'152 national stop-time records**, selects trips with at least one source stop in the canton across **all** agencies and modes, then reads every call of fixture trips. It finds 3'245 in-canton GTFS stop records (including parent/platform records), of which 2'263 are called in the archive. Stop records are not unique physical stations.

This covers the agglomeration, Entlebuch, Sursee, Willisau, Seetal, Lake Lucerne and the Luzern shore of Hallwilersee. No vbl/PostAuto agency allowlist, tariff boundary or rectangular crop determines membership. Both bus replacement agencies, Pro Regio Huttwil, SGV, Hallwilersee and all represented mountain modes remain in the denominator. Source-only lines without a Luzern-calling GTFS route are explicitly listed below.

Every selected journey retains its cross-canton termini and all intermediate calls, even when the geometry ends earlier. No clipped trip is used to improve coverage. Services crossing the canton without a stop fall outside this passenger-service scope. St. Urban and St. Urban Ziegelei rail stops and the AVA Menziken corridor lie outside the polygon; their source lines remain in the source census, not silently admitted by a regional brand name. This does not establish a census of all real-world services absent from GTFS.

Fixtures are **Friday 2026-09-04** and **Sunday 2026-09-06**, in Europe/Zurich timetable time. Calendar exceptions are applied. Thursday 3 September and Saturday 5 September are also read for preceding-day trips crossing midnight. Trips ending after 24:00 keep their original times; the civil-day window defines visibility. A service labelled Friday in GTFS can depart after 24:00 and belong to Saturday's civil window. The per-route table therefore reports civil-day counts separately from the machine-readable active source-service-day counts.

Frequency templates are expanded on their source interval, with exact_times=0 marked as representative headway movements, never scheduled departures. The Hammetschwand lift supplies 1'020 such movements per fixture; none is admitted because its geometry is absent. GTFS pickup/drop-off rules are retained, and any pattern requiring prior arrangement is excluded from unconditional fixed departures. No reservation patterns were encountered on these two fixtures. The annual record census and these dates do not prove winter, summer-pass, holiday or special-event coverage.

## Source dates, coordinates and attribution

| Source | Vintage / retrieval distinction | SHA-256 |
| --- | --- | --- |
| National GTFS | Feed 20260902; valid 14 December 2025–12 December 2026 | `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e` |
| Luzern bus, 114 features | Metadata: 26 May 2026; FP_JAHR=2026 | `49a88e0544b8ea9067a930fc5b112c14672bcf68ad3bd99bd51c0c4243478e6f` |
| Luzern rail/mountain, 29 features | Metadata: 8 May 2026; FP_JAHR=2026 | `220a80a5c7fe5dad038afa332c5a22b4a9e64351e6b34552d4265ff4567134b6` |
| Luzern boat, 1 feature | Metadata: 5 August 2015; excluded from 2026 geometry | `4e26f54c91b7825f698dc729e119012ec9e9269b1507a5cea244a9f95748e95c` |
| Luzern regional stops, 1,448 records | Metadata: 6 August 2026 | `6675b987883da42703cce8645ae2b28cc71336d1ce5dcb7a491ad934e7ca13c6` |
| swisstopo canton polygon | Retrieved 2026-09-08T17:27:01.144Z; API response gives no source vintage | `efe44b38095a9c4b7d025199935e69bdfc027cc1baac32ee34354edfdb68a49e` |
| Federal rail network, 3,210 nodes / 3,424 segments | Used segment Stand: 6 July 2021; asset updated 18 January 2025; catalogue checked 8 September 2026 | `2895811c6c338cdc3d32e946d2861ce58ca72ddde7d700fe9b73f2c393f7b828` |

The cantonal source snapshot was acquired on 8 September 2026. Retrieval timestamps do not replace the layer dates. Line sources are EPSG:2056; the ArcGIS query transforms them to EPSG:4326. Matching uses those returned coordinates, metre-distance calculations, exact shared vertices keyed to seven decimal places, and output coordinates rounded to seven decimals. Cantonal paths are not simplified or joined by proximity. Five explicitly reviewed short gaps use exact edges copied from other lines in the same official bus source; their donor identities and coordinates are retained in the policy and feed metadata. Failed bus pairs additionally use the separately attributed OSM fallback described below. Failed rail pairs use the separately dated federal infrastructure fallback below. The boundary is the returned API polygon, with its supplied precision; an exact cadastral boundary survey is not implied.

**Attribution:** Timetable: **SBB / opentransportdata.swiss**. Cantonal data: **© rawi Kanton Luzern; © Verkehrsverbund Luzern**. Canton boundary: **© swisstopo**. Federal rail: **© Federal Office of Transport (FOT)**. Processed regional feeds and this audit are by **Gleislicht**. Cantonal [product metadata](https://daten.geo.lu.ch/produkt/oevxxxxx_col_v5) and [Open-By terms](https://geoportal.lu.ch/Nutzungsbedingungen) permit use with source attribution; the acquired pages are retained. The [national timetable terms](https://opentransportdata.swiss/en/terms-of-use/) require attribution, raw-data refresh and authorship of processed results. The [swisstopo terms](https://www.swisstopo.admin.ch/en/terms-and-conditions) govern the boundary. No blanket CC0 licence is assigned to the combined feed. Frozen fixtures are dated study artifacts, not a continuously refreshed live service.

The large national archive remains an external input, available at the [pinned download](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip); its hash is mandatory. Current cantonal APIs are not immutable, so reproduction should use the committed source snapshots, not a fresh download claimed to have the same bytes.

## Adapter and admission rules

Local TU enumeration values are decoded using each layer's saved domain. For example, **TU 11 means vbl and maps to GTFS agency 820**; it must not be confused with SBB's GTFS agency 11. The crosswalk keeps separate rail/bus identities for AVA and ASM. It strips only the documented bus prefix “Linie”, and joins exact operator, mode and displayed line. BLS S6's two source branches share the exact identity and graph. It does not borrow another operator's alignment because the line number matches.

Explicit reviewed aliases cover Tellbus 493, Zentralbahn IRLEX/LIX/IRLIX, SOB VAE, SBB N7 (source NEX), Vitznau cogwheel 82/88, Weggis cableway 2562, Sonnenberg 2515 and Gütsch 2510. The latter demonstrates source ownership versus timetable publishing: the source names Château Gütsch, while GTFS publishes it under vbl. TU=0 is not an operator; Sonnenberg is mapped by its explicit route and Kursbuch identity. Unresolved aliases remain excluded.

For each route and ordered platform pair the adapter projects stops onto that line's graph. It requires a connected path, endpoint gaps ≤120 m, path length ≤max(1,200 m, 4.5 × direct distance), and a noncollapsed path (≥1 m and, for stop separation over 30 m, at least half that separation). Nearby alternative line parts may be tried only within 5 m of the closest projection and within the same endpoint limit. Projected platform connectors are explicit in the output. Lines connect at shared source vertices; geometric crossings do not create junctions.

A **directed pattern** includes route ID, direction_id, the entire ordered stop-ID sequence, repeated stops and pickup/drop-off rules. Every adjacent pair is measured. A single failed pair excludes the entire pattern, with no omitted call, substituted chord, unsupported bridge or spliced shortened journey. Pair keys include route identity and direction through from/to ordering; reverse service is independently checked. Repeated-stop loops are retained in pattern identity and collapsed projections are rejected. Successful segments on an excluded pattern count as measured geometry in the unfiltered denominator but are not exported as an admitted journey.

The source has no one-way or direction field. A successful ordered match is an **inferred physical corridor**, not certification of the correct carriageway, running track, bridge deck, tunnel bore or temporary diversion. In particular, shortest paths through source loops can require operational review even when the numerical tests pass. No observed vehicle positions or realtime prediction is included. Missing national rail/mountain/boat geometry is not replaced with stop interpolation.

## Weekday / Sunday results

| Measure | Friday 4 September | Sunday 6 September |
| --- | ---: | ---: |
| Annual-census routes active in civil day | 140 | 155 |
| Civil-day movements, all modes | 13'649 | 11'550 |
| Representative headway movements (not scheduled) | 1'020 | 1'020 |
| Admitted scheduled movements | 9'184 | 7'008 |
| Excluded movements | 4'465 | 4'542 |
| Admitted journeys using reviewed donor edges | 162 | 144 |
| Directed pairs traversing reviewed repairs | 12 | 13 |
| Admitted journeys using inferred OSM road fallback | 454 | 489 |
| Directed pairs using inferred OSM road fallback | 201 | 268 |
| Admitted journeys using inferred federal rail corridors | 244 | 227 |
| Directed pairs using inferred federal rail corridors | 345 | 337 |
| Preceding-service-day carry-in / admitted | 263 / 262 | 424 / 423 |
| Routes with at least one admitted pattern | 126 | 139 |
| Directed stop patterns / admitted | 1'061 / 994 | 878 / 810 |
| Route-specific directed stop pairs / matched | 4'919 / 4'804 | 5'474 / 5'341 |
| Unique directed-pair geometry coverage | 97.66% | 97.57% |
| Scheduled segment occurrences / matched | 139'294 / 134'525 | 105'124 / 100'207 |
| Scheduled segment geometry coverage | 96.58% | 95.32% |
| All segment occurrences / matched (including headways) | 140'314 / 134'525 | 106'144 / 100'207 |
| All-movement segment geometry coverage | 95.87% | 94.41% |

All exported journeys have 100% matched segments **by the admission rule**. The unfiltered scheduled-segment coverage (96.58% / 95.32%) is the useful measure of remaining work. Unique-pair percentages are lower; frequently repeated urban trips cannot conceal missing regional or mountain patterns. The audit keeps scheduled occurrences and representative-headway occurrences separate for each pair.

| Agency:mode | Friday admitted/total trips | Friday admitted/total patterns | Friday all-segment geometry | Sunday admitted/total trips | Sunday admitted/total patterns | Sunday all-segment geometry |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 11:rail · Schweizerische Bundesbahnen SBB | 465 / 489 | 232 / 250 | 99.61% | 465 / 493 | 206 / 217 | 99.54% |
| 82:rail · Schweizerische Südostbahn (sob) | 47 / 47 | 34 / 34 | 100.00% | 46 / 46 | 24 / 24 | 100.00% |
| 86:rail · Zentralbahn | 279 / 279 | 90 / 90 | 100.00% | 242 / 242 | 56 / 56 | 100.00% |
| 33:rail · BLS AG (bls) | 244 / 244 | 66 / 66 | 100.00% | 219 / 219 | 40 / 40 | 100.00% |
| 839:bus · Zugerland Verkehrsbetriebe | 317 / 321 | 36 / 39 | 99.89% | 198 / 198 | 28 / 28 | 100.00% |
| 820:bus · Verkehrsbetriebe Luzern AG | 3'960 / 3'960 | 144 / 144 | 100.00% | 2'822 / 2'822 | 156 / 156 | 100.00% |
| 819:bus · Automobil Rottal AG | 475 / 475 | 53 / 53 | 100.00% | 308 / 308 | 29 / 29 | 100.00% |
| 812:bus · Auto AG Rothenburg | 778 / 778 | 44 / 44 | 100.00% | 486 / 486 | 24 / 24 | 100.00% |
| 816:bus · Auto AG Uri | 28 / 28 | 2 / 2 | 100.00% | 5 / 5 | 2 / 2 | 100.00% |
| 841:bus · Auto AG Schwyz | 168 / 168 | 23 / 23 | 100.00% | 160 / 160 | 24 / 24 | 100.00% |
| 723:bus · Aargau Verkehr AG | 161 / 161 | 22 / 22 | 100.00% | 97 / 97 | 17 / 17 | 100.00% |
| 7230:bus · BLS Netz AG Ersatzverkehr | 2 / 2 | 2 / 2 | 100.00% | 74 / 74 | 4 / 4 | 100.00% |
| 273:mountain · Marbach-Marbachegg | 0 / 1'082 | 0 / 2 | 0.00% | 0 / 1'142 | 0 / 2 | 0.00% |
| 283:mountain · Bergbahnen Sörenberg AG | 0 / 1'140 | 0 / 4 | 0.00% | 0 / 1'140 | 0 / 4 | 0.00% |
| 820:mountain · Verkehrsbetriebe Luzern AG | 626 / 626 | 2 / 2 | 100.00% | 626 / 626 | 2 / 2 | 100.00% |
| 3090:mountain · Kriens-Sonnenberg-Bahn | 76 / 76 | 2 / 2 | 100.00% | 82 / 82 | 2 / 2 | 100.00% |
| 13600:mountain · Kriens-Fräkmüntegg | 0 / 1'107 | 0 / 5 | 0.00% | 0 / 1'107 | 0 / 5 | 0.00% |
| 13700:mountain · Weggis-Rigi Kaltbad | 51 / 51 | 2 / 2 | 100.00% | 47 / 47 | 2 / 2 | 100.00% |
| 107:mountain · Bürgenstock Bahn AG | 0 / 1'020 | 0 / 2 | 0.00% | 0 / 1'020 | 0 / 2 | 0.00% |
| 137:mountain · Rigi Bahnen AG | 28 / 28 | 7 / 7 | 100.00% | 32 / 32 | 8 / 8 | 100.00% |
| 185:boat · Vierwaldstättersee | 0 / 83 | 0 / 30 | 0.00% | 0 / 95 | 0 / 41 | 0.00% |
| 181:boat · Hallwilersee | 0 / 3 | 0 / 1 | 0.00% | 0 / 9 | 0 / 2 | 0.00% |
| 801:bus · PostAuto AG | 1'479 / 1'481 | 233 / 235 | 99.98% | 1'095 / 1'095 | 184 / 184 | 100.00% |
| 7079:bus · PRO REGIO HUTTWIL Verkehrsverein | 0 / 0 | 0 / 0 | — | 4 / 4 | 2 / 2 | 100.00% |
| 7231:bus · SBB Infrastruktur AG Bahnersatz | 0 / 0 | 0 / 0 | — | 0 / 1 | 0 / 1 | 81.82% |

## Exclusions and source limitations

### Inferred bus road fallback

The [road cache](../data/luzern-road-cache.json) covers **700 complete bus stop patterns across 11 agencies**, including every bus pattern on both fixtures. Routing inputs retain the entire ordered platform sequence and coordinates, route ID and cross-canton termini. Each agency is matched independently using [pfaedle](https://github.com/ad-freiburg/pfaedle) at commit 99f2cd466696ecc6bdb73b2b3bb9008557fcb84a, with bus access/direction rules, explicit fallback warnings and trie aggregation disabled. These remain inferred paths, not operator-verified or diversion-certified routes.

Input roads are the **Geofabrik Swiss extract dated 2 September 2026 plus the border extract retrieved 8 September 2026**, reused from the [documented offline road pipeline](POSTBUS-ROAD-GEOMETRY.md). The combined filtered PBF SHA-256 is `d5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b`. The dated extract is not replaced with today's mutable [Geofabrik download](https://download.geofabrik.de/europe/switzerland.html). Binary, configuration, input pattern, output shape, stop-time, trip and warning-log hashes are recorded per agency. The [compressed matcher evidence](../data/luzern-road-evidence) retains all original shapes, monotone stop distances, full pattern identities and explicit warnings, so the checker reconstructs and verifies every cached accepted or rejected segment offline.

Road inference is consulted **only after official bus geometry fails**. A route-specific directed pair is accepted only when every occurrence in every complete input pattern yields an accepted, byte-identical road path. A failed context or a different branch blocks the pair; no successful representative hides another pattern's failure. Of 4'948 bus pairs, 4'897 pass this road consensus and 51 do not. These are fallback-candidate counts, not new delivered paths: successful official geometry always takes precedence. Final road paths retain the existing 120 m snapping and max(1,200 m, 4.5 × direct distance) detour limits, reject collapsed paths, and connect to the exact source platforms. Road interiors use the shared importer's 5 m simplification / six-decimal precision; final platform endpoints use seven decimals. Repeated calls are never removed.

The fallback adds **454 Friday and 489 Sunday complete journeys**, bringing bus admission to **7,368 / 7,374 Friday** and **5,249 / 5,250 Sunday**. Gains include Sörenberg–Glaubenbielen line 241, Tellbus 493, Rotkreuz 73, Küssnacht 502/508/622, vbl branches, EV1 replacement buses and night routes. Every delivered journey has a per-segment geometrySources array; every road pair records its full roadPatternIds and the original officialAssessment. [Regression digests](../data/luzern-road-regression.json), anchored to commit 76bdc64, prove that all earlier matched official paths and all 8,486 / 6,292 earlier admitted journeys remain unchanged.

The remaining bus exclusions are **one Friday 101 journey through Baldegg Kantonsschule**, **three Friday 105 journeys with conflicting Hochdorf Oberstufenzentrum–Bankstrasse paths**, **two Friday 233 journeys through Heiligkreuz Witebach**, and **one Sunday EV3 journey through Entlebuch Bahnhof**. The detailed failed segments and reasons remain in the machine audit. Other modes still have the exclusions below; near-complete bus fixtures do not mean complete cantonal transport coverage.

The road cache and OSM-derived path database are supplied under **[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)** with **[© OpenStreetMap contributors](https://www.openstreetmap.org/copyright)** attribution. Official source paths retain Open-By attribution. Feed metadata identifies both licenses and the complete public manifest exposes all delivered paths, distinguished by the journey geometrySources references. A future map UI must display the source attribution. No source is presented as endorsing the inferred routing.

[Eight geometry review panels](luzern-road-review.svg) were rendered and inspected: Sörenberg hairpins, both-source Tellbus routing, the 121 m Brüelstrasse platform turn, Dattenberg, Küssnacht, Rotkreuz, EV1 and N1. This is a geometry continuity and retained-call review without a basemap, not independent street-direction certification.

### Federal rail corridors

The [federal rail adapter](../scripts/luzern-rail-geometry.mjs) fills failed cantonal rail pairs using the [FOT railway network](https://opendata.swiss/en/dataset/schienennetz). The [retained source snapshot](../data/luzern-rail-sources/source.json) contains all 3,210 operating-point nodes and 3,424 infrastructure segments. Its XTF bytes match the SHA-256 published by the federal STAC catalogue. This is a dated infrastructure source: all segments used here have **Stand 6 July 2021**; **18 January 2025 is the asset update**, and **8 September 2026 is our catalogue check**. None of these dates certifies September 2026 running-track or diversion validity.

The crosswalk lists **55 exact annual route identities** for SBB, BLS and SOB on standard gauge, and Zentralbahn on metre gauge. It tests all **627 complete directed fixture patterns**, preserving every cross-canton call, direction, repeat and pickup/drop-off rule. Stops join only through their exact operating-point numbers; nearest coordinates or station names cannot substitute an identity. Every source edge is oriented from its declared start/end nodes, keeps its infrastructure segment ID, gauge and source validity dates, and must attach within 120 m. Platform-to-operating-point connections must be within 350 m; these are explicit station connections, not inferred running tracks. Paths use the same max(1,200 m, 4.5 × direct distance) detour ceiling and 5 m source simplification. Used station attachments reach 302.5 m; used source-node attachments reach 106.1 m.

Each search blocks every other called station, preventing an adjacent-pair route from visiting a later call out of order. All full-pattern contexts must agree on the identical path and directed source-segment sequence before a pair is reusable. The audit records 1'285 candidate rail pairs, 1'203 with compatible geometry; successful cantonal paths retain precedence. Per-journey geometrySources marks the added paths as fot-rail-inference. Every accepted pair records original officialAssessment, exact operating points, platform attachment distances, railPatternIds and directedSourceSegments. Source segment admission and rejection are separately inventoried across the entire federal snapshot.

This adds **244 Friday and 227 Sunday journeys**. Rail admission is now **1,035 / 1,059 Friday** and **972 / 1,000 Sunday**. The delivered additions include full IR15, IC21, IR26/27, IR70, VAE, RE7, S77 and S44 journeys, plus compatible short workings and specials. [Regression digests](../data/luzern-rail-regression.json) anchored to b95f418 verify that all earlier cantonal/OSM paths and all 8,940 / 6,781 previously admitted journeys are unchanged. The checker independently reconstructs all paths from the retained XTF and [complete rail pattern inputs](../data/luzern-rail-inputs.json), then replays all original calls when the full timetable cache is supplied. Newly admitted IC, VAE and EXT services also retain the appropriate intercity, interregio and special-service display categories.

The remaining rail exclusions are whole **IR75 journeys serving Konstanz (22 Friday / 26 Sunday)** and **EC journeys serving Como S. Giovanni (2 on each date)**. GTFS operating-point numbers 8014586 and 8301307 have no corresponding station nodes in the acquired federal network. They remain excluded without trimming their foreign termini. The old cantonal VAE and RE7 geometry gaps remain documented in officialAssessment where federal geometry now succeeds.

Federal attribution is **© Federal Office of Transport (FOT)** with the source's [terms requiring attribution](https://opendata.swiss/terms-of-use/#terms_by). The catalogue's generic license field is retained verbatim as “proprietary”; the linked terms, source dates, checksums and authorship of this processed result remain explicit in both audit and feed. [Six rail geometry panels](luzern-rail-review.svg) show IC21, historic-route IR26, full VAE and RE7, IR15 and metre-gauge S44. The visual check covers continuity, calls and differing corridors; it does not certify individual running tracks.

### Other modes and unresolved source geometry

All eight lake route records (SGV and Hallwilersee) remain in the annual inventory. The cantonal boat layer is a single 2015 settlement-service line; it has no complete 2026 route crosswalk. No water geometry is admitted. The mountain services at Pilatus/Kriens-Fräkmüntegg, Sörenberg, Marbachegg and Hammetschwand lack admitted source geometry. Rigi 82/88, Weggis–Rigi Kaltbad, Gütsch and Sonnenberg do have measured and admitted complete patterns.

The VAE cantonal source is named across its full corridor but its linework is much shorter. The BLS RE7 cantonal alignment stops short of Bern: the Konolfingen–Langnau pair is about 12.8 km away at the missing endpoint. These source limitations are preserved even though compatible federal rail paths now admit the full journeys. Remaining foreign-station and bus replacement failures have their own rows and exact reasons.

Bus linework is strong but not complete. The first pass found real separated components at Inwil, Sursee, Reiden, Menziken and Küssnacht. A follow-up checks each proposed repair against exact donor edges and existing target vertices, with a 100 m maximum path length. Every donor edge must exist in the cited source feature and the target endpoints must belong to disconnected components; changed source bytes, invented chords and already-connected endpoints fail validation. The repairs remain undirected corridor inference.

| Target line | Gap / donor path | Official donor | Review result |
| --- | --- | --- | --- |
| 111, Inwil | 23.8 / 24.1 m | 110 (B110), four source edges | Applied |
| 81, Sursee | 18.6 m | 86 (B086) | Applied |
| 399, Sursee | 18.6 m | 86 (B086) | Applied |
| 609, Reiden | 17.6 m | 608 (B608) | Applied |
| 399, Menziken | 8.5 m | 398 (B398) | Applied |
| 622 / 653, Küssnacht–Immensee | 9.8 m gap; available path detours 3.775 km | No short source path | Rejected; remains disconnected |

The five repairs recover **162 Friday and 144 Sunday complete journeys** over the initial adapter, without changing the inventory, schedules, snap thresholds or full-pattern admission rule. Every affected pair records geometryRepairIds and repairSourceFeatures; the checker validates the exact donor edges against the pinned bus snapshot. The original 8,324 / 6,148 counts and subsequent 8,486 / 6,292 official-only counts are preserved in Git. Source endpoints also miss Rotkreuz Schulanlagen (73, roughly 160–193 m) and Küssnacht Plaza (508, about 211 m). Repeated Brüelstrasse calls on vbl 25 collapse in the official source. These failures remain recorded in officialAssessment where the independently inferred road fallback now succeeds. Full route-specific pair names, gaps and occurrence counts are in the JSON audit.

The rawi stop-layer cross-check considers 957 source records inside the polygon. It compares DIDOK-derived SLOID identity, including GTFS generated platform IDs. The following direct identities do not occur among in-canton GTFS stop records; this is not automatic proof of missing service. Vitznau RB is represented in the Rigi fixture with GTFS's shared Vitznau identity 8508464 instead of the source's 8505070. The other discrepancies require source follow-up.

| Source SLOID | Source name | Municipality |
| --- | --- | --- |
| ch:1:sloid:5070 | Vitznau RB | Vitznau |
| ch:1:sloid:81161 | Meggen, Bahnhof | Meggen |
| ch:1:sloid:82261 | Hasle LU, Farbschachen | Hasle |
| ch:1:sloid:82443 | Wauwil, Sackmatt | Wauwil |
| ch:1:sloid:93492 | Wolhusen, Tropenhaus | Wolhusen |

Every source feature that produced no admitted fixture journey is listed here. “No annual Luzern-calling route” means no exact decoded identity in the polygon-based annual route census; it does not mean the route does not exist outside the canton. All 144 source line records, including used features, are in sourceInventory in the JSON audit.

| Source feature | Description | Status | Exact annual GTFS route matches |
| --- | --- | --- | --- |
| bus:B605 | Zofingen - Brittnau | no-annual-Luzern-calling-route | — |
| rail:S12 | S12 Langenthal - St. Urban Ziegelei | no-annual-Luzern-calling-route | — |
| rail:S14 | S14 Aarau - Menziken | no-annual-Luzern-calling-route | — |
| rail:VRG2 | Arth-Goldau - Rigi Kulm | no-annual-Luzern-calling-route | — |
| rail:T7 | Brienz - Rothorn | identity-or-vintage-exclusion | — |
| boat:83 | Luzern-Lido-Hertenstein SGV-Weggis-Vitznau | identity-or-vintage-exclusion | — |

## Complete annual route admission inventory

Counts below are admitted/total **civil-day movements**; inactive records remain in the table. “Partially admitted” means some complete patterns pass and others are excluded, never that a partial journey is exported. The JSON audit additionally records active source-service-day trip/template counts and all individual directed pattern reasons. A route can have several reasons; reason counts are not mutually exclusive.

| GTFS route ID | Agency · line | Mode | Annual trip records | Friday admitted/total, status | Sunday admitted/total, status | Source features | Fixture exclusion reasons |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| `91-1-A-j26-1` | 11 · S1 | rail | 2689 | 89/89 admitted | 88/88 admitted | rail:S1 | — |
| `91-1-I-j26-1` | 11 · SN1 | rail | 130 | 0/0 inactive | 7/7 admitted | rail:SN1 | — |
| `91-15-B-j26-1` | 11 · IR15 | rail | 1518 | 39/39 admitted | 38/38 admitted | FOT rail | — |
| `91-1J-Y-j26-1` | 86 · IR | rail | 4 | 0/0 inactive | 0/0 inactive | — | — |
| `91-1W-Y-j26-1` | 11 · EXT | rail | 15 | 0/0 inactive | 3/3 admitted | FOT rail | — |
| `91-21-D-j26-1` | 11 · IC21 | rail | 1059 | 18/18 admitted | 18/18 admitted | FOT rail | — |
| `91-24-F-j26-1` | 11 · RE24 | rail | 840 | 40/40 admitted | 40/40 admitted | rail:RE24 | — |
| `91-26-C-j26-1` | 82 · IR26 | rail | 1212 | 21/21 admitted | 20/20 admitted | FOT rail | — |
| `91-26-D-j26-1` | 11 · IR26 | rail | 37 | 1/1 admitted | 1/1 admitted | FOT rail | — |
| `91-26-E-j26-1` | 11 · RE26 | rail | 44 | 0/0 inactive | 0/0 inactive | — | — |
| `91-27-A-j26-1` | 11 · IR27 | rail | 1355 | 34/34 admitted | 31/31 admitted | FOT rail | — |
| `91-29-j26-1` | 11 · S29 | rail | 648 | 45/45 admitted | 45/45 admitted | rail:S29 | — |
| `91-2L-Y-j26-1` | 11 · RE | rail | 2 | 0/0 inactive | 0/0 inactive | — | — |
| `91-3-H-j26-1` | 11 · S3 | rail | 697 | 51/51 admitted | 51/51 admitted | rail:S3, FOT rail | — |
| `91-35-Y-j26-1` | 11 · IR | rail | 124 | 5/5 admitted | 1/1 admitted | FOT rail | — |
| `91-39-Y-j26-1` | 82 · IR | rail | 1 | 0/0 inactive | 0/0 inactive | — | — |
| `91-3M-Y-j26-1` | 11 · IR | rail | 60 | 0/0 inactive | 1/1 admitted | FOT rail | — |
| `91-3P-Y-j26-1` | 86 · EXT | rail | 1 | 0/0 inactive | 0/0 inactive | — | — |
| `91-3R-Y-j26-1` | 11 · EC | rail | 54 | 0/2 excluded | 0/2 excluded | — | missing-line |
| `91-4-D-j26-1` | 86 · S4 | rail | 436 | 82/82 admitted | 82/82 admitted | rail:S4 | — |
| `91-41-A-j26-1` | 86 · S41 | rail | 76 | 20/20 admitted | 0/0 inactive | rail:S41 | — |
| `91-44-A-j26-1` | 86 · S44 | rail | 71 | 14/14 admitted | 2/2 admitted | rail:S44, FOT rail | — |
| `91-46-j26-1` | 82 · IR46 | rail | 11 | 0/0 inactive | 0/0 inactive | — | — |
| `91-5-D-j26-1` | 86 · S5 | rail | 546 | 80/80 admitted | 80/80 admitted | rail:S5 | — |
| `91-55-j26-1` | 86 · S55 | rail | 29 | 8/8 admitted | 0/0 inactive | rail:S55 | — |
| `91-5F-Y-j26-1` | 11 · IC | rail | 25 | 0/0 inactive | 0/0 inactive | — | — |
| `91-5G-Y-j26-1` | 11 · EXT | rail | 7 | 1/1 admitted | 0/0 inactive | FOT rail | — |
| `91-5U-Y-j26-1` | 86 · EXT | rail | 2 | 0/0 inactive | 0/0 inactive | — | — |
| `91-6-B-j26-1` | 33 · S6 | rail | 1209 | 119/119 admitted | 113/113 admitted | rail:S6_2, rail:S6_1 | — |
| `91-7-D-j26-1` | 33 · S7 | rail | 366 | 37/37 admitted | 36/36 admitted | rail:S7 | — |
| `91-7-L-j26-1` | 33 · RE7 | rail | 997 | 73/73 admitted | 70/70 admitted | rail:RE7, FOT rail | — |
| `91-70-A-j26-1` | 11 · IR70 | rail | 1635 | 37/37 admitted | 37/37 admitted | FOT rail | — |
| `91-75-j26-1` | 11 · IR75 | rail | 1597 | 18/40 partially-admitted | 14/40 partially-admitted | FOT rail | missing-line |
| `91-77-j26-1` | 33 · S77 | rail | 85 | 15/15 admitted | 0/0 inactive | rail:S77, FOT rail | — |
| `91-9-B-j26-1` | 11 · S9 | rail | 1284 | 80/80 admitted | 77/77 admitted | rail:S9 | — |
| `91-98-Y-j26-1` | 11 · RE | rail | 3 | 0/0 inactive | 0/0 inactive | — | — |
| `91-99-j26-1` | 11 · S99 | rail | 20 | 5/5 admitted | 0/0 inactive | rail:S99 | — |
| `91-9T-Y-j26-1` | 86 · EXT | rail | 1 | 0/0 inactive | 0/0 inactive | — | — |
| `91-9Z-Y-j26-1` | 11 · EXT | rail | 2 | 0/0 inactive | 0/0 inactive | — | — |
| `91-AI-Y-j26-1` | 11 · EXT | rail | 4 | 0/0 inactive | 0/0 inactive | — | — |
| `91-AK-Y-j26-1` | 11 · EXT | rail | 10 | 0/0 inactive | 0/0 inactive | — | — |
| `91-AL-Y-j26-1` | 11 · EXT | rail | 9 | 0/0 inactive | 0/0 inactive | — | — |
| `91-AP-Y-j26-1` | 11 · EXT | rail | 3 | 0/0 inactive | 0/0 inactive | — | — |
| `91-AR-Y-j26-1` | 11 · EXT | rail | 1 | 0/0 inactive | 0/0 inactive | — | — |
| `91-AW-Y-j26-1` | 11 · EXT | rail | 8 | 0/0 inactive | 1/1 admitted | FOT rail | — |
| `91-AZ-Y-j26-1` | 86 · EXT | rail | 17 | 0/0 inactive | 0/0 inactive | — | — |
| `91-BJ-Y-j26-1` | 33 · EXT | rail | 1 | 0/0 inactive | 0/0 inactive | — | — |
| `91-BN-Y-j26-1` | 33 · EXT | rail | 1 | 0/0 inactive | 0/0 inactive | — | — |
| `91-CB-Y-j26-1` | 11 · IC | rail | 60 | 0/0 inactive | 1/1 admitted | FOT rail | — |
| `91-K-Y-j26-1` | 11 · IC | rail | 164 | 2/2 admitted | 3/3 admitted | FOT rail | — |
| `91-LEX-j26-1` | 86 · IRLEX | rail | 287 | 37/37 admitted | 40/40 admitted | rail:LEX | — |
| `91-LIX-A-j26-1` | 86 · IRLIX | rail | 22 | 4/4 admitted | 4/4 admitted | rail:LIX | — |
| `91-LIX-j26-1` | 86 · LIX | rail | 252 | 34/34 admitted | 34/34 admitted | rail:LIX | — |
| `91-N7-j26-1` | 11 · N7 | rail | 134 | 0/0 inactive | 8/8 admitted | rail:NEX | — |
| `91-VAE-j26-1` | 82 · VAE | rail | 828 | 26/26 admitted | 26/26 admitted | rail:VAE, FOT rail | — |
| `92-1-B-j26-1` | 820 · 1 | bus | 4692 | 334/334 admitted | 274/274 admitted | bus:A01, OSM fallback | — |
| `92-10-B-j26-1` | 820 · 10 | bus | 992 | 161/161 admitted | 133/133 admitted | bus:A10, OSM fallback | — |
| `92-101-A-j26-1` | 839 · 101 | bus | 67 | 33/34 partially-admitted | 14/14 admitted | bus:B101, OSM fallback | endpoint-gap |
| `92-105-j26-1` | 839 · 105 | bus | 115 | 47/50 partially-admitted | 26/26 admitted | bus:B105, OSM fallback | endpoint-gap |
| `92-106-A-j26-1` | 839 · 106 | bus | 93 | 45/45 admitted | 24/24 admitted | bus:B106 | — |
| `92-107-B-j26-1` | 839 · 107 | bus | 107 | 43/43 admitted | 32/32 admitted | bus:B107 | — |
| `92-109-B-j26-1` | 839 · 109 | bus | 12 | 4/4 admitted | 2/2 admitted | bus:B109, OSM fallback | — |
| `92-11-D-j26-1` | 820 · 11 | bus | 612 | 86/86 admitted | 54/54 admitted | bus:A11 | — |
| `92-111-j26-1` | 819 · 111 | bus | 66 | 56/56 admitted | 40/40 admitted | bus:B111 | — |
| `92-12-A-j26-1` | 820 · 12 | bus | 1802 | 278/278 admitted | 147/147 admitted | bus:A12, OSM fallback | — |
| `92-14-j26-1` | 820 · 14 | bus | 1813 | 183/183 admitted | 150/150 admitted | bus:A14, OSM fallback | — |
| `92-15-j26-1` | 820 · 15 | bus | 305 | 123/123 admitted | 78/78 admitted | bus:A15 | — |
| `92-16-j26-1` | 820 · 16 | bus | 353 | 68/68 admitted | 34/34 admitted | bus:A16 | — |
| `92-18-j26-1` | 820 · 18 | bus | 1666 | 109/109 admitted | 78/78 admitted | bus:A18 | — |
| `92-19-A-j26-1` | 820 · 19 | bus | 1091 | 245/245 admitted | 203/203 admitted | bus:A19, OSM fallback | — |
| `92-2-C-j26-1` | 820 · 2 | bus | 3447 | 291/291 admitted | 224/224 admitted | bus:A02, OSM fallback | — |
| `92-20-A-j26-1` | 820 · 20 | bus | 1532 | 178/178 admitted | 159/159 admitted | bus:A20, OSM fallback | — |
| `92-21-C-j26-1` | 820 · 21 | bus | 456 | 102/102 admitted | 68/68 admitted | bus:A21 | — |
| `92-212-A-j26-1` | 819 · 212 | bus | 18 | 18/18 admitted | 0/0 inactive | bus:B212 | — |
| `92-22-j26-1` | 820 · 22 | bus | 805 | 173/173 admitted | 79/79 admitted | bus:B022 | — |
| `92-23-j26-1` | 820 · 23 | bus | 584 | 182/182 admitted | 83/83 admitted | bus:A23 | — |
| `92-24-j26-1` | 820 · 24 | bus | 1493 | 165/165 admitted | 138/138 admitted | bus:A24, OSM fallback | — |
| `92-25-A-j26-1` | 820 · 25 | bus | 557 | 81/81 admitted | 79/79 admitted | bus:A25, OSM fallback | — |
| `92-26-j26-1` | 820 · 26 | bus | 651 | 80/80 admitted | 78/78 admitted | bus:A26 | — |
| `92-27-C-j26-1` | 820 · 27 | bus | 33 | 0/0 inactive | 33/33 admitted | OSM fallback | — |
| `92-30-A-j26-1` | 820 · 30 | bus | 601 | 120/120 admitted | 60/60 admitted | bus:B030 | — |
| `92-348-j26-1` | 839 · 348 | bus | 128 | 46/46 admitted | 20/20 admitted | bus:B348 | — |
| `92-4-D-j26-1` | 820 · 4 | bus | 1934 | 214/214 admitted | 154/154 admitted | bus:A04 | — |
| `92-40-A-j26-1` | 812 · 40 | bus | 445 | 143/143 admitted | 116/116 admitted | bus:B040 | — |
| `92-41-A-j26-1` | 812 · 41 | bus | 151 | 78/78 admitted | 76/76 admitted | bus:B041 | — |
| `92-42-A-j26-1` | 812 · 42 | bus | 61 | 59/59 admitted | 0/0 inactive | bus:B042 | — |
| `92-43-A-j26-1` | 812 · 43 | bus | 119 | 77/77 admitted | 75/75 admitted | bus:B043 | — |
| `92-44-A-j26-1` | 812 · 44 | bus | 61 | 59/59 admitted | 0/0 inactive | bus:B044 | — |
| `92-45-A-j26-1` | 812 · 45 | bus | 58 | 58/58 admitted | 0/0 inactive | bus:B045 | — |
| `92-46-A-j26-1` | 812 · 46 | bus | 338 | 144/144 admitted | 75/75 admitted | bus:B046, OSM fallback | — |
| `92-493-A-j26-1` | 816 · 493 | bus | 93 | 28/28 admitted | 5/5 admitted | bus:TB, OSM fallback | — |
| `92-494-A-j26-1` | 7079 · 494 | bus | 4 | 0/0 inactive | 4/4 admitted | OSM fallback | — |
| `92-5-F-j26-1` | 820 · 5 | bus | 1238 | 179/179 admitted | 0/0 inactive | bus:A05 | — |
| `92-50-B-j26-1` | 812 · 50 | bus | 47 | 40/40 admitted | 39/39 admitted | bus:B050 | — |
| `92-502-A-j26-1` | 841 · 502 | bus | 4519 | 28/28 admitted | 29/29 admitted | bus:B502, OSM fallback | — |
| `92-508-A-j26-1` | 841 · 508 | bus | 11715 | 64/64 admitted | 54/54 admitted | bus:B508, OSM fallback | — |
| `92-509-A-j26-1` | 841 · 509 | bus | 5456 | 28/28 admitted | 30/30 admitted | bus:B509 | — |
| `92-51-C-j26-1` | 812 · 51 | bus | 80 | 73/73 admitted | 59/59 admitted | bus:B051 | — |
| `92-510-j26-1` | 841 · 510 | bus | 3986 | 22/22 admitted | 18/18 admitted | bus:B510 | — |
| `92-52-j26-1` | 812 · 52 | bus | 89 | 47/47 admitted | 40/40 admitted | bus:B052 | — |
| `92-529-j26-1` | 841 · 529 | bus | 4859 | 26/26 admitted | 24/24 admitted | bus:B529 | — |
| `92-6-D-j26-1` | 820 · 6 | bus | 1339 | 176/176 admitted | 129/129 admitted | bus:A06 | — |
| `92-60-A-j26-1` | 819 · 60 | bus | 27 | 26/26 admitted | 2/2 admitted | bus:B060, OSM fallback | — |
| `92-604-C-j26-1` | 723 · 604 | bus | 50 | 30/30 admitted | 0/0 inactive | bus:B604 | — |
| `92-608-A-j26-1` | 723 · 608 | bus | 152 | 66/66 admitted | 62/62 admitted | bus:B608 | — |
| `92-609-A-j26-1` | 723 · 609 | bus | 158 | 65/65 admitted | 35/35 admitted | bus:B609 | — |
| `92-61-A-j26-1` | 819 · 61 | bus | 116 | 82/82 admitted | 57/57 admitted | bus:B061 | — |
| `92-62-A-j26-1` | 819 · 62 | bus | 86 | 81/81 admitted | 36/36 admitted | bus:B062, OSM fallback | — |
| `92-622-A-j26-1` | 839 · 622 | bus | 456 | 79/79 admitted | 73/73 admitted | bus:B622, OSM fallback | — |
| `92-63-A-j26-1` | 819 · 63 | bus | 73 | 69/69 admitted | 67/67 admitted | bus:B063 | — |
| `92-64-A-j26-1` | 819 · 64 | bus | 97 | 65/65 admitted | 34/34 admitted | bus:B064 | — |
| `92-65-A-j26-1` | 819 · 65 | bus | 126 | 62/62 admitted | 61/61 admitted | bus:B065 | — |
| `92-653-j26-1` | 839 · 653 | bus | 20 | 20/20 admitted | 0/0 inactive | bus:B653, OSM fallback | — |
| `92-66-A-j26-1` | 819 · 66 | bus | 16 | 16/16 admitted | 0/0 inactive | bus:B066 | — |
| `92-67-B-j26-1` | 819 · 67 | bus | 18 | 0/0 inactive | 0/0 inactive | — | — |
| `92-7-A-j26-1` | 820 · 7 | bus | 2588 | 257/257 admitted | 193/193 admitted | bus:A07 | — |
| `92-8-A-j26-1` | 820 · 8 | bus | 1886 | 175/175 admitted | 132/132 admitted | bus:A08, OSM fallback | — |
| `92-A02-A-j26-1` | 7231 · EV4 | bus | 8 | 0/0 inactive | 0/0 inactive | — | — |
| `92-A04-O-j26-1` | 7231 · EV1 | bus | 1424 | 0/0 inactive | 0/0 inactive | — | — |
| `92-A04-U-j26-1` | 7231 · EV2 | bus | 4 | 0/0 inactive | 0/0 inactive | — | — |
| `92-A05-D-j26-1` | 7231 · EV2 | bus | 132 | 0/0 inactive | 0/0 inactive | — | — |
| `92-A05-I-j26-1` | 7230 · EV1 | bus | 122 | 2/2 admitted | 74/74 admitted | OSM fallback | — |
| `92-A05-X-j26-1` | 7231 · EV3 | bus | 245 | 0/0 inactive | 0/1 excluded | — | missing-line |
| `92-A0C-8-j26-1` | 7230 · EV3 | bus | 76 | 0/0 inactive | 0/0 inactive | — | — |
| `92-E-H-j26-1` | 841 · E | bus | 1 | 0/0 inactive | 0/0 inactive | — | — |
| `92-EV-F-j26-1` | 185 · EV | bus | 34 | 0/0 inactive | 0/0 inactive | — | — |
| `92-EV2-L-j26-1` | 7231 · EV2 | bus | 48 | 0/0 inactive | 0/0 inactive | — | — |
| `92-EV4-O-j26-1` | 7231 · EV4 | bus | 1 | 0/0 inactive | 0/0 inactive | — | — |
| `92-N1-j26-1` | 820 · N1 | bus | 70 | 0/0 inactive | 14/14 admitted | bus:B901, OSM fallback | — |
| `92-N12-j26-1` | 820 · N12 | bus | 18 | 0/0 inactive | 6/6 admitted | bus:B912 | — |
| `92-N14-j26-1` | 820 · N14 | bus | 24 | 0/0 inactive | 6/6 admitted | bus:B914 | — |
| `92-N2-A-j26-1` | 820 · N2 | bus | 18 | 0/0 inactive | 6/6 admitted | bus:B902 | — |
| `92-N20-A-j26-1` | 820 · N20 | bus | 23 | 0/0 inactive | 6/6 admitted | bus:B920 | — |
| `92-N21-j26-1` | 820 · N21 | bus | 18 | 0/0 inactive | 6/6 admitted | bus:B921 | — |
| `92-N3-B-j26-1` | 820 · N3 | bus | 7 | 0/0 inactive | 6/6 admitted | bus:B903 | — |
| `92-N33-A-j26-1` | 841 · N33 | bus | 317 | 0/0 inactive | 5/5 admitted | bus:B933, OSM fallback | — |
| `92-N4-A-j26-1` | 820 · N4 | bus | 12 | 0/0 inactive | 6/6 admitted | bus:B904, OSM fallback | — |
| `92-N52-j26-1` | 812 · N52 | bus | 9 | 0/0 inactive | 6/6 admitted | bus:B952 | — |
| `92-N6-j26-1` | 820 · N6 | bus | 29 | 0/0 inactive | 6/6 admitted | bus:B906, OSM fallback | — |
| `92-N60-C-j26-1` | 819 · N60 | bus | 6 | 0/0 inactive | 6/6 admitted | bus:B960 | — |
| `92-N63-B-j26-1` | 819 · N63 | bus | 5 | 0/0 inactive | 5/5 admitted | bus:B963, OSM fallback | — |
| `92-N9-j26-1` | 839 · N9 | bus | 8 | 0/0 inactive | 7/7 admitted | bus:B909 | — |
| `93-250-0-j26-1` | 273 · 2500 | mountain | 2164 | 0/1082 excluded | 0/1142 excluded | — | missing-line |
| `93-250-5-j26-1` | 283 · 2505 | mountain | 106 | 0/58 excluded | 0/58 excluded | — | missing-line |
| `93-250-A-j26-1` | 283 · 2503 | mountain | 2044 | 0/1082 excluded | 0/1082 excluded | — | missing-line |
| `93-251-0-j26-1` | 820 · 2510 | mountain | 624 | 626/626 admitted | 626/626 admitted | rail:Gütschlift | — |
| `93-251-5-j26-1` | 3090 · 2515 | mountain | 208 | 76/76 admitted | 82/82 admitted | rail:KSB | — |
| `93-251-6-j26-1` | 13600 · 2516 | mountain | 1954 | 0/1037 excluded | 0/1037 excluded | — | missing-line |
| `93-251-7-j26-1` | 13600 · 2517 | mountain | 132 | 0/70 excluded | 0/70 excluded | — | missing-line |
| `93-256-2-j26-1` | 13700 · 2562 | mountain | 59 | 51/51 admitted | 47/47 admitted | rail:LWRK | — |
| `93-4V-Y-j26-1` | 107 · ASC | mountain | 2 | 0/1020 excluded | 0/1020 excluded | — | missing-line |
| `93-82-j26-1` | 137 · 82 | mountain | 75 | 26/26 admitted | 29/29 admitted | rail:VRG | — |
| `93-88-j26-1` | 137 · 88 | mountain | 15 | 2/2 admitted | 3/3 admitted | rail:VRG | — |
| `94-360-0-j26-1` | 185 · 3600 | boat | 115 | 0/24 excluded | 0/28 excluded | — | stale-or-missing-boat-source |
| `94-360-1-j26-1` | 185 · 3601 | boat | 22 | 0/12 excluded | 0/16 excluded | — | stale-or-missing-boat-source |
| `94-360-2-j26-1` | 185 · 3602 | boat | 32 | 0/33 excluded | 0/33 excluded | — | stale-or-missing-boat-source |
| `94-360-3-j26-1` | 185 · 3603 | boat | 11 | 0/2 excluded | 0/6 excluded | — | stale-or-missing-boat-source |
| `94-360-4-j26-1` | 185 · 3604 | boat | 12 | 0/6 excluded | 0/6 excluded | — | stale-or-missing-boat-source |
| `94-360-5-j26-1` | 185 · 3605 | boat | 6 | 0/6 excluded | 0/6 excluded | — | stale-or-missing-boat-source |
| `94-365-2-j26-1` | 181 · 3652 | boat | 8 | 0/0 inactive | 0/5 excluded | — | stale-or-missing-boat-source |
| `94-365-3-j26-1` | 181 · 3653 | boat | 7 | 0/3 excluded | 0/4 excluded | — | stale-or-missing-boat-source |
| `96-350-0-j26-1` | 801 · 282 | bus | 41 | 25/25 admitted | 16/16 admitted | bus:B282 | — |
| `96-350-1-j26-1` | 801 · 281 | bus | 84 | 60/60 admitted | 24/24 admitted | bus:B281 | — |
| `96-350-2-j26-1` | 801 · 272 | bus | 142 | 52/52 admitted | 38/38 admitted | bus:B272 | — |
| `96-350-3-j26-1` | 801 · 271 | bus | 113 | 64/64 admitted | 62/62 admitted | bus:B271, OSM fallback | — |
| `96-350-4-j26-1` | 801 · 275 | bus | 25 | 25/25 admitted | 0/0 inactive | bus:B275 | — |
| `96-350-5-j26-1` | 801 · 261 | bus | 66 | 20/20 admitted | 16/16 admitted | bus:B261 | — |
| `96-350-6-j26-1` | 801 · 277 | bus | 14 | 14/14 admitted | 0/0 inactive | bus:B277 | — |
| `96-351-9-j26-1` | 801 · 214 | bus | 45 | 24/24 admitted | 0/0 inactive | bus:B214 | — |
| `96-352-0-j26-1` | 801 · 211 | bus | 102 | 37/37 admitted | 31/31 admitted | bus:B211 | — |
| `96-352-1-j26-1` | 801 · 71 | bus | 133 | 18/18 admitted | 25/25 admitted | bus:B071 | — |
| `96-352-2-j26-1` | 801 · 72 | bus | 98 | 45/45 admitted | 26/26 admitted | bus:B072 | — |
| `96-352-3-j26-1` | 801 · 73 | bus | 274 | 143/143 admitted | 111/111 admitted | bus:B073, OSM fallback | — |
| `96-352-4-j26-1` | 801 · 70 | bus | 76 | 77/77 admitted | 77/77 admitted | bus:B070 | — |
| `96-353-9-j26-1` | 801 · 252 | bus | 20 | 0/0 inactive | 8/8 admitted | OSM fallback | — |
| `96-354-0-j26-1` | 801 · 251 | bus | 149 | 54/54 admitted | 39/39 admitted | bus:B251, OSM fallback | — |
| `96-354-1-j26-1` | 801 · 241 | bus | 182 | 51/51 admitted | 50/50 admitted | OSM fallback | — |
| `96-354-2-j26-1` | 801 · 234 | bus | 8 | 0/0 inactive | 8/8 admitted | bus:B234 | — |
| `96-354-3-j26-1` | 801 · 221 | bus | 76 | 32/32 admitted | 24/24 admitted | bus:B221 | — |
| `96-354-4-j26-1` | 801 · 233 | bus | 72 | 20/22 partially-admitted | 14/14 admitted | bus:B233 | endpoint-gap |
| `96-354-5-j26-1` | 801 · 231 | bus | 18 | 18/18 admitted | 0/0 inactive | bus:B231 | — |
| `96-354-6-j26-1` | 801 · 232 | bus | 55 | 20/20 admitted | 22/22 admitted | bus:B232 | — |
| `96-356-8-j26-1` | 801 · 86 | bus | 190 | 78/78 admitted | 32/32 admitted | bus:B086 | — |
| `96-356-9-j26-1` | 801 · 85 | bus | 163 | 137/137 admitted | 75/75 admitted | bus:B085 | — |
| `96-357-0-j26-1` | 801 · 80 | bus | 65 | 22/22 admitted | 0/0 inactive | bus:B080 | — |
| `96-357-1-j26-1` | 801 · 82 | bus | 40 | 37/37 admitted | 19/19 admitted | bus:B082 | — |
| `96-357-2-j26-1` | 801 · 81 | bus | 44 | 44/44 admitted | 43/43 admitted | bus:B081 | — |
| `96-357-3-j26-1` | 801 · 83 | bus | 61 | 33/33 admitted | 24/24 admitted | bus:B083 | — |
| `96-357-4-j26-1` | 801 · 84 | bus | 123 | 121/121 admitted | 114/114 admitted | bus:B084 | — |
| `96-357-5-j26-1` | 801 · 398 | bus | 37 | 37/37 admitted | 37/37 admitted | bus:B398 | — |
| `96-357-6-j26-1` | 801 · 89 | bus | 40 | 26/26 admitted | 35/35 admitted | bus:B089 | — |
| `96-357-7-j26-1` | 801 · 110 | bus | 53 | 52/52 admitted | 28/28 admitted | bus:B110 | — |
| `96-357-8-j26-1` | 801 · 399 | bus | 38 | 35/35 admitted | 30/30 admitted | bus:B399 | — |
| `96-357-9-j26-1` | 801 · 87 | bus | 28 | 28/28 admitted | 0/0 inactive | bus:B087 | — |
| `96-358-0-j26-1` | 801 · 88 | bus | 60 | 30/30 admitted | 28/28 admitted | bus:B088 | — |
| `96-359-A-j26-1` | 801 · N73 | bus | 7 | 0/0 inactive | 6/6 admitted | bus:B973, OSM fallback | — |
| `96-359-B-j26-1` | 801 · N81 | bus | 4 | 0/0 inactive | 4/4 admitted | bus:B981 | — |
| `96-359-C-j26-1` | 801 · N72 | bus | 6 | 0/0 inactive | 6/6 admitted | bus:B972 | — |
| `96-359-D-j26-1` | 801 · N84 | bus | 6 | 0/0 inactive | 6/6 admitted | bus:B984 | — |
| `96-359-E-j26-1` | 801 · N85 | bus | 5 | 0/0 inactive | 5/5 admitted | bus:B985 | — |
| `96-359-F-j26-1` | 801 · N66 | bus | 4 | 0/0 inactive | 4/4 admitted | bus:B966 | — |
| `96-359-G-j26-1` | 801 · N5 | bus | 4 | 0/0 inactive | 4/4 admitted | bus:B905, OSM fallback | — |
| `96-359-H-j26-1` | 801 · N80 | bus | 4 | 0/0 inactive | 4/4 admitted | bus:B980 | — |

## Reproduction and validation

Use Node 24 or newer and unzip, with installed project dependencies. These commands build dated source artifacts; they do not alter existing Basel/Lausanne studies or deploy the website.

```sh
# Use the committed source directory for the measured snapshot.
node --max-old-space-size=4096 scripts/luzern-timetable.mjs \
  /private/tmp/GTFS_FP2026_20260902.zip \
  data/luzern-sources/boundary.json /private/tmp/luzern-timetable.json
node scripts/build-luzern-region.mjs /private/tmp/luzern-timetable.json
node scripts/check-luzern-region.mjs /private/tmp/luzern-timetable.json
node scripts/write-luzern-audit.mjs
node scripts/render-luzern-rail-review.mjs

# Offline source/artifact checks without the large national archive or cache.
node scripts/check-luzern-region.mjs
npx vitest run scripts/luzern-region.test.mjs \
  scripts/luzern-road-geometry.test.mjs scripts/enrich-postbus-roads.test.mjs \
  scripts/luzern-rail-geometry.test.mjs scripts/enrich-swiss-rail-geometry.test.mjs \
  scripts/basel-line-geometry.test.mjs scripts/gtfs-frequencies.test.mjs

# Optional new acquisition: review vintages, domains and crosswalk before using.
node scripts/download-luzern-sources.mjs /private/tmp/luzern-new-sources
```

The committed road cache, federal XTF and full rail-pattern inputs are required by the pinned policy, so ordinary reproduction needs no matcher or network access. To regenerate the cache, use the same PBF and pinned matcher inputs from the offline pipeline above:

```sh
node scripts/luzern-road-geometry.mjs prepare \
  /private/tmp/luzern-timetable.json /private/tmp/luzern-road-feed
# Run for each agency listed in luzern-road-feed/index.json:
node scripts/match-postbus-roads.mjs \
  --pfaedle /private/tmp/gleislicht-pfaedle/build/pfaedle \
  --osm /private/tmp/gleislicht-postbus-roads.osm.pbf \
  --config /private/tmp/gleislicht-pfaedle/pfaedle.cfg \
  --feed /private/tmp/luzern-road-feed/801 \
  --output /private/tmp/luzern-road-matched/801
node scripts/luzern-road-geometry.mjs import \
  /private/tmp/luzern-road-feed /private/tmp/luzern-road-matched \
  /private/tmp/luzern-road-cache.json /private/tmp/luzern-road-evidence
```

Review regenerated cache/evidence hashes before updating policy. Matcher elapsed times and warning-log timings can change between runs; the committed evidence preserves the measured run. No changed cache can silently replace the pinned input. All **60 scoped unit tests pass**, including consensus failure/conflict isolation, repeated-pair loops, reversed directions, changed identities, corrupt indices/endpoints, source hashes, detour/collapse limits and routing-only carry-in normalization. Rail tests additionally cover exact/ambiguous operating-point identities, reversed source geometry, called-station order, conflicting complete patterns, gauge/validity exclusion, station/topology attachment limits and detour rejection.

The checker independently verifies every stored source hash; exact ArcGIS object-ID sets; inventory totals; every chunk byte length/hash; duplicate journey consistency across chunks; morning membership; complete directed path endpoints; per-pattern, pair, route and agency totals; and admission/exclusion reconciliation. With the regenerated timetable cache it also replays **every admitted journey against all original GTFS calls, times, sequences, source-service-day identity and frequency metadata**. Unit tests cover exact donor-edge repairs and rejection of invented edges/changed snapshots/already-connected targets, truncated/duplicate pages, wrong CRS, changed operator domains/year, disconnected geometry, crossing-without-junction, reversal, loops, polygon holes, midnight carry-in, frequency semantics and rejection of malformed admitted paths.

The large source-line paths make the initial compressed manifests about 1.53 / 1.64 MiB; compressed morning files are 1.70 / 1.74 MiB. The largest compressed two-hour chunks are 173.3 / 118.6 KiB. These are measured data artifacts, not a claim that existing UI payload budgets or route-direction review gates have passed.
