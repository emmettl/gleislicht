# Solothurn canton transit study

Built from the pinned 2026 timetable, the cantonal public-transport network and separately attributed road, rail, boat and tram supplements. **All 193 canton-serving route records across 19 GTFS agency identities and all ten districts are inventoried. 151 route records contribute admitted journeys.** This is a whole-canton census with partial geometry admission, not complete service coverage.

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
| Admitted scheduled instances | 5'955 | 4'587 |
| Admitted representative headway instances | 1'078 | 1'108 |
| Total admitted instances | 7'033 | 5'695 |
| Distinct directed patterns | 921 | 777 |
| Admitted complete patterns | 914 | 770 |
| Matched route-specific directed stop pairs | 4'256 / 4'259 (99.9%) | 4'464 / 4'467 (99.9%) |
| Matched scheduled segment occurrences | 97'141 / 97'358 (99.8%) | 67'878 / 68'102 (99.7%) |
| Matched all segment occurrences | 98'219 / 98'436 (99.8%) | 68'986 / 69'210 (99.7%) |
| Segment occurrences in admitted whole journeys | 93'785 | 65'235 |
| Previous-day carry-in / admitted | 149 / 145 | 359 / 348 |
| Patterns revisiting a platform / admitted | 21 / 21 | 18 / 18 |
| Explicit night journeys / admitted | 0 / 0 | 72 / 72 |

Pattern identity includes the GTFS route ID, direction_id and the full ordered original platform IDs, including repeats and out-of-canton calls. Both directions 0 and 1 occur. There are **343 shared patterns**, **578 Friday-only** and **434 Sunday-only** patterns. Exact per-pattern matched masks, decisions and counts are retained in the [Friday audit](../data/solothurn-audit/2026-09-04.json) and [Sunday audit](../data/solothurn-audit/2026-09-06.json).

Every admitted journey keeps every original source call, has an oriented geometry path for every adjacent pair, finite nondecreasing source times and intact call permissions. A missing segment excludes the whole journey; no call chain is cropped to improve coverage. Matched segments in an excluded journey remain in the audit denominator but are not emitted as partial vehicles. Pair counts are route-specific; shared road segments do not collapse distinct route identities.

Weissenstein accounts for all 1'078 / 1'108 representative exactTimes=0 headway instances. These are not that many observed cabins or exact scheduled departures. All motion is scheduled interpolation, not GPS or realtime observations.

Original GTFS times can place distinct calls in the same minute. The admitted feeds retain **4'147 / 3'247 zero-duration segment occurrences**. These cannot imply finite measured speed; animation can jump at the common timestamp. The audit lists the affected directed pairs and nominal positive-duration speeds. Geometry admission is not certification of physical vehicle speed, and no sub-minute times are fabricated.

## Entire-canton district coverage

| District | Called GTFS platforms | Annual route records | Routes calling district in feed | Platforms called in feed |
| --- | --- | --- | --- | --- |
| Lebern | 210 | 52 | 38 | 202 |
| Thierstein | 153 | 9 | 9 | 147 |
| Dorneck | 163 | 10 | 9 | 157 |
| Gäu | 134 | 29 | 20 | 109 |
| Wasseramt | 94 | 33 | 26 | 94 |
| Gösgen | 161 | 13 | 12 | 112 |
| Thal | 129 | 7 | 5 | 129 |
| Solothurn | 69 | 53 | 39 | 65 |
| Olten | 354 | 94 | 65 | 275 |
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
| incomplete-directed-pattern | 123 | 124 |

| Unmatched directed-pair reason | Friday | Sunday |
| --- | --- | --- |
| endpoint-gap | 0 | 1 |
| implausible-detour | 1 | 0 |
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
| 2026-09-04 | 3142 | 7033 | 691 | 0 |
| 2026-09-06 | 2574 | 5695 | 614 | 0 |

| Geometry source | Friday directed pairs / admitted occurrences | Sunday directed pairs / admitted occurrences |
| --- | --- | --- |
| basel-official-tram-10 | 77 / 3709 | 77 / 3927 |
| bern-official-413 | 10 / 370 | 10 / 238 |
| bern-official-450_S_b | 11 / 81 | 12 / 79 |
| bern-official-boat-3216 | 14 / 28 | 14 / 28 |
| bern-official-m53-corridor | 0 / 0 | 1 / 2 |
| fot | 850 / 5722 | 887 / 4819 |
| fot-reviewed-bern-eastern-terminal | 7 / 34 | 7 / 34 |
| fot-reviewed-interlaken-platforms | 6 / 33 | 6 / 19 |
| fot-sbb-reviewed-s26 | 1 / 1 | 0 / 0 |
| osm-road-inference | 266 / 5588 | 824 / 5373 |
| osm-solothurn-access-road-inference | 1 / 34 | 6 / 119 |
| osm-solothurn-como-rail-inference | 2 / 2 | 2 / 2 |
| osm-solothurn-delle-rail-inference | 1 / 1 | 0 / 0 |
| osm-solothurn-reviewed-road-detour | 0 / 0 | 1 / 5 |
| osm-solothurn-simplon-inference | 5 / 6 | 3 / 8 |
| sbb-rail-inference | 0 / 0 | 2 / 4 |
| solothurn-network | 3004 / 78139 | 2611 / 50560 |
| solothurn-reviewed-bus-junction | 1 / 37 | 1 / 18 |

