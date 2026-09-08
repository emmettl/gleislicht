# Aargau annual calendar witnesses

Checked **2026-09-08** against the pinned **GTFS 20260902** archive. **All 45 routes absent from the twelve-date sample have an active canton-calling journey in the archived timetable year.** A deterministic selection of **19 civil dates** provides a witness for every route. No route in this group needs an “inactive for the entire archive” classification.

The complete census retains **2,019 archived trip templates, 13,007 calls and 280 directed route/platform patterns** for those 45 routes. Each full journey includes its calls outside Aargau. All 280 patterns are absent from the twelve sampled dates. The source parser and independent verifier each scan all **34,499,152 national stop-time rows**. Calendar exceptions are applied over all **364 feed dates**, including selected-day and preceding-service-day civil overlap. The original 289-route canton census is unchanged.

## What these witnesses establish

The archive was published for timetable year 2026, valid **14 December 2025–12 December 2026**. Replaying its calendars identifies scheduled activity in that archive; it does not establish that a historical trip actually operated or that a future trip will run unchanged. The source archive SHA-256 is **d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e**. The [inventory](../data/aargau-witnesses/inventory.json) pins its download URL, feed information, annual active-date counts for each route and an exact source trip for every selected witness. [Complete calls, platforms and calendars](../data/aargau-witnesses/source-patterns.json.gz) and the [independent verification](../data/aargau-witnesses/source-verification.json) are retained with hashes.

These are archived GTFS route records and trip templates, not unique public line numbers or annual journey totals. Nine of the routes occur on only one civil date: **91-4C-Y-j26-1, 91-5R-Y-j26-1, 91-8F-Y-j26-1, 91-8U-Y-j26-1, 91-9I-Y-j26-1, 91-9Z-Y-j26-1, 91-BM-Y-j26-1, 91-BO-Y-j26-1, 92-EV8-F-j26-1**. Five selected witnesses overlap midnight from the preceding service date; treating service dates as civil dates would miss or misdate them. No frequency templates occur in this target group. Request-stop boarding and alighting rules are preserved with every call.

## Compact witness-date selection

Dates are selected greedily by the number of still-unwitnessed routes they cover, then earliest date on ties. This is a reproducible compact cover, not a proof that 19 is the mathematical minimum. The table counts only the new routes assigned on that step; a selected date can also operate routes already witnessed earlier. These dates have not been turned into whole-canton release feeds.

| Civil date | Weekday | New route witnesses |
| --- | --- | --- |
| 2026-05-23 | Saturday | 9 |
| 2026-08-09 | Sunday | 6 |
| 2026-05-22 | Friday | 4 |
| 2026-09-14 | Monday | 4 |
| 2026-02-23 | Monday | 3 |
| 2026-08-16 | Sunday | 3 |
| 2026-02-12 | Thursday | 2 |
| 2026-03-01 | Sunday | 2 |
| 2026-04-13 | Monday | 2 |
| 2026-03-08 | Sunday | 1 |
| 2026-03-27 | Friday | 1 |
| 2026-04-18 | Saturday | 1 |
| 2026-04-20 | Monday | 1 |
| 2026-06-14 | Sunday | 1 |
| 2026-06-16 | Tuesday | 1 |
| 2026-08-08 | Saturday | 1 |
| 2026-09-25 | Friday | 1 |
| 2026-10-03 | Saturday | 1 |
| 2026-10-10 | Saturday | 1 |

## Every previously unsampled route

Compatibility below counts each archived trip template once, across all its complete adjacent calls. It uses the separate annual geometry candidate and is not the journey total for the selected witness date.

