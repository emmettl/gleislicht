# Lausanne regional study: timetable and geometry

The Lausanne candidate now passes the timetable, geometry and payload checks for
the sampled weekday and Sunday. The rail matcher uses identified FOT corridors
and projects platforms onto their alignments, correcting the métro and local rail
failures found during kickoff. It is **not yet a published study**: overnight
service-day handling, bus alignment review and browser integration remain.

## Scope

Use `lausanne-region` for the first study: tl buses, m1/m2, LEB and rail within
longitude 6.45–6.85, latitude 46.48–46.71. This includes Lausanne, Renens, Morges
and the LEB corridor to Bercher. It is a rectangular regional crop, not complete
Vaud or Mobilis coverage. Rail journeys may continue beyond the displayed area.
Lake services and the Cossonay funicular are excluded from this first candidate;
they need their own geometry audit.

Source route identity comes from `routes.txt` and `trips.txt`, including frequency
template IDs where applicable. tl is agency `151`; LEB is agency `55`. Displayed
line numbers are never used to infer an operator. The compact application
importer normally omits rail route IDs; the audit restores them by source trip
identity without changing that importer or the shipped data.

## Measured weekday baseline and corrected result

Swiss GTFS feed `20260905`, service date **2026-09-08**, Node **24.20.0**:

| Group | Trips | Source routes | Original indexed geometry | Original endpoints within 120 m |
| --- | ---: | ---: | ---: | ---: |
| tl buses | 6,624 | 38 | 100% | 100% |
| m1 | 328 | 1 | 100% | 92.7% |
| m2 | 749 | 1 | 68.8% | 62.4% |
| LEB (R20) | 141 | 1 | 100% | 81.1% |
| Other rail | 702 | 20 | 98.3% | 92.6% |

After correction, **all five groups reach 100% accepted geometry** on this
weekday. The audit retains the original rail results in `baselineRailGroups`,
alongside the corrected `groups` and per-platform `railProjection` evidence.

The candidate retains **8,544 trips**, 1,074 platform records and 506 distinct
stop names. The initial all-mode extract contained 8,951 trips; 400 funicular and
7 lake-service trips are outside the first study's scope.

Geometry percentages count scheduled stop-to-stop occurrences, not route count.
An indexed rail path does not establish correct station matching. The separate
120 m endpoint check is a proposed Lausanne acceptance check, not an official
accuracy specification or proof that a route follows the correct track.

The corrected candidate has 12 two-hour chunks. Gzip measurements are **77.0 KiB** for the
manifest, **181.2 KiB** for the morning snapshot and **105.6 KiB** for the largest
movement chunk. These fit the existing regional limits of 650/1,600/450 KiB.
These are data-only measurements; application transfer and rendering performance
remain to be checked after UI integration. No budget ceiling has changed.

The machine-readable results, input hashes, original failed directed platform
pairs, corrected projection evidence and per-chunk measurements are in
[`data/lausanne-study-audit.json`](../data/lausanne-study-audit.json).

The same feed was also audited for **Sunday 2026-09-13**: 6,740 candidate trips,
including 5,193 tl buses, 213 m1 trips, 505 m2 trips, 79 LEB trips and 750 other
rail trips. The weekday road cache covers **97.5%** of Sunday bus movements;
unknown patterns remain explicitly unshaped. All four rail/métro groups now
reach **100% accepted geometry**, and the complete Sunday candidate passes the
technical gate. The largest corrected Sunday chunk is 80.3 KiB gzip. See [`data/lausanne-study-sunday-audit.json`](../data/lausanne-study-sunday-audit.json).
This is a second sampled service day, not a claim that every weekend or season
has been covered. The report's pending checklist describes the remaining launch
work, including broader calendar and boundary review.

## Sources and bus matching