- **Roads:** 805 complete bus patterns from 96 original route IDs across all twelve dates are matched with pfaedle, retaining real agency and platform identities. The bus profile respects supported OSM access, direction and turn restrictions. Every occurrence of a route-specific directed pair across complete pattern contexts must have a successful, identical path; failed matcher warnings, context disagreement and detours are rejected. Bus detours remain bounded by 3 × direct distance or 600 m. Raw routing inputs/results, logs, binary/config/source hashes and derived cache are retained in [road evidence](../data/solothurn-road-evidence/all.json.gz). This is inferred road geometry, not an operator itinerary certificate.
- **Standard-gauge rail:** 85 explicit annual SBB, BLS, SOB and OeBB route records may use FOT geometry. Only 1435 mm source segments are eligible. Original operating-point numbers, declared topology, source validity fields and full stop order constrain paths; other scheduled operating points cannot be shortcut between adjacent calls. Platform attachment is capped at 350 m, infrastructure attachment at 120 m and detour at 4.5 × or 3,000 m. FOT paths are simplified by 5 m before WGS84 conversion. asm and RBS records do not enter this standard-gauge supplement. No particular running track is certified.
- **Boat:** Bern line 3216, operator BSG, supplies Biel–Solothurn geometry for exact GTFS route 94-321-6-j26-1 / agency 182. Endpoint snap is at most 150 m, detour 3 × or 1,200 m.
- **Tram:** Basel-Stadt line 10 / operator BLT supplies exact GTFS route 91-10-j26-1 / agency 37. Endpoint snap is at most 80 m, detour 3 × or 600 m. The two directed pairs around Arlesheim Dorf platform E remain unresolved; no platform relocation is invented.

The [supplement review](../data/solothurn-audit/supplement-review.json) records every added pattern. The [alignment review](../data/solothurn-audit/alignment-review.json) compares admitted cantonal bus paths with independent road consensus and retains every excluded pattern with its failed pairs. Its 30 m threshold is diagnostic only: symmetric vertex-to-polyline distance cannot prove itinerary or road direction. It does not change admission.

| Cantonal bus comparison | Friday directed pairs | Sunday directed pairs |
| --- | --- | --- |
| alignment-disagreement-over-30m | 352 | 329 |
| no-consensus-comparator | 75 | 55 |
| within-30m-vertex-distance | 2080 | 1788 |

**123 Friday and 124 Sunday journeys remain excluded.** Tram platform gaps, conflicting bus corridors and failed full-pattern road consensus remain explicit. Disagreement with OSM remains a review flag on already admitted cantonal paths. Current operator itineraries, temporary diversions and physical direction are not certified by these internal checks.

## Reviewed rail corridor follow-up

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 6654 | 7033 | 103 | 0 |
| 2026-09-06 | 5310 | 5695 | 102 | 0 |

The table shows cumulative admission since the pre-corridor baseline, including the subsequent platform, S29 precedence, bus-junction, access-road, Bern terminal, S26, Como, Simplon, Delle, Liesberg and M53 reviews below. The [corridor review](../data/solothurn-audit/corridor-review.json) and [source policy](../data/solothurn-corridor-policy.json) add three exact associations without broadening snap/detour limits:

- **asm S11:** Bern feature **413**, operator **ASm**, line **S11**, original GTFS route **91-11-M-j26-1 / agency 81**. All 51 distinct directed platform pairs in the twelve-date sample match within 13 m. Only gaps in the earlier cantonal geometry use this operator-specific graph. **150 Friday and 95 Sunday journeys are now admitted**, preserving the full Solothurn–Oensingen–Langenthal stop chain.
- **SBB S29:** Bern feature **450_S_b**, operator **SBB**, line **S29**, route **91-29-j26-1 / agency 11**. The Aarau–Olten return legs now have line-specific geometry, with platform snaps below 48 m on the two published dates. The initial corridor pass admitted **64/86 Friday and 65/86 Sunday** journeys. The bounded source-precedence review below resolves the remaining two conflicting directed platform pairs and admits **86/86 on both dates**.
- **Däniken–Schönenwerd:** two complete graphical SBB line-540 records **DK–DKO–SCOE**, with exact operating-point IDs 8502111/8502112, standard gauge N, intact coordinate joins and at most 100 m station attachment. Six explicitly listed SBB GTFS route identities can use this corridor; all full seasonal contexts must agree. It completes **all four Sunday SN11 journeys**. Schematic two-point records and unrelated foreign source records are retained for review but never supply this corridor.

Every earlier admitted pattern remains admitted. These are bounded source-alignment improvements, not certification of current physical running tracks or diversions. The S11 and S29 route-specific Bern graphs remain bidirectional; direction comes from the original ordered GTFS calls. Complete seasonal contexts, route/operator identity and unsuccessful alternatives remain auditable.

## Interlaken Ost platform-group review

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 6863 | 7033 | 76 | 0 |
| 2026-09-06 | 5467 | 5695 | 70 | 0 |

The table shows cumulative admission since the pre-platform baseline, including the later S29 precedence, bus-junction, access-road, Bern terminal, S26, Como, Simplon, Delle, Liesberg and M53 reviews. The [platform review](../data/solothurn-audit/rail-platform-review.json) uses the existing pinned FOT source, with an explicit [route/platform crosswalk](../data/solothurn-rail-review-policy.json). The generic Interlaken Ost operating point **8507492** cannot route to Interlaken West in the selected standard-gauge graph. FOT separately identifies **8519309 / ch14uvag00165678** as **Interlaken Ost [Gleis 5-8]**, connected by **1435 mm segment ch14uvag00087489**. The review maps only original platform IDs **ch:1:sloid:7492:0:581416 (5)** and **ch:1:sloid:7492:0:460848 (7)** on exact SBB agency **11**, **IC61 route 91-61-A-j26-1** and **ICE route 91-3-Y-j26-1**. The twelve-date ICE sample uses platform 5; IC61 uses 5 and 7.

This adds **33 Friday and 19 Sunday complete journeys**, retaining every original platform ID, coordinate, time and ordered call. The source-node identity, connected segment and gauge are asserted. A changed known platform fails validation; an unknown platform or another route cannot inherit the crosswalk. Successful earlier paths remain unchanged, and the same 350 m station attachment, 120 m topology attachment, full-pattern stop-order constraints and all-context consensus apply. Both Interlaken West→Ost and Ost→West paths are tested across the retained seasonal contexts. Source dates and FOT attribution are unchanged; this corrects an operating-point association and does not certify a particular running track.