| Route record | Operator / line | Active civil dates | Witness civil date / source course | Compatible / all template segments |
| --- | --- | --- | --- | --- |
| 91-1B-Y-j26-1 | Schweizerische Bundesbahnen SBB / IC | 7 | 2026-03-01 / 1582 | 25 / 25 |
| 91-21-D-j26-1 | Schweizerische Bundesbahnen SBB / IC21 | 4 | 2026-08-09 / 696 | 24 / 24 |
| 91-22-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 3 | 2026-08-09 / 31410 | 19 / 19 |
| 91-27-D-j26-1 | THURBO / S27 | 4 | 2026-04-13 / 7774 | 18 / 18 |
| 91-36-B-j26-1 | Schweizerische Bundesbahnen SBB / S36 | 4 | 2026-04-13 / 22891 | 6 / 6 |
| 91-3A-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 21 | 2026-05-23 / 31392 | 93 / 93 |
| 91-3T-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 2 | 2026-10-03 / 31499 | 14 / 14 |
| 91-3V-Y-j26-1 | Schweizerische Bundesbahnen SBB / S | 12 | 2026-05-23 / 14559 | 1,334 / 1,334 |
| 91-40-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 4 | 2026-08-09 / 31408 | 22 / 22 |
| 91-42-F-j26-1 | Schweizerische Südostbahn (sob) / S42 | 3 | 2026-05-22 / 31157 | 54 / 54 |
| 91-46-j26-1 | Schweizerische Südostbahn (sob) / IR46 | 2 | 2026-03-01 / 2413 | 40 / 40 |
| 91-4C-Y-j26-1 | Schweizerische Bundesbahnen SBB / IR | 1 | 2026-08-08 / 30515 | 40 / 40 |
| 91-4T-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 4 | 2026-06-14 / 31010 | 36 / 36 |
| 91-4U-Y-j26-1 | Schweizerische Bundesbahnen SBB / IR | 4 | 2026-08-16 / 2382 | 26 / 26 |
| 91-55-C-j26-1 | Schweizerische Bundesbahnen SBB / IR55 | 5 | 2026-05-22 / 1759 | 150 / 150 |
| 91-5R-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 1 | 2026-02-23 / 31300 | 11 / 11 |
| 91-5V-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 2 | 2026-03-27 / 31376 | 5 / 5 |
| 91-75-Y-j26-1 | Schweizerische Bundesbahnen SBB / S | 10 | 2026-05-22 / 30989 | 485 / 485 |
| 91-7Q-Y-j26-1 | Schweizerische Bundesbahnen SBB / IC | 2 | 2026-03-08 / 31102 | 14 / 14 |
| 91-81-A-j26-1 | Schweizerische Bundesbahnen SBB / IC81 | 17 | 2026-05-23 / 806 | 1,120 / 1,120 |
| 91-8F-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 1 | 2026-08-09 / 31414 | 7 / 7 |
| 91-8U-Y-j26-1 | Oensingen-Balsthal-Bahn / EXT | 1 | 2026-04-18 / 31710 | 2 / 2 |
| 91-98-Y-j26-1 | Schweizerische Bundesbahnen SBB / RE | 4 | 2026-06-16 / 31247 | 15 / 15 |
| 91-9I-Y-j26-1 | Oensingen-Balsthal-Bahn / EXT | 1 | 2026-08-16 / 31048 | 86 / 86 |
| 91-9N-Y-j26-1 | Schweizerische Bundesbahnen SBB / IC | 2 | 2026-10-10 / 10512 | 60 / 60 |
| 91-9Z-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 1 | 2026-02-12 / 31408 | 10 / 10 |
| 91-AK-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 5 | 2026-02-12 / 31211 | 64 / 64 |
| 91-BM-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 1 | 2026-02-23 / 31202 | 11 / 11 |
| 91-BO-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 1 | 2026-02-23 / 31302 | 10 / 10 |
| 92-A01-N-j26-1 | SBB Infrastruktur AG Bahnersatz / EV4 | 12 | 2026-05-23 / 28142 | 58 / 130 |
| 92-A01-Q-j26-1 | SBB Infrastruktur AG Bahnersatz / EV2 | 5 | 2026-09-14 / 80070 | 0 / 59 |
| 92-A01-U-j26-1 | SBB Infrastruktur AG Bahnersatz / EV3 | 5 | 2026-09-14 / 80096 | 0 / 7 |
| 92-A04-9-j26-1 | SBB Infrastruktur AG Bahnersatz / EV2 | 29 | 2026-08-09 / 1991 | 0 / 191 |
| 92-A04-B-j26-1 | SBB Infrastruktur AG Bahnersatz / EV1 | 31 | 2026-08-09 / 17287 | 0 / 504 |
| 92-A04-F-j26-1 | SBB Infrastruktur AG Bahnersatz / EV1 | 38 | 2026-09-14 / 80117 | 0 / 328 |
| 92-A05-X-j26-1 | SBB Infrastruktur AG Bahnersatz / EV3 | 3 | 2026-05-22 / 1162 | 0 / 98 |
| 92-A07-9-j26-1 | Aargau Verkehr AG Ersatzverkehr / EV | 6 | 2026-09-14 / 9245 | 4,302 / 4,616 |
| 92-A08-U-j26-1 | SBB Infrastruktur AG Bahnersatz / EV1 | 9 | 2026-04-20 / 71523 | 0 / 80 |
| 92-A08-Z-j26-1 | SBB Infrastruktur AG Bahnersatz / EV2 | 13 | 2026-05-23 / 19121 | 0 / 28 |
| 92-EV1-D-j26-1 | SBB Infrastruktur AG Bahnersatz / EV1 | 6 | 2026-08-16 / 18190 | 0 / 158 |
| 92-EV5-V-j26-1 | SBB Infrastruktur AG Bahnersatz / EV5 | 4 | 2026-05-23 / 22946 | 391 / 391 |
| 92-EV7-R-j26-1 | SBB Infrastruktur AG Bahnersatz / EV7 | 4 | 2026-05-23 / 18857 | 74 / 74 |
| 92-EV8-F-j26-1 | SBB Infrastruktur AG Bahnersatz / EV8 | 1 | 2026-05-23 / 8783 | 0 / 238 |
| 92-EV9-I-j26-1 | SBB Infrastruktur AG Bahnersatz / EV9 | 4 | 2026-05-23 / 28377 | 59 / 78 |
| 96-138-1-j26-1 | PostAuto AG / EXT | 3 | 2026-09-25 / 81007 | 195 / 207 |

