# Zug canton: source adapter, regional feed and admission audit

Inventory and source review: **8 September 2026**. Start point: [Swiss transit source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#zg).

**The annual timetable inventory covers the whole canton. The regional motion feed has partial geometry coverage.** It admits only complete directed stop patterns passing the numerical source checks, on Friday **4 September 2026** and Sunday **6 September 2026**. Admission is not certification of a current 2026 alignment, one-way street, running track or temporary diversion.

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

## Geometry and directed stop-pattern method

Decode the original EPSG:2056 GeoPackage with strict geometry/schema checks. Transform XY with the existing swisstopo approximate LV95-to-WGS84 polynomial at full floating precision; no simplification. Graph identity uses seven decimal places. Shared source vertices connect only within the exact mapped line. Geometric crossings do not create junctions. The source has no direction attribute: shortest connected source corridors are oriented by the ordered GTFS calls and remain inferred alignments.

Every pair must pass **120 m** maximum stop projection, connectivity, and a detour bound of **max(1,200 m, 4.5 × direct distance)**. Alternative source-part projections may add at most **5 m** to the nearest projection. Paths include the short stop-to-source projection connectors; those are inferred access geometry, not measured trajectories. Collapsed paths fail. Full repeated-stop sequences, branches, direction_id and pickup/drop-off rules form distinct patterns. A failure in any pair excludes the entire pattern. Prior-arrangement pickup/drop-off codes 2/3 also exclude a pattern from unconditional animation; none occur in these fixtures.

Three explicitly reviewed source discontinuities are joined by short inferred connectors, pinned to exact source feature IDs and vertex indices. Each includes an existing source endpoint, stays within identical line memberships, connects distinct original components and is less than one metre. No general nearest-neighbour gap filling is enabled.

| Join | Lines | Length | Source vertices |
| --- | --- | --- | --- |
| riedmatt | 606, 607, 616 | 0.127 m | feature 133 / vertex 0 → feature 72 / vertex 0 |
| birkenhalde | 606, 616, 636 | 0.668 m | feature 80 / vertex 29 → feature 79 / vertex 20 |
| cham-bahnhof | 641 | 0.602 m | feature 85 / vertex 142 → feature 149 / vertex 25 |

The audit and feed metadata retain the join policy; affected pairs carry geometryRepairIds and inferredJoinMetres. **570 Friday trips** and **240 Sunday trips** use these connectors. Their small lengths do not establish lawful street direction. Without them, admission is 1,668 Friday trips and 1,009 Sunday trips.

## Weekday and Sunday results

Calendar exceptions and preceding service-day spillover are applied. The civil day is 00:00–24:00 Europe/Zurich. Source identities and negative carry-in times are preserved; no source call is trimmed. Friday after-midnight night departures belonging to Friday service fall on Saturday's civil day; Sunday's N1–N6 and N73 departures include Saturday service carry-in. Calendar active-source counts therefore differ from civil-day counts. Frequency templates would retain source-anchored headway semantics; both selected fixtures contain zero representative headway trips.

| Measure | 2026-09-04 | 2026-09-06 |
| --- | --- | --- |
| Civil-day trips | 3'597 | 2'263 |
| Admitted / excluded trips | 2'238 / 1'359 | 1'249 / 1'014 |
| Admitted / all directed patterns | 94 / 370 | 64 / 314 |
| Matched / all directed route-stop pairs | 859 / 1675 (51.28%) | 665 / 1676 (39.68%) |
| Matched / all scheduled segment occurrences | 38'671 / 51'680 (74.83%) | 22'498 / 33'257 (67.65%) |
| All / admitted carry-in trips | 68 / 30 | 133 / 49 |

Matched occurrences include good pairs on ultimately excluded patterns. They are not a percentage of admitted full trips. All modes and excluded operators stay in the denominator. Every emitted trip has a non-null, correctly oriented path for every adjacent source call.

| Date | Agency / mode | Trips admitted / all | Patterns admitted / all | Pairs matched / all | Occurrences matched / all |
| --- | --- | --- | --- | --- | --- |
| 2026-09-04 | 11:rail — Schweizerische Bundesbahnen SBB | 0 / 599 | 0 / 207 | 0 / 497 | 0 / 8184 |
| 2026-09-04 | 82:rail — Schweizerische Südostbahn (sob) | 0 / 18 | 0 / 11 | 0 / 55 | 0 / 324 |
| 2026-09-04 | 820:bus — Verkehrsbetriebe Luzern AG | 0 / 24 | 0 / 2 | 0 / 38 | 0 / 456 |
| 2026-09-04 | 839:bus — Zugerland Verkehrsbetriebe | 2186 / 2691 | 90 / 124 | 797 / 905 | 37231 / 39354 |
| 2026-09-04 | 158:mountain — Zugerbergbahn | 0 / 72 | 0 / 2 | 0 / 2 | 0 / 72 |
| 2026-09-04 | 186:boat — Schifffahrtsgesellschaft für den Zugersee AG | 0 / 6 | 0 / 6 | 0 / 14 | 0 / 19 |
| 2026-09-04 | 179:boat — Ägerisee Schifffahrt AG | 0 / 3 | 0 / 2 | 0 / 7 | 0 / 22 |
| 2026-09-04 | 801:bus — PostAuto AG | 52 / 184 | 4 / 16 | 62 / 157 | 1440 / 3249 |
| 2026-09-06 | 11:rail — Schweizerische Bundesbahnen SBB | 0 / 506 | 0 / 178 | 0 / 518 | 0 / 7331 |
| 2026-09-06 | 82:rail — Schweizerische Südostbahn (sob) | 0 / 17 | 0 / 12 | 0 / 54 | 0 / 304 |
| 2026-09-06 | 839:bus — Zugerland Verkehrsbetriebe | 1213 / 1519 | 61 / 93 | 593 / 851 | 21512 / 22968 |
| 2026-09-06 | 7231:bus — SBB Infrastruktur AG Bahnersatz | 0 / 6 | 0 / 2 | 0 / 2 | 0 / 6 |
| 2026-09-06 | 158:mountain — Zugerbergbahn | 0 / 70 | 0 / 2 | 0 / 2 | 0 / 70 |
| 2026-09-06 | 186:boat — Schifffahrtsgesellschaft für den Zugersee AG | 0 / 10 | 0 / 8 | 0 / 20 | 0 / 36 |
| 2026-09-06 | 179:boat — Ägerisee Schifffahrt AG | 0 / 3 | 0 / 2 | 0 / 7 | 0 / 22 |
| 2026-09-06 | 801:bus — PostAuto AG | 36 / 132 | 3 / 17 | 72 / 222 | 986 / 2520 |

Failures are also broken down by operator/mode, reason, unique directed route-stop pair, scheduled occurrence, affected pattern and trip in days[].groups[].failures. A trip can have several reasons; affected-trip counts across reasons must not be summed.

## All municipalities

Counts overlap: a whole trip or annual route can serve several municipalities. These rows must not be summed into a canton total. Stop counts include uncalled source stop records. Source polygons retain holes and all parts; all 945 canton stop records have municipal membership.

| Municipality | Source stops | Annual route records | Friday admitted / all trips | Sunday admitted / all trips |
| --- | --- | --- | --- | --- |
| Risch | 97 | 31 | 163 / 897 | 74 / 496 |
| Hünenberg | 42 | 7 | 302 / 538 | 151 / 240 |
| Neuheim | 22 | 3 | 140 / 183 | 0 / 83 |
| Steinhausen | 41 | 9 | 431 / 514 | 163 / 253 |
| Oberägeri | 89 | 8 | 379 / 432 | 262 / 303 |
| Baar | 164 | 25 | 818 / 1263 | 418 / 797 |
| Zug | 262 | 47 | 1303 / 1984 | 770 / 1360 |
| Menzingen | 33 | 5 | 271 / 271 | 190 / 197 |
| Cham | 109 | 17 | 703 / 922 | 373 / 481 |
| Walchwil | 59 | 5 | 50 / 128 | 37 / 88 |
| Unterägeri | 27 | 6 | 267 / 308 | 191 / 225 |

Neuheim has no admitted Sunday trip: current 631 patterns extend beyond the old line source. This is an explicit coverage gap, not absence of service.

## Complete annual route admission/exclusion inventory

Each row is an exact GTFS route_id, not a unique passenger-facing line. Counts are admitted/all civil-day trips; “inactive” means no trip overlaps that day, not nonexistent or excluded from the annual census.

| GTFS route ID | Agency | Line / mode | Annual trips | Friday | Sunday | Failure reasons |
| --- | --- | --- | --- | --- | --- | --- |
| 91-1-A-j26-1 | 11 | S1 / rail | 2268 | 0/153 | 0/84 | no-reviewed-rail-geometry |
| 91-2-C-j26-1 | 11 | S2 / rail | 343 | 0/68 | 0/40 | no-reviewed-rail-geometry |
| 91-2-G-j26-1 | 11 | IC2 / rail | 802 | 0/23 | 0/19 | no-reviewed-rail-geometry |
| 91-2-P-j26-1 | 11 | RE2 / rail | 72 | inactive | inactive | — |
| 91-21-D-j26-1 | 11 | IC21 / rail | 17 | inactive | inactive | — |
| 91-24-j26-1 | 11 | S24 / rail | 1524 | 0/81 | 0/72 | no-reviewed-rail-geometry |
| 91-26-j26-1 | 11 | S26 / rail | 2168 | 0/80 | 0/80 | no-reviewed-rail-geometry |
| 91-2A-Y-j26-1 | 11 | EC / rail | 682 | 0/26 | 0/26 | no-reviewed-rail-geometry |
| 91-2L-Y-j26-1 | 11 | RE / rail | 59 | 0/1 | 0/1 | no-reviewed-rail-geometry |
| 91-35-Y-j26-1 | 11 | IR / rail | 132 | 0/6 | 0/1 | no-reviewed-rail-geometry |
| 91-46-C-j26-1 | 11 | IR46 / rail | 28 | inactive | 0/2 | no-reviewed-rail-geometry |
| 91-46-j26-1 | 82 | IR46 / rail | 678 | 0/18 | 0/17 | no-reviewed-rail-geometry |
| 91-5-C-j26-1 | 11 | S5 / rail | 1177 | 0/83 | 0/84 | no-reviewed-rail-geometry |
| 91-5-G-j26-1 | 11 | SN5 / rail | 1 | inactive | inactive | — |
| 91-5F-Y-j26-1 | 11 | IC / rail | 227 | inactive | 0/5 | no-reviewed-rail-geometry |
| 91-5G-Y-j26-1 | 11 | EXT / rail | 24 | 0/1 | inactive | no-reviewed-rail-geometry |
| 91-6-W-j26-1 | 11 | RE6 / rail | 68 | inactive | 0/6 | no-reviewed-rail-geometry |
| 91-70-A-j26-1 | 11 | IR70 / rail | 1635 | 0/37 | 0/37 | no-reviewed-rail-geometry |
| 91-75-j26-1 | 11 | IR75 / rail | 1602 | 0/40 | 0/40 | no-reviewed-rail-geometry |
| 91-A6-Y-j26-1 | 82 | EXT / rail | 10 | inactive | inactive | — |
| 91-AI-Y-j26-1 | 11 | EXT / rail | 8 | inactive | inactive | — |
| 91-AP-Y-j26-1 | 11 | EXT / rail | 3 | inactive | inactive | — |
| 91-AS-Y-j26-1 | 11 | EXT / rail | 1 | inactive | inactive | — |
| 91-AW-Y-j26-1 | 11 | EXT / rail | 8 | inactive | 0/1 | no-reviewed-rail-geometry |
| 91-D8-Y-j26-1 | 11 | S / rail | 84 | inactive | inactive | — |
| 91-N7-j26-1 | 11 | N7 / rail | 134 | inactive | 0/8 | no-reviewed-rail-geometry |
| 91-VAE-j26-1 | 82 | VAE / rail | 42 | inactive | inactive | — |
| 92-23-j26-1 | 820 | 23 / bus | 44 | 0/24 | inactive | missing-reviewed-line-geometry |
| 92-525-j26-1 | 839 | 525 / bus | 108 | 0/36 | 0/36 | missing-reviewed-line-geometry |
| 92-526-j26-1 | 839 | 526 / bus | 22 | 0/11 | inactive | missing-reviewed-line-geometry |
| 92-601-A-j26-1 | 839 | 601 / bus | 382 | 140/140 | 115/115 | — |
| 92-602-A-j26-1 | 839 | 602 / bus | 257 | 98/98 | 75/76 | endpoint-gap |
| 92-602-C-j26-1 | 839 | 602 / bus | 1 | 1/1 | inactive | — |
| 92-603-B-j26-1 | 839 | 603 / bus | 414 | 148/148 | 127/127 | — |
| 92-604-B-j26-1 | 839 | 604 / bus | 348 | 66/133 | 38/76 | endpoint-gap |
| 92-605-A-j26-1 | 839 | 605 / bus | 128 | 50/50 | 37/37 | — |
| 92-606-j26-1 | 839 | 606 / bus | 392 | 145/145 | 115/115 | — |
| 92-607-j26-1 | 839 | 607 / bus | 214 | 115/115 | inactive | — |
| 92-609-j26-1 | 839 | 609 / bus | 192 | 52/84 | 21/53 | endpoint-gap |
| 92-610-A-j26-1 | 839 | 610 / bus | 172 | 60/60 | 50/50 | — |
| 92-611-B-j26-1 | 839 | 611 / bus | 764 | 143/143 | 117/117 | — |
| 92-612-C-j26-1 | 839 | 612 / bus | 31 | 31/31 | inactive | — |
| 92-613-C-j26-1 | 839 | 613 / bus | 325 | 129/129 | 71/71 | — |
| 92-614-j26-1 | 839 | 614 / bus | 318 | 66/66 | 27/27 | — |
| 92-616-A-j26-1 | 839 | 616 / bus | 62 | 46/46 | inactive | — |
| 92-619-j26-1 | 839 | 619 / bus | 88 | 0/38 | 0/25 | missing-reviewed-line-geometry |
| 92-626-A-j26-1 | 839 | 626 / bus | 8 | 0/8 | inactive | collapsed-path |
| 92-627-j26-1 | 839 | 627 / bus | 18 | 0/18 | inactive | missing-reviewed-line-geometry |
| 92-631-A-j26-1 | 839 | 631 / bus | 250 | 86/97 | 0/77 | endpoint-gap |
| 92-632-j26-1 | 839 | 632 / bus | 136 | 54/86 | inactive | endpoint-gap |
| 92-634-j26-1 | 839 | 634 / bus | 248 | 97/97 | 76/76 | — |
| 92-636-j26-1 | 839 | 636 / bus | 283 | 125/125 | 48/48 | — |
| 92-641-A-j26-1 | 839 | 641 / bus | 350 | 139/139 | 77/77 | — |
| 92-642-j26-1 | 839 | 642 / bus | 250 | 97/97 | 71/71 | — |
| 92-643-j26-1 | 839 | 643 / bus | 362 | 135/135 | 74/74 | — |
| 92-648-j26-1 | 839 | 648 / bus | 284 | 73/135 | 74/74 | endpoint-gap |
| 92-651-j26-1 | 839 | 651 / bus | 176 | 90/90 | inactive | — |
| 92-652-A-j26-1 | 839 | 652 / bus | 118 | 0/64 | inactive | missing-reviewed-line-geometry |
| 92-653-j26-1 | 839 | 653 / bus | 314 | 0/126 | 0/60 | endpoint-gap |
| 92-A04-R-j26-1 | 7231 | EV1 / bus | 10 | inactive | inactive | — |
| 92-A0A-N-j26-1 | 7231 | EV2 / bus | 1 | inactive | inactive | — |
| 92-A0A-W-j26-1 | 158 | EV1 / bus | 36 | inactive | inactive | — |
| 92-EV1-Z-j26-1 | 7231 | EV1 / bus | 203 | inactive | 0/6 | missing-reviewed-line-geometry |
| 92-EV2-S-j26-1 | 7231 | EV2 / bus | 5 | inactive | inactive | — |
| 92-N1-D-j26-1 | 839 | N1 / bus | 6 | inactive | 0/6 | missing-reviewed-line-geometry |
| 92-N2-D-j26-1 | 839 | N2 / bus | 6 | inactive | 0/6 | missing-reviewed-line-geometry |
| 92-N3-E-j26-1 | 839 | N3 / bus | 6 | inactive | 0/6 | missing-reviewed-line-geometry |
| 92-N4-C-j26-1 | 839 | N4 / bus | 6 | inactive | 0/6 | missing-reviewed-line-geometry |
| 92-N5-A-j26-1 | 839 | N5 / bus | 8 | inactive | 0/7 | missing-reviewed-line-geometry |
| 92-N6-A-j26-1 | 839 | N6 / bus | 7 | inactive | 0/6 | missing-reviewed-line-geometry |
| 93-256-6-j26-1 | 158 | 2566 / mountain | 71 | 0/72 | 0/70 | no-reviewed-mountain-geometry |
| 94-366-0-j26-1 | 186 | 3660 / boat | 10 | 0/6 | 0/10 | no-reviewed-boat-geometry |
| 94-366-1-j26-1 | 179 | 3661 / boat | 3 | 0/3 | 0/3 | no-reviewed-boat-geometry |
| 96-180-1-j26-1 | 801 | 280 / bus | 1244 | 52/52 | 36/36 | — |
| 96-352-3-j26-1 | 801 | 73 / bus | 143 | 0/80 | 0/66 | endpoint-gap |
| 96-357-7-j26-1 | 801 | 110 / bus | 53 | 0/52 | 0/28 | endpoint-gap |
| 96-359-A-j26-1 | 801 | N73 / bus | 2 | inactive | 0/2 | missing-reviewed-line-geometry |

Principal exclusions: no reviewed rail geometry for SBB/SOB; no reviewed funicular geometry for Zugerbergbahn; no reviewed water routes for Zugersee/Ägerisee; no mapped source lines for 23, 525, 526, 619, 627, 652, replacement buses or night services. Known source identity alone does not admit incomplete linework: 604's Grienbach stop projects about 155 m away; 609's Rothenthurm extension about 2.5 km; Neuheim branches exceed 1 km; 648's Knonau variant exceeds 4 km; PostAuto 73's Luzern end is outside the export, and 110's Hochdorf station gap exceeds 220 m. Walchwil 626 has a collapsed projected pair. Full pair details and stop names are in the machine audit.

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
npx vitest run scripts/zug-region.test.mjs scripts/luzern-region.test.mjs \
  scripts/civil-day.test.mjs scripts/gtfs-frequencies.test.mjs
```

The checker verifies source/policy/timetable hashes, annual census totals, all directed patterns including exclusions, all rematched pair hashes, operator and route aggregates, source call/timing replay, carry-in identities, path endpoints, morning membership and every chunk hash/length. Tests reject duplicate/truncated WFS responses, changed labels/coordinates, wrong operator joins, substring matching, arbitrary gaps/crossings, unreviewed topology joins and reversed or missing paths.

Remaining scope limits: two September dates do not validate winter, holiday, summer boat or all seasonal/engineering patterns. The old line geometry has no proven 2026 validity and has not been certified against street-direction restrictions or diversions. The feed is scheduled interpolation with explicit inferred projection/topology pieces. It is not observed vehicle movement. Full cantonal motion coverage remains incomplete.