## S29 source-precedence review

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 6896 | 7033 | 50 | 0 |
| 2026-09-06 | 5486 | 5695 | 53 | 0 |

The table shows cumulative admission since the pre-S29 baseline, including the later bus-junction, access-road, Bern terminal, S26, Como, Simplon, Delle, Liesberg and M53 reviews. The [precedence audit](../data/solothurn-audit/s29-precedence-review.json) retains every complete context and the prior candidate source, path length and geometry hash. For **SBB S29 / agency 11 / route 91-29-j26-1**, the two unresolved pairs run from **Olten platform ch:1:sloid:218:5:8** to **Aarau ch:1:sloid:2113:2:3** or **ch:1:sloid:2113:1:1**. FOT selects approximately **45.1 km** alternatives for some terminating patterns; longer patterns reject that path under their full stop-order constraints and use the **13.3 km** Bern S29 geometry. Those different candidates previously failed global consensus.

The explicit [policy](../data/solothurn-s29-precedence-policy.json) now chooses Bern's exact **450_S_b / SBB / S29** line for these two pairs in every retained context before applying consensus. Both paths remain within the existing snap and detour limits, with maximum platform snaps below 11 m. Original platform records and source/context hashes are asserted. Reverse pairs, other platforms, operators, modes and route identities cannot inherit this precedence. No general consensus rule is relaxed and no source edge is invented. This adds **22 Friday and 21 Sunday journeys**, completing **all 86 S29 journeys on each published date** while preserving all previously emitted calls and paths. The Bern source dates, attribution and inference limitations above still apply.