The following selected witnesses specifically use the preceding service calendar:

| Route record | Witness civil date | Source service date | Source course |
| --- | --- | --- | --- |
| 91-21-D-j26-1 | 2026-08-09 | 2026-08-08 | 696 |
| 91-3T-Y-j26-1 | 2026-10-03 | 2026-10-02 | 31499 |
| 91-98-Y-j26-1 | 2026-06-16 | 2026-06-15 | 31247 |
| 92-A07-9-j26-1 | 2026-09-14 | 2026-09-13 | 9245 |
| 92-EV1-D-j26-1 | 2026-08-16 | 2026-08-15 | 18190 |

## Geometry still requiring evidence

The separately scoped annual geometry candidate is compatible with **8,880 of 10,988 template segment occurrences**. **207 of 280 directed patterns** have complete geometry; **2,108 occurrences remain unresolved**. All journeys and their exact platform coordinates stay in the denominator. The [current replacement-bus audit](../data/aargau-witnesses/lenzburg-review-summary.json) enumerates every missing pattern/pair with the original source and fallback rejection reasons. The [reviewed pattern detail](../data/aargau-witnesses/lenzburg-review-patterns.json.gz) retains admitted paths and source evidence.

| Mode | Routes | Trip templates | Directed patterns | Compatible occurrences | Unresolved occurrences |
| --- | --- | --- | --- | --- | --- |
| rail | 29 | 635 | 194 | 3,801 | 0 |
| bus | 16 | 1,384 | 86 | 5,079 | 2,108 |

The [original witness baseline](../data/aargau-witnesses/geometry-summary.json) remains unchanged at 12 compatible occurrences and no complete patterns. The [new finite rail policy](../data/aargau-witness-rail-policy.json) reviews **29 exact route records, 194 directed patterns and 635 archived rail trip templates**, adding **3,616 occurrences** and preserving all **12** prior paths. It supplies geometry on **28 route records**; **24 rail routes** had complete template geometry at that stage; the Interlaken follow-up below raises this to **26**. All bus assessments were unchanged at that rail-review stage.

