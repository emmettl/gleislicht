# Solothurn canton transit study

Built from the pinned 2026 timetable, the cantonal public-transport network and separately attributed road, rail, boat and tram supplements. **All 193 canton-serving route records across 19 GTFS agency identities and all ten districts are inventoried. 146 route records contribute admitted journeys.** This is a whole-canton census with partial geometry admission, not complete service coverage.

Start with the [complete route admission/exclusion inventory](SOLOTHURN-ROUTE-INVENTORY.md), [machine audit](../data/solothurn-audit/summary.json) and [regional feed index](../public/data/solothurn-region/index.json). The original [national source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#so) explains source discovery.

## Scope and denominator

At least one original GTFS call coordinate in the unsimplified 2026 Solothurn canton polygon. Full journey retained, including every call outside Solothurn. No operator whitelist. The boundary is the unsimplified swissBOUNDARIES3D **2026-01** canton polygon, including Dorneck/Thierstein and detached parts. Every one of the national archive's 34'499'152 stop-time rows was scanned for membership across 2'143'227 trip records. 2'342 GTFS stop records are inside the canton; only 1'575 are called by the selected annual routes. Stop records include platforms and parent records; these are not counts of unique passenger stop places.

No agency whitelist or tariff boundary defines membership. Libero, A-Welle and TNW interfaces are represented by actual calls. The inventory includes national rail, PostAuto, local bus, replacement bus, BLT tram, Bielersee shipping and Weissenstein cableway identities. Representative agency IDs in the source survey were leads, not this denominator. Routes crossing the canton without any stop inside are outside the stated census. Services absent from fixed-stop GTFS, flexible service areas, and informal/private services are not claimed complete.

The 42 inactive route records remain in the annual inventory. “Annual” means trip records in the pinned annual archive, not proven service on every day or a census of every seasonal operating pattern. Friday **4 September 2026** and Sunday **6 September 2026** use calendar exceptions, frequency expansion and previous-service-day spillover. A separate twelve-date winter, Easter, summer, National Day and autumn sample is documented below; it does not establish every-day or year-round completeness.

## Weekday and Sunday directed patterns

| Measure | Friday 2026-09-04 | Sunday 2026-09-06 |
| --- | --- | --- |
| Civil-day journey instances | 7'156 | 5'819 |
| Scheduled instances | 6'078 | 4'711 |
| Representative headway instances | 1'078 | 1'108 |
| Admitted scheduled instances | 5'785 | 4'359 |
| Admitted representative headway instances | 1'078 | 1'108 |
| Total admitted instances | 6'863 | 5'467 |
| Distinct directed patterns | 921 | 777 |
| Admitted complete patterns | 838 | 700 |
| Matched route-specific directed stop pairs | 4'230 / 4'259 (99.3%) | 4'435 / 4'467 (99.3%) |
| Matched scheduled segment occurrences | 96'971 / 97'358 (99.6%) | 67'650 / 68'102 (99.3%) |
| Matched all segment occurrences | 98'049 / 98'436 (99.6%) | 68'758 / 69'210 (99.3%) |
| Segment occurrences in admitted whole journeys | 90'928 | 62'412 |
| Previous-day carry-in / admitted | 149 / 142 | 359 / 324 |
| Patterns revisiting a platform / admitted | 21 / 21 | 18 / 17 |
| Explicit night journeys / admitted | 0 / 0 | 72 / 63 |

Pattern identity includes the GTFS route ID, direction_id and the full ordered original platform IDs, including repeats and out-of-canton calls. Both directions 0 and 1 occur. There are **343 shared patterns**, **578 Friday-only** and **434 Sunday-only** patterns. Exact per-pattern matched masks, decisions and counts are retained in the [Friday audit](../data/solothurn-audit/2026-09-04.json) and [Sunday audit](../data/solothurn-audit/2026-09-06.json).

Every admitted journey keeps every original source call, has an oriented geometry path for every adjacent pair, finite nondecreasing source times and intact call permissions. A missing segment excludes the whole journey; no call chain is cropped to improve coverage. Matched segments in an excluded journey remain in the audit denominator but are not emitted as partial vehicles. Pair counts are route-specific; shared road segments do not collapse distinct route identities.

Weissenstein accounts for all 1'078 / 1'108 representative exactTimes=0 headway instances. These are not that many observed cabins or exact scheduled departures. All motion is scheduled interpolation, not GPS or realtime observations.

Original GTFS times can place distinct calls in the same minute. The admitted feeds retain **3'951 / 3'069 zero-duration segment occurrences**. These cannot imply finite measured speed; animation can jump at the common timestamp. The audit lists the affected directed pairs and nominal positive-duration speeds. Geometry admission is not certification of physical vehicle speed, and no sub-minute times are fabricated.

## Entire-canton district coverage

| District | Called GTFS platforms | Annual route records | Routes calling district in feed | Platforms called in feed |
| --- | --- | --- | --- | --- |
| Lebern | 210 | 52 | 37 | 202 |
| Thierstein | 153 | 9 | 9 | 147 |
| Dorneck | 163 | 10 | 9 | 154 |
| Gäu | 134 | 29 | 20 | 109 |
| Wasseramt | 94 | 33 | 25 | 94 |
| Gösgen | 161 | 13 | 12 | 112 |
| Thal | 129 | 7 | 5 | 129 |
| Solothurn | 69 | 53 | 38 | 64 |
| Olten | 354 | 94 | 62 | 275 |
| Bucheggberg | 108 | 10 | 10 | 108 |

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

The path must be no longer than the greater of the ratio limit and absolute allowance. Collapsed paths and mostly off-network movement are rejected. Short endpoint connectors are explicitly inferred. Output preserves source vertices, applies the swisstopo approximate LV95/WGS84 formula and rounds output to seven decimal places. There is no straight-line stop-to-stop fallback. Gaps can use separately attributed supplementary geometry under the rules below. Cantonal paths remain the first choice, including where the independent alignment comparison flags disagreement.

| Journey exclusion | Friday | Sunday |
| --- | --- | --- |
| incomplete-directed-pattern | 293 | 343 |
| night-network-excluded-by-source | 0 | 9 |

| Unmatched directed-pair reason | Friday | Sunday |
| --- | --- | --- |
| disconnected-line | 5 | 5 |
| endpoint-gap | 21 | 22 |
| implausible-detour | 1 | 0 |
| night-network-excluded-by-source | 0 | 3 |
| no-compatible-source-mode | 2 | 2 |

Night services are explicitly absent from the Solothurn publisher's dataset. GTFS type 705, N/M/SN numeric labels and explicit night/Moonliner labels therefore require a separately sourced path on **every** segment; overlapping daytime geometry never supplies a night leg. Ordinary service-day carry-in is distinct from a marketed night route. BLT tram 10 and BSG boat 3216 use their own official line/operator geometry; Bahn is not treated as tram. Reservation/on-demand calls remain excluded, with no such exclusion required on these two dates.

Cross-canton journeys often extend beyond the graph or encounter disconnected parts. Endpoint gaps and disconnected patterns remain unresolved. Neither source topology nor shortest-path plausibility certifies road one-way compliance, a particular railway gauge/running track, bridge/tunnel engineering, the exact operator itinerary or temporary diversions. Further official route evidence is needed for that stronger claim.

The [source-stop inventory](../data/solothurn-audit/source-stops.json) retains every source stop, normalizes five-digit DiDok with the Swiss 8500000 prefix and joins the GTFS didok field exactly. It compares canton-contained GTFS stops only: 743 didok-matches-called-canton-stop; 31 no-canton-stop-didok-match; 1 didok-matches-uncalled-canton-stop. 24 source stops lie outside the canton. A missing canton-only match does not establish missing national service. The stop layer is an independent reconciliation aid; it does not replace original GTFS call coordinates.

## Exact source junction follow-up

The initial endpoint-only graph left genuine source-vertex contacts disconnected. The follow-up nodes **42 bus locations and one rail location** where one non-tunnel feature ends exactly at an interior vertex of another. These represent 45 bus interior-vertex references and one rail reference. No new edge or coordinate is added; interior-only crossings, near misses and tunnel interiors remain separate. Bus graph components fall from 121 to 101, and rail components from 30 to 29.

| Date | Previously admitted journeys | Now admitted journeys | Additional complete patterns | Previously admitted patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 2723 | 3142 | 46 | 0 |
| 2026-09-06 | 2385 | 2574 | 19 | 0 |

The [topology review](../data/solothurn-audit/topology-review.json) preserves each exact LV95 junction, endpoint/interior feature IDs, before/after denominators and every newly admitted complete stop chain. The [baseline](../data/solothurn-topology-baseline.json) identifies the original committed source hashes and admitted patterns. Rebuild and checking assert that source edge counts are unchanged and every previously admitted pattern remains admitted. This repairs network representation; it does not change the documented limits on route itinerary and physical-direction certainty.

## Supplementary geometry and alignment review

| Date | Cantonal-only admission | With supplements | Additional complete patterns | Prior patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 3142 | 6863 | 615 | 0 |
| 2026-09-06 | 2574 | 5467 | 544 | 0 |

| Geometry source | Friday directed pairs / admitted occurrences | Sunday directed pairs / admitted occurrences |
| --- | --- | --- |
| basel-official-tram-10 | 77 / 3709 | 77 / 3927 |
| bern-official-413 | 10 / 370 | 10 / 238 |
| bern-official-450_S_b | 9 / 59 | 10 / 58 |
| bern-official-boat-3216 | 14 / 28 | 14 / 28 |
| fot | 850 / 4894 | 887 / 4074 |
| osm-road-inference | 266 / 5449 | 824 / 5042 |
| sbb-rail-inference | 0 / 0 | 2 / 4 |
| solothurn-network | 3004 / 76419 | 2611 / 49041 |

- **Roads:** 805 complete bus patterns from 96 original route IDs across all twelve dates are matched with pfaedle, retaining real agency and platform identities. The bus profile respects supported OSM access, direction and turn restrictions. Every occurrence of a route-specific directed pair across complete pattern contexts must have a successful, identical path; failed matcher warnings, context disagreement and detours are rejected. Bus detours remain bounded by 3 × direct distance or 600 m. Raw routing inputs/results, logs, binary/config/source hashes and derived cache are retained in [road evidence](../data/solothurn-road-evidence/all.json.gz). This is inferred road geometry, not an operator itinerary certificate.
- **Standard-gauge rail:** 85 explicit annual SBB, BLS, SOB and OeBB route records may use FOT geometry. Only 1435 mm source segments are eligible. Original operating-point numbers, declared topology, source validity fields and full stop order constrain paths; other scheduled operating points cannot be shortcut between adjacent calls. Platform attachment is capped at 350 m, infrastructure attachment at 120 m and detour at 4.5 × or 3,000 m. FOT paths are simplified by 5 m before WGS84 conversion. asm and RBS records do not enter this standard-gauge supplement. No particular running track is certified.
- **Boat:** Bern line 3216, operator BSG, supplies Biel–Solothurn geometry for exact GTFS route 94-321-6-j26-1 / agency 182. Endpoint snap is at most 150 m, detour 3 × or 1,200 m.
- **Tram:** Basel-Stadt line 10 / operator BLT supplies exact GTFS route 91-10-j26-1 / agency 37. Endpoint snap is at most 80 m, detour 3 × or 600 m. The two directed pairs around Arlesheim Dorf platform E remain unresolved; no platform relocation is invented.

The [supplement review](../data/solothurn-audit/supplement-review.json) records every added pattern. The [alignment review](../data/solothurn-audit/alignment-review.json) compares admitted cantonal bus paths with independent road consensus and retains every excluded pattern with its failed pairs. Its 30 m threshold is diagnostic only: symmetric vertex-to-polyline distance cannot prove itinerary or road direction. It does not change admission.

| Cantonal bus comparison | Friday directed pairs | Sunday directed pairs |
| --- | --- | --- |
| alignment-disagreement-over-30m | 351 | 323 |
| no-consensus-comparator | 75 | 53 |
| within-30m-vertex-distance | 2064 | 1750 |

**293 Friday and 352 Sunday journeys remain excluded.** Source gaps, unverified foreign rail connections, platform gaps and failed full-pattern consensus remain explicit. Disagreement with OSM remains a review flag on already admitted cantonal paths. Current operator itineraries, temporary diversions and physical direction are not certified by these internal checks.

## Reviewed rail corridor follow-up

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 6654 | 6863 | 27 | 0 |
| 2026-09-06 | 5310 | 5467 | 32 | 0 |

The [corridor review](../data/solothurn-audit/corridor-review.json) and [source policy](../data/solothurn-corridor-policy.json) add three exact associations without broadening snap/detour limits:

- **asm S11:** Bern feature **413**, operator **ASm**, line **S11**, original GTFS route **91-11-M-j26-1 / agency 81**. All 51 distinct directed platform pairs in the twelve-date sample match within 13 m. Only gaps in the earlier cantonal geometry use this operator-specific graph. **150 Friday and 95 Sunday journeys are now admitted**, preserving the full Solothurn–Oensingen–Langenthal stop chain.
- **SBB S29:** Bern feature **450_S_b**, operator **SBB**, line **S29**, route **91-29-j26-1 / agency 11**. The Aarau–Olten return legs now have line-specific geometry, with platform snaps below 48 m on the two published dates. Admission rises to **64/86 Friday and 65/86 Sunday** journeys. Other full-pattern contexts still produce conflicting paths, so their whole journeys remain excluded.
- **Däniken–Schönenwerd:** two complete graphical SBB line-540 records **DK–DKO–SCOE**, with exact operating-point IDs 8502111/8502112, standard gauge N, intact coordinate joins and at most 100 m station attachment. Six explicitly listed SBB GTFS route identities can use this corridor; all full seasonal contexts must agree. It completes **all four Sunday SN11 journeys**. Schematic two-point records and unrelated foreign source records are retained for review but never supply this corridor.

Every earlier admitted pattern remains admitted. These are bounded source-alignment improvements, not certification of current physical running tracks or diversions. The S11 and S29 route-specific Bern graphs remain bidirectional; direction comes from the original ordered GTFS calls. Complete seasonal contexts, route/operator identity and unsuccessful alternatives remain auditable.

## Seasonal and holiday sample

| Civil date | Source journeys | Admitted journeys | Complete admitted patterns |
| --- | --- | --- | --- |
| 2026-01-16 | 7031 | 6679 | 813 |
| 2026-01-18 | 5362 | 5095 | 660 |
| 2026-04-03 | 5450 | 5178 | 657 |
| 2026-04-05 | 5730 | 5440 | 662 |
| 2026-07-17 | 7127 | 6835 | 770 |
| 2026-07-19 | 5523 | 5264 | 674 |
| 2026-08-01 | 5566 | 5342 | 702 |
| 2026-09-04 | 7156 | 6863 | 838 |
| 2026-09-06 | 5819 | 5467 | 700 |
| 2026-10-23 | 7146 | 6888 | 862 |
| 2026-10-25 | 5527 | 5294 | 685 |
| 2026-12-11 | 7025 | 6766 | 834 |

The sample applies the pinned GTFS calendars and exceptions to winter weekdays/Sundays, Good Friday, Easter Sunday, summer, Swiss National Day and autumn. **9** of the September-inactive route records become active; **33** remain inactive on all twelve dates. The [seasonal inventory](../data/solothurn-audit/seasonal-summary.json) lists every annual route on every date, and the [pattern audit](../data/solothurn-audit/seasonal-patterns.json.gz) retains every directed stop chain, decision and matched mask. A durable [context snapshot](../data/solothurn-pattern-contexts.json.gz) retains 2,824 complete representative source patterns for offline revalidation and supplementary consensus.

Geometry from the recorded source vintages is applied to this timetable sample; historical/seasonal alignment validity is unproven. **25 October is the DST fallback day:** source stop order and geometry are tested, but the repeated local hour is not disambiguated into 25 elapsed hours. It is not promoted to an app day feed. Only the reviewed September Friday/Sunday can be promoted; this sample does not assert daily or year-round completeness.

## Sources, dates and attribution

- **National timetable:** SBB / Open data platform mobility Switzerland, feed **20260902**, valid **2025-12-14–2026-12-12**. [Dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [pinned ZIP](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip), [terms](https://opentransportdata.swiss/en/terms-of-use/). SHA-256: `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`.
- **Solothurn network:** Öffentlicher Verkehr — Amt für Verkehr und Tiefbau / Amt für Geoinformation, Kanton Solothurn. Published **2025-12-17**, acquired **2026-09-08**. Publication is not a per-edge survey date; no more precise geometry vintage is supplied. [Source ZIP](https://files.geo.so.ch/ch.so.avt.oev/aktuell/ch.so.avt.oev.gpkg.zip), [metadata](https://files.geo.so.ch/ch.so.avt.oev/aktuell/meta/datenbeschreibung.html), [terms](https://files.geo.so.ch/nutzungsbedingungen.html). ZIP SHA-256: `e1114b1dfcbd75f57a85da70da00185d64123d72c745c0379c6a8470f48c5045`.
- **Boundary:** © swisstopo, swissBOUNDARIES3D **2026-01**, [source](https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip), [terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices). Original GeoPackage SHA-256: `1f122cb7a06f2d312a84b7c0a91116348ba907054d487f0a70b9d2302984e6fc`. Lossless canton/district row snapshot SHA-256: `68ad054cb9830453e9a90345d57a7bbde9b458dcc0160dce5903ce88a4811d28`.

- **OSM roads:** © OpenStreetMap contributors, ODbL-1.0; Geofabrik Switzerland **2026-09-02** plus border extract acquired **2026-09-08**. [Source](https://download.geofabrik.de/europe/switzerland.html), [terms](https://www.openstreetmap.org/copyright). Extract SHA-256: `d5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b`.
- **FOT rail:** © Federal Office of Transport. Catalogue date **2021-07-06**, asset update **2025-01-18**, checked **2026-09-08**; no effective 2026 alignment date established. [Source](https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf), [attribution terms](https://opendata.swiss/terms-of-use/#terms_by). Source XTF SHA-256: `2895811c6c338cdc3d32e946d2861ce58ca72ddde7d700fe9b73f2c393f7b828`. The catalogue's proprietary licence label is preserved; no open licence is invented.
- **Bern boat geometry:** Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern. Data updated **2026-01-01**, package published **2026-07-09**, acquired **2026-09-08**. [Metadata](https://www.agi.dij.be.ch/de/start/geoportal/geodaten/detail.html?code=OEVTP&type=geoproduct), [German terms](../public/data/solothurn-region/supplements/terms_of_use_de.pdf), [French terms](../public/data/solothurn-region/supplements/terms_of_use_fr.pdf). Bern archive SHA-256: `4e2a4fcca08cc219c871d42c957753c09318ace2172fb3614c4fe71b20a4fe19`.
- **SBB graphical railway corridors:** SBB Infrastructure / data.sbb.ch, attribution required under the retained terms_by licence. Dataset modified **2026-07-29**, data processed **2026-09-02**, acquired **2026-09-08**; these are publication/processing dates, not proof of each alignment's effective date. [Graphical dataset](https://data.sbb.ch/explore/dataset/linie-mit-polygon/), [retained terms](../public/data/solothurn-region/supplements/sbb-terms.html), [source hashes and URLs](../data/solothurn-sources/corridors/sbb/sources.json). Bern S11/S29 use the same dated Bern package and attribution as the boat source above.
- **Basel tram geometry:** Geodaten Kanton Basel-Stadt, acquired **2026-09-08**; no geometry effective date supplied. [Catalogue](https://shop.geo.bs.ch/geodaten-katalog/), [model](https://models.geo.bs.ch/Modellbeschreibungen/LN_LiniennetzOeV_KGDM_V1_0.pdf), [reuse context](https://www.bs.ch/news/2026-anpassung-der-kgeoiv). The exact line/operator layer and acquisition catalogue are retained. Uncompressed GeoJSON SHA-256: `687be2ce2fed8ffc48a00ef5a7fd694be71d446b937f5f269cb432beeae83df1`.

Solothurn's saved terms allow commercial and noncommercial use and recommend attribution; no Creative Commons licence is substituted. Source credit, links and exact acquisition times/hashes are embedded in every regional manifest and [sources.json](../public/data/solothurn-region/sources.json). Raw Solothurn ZIP, metadata, publication catalogue, terms and publisher validation log are retained in [data/solothurn-sources](../data/solothurn-sources/sources.json). The published feed also carries metadata and terms. National timetable attribution is opentransportdata.swiss; the processed results are authored by **Gleislicht**. This is an archival study, not a currently refreshed live timetable. Updating timetable, geometry or boundaries requires rebuilding both days and the admission audit.

## Feed and reproduction

The [feed index](../public/data/solothurn-region/index.json) links a full-day manifest and 06:45–08:45 morning snapshot for each date. Each day uses twelve two-hour chunks. The manifest carries stops, paths, edges, provenance and exact chunk hashes. Solothurn is available in the app's study picker and opens as a full civil day. Its feeds load on selection. Search covers admitted routes and out-of-canton stops; shares retain study, date, time and focus. English, German, French and Italian copy explicitly labels partial coverage and representative headway motion. Source credits and local terms remain accessible.

The app release uses the Friday fixture in [top-level manifest](../public/data/solothurn-region-day-manifest.json), morning snapshot and twelve verified chunks. [Display release proof](../data/solothurn-audit/display-release.json) records both dates: display simplification is bounded by 5 m with unchanged endpoints, calls and movements. The Friday manifest is 335'300 bytes gzipped. Source archives remain unchanged by display simplification; FOT has its separately declared 5 m source transformation.

Regional refresh integration can promote only the two reviewed dates. For another date or a failed candidate build it retains a complete, validated published study (or the reviewed fixture on first-deployment 404), keeping its actual service date. A damaged published chunk never gets silently combined with another release. This integration is ready for deployment; no live deployment is part of this task.

Run from the repository root:

```sh
# Re-decode the retained, hash-verified source archive and boundary row snapshot.
npm run data:solothurn:sources

# Re-census every annual stop time; requires the pinned national GTFS archive.
npm run data:solothurn:census -- /private/tmp/GTFS_FP2026_20260902.zip

# Rebuild the twelve-date census and durable full-pattern contexts.
npm run data:solothurn:census -- /private/tmp/GTFS_FP2026_20260902.zip --seasonal
node scripts/prepare-solothurn-contexts.mjs
# Supplemental source preparation can reuse committed snapshots offline.
node scripts/prepare-solothurn-supplements.mjs
node scripts/prepare-solothurn-corridors.mjs

# Build complete directed patterns, both feeds and all machine audits.
npm run data:solothurn
npm run data:solothurn:check
npm run data:solothurn:seasonal
npm run data:solothurn:seasonal:check
npm run data:solothurn:alignments
npm run data:solothurn:release
npm run data:solothurn:docs
npx vitest run scripts/solothurn-region.test.mjs scripts/solothurn-corridor.test.mjs scripts/solothurn-release.test.mjs
npx playwright test --config playwright.solothurn.config.ts
python3 -m unittest discover -s scripts -p 'test_bern_sources.py'
```

The road cache/evidence can be validated offline. To rematch, prepare with `node scripts/solothurn-road-geometry.mjs prepare data/solothurn-audit/seasonal-timetable-cache.json.gz /path/prepared`, run `scripts/match-postbus-roads.mjs` on `/path/prepared/all` using the exact recorded pfaedle binary/config and OSM extract, then import with `node scripts/solothurn-road-geometry.mjs import /path/prepared /path/matched`. The large OSM input and matcher binary are external reproduction prerequisites; their hashes are retained. New bytes require fresh matching and review.

The timetable cache is an ignored regeneration intermediate; all deliverable feeds and audits are retained. Source preparation works offline from the committed archive and boundary snapshot. To reproduce the original boundary extraction, pass `--boundary /path/to/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg` to the Python preparation script. A newly downloaded aktuell source is not automatically accepted: the recorded survey hashes must match or a new release must be reviewed explicitly.

Validation covers real canton islands/districts, coordinate orientation, mode isolation, exact endpoint joins, disconnected parts and crossings, tunnel preservation, detour/collapse rejection, reverse/loop patterns, whole-journey exclusions, SN/night routes, conditional calls, previous-day spillover and representative frequencies. The artifact checker reconciles all route/operator and pattern/pair denominators, admission decisions, directed feed endpoints, every original call, morning subsets and exact bytes for all 24 chunks. It also re-routes every published journey against the retained mode graph and compares all emitted paths. These checks establish internal geometric and timetable consistency within the documented inference limits.
