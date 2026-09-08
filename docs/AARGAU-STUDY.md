# Aargau regional transit: canton inventory and geometry audit

Completed **8 September 2026** from the [national source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#ag). This delivers a reproducible **canton-wide timetable inventory**, an AGIS line adapter with scoped OSM bus and FOT rail fallbacks, and Friday/Sunday regional audit feeds. It is an offline data deliverable; application study selection, live refresh and deployment are separate work.

**All 5,142 national route records and 34,499,152 stop-time rows were inspected.** The archived timetable contains **289 Aargau-calling route records across 23 agency identities**. Of these, **232 operate in at least one selected civil-day fixture** and **57 are inactive on both**. The other **4,853 national route records** have no Aargau call in the archive. These are GTFS records, not counts of unique public line numbers or legal companies.

The final feed retains **11,193 Friday journeys and 7,767 Sunday journeys**, with complete source stop chains. Accepted geometry covers **every retained segment occurrence on both dates**, including all occurrences touching an Aargau stop. **Every retained directed pattern and stop-pair occurrence now has geometry.** The final platform fixes resolve Brugg Aare AG and Bern platform 49 with explicit source evidence and unchanged distance guards. This is complete automatic coverage of these two timetable fixtures, not year-round or actual-running-track certification. Bus fallback is an explicitly labelled OSM inference, including replacement services; it does not certify the actual diversion used.

The [seasonal compatibility and release audit](AARGAU-SEASONAL-AUDIT.md) extends validation to twelve dates: **110,050 complete journeys, 1,821,846 calls and 1,146 directed patterns absent from September**. It finds 12 newly active routes and 45 still inactive in the sample. The [annual witness audit](AARGAU-ANNUAL-WITNESSES.md) now identifies operating dates for all 45 remaining records: 19 selected civil dates cover them, and 2,019 archived trip templates contain 280 additional directed patterns. A separate exact-template rail candidate adds 3,616 compatible occurrences, and an explicit Interlaken parent/track-group binding adds another 162 while preserving every earlier path. A final exact-template Bern platform-50 projection and Waldshut corridor review adds the last 11 rail occurrences, preserving all 3,790 prior paths. All 194 rail patterns now have geometry. The [bus follow-up](AARGAU-WITNESS-BUS-REVIEW.md) inventories all 86 bus patterns and adds 2,466 AVA April occurrences, preserving all 3,801 prior paths. A municipal closure-localization review adds 1,836 September AVA occurrences, preserving all 6,267 earlier paths; the two Uerkenbrücke–Engelplatz directions remain held. Current annual compatibility is 8,103 of 10,988 occurrences. One bus pattern is complete; 2,885 occurrences across 85 incomplete bus patterns remain, including 161 source-time holds and 153 September closure-crossing occurrences. These templates are not added to the complete twelve-date feed sample. A 460-pattern road extension fills 16,364 seasonal gaps, and 63 exact seasonal border/platform/rail rules fill another 583 occurrences, and two exact IC 1303 rules resolve Brig–Domodossola using pinned OSM rail topology and an official station-code association. All twelve samples now have complete geometric compatibility while preserving every prior path. A separate Friday review candidate corrects four occurrences on the line 136 Wittnau bypass and line 358 Seesteg direct variant; 222 of the original 224 flagged directed bus pairs remain under review. The archived September feeds still replay exactly; application release remains pending these reviews.

## Deliverables

| Artifact | Contents |
| --- | --- |
| [Seasonal audit](AARGAU-SEASONAL-AUDIT.md) / [release review](../data/aargau-seasonal/release-review.json) | Twelve independently verified source fixtures, every seasonal pattern decision, exact September replay and ranked geometry/alignment review priorities |
| [Full route inventory](../data/aargau/inventory.json) | All 5,142 routes with membership/admission reasons, source identities, archived Aargau calls and daily eligibility; complete national agency lookup |
| [Friday audit](../fixtures/aargau/2026-09-04/audit.json) / [Sunday audit](../fixtures/aargau/2026-09-06/audit.json) | Every directed pattern and pair, accepted/failed occurrences, source feature/part/orientation, snap distances, monotone progress, source dates, geometry exclusions and all 366 GIS records |
| [Friday regional feed](../fixtures/aargau/2026-09-04/aargau-region-day-manifest.json) / [Sunday regional feed](../fixtures/aargau/2026-09-06/aargau-region-day-manifest.json) | Manifest with stops, shared paths and twelve hashed two-hour movement chunks per date |
| [Friday morning](../fixtures/aargau/2026-09-04/aargau-region-morning.json) / [Sunday morning](../fixtures/aargau/2026-09-06/aargau-region-morning.json) | Self-contained 06:45–08:45 extracts, focus 07:45 |
| [Source catalogue](../data/aargau-sources/sources.json) | Raw archive, supplied terms/metadata, decoded geometry, unsimplified canton boundary and hashes |
| [Road fallback cache](../data/aargau-road-cache.json) | Complete agency-scoped bus patterns, platform identities, ODbL provenance, matcher hashes and rejected hops |
| [FOT source bundle](../data/aargau-rail-sources/source.json) / [rail policy](../data/aargau-rail-policy.json) | Checksum-verified compressed original XTF, dated catalogue and terms link; 44 exact SBB/THURBO/SOB rail route identities |
| [Rail regression](../data/aargau/rail-regression.json) | Every prior AGIS/OSM path and complete journey preserved against commit `3b7a9ba`; current manifest hashes |
| [Explicit crosswalk](../data/aargau-line-crosswalk.json) | Ten narrowly scoped operator/line mappings plus date-limited reuse for the two directed S36 border-platform pairs |
| [Rheinfelden supplemental cache](../data/aargau-rheinfelden-road-cache.json) | Six complete bus patterns matched on the expanded cross-border OSM extract; fills only previous road failures |
| [Gap regression](../data/aargau/gap-regression.json) | All earlier AGIS/OSM/FOT paths preserved against `460b942`; 629 Friday / 320 Sunday new occurrences including final platform fixes |
| [Platform policy](../data/aargau-platform-policy.json) / [regression](../data/aargau/platform-regression.json) | Exact reviewed Brugg/Bern patterns, source hashes, source dates and attribution; all prior paths preserved against `f51df22` |
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
| Patterns with every segment matched | 1,477 | 1,080 |
| Distinct directed route/platform pairs | 6,932 | 7,456 |
| Pairs matched on every occurrence | 6,932 | 7,456 |
| Scheduled segment occurrences | 173,106 | 121,473 |
| Accepted geometry occurrences | 173,106 | 121,473 |
| Full-journey occurrence coverage | 100% | 100% |
| Occurrence coverage touching an Aargau stop | 100% | 100% |

AGIS contributes **160,104 / 107,915** accepted occurrences, the road fallback adds **9,172 / 10,085**, and FOT rail adds **3,830 / 3,473**, Friday/Sunday. Each admitted segment identifies `geometrySource: agis`, `osm` or `fot`; the per-operator and per-route counters reconcile those sources separately. A fully matched pattern may combine AGIS portions with the relevant road or rail fallback.

The operator table inventories all 23 agency identities that call in Aargau somewhere in the archive. Coverage is measured over complete retained journeys, including outside-canton portions. A dash means no eligible journey on that date, not that the operator lacks geometry year-round.

| Source operator / agency ID | Mode | Archived canton routes | Friday trips | Sunday trips | Friday geometry | Sunday geometry |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Aargau Verkehr AG (`723`) | bus | 14 | 718 | 556 | 100.00% | 100.00% |
| Busbetrieb Olten-Gösgen-Gäu (`793`) | bus | 1 | 147 | 143 | 100.00% | 100.00% |
| PostAuto AG (`801`) | bus | 105 | 4,793 | 2,555 | 100.00% | 100.00% |
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
| Südbadenbus (`sbg034`) | bus | 1 | 52 | 20 | 100.00% | 100.00% |
| Hallwilersee (`181`) | ferry | 3 | 10 | 17 | 100.00% | 100.00% |
| Basler Personenschifffahrt AG (`191`) | ferry | 1 | 0 | 0 | — | — |
| Schweizerische Bundesbahnen SBB (`11`) | rail | 69 | 1,281 | 1,270 | 100.00% | 100.00% |
| Aargau Verkehr AG (`31`) | rail | 1 | 163 | 121 | 100.00% | 100.00% |
| THURBO (`65`) | rail | 2 | 37 | 36 | 100.00% | 100.00% |
| Oensingen-Balsthal-Bahn (`68`) | rail | 2 | 0 | 0 | — | — |
| Schweizerische Südostbahn (sob) (`82`) | rail | 4 | 2 | 1 | 100.00% | 100.00% |
| Aargau Verkehr AG (`96`) | rail | 1 | 313 | 229 | 100.00% | 100.00% |
| Aargau Verkehr AG (`41`) | tram | 1 | 160 | 160 | 100.00% | 100.00% |

AVA **S14 (96), S17 (31)** and **tram 20 (41)** have all retained segment occurrences matched on both dates. This is automated ordered-path coverage, not certification of particular running tracks. SBB now has complete geometry, including the reviewed IR16 arrival at Bern platform 49. THURBO S36 reaches **100%** on both dates, including the evidence-scoped Koblenz–Waldshut crossing described below. SOB IR35 on Friday and IR26 on Sunday reach **100%**. Each fallback requires its own exact timetable route/agency identity and operating-point IDs; AGIS SBB labels are not relabelled for another operator.

## Adapter and admission rules

[`prepare-aargau-sources.py`](../scripts/prepare-aargau-sources.py) decodes the Shapefile/DBF with Python's standard library. It verifies format, record length/count, LV95 coordinate range and line identity, preserves multipart boundaries and every DBF property, and transforms LV95 to longitude/latitude using the metre-level swisstopo approximate polynomial. Coordinates are rounded to seven decimal places; source geometry and the membership boundary are unsimplified. The raw archive and original canton GeoPackage geometry are preserved for inspection. The canton is extracted by its official number, not by a hand-drawn boundary.

[`aargau-line-geometry.mjs`](../scripts/aargau-line-geometry.mjs) indexes **GO_NR + mode + exact line label**. Direct identity is the default. The explicit crosswalk handles AVA S17's source code 96 versus timetable agency 31; three ZVV-publisher records for PostAuto 205/215/245; Südbadenbus 7312a/b versus agency `sbg034`, line 7312; PostAuto-operated AVA express lines 444/445; and Hallwilersee’s Mosen/full-lake loops. Source itinerary, actual agency and matching ordered stops constrain each mapping. No operator-wide alias is introduced.

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
| `excluded-no-canton-route-for-source-identity` | 10 | 10 |
| `excluded-no-exact-identity-crosswalk` | 3 | 3 |
| `geometry-admitted` | 264 | 204 |
| `unused-inactive-or-pattern-mismatch` | 89 | 149 |

`excluded-no-canton-route-for-source-identity` means the exact identity lacks an archived Aargau-calling route; it does **not** prove the geometry lies outside the canton. In particular, AGIS labels 444/445 as PostAuto while the regional GTFS uses AVA agency 899. The [AVA annual report 2024, printed page 33](https://www.aargauverkehr.ch/images/easyblog_articles/229/AVA-Jahresbericht-2024.pdf) identifies PostAuto as the contractor operating both lines for AVA, with a concession through 2031. Together with the dated GTFS corridor identity, this supports two exact line mappings; no operator-wide alias is inferred. The mappings add 526 Friday AGIS occurrences. The three records without an exact crosswalk are the two DB **IRE3** records and SBB **S18**. The former unresolved boat records are now admitted by their exact itineraries and operator timetable. The full record table preserves itinerary, timetable field, GO name/code and source direction for review.

The road fallback closes the bus geometry gaps for **PostAuto 510/515**, Sunday night buses and agencies **7231/7244**. The new Rheinfelden supplement closes all **537 Friday / 219 Sunday** formerly missing bus-7312 occurrences. It preserves the original accepted road and AGIS paths.

The final two platform issues are now resolved: **36 Friday occurrences** on PostAuto 368 beside **Brugg AG, Aare AG**, and **one IR16 Olten–Bern occurrence per date** terminating at platform 49. Their earlier rejection reasons remain in the audit alongside the scoped fixes below. Timetable coordinates and all general attachment limits are unchanged. The existing rejected line-320 road interval remains covered by AGIS and adds no delivered gap. All scheduled journeys stay in the denominator.

## Hallwilersee and Waldshut source reuse

The [operator’s summer 2026 timetable](https://schifffahrt-hallwilersee.ch/_tmc_daten/File/Fahrplan_A4_2026_Sommer_v6_neg.pdf), preserved with its hash in the crosswalk, confirms the complete ordered itineraries for the Mosen and Sunday full-lake loops. AGIS feature **315**, label **3651.1**, maps only to GTFS agency **181**, line **3653**. Feature **318**, source label **6551.1** retained verbatim, maps only to line **3652**. Both pass the unchanged 120 m and one-lap guards: the Mosen loop follows source coordinate order; the full-lake loop uses the reverse order. This adds **18 Friday / 64 Sunday** occurrences. Hallwilersee is now **53/53 Friday and 104/104 Sunday**. This corrects the previous prose’s Sunday boat denominator of 156; the machine-readable audit always counted 104.

The FOT extract ends at **Koblenz Grenze** and has no Waldshut station node. AGIS feature **364** explicitly covers Waldshut–Koblenz–Bad Zurzach–Bülach–Winterthur under its source label S41. The retained GTFS identifies S36, and [Thurbo’s May 2026 construction notice](https://www.thurbo.ch/erkunden/ausblick/thurboleben/ki-baustellen/) independently identifies Koblenz–Waldshut as S36. The indexed 2026 network map supports that corridor too, but its direct download returned HTTP 404; the retrieved construction notice is preserved as the durable external evidence.

A separate gap rule requires **every segment of the complete ordered S36 pattern to match one source part**, then permits only the exact Koblenz platform 3 → Waldshut platform 5 pair and its reverse. Route, agency, mode, platform IDs and the two reviewed civil dates must match. It supplies geometry only after earlier sources fail; all existing AGIS, OSM and FOT paths are preserved. Each admitted segment carries `gapMappingId`, the full source projection evidence in `gapSource`, and the prior rejections. Source-record counts attribute these paths to feature 364. This adds **37 Friday / 36 Sunday** occurrences.

Thurbo announces a **14 September–2 October 2026** S36 closure on this crossing. The rule is therefore explicitly limited to **4 and 6 September**; it cannot silently apply to later seasonal fixtures or replacement buses. The separate [seasonal audit policy](../data/aargau-seasonal-gap-policy.json) now covers exact reviewed patterns on ten additional dates outside the closure interval, while preserving this original rule. That scope does not independently certify the running track.

## Inferred bus fallback

The routing-only input combines **340 complete patterns across 14 separate agency feeds** from both dates. It contains only patterns with an AGIS gap after the eight exact crosswalks. Civil-day calls are shifted as a whole to valid nonnegative GTFS times for the matcher; the published source timetable is unchanged. Cache reuse requires the same agency, route ID, complete ordered platform IDs and exact coordinates. Both input timetable hashes are retained. A global stop pair, displayed line number or a daytime/nighttime label similarity cannot admit a path.

The existing pfaedle bus profile uses OSM bus relations, access/direction tags and supported turn restrictions. Runs enable `--no-trie -W`, retain every explicit fallback warning, and hash the matcher, configuration, OSM extract, pattern index, log and output tables. Imported shapes must preserve route identity and ordered stop sequence. Segments are sliced by monotone `shape_dist_traveled`, checked by the existing 120 m snap and bounded-detour guards, then simplified by 5 m. Endpoints are restored to the exact source platform coordinates after verifying the cache's rounding difference is below 1 m.

**Every previously accepted AGIS path is preserved**, and all journey IDs and calls agree with the initial `9b26f15` commit. The [regression report](../data/aargau/road-regression.json) binds that comparison to the exact delivered manifest hashes. Official and inferred contributions are counted separately. Routing failures stay null, and road matching does not run in the application. The inference does not independently establish the exact lane, a temporary diversion or a vehicle's observed position. The review/release limitation therefore remains even when an operator reaches 100% automatic coverage.

The [Rheinfelden supplement](../data/aargau-rheinfelden-road-cache.json) uses a separate Overpass extract covering **47.53–47.60°N, 7.75–7.83°E**, including complete bus-route relations, road restrictions and stop nodes. The original Swiss/border query did not cover the northern Rheinfelden roads. OSM database timestamp is **2026-09-08T18:21:11Z**, downloaded 8 September; SHA-256 `29597ce62da93e6d712df73da8a0348049d3453ce348d593d518e7930bbd55a0`. The query is preserved in [rheinfelden.overpass](../data/aargau-supplemental-sources/rheinfelden.overpass). The unmodified pinned pfaedle profile matches all **six full patterns**, with **zero fallback warnings/rejected hops** and a maximum snap of **45.97 m**. The routing-only union has 1,332 segment occurrences; published-day coverage is counted separately after source priority.

The supplement requires exact agency `sbg034`, route `92-731-2-j26-1` and complete platform/coordinate patterns. Earlier successful road paths win. Newly filled segments carry `roadSupplement: true` and the prior road rejection; feed metadata includes both cache hashes and both OSM provenances. Attribution remains **© OpenStreetMap contributors, ODbL-1.0**. These are inferred road alignments, not certification of the operator’s actual lanes or diversions.

## Inferred rail fallback

[`aargau-rail-geometry.mjs`](../scripts/aargau-rail-geometry.mjs) fills missing rail segments for **44 exact route records** under SBB 11, THURBO 65 and SOB 82. The [policy](../data/aargau-rail-policy.json) binds those identities to both input timetable hashes. AVA rail and tram retain their existing complete AGIS matches. The source contains **3,210 operating points and 3,424 segments**; six segments whose endpoints are over 120 m from their declared topology nodes are rejected and listed in each audit.

The adapter derives operating-point numbers from exact SLOID or seven-digit foreign identifiers. It requires one unique FOT node with that number, at most **350 m** from the timetable platform; it never substitutes a similar name or nearby unrelated station. This is a station-centre attachment limit, distinct from the bus/AGIS 120 m projection limit. The full ordered platform pattern, direction ID and route/agency identity key every match. Each adjacent-call search forbids traversing another known scheduled operating point out of order. Repeated calls remain in the pattern and coincident consecutive operating points are rejected.

Paths follow declared source-node topology in the required direction. Coordinate order is checked against source endpoints, and topology attachments are limited to **120 m**. No nearest-coordinate merge connects separate networks. A path, including platform connectors, must fit **max(3,000 m, 4.5 × direct distance)**. Source interiors are simplified by 5 m in LV95 before transformation; exact GTFS platform endpoints are retained. Every admitted segment records `geometrySource: fot`, its original AGIS rejection, both station attachment distances, length, maximum topology attachment and ordered source-segment/node identities. Failed rail attempts retain a separate `railFailure` beside the original AGIS failure.

This is a shortest feasible **infrastructure inference** constrained by scheduled calls. It does not establish which alternative alignment, platform track or temporary diversion a train actually uses between calls. Small station/topology connectors are inferred too. FOT catalogue age and those limitations remain visible in the feed metadata. No FOT path replaces an admitted AGIS or OSM path: the [rail regression](../data/aargau/rail-regression.json) checks every prior occurrence against `3b7a9ba`, preserving **168,648 Friday / 117,681 Sunday** paths. FOT now contributes **3,830 / 3,473**, including one Bern platform fix per date; the later [gap regression](../data/aargau/gap-regression.json) checks the whole `460b942` feed. The boat/border extension added **592 / 319** occurrences; final platform fixes add **37 / one**, making the current regression totals **629 / 320**.

## Scoped platform fixes

The [platform adapter](../scripts/aargau-platform-geometry.mjs) runs only after all earlier sources fail. Its [policy](../data/aargau-platform-policy.json) pins **three complete date/agency/route/direction/platform-coordinate patterns**: Brugg outbound on Friday, and the two IR16 arrivals at Bern. Changed dates, direction, route or coordinates do not inherit these fixes. The [platform regression](../data/aargau/platform-regression.json) compares against `f51df22` and verifies **173,069 Friday / 121,472 Sunday** accepted occurrences remain byte-for-byte identical while filling exactly **37 / one** gaps.

**Brugg Aare AG:** OSM stop-position node **311095760**, UIC **8500575**, agrees with the GTFS platform. The pfaedle profile skipped the service-road loop and retained a 131 m snap even on a fresh extract. The complete outbound [OSM bus relation 10832272](https://www.openstreetmap.org/relation/10832272) explicitly includes that loop and the same ordered calls as GTFS route `96-160-2-j26-1`. The adapter preserves relation-member order, joins ways only at identical OSM nodes, checks tagged one-way orientation, and traverses roundabouts from the member entry to its declared exit. Disconnected or ambiguous chains are rejected. Every stop in the full pattern must pass the unchanged ordered-line, 120 m and detour guards before either missing segment is admitted.

The resulting Wildischachen → Aare AG segment is **569.62 m**, with maximum snap **2.80 m**. Aare AG → Aquarena is **3,239.53 m**, with maximum snap **0.33 m**; the source relation’s return via Wildischachen is retained. Earlier portions remain unchanged. OSM relation GTFS tags reference **18 December 2025**; the source extract has database timestamp **2026-09-08T18:32:16Z**. The complete relation, ways, nodes, source hash and ODbL attribution are preserved in [brugg-relation.json](../data/aargau-platform-sources/brugg-relation.json), with its [query](../data/aargau-platform-sources/brugg.overpass). The separate OSM platform node carries a location `fixme`; the exact stop-position node and source timetable coordinate are used, with no claimed survey correction. Each admitted occurrence has `platformFixId: brugg-service-loop`, relation ID, full monotone projection evidence and the prior rejection.

**Bern platform 49:** [SBB’s official station description](https://www.sbb.ch/en/travel-information/stations/find-station/bern-station/bern-station-description.html) identifies tracks 49/50 as western extensions of tracks 9/10 towards Fribourg. This explains the **446.03 m** distance from the general Bern operating point. The reviewed terminal projection uses the existing FOT **Bern–Bern JKLM** segment `ch14uvag00087328`, with a **33.89 m** perpendicular snap. The train first approaches its exact Bern operating point, then follows that western source segment to the projected platform position. It does not substitute a long straight attachment or another station identity. The final endpoint remains the exact GTFS platform coordinate, and the entire Olten–Bern path still passes the original detour guard.

The audit records `platformFixId: bern-platform-49`, the original station distance, directed approach edges, source-segment ID, partial-segment distances, projected point, terminal snap and topology attachment. SBB’s undated description was read through web retrieval on **8 September 2026**; direct HTTP download returned 403, so the policy preserves a short attributed excerpt and access status, without claiming an archived HTML file. FOT geometry retains its **July 2021 catalogue date**, January 2025 asset update and inferred-current-validity limitation. This is station-infrastructure geometry, not certification of the centreline of track 49.

## Source dates, hashes and attribution

**Timetable:** [official 2026 GTFS dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [pinned 20260902 archive](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip). SHA-256 `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`. Credit **opentransportdata.swiss**; retain its [terms](https://opentransportdata.swiss/en/terms-of-use/), raw-data refresh obligations and distinction between publisher data and Gleislicht's processed audit. No realtime observation is included.

**Lines:** [AGIS.avk_oevlinien download](https://api.geo.ag.ch/v1/data/downloads/AGIS.avk_oevlinien/download/Shapefile/kanton_aargau), [official metadata](https://www.ag.ch/geoportal/geodatenshop/Datendokumentation.aspx?Datensatzelement=6224). The pinned archive SHA-256 is `152ba4bf1848962257d26ca1567f72d014f7fbd17677994eb9b308221354215d`. The actual geometry date in the filename and supplied metadata is **23 April 2026**; retrieval and metadata-document generation are **8 September 2026**. The September HTTP date is not a new geometry vintage. Metadata describes **normal timetable alignments and excludes temporary diversions**. The supplied PDFs and separately probed PDFs are both retained with their distinct hashes.

Required line credit: **Daten des Kantons Aargau**. Supplied terms are dated **August 2024**; they describe generally free use with source credit, not CC0. Preserve the [supplied terms](../data/aargau-sources/supplied-terms.pdf) and [metadata](../data/aargau-sources/supplied-metadata.pdf) with derived distributions. The source API limit is **20 requests/minute**, WMS **10/minute**. Rebuilding from the pinned bytes makes no AGIS requests.

**Membership boundary:** [swissBOUNDARIES3D January 2026 archive](https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip), credit **© swisstopo**. The source catalogue retains the full GeoPackage hash, extracted canton record UUID/modification date, raw geometry hash and transformed boundary hash. The full national GeoPackage and large GTFS ZIP are not duplicated in Git; the pinned regional source extracts and AGIS ZIP are stored here.

**Road fallback:** © OpenStreetMap contributors, **ODbL-1.0**; [copyright and licence](https://www.openstreetmap.org/copyright). Geofabrik Switzerland **2 September 2026** plus a border extract retrieved **8 September 2026**; merged input SHA-256 `d5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b`. Matcher **pfaedle v0.1.6-208-g99f2cd4**, commit `99f2cd466696ecc6bdb73b2b3bb9008557fcb84a`, with the unmodified bus profile. The road cache is the distributable derived geometry database and includes source/configuration hashes. Raw routing inputs remain outside Git; see [road-source reproduction](POSTBUS-ROAD-GEOMETRY.md). The importer rejects another merged OSM hash until its source dates are reviewed.

**Rail fallback:** **© Federal Office of Transport (FOT)**. The [official catalogue](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz) was checked **8 September 2026**: catalogue `datetime` is **6 July 2021**, asset update **18 January 2025**. Neither establishes September 2026 geometry validity (`validOn: null`). The [original XTF](https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf), reused from the local extract and preserved compressed in Git, matches published SHA-256 `2895811c6c338cdc3d32e946d2861ce58ca72ddde7d700fe9b73f2c393f7b828`. The [collection](../data/aargau-rail-sources/collection.json) labels its licence `proprietary` and links to [source-attribution terms](https://opendata.swiss/terms-of-use/#terms_by); retain both that label and attribution, without relabelling it CC0. Original catalogue bytes, source checksum, transformation and compressed-file hashes are preserved in the separate rail source bundle.

## Verification and reproduction

**40 tests pass** across the Aargau source, geometry, road and rail tests plus the shared road importer tests. They cover calendar/civil-day semantics, complete border chains, source identity, loop/order constraints, exact endpoints and fallback isolation. Four additional cases cover the exact gap scope/date guard, full-pattern rejection, real Hallwilersee loops and preservation of earlier road paths. Five platform cases cover the real Brugg loop, Bern terminal extension, wrong route/direction/coordinates/date, disconnected/one-way OSM chains and distant/unrelated terminal projections. Seven rail cases add both directed orientations, foreign/SLOID identifiers, route/agency/mode isolation, later-stop shortcut rejection, disconnected/coincident nodes, missing/ambiguous/distant identities, excessive detours and malformed topology attachments.

Offline checks reconcile every delivered pattern/pair/route count, source identity, geometry-source counter, chunk hash, trip set and path endpoint. Every admitted FOT path and its complete directed source evidence are replayed from the preserved XTF; all four regression reports bind all original journey data and accepted paths to current manifest hashes. The independent Python archive scan remains valid because the extracted timetable bytes have not changed.

Both dates fit the existing regional payload budgets after 5 m interior simplification:

| Gzip payload | Friday | Sunday | Existing budget |
| --- | ---: | ---: | ---: |
| Manifest | 460.2 KiB | 493.4 KiB | 650 KiB |
| Morning extract | 658.7 KiB | 606.9 KiB | 1,600 KiB |
| Largest two-hour chunk | 197.9 KiB | 126.6 KiB | 450 KiB |

Run from the repository root with Node 24+ (measured here on **26.8.1**), Python 3 and `unzip`; the synthetic integration test also uses `zip`. There are no new runtime dependencies or live-service credentials.

```sh
# Offline checks of the shipped sources, input fixtures, audits and feeds.
node scripts/check-aargau-study.mjs
node scripts/check-aargau-regression.mjs
node scripts/check-aargau-regression.mjs --rail
node scripts/check-aargau-regression.mjs --gaps
node scripts/check-aargau-regression.mjs --platforms
npx vitest run scripts/aargau-line-geometry.test.mjs scripts/inventory-aargau.test.mjs scripts/aargau-road-geometry.test.mjs scripts/aargau-rail-geometry.test.mjs scripts/aargau-gap-geometry.test.mjs scripts/aargau-platform-geometry.test.mjs scripts/enrich-postbus-roads.test.mjs

# Rebuild either date from the preserved extracted timetable and AGIS bytes.
node scripts/build-aargau-study.mjs \
  --sources data/aargau-sources --inventory data/aargau \
  --crosswalk data/aargau-line-crosswalk.json --road-cache data/aargau-road-cache.json \
  --road-supplement data/aargau-rheinfelden-road-cache.json \
  --rail-sources data/aargau-rail-sources --rail-policy data/aargau-rail-policy.json \
  --platform-fixes --date 2026-09-04 --output /tmp/aargau-friday
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
# Rebuild the Rheinfelden supplement with the preserved query and pinned matcher.
curl -fL --data-urlencode data@data/aargau-supplemental-sources/rheinfelden.overpass \
  https://overpass-api.de/api/interpreter -o /tmp/aargau-rheinfelden.osm
node scripts/match-postbus-roads.mjs \
  --pfaedle /path/pfaedle --config /path/pfaedle.cfg --osm /tmp/aargau-rheinfelden.osm \
  --feed /tmp/aargau-road-feeds/sbg034 --output /tmp/aargau-rheinfelden-matched
node scripts/import-aargau-rheinfelden-roads.mjs \
  --matched /tmp/aargau-rheinfelden-matched --output /tmp/aargau-rheinfelden-road-cache.json
# A later mutable Overpass response requires source-date/hash review before import.
# Re-extract the Brugg relation from pinned/reviewed Overpass bytes.
python3 scripts/prepare-aargau-platform-sources.py \
  --osm /path/aargau-brugg.osm --output /tmp/brugg-relation.json
# A changed source requires review of the platform-policy hashes and patterns.
# Omit --road-cache, --road-supplement, --rail-sources, --rail-policy and --platform-fixes for AGIS only.

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

The source preparer deliberately rejects an AGIS archive differing from the survey's pinned hash. A refresh requires a newly reviewed catalogue/vintage and regeneration of dependent inventory/audit hashes; a mutable download URL must not silently replace this evidence. `publicationReady` remains false: the twelve-date follow-up has no sampled geometry gaps but leaves 222 flagged bus pairs requiring further alignment evidence before application release. Complete timetable preservation and consistency/payload checks pass; source compatibility does not certify actual historical or future operation.
