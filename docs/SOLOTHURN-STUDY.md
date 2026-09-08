# Solothurn canton transit study

Built from the pinned 2026 timetable and the cantonal public-transport network. **All 193 canton-serving route records across 19 GTFS agency identities and all ten districts are inventoried. 55 route records contribute admitted journeys.** This is a whole-canton census with partial geometry admission, not complete service coverage.

Start with the [complete route admission/exclusion inventory](SOLOTHURN-ROUTE-INVENTORY.md), [machine audit](../data/solothurn-audit/summary.json) and [regional feed index](../public/data/solothurn-region/index.json). The original [national source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#so) explains source discovery.

## Scope and denominator

At least one original GTFS call coordinate in the unsimplified 2026 Solothurn canton polygon. Full journey retained, including every call outside Solothurn. No operator whitelist. The boundary is the unsimplified swissBOUNDARIES3D **2026-01** canton polygon, including Dorneck/Thierstein and detached parts. Every one of the national archive's 34'499'152 stop-time rows was scanned for membership across 2'143'227 trip records. 2'342 GTFS stop records are inside the canton; only 1'575 are called by the selected annual routes. Stop records include platforms and parent records; these are not counts of unique passenger stop places.

No agency whitelist or tariff boundary defines membership. Libero, A-Welle and TNW interfaces are represented by actual calls. The inventory includes national rail, PostAuto, local bus, replacement bus, BLT tram, Bielersee shipping and Weissenstein cableway identities. Representative agency IDs in the source survey were leads, not this denominator. Routes crossing the canton without any stop inside are outside the stated census. Services absent from fixed-stop GTFS, flexible service areas, and informal/private services are not claimed complete.

The 42 inactive route records remain in the annual inventory. “Annual” means trip records in the pinned annual archive, not proven service on every day or a census of every seasonal operating pattern. Friday **4 September 2026** and Sunday **6 September 2026** use calendar exceptions, frequency expansion and previous-service-day spillover. Two September days do not establish holiday, winter or year-round completeness.

## Weekday and Sunday directed patterns

| Measure | Friday 2026-09-04 | Sunday 2026-09-06 |
| --- | --- | --- |
| Civil-day journey instances | 7'156 | 5'819 |
| Scheduled instances | 6'078 | 4'711 |
| Representative headway instances | 1'078 | 1'108 |
| Admitted scheduled instances | 2'064 | 1'466 |
| Admitted representative headway instances | 1'078 | 1'108 |
| Total admitted instances | 3'142 | 2'574 |
| Distinct directed patterns | 921 | 777 |
| Admitted complete patterns | 223 | 156 |
| Matched route-specific directed stop pairs | 3'004 / 4'259 (70.5%) | 2'611 / 4'467 (58.5%) |
| Matched scheduled segment occurrences | 78'023 / 97'358 (80.1%) | 49'494 / 68'102 (72.7%) |
| Matched all segment occurrences | 79'101 / 98'436 (80.4%) | 50'602 / 69'210 (73.1%) |
| Segment occurrences in admitted whole journeys | 30'649 | 20'132 |
| Previous-day carry-in / admitted | 149 / 32 | 359 / 88 |
| Patterns revisiting a platform / admitted | 21 / 5 | 18 / 7 |
| Explicit night journeys / admitted | 0 / 0 | 72 / 0 |

Pattern identity includes the GTFS route ID, direction_id and the full ordered original platform IDs, including repeats and out-of-canton calls. Both directions 0 and 1 occur. There are **343 shared patterns**, **578 Friday-only** and **434 Sunday-only** patterns. Exact per-pattern matched masks, decisions and counts are retained in the [Friday audit](../data/solothurn-audit/2026-09-04.json) and [Sunday audit](../data/solothurn-audit/2026-09-06.json).

Every admitted journey keeps every original source call, has an oriented geometry path for every adjacent pair, finite nondecreasing source times and intact call permissions. A missing segment excludes the whole journey; no call chain is cropped to improve coverage. Matched segments in an excluded journey remain in the audit denominator but are not emitted as partial vehicles. Pair counts are route-specific; shared road segments do not collapse distinct route identities.

Weissenstein accounts for all 1'078 / 1'108 representative exactTimes=0 headway instances. These are not that many observed cabins or exact scheduled departures. All motion is scheduled interpolation, not GPS or realtime observations.

Original GTFS times can place distinct calls in the same minute. The admitted feeds retain **1'901 / 1'257 zero-duration segment occurrences**. These cannot imply finite measured speed; animation can jump at the common timestamp. The audit lists the affected directed pairs and nominal positive-duration speeds. Geometry admission is not certification of physical vehicle speed, and no sub-minute times are fabricated.

## Entire-canton district coverage

| District | Called GTFS platforms | Annual route records | Routes calling district in feed | Platforms called in feed |
| --- | --- | --- | --- | --- |
| Lebern | 210 | 52 | 18 | 152 |
| Thierstein | 153 | 9 | 7 | 93 |
| Dorneck | 163 | 10 | 2 | 24 |
| Gäu | 134 | 29 | 3 | 8 |
| Wasseramt | 94 | 33 | 12 | 70 |
| Gösgen | 161 | 13 | 7 | 91 |
| Thal | 129 | 7 | 5 | 116 |
| Solothurn | 69 | 53 | 13 | 39 |
| Olten | 354 | 94 | 9 | 66 |
| Bucheggberg | 108 | 10 | 6 | 44 |

District route counts overlap because one route may serve multiple districts. Feed columns require an actually admitted journey calling the district; admission elsewhere on the same route does not count. The source polygon, not town-name matching, assigns districts. The census discloses 13 GTFS records within 10 metres of the boundary, including both sides at Salhöhe, Dornach Bahnhof, Bärschwil Station, Nuglar and Erlinsbach. They are reported without silently buffering the canton. The approximate coordinate transform has metre-level precision; this is a disclosed membership sensitivity, not a survey-accuracy claim.

## Network adapter and exclusions

The retained source has **3,951 MultiLineString network records and 775 point stops** in EPSG:2056. There are no line numbers, operator identifiers or directed route shapes. The empty linestructure helper table contains zero features and is not missing network coverage.

| Source mode → adapter | Source records | Parts | Graph vertices | Graph edges | Components | Tunnel records |
| --- | --- | --- | --- | --- | --- | --- |
| Bus → bus | 3612 | 3634 | 32000 | 31988 | 101 | 0 |
| Bahn → rail | 338 | 343 | 8113 | 8087 | 29 | 2 |
| Seilbahn → cableway | 1 | 1 | 3 | 2 | 1 | 0 |

The adapter creates one graph per supported mode. Exact original LV95 part endpoints connect, including where a non-tunnel endpoint exactly equals another non-tunnel feature’s interior vertex. Nearby endpoints are never stitched. Interior-only crossings do not create junctions, and tunnel interiors are not joined to surface paths. The original tunnel flags are retained and tunnel endpoints may join surface infrastructure. This conservative topology can exclude real connections; the component counts are measured graph components, not claims about operational networks.

Paths follow shortest bidirectional source centrelines between projected GTFS calls. Retry projections must be within 5 metres of the nearest projection and only resolve disconnection/detour failures. No route/operator association is inferred from a segment ID. The [network inventory](../data/solothurn-audit/source-network.json) retains all source feature identities, mode, tunnel, part/vertex counts and graph inclusion status. Graph inclusion is not measured use of every segment or proof of route alignment.

| Mode | Maximum endpoint snap | Maximum detour | Absolute detour allowance |
| --- | --- | --- | --- |
| bus | 60 m | 3 × direct distance | 600 m |
| rail | 120 m | 3 × direct distance | 1500 m |
| cableway | 80 m | 2 × direct distance | 500 m |

The path must be no longer than the greater of the ratio limit and absolute allowance. Collapsed paths and mostly off-network movement are rejected. Short endpoint connectors are explicitly inferred. Output preserves source vertices, applies the swisstopo approximate LV95/WGS84 formula and rounds output to seven decimal places. There is no straight-line stop-to-stop fallback or externally inferred road repair.

| Journey exclusion | Friday | Sunday |
| --- | --- | --- |
| incomplete-directed-pattern | 3'809 | 2'951 |
| night-network-excluded-by-source | 0 | 72 |
| no-compatible-source-mode | 205 | 222 |

| Unmatched directed-pair reason | Friday | Sunday |
| --- | --- | --- |
| disconnected-line | 469 | 417 |
| endpoint-gap | 665 | 679 |
| implausible-detour | 28 | 16 |
| night-network-excluded-by-source | 0 | 651 |
| no-compatible-source-mode | 93 | 93 |

Night services are explicitly absent from the publisher's dataset. GTFS type 705, N/M/SN numeric labels and explicit night/Moonliner operator or route labels are excluded even where a daytime graph overlaps. Ordinary service-day carry-in is distinct from an explicitly marketed night route. No supplementary night alignment has been established. Tram and ferry are excluded because no compatible, separately verified graph exists; Bahn is not automatically treated as tram. Reservation/on-demand calls are rejected by policy, with no such exclusion required on these two dates.

Cross-canton journeys often extend beyond the graph or encounter disconnected parts. Endpoint gaps and disconnected patterns remain unresolved. Neither source topology nor shortest-path plausibility certifies road one-way compliance, a particular railway gauge/running track, bridge/tunnel engineering, the exact operator itinerary or temporary diversions. Further official route evidence is needed for that stronger claim.

The [source-stop inventory](../data/solothurn-audit/source-stops.json) retains every source stop, normalizes five-digit DiDok with the Swiss 8500000 prefix and joins the GTFS didok field exactly. It compares canton-contained GTFS stops only: 743 didok-matches-called-canton-stop; 31 no-canton-stop-didok-match; 1 didok-matches-uncalled-canton-stop. 24 source stops lie outside the canton. A missing canton-only match does not establish missing national service. The stop layer is an independent reconciliation aid; it does not replace original GTFS call coordinates.

## Exact source junction follow-up

The initial endpoint-only graph left genuine source-vertex contacts disconnected. The follow-up nodes **42 bus locations and one rail location** where one non-tunnel feature ends exactly at an interior vertex of another. These represent 45 bus interior-vertex references and one rail reference. No new edge or coordinate is added; interior-only crossings, near misses and tunnel interiors remain separate. Bus graph components fall from 121 to 101, and rail components from 30 to 29.

| Date | Previously admitted journeys | Now admitted journeys | Additional complete patterns | Previously admitted patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 2723 | 3142 | 46 | 0 |
| 2026-09-06 | 2385 | 2574 | 19 | 0 |

The [topology review](../data/solothurn-audit/topology-review.json) preserves each exact LV95 junction, endpoint/interior feature IDs, before/after denominators and every newly admitted complete stop chain. The [baseline](../data/solothurn-topology-baseline.json) identifies the original committed source hashes and admitted patterns. Rebuild and checking assert that source edge counts are unchanged and every previously admitted pattern remains admitted. This repairs network representation; it does not change the documented limits on route itinerary and physical-direction certainty.

## Sources, dates and attribution

- **National timetable:** SBB / Open data platform mobility Switzerland, feed **20260902**, valid **2025-12-14–2026-12-12**. [Dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [pinned ZIP](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip), [terms](https://opentransportdata.swiss/en/terms-of-use/). SHA-256: `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`.
- **Solothurn network:** Öffentlicher Verkehr — Amt für Verkehr und Tiefbau / Amt für Geoinformation, Kanton Solothurn. Published **2025-12-17**, acquired **2026-09-08**. Publication is not a per-edge survey date; no more precise geometry vintage is supplied. [Source ZIP](https://files.geo.so.ch/ch.so.avt.oev/aktuell/ch.so.avt.oev.gpkg.zip), [metadata](https://files.geo.so.ch/ch.so.avt.oev/aktuell/meta/datenbeschreibung.html), [terms](https://files.geo.so.ch/nutzungsbedingungen.html). ZIP SHA-256: `e1114b1dfcbd75f57a85da70da00185d64123d72c745c0379c6a8470f48c5045`.
- **Boundary:** © swisstopo, swissBOUNDARIES3D **2026-01**, [source](https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip), [terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices). Original GeoPackage SHA-256: `1f122cb7a06f2d312a84b7c0a91116348ba907054d487f0a70b9d2302984e6fc`. Lossless canton/district row snapshot SHA-256: `68ad054cb9830453e9a90345d57a7bbde9b458dcc0160dce5903ce88a4811d28`.

Solothurn's saved terms allow commercial and noncommercial use and recommend attribution; no Creative Commons licence is substituted. Source credit, links and exact acquisition times/hashes are embedded in every regional manifest and [sources.json](../public/data/solothurn-region/sources.json). Raw Solothurn ZIP, metadata, publication catalogue, terms and publisher validation log are retained in [data/solothurn-sources](../data/solothurn-sources/sources.json). The published feed also carries metadata and terms. National timetable attribution is opentransportdata.swiss; the processed results are authored by **Gleislicht**. This is an archival study, not a currently refreshed live timetable. Updating timetable, geometry or boundaries requires rebuilding both days and the admission audit.

## Feed and reproduction

The [feed index](../public/data/solothurn-region/index.json) links a full-day manifest and 06:45–08:45 morning snapshot for each date. Each day uses twelve two-hour chunks. The manifest carries stops, paths, edges, provenance and exact chunk hashes. Existing regional snapshot consumers can load these artifacts directly; this task does not add a new app view or enable realtime.

Run from the repository root:

```sh
# Re-decode the retained, hash-verified source archive and boundary row snapshot.
npm run data:solothurn:sources

# Re-census every annual stop time; requires the pinned national GTFS archive.
npm run data:solothurn:census -- /private/tmp/GTFS_FP2026_20260902.zip

# Build complete directed patterns, both feeds and all machine audits.
npm run data:solothurn
npm run data:solothurn:check
npm run data:solothurn:docs
npx vitest run scripts/solothurn-region.test.mjs scripts/bern-region.test.mjs
python3 -m unittest discover -s scripts -p 'test_bern_sources.py'
```

The timetable cache is an ignored regeneration intermediate; all deliverable feeds and audits are retained. Source preparation works offline from the committed archive and boundary snapshot. To reproduce the original boundary extraction, pass `--boundary /path/to/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg` to the Python preparation script. A newly downloaded aktuell source is not automatically accepted: the recorded survey hashes must match or a new release must be reviewed explicitly.

Validation covers real canton islands/districts, coordinate orientation, mode isolation, exact endpoint joins, disconnected parts and crossings, tunnel preservation, detour/collapse rejection, reverse/loop patterns, whole-journey exclusions, SN/night routes, conditional calls, previous-day spillover and representative frequencies. The artifact checker reconciles all route/operator and pattern/pair denominators, admission decisions, directed feed endpoints, every original call, morning subsets and exact bytes for all 24 chunks. It also re-routes every published journey against the retained mode graph and compares all emitted paths. These checks establish internal geometric and timetable consistency within the documented inference limits.
