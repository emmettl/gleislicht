# Aargau regional transit: canton inventory and geometry audit

Completed **8 September 2026** from the [national source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#ag). This delivers a reproducible **canton-wide timetable inventory**, an AGIS line adapter with scoped OSM bus and FOT rail fallbacks, and Friday/Sunday regional audit feeds. It is an offline data deliverable; application study selection, live refresh and deployment are separate work.

**All 5,142 national route records and 34,499,152 stop-time rows were inspected.** The archived timetable contains **289 Aargau-calling route records across 23 agency identities**. Of these, **232 operate in at least one selected civil-day fixture** and **57 are inactive on both**. The other **4,853 national route records** have no Aargau call in the archive. These are GTFS records, not counts of unique public line numbers or legal companies.

The final feed retains **11,193 Friday journeys and 7,767 Sunday journeys**, with complete source stop chains. Accepted geometry covers **99.64% / 99.74%** of all retained segment occurrences, and **99.92% / 99.90%** of occurrences with at least one stop inside Aargau. **Geometry remains incomplete**, for the S36 Waldshut crossing, one Bern platform, unmatched boat identities and German bus continuations. Bus fallback is an explicitly labelled OSM inference, including replacement services; it does not certify the actual diversion used.

## Deliverables

| Artifact | Contents |
| --- | --- |
| [Full route inventory](../data/aargau/inventory.json) | All 5,142 routes with membership/admission reasons, source identities, archived Aargau calls and daily eligibility; complete national agency lookup |
| [Friday audit](../fixtures/aargau/2026-09-04/audit.json) / [Sunday audit](../fixtures/aargau/2026-09-06/audit.json) | Every directed pattern and pair, accepted/failed occurrences, source feature/part/orientation, snap distances, monotone progress, source dates, geometry exclusions and all 366 GIS records |
| [Friday regional feed](../fixtures/aargau/2026-09-04/aargau-region-day-manifest.json) / [Sunday regional feed](../fixtures/aargau/2026-09-06/aargau-region-day-manifest.json) | Manifest with stops, shared paths and twelve hashed two-hour movement chunks per date |
| [Friday morning](../fixtures/aargau/2026-09-04/aargau-region-morning.json) / [Sunday morning](../fixtures/aargau/2026-09-06/aargau-region-morning.json) | Self-contained 06:45–08:45 extracts, focus 07:45 |
| [Source catalogue](../data/aargau-sources/sources.json) | Raw archive, supplied terms/metadata, decoded geometry, unsimplified canton boundary and hashes |
| [Road fallback cache](../data/aargau-road-cache.json) | Complete agency-scoped bus patterns, platform identities, ODbL provenance, matcher hashes and rejected hops |
| [FOT source bundle](../data/aargau-rail-sources/source.json) / [rail policy](../data/aargau-rail-policy.json) | Checksum-verified compressed original XTF, dated catalogue and terms link; 44 exact SBB/THURBO/SOB rail route identities |
| [Rail regression](../data/aargau/rail-regression.json) | Every prior AGIS/OSM path and complete journey preserved against commit `3b7a9ba`; current manifest hashes |
| [Explicit crosswalk](../data/aargau-line-crosswalk.json) | Eight narrowly scoped operator/line mappings with source/GTFS evidence |
| [Independent source verification](../data/aargau/source-verification.json) | Separate Python CSV/zip scan: exact expected journey sets, source coordinates, calls, rules and shifted times |
| [Friday extracted timetable](../data/aargau/2026-09-04-timetable.json.gz) / [Sunday extracted timetable](../data/aargau/2026-09-06-timetable.json.gz) | Hash-bound compressed source fixtures for rebuilding geometry without rereading the large national archive |

The feed uses the existing network snapshot/chunk format. Every train has its exact GTFS route, source trip/date, direction ID, ordered calls and per-segment path references. **A null path is an unresolved geometry segment**; a consumer may display straight stop interpolation, but must not describe it as an admitted alignment. No missing-geometry journey is removed. Static shared edges get a path only when all occurrences agree on one geometry; train paths preserve direction and pattern identity.

## Canton and border scope

Membership uses the full **swissBOUNDARIES3D 2026-01 Aargau polygon, canton number 19**, including holes and separate parts. No rectangle or operator whitelist defines membership. There are **4,793 GTFS stop records** inside the polygon, including parent/platform records; only actual stop-time calls establish route membership. Every archived trip is inspected, regardless of its operating season.

A daily journey is admitted when it intersects the selected civil day and itself calls inside the canton. Its **entire stop chain** is retained, including domestic/foreign termini and intermediate calls outside Aargau. A route having one Aargau trip does not admit all that route's unrelated trips. Long SBB journeys can therefore extend well beyond the source geometry. Non-stopping through traffic and services absent from this national GTFS are outside the timetable denominator; the separate complete AGIS record inventory exposes additional source-only leads. No claim is made to census private, unscheduled or unrepresented flexible transport.

All seven requested review areas have active anchor calls on both dates. These checks verify geographical presence, not comprehensive subregional geometry or exact tariff boundaries.

| Review area | Anchor | Friday journeys calling | Sunday journeys calling |
| --- | --- | ---: | ---: |
| Aarau | Aarau | 1,803 | 1,577 |
| Baden/Wettingen | Baden | 2,249 | 1,862 |
| Brugg | Brugg AG | 1,293 | 938 |
| Lenzburg | Lenzburg | 1,005 | 774 |
| Freiamt | Muri AG | 330 | 216 |
| Fricktal | Frick | 511 | 340 |
| Zurzibiet | Koblenz | 175 | 120 |

Cross-canton bus continuations, Kaiserstuhl services, the Rheinfelden DE/CH bus and Hallwilersee services remain in scope. AAGL 72 is retained by actual Aargau calls even though much of its itinerary is outside AG. Other AGIS records with no matching Aargau-calling GTFS identity remain in the source exclusion inventory.

## Dates and calendar semantics

Both fixtures use pinned **GTFS 20260902**, valid **14 December 2025–12 December 2026**. Friday is **4 September 2026**; Sunday is **6 September 2026**. Calendar exceptions are applied independently for the selected and preceding service dates: **3–6 September** in total.

The selection window is **civil [00:00, 24:00)**. Entire intersecting journeys are preserved, including calls before midnight and after 24:00. Friday contains **290** preceding-service-day journeys; Sunday contains **518**. Source dates qualify journey IDs to prevent duplicate source-trip identities across calendars. GTFS times above 24:00 are not discarded. Coverage counts *all adjacent calls in the retained complete journeys*, including portions outside the civil window; it is not a count of positions or segment movements clipped to midnight.

The independent verifier recounted **184,299 Friday calls** and **129,240 Sunday calls**, and checked that no expected journey was omitted and no extra journey was introduced. Source names, full platform precision, arrival/departure times, headsigns, direction and boarding restrictions are preserved. There are **no frequency templates** in these real regional fixtures. The importer nevertheless expands interval-anchored frequencies, retains `exact_times`, and labels headway instances; the synthetic calendar test exercises this behaviour. Invalid/missing fixed stop times are enumerated as exclusions rather than invented; neither fixture contains such exclusions.

Sunday contains **171 night journeys, 40 route records and 101 directed patterns**, brought in from Saturday's calendar. Their **3,508 segment occurrences have zero admitted AGIS geometry** under exact night-line identity. The fallback now supplies **3,147 night-bus occurrences**, covering every retained Sunday night-bus segment. The FOT fallback now supplies all **361 night-rail occurrences**, so all **3,508 Sunday night occurrences** have geometry. All night journeys remain visible in the timetable and coverage denominator; FOT and OSM contributions are separately identified. Daytime line geometry is not automatically relabelled as a night line. There are no N/SN or type-705 night journeys in the Friday civil-day fixture. Two September dates do not establish winter, summer-only, holiday or year-round completeness; the 57 inactive archived route records are retained for further dated validation.

## Measured coverage

A directed pattern is **route ID + GTFS direction ID + complete ordered platform-ID chain**. Loops retain repeated platform visits. A directed pair is **route ID + from-platform + to-platform**; it is counted as fully matched only if every occurrence across all patterns matches.

| Measure | Friday | Sunday |
| --- | ---: | ---: |
| Retained journeys | 11,193 | 7,767 |
| Active GTFS route records | 178 | 191 |
| Active agency identities | 21 | 20 |
| Platforms | 3,881 | 3,885 |
| Directed complete stop patterns | 1,477 | 1,080 |
| Patterns with every segment matched | 1,464 | 1,070 |
| Distinct directed route/platform pairs | 6,932 | 7,456 |
| Pairs matched on every occurrence | 6,889 | 7,415 |
| Scheduled segment occurrences | 173,106 | 121,473 |
| Accepted geometry occurrences | 172,477 | 121,153 |
| Full-journey occurrence coverage | 99.64% | 99.74% |
| Occurrence coverage touching an Aargau stop | 99.92% | 99.90% |

AGIS contributes **160,049 / 107,815** accepted occurrences, the road fallback adds **8,599 / 9,866**, and FOT rail adds **3,829 / 3,472**, Friday/Sunday. Each admitted segment identifies `geometrySource: agis`, `osm` or `fot`; the per-operator and per-route counters reconcile those sources separately. A fully matched pattern may combine AGIS portions with the relevant road or rail fallback.

The operator table inventories all 23 agency identities that call in Aargau somewhere in the archive. Coverage is measured over complete retained journeys, including outside-canton portions. A dash means no eligible journey on that date, not that the operator lacks geometry year-round.

| Source operator / agency ID | Mode | Archived canton routes | Friday trips | Sunday trips | Friday geometry | Sunday geometry |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Aargau Verkehr AG (`723`) | bus | 14 | 718 | 556 | 100.00% | 100.00% |
| Busbetrieb Olten-Gösgen-Gäu (`793`) | bus | 1 | 147 | 143 | 100.00% | 100.00% |
| PostAuto AG (`801`) | bus | 105 | 4,793 | 2,555 | 99.95% | 100.00% |
| Autobus AG Liestal (`811`) | bus | 2 | 174 | 146 | 100.00% | 100.00% |
| Auto AG Rothenburg (`812`) | bus | 2 | 39 | 41 | 100.00% | 100.00% |
| Zugerland Verkehrsbetriebe (`839`) | bus | 4 | 96 | 55 | 100.00% | 100.00% |
| Busbetrieb Aarau (`840`) | bus | 11 | 947 | 846 | 100.00% | 100.00% |
| Verkehrsbetriebe Zürich (`849`) | bus | 2 | 84 | 71 | 100.00% | 100.00% |
| Regionalbus Lenzburg (`873`) | bus | 15 | 555 | 327 | 100.00% | 100.00% |
| Regionale Verkehrsbetriebe Baden-Wettingen (`886`) | bus | 18 | 1,475 | 1,069 | 100.00% | 100.00% |
| Aargau Verkehr AG (`899`) | bus | 5 | 137 | 82 | 100.00% | 100.00% |
| SBB Infrastruktur AG Bahnersatz (`7231`) | bus | 21 | 5 | 22 | 100.00% | 100.00% |
| Aargau Verkehr AG Ersatzverkehr (`7244`) | bus | 4 | 5 | 0 | 100.00% | — |
| Südbadenbus (`sbg034`) | bus | 1 | 52 | 20 | 44.41% | 42.97% |
| Hallwilersee (`181`) | ferry | 3 | 10 | 17 | 66.04% | 38.46% |
| Basler Personenschifffahrt AG (`191`) | ferry | 1 | 0 | 0 | — | — |
| Schweizerische Bundesbahnen SBB (`11`) | rail | 69 | 1,281 | 1,270 | 99.99% | 99.99% |
| Aargau Verkehr AG (`31`) | rail | 1 | 163 | 121 | 100.00% | 100.00% |
| THURBO (`65`) | rail | 2 | 37 | 36 | 90.77% | 90.77% |
| Oensingen-Balsthal-Bahn (`68`) | rail | 2 | 0 | 0 | — | — |
| Schweizerische Südostbahn (sob) (`82`) | rail | 4 | 2 | 1 | 100.00% | 100.00% |
| Aargau Verkehr AG (`96`) | rail | 1 | 313 | 229 | 100.00% | 100.00% |
| Aargau Verkehr AG (`41`) | tram | 1 | 160 | 160 | 100.00% | 100.00% |

AVA **S14 (96), S17 (31)** and **tram 20 (41)** have all retained segment occurrences matched on both dates. This is automated ordered-path coverage, not certification of particular running tracks. SBB now has one unresolved IR16 occurrence on each date. THURBO S36 reaches **90.77%** on both dates, with only the Koblenz–Waldshut crossing unresolved. SOB IR35 on Friday and IR26 on Sunday reach **100%**. Each fallback requires its own exact timetable route/agency identity and operating-point IDs; AGIS SBB labels are not relabelled for another operator.

## Adapter and admission rules

[`prepare-aargau-sources.py`](../scripts/prepare-aargau-sources.py) decodes the Shapefile/DBF with Python's standard library. It verifies format, record length/count, LV95 coordinate range and line identity, preserves multipart boundaries and every DBF property, and transforms LV95 to longitude/latitude using the metre-level swisstopo approximate polynomial. Coordinates are rounded to seven decimal places; source geometry and the membership boundary are unsimplified. The raw archive and original canton GeoPackage geometry are preserved for inspection. The canton is extracted by its official number, not by a hand-drawn boundary.

[`aargau-line-geometry.mjs`](../scripts/aargau-line-geometry.mjs) indexes **GO_NR + mode + exact line label**. Direct identity is the default. The explicit crosswalk handles AVA S17's source code 96 versus timetable agency 31; three ZVV-publisher records for PostAuto 205/215/245; Südbadenbus 7312a/b versus agency `sbg034`, line 7312; and PostAuto-operated AVA express lines 444/445. Source itinerary, actual agency and matching ordered stops constrain each mapping. No operator-wide alias is introduced.

Each AGIS match for a complete directed GTFS pattern selects **one feature part and one coordinate orientation**. Optional road and rail fallbacks fill only unresolved bus or rail segments after that selection. The adapter never stitches disconnected parts, combines opposite-direction records or routes through an unrestricted road graph. Source `RICHTUNG` is preserved. It denotes direction in timetable fields and is **not assumed to equal GTFS `direction_id` or polyline coordinate order**.

- Project stops to local distance minima along the source part, at most **120 m** away. Full-chain dynamic programming chooses a consistent nondecreasing progress sequence, maximizing valid adjacent movements and then minimizing projection gaps.
- A missing or incompatible projection stays explicit. Progress is retained across an unmatched stop; the matcher never invents a direct movement across it. Only its genuinely adjacent, individually valid pairs can receive paths. This preserves usable sections of partial source alignments without claiming the whole pattern passes.
- Exactly closed source parts can start at an arbitrary digitising vertex. They are unrolled once and limited to **one lap**, so a rotated complete loop can match while extra circuits cannot be invented.
- Accept a segment only when source length is at least **1 m**, is not collapsed relative to the direct stop distance, and is at most **max(1,200 m, 4.5 × direct distance)**. Report every accepted endpoint gap and source length.
- Slice the source polyline between projected calls, retain exact GTFS endpoints, and simplify the interior by at most **5 m** for the exported feed. Endpoint connector sections remain explicit. Coverage checks use the original unsimplified source length.

`pattern-order-gap`, `endpoint-gap`, `collapsed-path`, `implausible-detour` and `missing-operator-mode-line` remain machine-readable rejection reasons. Each pattern records its feature, part, orientation and stop progress. These checks validate directed **stop order** and a bounded inferred alignment; they do not independently certify lanes, one-way permissions, bridges, stacked tracks or temporary diversions. Those reviews remain a release prerequisite.

## Source admission and exclusions

All **366 GIS records** are accounted for: **313 bus, 46 rail, 2 tram and 5 boat**. Records are not unique line counts; some repeat directions, branches or parts.

| Source-record result | Friday | Sunday |
| --- | ---: | ---: |
| `excluded-no-canton-route-for-source-identity` | 11 | 11 |
| `excluded-no-exact-identity-crosswalk` | 5 | 5 |
| `geometry-admitted` | 262 | 201 |
| `unused-inactive-or-pattern-mismatch` | 88 | 149 |

`excluded-no-canton-route-for-source-identity` means the exact identity lacks an archived Aargau-calling route; it does **not** prove the geometry lies outside the canton. In particular, AGIS labels 444/445 as PostAuto while the regional GTFS uses AVA agency 899. The [AVA annual report 2024, printed page 33](https://www.aargauverkehr.ch/images/easyblog_articles/229/AVA-Jahresbericht-2024.pdf) identifies PostAuto as the contractor operating both lines for AVA, with a concession through 2031. Together with the dated GTFS corridor identity, this supports two exact line mappings; no operator-wide alias is inferred. The mappings add 526 Friday AGIS occurrences. The five records without an exact crosswalk include boat labels **3651.1/6551.1**, DB **IRE3**, and SBB **S18**. The full record table preserves itinerary, timetable field, GO name/code and source direction for review.

The road fallback closes the bus geometry gaps for **PostAuto 510/515**, Sunday night buses and agencies **7231/7244** in these fixtures. Remaining bus gaps are chiefly **German portions of Südbadenbus 7312** (537 Friday / 219 Sunday occurrences) and two directed Friday segments next to **Brugg AG, Aare AG** (36 occurrences): the closest matched road is about 131 m from that platform, above the unchanged 120 m guard. The road cache also records a rejected line-320 zero/missing shape interval; existing AGIS geometry already covers it, so it creates no extra delivered gap. The full cache preserves every rejected hop rather than accepting the matcher's straight fallback.

Remaining rail gaps are **37 Friday / 36 Sunday S36 Koblenz–Waldshut occurrences** (foreign stop `8014474`, no exact FOT operating point), and **one IR16 Olten–Bern occurrence per date** (Bern platform `ch:1:sloid:7000:55:49` is 446 m from operating point 8507000, beyond the 350 m attachment limit). Hallwilersee labels beyond the exact 3651 join still leave **18 Friday / 96 Sunday boat occurrences** unresolved. Normal-line failures may reflect dated stop or diversion differences. All scheduled journeys stay in the denominator.

## Inferred bus fallback

The routing-only input combines **340 complete patterns across 14 separate agency feeds** from both dates. It contains only patterns with an AGIS gap after the eight exact crosswalks. Civil-day calls are shifted as a whole to valid nonnegative GTFS times for the matcher; the published source timetable is unchanged. Cache reuse requires the same agency, route ID, complete ordered platform IDs and exact coordinates. Both input timetable hashes are retained. A global stop pair, displayed line number or a daytime/nighttime label similarity cannot admit a path.

The existing pfaedle bus profile uses OSM bus relations, access/direction tags and supported turn restrictions. Runs enable `--no-trie -W`, retain every explicit fallback warning, and hash the matcher, configuration, OSM extract, pattern index, log and output tables. Imported shapes must preserve route identity and ordered stop sequence. Segments are sliced by monotone `shape_dist_traveled`, checked by the existing 120 m snap and bounded-detour guards, then simplified by 5 m. Endpoints are restored to the exact source platform coordinates after verifying the cache's rounding difference is below 1 m.

**Every previously accepted AGIS path is preserved**, and all journey IDs and calls agree with the initial `9b26f15` commit. The [regression report](../data/aargau/road-regression.json) binds that comparison to the exact delivered manifest hashes. Official and inferred contributions are counted separately. Routing failures stay null, and road matching does not run in the application. The inference does not independently establish the exact lane, a temporary diversion or a vehicle's observed position. The review/release limitation therefore remains even when an operator reaches 100% automatic coverage.

## Inferred rail fallback

[`aargau-rail-geometry.mjs`](../scripts/aargau-rail-geometry.mjs) fills missing rail segments for **44 exact route records** under SBB 11, THURBO 65 and SOB 82. The [policy](../data/aargau-rail-policy.json) binds those identities to both input timetable hashes. AVA rail and tram retain their existing complete AGIS matches. The source contains **3,210 operating points and 3,424 segments**; six segments whose endpoints are over 120 m from their declared topology nodes are rejected and listed in each audit.

The adapter derives operating-point numbers from exact SLOID or seven-digit foreign identifiers. It requires one unique FOT node with that number, at most **350 m** from the timetable platform; it never substitutes a similar name or nearby unrelated station. This is a station-centre attachment limit, distinct from the bus/AGIS 120 m projection limit. The full ordered platform pattern, direction ID and route/agency identity key every match. Each adjacent-call search forbids traversing another known scheduled operating point out of order. Repeated calls remain in the pattern and coincident consecutive operating points are rejected.

Paths follow declared source-node topology in the required direction. Coordinate order is checked against source endpoints, and topology attachments are limited to **120 m**. No nearest-coordinate merge connects separate networks. A path, including platform connectors, must fit **max(3,000 m, 4.5 × direct distance)**. Source interiors are simplified by 5 m in LV95 before transformation; exact GTFS platform endpoints are retained. Every admitted segment records `geometrySource: fot`, its original AGIS rejection, both station attachment distances, length, maximum topology attachment and ordered source-segment/node identities. Failed rail attempts retain a separate `railFailure` beside the original AGIS failure.

This is a shortest feasible **infrastructure inference** constrained by scheduled calls. It does not establish which alternative alignment, platform track or temporary diversion a train actually uses between calls. Small station/topology connectors are inferred too. FOT catalogue age and those limitations remain visible in the feed metadata. No FOT path replaces an admitted AGIS or OSM path: the [rail regression](../data/aargau/rail-regression.json) checks every prior occurrence against `3b7a9ba`, preserving **168,648 Friday / 117,681 Sunday** paths and adding **3,829 / 3,472**.

## Source dates, hashes and attribution

**Timetable:** [official 2026 GTFS dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [pinned 20260902 archive](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip). SHA-256 `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`. Credit **opentransportdata.swiss**; retain its [terms](https://opentransportdata.swiss/en/terms-of-use/), raw-data refresh obligations and distinction between publisher data and Gleislicht's processed audit. No realtime observation is included.

**Lines:** [AGIS.avk_oevlinien download](https://api.geo.ag.ch/v1/data/downloads/AGIS.avk_oevlinien/download/Shapefile/kanton_aargau), [official metadata](https://www.ag.ch/geoportal/geodatenshop/Datendokumentation.aspx?Datensatzelement=6224). The pinned archive SHA-256 is `152ba4bf1848962257d26ca1567f72d014f7fbd17677994eb9b308221354215d`. The actual geometry date in the filename and supplied metadata is **23 April 2026**; retrieval and metadata-document generation are **8 September 2026**. The September HTTP date is not a new geometry vintage. Metadata describes **normal timetable alignments and excludes temporary diversions**. The supplied PDFs and separately probed PDFs are both retained with their distinct hashes.

Required line credit: **Daten des Kantons Aargau**. Supplied terms are dated **August 2024**; they describe generally free use with source credit, not CC0. Preserve the [supplied terms](../data/aargau-sources/supplied-terms.pdf) and [metadata](../data/aargau-sources/supplied-metadata.pdf) with derived distributions. The source API limit is **20 requests/minute**, WMS **10/minute**. Rebuilding from the pinned bytes makes no AGIS requests.

**Membership boundary:** [swissBOUNDARIES3D January 2026 archive](https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip), credit **© swisstopo**. The source catalogue retains the full GeoPackage hash, extracted canton record UUID/modification date, raw geometry hash and transformed boundary hash. The full national GeoPackage and large GTFS ZIP are not duplicated in Git; the pinned regional source extracts and AGIS ZIP are stored here.

**Road fallback:** © OpenStreetMap contributors, **ODbL-1.0**; [copyright and licence](https://www.openstreetmap.org/copyright). Geofabrik Switzerland **2 September 2026** plus a border extract retrieved **8 September 2026**; merged input SHA-256 `d5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b`. Matcher **pfaedle v0.1.6-208-g99f2cd4**, commit `99f2cd466696ecc6bdb73b2b3bb9008557fcb84a`, with the unmodified bus profile. The road cache is the distributable derived geometry database and includes source/configuration hashes. Raw routing inputs remain outside Git; see [road-source reproduction](POSTBUS-ROAD-GEOMETRY.md). The importer rejects another merged OSM hash until its source dates are reviewed.

**Rail fallback:** **© Federal Office of Transport (FOT)**. The [official catalogue](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz) was checked **8 September 2026**: catalogue `datetime` is **6 July 2021**, asset update **18 January 2025**. Neither establishes September 2026 geometry validity (`validOn: null`). The [original XTF](https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf), reused from the local extract and preserved compressed in Git, matches published SHA-256 `2895811c6c338cdc3d32e946d2861ce58ca72ddde7d700fe9b73f2c393f7b828`. The [collection](../data/aargau-rail-sources/collection.json) labels its licence `proprietary` and links to [source-attribution terms](https://opendata.swiss/terms-of-use/#terms_by); retain both that label and attribution, without relabelling it CC0. Original catalogue bytes, source checksum, transformation and compressed-file hashes are preserved in the separate rail source bundle.

## Verification and reproduction

**31 tests pass** across the Aargau source, geometry, road and rail tests plus the shared road importer tests. They cover calendar/civil-day semantics, complete border chains, source identity, loop/order constraints, exact endpoints and fallback isolation. Seven rail cases add both directed orientations, foreign/SLOID identifiers, route/agency/mode isolation, later-stop shortcut rejection, disconnected/coincident nodes, missing/ambiguous/distant identities, excessive detours and malformed topology attachments.

Offline checks reconcile every delivered pattern/pair/route count, source identity, geometry-source counter, chunk hash, trip set and path endpoint. Every admitted FOT path and its complete directed source evidence are replayed from the preserved XTF; both regression reports bind all original journey data and accepted paths to current manifest hashes. The independent Python archive scan remains valid because the extracted timetable bytes have not changed.

Both dates fit the existing regional payload budgets after 5 m interior simplification:

| Gzip payload | Friday | Sunday | Existing budget |
| --- | ---: | ---: | ---: |
| Manifest | 452.5 KiB | 486.6 KiB | 650 KiB |
| Morning extract | 651.9 KiB | 599.5 KiB | 1,600 KiB |
| Largest two-hour chunk | 197.9 KiB | 126.6 KiB | 450 KiB |

Run from the repository root with Node 24+ (measured here on **26.8.1**), Python 3 and `unzip`; the synthetic integration test also uses `zip`. There are no new runtime dependencies or live-service credentials.

```sh
# Offline checks of the shipped sources, input fixtures, audits and feeds.
node scripts/check-aargau-study.mjs
node scripts/check-aargau-regression.mjs
node scripts/check-aargau-regression.mjs --rail
npx vitest run scripts/aargau-line-geometry.test.mjs scripts/inventory-aargau.test.mjs scripts/aargau-road-geometry.test.mjs scripts/aargau-rail-geometry.test.mjs scripts/enrich-postbus-roads.test.mjs

# Rebuild either date from the preserved extracted timetable and AGIS bytes.
node scripts/build-aargau-study.mjs \
  --sources data/aargau-sources --inventory data/aargau \
  --crosswalk data/aargau-line-crosswalk.json --road-cache data/aargau-road-cache.json \
  --rail-sources data/aargau-rail-sources --rail-policy data/aargau-rail-policy.json \
  --date 2026-09-04 --output /tmp/aargau-friday
# Repeat with --date 2026-09-06 and --output /tmp/aargau-sunday.

# Rebuild the inferred road cache with the pinned inputs described above.
node scripts/prepare-aargau-roads.mjs \
  --input data/aargau --sources data/aargau-sources \
  --crosswalk data/aargau-line-crosswalk.json --output /tmp/aargau-road-feeds
# Repeat matching for each agency directory listed in preparation.json:
node scripts/match-postbus-roads.mjs \
  --pfaedle /path/pfaedle --config /path/pfaedle.cfg --osm /path/postbus-roads.osm.pbf \
  --feed /tmp/aargau-road-feeds/AGENCY --output /tmp/aargau-road-matched/AGENCY
node scripts/aargau-road-geometry.mjs \
  --preparation /tmp/aargau-road-feeds --matched /tmp/aargau-road-matched \
  --source 'Geofabrik Switzerland 2026-09-02 plus OSM border extract 2026-09-08; pfaedle 99f2cd4' \
  --output /tmp/aargau-road-cache.json
# Omit --road-cache, --rail-sources and --rail-policy to measure AGIS-only coverage.

# Repackage FOT using the pinned original and preserved catalogue bytes.
gunzip -c data/aargau-rail-sources/network.xtf.gz > /tmp/aargau-network.xtf
node scripts/prepare-aargau-rail.mjs \
  --source /tmp/aargau-network.xtf \
  --catalogue data/aargau-rail-sources/catalogue.json \
  --collection data/aargau-rail-sources/collection.json --checked-on 2026-09-08 \
  --output /tmp/aargau-rail-sources --policy /tmp/aargau-rail-policy.json

# Recreate the canton membership and source fixtures from the full pinned archive.
node --max-old-space-size=8192 scripts/inventory-aargau.mjs \
  --archive /path/GTFS_FP2026_20260902.zip --sources data/aargau-sources \
  --dates 2026-09-04,2026-09-06 --output /tmp/aargau-input
python3 scripts/verify-aargau-source.py /path/GTFS_FP2026_20260902.zip /tmp/aargau-input
# Pass --inventory /tmp/aargau-input to the geometry builder after verification.

# Re-decode the source archive and official canton geometry if necessary.
python3 scripts/prepare-aargau-sources.py \
  --lines data/aargau-sources/agis-lines-20260423.zip \
  --boundary-gpkg /path/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg \
  --output data/aargau-sources
```

The source preparer deliberately rejects an AGIS archive differing from the survey's pinned hash. A refresh requires a newly reviewed catalogue/vintage and regeneration of dependent inventory/audit hashes; a mutable download URL must not silently replace this evidence. `publicationReady` remains false because the audit documents unresolved geometry and directional/seasonal review, despite complete timetable preservation and passing consistency/payload checks.