- Timetable: [official Swiss GTFS](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020).
  The [publisher's cookbook](https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/#shapestxt)
  explicitly says the feed does not supply `shapes.txt` and describes pfaedle as
  an option for generating inferred shapes.
- Rail: [Federal Office of Transport infrastructure](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz),
  parsed at 10 m simplification for this audit.
- Bus geometry: the existing PostBus offline pipeline, using
  [pfaedle](https://github.com/ad-freiburg/pfaedle) commit
  `99f2cd466696ecc6bdb73b2b3bb9008557fcb84a`, Geofabrik Switzerland 2026-09-02
  and the retained OSM border extract downloaded 2026-09-08.

The matcher processed all **183** distinct ordered tl route/platform patterns in
four seconds on the development Mac. All **110,388** weekday bus movements passed
the existing fallback, 120 m snap, detour and shape-distance checks. Maximum
pre-connector platform snap was 116.6 m. This is automated acceptance, **not visual
or operator verification**. The next review should include the worst snaps,
Renens, Flon, Saint-François, hill routes and directional variants.

[`data/lausanne-road-cache.json`](../data/lausanne-road-cache.json) retains the
derived paths, pattern keys, matcher hashes and rejection report. It is an
OpenStreetMap-derived database under **ODbL 1.0**, attributed to
[OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Any eventual
published view must display that attribution and describe the paths as inferred.
The cache is not imported by the browser or daily publication workflow yet.

An exact route ID, ordered platform sequence and platform coordinates are required
to reuse a path; changed times alone do not invalidate it. Unknown patterns remain
unmatched. No new routing service or build dependency was added.

The public Lausanne map and regional catalogues were also investigated, but this
audit did not establish a usable official bus-shape download. This does not assert
that no such source exists.

## Geometry corrections

The Lausanne matcher is separate from the existing national/regional matcher;
other studies keep their current geometry. It selects infrastructure using source
agency identity and stable FOT operating-point numbers:

- **m2:** the component anchored at Flon m2 (`8519589`), keeping LEB out of métro
  matches. Délices and Grancy split the surveyed edges at their projected
  positions instead of collapsing onto Jordils and Gare.
- **m1:** the Flon m1 (`8519588`)–Renens (`8501118`) corridor. It is isolated from
  the mainline graph even though the source networks connect at Renens.
- **LEB:** the component anchored at Flon LEB (`8519590`). Projection fixes the
  displaced reference-node endpoints at Les Ripes and Etagnières.
- **MBC:** agency `29` uses the component anchored at La Gottaz (`8501054`),
  reaching Morges on the correct local railway rather than the SBB station node.
- **Other rail:** the component anchored at Lausanne (`8501120`), excluding the
  m1 corridor. Platform projection corrects the mainline endpoint gaps too.

Platforms must be within **120 m** of their selected corridor. The largest actual
snap is **44.28 m** on both sampled days. The matcher inserts cuts into the source
polylines, routes between those cuts and adds short connectors to the timetable
platform coordinates. Paths keep their direction. Disconnected tracks, coincident
projections, remote platforms and excessive detours remain unshaped; the detour
limit remains the greater of 3 km or 4.5 times the direct distance. Missing or
ambiguous FOT anchors fail the build. These limits were not loosened to pass the
audit. Individual track/platform selection remains an inference, not an operator
survey or a live position.

Both sampled days have **zero rejected rail segments**: 18,795 weekday and 14,753
Sunday rail/métro movements. All original trip identities, ordered stops and times
are retained. Unused topology edges do not acquire a guessed rail path.

The [alignment review](assets/lausanne-rail-review.svg) was inspected for m2 south
of Flon, m1 at Renens, LEB at Les Ripes/Etagnières and MBC at Morges/La Gottaz.
It overlays the corrected paths and timetable platforms on the FOT geometry.
This verifies alignment continuity and network selection against those inputs;
it is not independent operator verification. The retained regression fixture
contains official source extracts, input identity, 18 journeys in both directions,
and the affected platforms.

The technical gate still requires at least 95% accepted geometry in **each** of
five groups, alongside existing payload limits. Both weekday and Sunday now pass.
A large bus fleet cannot conceal an incomplete métro. The audit writes its report
and candidate for inspection; `--check` returns a failing exit status if the
technical gate fails. Passing this gate alone is not publication approval.

## Reproduce

Use Node 24 and keep generated candidates outside `public/`. With the official
GTFS and FOT files retained locally:

```sh
node scripts/audit-lausanne-study.mjs \
  --archive /path/swiss-gtfs.zip --rail /path/rail.xtf \
  --date 2026-09-08 --output-directory /tmp/lausanne-audit \
  --bus-cache data/lausanne-road-cache.json --prepare-bus-feed
```

The command extracts the bounded day, verifies source identity, builds the
candidate topology and chunks, measures geometry by mode/operator and writes
`lausanne-audit.json`. `--snapshot` can reuse a previously extracted full-day
snapshot from the same archive/date. Source hashes are retained for both inputs.

To regenerate the road cache, follow the pinned tool/extract setup in
[`POSTBUS-ROAD-GEOMETRY.md`](POSTBUS-ROAD-GEOMETRY.md), then run:

```sh
node scripts/match-postbus-roads.mjs \
  --pfaedle /path/pfaedle --config /path/pfaedle.cfg \
  --osm /path/postbus-roads.osm.pbf \
  --feed /tmp/lausanne-audit/bus-feed --output /tmp/lausanne-matched
node --input-type=module <<'JS'
import { writeFile } from 'node:fs/promises'
import { importRoadShapes } from './scripts/enrich-postbus-roads.mjs'
const cache = await importRoadShapes('/tmp/lausanne-matched',
  'Describe the actual dated OSM extracts and pinned matcher used')
await writeFile('/tmp/lausanne-road-cache.json', JSON.stringify(cache))
JS
```

Re-run the audit with that cache. `--prepare-bus-feed` identifies the temporary
feed as tl and uses French metadata; the existing PostAuto default remains
available for its original pipeline.

Verification after the rail corrections: 41 focused tests passed across Lausanne
projection/auditing, existing rail and road matching, GTFS import and regional
refresh/chunk suites. Both
generated candidate days were independently checked for contiguous 24-hour
coverage, exact byte counts and SHA-256 hashes, valid references, identical
overlapping trips and unique day totals. This validates the candidate files;
it does not complete the outstanding publication work.

## Following implementation slice

Complete inferred bus route and boundary coverage review, then register the lazy
region in the study browser with map framing,
search, line isolation and all four languages. Reuse progressive day loading,
Now and share links. Extend the daily regional refresh and verified recovery path,
including the first deployment before a published Lausanne fallback exists.

Also resolve service-day versus civil-day rollover explicitly. The weekday
candidate's 00:00–02:00 chunk is empty under the existing importer: trips recorded
after 24:00 belong to their source service day, and preceding-day spillover is not
included. An empty chunk must not be presented as evidence that Lausanne has no
overnight service. Scheduled interpolation must remain distinct from live tracking.

Desktop and phone tests, exact chunk integrity, initial bundle budgets and a live
refresh/recovery check are required before calling the study launched.