The policy pins the archive-derived SBB (11), THURBO (65), SOB (82) and Oensingen-Balsthal-Bahn (68) identities, full platform-coordinate chains, source trip/course identities, calls, boarding rules and complete active service-date lists. Every template is checked before the shared pattern cache is used. Each inferred path and its directed FOT segment sequence are hashed and checked on replay. Station attachment remains at **350 m**, source topology attachment at **120 m**, with the existing **4.5× detour bound / 3,000 m allowance** and **5 m source simplification**. Another scheduled operating point cannot be traversed out of order. Accepted geometry is an infrastructure inference, not a certification of the special train's actual corridor, track or diversion.

## Interlaken station hierarchy

The [FOT XTF source](https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf) already records **8519309, Interlaken Ost [Gleis 5–8]**, node **ch14uvag00165678**, as a child of **8507492**, node **ch14uvag00139699**, using its explicit **rUebergeordnet** reference. The generic station parent has no track edges; the connected child reaches Interlaken West through source segment **ch14uvag00087489**. The existing simplified parser omitted the hierarchy, which explains the earlier disconnection.

The [finite Interlaken policy](../data/aargau-witness-interlaken-policy.json) binds only the two exact GTFS platforms: **5**, stop **ch:1:sloid:7492:0:581416**, and **7**, stop **ch:1:sloid:7492:0:460848**. Their distances to the child node are **61.39 m / 70.05 m**, within the unchanged 350 m station limit. Source topology attachment still uses 120 m. This uses the source's explicit station/track-group relationship; no nearby-node or name-only alias is created. Only the internal operating-point lookup changes. Exported platform IDs, coordinates, complete calls and calendars are preserved.

This supplies all **162** formerly rejected Interlaken occurrences across **59** exact directed patterns: **160 IC81** occurrences on route **91-81-A-j26-1** and **2 EXT** occurrences on **91-4T-Y-j26-1**. The source GTFS direction IDs count **79 / 83** for **0 / 1**; these are source identifiers, not a geographic-direction convention. The [regression](../data/aargau-witnesses/interlaken-review-summary.json) preserves all **3,628** previously accepted occurrences and every other source assessment. Both directions and both platforms are tested. An absent parent reference, changed platform group, coordinates, template, calendar or geometry cannot inherit the rule.

The child node states validity from **13 December 2015**, edit date **27 May 2021**, and data date **6 July 2021**; the parent was edited **2 July 2021**. The archived raw node records are included in the policy, and the entire source file is hashed. The asset's **18 January 2025** update is distinct from these record dates. These records establish the source hierarchy, not current running-track validity. All paths remain explicitly inferred infrastructure geometry.

## Bern platform 50 and Waldshut–Koblenz

The [final finite rail policy](../data/aargau-witness-edge-policy.json) fills the remaining **11 rail occurrences in seven full directed patterns**, preserving all **3,790** previously accepted occurrences and every other assessment. All **194 rail patterns on 29 route records** now have complete infrastructure geometry. These additions stay in the separate annual-template candidate.

**Correction:** the earlier witness audit called the Bern platform “49”. These four archived templates actually call **platform 50**, stop **ch:1:sloid:7000:55:50**. The GTFS source, calls and platform coordinates were always correct. The original September platform-49 rules remain valid for their own different calls.

The archived [SBB station plan](../data/aargau-witness-edge-sources/sbb-bern-plan-2026-08.pdf), exterior view on page 3, places platforms 49/50 at the western end. Its printed date is **August 2026**, retrieved **8 September 2026**. It is station-layout evidence, not surveyed switches or proof of a June/July operating alignment; it postdates two reviewed templates. Attribution on the plan is **© OpenStreetMap © SBB 08/2026**.

