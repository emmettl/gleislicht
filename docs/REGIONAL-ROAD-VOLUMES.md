# Regional hourly volume files and first junction finding

Implemented **8 September 2026** after the [local direction review](REGIONAL-ROAD-DIRECTIONS.md). The first increment adds a checked intervening-roundabout finding and a browser-readable hourly data contract for all **620 imported series**. The subsequent interface exposes these counts under **AUTO → Road recordings → Hourly road counts**, without vehicle animation.

## Thurgau: the strongest same-basis pair crosses a roundabout

Stations **61103 and 61101** on H13 have complete opposing directions and comparable published class sums. They lie approximately **147 m** apart. The detailed swisstopo road model shows a closed road loop with **Dorfstrasse joining Seestrasse between the counters**. Carrying either counter's volume through this junction would assume unmeasured turning flows.

The [original local response](../data/regional-road-junction-sources/2026-09-08/manifest.json) retains 61 features from [swissTLM3D roads and tracks](https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swisstlm3d-strassen/legend), published by the Federal Office of Topography swisstopo. It uses explicit LV95 coordinates and a small bounding box; the response is below the documented 200-feature cap. The source URL, retrieval time, bytes and hash are pinned. This is local geometric evidence, not a survey of permitted turns or a guarantee of complete access coverage.

The [review](../data/regional-road-junction-reviews.json) identifies source features **47060270, 47060271 and 47060272** as the closed loop and **46950761** as the named Dorfstrasse branch. The compiler checks that the three edges share exactly three degree-two endpoint nodes, every loop vertex falls between the two counters and within 20 m of the matched axis, and the branch meets exactly one loop node. Changed, disconnected or misplaced geometry fails the review.

The [new junction audit](../data/regional-road-junction-audit.json) replaces this pair's generic open-junction review reason with **`intervening-roundabout`**. All 196 diagnostic pairs remain held. The earlier direction audit is preserved as the input to this later review stage.

## Hourly data ready for counter volume displays

The [public index](../public/data/regional-road-volumes/index.json) contains counter identities, names, source direction labels, coordinates, measurement bases, geometry-review status and source attribution. **31 series have an inferred local bearing**; every unresolved direction has `orientation: null`. These bearings describe a counter arrow, not travel along a section.

Six separately loadable JSON files cover the two Swiss civil dates:

| Source | Series per day | Complete measured days, Friday | Complete measured days, Sunday |
| --- | ---: | ---: | ---: |
| Basel-Stadt | 63 | 62 | 62 |
| Thurgau, both distinct products | 340 | 340 | 334 |
| Zürich city | 217 | 210 | 210 |

Paths follow `public/data/regional-road-volumes/{source}/{YYYY-MM-DD}.json`, for **2026-09-04** and **2026-09-06**. The index records each file's byte size and SHA-256. Files are intended to be loaded by region and day, not bundled into the initial application payload. Original count records remain in the source and normalization artifacts.

The contract deliberately keeps these distinctions:

- `slots` contains the UTC start/end and offset-bearing Swiss local time for each hour. Spring and autumn clock changes produce 23 and 25 slots respectively; repeated local hours remain distinct UTC intervals.
- Each series has exactly one `hours` entry per slot. `value` is the nonnegative measured count only when the source row has no issues. A measured zero remains zero.
- Edited, imputed, source-missing and absent observations have a null display value. `reportedValue`, original quality flags, validation state, row issues and source-row identity remain available. A source-missing row is distinct from an absent record.
- `measuredSubtotal` is the sum of usable observations and is null if there are none. `dayTotal` is present only when every expected hour is usable. There is no interpolation or replacement of missing hours with zero.
- Thurgau's **120 class-product series** retain `sum-of-published-classes`. They remain separate from reported totals, including at nearby counters. The compiler rejects a changed class/total overlap without review.
- All imported series remain available, including parking/access scope and unresolved geometry. Consumers must use the supplied `geometryStatus`; inclusion in this counter inventory is not approval for a through-road map layer.

The data represents local counts. Adding stations, their opposing directions or the two Thurgau products does not produce a network-wide total. Basel's unapproved and Thurgau's current-year raw validation flags are retained. No speed, trajectory, legal turn or corridor throughput is inferred, and every file states `playbackEligible: false`.

## Reproduction and checks

```sh
node scripts/audit-regional-road-junctions.mjs
python3 -B scripts/compile_regional_road_volumes.py
npx vitest run scripts/regional-road-counts.test.mjs \
  scripts/regional-road-directions.test.mjs scripts/regional-road-junctions.test.mjs
```

The volume policy pins the five inputs before any public files are written. The compiler also checks the junction audit's direction-input identity. Offline reproduction is byte-for-byte deterministic.

Validation includes **34 Python cases** for ingestion, geometry and hourly volumes, plus **15 JavaScript cases** for direction and junction review. The new cases cover closed-loop connectivity, a detached named branch, a loop outside the counter interval, output reproduction, measured zero versus absence, edited/imputed/flagged readings, incomplete day totals, duplicate hours, invalid intervals/counts, DST days and the preserved municipal/Thurgau gaps.

## Counter volume interface

The existing road-recordings window now opens a dedicated hourly-count view. Select Basel-Stadt, Thurgau or Zürich city, one of the two dates and an individual counter/direction series. Region and counter choices remain separate from reconstructed road pilots. The view preserves the application's English, German, French and Italian language selection.

Hourly bars are selectable by pointer or keyboard (left/right arrows, Home and End). A measured zero appears as a baseline mark, while missing and absent hours show a gap. The selected hour explains its quality; an expandable table provides every hourly value and quality state. Complete daily totals and incomplete measured subtotals have different labels. Class sums remain identified as sums of published classes, and excluded or unresolved road locations retain visible review notes.

A north-referenced compass is shown only for the 31 reviewed local directions. Other counters state that their travel direction is unreviewed. The interface does not infer directions from the source's place labels or introduce motion, speeds or corridor totals.

The index loads when the hourly view opens; only the selected region/day file then loads. Counter changes within that file reuse the loaded data. Region/date changes and closing the view cancel pending requests, with request guards preventing stale results from replacing the current selection. Failed HTTP requests, invalid data and checksum mismatches expose a retry action. The loader checks the file's SHA-256 and size, series identities, interval continuity, hourly quality, coverage and totals before rendering.

The interface and existing road-pilot tests run with:

```sh
npx vitest run scripts/regional-road-volumes-ui.test.tsx src/studies/cantonal-road-pilot.test.ts
```

Eight interface checks cover all six public files, default reviewed counters, duplicate/mismatched records, hidden gaps, invalid daily totals, unsupported arrows, foreign file paths, byte-integrity failures, request/cancellation failures, zero versus missing presentation, and all four languages. These are data and server-rendering tests; no interactive browser QA is claimed. The production build and initial-transfer budget also pass in an isolated checkout containing this interface increment.