At this stage, the remaining bus gaps included divergent road candidates at Liestal Bahnhof, excessive detours, and matcher-rejected replacement/night services; the later access-road review below resolves some of them. The Oberbuchsiten road candidates still disagree, but the separate cantonal-source junction review below supplies that exact pair. The [PostAuto 2026 Thal network map](https://www.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/nordschweiz/liniennetz-thal-26.pdf) and [Oristal/Dorneckberg network map](https://www.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/nordschweiz/liniennetz-oristal-dorneckberg-26.pdf?vs=4) were located as further operator-evidence leads. They are not ingested geometry or grounds to choose between the stored road candidates. The network maps alone do not admit those journeys; the subsequent source reviews below document any resolved pairs.

## Oberbuchsiten bus source-junction review

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 6918 | 7033 | 44 | 0 |
| 2026-09-06 | 5507 | 5695 | 48 | 0 |

The table shows cumulative admission since the pre-junction baseline, including the later access-road, Bern terminal, S26, Como, Simplon, Delle, Liesberg and M53 reviews. The [junction audit](../data/solothurn-audit/bus-junction-review.json) and [explicit policy](../data/solothurn-bus-junction-policy.json) review just **PostAuto / agency 801 / line 126 / route 96-145-2-j26-1**, from **Oberbuchsiten Bahnhof ch:1:sloid:89885:0:01** to **Oberbuchsiten Löwen ch:1:sloid:81284:0:390682**. Two original, non-tunnel Bus features—**4562863f-1da7-42ea-9cf8-f580fb14b86c** and **64c5c5c2-6512-4ef1-a06e-4bac13d29b5d**—end at LV95 **[2624747.100, 1239883.090]** and **[2624747.099, 1239883.092]**, separated by **2.236 mm**.

A supplementary graph retains both features' original vertices and adds **one explicitly inferred connector, zero new vertices**, bounded by **3 mm**. The primary canton graph is unchanged; this is not global near-endpoint stitching. Feature hashes, mode, tunnel flags, endpoint positions, exact route/operator and original platform coordinates are checked. Unknown routes/platforms, reverse-pair reuse, larger gaps, altered geometry and tunnel endpoints cannot inherit the review. The existing bus snap/detour limits apply; the observed platform snaps remain below 7 m. All observed complete contexts receive the same source path. This admits **37 Friday and 18 Sunday additional whole journeys** without changing previously emitted calls or geometry.

The connection is an explicit inference between source endpoints, not a proven export defect or operator-confirmed road junction. Cantonal source dates and attribution remain as documented below. Bidirectional source geometry still does not certify legal road direction or current diversions. The original vertices remain in the source graph; ordinary seven-decimal WGS84 output can merge the two millimetre-separated positions at display precision.

The original Arlesheim and Liestal gaps, source hashes, endpoint coordinates, candidate paths and full-pattern IDs are retained in the [local-gap review](../data/solothurn-audit/local-gap-review.json). At **Arlesheim Dorf**, original tram platform **E / ch:1:sloid:77:1:5** is **138.4 m** from the retained BLT line, beyond its 80 m attachment limit. At **Liestal Bahnhof**, the inspected cantonal feature endpoints are **1.058 m** apart, and the two successful road candidates differ between a roughly **293 m** path and a **535 m** station loop. These cases do not meet the reviewed 3 mm connection rule. Arlesheim remains excluded. Liestal is resolved by the separately filtered road graph below, without moving a platform coordinate or stitching the cantonal gap.

## Service-road and stop-candidate review

This table is cumulative from its recorded baseline and includes the later Bern terminal, S26, Como, Simplon, Delle, Liesberg and M53 follow-ups. The service-road contribution remains 34 Friday / 119 Sunday journeys.

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 6955 | 7033 | 40 | 0 |
| 2026-09-06 | 5525 | 5695 | 46 | 0 |

The [access-road audit](../data/solothurn-audit/access-road-review.json) retains all candidate decisions from a new extraction of the pinned **Geofabrik Switzerland 2026-09-02** PBF, SHA-256 **39257b1c92a45da38ca94ddb745bdcf53551d0e66b02d89f3de3e7c064c3a29f**. The [source bundle](../data/solothurn-access-roads/source.json) retains the graph, exact filter/routing configurations, original routing input, raw matcher output, hashes and licence. It covers **all 72 complete twelve-date patterns on eight explicitly selected bus route records**, including the rejected alternatives. The [admission policy](../data/solothurn-access-policy.json) selects only six previously missing directed pairs; all earlier successful cantonal and supplementary paths take priority.

The pfaedle bus profile includes **highway=service** and tightens stop-position candidates and edge snaps to **20 m**. Existing access/road-class penalties, supported one-way and turn restrictions remain; no tag or access rule is removed. Candidate-search limits are distinct from post-match attachment measurements: the largest measured attachment across the entire imported run is **24.253 m**, below the unchanged 120 m importer limit. All 72 patterns produce **zero matcher fallbacks and zero importer issues**. Every selected pair must still have byte-identical geometry across every complete context and satisfy the existing **3 × / 600 m** road detour limits. This is OSM-based route inference, not operator-confirmed access, temporary diversions or exact physical direction.

- **Liestal Bahnhof Süd → Bahnhof, PostAuto 111:** both original platform-ID forms receive separately reviewed paths. The main platform pair agrees on the **534.6 m station loop across all three full contexts**; the generic-ID pair follows **454.8 m**. This adds **34 Friday and 33 Sunday journeys**.
- **Grenchen Nord ↔ Biel/Bienne Carterminal, EV6 / agency 7231:** both directed pairs now match the service-road graph, adding **79 Sunday replacement journeys**. The old matcher attached Grenchen Nord **129.2 m** away and rejected it; no original stop coordinate is replaced.
- **Solothurn Hauptbahnhof → Biberist Aesplistrasse, M11:** adds **3 Sunday night journeys**.
- **Aarau Aarepark → Kettenbrücke, N22:** adds **4 Sunday night journeys**. Night services still require supplemental geometry on every leg.

At this stage, the graph rejected the **Egerkingen Gäu Park → Bahnhof** and **Liesberg Seemättli → Ochsengasse** detours; the later bounded Liesberg review below resolves the latter; **EV4 Pieterlen → Biel** and **M53 Amthausplatz → Baseltor** still disagree between complete contexts. These whole journeys were excluded at this stage. Immediately after the service-road review, the study excluded **167 Friday / 175 Sunday journeys**, including **two Sunday M53 night journeys**. All previously emitted journey calls, timestamps, permissions and paths are unchanged.

Attribution is **© OpenStreetMap contributors, ODbL-1.0**; [copyright and terms](https://www.openstreetmap.org/copyright). This reuses the September 2 source, not a new effective alignment date. The exact pfaedle commit is **99f2cd466696ecc6bdb73b2b3bb9008557fcb84a**; its University of Freiburg / Patrick Brosi et al. configuration and GPL v3 [licence](../data/solothurn-access-roads/pfaedle-LICENSE) are retained. The original Luzern profile provenance is retained in [parent-source.json](../data/solothurn-access-roads/parent-source.json). The graph extraction is input-dependent; it is not claimed to establish complete national or cross-border road coverage.

## Bern platforms 49/50 and the eastern approach

This table is cumulative from its recorded baseline and includes the later S26, Como, Simplon, Delle, Liesberg and M53 follow-ups. The Bern terminal contribution remains 34 journeys on each published date.

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 6989 | 7033 | 37 | 0 |
| 2026-09-06 | 5644 | 5695 | 37 | 0 |

The [Bern terminal audit](../data/solothurn-audit/bern-terminal-review.json) adds **34 complete journeys on each published date**: 18 SOB IR35, 13 SBB IR35, one BLS IR35, one SBB IR and one SBB IR16. All previous journey stops, timestamps, permissions and paths are retained. The five route/operator identities stay separate. This resolves every published-date exclusion on these five route records.

The SBB [Bern station plan](../data/solothurn-bern-terminal-sources/sbb-bern-plan-2026-08.pdf), dated **August 2026** and acquired **8 September 2026**, shows tracks **49/50 west of the central station**. The original GTFS coordinates are **446.0 / 427.8 m** from the FOT station point and exceed its unchanged 350 m platform limit. The plan establishes platform identity and station extent; it is not used to invent a surveyed alignment. Attribution: **© SBB 08/2026; © OpenStreetMap** as printed on the plan; no new open licence is asserted for the plan.

The [reviewed policy](../data/solothurn-bern-terminal-policy.json) projects those exact platform coordinates onto original SBB FOT station curve **ch14uvag00087328**, at **33.9 / 38.6 m**, within a separately bounded **75 m** projection limit. It retains the **427.2 / 408.2 m** station-centre side of that curve as an explicitly inferred terminal spur. The original Bern operating point stays in place. In this pattern-local graph it connects only to **Bern Wyler, ch14uvag00139673**, preserving the actual source vertices on the eastern approach; the other three Bern connections are removed from this variant. The source records have **2021-07-06** data stamps; their validity begins **2005-02-11 / 2015-10-21**, with no recorded end. These are not proof of present-day running-track or switch geometry.

Only a single terminal Bern call on one of the two exact platforms can use this graph. IR16 must have adjacent **Olten**; the other four identities must have adjacent **Burgdorf**. Through calls, unknown platforms, other operators and changed coordinates cannot inherit the review. Every complete retained pattern across all twelve dates participates in consensus, with the original FOT validity, **350 m station / 120 m topology** attachment, detour and stop-order rules unchanged. Only previously failed terminal pairs can change. Full source hashes, original and projected coordinates, removed connection IDs and emitted source-pair evidence are retained in the audit.


## S26 Aarau–Olten source conflict

This table is cumulative from its recorded baseline and includes the later Como, Simplon, Delle, Liesberg and M53 reviews. The S26 contribution remains one Friday journey.

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 7023 | 7033 | 10 | 0 |
| 2026-09-06 | 5678 | 5695 | 11 | 0 |

The [S26 review](../data/solothurn-audit/s26-review.json) resolves the final **one Friday S26 journey**; Sunday admission is unchanged. It also resolves **one journey on each of 16 January, 23 October and 11 December** in the seasonal sample. All **41 Friday / 39 Sunday S26 journeys** are now admitted. Both full patterns run Muri AG–Wohlen–Lenzburg–Rupperswil–Aarau–Olten, with different Muri platforms. Their final **Aarau platform 5 → Olten platform 9** pair now follows the same **13,699.1 m** geometry. Every earlier journey keeps its original calls, timestamps, permissions and paths.

FOT segment **ch14uvag00087837**, between operating points **8502111 Däniken SO / ch14uvag00089021** and **8502143 Däniken Ost / ch14uvag00089022**, declares **mm1000**. It stays byte-for-byte unchanged and excluded from the standard-gauge graph. That missing link previously forced the Aarau–Olten search toward a detour through already-called stations, which the full-pattern stop-order rule correctly rejected.

The independent, retained **SBB Infrastructure** graphical line **540 / DK–DKO / km 45,673.43–46,100** declares gauge **N** and supplies **44 original vertices**. The [policy](../data/solothurn-s26-policy.json) adds this record as a separately named segment only in the reviewed S26 graph, anchored to the exact FOT operating points within **9.6 / 10.0 m**. It does not relabel the rejected FOT segment, borrow S29 route identity or relax source-topology, station-attachment, detour or stop-order limits. The complete earlier calls remain blocked against revisiting. Only the exact SBB agency **11**, route **91-26-j26-1**, line **S26**, directed original platform pair can receive a previously failed path. Reverse pairs and other routes cannot inherit this review.

All twelve retained dates participate in supplementary consensus; this exact pair occurs in two complete contexts and produces identical geometry. Source bytes, hashes, gauge conflict, added curve, measured attachments and whole-journey admission changes are retained. SBB metadata was modified **2026-07-29**, data processed **2026-09-02**, and the source acquired **2026-09-08**. These are publication/processing dates, not per-feature alignment validity. Attribution: **SBB Infrastructure / data.sbb.ch**, [retained source catalogue and terms](../data/solothurn-sources/corridors/sbb/sources.json); FOT source dates and attribution remain as listed below. Exact running track, switch geometry and effective seasonal alignment remain unverified.


## Chiasso–Como passenger corridor

This table is cumulative from its baseline and includes the later Simplon, Delle, Liesberg and M53 reviews. The Como contribution remains two journeys per published date.

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 7024 | 7033 | 9 | 0 |
| 2026-09-06 | 5678 | 5695 | 11 | 0 |

The [Como review](../data/solothurn-audit/como-review.json) adds **two complete EC journeys on each published date**, retaining every earlier journey unchanged. It reviews only SBB agency **11**, EC route **91-3R-Y-j26-1**, and exact directed pairs **Chiasso platform 1 → Como S. Giovanni (8301307)** and **Como S. Giovanni → Chiasso platform 6**. The entire retained twelve-date scope contains **eight complete route patterns**; three contexts in each direction contain the foreign pair. Como must be a single terminal call. Other routes, unknown platforms, shortened patterns and changed original coordinates cannot inherit admission.

The [retained source bundle](../data/solothurn-como-sources/sources.json) contains a historical OSM snapshot at **2026-09-02 00:00 UTC**, acquired **2026-09-08**, with every source way's tags, version, timestamp and referenced nodes. The 8 September response-database timestamp is not the requested historical snapshot date. Original shared node IDs alone establish connectivity. Only 1435 mm passenger main-line ways are used; there are no siding exceptions or coordinate-based joins. The paths pass through **Monte Olimpino I, OSM way 25148357** and measure **4,123.8 / 4,228.8 m**. Track attachments measure **6.7 / 9.4 m** outward and **9.4 / 23.5 m** inward. The unchanged source matcher limits are **350 m station identity**, **60 m track attachment**, **5 m projection alternatives**, **45° maximum turn** and **8 km maximum path**. These are inferred corridor paths, not legal rail direction or exact running-track certification.

The independent Regione Lombardia 1:10,000 rail inventory is complete against its separate object-ID query: **eight records**, including five RFI standard-gauge records along the reviewed corridor and three excluded records representing the longer bypass or unrelated branch. The maximum one-way vertex-to-path separation for the five selected records is **37.8 m**, within the **50 m** review threshold. This comparison does not establish exact track alignment or reciprocal coverage. **No Lombardia geometry enters the feed.** Metadata revision is **2024-06-27**; the retrieved dataset metadata does not specify a licence, and the generic terms page does not establish one. The original JSON, metadata, terms and all inclusion/exclusion decisions are retained.

Feed geometry attribution is **© OpenStreetMap contributors, ODbL-1.0**, with [retained terms](../data/solothurn-como-sources/osm-terms.html.gz). The independent comparison is attributed to **Regione Lombardia**. The [Solothurn policy](../data/solothurn-como-policy.json) pins both directed path hashes, ordered way IDs, station identities, exact platforms and all eight context IDs. The source bundle's copied scope.json records the parent Zug source review; it does not define Solothurn admission. Seasonal application does not establish historical operation or year-round physical alignment.


## Brig–Domodossola passenger corridor

The table is cumulative from the shared pre-Simplon/Delle baseline. The Simplon contribution is six Friday and eight Sunday journeys; Delle contributes one further Friday journey. The table also includes the later five-journey Sunday Liesberg and two-journey Sunday M53 reviews.

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 7026 | 7033 | 7 | 0 |
| 2026-09-06 | 5680 | 5695 | 9 | 0 |

The [Simplon audit](../data/solothurn-audit/simplon-review.json) adds **six Friday / eight Sunday complete EC journeys**. It checks all **56 complete retained twelve-date patterns** on SBB agency **11**, EC route **91-2W-Y-j26-1**, including every previously unsuccessful platform variant. Eight exact directed Brig–Domodossola pairs are reviewed; the foreign call must occur exactly once at a journey terminal. Original calls, platform coordinates, permissions, times and every earlier successful path remain unchanged.

The retained SBB/FOT [station record](../data/solothurn-simplon-sources/sbb-domodossola-stations.json) explicitly links **8501607 Domodossola** to timetable number **8301003**, with edition **2024-09-19** and validity beginning **2024-12-15**. This is an exact source association, not a name/proximity guess. The SBB **2024-08-06** [station factsheet](../data/solothurn-simplon-sources/sbb-domodossola.pdf), target-status diagram on page 3, distinguishes **Domodossola FS 83-01003-3** from the separate FM and Domodossola II facilities. The crosswalk applies only at the internal graph boundary: the original GTFS foreign ID remains in every emitted call.

The [source bundle](../data/solothurn-simplon-sources/sources.json) retains an OSM snapshot at **2026-09-08 00:00 UTC**, including source tags, versions, timestamps and complete referenced nodes. Original shared-node topology supplies standard-gauge running lines. The one explicitly pinned passenger crossover **643956810**, gauge **1435**, passenger_lines **2**, inside the **Simplontunnel**, is used by five of the eight platform-pair paths. The other three use the connected running lines without it. No siding, yard or arbitrary coordinate connection is admitted. Every directed path and source-edge order is hash-pinned. Paths measure **40,671.0–40,876.5 m**, with track attachments no greater than **34.0 m**. Source limits remain **350 m station identity**, **120 m track attachment**, **5 m projection alternatives**, **90° maximum turn** and **50 km maximum path**.

The retained BLS [works notice](../data/solothurn-simplon-sources/bls-closures.html.gz), rechecked **8 September**, describes the Iselle–Domodossola weekday closure **27 July–11 December, 10:30–13:30**, plus a later October/November extension and specified November night closures. The six published Friday EC legs run **08:44–09:12, 08:48–09:16, 14:44–15:12, 16:48–17:16, 19:44–20:12 and 19:48–20:16**; none overlaps the applicable Friday window. The eight Sunday legs are outside the notice's weekday scope. This is a consistency check, not operator confirmation of every historical journey or passage time within a seasonal work zone. The copied field-145 timetable PDF concerns the parent Aargau IC 1303 review and does not set this EC route's times or calendars.

Attribution: **© OpenStreetMap contributors, ODbL-1.0** for emitted geometry; **SBB Infrastructure / opentransportdata.swiss** for station identity and the SBB diagram; **BLS** for works context. No open licence is invented for the retained SBB document. The [policy](../data/solothurn-simplon-policy.json) records original IDs, coordinates, full-pattern scope, source hashes and the crossover exception. The September 8 OSM snapshot postdates the published September 4/6 timetable sample. Applying it to those dates or other seasons remains an explicitly unproven historical alignment inference; running tracks and legal physical directions are not certified.


## Delle–Boncourt passenger corridor

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 7026 | 7033 | 7 | 0 |
| 2026-09-06 | 5680 | 5695 | 9 | 0 |

This table shares the pre-Simplon baseline and includes both border reviews and the later Liesberg road and M53 corridor reviews. The [Delle audit](../data/solothurn-audit/delle-review.json) adds **one Friday journey and no Sunday journeys**, for exact SBB agency **11**, **RE route 91-54-Y-j26-1**, **Delle 8718444 → Boncourt platform 3 / ch:1:sloid:128:2:3**. All **eight complete retained route patterns** are checked; four contain this directed pair. Delle must occur once at a terminal. The opposite direction, unknown platforms and other routes cannot inherit admission. All previous paths, stop coordinates, original IDs, calls and times are preserved.

The [source bundle](../data/solothurn-delle-sources/sources.json) retains the exact bounded Overpass query, original response and SHA-256 hashes, retrieved **8 September 2026** at historical snapshot **2 September 2026 00:00 UTC**. OSM station nodes **3080770163 / Delle / 8718444** and **3080770156 / Boncourt / 8500128** supply exact identities. The passenger station is not conflated with the distinct FOT **8500129 Delle-Frontière** operating point. Twelve original **1435 mm passenger branch-line ways**, connected at shared source nodes, form the **1,603.9 m** path. Station identity offsets are **34.1 / 28.6 m**; track attachments are **13.2 / 1.3 m**. There are no siding, yard or spur exceptions and no added junctions. The [policy](../data/solothurn-delle-policy.json) retains the **350 m station identity**, **60 m track attachment**, **5 m projection alternatives**, **45° turn** and **8 km maximum path** bounds. Full-pattern and all-context consensus checks remain in force.

The official [SNCF TER Delle station page](https://www.ter.sncf.com/bourgogne-franche-comte/se-deplacer/prochains-departs/delle-87184440), reviewed **8 September**, identifies the passenger station and lists trains toward Porrentruy/Delémont. This supplies station/passenger-service context; live platform displays do not prove the archived journey's running track. The [SBB Boncourt works notice](https://news.sbb.ch/fr/019d7b77-1725-7b43-86b8-b37fb2c2d611/modernisation-de-la-gare-de-boncourt), published **8 January 2025**, describes central-platform and track renewal, planned commissioning in late 2025 and finishing works through summer 2026. It is planned works context, not proof of completion. The retained [review observations](../data/solothurn-delle-sources/official-station-review.json) are clearly identified as web-reviewed notes: direct SNCF download returned 403, so no raw page body is claimed retained.

Geometry attribution is **© OpenStreetMap contributors, ODbL-1.0**; timetable attribution remains **opentransportdata.swiss**, with **SNCF TER / SBB** credited for official review context. Applying this OSM snapshot to other seasons remains a historical alignment inference. No exact running track or physical direction is certified. **All rail journeys in the two published-date canton-serving samples now have complete geometry**; this does not assert that every rail service runs on those dates or that every seasonal pattern is admitted.

## Liesberg road-detour and remaining local gaps

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 7033 | 7033 | 0 | 0 |
| 2026-09-06 | 5688 | 5695 | 2 | 0 |

This table is cumulative and includes the later two-journey Sunday M53 review. The [road-detour audit](../data/solothurn-audit/road-detour-review.json) adds **five Sunday line-118 journeys**, retaining every Friday journey and all earlier Sunday admissions unchanged. The exact exception is **PostAuto / agency 801 / route 96-131-8-j26-1**, from **Liesberg, Seemättli ch:1:sloid:72196** to **Ochsengasse ch:1:sloid:72197**. Its **688.3 m** path exceeds the generic **600 m / 3 × direct distance** rule because the road climbs around the hillside. The [policy](../data/solothurn-road-detour-policy.json) permits at most **700 m for this directed pair only**. Every other route and pair retains the original bounds.

The emitted path is the unchanged result from the retained, verified pfaedle service-road run. Its one unique complete routing context includes the return call at Seemättli; calls are never deduplicated or shortened. All eight reviewed bus routes and all 72 complete routing inputs remain checked against the durable twelve-date context. Source hashes, matcher logs, original coordinates and the exact admitted geometry hash are asserted. The matcher must still report no fallback or import issue, and every occurrence must agree before a pair can be reused. The exception does not permit a failed or conflicting pattern to pass.

The [source bundle](../data/solothurn-road-detour-sources/sources.json), retrieved **8 September 2026**, retains OSM at **2 September 2026 00:00 UTC**. Relation **11568519**, explicitly tagged **PAG / bus 118 / GTFS 96-131-8-j26-1**, records consecutive Seemättli → Ochsengasse stops. Original ways **204519958 / Seemättliweg** and **204513892 / Im Pfarrgarten** connect through the shared node **2145136622**. The review follows their declared relation order and direction, with exact source-feature hashes and no invented connection. Sampling both polylines every **5 m** gives maximum distances of **17.5 m from emitted path to source corridor** and **5.2 m in the reverse comparison**, within the explicit **20 m** comparison bound. These are sampled corridor comparisons, not exact Hausdorff bounds or proof of operational direction. The OSM relation is an additional representation from the same community source as the routing PBF, not an independent provider.

Official [timetable field 50.118](../data/solothurn-road-detour-sources/50.118.pdf), dated **3 December 2025**, confirms Seemättli → Ochsengasse → Dorfplatz → Seemättli and the overnight services. It provides stop-order/calendar context, not road coordinates. Geometry remains attributed to **© OpenStreetMap contributors, ODbL-1.0**, timetable context to **PostAuto / oev-info.ch**, and the national feed to **opentransportdata.swiss**. No licence is inferred for the timetable PDFs. Historical alignment, physical access and current diversions remain unproven.

The same review preserves negative findings:

- **Egerkingen Gäu Park → Bahnhof, BOGG 501:** [official field 50.501](../data/solothurn-road-detour-sources/bogg-501.pdf), dated **29 October 2025**, confirms the consecutive stops. Historical OSM relation **6455364** has the exact route/operator identity, but its mapped road corridor differs from the retained **1,213.2 m** pfaedle candidate: sampled distances reach **177.8 / 321.8 m** in the two comparison directions. The cantonal **1,316.4 m** candidate also differs. The evidence does not justify choosing one or raising the detour limit. **All 29 Friday journeys remain excluded.** The [rejected review](../data/solothurn-road-detour-sources/egerkingen-rejected-review.json) and audit retain the relation, source edges and candidate hash. Original BOGG website links returned 404; the retained official timetable-field download is the accessible replacement source.
- **Arlesheim Dorf platform E, tram 10:** original coordinate **[7.61942041, 47.49339586]** remains **120.7 m** from the nearest retained historical OSM tram track, beyond the **80 m** attachment limit. This corroborates the previous **138.4 m** gap to Basel's official linework. No source-supported platform relocation was established. **94 Friday / 103 Sunday journeys remain excluded.**
- **EV4 Pieterlen → Biel Carterminal:** the retained complete-pattern road candidates disagree; **21 Sunday replacement-bus journeys remain excluded**. M53 was unresolved at this stage; the subsequent official-corridor review below admits its two Sunday journeys.

Final exclusions are **123 Friday / 124 Sunday journeys**, all tram or bus. Every rail journey in both published-date samples still has complete geometry.

## M53 official night-line corridor and Pieterlen alternatives

| Date | Previously admitted | Now admitted | Additional complete patterns | Previous patterns lost |
| --- | --- | --- | --- | --- |
| 2026-09-04 | 7033 | 7033 | 0 | 0 |
| 2026-09-06 | 5693 | 5695 | 1 | 0 |

The [M53 audit](../data/solothurn-audit/m53-review.json) admits **two Sunday night-bus journeys**, with no Friday change. Bern's original line feature **9353**, line **M53**, operator **Busbetrieb Solothurn und Umgebung**, is explicitly associated with **agency 883 / route 92-M53-j26-1**. The [policy](../data/solothurn-m53-policy.json) covers only **Amthausplatz platform A / ch:1:sloid:494:0:1 → Baseltor / ch:1:sloid:72386**. Its **847.6 m** path attaches within **29.1 m**, satisfying the unchanged **60 m snap, 3 × direct distance / 600 m minimum detour allowance and 5 m alternative-snap** limits. All earlier successful paths take precedence.

Both retained complete M53 contexts, containing **44 and 43 original calls**, are checked against the twelve-date snapshot. The prior **1,040.2 m and 870.0 m** road alternatives remain retained with their complete calls and geometry; neither is selected by relaxing road consensus. The separately attributed official night-line feature supplies this exact pair. Solothurn's own network excludes night routes, so every other M53 leg still requires admitted supplementary geometry. Unknown routes, operators, platforms and the reverse direction cannot inherit this association.

The [source bundle](../data/solothurn-m53-sources/sources.json) pins the unchanged Bern feature and package hashes. Bern data was updated **1 January 2026**, the package published **9 July 2026**, and acquired **8 September 2026**. Attribution is **Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern**, under the retained [German](../data/solothurn-m53-sources/terms_of_use_de.pdf) and [French](../data/solothurn-m53-sources/terms_of_use_fr.pdf) cantonal terms, dated **20 January 2026**. No generic Creative Commons licence is substituted. Official [timetable field 40.953](../data/solothurn-m53-sources/40.953.pdf), dated **10 September 2025**, confirms Kofmehl → Amthausplatz → Baseltor, with departures 01:08/02:38, 01:13/02:43 and 01:15/02:45 respectively. It supplies operator and stop-order context; the pinned national GTFS remains authoritative for emitted calls and times. Timetable context is credited to **BSU / oev-info.ch**, without an inferred PDF reuse licence.

The same bundle retains the **two full EV4 contexts** and their Pieterlen Bahnhof → Biel Carterminal candidates, **10,332.6 m and 10,240.1 m**. They differ mainly at the Pieterlen station forecourt, including a loop in one candidate. The retained official SBB works page documents replacement buses for **5–7 September 2026, Saturday 04:00 to Monday 04:00**, covering the Sunday validation date. Its [parking plan](../data/solothurn-m53-sources/pieterlen-parking-plan.pdf), created **11 June 2026**, shows parking closures and relocation westward from July 2026 through November 2027. Those documents do not establish a replacement-bus itinerary or prove that either candidate was prohibited. **All 21 Sunday EV4 journeys therefore remain excluded.** The historical OSM review is retained and attributed to **© OpenStreetMap contributors, ODbL-1.0**; works context is credited to **SBB**. Applying any source vintage to other seasons remains an inference, with no certification of physical direction or current diversions.

## Seasonal and holiday sample

| Civil date | Source journeys | Admitted journeys | Complete admitted patterns |
| --- | --- | --- | --- |
| 2026-01-16 | 7031 | 6845 | 884 |
| 2026-01-18 | 5362 | 5254 | 738 |
| 2026-04-03 | 5450 | 5342 | 741 |
| 2026-04-05 | 5730 | 5605 | 744 |
| 2026-07-17 | 7127 | 6994 | 840 |
| 2026-07-19 | 5523 | 5419 | 747 |
| 2026-08-01 | 5566 | 5458 | 757 |
| 2026-09-04 | 7156 | 7033 | 914 |
| 2026-09-06 | 5819 | 5695 | 770 |
| 2026-10-23 | 7146 | 7023 | 910 |
| 2026-10-25 | 5527 | 5423 | 735 |
| 2026-12-11 | 7025 | 6902 | 885 |

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

The app release uses the Friday fixture in [top-level manifest](../public/data/solothurn-region-day-manifest.json), morning snapshot and twelve verified chunks. [Display release proof](../data/solothurn-audit/display-release.json) records both dates: display simplification is bounded by 5 m with unchanged endpoints, calls and movements. The Friday manifest is 407'314 bytes gzipped. Source archives remain unchanged by display simplification; FOT has its separately declared 5 m source transformation.

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
node scripts/prepare-solothurn-access-roads.mjs
node scripts/match-postbus-roads.mjs --pfaedle /private/tmp/gleislicht-pfaedle/build/pfaedle --osm /private/tmp/solothurn-access-network.osm --config data/solothurn-access-roads/routing.cfg --feed /private/tmp/solothurn-access-feed --output /private/tmp/solothurn-access-matched
node scripts/import-solothurn-access-roads.mjs

# Build complete directed patterns, both feeds and all machine audits.
npm run data:solothurn
node scripts/review-solothurn-local-gaps.mjs
npm run data:solothurn:check
npm run data:solothurn:seasonal
npm run data:solothurn:seasonal:check
npm run data:solothurn:alignments
npm run data:solothurn:release
npm run data:solothurn:docs
npx vitest run scripts/solothurn-region.test.mjs scripts/solothurn-corridor.test.mjs scripts/solothurn-rail-review.test.mjs scripts/solothurn-s29-precedence.test.mjs scripts/solothurn-bus-junction.test.mjs scripts/solothurn-access-roads.test.mjs scripts/solothurn-bern-terminal.test.mjs scripts/solothurn-s26-review.test.mjs scripts/solothurn-como-rail.test.mjs scripts/solothurn-simplon-rail.test.mjs scripts/solothurn-delle-rail.test.mjs scripts/solothurn-road-detours.test.mjs scripts/solothurn-m53-corridor.test.mjs scripts/solothurn-release.test.mjs
npx playwright test --config playwright.solothurn.config.ts
python3 -m unittest discover -s scripts -p 'test_bern_sources.py'
```

The road cache/evidence can be validated offline. To rematch, prepare with `node scripts/solothurn-road-geometry.mjs prepare data/solothurn-audit/seasonal-timetable-cache.json.gz /path/prepared`, run `scripts/match-postbus-roads.mjs` on `/path/prepared/all` using the exact recorded pfaedle binary/config and OSM extract, then import with `node scripts/solothurn-road-geometry.mjs import /path/prepared /path/matched`. The large OSM input and matcher binary are external reproduction prerequisites; their hashes are retained. New bytes require fresh matching and review.

The timetable cache is an ignored regeneration intermediate; all deliverable feeds and audits are retained. Source preparation works offline from the committed archive and boundary snapshot. To reproduce the original boundary extraction, pass `--boundary /path/to/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg` to the Python preparation script. A newly downloaded aktuell source is not automatically accepted: the recorded survey hashes must match or a new release must be reviewed explicitly.

Validation covers real canton islands/districts, coordinate orientation, mode isolation, exact endpoint joins, disconnected parts and crossings, tunnel preservation, detour/collapse rejection, reverse/loop patterns, whole-journey exclusions, SN/night routes, conditional calls, previous-day spillover and representative frequencies. The artifact checker reconciles all route/operator and pattern/pair denominators, admission decisions, directed feed endpoints, every original call, morning subsets and exact bytes for all 24 chunks. It also re-routes every published journey against the retained mode graph and compares all emitted paths. These checks establish internal geometric and timetable consistency within the documented inference limits.