Platform 50 is **427.77 m** from the generic FOT station point, beyond the unchanged 350 m guard, but only **38.59 m** from the pinned western station curve **ch14uvag00087328**. The adapter projects onto that one curve within **75 m**, then splits its interior at **371.07 m** from the western source end. Both source endpoints, the station-centre node and all other edges retain their original geometry. The internal node and its synthetic lookup number **9990050** are explicitly marked as derived, never exported as a GTFS or source operating-point identity. The platform connector remains inferred.

The Fribourg arrival must use the western half and cannot pass through Bern's centre; the subsequent departure uses the centre-side half. This prevents an artificial out-and-back path at an intermediate call. The other three reviewed approaches use only the centre-side half. Every old accepted segment in these full journeys remains unchanged.

| Route / course | Active source service dates | Newly compatible adjacent calls |
| --- | --- | --- |
| 91-3A-Y-j26-1 / 31025 | 2026-06-30 | Fribourg platform 2 → Bern 50; Bern 50 → Lenzburg 1 |
| 91-3A-Y-j26-1 / 31569 | 2026-07-14 | Bern 50 → Olten 2 |
| 91-4U-Y-j26-1 / 2382 | 2026-08-16 and 2026-09-27 | Burgdorf 2 → Bern 50; two distinct full upstream platform patterns |
| 91-36-B-j26-1 / 22891, 22893, 22895 | 2026-04-13 through 2026-04-16 | Waldshut 5 → Koblenz 4 |
| 91-36-B-j26-1 / 22884 | 2026-04-13 through 2026-04-16 | Koblenz 3 → Waldshut 5 |
| 91-36-B-j26-1 / 22886, 22888 | 2026-04-13 through 2026-04-16 | Koblenz 4 → Waldshut 5 |

The six SBB **S36** templates reuse only **AGIS feature 364, part 0**, whose source identity remains **11 / rail / S41**, itinerary Waldshut–Koblenz–Bad Zurzach–Bülach–Winterthur. This is an explicit corridor association, not a global S41-to-S36 relabelling. All three full two-stop patterns project in their own directed order onto the same feature, including both Koblenz platforms; the sliced source distance is **3,275.13 m**, with maximum endpoint projection **55.97 m**, within the unchanged **120 m** guard. The source direction label is unspecified; coordinate order is forward for Waldshut departures and reversed for Koblenz departures.

These April 13–16 templates lie outside the archived operator notice's **14 September–2 October** Koblenz–Waldshut closure. The notice does not certify April operation. The **23 April 2026** AGIS normal-line snapshot also postdates these templates. Accepted paths establish compatibility with the archived corridor, not the historical tracks actually used. The earlier date-scoped THURBO rule is unchanged and is not inherited by SBB.

Every added path, directed source segment, projection, full platform chain and exact template digest is pinned. Changed calls, source courses, calendars, coordinates, daily-feed instances or relaxed limits cannot inherit this policy. Replay verifies both border directions, all ten exact templates, western and centre-side Bern approaches, and unchanged original source topology outside the one split curve.

## Remaining exclusions

There are **no unresolved rail occurrences** in this annual-template candidate. The [complete witness bus review](AARGAU-WITNESS-BUS-REVIEW.md) inventories all **86 bus patterns on 16 routes** and tests six AVA replacement patterns. Its finite policy adds **2,466 April occurrences**, preserving all **3,801** earlier paths. The subsequent municipal closure-localization policy adds **1,836 September occurrences**, preserving all **6,267** earlier paths. The independently transcribed 2026 Schupfart Festival timetable verifies **32 event trips / 113 major calls**; its road policy adds **195 occurrences**, preserving all **8,103** earlier paths and holding **twelve zero-second intervals**. The May Lenzburg follow-up adds **582 occurrences**, preserving all **8,298** earlier paths and holding **77 platform-F stop-distance failures**. Thirteen bus patterns are complete; **2,108 occurrences across 73 incomplete bus patterns** remain. AVA’s **161** April source-time concerns and **153** September occurrences crossing the closure stay excluded. The municipal notice (7 September), map (11 August) and exact historical OSM junctions (2 September) establish the 181.505 m closure. All paths accepted by that closure-localization review stay more than 20 m clear; the minimum is 73.713 m. Full evidence, source dates and attribution are in the linked bus audit. Both signed-detour directions also exceed the literal 120-second source interval in an optimistic tagged-speed calculation. The other 60 bus patterns on eleven route records still need dated operator and road evidence, including the later EV4 patterns excluded from the May policy. SBB’s 22 April notice confirms the May closure corridors; exact bus calls and calendars remain GTFS evidence. The linked audit records the primary-page retrieval limitation and OSM graph dates.

