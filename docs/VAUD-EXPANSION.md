# Vaud expansion: first implementation

Started **8 September 2026**. The broader Vaud candidate remains an audit. The
application now extends the existing Lausanne study with complete
MBC rail and bus journeys through Morges, Bière, L’Isle and Cossonay, including the Cossonay funicular. This increment
is implemented locally; it has not been published.

## Lausanne–MBC application increment

The daily Lausanne builder now imports agencies **29, 764 and 344** independently
of the original rectangle. The new importer flag `--agencies` filters all selected
modes; existing `--local-agencies` keeps its bus/tram-only semantics. The supplement
uses worldwide display bounds and retains complete MBC journeys. Each chain is
checked against ordered source platforms and times, including the preceding
service day's offset. The merge replaces clipped MBC rail trips by source identity;
other Lausanne journeys remain unchanged. Replacement agency 7256 and lake services remain excluded.

The existing `lausanne-region` URL and lazy-loading flow remain in use. All four
languages identify Lausanne / Morges, with MBC and Bière in discovery/search copy.
The overview is widened for both railway branches. Search, line selection,
seeking, sharing and Now use the existing study machinery.

| Integrated study | Weekday | Sunday |
| --- | ---: | ---: |
| Journeys | 10,546 | 8,089 |
| Platforms | 1,457 | 1,387 |
| Named stops | 711 | 680 |
| MBC rail journeys | 106 | 76 |
| MBC bus journeys | 1,249 | 695 |
| MBC rail accepted geometry | 100% | 100% |
| MBC bus accepted geometry | 100% | 100% |
| Cossonay funicular journeys | 412 | 256 |
| Cossonay funicular accepted geometry | 100% | 100% |

All eight groups pass with **100% accepted geometry** on both dates: tl bus,
MBC bus, m1, m2, LEB, MBC rail, other rail and the Cossonay funicular. The largest
rail-platform projection remains 44.28 m; funicular projections are 5.31 m and
2.32 m. Funicular OSM provenance and acceptance are separate from FOT rail.

The [weekday](../data/lausanne-mbc-study-audit.json) and
[Sunday](../data/lausanne-mbc-study-sunday-audit.json) reports distinguish the
base rectangle, complete-agency supplement and actual combined bounds. The
[alignment review](assets/mbc-geometry-review.svg) was rendered and inspected:
largest bus snaps at Sévery, Aclens and La Sarraz; La Plantaz; Morges station;
Cossonay; both rail branches, Morges rail platforms, the complete funicular and its passing loop. It compares paths with
the retained OSM/FOT inputs, not independent operator evidence.
[Review provenance](../data/mbc-geometry-review.json) retains hashes and offsets.
The largest bus snap is 88.1 m, within the existing 120 m limit.

Artifacts carry `lausanneScopeVersion: 3`, complete-agency IDs and separate MBC
geometry/provenance. Recovery accepts complete legacy, MBC-only (v2), or MBC-plus-funicular (v3) sets,
rejects mixed versions/hashes/geometry reports, and checks MBC rail and buses
separately, with a full-coverage funicular requirement and matching source hashes. Legacy recovery retains its original date and coverage.

Fresh weekday and Sunday builds and both fourteen-file integrity checks passed.
The application build, bundle and architecture checks pass. Geometry, integration
and recovery tests cover the terminal loop, funicular directions, unchanged source
times and mixed-release rejection. No browser/device performance result is claimed
for this increment. Hosted verification is still outstanding for the new scope.

Reproduce the application artifacts:

```sh
node scripts/build-lausanne-day.mjs \
  --archive /path/swiss-gtfs.zip --rail /path/rail.xtf \
  --date 2026-09-08 --output-directory /tmp/lausanne-mbc
```

The same builder runs through `npm run data:regional:days`. For a detailed report,
add `--include-mbc` to `audit-lausanne-study.mjs` and supply the tl cache; both MBC
caches are included automatically. `--mbc-snapshot` can reuse a complete supplement
from the same feed/date. The standalone Vaud-wide audit below retains its broader
scope and failing geometry gate.

To regenerate the alignment review, use `scripts/review-mbc-geometry.mjs` with
`--matched`, `--cache`, `--graph`, `--rail`, `--archive`, `--manifest` and `--output`.
The graph is the retained pfaedle OSM graph; the manifest must be the expanded
Lausanne day. The source archive supplies MBC rail route identities.

## Scope and source identity

The discovery rectangle is **5.95–7.25° E, 46.18–47.00° N**. It deliberately
includes neighbouring cantons; it is neither a Vaud polygon nor the Mobilis tariff
boundary. The audit first inventories every extracted route, then applies an
explicit source-agency admission list for rail, métro and buses. It identifies
operators using `routes.txt` and original trip IDs, never displayed line numbers.
Replacement-bus agencies remain separate from their rail operators.

