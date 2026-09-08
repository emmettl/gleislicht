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

Compatibility below counts each archived trip template once, across all its complete adjacent calls. It uses the separate rail-review candidate and is not the journey total for the selected witness date.

| Route record | Operator / line | Active civil dates | Witness civil date / source course | Compatible / all template segments |
| --- | --- | --- | --- | --- |
| 91-1B-Y-j26-1 | Schweizerische Bundesbahnen SBB / IC | 7 | 2026-03-01 / 1582 | 25 / 25 |
| 91-21-D-j26-1 | Schweizerische Bundesbahnen SBB / IC21 | 4 | 2026-08-09 / 696 | 24 / 24 |
| 91-22-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 3 | 2026-08-09 / 31410 | 19 / 19 |
| 91-27-D-j26-1 | THURBO / S27 | 4 | 2026-04-13 / 7774 | 18 / 18 |
| 91-36-B-j26-1 | Schweizerische Bundesbahnen SBB / S36 | 4 | 2026-04-13 / 22891 | 0 / 6 |
| 91-3A-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 21 | 2026-05-23 / 31392 | 90 / 93 |
| 91-3T-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 2 | 2026-10-03 / 31499 | 14 / 14 |
| 91-3V-Y-j26-1 | Schweizerische Bundesbahnen SBB / S | 12 | 2026-05-23 / 14559 | 1,334 / 1,334 |
| 91-40-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 4 | 2026-08-09 / 31408 | 22 / 22 |
| 91-42-F-j26-1 | Schweizerische Südostbahn (sob) / S42 | 3 | 2026-05-22 / 31157 | 54 / 54 |
| 91-46-j26-1 | Schweizerische Südostbahn (sob) / IR46 | 2 | 2026-03-01 / 2413 | 40 / 40 |
| 91-4C-Y-j26-1 | Schweizerische Bundesbahnen SBB / IR | 1 | 2026-08-08 / 30515 | 40 / 40 |
| 91-4T-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 4 | 2026-06-14 / 31010 | 34 / 36 |
| 91-4U-Y-j26-1 | Schweizerische Bundesbahnen SBB / IR | 4 | 2026-08-16 / 2382 | 24 / 26 |
| 91-55-C-j26-1 | Schweizerische Bundesbahnen SBB / IR55 | 5 | 2026-05-22 / 1759 | 150 / 150 |
| 91-5R-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 1 | 2026-02-23 / 31300 | 11 / 11 |
| 91-5V-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 2 | 2026-03-27 / 31376 | 5 / 5 |
| 91-75-Y-j26-1 | Schweizerische Bundesbahnen SBB / S | 10 | 2026-05-22 / 30989 | 485 / 485 |
| 91-7Q-Y-j26-1 | Schweizerische Bundesbahnen SBB / IC | 2 | 2026-03-08 / 31102 | 14 / 14 |
| 91-81-A-j26-1 | Schweizerische Bundesbahnen SBB / IC81 | 17 | 2026-05-23 / 806 | 960 / 1,120 |
| 91-8F-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 1 | 2026-08-09 / 31414 | 7 / 7 |
| 91-8U-Y-j26-1 | Oensingen-Balsthal-Bahn / EXT | 1 | 2026-04-18 / 31710 | 2 / 2 |
| 91-98-Y-j26-1 | Schweizerische Bundesbahnen SBB / RE | 4 | 2026-06-16 / 31247 | 15 / 15 |
| 91-9I-Y-j26-1 | Oensingen-Balsthal-Bahn / EXT | 1 | 2026-08-16 / 31048 | 86 / 86 |
| 91-9N-Y-j26-1 | Schweizerische Bundesbahnen SBB / IC | 2 | 2026-10-10 / 10512 | 60 / 60 |
| 91-9Z-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 1 | 2026-02-12 / 31408 | 10 / 10 |
| 91-AK-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 5 | 2026-02-12 / 31211 | 64 / 64 |
| 91-BM-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 1 | 2026-02-23 / 31202 | 11 / 11 |
| 91-BO-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 1 | 2026-02-23 / 31302 | 10 / 10 |
| 92-A01-N-j26-1 | SBB Infrastruktur AG Bahnersatz / EV4 | 12 | 2026-05-23 / 28142 | 0 / 130 |
| 92-A01-Q-j26-1 | SBB Infrastruktur AG Bahnersatz / EV2 | 5 | 2026-09-14 / 80070 | 0 / 59 |
| 92-A01-U-j26-1 | SBB Infrastruktur AG Bahnersatz / EV3 | 5 | 2026-09-14 / 80096 | 0 / 7 |
| 92-A04-9-j26-1 | SBB Infrastruktur AG Bahnersatz / EV2 | 29 | 2026-08-09 / 1991 | 0 / 191 |
| 92-A04-B-j26-1 | SBB Infrastruktur AG Bahnersatz / EV1 | 31 | 2026-08-09 / 17287 | 0 / 504 |
| 92-A04-F-j26-1 | SBB Infrastruktur AG Bahnersatz / EV1 | 38 | 2026-09-14 / 80117 | 0 / 328 |
| 92-A05-X-j26-1 | SBB Infrastruktur AG Bahnersatz / EV3 | 3 | 2026-05-22 / 1162 | 0 / 98 |
| 92-A07-9-j26-1 | Aargau Verkehr AG Ersatzverkehr / EV | 6 | 2026-09-14 / 9245 | 0 / 4,616 |
| 92-A08-U-j26-1 | SBB Infrastruktur AG Bahnersatz / EV1 | 9 | 2026-04-20 / 71523 | 0 / 80 |
| 92-A08-Z-j26-1 | SBB Infrastruktur AG Bahnersatz / EV2 | 13 | 2026-05-23 / 19121 | 0 / 28 |
| 92-EV1-D-j26-1 | SBB Infrastruktur AG Bahnersatz / EV1 | 6 | 2026-08-16 / 18190 | 0 / 158 |
| 92-EV5-V-j26-1 | SBB Infrastruktur AG Bahnersatz / EV5 | 4 | 2026-05-23 / 22946 | 0 / 391 |
| 92-EV7-R-j26-1 | SBB Infrastruktur AG Bahnersatz / EV7 | 4 | 2026-05-23 / 18857 | 0 / 74 |
| 92-EV8-F-j26-1 | SBB Infrastruktur AG Bahnersatz / EV8 | 1 | 2026-05-23 / 8783 | 0 / 238 |
| 92-EV9-I-j26-1 | SBB Infrastruktur AG Bahnersatz / EV9 | 4 | 2026-05-23 / 28377 | 0 / 78 |
| 96-138-1-j26-1 | PostAuto AG / EXT | 3 | 2026-09-25 / 81007 | 0 / 207 |