This candidate uses the existing AGIS and OSM baseline plus exact-template FOT, Interlaken hierarchy, Bern projection, Waldshut corridor, scoped AVA April roads, September closure localization, Schupfart event-road and May Lenzburg replacement-road policies. The September border/platform rules, twelve-date seasonal rules, Simplon journeys and bus alignment corrections retain their exact date scopes and are not applied here. In particular, a witness during a planned disruption does not establish that a normal-line shape is the replacement itinerary. New replacement-bus routes need dated operator and road evidence.

Source geometry keeps its existing dates and limitations: **AGIS 23 April 2026**, normal timetable only; FOT catalogue **6 July 2021**, asset update **18 January 2025**, current validity unconfirmed; OSM snapshots and routing evidence remain pinned by the referenced cache/source hashes. Required attribution remains **Timetable: opentransportdata.swiss**, **Daten des Kantons Aargau**, **© swisstopo**, **© OpenStreetMap contributors; ODbL-1.0**, and the original FOT attribution recorded in the machine audit.

The original Friday/Sunday feeds and the twelve-date seasonal geometry results are unchanged. The separate Friday correction candidate still resolves four occurrences on lines 136 and 358; **222 directed bus-pair reviews** remain. The bus follow-up was checked on **9 September 2026**; the original inventory date above is retained. Publication readiness remains false. Next work is to obtain geometry evidence for these newly witnessed patterns, then validate full civil-day extracts before adding dates to the release scope.

## Reproduction

```sh
python3 scripts/inventory-aargau-witnesses.py /path/GTFS_FP2026_20260902.zip
node scripts/verify-aargau-witnesses.mjs /path/GTFS_FP2026_20260902.zip
node scripts/audit-aargau-witnesses.mjs
node scripts/prepare-aargau-witness-rail.mjs
node scripts/review-aargau-witness-rail.mjs
node scripts/prepare-aargau-witness-interlaken.mjs
node scripts/review-aargau-witness-interlaken.mjs
node scripts/prepare-aargau-witness-edges.mjs
node scripts/review-aargau-witness-edges.mjs
node scripts/inventory-aargau-witness-buses.mjs
node scripts/package-aargau-witness-ava.mjs --check
node scripts/prepare-aargau-witness-ava-policy.mjs
node scripts/review-aargau-witness-ava.mjs
node scripts/prepare-aargau-witness-oberentfelden.mjs
node scripts/review-aargau-witness-oberentfelden.mjs
node scripts/review-aargau-oberentfelden-detour.mjs
node scripts/package-aargau-witness-schupfart.mjs --check
node scripts/prepare-aargau-witness-schupfart-policy.mjs
node scripts/review-aargau-witness-schupfart.mjs
node scripts/package-aargau-witness-lenzburg.mjs --check
node scripts/prepare-aargau-witness-lenzburg-policy.mjs --check
node scripts/review-aargau-witness-lenzburg.mjs
node scripts/document-aargau-witness-buses.mjs
node scripts/document-aargau-witnesses.mjs
python3 scripts/aargau-witnesses.test.py
npx vitest run scripts/aargau-witness-edges.test.mjs scripts/aargau-witness-interlaken.test.mjs scripts/aargau-witness-rail.test.mjs scripts/aargau-rail-geometry.test.mjs
# Append --check to each inventory, verification, audit or documentation command to replay without rewriting.
```