The candidate includes tl, LEB, MBC, NStCM/TPN, VMCV, TRAVYS, AVJ, TPC, MOB/MVR
CEV, and scoped SBB/BLS/TPF/PostAuto/RegionAlps services. Broad TPF and PostAuto
coverage in this rectangle still needs geographical review. Lake, funicular and
cableway modes are inventoried but deferred. MVR's separate Rochers-de-Naye
agency is outside this first admission list; TPC/MOB/CEV rail remains visible as
separate audit groups requiring mountain-corridor review.

Both sampled dates use official Swiss GTFS **feed 20260905**, including the
preceding service day's spillover. They preserve the source service date and
frequency identity. Boundary checks compare each retained platform sequence with
the ordered original `stop_times.txt` chain, including repeated stops. Journeys
whose cropped chain skips an intermediate call are excluded from the candidate,
preventing invented links across excursions outside the rectangle. Clipped
starts and ends are counted separately by route and still need review.

| Measure | Tuesday 8 September | Sunday 13 September |
| --- | ---: | ---: |
| All-mode extracted movements | 41,826 | 33,433 |
| Admitted candidate movements | 23,144 | 15,622 |
| Candidate platforms | 7,009 | 6,546 |
| Distinct stop names | 3,662 | 3,333 |
| Journeys excluded for interior clipping gaps | 524 | 432 |

These are bounded candidate counts, not canton-wide transport totals. The Sunday
sample includes Saturday-night movements; it is not a year-round service audit.

## MBC geometry implemented

MBC rail is agency **29**, its buses **764**, its Cossonay funicular **344**, and
its replacement buses **7256**. These identities are distinct in the source feed.
The new bus caches contain inferred OSM paths for complete ordered patterns,
keyed by route ID, platform IDs and coordinates. Time-only changes permit reuse;
unknown patterns remain unshaped.

The weekday cache alone covered only **78.74%** of Sunday's MBC movements. A
second matching pass for Sunday's patterns resolves that calendar-dependent gap.

| MBC bus measure | Weekday | Sunday |
| --- | ---: | ---: |
| Trips | 1,249 | 695 |
| Stop-to-stop movement occurrences | 21,305 | 11,999 |
| Accepted geometry occurrences | 21,305 | 11,999 |
| Accepted occurrence coverage | 100% | 100% |

