# Lausanne regional study: kickoff audit

The first Lausanne milestone is a reproducible full-day timetable and geometry
candidate. It is **not yet a published study**. The audit found enough timetable
coverage and ample payload headroom, but the existing rail matcher needs local
station corrections before the métro can be presented credibly.

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

## Measured weekday baseline

Swiss GTFS feed `20260905`, service date **2026-09-08**, Node **24.20.0**:

| Group | Trips | Source routes | Indexed geometry | Geometry with endpoints within 120 m |
| --- | ---: | ---: | ---: | ---: |
| tl buses | 6,624 | 38 | 100% | 100% |
| m1 | 328 | 1 | 100% | 92.7% |
| m2 | 749 | 1 | 68.8% | 62.4% |
| LEB (R20) | 141 | 1 | 100% | 81.1% |
| Other rail | 702 | 20 | 98.3% | 92.6% |

The candidate retains **8,544 trips**, 1,074 platform records and 506 distinct
stop names. The initial all-mode extract contained 8,951 trips; 400 funicular and
7 lake-service trips are outside the first study's scope.

Geometry percentages count scheduled stop-to-stop occurrences, not route count.
An indexed rail path does not establish correct station matching. The separate
120 m endpoint check is a proposed Lausanne acceptance check, not an official
accuracy specification or proof that a route follows the correct track.

The candidate has 12 two-hour chunks. Gzip measurements are **71.9 KiB** for the
manifest, **175.6 KiB** for the morning snapshot and **105.2 KiB** for the largest
movement chunk. These fit the existing regional limits of 650/1,600/450 KiB.
These are data-only measurements; application transfer and rendering performance
remain to be checked after UI integration. No budget ceiling has changed.

The machine-readable baseline, input hashes, every failed directed platform pair,
and per-chunk measurements are in
[`data/lausanne-study-audit.json`](../data/lausanne-study-audit.json).

The same feed was also audited for **Sunday 2026-09-13**: 6,740 candidate trips,
including 5,193 tl buses, 213 m1 trips, 505 m2 trips, 79 LEB trips and 750 other
rail trips. The weekday road cache covers **97.5%** of Sunday bus movements;
unknown patterns remain explicitly unshaped. All four rail/métro groups still
fail the endpoint-aware geometry gate. The largest Sunday chunk is 79.8 KiB
gzip. See [`data/lausanne-study-sunday-audit.json`](../data/lausanne-study-sunday-audit.json).
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

## Geometry work identified

1. **m2 at Flon:** the generic nearest-station resolver selects the nearby LEB
   node. Resolve the m2-specific infrastructure before routing through the hub.
2. **m2 Délices and Grancy:** these stops lie between FOT nodes; the current
   resolver snaps them to Jordils and Gare respectively. Split/project onto the
   correct m2 alignment instead of collapsing movements or drawing long chords.
3. **Station endpoints:** inspect m1 at Renens (128.8 m gap), LEB at Les Ripes
   (137.6 m) and Etagnières (308.1 m), plus Morges, Chavornay and Puidoux rail
   endpoints. A nearby infrastructure reference point can explain a gap; do not
   simply loosen the threshold and count it as reviewed.
4. **Morges–La Gottaz:** the generic rail matcher leaves 68 weekday R56 movements
   without a path. Resolve the correct local rail alignment independently of the
   mainline station.

The proposed technical gate requires at least 95% accepted geometry in **each**
of the five groups. A large bus fleet cannot conceal an incomplete métro. The
weekday candidate currently fails this gate. The audit still writes its report
and candidate so the failures can be inspected; `--check` returns a failing exit
status for the technical gate. Passing that gate alone is not publication approval.

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

Verification for this kickoff: 29 focused tests passed across the Lausanne audit,
existing road matching, GTFS importer and regional refresh/chunk suites. Both
generated candidate days were independently checked for contiguous 24-hour
coverage, exact byte counts and SHA-256 hashes, valid references, identical
overlapping trips and unique day totals. This validates the candidate files;
it does not clear the reported geometry or publication gates.

## Following implementation slice

Correct and visually review the rail/métro matches, check weekend and boundary
coverage, then register the lazy region in the study browser with map framing,
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
