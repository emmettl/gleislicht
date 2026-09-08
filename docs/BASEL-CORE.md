# Basel core study and release validation

Reviewed **8 September 2026**. The study combines complete BVB/BLT bus and tram journeys with a bounded regional rail network, using a **civil day including preceding service-day services**. Both Tuesday and Sunday pass the existing payload budgets and a 95% movement-geometry gate in each of five groups. The Tuesday fixture is integrated into the application as a **schematic centreline study**, with selection, full-day loading, sharing and translated labels. The scope remains smaller than the complete TNW/trireno network; paths represent inferred centrelines rather than individual running tracks.

The [geometry repair review](BASEL-GEOMETRY-REPAIRS.md) adds **682 Tuesday / 456 Sunday movements** from explicit Basel-Stadt, swisstopo and OSM source chains. Regional rail and BVB bus geometry now reach 100% on both fixtures, with all prior accepted paths preserved.

The earlier [local audit](BASEL-STUDY.md) remains a reproducible service-day baseline. Its counts should not be compared directly with the larger civil-day candidate without separating calendar and geometry changes.

## Settled scope

The [machine-readable policy](../data/basel-core-policy.json) controls admission and reviewed dates. The label is **Basel: BVB/BLT and Swiss-side regional rail**.

| Rail corridor | Admitted source services | Boundary |
| --- | --- | --- |
| Basel SBB–Muttenz–Pratteln–Rheinfelden | S1, S11, SBB agency 11 | Rheinfelden |
| Basel SBB–Pratteln–Liestal–Sissach | S3, S32, S33, agency 11 | Sissach |
| Basel SBB–Dreispitz–Dornach-Arlesheim–Laufen | S3, S31, agency 11 | Laufen |
| Basel SBB–Basel Bad Bf–Riehen | S6, agencies 351 and L7____ | Riehen |
| Basel SBB–Basel St. Johann | TER, agency 11 | Basel St. Johann |

