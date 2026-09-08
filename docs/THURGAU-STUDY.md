# Thurgau canton transit study

Audit date: **8 September 2026**. Starting point: [Swiss transit source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#tg).

The complete canton-scoped GTFS inventory contains **132 route records across 15 agency identities**, with calls in all **five districts**. The regional feed admits **3545 Friday journeys and 1938 Sunday journeys**, each retaining every original call and a validated path for every directed segment. **This is partial geometry coverage, not a complete canton service feed.** 77 route records have all dated journeys admitted, 7 have partial admission, 27 are excluded, and 21 are inactive on both validation dates.

## Deliverables

- [Regional feed index](../public/data/thurgau-region/index.json): Friday **2026-09-04** and Sunday **2026-09-06**, each with a full civil-day manifest, twelve two-hour chunks and a 06:45–08:45 extract.
- [Complete route inventory](THURGAU-ROUTE-INVENTORY.md): every selected annual route, operator, source join, dated admission and exclusion reason.
- [Audit summary](../data/thurgau-audit/summary.json), [route records](../data/thurgau-audit/routes.json), [Friday patterns/pairs](../data/thurgau-audit/2026-09-04.json), [Sunday patterns/pairs](../data/thurgau-audit/2026-09-06.json).
- [All source line records](../data/thurgau-audit/source-lines.json), [all 718 source stops](../data/thurgau-audit/source-stops.json), [canton GTFS stop inventory](../data/thurgau-audit/stops.json), [reviewed route crosswalk](../data/thurgau-line-crosswalk.json).
- [Source metadata and request hashes](../data/thurgau-sources/sources.json), [raw request receipts](../data/thurgau-sources/requests.json). Original responses, boundary rows and the selected timetable fixture are preserved as gzip files in the repository.
- [Regional bus road evidence](../data/thurgau-regional-roads/sources.json), [review notes](../data/thurgau-regional-roads/review-sources.json), and [OSM-derived regional path database](../public/data/thurgau-region/regional-road-paths.json).
- [City road source evidence](../data/thurgau-city-roads/sources.json), [OSM-derived city path database](../public/data/thurgau-region/city-road-paths.json), and [16-line geometry review](assets/thurgau-city-road-review.png).

## Whole-canton membership

The scanner reads **all 2,143,227 trip records and 34,499,152 stop-time records** in the pinned national archive. A route belongs to the inventory if any original call falls in the unsimplified swissBOUNDARIES3D **2026-01** Thurgau polygon. No operator whitelist or rectangular crop selects membership. Parent/platform records are kept distinct; 1686 in-canton platform/stop IDs are actually called by these routes. Polygon membership, not the source bus-stop list, defines the denominator.

| District | Called GTFS stop IDs | Annual route records |
| --- | --- | --- |
| Weinfelden | 359 | 45 |
| Frauenfeld | 589 | 60 |
| Arbon | 250 | 37 |
| Kreuzlingen | 333 | 36 |
| Münchwilen | 155 | 27 |

District route counts overlap. Journeys retain **every call outside Thurgau**, including Swiss and foreign termini; a route passing through without any in-canton stop does not enter this stop-based census. Full patterns extending beyond the available geometry are excluded, not shortened at the border. This includes the Lake Constance/Rhine services of URh, SBS, BSB and the Reichenau solar ferry. City, replacement, night and seasonal route records remain inventoried even when geometry is absent or no service operates on these dates.

| Agency ID | GTFS identity | Annual routes | Friday admitted / total | Sunday admitted / total |
| --- | --- | --- | --- | --- |
| 11 | Schweizerische Bundesbahnen SBB | 9 | 0 / 144 | 0 / 106 |
| 22 | Appenzeller Bahnen (ab) | 1 | 98 / 98 | 82 / 82 |
| 65 | THURBO | 23 | 123 / 677 | 102 / 707 |
| 138 | Bus Ostschweiz | 18 | 916 / 946 | 492 / 521 |
| 193 | Schweiz. Schifffahrtsgesellschaft Untersee und Rhein AG | 1 | 0 / 17 | 0 / 17 |
| 195 | Schweizerische Bodensee-Schifffahrt AG | 3 | 0 / 37 | 0 / 34 |
| 360 | Bodensee-Schiffsbetriebe GmbH | 2 | 0 / 20 | 0 / 18 |
| 727 | Verkehrsbetriebe Kreuzlingen | 6 | 487 / 487 | 200 / 200 |
| 744 | Automobildienst Appenzeller Bahnen | 2 | 1 / 1 | 0 / 0 |
| 797 | Stadtbus Frauenfeld | 11 | 574 / 589 | 194 / 224 |
| 801 | PostAuto AG | 40 | 1288 / 1325 | 868 / 868 |
| 896 | Regiobus Gossau SG | 1 | 58 / 58 | 0 / 0 |
| 3182 | Solarfährbetrieb Thomas Geiger Reichenau | 1 | 0 / 18 | 0 / 18 |
| 7231 | SBB Infrastruktur AG Bahnersatz | 13 | 0 / 0 | 0 / 0 |
| 7252 | Appenzeller Bahnen Ersatzverkehr | 1 | 0 / 0 | 0 / 0 |

Four official call-taxi polygons are separately recorded in the audit: Bischofszell (Schweizersholz/Halden), Hohentannen (Heldswil), Erlen (Buchackern/Eppishausen), and one unnamed feature. The first three carry **80.945**. They define service areas, not fixed movements, and are excluded from the vehicle feed. A fixed-stop GTFS scan cannot prove completeness for services absent from the archive or for unrepresented flexible-service areas.

## Sources, dates and attribution

| Source | Pinned evidence / vintage | Credit and reuse |
| --- | --- | --- |
| National GTFS | Feed 20260902; valid 2025-12-14–2026-12-12. SHA-256 d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e | SBB / Open data platform mobility Switzerland; opentransportdata.swiss terms, not a blanket CC licence |
| Thurgau WFS | Full original GML responses acquired 2026-09-08; EPSG:2056. Geometry effective date UNKNOWN. | © Kanton Thurgau, Abteilung Öffentlicher Verkehr; Amt für Geoinformation. CC BY 4.0 declared by the cantonal dataset catalogue |
| Cantonal catalogue | Modified 2026-07-31T18:00:13+00:00; creation 2000-01-01 is not a geometry vintage | Pinned catalogue.json records the dataset-specific licence and publisher |
| Thurgau general terms | 2018-02-20; preserved alongside the catalogue declaration | Visible attribution on publication/redistribution; retain dataset-specific CC BY evidence |
| swissBOUNDARIES3D | 2026-01; all original canton and district geometry rows retained | © swisstopo; free-geodata terms |
| City and regional road supplements | Geofabrik Switzerland 2026-09-02 plus OSM border extract 2026-09-08; pinned PBF SHA d5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b | © OpenStreetMap contributors; derived path database under ODbL 1.0 |

Official references: [national GTFS dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [national terms](https://opentransportdata.swiss/en/terms-of-use/), [Thurgau catalogue API](https://data.tg.ch/api/explore/v2.1/catalog/datasets/netz-des-offentlichen-verkehrs), [Thurgau WFS](https://ows.geo.tg.ch/geofy_access_proxy/oev?Request=GetCapabilities&Service=WFS&Version=2.0.0), [general terms](https://shop.geo.tg.ch/sites/default/files/pdf/Nutzungsbedingungen_Geodaten.pdf), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [swisstopo terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices).

The WFS layer metadata supplies no effective geometry date. Neither its response timestamp, the catalogue's July modification, nor its placeholder 2000 creation date proves a 2026 timetable alignment. This study explicitly labels the geometry vintage unknown. The [official 2026 eastern Switzerland rail map](https://www.thurbo.ch/fileadmin/user_upload/1_Reisen/Reiseinfos/L-11_SBB-RV-Ostschweiz-A1-26-SID.pdf) provides a network review aid (including S10 Wil–Weinfelden–Romanshorn and S15 Wil–Wängi–Frauenfeld); it is not used as digitized geometry or redistributed here.

Gleislicht authors the processed feed. Modifications comprise route selection, source graph construction, stop projection, bounded stop-access connectors, conversion to WGS84, output rounding and scheduled interpolation. The feed carries attribution, licence/terms URLs and local copies of the Thurgau licence evidence. It is an archival study, not current operational or realtime data; a refresh requires a new source snapshot and full revalidation.

## Source adapter and exclusions

| WFS layer | Records | Role |
| --- | --- | --- |
| buslinie | 337 | Route-attributed bus centreline segments |
| bahnlinie_takt | 17 | 17 rail corridor segments, including two explicitly labelled S15 |
| buslinie_takt | 337 | Frequency-rendering duplicate; acquired and inventoried, not a second geometry source |
| bushalte | 718 | DiDok + line + operator evidence |
| sammeltaxi | 4 | Service-area inventory; excluded from fixed movements |
| dist_bahn / dist_bus | Not downloaded | Advertised accessibility-distance layers; excluded because they are not vehicle paths |

All **354 bus/rail geometry records** are retained in the line audit; 239 have route-crosswalk candidates. These are segmented source features, not that many passenger lines. Candidate status does not mean every vertex is used or every joined route is admitted.

Bus joins require an exact prefixed line number, a reviewed operator label, and at least **two distinct shared DiDok stops** between the source stop layer and the canton-scoped GTFS route. Reviewed source labels are PostAuto → 801, Bus Ostschweiz → 138 and REGO → 896. Each route's evidence IDs are saved. The GTFS line names alone are not unique operator identities. Prefix 70 is explicitly assigned only to 605/806; other reviewed regular bus codes use 80. A source token **20.207** is retained as written and is never silently corrected to 80.207.

Comma-separated source numbers are parsed independently. Parenthetical **nur zeitweise**, **Abendkurs** and **Kantibus** tokens are excluded from that route's graph because no operating-time rule is supplied; an unqualified token for another line on the same feature can still be used. **BN820** is not assumed to mean the GTFS line 820. Day and night labels are respected. The official line source lacks Frauenfeld and Kreuzlingen city routes; the separate OSM supplement below covers their fixed-route patterns. Replacement route records remain inventoried; the dated fixed service of operator 744 receives an independently identified GTFS/OSM pattern in the regional supplement.

For rail, SBB/THURBO use the 15 unlabelled regional corridor features as a routing graph; these are not preassigned GTFS line shapes. AB **S15** uses only its two explicitly labelled Frauenfeld–Wängi–Wil features, separately from the other rail graph. Full stop-chain geometry tests determine admission. Lake services have no acquired water-compatible geometry and receive no road or rail substitute.

Original **EPSG:2056 east/north** vertices form the graph. The parser asserts CRS, axis ranges, unique IDs and full WFS returned/matched counts. Exact source vertices define connectivity; no gap is bridged and no near-coincident tracks are merged. The established swisstopo approximate LV95/WGS84 conversion has metre-level precision. Output coordinates round to seven decimals.

Every directed segment must project within **80 m for bus / 120 m for rail**. The path follows existing source edges; inferred connectors link the actual platform coordinates to the source line within those limits. Detours may not exceed the larger of 4.5 × straight-line distance and 1,200 m (bus) / 3,000 m (rail). Alternative projections can differ by at most 5 m from the nearest projection. No simplification or automatic connector between disconnected source parts is added.

Direction comes from the ordered GTFS platform chain, not a source road-direction field. This does **not** certify one-way access, a specific running track, bridge/tunnel correctness, a loop's exact operational alignment, or temporary diversions. Shortest source-path inference and bounded stop-access connectors remain model assumptions. Complete geometry is necessary for admission; it is not observed movement.

## City road supplement

The initial official-geometry feed admitted 376 Friday / 293 Sunday journeys. The city supplement adds **1061 / 394 journeys**, bringing the earlier city-stage totals to **1437 / 687** before the regional extension below. All **six Kreuzlingen fixed routes (901, 902, 903, 905, 906, 907)** and **ten Frauenfeld fixed routes (801–805, 811–815)** are now admitted for both dates when scheduled. These account for 77 unique routing patterns across the two dates, with 16,980 scheduled segment occurrences and no matcher rejections. Per-day pattern counts can differ because the regional audit also preserves GTFS direction IDs.

The [official Frauenfeld timetable](https://www.frauenfeld.ch/wohnen-mobilitaet/mobilitaet/stadtbus/fahrplan.html/680), valid from 14 December 2025, distinguishes daytime 801–805 from evening/Sunday 811–815. Its night taxi drops passengers at requested destinations; **NT stays excluded**, including 15 Friday and 30 Sunday civil-day instances. The [Kreuzlingen city page](https://www.kreuzlingen.ch/lebenslagen/mobilitaet/oeffentlicher-verkehr) confirms six lines and Sunday service. These pages establish service scope, not street geometry. [Review notes](../data/thurgau-city-roads/review-sources.json) distinguish web-readable evidence from a failed direct HTML download; no unacquired source snapshot is claimed.

Road geometry uses pinned **pfaedle 99f2cd466696ecc6bdb73b2b3bb9008557fcb84a**, its unmodified bus profile, and the existing hashed Swiss/border OSM extract. The run enables **--no-trie -W** so every fallback hop is reported. Original pattern index, matcher log, shapes, stop times, trips and run hashes are preserved for each city. Offline verification reimports those outputs and requires exact equality with the derived cache. Maximum road snaps are **71.2 m Kreuzlingen / 38.8 m Frauenfeld** (rounded upwards), below the 120 m road limit; detour guard is max(6 × direct distance, 1,500 m), with 5 m simplification. These are separate from the tighter cantonal bus limits above.

Cache identity includes the exact GTFS route ID, complete ordered platform IDs and coordinates. Missing/changed patterns fail the build; no stop-pair or reverse-direction cache borrowing is allowed. Repeated loop calls are sliced with monotone source shape distances. Each journey retains its own pattern's geometry even where a directed pair has several path variants. Official source paths are preserved; the road supplement applies only to agencies 727 and 797. The resulting city database is OSM-derived **ODbL 1.0**, separately attributed from the cantonal CC BY geometry. The complete derived city database is distributed beside the regional feed.

![All 16 city lines with directed road-pattern overlays](assets/thurgau-city-road-review.png)

The plot was inspected for all 16 lines, including opposite directions, branches, termini and evening loops. It is a geometry overview without a basemap; it does not independently certify every street restriction or actual operator routing. The matcher uses supported OSM bus access, one-way and turn restrictions, whose accuracy and temporary changes remain source limitations.

## Regional bus road supplement

The regional supplement adds **2108 Friday / 1251 Sunday journeys** to the city-stage feed. It routes the complete, uncropped dated patterns for fixed buses operated by **Bus Ostschweiz (138), Automobildienst Appenzeller Bahnen (744), PostAuto (801) and Regiobus (896)**. GTFS operator and route IDs establish these road-pattern identities directly; this does not assert a previously unresolved cantonal line crosswalk or alter original WFS labels.

| Agency | Routing patterns | Complete road patterns | Rejected segments | Maximum snap (m) |
| --- | --- | --- | --- | --- |
| 138 | 67 | 67 | 0 | 89.13 |
| 744 | 1 | 1 | 0 | 26.74 |
| 801 | 226 | 222 | 4 | 108.01 |
| 896 | 2 | 2 | 0 | 33.99 |

Across **59 fixed route records**, **292 of 296** routing patterns pass every road-segment check. Matcher runs on **8 September 2026** use the same pinned binary, unmodified bus configuration and Swiss/border OSM source as the city supplement. The 120 m snap, max(6 × direct, 1,500 m) detour and 5 m simplification limits are unchanged. Original patterns, log, shapes, trips, stop times and run receipts are preserved separately for each operator. Verification pins binary/config/source hashes and reimports every accepted and rejected segment from those original outputs. These are inferred road shapes, not newly acquired operator alignment data.

Complete official patterns retain their original paths. For an incomplete official pattern, the road supplement must provide the **entire exact ordered platform-and-coordinate chain**; it cannot patch a gap with another pattern's segment. Missing cache identities fail the build. Known rejected road patterns retain their official geometry diagnostics and remain excluded as whole journeys. Each admitted train keeps its own pattern geometry, even when another pattern traverses the same directed stop pair differently.

**Wittenbach Zentrum:** four PostAuto routing patterns on 200 and 207 give distinct platforms 73966:0:341297 and 73966:0:256909 identical matcher shape distances (0.0). The importer cannot extract a positive-length road segment. Their **37 Friday journeys** remain excluded with missing-shape evidence; neither call is dropped and no connector is invented.

**RUB:** route 92-8-Y-j26-1 is GTFS type **715**, which denotes demand-responsive bus service in the [extended GTFS route reference](https://developers.google.com/transit/gtfs/reference/extended-route-types), last updated 16 October 2024 and checked 8 September 2026. Ordinary pickup/drop-off flags alone do not establish fixed operation. Its **30 Friday and 29 Sunday** instances remain excluded, alongside Frauenfeld NT. [Review notes](../data/thurgau-regional-roads/review-sources.json) preserve the source interpretation; they do not claim an original HTML snapshot.

The review plots overlay all 296 routing patterns across 59 route records: [page 1](assets/thurgau-regional-road-review-1.png), [page 2](assets/thurgau-regional-road-review-2.png), [page 3](assets/thurgau-regional-road-review-3.png), [page 4](assets/thurgau-regional-road-review-4.png). Every panel was inspected for branch shapes and endpoint loops. Grey paths include valid segments from incomplete patterns; their presence in a review plot is not feed admission. The plots have no basemap and do not certify temporary diversions or physical street restrictions. The complete regional derived database is distributed under **ODbL 1.0**, credited to **OpenStreetMap contributors**, separately from the cantonal CC BY geometry.

## Weekday and Sunday directed validation

The date model is **local civil day 00:00–24:00**, including previous-service-day spillover (Thursday into Friday and Saturday into Sunday). Calendar exceptions apply. Frequency expansion and reservation permissions are handled; this selected fixture has zero active frequency templates. Original calls and pickup/drop-off permissions remain in exported journeys. A reservation/on-demand call, type-715 route or any failed segment excludes the entire journey.

The admitted feeds retain **8920 / 4714 zero-duration segment occurrences (Friday / Sunday)** where different stops share a timetable minute. No artificial seconds are inserted and no finite speed is assigned to those segments. Each day's timing diagnostics also retain the largest positive-duration implied speed by mode; the Sunday rail maximum is about 214 km/h on an SN30 segment. These are source-timing/model limitations, not measured or certified operating speeds. Geometry admission does not establish physically realistic timing at every call.

Pattern identity is GTFS **route ID + direction_id + full ordered original platform IDs**, including repeated calls and out-of-canton stops. Stop pairs remain ordered and route-scoped. A matched directed pair means at least one pattern context has a path. Segment-occurrence coverage is counted from each pattern’s own paths; a successful context does not confer coverage on a failed context of the same pair. Both include otherwise excluded incomplete journeys and must not be confused with admitted-feed counts.

| Measure | Friday 4 September | Sunday 6 September |
| --- | --- | --- |
| Dated journeys | 4417 | 2795 |
| Admitted journeys | 3545 (80.3%) | 1938 (69.3%) |
| Complete admitted patterns / all patterns | 346 / 563 | 244 / 442 |
| Matched directed pairs / all directed pairs | 3107 / 3529 (88.0%) | 3028 / 3425 (88.4%) |
| Matched scheduled segments / all occurrences | 61088 / 64684 (94.4%) | 37858 / 41271 (91.7%) |
| Segments in admitted journeys | 53327 | 30681 |
| Carry-in journeys: admitted / total | 31 / 58 | 105 / 167 |
| Night-labelled journeys: admitted / total | 0 / 15 | 53 / 105 |
| Patterns revisiting platforms: admitted / total | 19 / 21 | 11 / 13 |

**305 patterns are shared**, **258 occur only on Friday**, and **137 occur only on Sunday**. Both direction IDs 0 and 1 are evaluated. All exported journeys have geometry for 100% of their segments; this does not turn canton-wide coverage into 100%.

| Unmatched directed-pair reason | Friday | Sunday |
| --- | --- | --- |
| missing-line | 153 | 153 |
| endpoint-gap | 264 | 244 |
| disconnected-line | 4 | 0 |
| collapsed-path | 1 | 0 |
| implausible-detour | 0 | 0 |

Endpoint gaps can reflect source extent, missing termini, stop offsets or stale alignment; disconnections reflect exact source topology. No threshold was increased to hide these failures. All rejected pairs, their endpoint names and gap diagnostics are saved in each day's audit.

## Admitted routes

Counts below refer only to the two validated civil dates. Multiple records can share a passenger-facing number.

| Agency | Line | GTFS route ID | Friday admitted / total | Sunday admitted / total |
| --- | --- | --- | --- | --- |
| 22 | S15 | 91-15-I-j26-1 | 98 / 98 | 82 / 82 |
| 65 | S1 | 91-1-C-j26-1 | 2 / 94 | 3 / 94 |
| 65 | S5 | 91-5-B-j26-1 | 44 / 80 | 43 / 79 |
| 65 | S10 | 91-10-C-j26-1 | 75 / 75 | 45 / 45 |
| 65 | S82 | 91-82-j26-1 | 2 / 2 | 0 / 0 |
| 65 | SN14 | 91-14-I-j26-1 | 0 / 0 | 5 / 6 |
| 65 | SN30 | 91-30-L-j26-1 | 0 / 0 | 1 / 7 |
| 65 | SN71 | 91-71-B-j26-1 | 0 / 0 | 4 / 4 |
| 65 | SN72 | 91-72-B-j26-1 | 0 / 0 | 1 / 5 |
| 138 | 702 | 92-702-D-j26-1 | 114 / 114 | 24 / 24 |
| 138 | 706 | 92-706-C-j26-1 | 52 / 52 | 36 / 36 |
| 138 | 722 | 92-722-A-j26-1 | 27 / 27 | 40 / 40 |
| 138 | 732 | 92-732-M-j26-1 | 99 / 99 | 60 / 60 |
| 138 | 732 | 92-732-N-j26-1 | 0 / 0 | 5 / 5 |
| 138 | 733 | 92-733-I-j26-1 | 68 / 68 | 40 / 40 |
| 138 | 734 | 92-734-K-j26-1 | 53 / 53 | 39 / 39 |
| 138 | 735 | 92-735-C-j26-1 | 53 / 53 | 39 / 39 |
| 138 | 736 | 92-736-A-j26-1 | 44 / 44 | 0 / 0 |
| 138 | 739 | 92-739-B-j26-1 | 60 / 60 | 0 / 0 |
| 138 | 820 | 92-820-A-j26-1 | 0 / 0 | 6 / 6 |
| 138 | 940 | 92-940-B-j26-1 | 120 / 120 | 56 / 56 |
| 138 | 941 | 92-941-A-j26-1 | 68 / 68 | 38 / 38 |
| 138 | 942 | 92-942-A-j26-1 | 59 / 59 | 55 / 55 |
| 138 | 943 | 92-943-A-j26-1 | 99 / 99 | 42 / 42 |
| 138 | N50 | 92-N50-A-j26-1 | 0 / 0 | 6 / 6 |
| 138 | N90 | 92-N90-B-j26-1 | 0 / 0 | 6 / 6 |
| 727 | 901 | 92-901-j26-1 | 162 / 162 | 72 / 72 |
| 727 | 902 | 92-902-j26-1 | 162 / 162 | 71 / 71 |
| 727 | 903 | 92-903-j26-1 | 78 / 78 | 0 / 0 |
| 727 | 905 | 92-905-j26-1 | 9 / 9 | 9 / 9 |
| 727 | 906 | 92-906-j26-1 | 9 / 9 | 2 / 2 |
| 727 | 907 | 92-907-j26-1 | 67 / 67 | 46 / 46 |
| 744 | 841 | 92-841-j26-1 | 1 / 1 | 0 / 0 |
| 797 | 801 | 92-801-A-j26-1 | 119 / 119 | 0 / 0 |
| 797 | 802 | 92-802-A-j26-1 | 118 / 118 | 0 / 0 |
| 797 | 803 | 92-803-A-j26-1 | 116 / 116 | 0 / 0 |
| 797 | 804 | 92-804-A-j26-1 | 58 / 58 | 0 / 0 |
| 797 | 805 | 92-805-C-j26-1 | 137 / 137 | 0 / 0 |
| 797 | 811 | 92-811-B-j26-1 | 6 / 6 | 54 / 54 |
| 797 | 812 | 92-812-A-j26-1 | 8 / 8 | 56 / 56 |
| 797 | 813 | 92-813-B-j26-1 | 4 / 4 | 28 / 28 |
| 797 | 814 | 92-814-B-j26-1 | 4 / 4 | 28 / 28 |
| 797 | 815 | 92-815-B-j26-1 | 4 / 4 | 28 / 28 |
| 801 | 200 | 96-220-5-j26-1 | 48 / 79 | 76 / 76 |
| 801 | 200 | 96-220-A-j26-1 | 0 / 0 | 7 / 7 |
| 801 | 201 | 96-250-A-j26-1 | 72 / 72 | 0 / 0 |
| 801 | 205 | 96-221-4-j26-1 | 20 / 20 | 0 / 0 |
| 801 | 207 | 96-220-6-j26-1 | 6 / 12 | 0 / 0 |
| 801 | 210 | 96-250-8-j26-1 | 66 / 66 | 35 / 35 |
| 801 | 211 | 96-220-8-j26-1 | 68 / 68 | 37 / 37 |
| 801 | 211 | 96-220-B-j26-1 | 0 / 0 | 5 / 5 |
| 801 | 605 | 96-189-4-j26-1 | 32 / 32 | 26 / 26 |
| 801 | 722 | 96-202-0-j26-1 | 20 / 20 | 19 / 19 |
| 801 | 740 | 96-228-3-j26-1 | 38 / 38 | 35 / 35 |
| 801 | 740 | 96-228-B-j26-1 | 0 / 0 | 5 / 5 |
| 801 | 806 | 96-184-9-j26-1 | 18 / 18 | 0 / 0 |
| 801 | 807 | 96-185-1-j26-1 | 12 / 12 | 10 / 10 |
| 801 | 819 | 96-202-7-j26-1 | 26 / 26 | 24 / 24 |
| 801 | 822 | 96-200-2-j26-1 | 33 / 33 | 30 / 30 |
| 801 | 823 | 96-200-3-j26-1 | 47 / 47 | 31 / 31 |
| 801 | 825 | 96-200-4-j26-1 | 52 / 52 | 40 / 40 |
| 801 | 826 | 96-200-6-j26-1 | 54 / 54 | 39 / 39 |
| 801 | 829 | 96-200-8-j26-1 | 41 / 41 | 41 / 41 |
| 801 | 831 | 96-201-4-j26-1 | 18 / 18 | 0 / 0 |
| 801 | 832 | 96-201-3-j26-1 | 18 / 18 | 16 / 16 |
| 801 | 833 | 96-200-7-j26-1 | 31 / 31 | 26 / 26 |
| 801 | 834 | 96-200-9-j26-1 | 54 / 54 | 38 / 38 |
| 801 | 836 | 96-201-2-j26-1 | 46 / 46 | 30 / 30 |
| 801 | 837 | 96-202-5-j26-1 | 39 / 39 | 38 / 38 |
| 801 | 838 | 96-201-0-j26-1 | 33 / 33 | 30 / 30 |
| 801 | 847 | 96-204-0-j26-1 | 29 / 29 | 26 / 26 |
| 801 | 848 | 96-203-9-j26-1 | 18 / 18 | 0 / 0 |
| 801 | 908 | 96-203-0-j26-1 | 60 / 60 | 26 / 26 |
| 801 | 920 | 96-203-1-j26-1 | 30 / 30 | 20 / 20 |
| 801 | 921 | 96-203-2-j26-1 | 33 / 33 | 30 / 30 |
| 801 | 923 | 96-203-3-j26-1 | 60 / 60 | 28 / 28 |
| 801 | 924 | 96-203-5-j26-1 | 35 / 35 | 26 / 26 |
| 801 | 925 | 96-203-6-j26-1 | 9 / 9 | 11 / 11 |
| 801 | 931 | 96-203-8-j26-1 | 30 / 30 | 14 / 14 |
| 801 | 932 | 96-202-1-j26-1 | 33 / 33 | 20 / 20 |
| 801 | 944 | 96-203-7-j26-1 | 34 / 34 | 15 / 15 |
| 801 | 950 | 96-228-7-j26-1 | 25 / 25 | 12 / 12 |
| 801 | N65 | 96-185-9-j26-1 | 0 / 0 | 2 / 2 |
| 896 | 731 | 92-731-j26-1 | 58 / 58 | 0 / 0 |

## Reproduction and checks

Run from the repository root with Node, installed project dependencies, Python 3 and unzip. Source preparation uses Python's standard library; downloading additionally uses curl.

```sh
# Re-decode preserved original GML and boundary rows without network access.
python3 scripts/prepare-thurgau-sources.py

# Full canton census and build from the pinned national archive (two complete
# stop-times scans; no city/operator whitelist). The crosswalk must reproduce.
node --max-old-space-size=8192 scripts/build-thurgau-region.mjs \
  --archive /private/tmp/GTFS_FP2026_20260902.zip

# Faster identical build from the preserved selected timetable fixture.
node scripts/build-thurgau-region.mjs \
  --archive /private/tmp/GTFS_FP2026_20260902.zip \
  --timetable-cache data/thurgau-audit/timetable-cache.json.gz

# Recompute crosswalk evidence and every directed match; compare every exported
# stop, path, edge and journey; reconcile routes, groups, patterns and chunks.
node scripts/check-thurgau-region.mjs
node scripts/document-thurgau-study.mjs
npx vitest run scripts/thurgau-regional-roads.test.mjs scripts/thurgau-region.test.mjs scripts/thurgau-city-roads.test.mjs scripts/bern-region.test.mjs
python3 scripts/test_thurgau_sources.py
```

For a new acquisition, use `python3 scripts/prepare-thurgau-sources.py --download --boundary PATH_TO_2026_GPKG`, run `node --max-old-space-size=8192 scripts/thurgau-timetable.mjs PATH_TO_PINNED_GTFS`, then `node scripts/crosswalk-thurgau.mjs` and review changes before rebuilding. A new source snapshot invalidates the old timetable cache. Do not reuse an unreviewed geometry vintage or relax admission rules merely to increase counts.

To rebuild the city supplement, run `node scripts/prepare-thurgau-city-roads.mjs`, then `scripts/match-postbus-roads.mjs` separately for agency directories 727 and 797 with the pinned binary/config/PBF described in [PostBus road geometry](POSTBUS-ROAD-GEOMETRY.md). Use `--output /private/tmp/thurgau-city-road-matched/AGENCY`, then run `node scripts/import-thurgau-city-roads.mjs` and `node scripts/check-thurgau-city-roads.mjs`. The plot generator `scripts/review-thurgau-city-roads.py` uses Pillow and the macOS Helvetica font. Review every changed path before replacing the committed complete-pattern supplement.

To rebuild the regional supplement, run `node scripts/prepare-thurgau-regional-roads.mjs`, then the same matcher separately for agency directories 138, 744, 801 and 896, using input `/private/tmp/thurgau-regional-road-feeds/AGENCY` and output `/private/tmp/thurgau-regional-road-matched/AGENCY`. Run `node scripts/import-thurgau-regional-roads.mjs`, `node scripts/check-thurgau-regional-roads.mjs` and `scripts/review-thurgau-regional-roads.py` with a Pillow-enabled Python, inspect every panel and rejection, then rebuild and check the regional feed. Pinned review notes distinguish source dates and admission decisions.

Validation covers source hashes, GML counts/axes/IDs, full canton/district membership, operator/line identity, direction and loop preservation, midnight spillover, whole-pattern rejection, repeated geometry replay, exact exported paths, complete calls, finite ordered times, all 24 chunk hashes and trip identities. **Two September days do not establish public-holiday, winter, summer-only or year-round completeness.** Temporary diversions and physical one-way/track legality remain unverified.