The La Plantaz rejection is now repaired. pfaedle assigned the arrival and
departure poles the same shape distance, dropping the intervening turnaround.
[OSM relation 2461243](https://www.openstreetmap.org/relation/2461243) explicitly
orders the approach, complete roundabout and return along Chemin des Plantées.
The retained source yields a **451.9 m** loop with an **8.14 m** maximum platform
connector, replacing 114 weekday / 53 Sunday unshaped occurrences. Both source
platform calls and their one-minute separation remain unchanged. The normal
snap and detour limits remain in force; no direct shortcut was substituted.

The [retained OSM source](../data/vaud-sources/mbc-terminal-funicular-osm.json)
contains ordered ways, nodes, query timestamps and hashes. The same source
separately retains the Cossonay funicular's eleven track ways, including its
passing loop. Track choice through that loop is inferred; these are scheduled
movements, not observed vehicle positions.

Reapply the idempotent terminal correction after a fresh matcher import:

```sh
node scripts/repair-mbc-road-caches.mjs data/vaud-mbc-road-cache.json /path/weekday-matched/patterns.json
node scripts/repair-mbc-road-caches.mjs data/vaud-mbc-sunday-road-cache.json /path/sunday-matched/patterns.json
```

The repair checks the original matcher pattern hash, exact route/platform IDs,
ordered road connectivity, roundabout direction, closed loop, and the original
rejection. Its provenance is additive; original matcher hashes stay intact.

The retained caches are [weekday](../data/vaud-mbc-road-cache.json) and
[Sunday](../data/vaud-mbc-sunday-road-cache.json). They use the existing pinned
pfaedle pipeline and retained Geofabrik Switzerland 2026-09-02 plus OSM border
extract 2026-09-08. Each cache includes hashes of the matcher binary, configuration,
OSM input, pattern index, logs and output files, plus rejected segments. These
OSM-derived databases carry **ODbL 1.0** and OpenStreetMap attribution. Automated
acceptance is not visual or operator verification.

## Wider geometry and publication gate

The audit reuses the corrected Lausanne FOT matcher for m1/m2, LEB and MBC rail.
Other rail uses the existing national matcher as a measured baseline. The tl and
PostAuto road caches are also checked against exact patterns. Results are split
by source operator and mode, with m1/m2 separate. Each group reports both
occurrence coverage and unique directed route/platform-pair coverage.

The wider candidate fails the unchanged **95% occurrence-coverage gate per
present group**. Rail endpoint gaps remain on SBB/BLS, TPC, TPF, MOB/MVR, NStCM
and TRAVYS. Several new bus operators and replacement services have no matched
patterns yet. A large tl fleet cannot hide those failures. Missing scheduled
operators, clipped boundaries and visual review are separate scope checks;
passing the geometry gate alone would not establish complete coverage.

Both candidates fit the existing **650 KiB manifest, 1,600 KiB morning and
450 KiB movement-chunk** gzip limits. These are measurements with the current,
incomplete geometry. Adding more paths may increase the topology payload. The
builder independently checks twelve contiguous two-hour chunks, hashes, exact
byte lengths, path/stop references, unique day totals and identical journeys
across overlapping chunks, plus each morning snapshot.

With Node 24.20.0, weekday sizes are **428.2 / 778.0 / 351.9 KiB**
(manifest / morning / largest chunk); Sunday sizes are **364.4 / 543.9 /
224.4 KiB**. Both fourteen-file sets were read back and independently validated.
The full unit suite passed **333 tests**, including four Vaud admission,
boundary, geometry-accounting and artifact-integrity tests. No application UI
was added or browser performance claim made in this increment.

Full retained reports:
[weekday](../data/vaud-study-audit.json) and
[Sunday](../data/vaud-study-sunday-audit.json).
They contain admitted/deferred/excluded route inventories, clipping counts,
per-group failures, input hashes and compressed sizes. Candidate runtime files
are generated outside `public/`; `--check` deliberately exits nonzero while the
geometry gate fails.

## Official geometry source findings

Checked on 8 September 2026:

- The [cantonal transport dataset](https://viageo.ch/md/599d9cd5-1218-4372-8783-43cd5c5bc4dc)
  lists rail, road and regional lake lines, with an annual update and a data date
  of 6 March 2026. It offers MN95 shapefiles through a paid ordering process and
  lists WMS consultation services. Its stops represent commercial-stop centres,
  not individual platform poles. An unattended reusable vector download was not
  established. No order was placed.
- [Nyon's catalogue](https://viageo.ch/md/120d3f42-41b2-45f2-a092-60754def5e7d)
  identifies bus routes and stops plus CFF/NStCM infrastructure. The indexed
  description distinguishes actual bus paths from presentation layers; archive
  access, terms and directional completeness still need verification.
- [Cartoriviera](https://viageo.ch/catalogue/donnee/200401) identifies VMCV bus and
  CFF/MVR/Blonay-Chamby/GoldenPass rail layers. This is source-presence evidence,
  not a validated download or a timetable-to-shape join.
- [Mobilis](https://www.mobilis-vaud.ch/en/a-propos/) is the operator/network
  reference for refining regional coverage. Its tariff geography must not be
  inferred from the rectangular crop or agency membership alone.

Timetables use the [official Swiss GTFS](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020);
rail uses the [FOT infrastructure dataset](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz).

## Reproduce and continue

Use Node 24 and retained official source files:

```sh
npm run data:vaud:audit -- \
  --archive /path/swiss-gtfs.zip --rail /path/rail.xtf \
  --date 2026-09-08 --output-directory /tmp/vaud-weekday \
  --prepare-bus-feed --check

npm run data:vaud:audit -- \
  --archive /path/swiss-gtfs.zip --rail /path/rail.xtf \
  --date 2026-09-13 --output-directory /tmp/vaud-sunday \
  --prepare-bus-feed --check
```

`--snapshot` reuses an all-mode civil-day extract for the same feed, date and
rectangle. `--bus-caches` supplies a comma-separated ordered list of retained
caches; the first usable exact pattern wins. Missing patterns try the next cache.
The default list includes both MBC samples, Lausanne and nationwide PostAuto.

`--prepare-bus-feed` writes one matcher feed per source agency. Overnight pattern
times are shifted into a nonnegative working day for pfaedle only; candidate
journey times are unchanged. To reproduce MBC geometry, run the pinned matcher
from [the road-geometry guide](POSTBUS-ROAD-GEOMETRY.md):

```sh
node scripts/match-postbus-roads.mjs \
  --pfaedle /path/pfaedle --config /path/pfaedle.cfg \
  --osm /path/postbus-roads.osm.pbf \
  --feed /tmp/vaud-weekday/bus-feeds/764 --output /tmp/vaud-mbc-matched
```

Import the result with `importRoadShapes` from `enrich-postbus-roads.mjs`, recording
the actual source/extract dates, and write it to the weekday cache. Repeat using
the Sunday feed for the Sunday cache. Re-run both audits after cache changes.

The **Lausanne–Morges–Bière–Cossonay** slice is now implemented above.
The Cossonay funicular is now included. Continue with
Nyon/NStCM, the Riviera, and North Vaud, using the per-operator reports to resolve
geometry before exposing each area. Broader TPC/MOB/TPF corridors and lake
services need their own boundary and geometry decisions.

## Nyon/NStCM: integrated dated operator study

The [complete-journey audit](../data/nyon-region/audit.json) now covers all active
NStCM (66), TPN (738) and Bus Nyon-Prangins (741) journeys on both dates. Every
ordered source platform and arrival/departure time is checked against GTFS,
including preceding-day spillover. The full operator extracts contain the same
955 weekday / 421 Sunday journeys as the original rectangle; no cropping is
used for these new artifacts.

| Operator | Weekday trips | Sunday trips | Geometry, both days |
| --- | ---: | ---: | ---: |
| NStCM rail | 117 | 57 | 100% |
| TPN regional buses | 447 | 255 | 100% |
| Nyon-Prangins urban buses | 391 | 109 | 100% |

The incomplete Swiss/border road extract caused the former Divonne/Gex matcher
fallbacks. A retained Overpass road extract closes those gaps. The remaining
Terre-Bonne issue selected a similarly named station 160.9 m away. Tightening
bus station candidates from 200 m to 50 m and snap search from 100 m to 60 m
resolves it. The importer still uses its original 120 m endpoint and detour
limits. Maximum regional-bus snap is now 43.76 m; the unchanged urban cache has
77.49 m maximum snap. No rejected segment was silently converted to a line.

The [source record](../data/vaud-sources/nyon-road-source.json) retains the query,
OSM base timestamp, compressed and original hashes, and exact matcher config.
The [weekday review](assets/nyon-geometry-review.svg) and
[Sunday review](assets/nyon-sunday-geometry-review.svg) were rendered and inspected
at Divonne, the border, Gex school services, Terre-Bonne, route du Stand, Nyon
station and the complete NStCM corridor. It compares against retained OSM/FOT
sources; it is not independent operator confirmation.

The focused Nyon/MBC/road test run passed 20 tests. Both dated fourteen-file
sets passed independent read-back checks.

NStCM is isolated by the FOT La Cure anchor and verified to reach underground
Nyon while excluding the adjacent SBB mainline. The two dated candidate sets
include twelve two-hour chunks, a manifest and a morning snapshot. Artifact
checks cover content hashes, exact byte lengths, valid stop/path references,
consistent duplicated journeys between chunks and complete directed geometry.

The application now offers **Nyon · lake to Jura** (`?study=nyon-region`) in
study discovery and desktop/mobile selectors. It defaults to the full civil day,
with morning playback, station and service search, dated sharing, local map
framing, retry controls and English, German, French and Italian copy. The operator
scope and actual timetable date remain visible. This study excludes SBB mainline,
PostAuto and lake services; it does not claim all transport in the Nyon district.

`build-nyon-day.mjs` publishes the reviewed 2026-09-08 fixture (955 journeys).
The Sunday fixture, 2026-09-13 (421 journeys), passes the same release checks.
Release validation compares the exact topology, complete journeys and morning
subset against the retained audit and canonical files. Chunks retain their
content hashes. New unreviewed dates or failed builds recover a verified published
study with its original date. A missing first-deployment manifest can bootstrap
from the complete local fixture; missing published chunks fail without mixing data.

Focused integration tests cover both dates, altered calls and paths, mixed source
hashes, corrupt chunks, dated recovery and discovery/share links. Browser interaction
and visual app verification remain unperformed in this pass. The next geographic
expansion is the Riviera, followed by North Vaud; operator geometry review still
gates those additions.

Reproduce with Node 24:

```sh
# Extract each date with ingest-gtfs.mjs --civil-day --modes rail,bus
# --agencies 66,738,741 --bounds -180,-90,180,90 and a full 00:00–24:00 window.
node scripts/build-nyon-study.mjs ARCHIVE RAIL COMPLETE_WEEKDAY COMPLETE_SUNDAY data/nyon-region
node scripts/check-nyon-study.mjs data/nyon-region
node scripts/build-nyon-day.mjs
# Optional Sunday release to an isolated output:
node scripts/build-nyon-day.mjs --date 2026-09-13 --output /tmp/nyon-sunday-release
```

`prepare-nyon-road-feeds.mjs ARCHIVE VAUD_MANIFEST OUTPUT` produces matcher feeds.
For agency 738, decompress the retained Nyon OSM extract and use
`data/vaud-sources/nyon-pfaedle.cfg` with the pinned matcher. Reimport both dates
with `importRoadShapes`; original output hashes and warnings remain in each cache.
`audit-nyon-geometry.mjs` remains the rectangular replay for comparison; the
complete source-chain and artifact checks are in the new builder and checker.