The official [trireno 2026 network plan](https://www.tnw.ch/assets/files/content/linienplan_trireno_2026.pdf), valid from 14 December 2025, was rendered and inspected. It establishes the corridor relationships; exact calls, source operators and active dates come from Swiss GTFS **20260905**. Future S2/S4 plans do not rename current services. Express TER journeys with only Basel SBB inside this boundary have no in-scope movement and are excluded.

There are **24 admitted rail station identities**, plus an explicit alias for the German Basel Bad Bf identifier. Admission checks source agency, line, transport type, station number and station name. Platform IDs and coordinates remain verbatim. S6 has distinct source records on either side of Basel Bad Bf; those records retain their identities and times rather than being fused by public train number.

BVB/BLT journeys keep their complete local chains, including St-Louis, Weil am Rhein and Leymen. Rail is deliberately bounded on the Swiss side: no rail movement to Saint-Louis or Lörrach is implied. S5, S9, RB27/RB30, long-distance and regional-express trains, AAGL, SWEG and distribus remain outside this policy. The BS S-Bahn layer and other cross-border geometry are acquisition targets for a later expansion; the current FOT-based implementation does not supply those foreign corridors.

## Calendar and source-chain guarantees

[`basel-core-timetable.mjs`](../scripts/basel-core-timetable.mjs) reads the selected current and previous service calendars, then scans the archive's complete stop-time table once for both fixtures. It rejects active frequency templates, duplicate stop sequences, nonmonotone times and unsupported times at or beyond 48:00.

- Tuesday uses **7 and 8 September**; Sunday uses **12 and 13 September**. Previous-day times are shifted by −86,400 seconds. Trips may start below zero or finish after 24:00, and their complete retained chains remain available for interpolation.
- Admit a journey only if its retained interval intersects the civil window; a trip starting exactly at the following midnight is excluded. A previous service-day trip beginning after 24:00 can legitimately appear after civil midnight.
- Local journeys retain every source call. Rail keeps each **contiguous** run of at least two admitted calls. An excluded intermediate station splits the run; it can never create a shortcut between later in-scope calls.
- Rail records carry `sourceTripId`, `sourceServiceDate`, `sourceCallCount`, `clippedToCore` and a zero-based, half-open `sourceCallRange`. Source headsigns remain unchanged even when the displayed movement ends at the study boundary. Multiple retained runs have distinct instance IDs.

For offline bus matching only, negative carry-in times are shifted back by one day. This preserves all intervals and avoids invalid negative GTFS hours. It does not modify the study's civil-day times.

## Measured candidates

| Group | Tuesday trips | Tuesday accepted movements | Sunday trips | Sunday accepted movements |
| --- | ---: | ---: | ---: | ---: |
| BVB tram | 2,389 | 49,762 / 50,486 — **98.57%** | 1,713 | 34,780 / 35,130 — **99.00%** |
| BVB bus | 2,979 | 48,655 / 48,655 — **100%** | 2,030 | 31,027 / 31,027 — **100%** |
| BLT tram | 860 | 18,635 / 18,635 — **100%** | 581 | 12,872 / 12,872 — **100%** |
| BLT bus | 2,142 | 29,843 / 30,020 — **99.41%** | 1,518 | 20,459 / 20,563 — **99.49%** |
| Regional rail | 438 | 2,364 / 2,364 — **100%** | 321 | 2,168 / 2,168 — **100%** |
| **Total** | **8,808** | | **6,163** | |

Tuesday has **1,297 platforms**, **219 preceding-day instances**, and **296 clipped rail instances**. Sunday has **1,197 platforms**, **491 preceding-day instances**, and **234 clipped rail instances**. These are source trip/run records, not a count of distinct physical vehicles.

| Gzip payload | Tuesday | Sunday | Budget |
| --- | ---: | ---: | ---: |
| Manifest | 284.5 KiB | 253.7 KiB | 650 KiB |
| Morning | 420.0 KiB | 312.2 KiB | 1,600 KiB |
| Largest two-hour chunk | 141.9 KiB | 88.6 KiB | 450 KiB |

Both days have twelve chunks. Sunday's 02:00–04:00 chunk now contains 135 trip records; the earlier service-day artifact omitted previous-day services. Empty Tuesday 02:00–04:00 is retained as the timetable result, rather than filled with invented service.

Exact source hashes, per-route results, retained FOT segment identities, individual path decisions, bus failures and payload counts are in the [Tuesday report](../data/basel-core-audit.json) and [Sunday report](../data/basel-core-sunday-audit.json).

## Geometry review and explicit decisions

**Rail:** the adapter selects **48 FOT segments** through exact operating-point chains, retaining real incident segments at corridor endpoints so platforms can project beyond a station's central operating point. It separates the mainline and tram components by topology. Projection remains bounded to **120 m**, with a **4.5× / 3,000 m** path-length guard. Both directions use physical centrelines; source operating-point paths do not establish a specific running track. The reviewed corridor plot follows the five expected branches and retains the failed station approaches visibly.

**Trams:** previously accepted BS and tram-19 paths retain priority. Only failed movements already admitted by the dated tram diversion policy may use the connected FOT tram component. The **120 m** snap and tighter urban **2× / 600 m** detour guard remain unchanged. This fills **510 Tuesday / 316 Sunday movements**, including connections near Bahnhof SBB/Aeschenplatz, Burgfelderplatz and Dreirosenbrücke. BLT trams now have full inferred geometry on both dates. Every accepted/rejected FOT fallback records its source segment IDs.

The [BVB construction notices](https://www.bvb.ch/de/aktuelle-informationen/baustelleninformationen/) and [BLT operating notices](https://www.blt.ch/mobilitaet/betriebsinfos) support the reviewed corridors for all four source dates. The earlier policy's two dates remain unchanged; the core policy explicitly adds the two preceding dates. This does **not** authorize arbitrary September dates or future refreshes.

**Buses:** a supplemental [civil-day cache](../data/basel-core-road-cache.json) covers **116 BVB / 135 BLT complete patterns**, including the previously absent overnight patterns. It retains the same pinned pfaedle binary, OSM input and importer guards. The bus profile restricts named OSM station candidates from **200 m to 50 m**; final endpoint acceptance stays at 120 m. It fills only movements still missing after the original cache. There are now **zero missing cache patterns** on either date, adding **113 Tuesday / 425 Sunday movements** after review exclusions.

The rendered [Wanderstrasse temporary-stop plan](https://www.bvb.ch/wp-content/bvb/dokumente/baustelleninformationen/2026/Wanderstrasse_September_2026.pdf) is decisive for line 33. The new inference reaches the provisional General Guisan-Strasse platform, but its next movement doubles back along the approach. The official plan continues around the southern loop toward St. Galler-Ring. The policy therefore **rejects that exact directed platform pair**, despite its acceptable numerical snap/detour scores. The raw cache remains unchanged for provenance; `reviewedCoreRoadCache` applies the exclusion before final matching and records `reviewed-corridor-mismatch`. This is a concrete example of why coverage alone cannot approve a path.

Sources remain separately credited: **Geodaten Kanton Basel-Stadt**, **Federal Office of Transport**, and **OpenStreetMap contributors / ODbL 1.0**. FOT's asset is from January 2025 and has no established September 2026 validity date. Dated notices support service corridors, not the freshness of every GIS vertex.

The inspected PDF hashes are:

- trireno: `4ee9e8ab05eec8efc9cfd0a3df65bacd271cd60cebf6499495bb6ead8470caf3`
- Wanderstrasse: `dda05fee135e45191d03832607d046c9c4becb3ffb7035b5c196090804b45480`

## Remaining geometry and release boundary

The [reviewed geometry repairs](BASEL-GEOMETRY-REPAIRS.md) resolve the SBB 19/20 approaches, both principal tram 6 diversion gaps, bus 33's southern loop, bus 34's Otto Wenk-Platz movement and EV11 Schaulager–MFP. All original matcher snap and detour bounds remain in force. The raw road-cache exclusion still rejects line 33's incorrect shortcut; a separate reviewed source chain supplies its replacement.

There are now **208 Tuesday / 138 Sunday directed route/platform pairs** with an unmatched occurrence, accounting for **901 / 454 movements**. The remaining EV11 Freilager–Schaulager leg contributes **177 / 104**; its OSM candidate disagrees with BLT's dated diversion map and remains rejected. Other tram patterns contribute **724 / 350**. They remain in the timetable and use ordinary stop interpolation, disclosed by the model label. The repair review records accepted source chains, rejected alternatives, exact measurements and evidence. Street direction and individual track certification remain outside the general schematic model.

## Application and release status

The study ID is `basel-core`, exposed as **BS** and through the study browser. Selection defaults to the civil full day; an explicit `range=morning` link remains supported. The app fetches the morning topology and two-hour day chunks on demand, supports route/station search (including retained foreign local stops), seeking, Now, station/time sharing and load retry. English, German, French and Italian labels describe the scope. Basel-Stadt, BAV, OSM and swisstopo attribution accompanies the map.

[`build-basel-day.mjs`](../scripts/build-basel-day.mjs) promotes a reviewed candidate into the fourteen application artifacts. It requires a passing candidate gate and an unchanged policy hash, adds source credits and `baselReleaseVersion: 1`, then validates the complete staged set before replacing output files. The original candidate reports retain `publicationReady: false` as their historical data-only status; release readiness is established separately by this wrapper and the application checks.

[`basel-release-validation.mjs`](../scripts/basel-release-validation.mjs) checks the reviewed civil/source dates, source identities, rail clipping ranges, consistent morning/day topology and trips, attribution, rail snap bound and all five movement-coverage groups. The regional validator also rejects inconsistent copies of journeys repeated in adjacent chunks.

The existing regional refresh and Pages assembly now include Basel. [`refresh-basel-day.mjs`](../scripts/refresh-basel-day.mjs) rebuilds only dates explicitly admitted by the reviewed policy. For an unreviewed date or a failed source/build check, it retains a complete validated published Basel set with its **original timetable date**, while other regions can refresh. On first deployment only, a missing Basel manifest may select the complete checked-in fixture. Missing or corrupt chunks in an existing published set fail recovery; they cannot be mixed with fixture bytes. Extending the reviewed dates still requires a fresh diversion review.

The initial integration verification on 8 September passed all **386 unit tests**, TypeScript, the production build, edition boundaries, Pages artifact checks and the mobile first-view budget (**358.7 KiB JavaScript / 360 KiB**). Focused lint reports existing React warnings, with no errors. All **six Basel browser cases** passed across desktop Chromium and iPhone WebKit: selection/lazy loading/search/sharing, midnight chunk retry and preceding-day movement, and morning retry/translations/overflow. Desktop and phone screenshots were inspected. Both Tuesday and Sunday also passed the application release wrapper. These are local checks; a hosted deployment is verified separately. The subsequent geometry validation, including the current shared-workspace test limitations, is recorded in the [repair review](BASEL-GEOMETRY-REPAIRS.md).

## Reproduce

Use Node **24.20.0**, the retained Swiss GTFS **20260905**, FOT XTF and hash-matching BS catalogue. Candidate artifacts are generated outside `public/`:

```sh
node scripts/build-basel-core.mjs \
  --archive /path/swiss-gtfs.zip \
  --sources /path/basel-sources \
  --rail-geometry /path/rail.xtf \
  --output-directory /tmp/basel-core --check
```

The default dates are 8 and 13 September 2026. Each date directory contains `basel-core-audit.json`, `basel-core-day-manifest.json`, `basel-core-morning.json` and `basel-core-day-chunks/`. The run used for the committed reports is retained under `/tmp/basel-core-reviewed/`.

Promote a reviewed candidate, or substitute another output directory to validate the Sunday release without replacing the delivered Tuesday fixture:

```sh
node scripts/build-basel-day.mjs \
  --candidate /tmp/basel-core-reviewed/2026-09-08 \
  --output-directory public/data
npx vitest run scripts/basel-release.test.mjs scripts/regional-refresh.test.mjs
npx playwright test basel.spec.ts
```

To rebuild the supplemental cache, first run the builder with `--supplemental-bus-cache none`, then pass both generated **core manifests** to `prepare-basel-road-feeds.mjs` as described in the [bus pipeline](BASEL-GEOMETRY-PIPELINE.md). Use the pinned original `pfaedle.cfg` and replace its single literal `osm_max_station_cand_distance: 200` with `osm_max_station_cand_distance: 50`. Assert that exactly one replacement occurs; all other bytes remain unchanged. The resulting configuration SHA-256 is **`190cb02a00faeaf6a84638293984a3947b11673fab48dae10634a0e6c2e29c49`**. Match both agency feeds with the existing `--no-trie -W` wrapper, import using `basel-road-geometry.mjs`, then rerun the builder with `--supplemental-bus-cache /path/new-cache.json`. Policy exclusions still apply to rebuilt caches until explicitly reviewed.

```sh
npx vitest run scripts/basel-core.test.mjs \
  scripts/basel-line-geometry.test.mjs scripts/basel-road-geometry.test.mjs \
  scripts/basel-tram-diversions.test.mjs scripts/civil-day.test.mjs
```

Forty focused checks cover exact admission, contiguous clipping, civil-day boundaries, source identity aliases, negative-time matcher preparation, disconnected topology, both directions, conservative guards, the explicit line-33 rejection and the existing local pipeline. A separate Python pass independently parses the source calendars and stop-time table, compares every candidate call with the expected complete local chain or contiguous rail slice, verifies source platforms and chunk integrity, and recounts coverage. It passed for all **8,808 / 6,163** expected source instances and confirmed that all **142,330 / 90,162** previously accepted local movement paths are retained byte-for-byte. The verifier and its result are retained at `/tmp/verify-basel-core.py` and `/tmp/basel-core-verification.log`. Focused lint and diff whitespace checks also pass.
