# Lausanne regional study

Lausanne is implemented as a lazy full-day study with m1/m2, tl buses, LEB and
regional rail, search and line selection, Now, share links and four languages.
The daily regional publication builder and verified recovery include it.
The weekday and Sunday civil-day audits and bus alignment review are complete.
Hosted verification is recorded separately below.

## Scope and audited timetables

The study covers longitude 6.45–6.85 and latitude 46.48–46.71: Lausanne, Renens,
Morges and the LEB corridor to Bercher. It is not complete Vaud or Mobilis
coverage. Local buses are restricted to tl agency `151`; LEB is agency `55`.
A [boundary comparison](../data/lausanne-bus-boundary-review.json) against the
original GTFS stop sequences confirms that all 6,866 weekday and 5,470 Sunday tl
bus trips retain their complete source platform sequence. Rail journeys can
continue outside the crop. Lake services and the Cossonay
funicular are excluded and require separate geometry work.

Both civil days use official Swiss GTFS feed `20260905`:

| Group | Tuesday 8 September | Sunday 13 September | Accepted geometry, both days |
| --- | ---: | ---: | ---: |
| tl buses | 6,866 | 5,470 | 100% |
| m1 | 339 | 224 | 100% |
| m2 | 763 | 525 | 100% |
| LEB | 147 | 88 | 100% |
| Other rail | 733 | 794 | 100% |
| **Total trips** | **8,848** | **7,101** | **100%** |

The weekday has 1,077 platform records and 506 named stops; Sunday has 1,031
platform records and 487 named stops. Geometry percentages count scheduled
stop-to-stop occurrences. They are measured against source geometry and the
matcher limits, not independent operator verification.

The 00:00–02:00 blocks contain **315 weekday trips** and **354 Sunday trips**.
Sunday also has 45 trips in 02:00–04:00. The importer evaluates each preceding
service day's calendar and exceptions independently, including Saturday's
services after midnight on Sunday. It retains source trip IDs and service dates,
negative crossing times and frequency phases. Trips starting exactly at the next
midnight are excluded; journeys already in progress retain their complete times.

`--civil-day` is opt-in. Other studies keep their existing service-day imports.
Feeds must cover both dates; times at or above 48:00 fail rather than silently
omit older spillover. A feed lacking the preceding date at annual rollover also
fails validation. The publication keeps its previous release if generation fails.

The current reports are [weekday](../data/lausanne-civil-day-audit.json) and
[Sunday](../data/lausanne-sunday-civil-day-audit.json). They retain source hashes,
per-group counts, platform projection evidence and chunk sizes. The earlier
[weekday](../data/lausanne-study-audit.json) and
[Sunday](../data/lausanne-study-sunday-audit.json) reports are historical
service-day audits and should not be used as current civil-day totals.

## Bus geometry closure

The cache now covers **210 distinct route/platform patterns** across both civil
days and 44 tl lines, including N1–N6. All seven previously missing weekday
patterns and the sampled Sunday's missing patterns are present. The combined
cache accepts **206,487 of 206,487** bus segment occurrences, with no rejected
pattern segments. Updating the weekday geometry preserved every journey ID,
source identity, stop coordinate and stop time.

The retained [road cache](../data/lausanne-road-cache.json) uses pfaedle commit
`99f2cd466696ecc6bdb73b2b3bb9008557fcb84a`, Geofabrik Switzerland 2026-09-02
and the retained OSM border extract dated 2026-09-08. The run took four seconds.
Its metadata records the matcher, configuration, extract, inputs and output hashes,
as well as both civil dates and all four source service dates. The routing-only
union shifts negative trip times by a whole day so pfaedle receives valid GTFS;
these synthetic routing times never replace the passenger timetable.

The [bus alignment review](assets/lausanne-bus-review.svg) overlays inferred
paths and timetable platforms on the OSM routing graph for the largest gaps,
Renens station, Flon/Bel-Air, Saint-François, Croisettes and night line N2 at
Vers-chez-les-Blanc. Direction arrows show the ordered paths. The reviewed
[junctions and largest platform gaps](../data/lausanne-bus-review.json) are retained
with source hashes. Review found continuous source-road alignments and the
expected separate approaches/turning paths in these samples.

Three large connectors remain explicit: Gymnase de Beaulieu **116.6 m**,
Port-Franc **112.5 m**, and Champ-Rond **103.2 m**. They are timetable-platform to
matched-road connectors, not surveyed bus tracks. They meet the unchanged **120 m**
limit. No limit was relaxed and no platform was relocated to conceal a gap.
The inference and these limitations remain documented; visual review against the
same OSM source is not an independent official route survey.

