# Rebuilding Basel's bus and diversion geometry

The [Basel study audit](BASEL-STUDY.md) combines three explicit geometry sources: original BS line paths, the isolated FOT tram 19 branch, and an OSM bus fallback. Reviewed tram diversion corridors can additionally use the existing BS tram infrastructure. No timetable trips are dropped to raise geometry coverage.

## Bus cache preparation

Use Node 24 and the pinned pfaedle build / merged Swiss and border extract described in [PostBus road geometry](POSTBUS-ROAD-GEOMETRY.md). The recorded Basel run uses pfaedle `99f2cd466696ecc6bdb73b2b3bb9008557fcb84a`, its unmodified bus profile, Geofabrik Switzerland **2026-09-02**, and the retained OSM border extract downloaded **2026-09-08**. Binary, configuration, extract, input patterns and output hashes are recorded in each agency cache.

First generate the Tuesday and Sunday candidates using `audit-basel-study.mjs`, without a bus cache. A failed coverage gate still leaves complete candidate artifacts. Then prepare one road-matching feed for each operator:

```sh
node scripts/prepare-basel-road-feeds.mjs \
  --archive /path/swiss-gtfs.zip \
  --manifest /tmp/basel-tuesday/basel-local-day-manifest.json \
  --manifest /tmp/basel-sunday/basel-local-day-manifest.json \
  --output /tmp/basel-road-feeds

for agency in 823 37; do
  node scripts/match-postbus-roads.mjs \
    --pfaedle /path/pfaedle --config /path/pfaedle.cfg \
    --osm /path/postbus-roads.osm.pbf \
    --feed /tmp/basel-road-feeds/$agency \
    --output /tmp/basel-road-matched/$agency
done

node scripts/basel-road-geometry.mjs \
  --bvb /tmp/basel-road-matched/823 --blt /tmp/basel-road-matched/37 \
  --source 'Geofabrik Switzerland 2026-09-02 plus OSM border extract 2026-09-08; pfaedle 99f2cd466696ecc6bdb73b2b3bb9008557fcb84a' \
  --output /tmp/basel-road-cache.json
```

The preparation step verifies candidate chunk hashes, duplicate journey consistency and source route/agency labels against the timetable archive. It rejects mixed feed versions, duplicate service dates and conflicting platform records. Stop indexes are remapped while complete ordered calls remain intact. The matcher calendar uses the first date only; the synthetic union must never be used as the application timetable.

The two-date union contains **103 BVB patterns / 15 routes / 4,812 trips** and **123 BLT patterns / 22 routes / 3,528 trips**. These counts sum the two audit dates. The OSM-only match accepts **75,954/76,304 BVB movements (99.54%)** and **48,369/48,899 BLT movements (98.92%)**. Application coverage is measured again on each actual date after preserving accepted official paths.

The shared road importer requires completed `--no-trie -W` runs, verifies every relevant matcher-output hash, checks ordered platform identity and rejects explicitly logged fallback hops. It slices loops using monotone shape distance. Existing road guards remain **120 m** endpoint snap, network length no greater than **6×** direct distance or **1,500 m** (whichever is larger), and **5 m** simplification. These differ from the official line graph's regional detour rules and are recorded separately.

[`data/basel-road-cache.json`](../data/basel-road-cache.json) retains the two agency caches, including all accepted paths and rejected pattern segments. The data is derived from **OpenStreetMap contributors**, under **ODbL 1.0**; preserve [OSM attribution](https://www.openstreetmap.org/copyright) in a future published study. Candidate manifests carry the road provenance and delivered paths. The cache and paths are inferences, not operator-certified routes or live positions.

## Applying the cache without losing pattern identity

The fallback only fills `null` bus segments. Existing official/FOT paths and all timetable calls remain unchanged. The lookup hashes the **source route ID, entire ordered platform sequence and coordinates**, within the correct agency cache. Different full patterns may have different A→B paths; repeated pairs in a loop retain their own segment indexes. A moved stop, new route or changed pattern remains unmatched until rebuilt.

The audit reports movement-weighted coverage and unique directed route/platform pairs separately. A unique pair passes only when **every occurrence** matches across all patterns. The report's `pathIndex` is representative; it must not be used to replace a train's exact `pathSegments`. `roadFallback.issues` counts unresolved pattern segments on the selected date. The main remaining-pair inventory also retains the original official-line failure and any attempted tram-diversion match.

## Dated tram corridors

The [BVB construction notices](https://www.bvb.ch/de/aktuelle-informationen/baustelleninformationen/) establish the routes affected by the September works. [`basel-tram-diversions.json`](../data/basel-tram-diversions.json) lists explicit directed adjacent stop pairs for BVB **3, 6, 8** and BLT **17**, using intermediate calls from Swiss GTFS 20260905. Line 6's outbound route omits Markthalle; its return direction includes it. The policy applies **only to 8 and 13 September 2026**. Another date fails closed until reviewed, even if the notice's broader construction period includes it.

For an admitted pair whose normal line match fails, the adapter searches the existing BVB/BLT tram infrastructure. It admits no bus geometry or additional timetable operator and adds no connecting edges. Nearby source parts may compete within the original **5 m additional snap allowance**. The shortest accepted candidate wins; a separate urban bound of **2× direct distance or 600 m**, whichever is larger, rejects long returns around the city caused by missing source joins. This tighter rule followed inspection of the first route plots. The geometry remains undirected and the precise running track still needs review.

```sh
node scripts/audit-basel-study.mjs \
  --archive /path/swiss-gtfs.zip \
  --sources /tmp/basel-sources --rail-geometry /path/rail.xtf \
  --bus-cache data/basel-road-cache.json \
  --tram-diversions data/basel-tram-diversions.json \
  --date 2026-09-08 --output-directory /tmp/basel-combined --check
```

Repeat with Sunday and a separate output directory. Omit both fallback options to reproduce the official-line/FOT comparison, or omit only `--tram-diversions` to isolate the bus improvement. The `--snapshot` option reuses an existing timetable extraction while still verifying every source journey against GTFS. All candidate outputs remain outside `public/`.