The following selected witnesses specifically use the preceding service calendar:

| Route record | Witness civil date | Source service date | Source course |
| --- | --- | --- | --- |
| 91-21-D-j26-1 | 2026-08-09 | 2026-08-08 | 696 |
| 91-3T-Y-j26-1 | 2026-10-03 | 2026-10-02 | 31499 |
| 91-98-Y-j26-1 | 2026-06-16 | 2026-06-15 | 31247 |
| 92-A07-9-j26-1 | 2026-09-14 | 2026-09-13 | 9245 |
| 92-EV1-D-j26-1 | 2026-08-16 | 2026-08-15 | 18190 |

## Geometry still requiring evidence

The separately scoped rail-review candidate is compatible with **3,628 of 10,988 template segment occurrences**. **128 of 280 directed patterns** have complete geometry; **7,360 occurrences remain unresolved**. All journeys and their exact platform coordinates stay in the denominator. The [rail-review audit](../data/aargau-witnesses/rail-review-summary.json) enumerates every missing pattern/pair with the original source and fallback rejection reasons. The [reviewed pattern detail](../data/aargau-witnesses/rail-review-patterns.json.gz) retains admitted paths and source evidence.

| Mode | Routes | Trip templates | Directed patterns | Compatible occurrences | Unresolved occurrences |
| --- | --- | --- | --- | --- | --- |
| rail | 29 | 635 | 194 | 3,628 | 173 |
| bus | 16 | 1,384 | 86 | 0 | 7,187 |

