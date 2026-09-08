# Vaud expansion: first implementation

Started **8 September 2026**. The first deliverable is a reproducible civil-day
candidate audit and new MBC bus geometry. Lausanne's existing application study
remains the integration baseline. The Vaud candidate is not in the study selector
and is not ready for publication.

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
| Accepted geometry occurrences | 21,191 | 11,946 |
| Accepted occurrence coverage | 99.46% | 99.56% |

The remaining rejection is one directed platform pair at **Tolochenaz, La
Plantaz**, appearing in two patterns on each date. It accounts for 114 weekday
and 53 Sunday occurrences. The matcher did not supply a usable shape between
these two platform records; the audit keeps it unresolved. No snap or detour
threshold was relaxed.

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

The next integration slice should be **Lausanne–Morges–Bière–Cossonay**: review
the MBC paths and termini, then extend the existing study with those buses and
the full MBC railway. Audit the Cossonay funicular separately. Follow with
Nyon/NStCM, the Riviera, and North Vaud, using the per-operator reports to resolve
geometry before exposing each area. Broader TPC/MOB/TPF corridors and lake
services need their own boundary and geometry decisions.