The database is attributed to [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
under **ODbL 1.0**, including a visible phone attribution link. Cache reuse
requires exact route identity, ordered platform IDs and coordinates. Changed
patterns remain unshaped, and coverage below 95% in any group blocks publication.
This two-day sample does not promise complete coverage of every future calendar.

## Rail and métro geometry

The separate Lausanne matcher selects FOT corridors by operator and stable
operating-point identities: m2 at Flon `8519589`, m1 between Flon `8519588` and
Renens `8501118`, LEB at Flon `8519590`, MBC at La Gottaz `8501054`, and mainline
rail at Lausanne `8501120`, excluding the m1 corridor. Projected platforms split
source edges before shortest-path routing. This avoids collapsing métro stations
onto neighbouring nodes or selecting the wrong railway at shared interchanges.

The largest rail snap is **44.28 m**. Rail limits remain 120 m for projection and
the greater of 3 km or 4.5 times direct distance for a detour. Missing anchors,
disconnected corridors and coincident projections fail or remain unshaped.
The [rail review](assets/lausanne-rail-review.svg) and source regression fixture
cover m2 Délices/Grancy, m1 Renens, LEB Les Ripes/Etagnières and MBC Morges/La Gottaz.
All four rail/métro groups pass on both civil days.

## Reproduce

Use Node 24 and retain the official [Swiss GTFS](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020)
and [FOT infrastructure](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz)
locally. Build a dated application artifact set:

```sh
node scripts/build-lausanne-day.mjs \
  --archive /path/swiss-gtfs.zip --rail /path/rail.xtf \
  --date 2026-09-13 --output-directory /tmp/lausanne-sunday
```

For a report and candidate, use `scripts/audit-lausanne-study.mjs` with the same
inputs, `--bus-cache data/lausanne-road-cache.json`, an output outside `public/`,
and `--check`. Both builders accept `--snapshot` for a previously extracted civil
day with the same feed/date. Rail is simplified to 10 metres before matching.

Rebuild the routing union from civil-day snapshots or manifests:

```sh
node scripts/prepare-lausanne-road-feed.mjs \
  --snapshot /path/weekday-manifest.json --snapshot /path/sunday-manifest.json \
  --output /tmp/lausanne-bus-feed
node scripts/match-postbus-roads.mjs \
  --pfaedle /path/pfaedle --config /path/pfaedle.cfg --osm /path/roads.osm.pbf \
  --feed /tmp/lausanne-bus-feed --output /tmp/lausanne-matched
```

Import with `importRoadShapes` from `scripts/enrich-postbus-roads.mjs`, preserving
the actual dated source description and audited dates. The pinned routing setup
is described in [POSTBUS-ROAD-GEOMETRY.md](POSTBUS-ROAD-GEOMETRY.md).
To regenerate the visual review, produce a routing graph with pfaedle's
`--write-graph -d /tmp/graph` against the same feed/config/extract, then run:

```sh
node scripts/review-lausanne-bus-geometry.mjs \
  --matched /tmp/lausanne-matched --cache data/lausanne-road-cache.json \
  --graph /tmp/graph/graph.json --output /tmp/lausanne-review
```

## Publication and verification

The regional builder validates each complete fourteen-file set before replacing
outputs. Both civil-day sets pass twelve-chunk coverage, SHA-256/byte checks,
unique trip counts, stop/path indices and the unchanged gzip budgets (650 KiB
manifest, 450 KiB chunk, 1,600 KiB morning). The largest weekday/Sunday chunks are
112.1/85.4 KiB. Morning remains 06:45–08:45; Lausanne defaults to the full day.

Recovery retains published service dates. Only a missing Lausanne manifest (404)
allows the first deployment to use a complete validated committed fixture;
a missing chunk in an already published study fails recovery without mixing data.
Desktop Chromium and iPhone WebKit checks cover lazy entry, search, full-day
station labels, sharing, overnight Now, chunk retry, languages and attribution.
The data checks include calendar exceptions, feed boundaries, frequency identity,
and unchanged routing-pattern identity when normalizing negative times.

To repeat the bus boundary comparison against extracted civil-day snapshots:

```sh
node scripts/audit-lausanne-bus-boundaries.mjs \
  --archive /path/swiss-gtfs.zip --weekday /path/weekday-raw.json \
  --sunday /path/sunday-raw.json --output /tmp/boundary-review.json
```