The [original witness baseline](../data/aargau-witnesses/geometry-summary.json) remains unchanged at 12 compatible occurrences and no complete patterns. The [new finite rail policy](../data/aargau-witness-rail-policy.json) reviews **29 exact route records, 194 directed patterns and 635 archived rail trip templates**, adding **3,616 occurrences** and preserving all **12** prior paths. It supplies geometry on **28 route records**; **24 rail routes** now have complete template geometry. All bus assessments are unchanged.

The policy pins the archive-derived SBB (11), THURBO (65), SOB (82) and Oensingen-Balsthal-Bahn (68) identities, full platform-coordinate chains, source trip/course identities, calls, boarding rules and complete active service-date lists. Every template is checked before the shared pattern cache is used. Each inferred path and its directed FOT segment sequence are hashed and checked on replay. Station attachment remains at **350 m**, source topology attachment at **120 m**, with the existing **4.5× detour bound / 3,000 m allowance** and **5 m source simplification**. Another scheduled operating point cannot be traversed out of order. Accepted geometry is an infrastructure inference, not a certification of the special train's actual corridor, track or diversion.

The **173 unresolved rail occurrences** are explicit exclusions:

- **6 Waldshut–Koblenz occurrences**, SBB route 91-36-B-j26-1: foreign operating-point 8014474 has no exact FOT identity. Existing THURBO border rules do not transfer to this route identity or its dates.
- **5 Bern platform 49 occurrences**, routes 91-3A-Y-j26-1 and 91-4U-Y-j26-1: the source platform is **427.8 m** from the FOT station point, beyond the unchanged 350 m limit. The earlier date-scoped Bern platform fixes are not inherited.
- **162 Interlaken occurrences**, IC81 route 91-81-A-j26-1 (160) and EXT route 91-4T-Y-j26-1 (2): the bounded FOT graph remains disconnected toward Interlaken Ost. No coordinate-based topology repair or larger attachment limit is introduced.

The **86 bus patterns on 16 routes** still have **7,187 unresolved template occurrences**. Dated operator and road evidence remains necessary for their replacement and special workings. Together with the rail exclusions, **152 patterns** remain incomplete.

This candidate uses the existing AGIS and OSM baseline plus the new exact-template FOT policy. The September border/platform rules, twelve-date seasonal rules, Simplon journeys and bus alignment corrections retain their exact date scopes and are not applied here. In particular, a witness during a planned disruption does not establish that a normal-line shape is the replacement itinerary. New replacement-bus routes need dated operator and road evidence; the three remaining rail failure groups need scoped source evidence before filling their gaps.

Source geometry keeps its existing dates and limitations: **AGIS 23 April 2026**, normal timetable only; FOT catalogue **6 July 2021**, asset update **18 January 2025**, current validity unconfirmed; OSM snapshots and routing evidence remain pinned by the referenced cache/source hashes. Required attribution remains **Timetable: opentransportdata.swiss**, **Daten des Kantons Aargau**, **© swisstopo**, **© OpenStreetMap contributors; ODbL-1.0**, and the original FOT attribution recorded in the machine audit.

The original Friday/Sunday feeds and the twelve-date seasonal geometry results are unchanged. The separate Friday correction candidate still resolves four occurrences on lines 136 and 358; **222 directed bus-pair reviews** remain. Publication readiness remains false. Next work is to obtain geometry evidence for these newly witnessed patterns, then validate full civil-day extracts before adding dates to the release scope.

## Reproduction

```sh
python3 scripts/inventory-aargau-witnesses.py /path/GTFS_FP2026_20260902.zip
node scripts/verify-aargau-witnesses.mjs /path/GTFS_FP2026_20260902.zip
node scripts/audit-aargau-witnesses.mjs
node scripts/prepare-aargau-witness-rail.mjs
node scripts/review-aargau-witness-rail.mjs
node scripts/document-aargau-witnesses.mjs
python3 scripts/aargau-witnesses.test.py
npx vitest run scripts/aargau-witness-rail.test.mjs scripts/aargau-rail-geometry.test.mjs
# Append --check to each inventory, verification, audit or documentation command to replay without rewriting.
```
