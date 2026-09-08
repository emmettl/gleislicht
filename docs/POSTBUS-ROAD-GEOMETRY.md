# PostBus road geometry

The PA view now animates the nationwide timetable along inferred OpenStreetMap roads. The Swiss GTFS feed does not include shapes; [the platform's GTFS cookbook](https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/#shapestxt) recommends [pfaedle](https://github.com/ad-freiburg/pfaedle) for generating them. Matching runs offline. The application never calls a routing service.

## Result and limits

For Swiss GTFS 20260902, service day 2026-09-08:

| Measure | Result |
| --- | ---: |
| Source routes / daily trips retained | 821 / 32,390 |
| Distinct ordered route/platform patterns | 5,208 |
| Patterns with every segment matched | 5,044 |
| Routes with every movement matched | 762 |
| Scheduled segment occurrences with road geometry | 485,872 / 486,882 (99.79%) |
| Shared paths / vertices at 5 m simplification | 24,472 / 285,938 |
| Topology edges with a representative road path | 23,430 / 24,789 |
| Road-enriched topology, gzip | 2,190,122 bytes (2.09 MiB) |
| Largest movement chunk, gzip | 758,453 bytes (741 KiB) |
| National matching time, this Mac | 23 seconds, after preparing the extract |

Coverage is weighted by actual scheduled stop-to-stop movements, not the percentage of source routes or the percentage of all topology edges. The importer includes some platform/edge records absent from the active day's trips; these have no inferred path assigned through the active patterns. A topology edge uses its most frequent accepted path, while moving buses and selected journeys retain their exact pattern's geometry.

All routes and trips remain present. Rejected and unknown segments retain the existing stop-based/lake-avoidance fallback. Their roads are not counted as matched. Paths are plausible OSM inferences, not operator-verified routes. The timetable cannot distinguish two journeys that have the same route identity and ordered platforms but secretly take different roads between those stops. Timings remain scheduled interpolation, including coarse minute resolution; this is not GPS tracking or a realistic acceleration model.

The cache's `report.issues` contains every rejected pattern segment, its route and stop identifiers, reason, and number of daily occurrences. Current rejected occurrences:

| Reason | Occurrences |
| --- | ---: |
| Road match more than 120 m from a platform | 560 |
| Missing or zero-length shape-distance interval | 339 |
| Excessive detour for automatic acceptance | 91 |
| Explicit pfaedle routing failure | 20 |

The detour guard deliberately leaves some possible Alpine routes unresolved: Cavaione–Brusio is one example. The explicit routing failures are on Flims–Conn and Ferden mountain services. Tightening OSM bus-access data or reviewing specific routes is preferable to globally loosening the guards. A valid shape does not itself prove that every bus restriction or temporary diversion is represented correctly.

## Pilot and verification

The deterministic 30-route sample includes Kiental, the busiest service, Italian termini and geographically distributed routes. It covers 246 patterns and 1,188 daily trips. The Swiss extract alone yielded 97.95% accepted movement coverage. Adding cross-border roads raised this to 99.68%; it also corrected some near-border snapping choices inside Switzerland. All 30 route shapes were visually inspected before the national result was accepted.

Kiental's full 19-stop Reichenbach–Griesalp run has no rejected segments. Compared with the existing OSRM terrain trace, 95% of its new vertices are within 6.4 m of that reference and the maximum deviation is 20.1 m. The polyline length is about 14.04 km versus the existing 13.87 km routing distance, including platform connectors and different simplification. This is a useful independent pipeline check, not an operator survey: both paths ultimately derive from OSM.

Eight focused unit/integration tests cover route-number collisions, moved platforms, timetable reuse, reverse sequences, loops, hairpin preservation, bad snapping/detours, explicit matcher failures, fallback handling, and exact chunk hashes. Desktop Chromium and iPhone-profile WebKit checks cover loading, road attribution, searching, day jumps, overnight emptiness and missing/corrupt data. The complete 104-test suite, application build, data validation and initial transfer budget pass.

On the Apple M4 Max at 1280×720 with ANGLE Metal, the paired PostBus measurements were 56.3 FPS before and 55.9 FPS after, with 16.8 ms p95 frame intervals. Approximate JS heap grew from 91 MB to 115 MB and the local transition from 212 ms to 269 ms. iPhone-profile WebKit on the same Mac measured about 60 FPS and a 0.8 s transition. These are local measurements, not physical-device or cellular tests.

**Software rendering is a real limitation:** an isolated SwiftShader run measured 4.9 FPS for the road-enriched PostBus view versus 13.7 FPS for the rail opening. The many static road vertices are materially heavier for a software renderer. Hardware-backed rendering needed no fleet reduction or renderer replacement. Future work for machines without usable WebGL acceleration should investigate geometry detail levels; cold network transfer and lower-end physical devices also remain to be measured.

## Regular timetable refresh

```sh
npm run data:postbus:national -- --archive /path/swiss-gtfs.zip --date YYYY-MM-DD
npm run data:postbus:roads
node scripts/audit-postbus.mjs
```

Both refresh workflows apply the committed `data/postbus-road-cache.json` after timetable generation. A cache key hashes the source route ID, complete ordered platform IDs and coordinates. Changed timetable times can reuse it; changed coordinates, directions, stop sequences or route identities cannot. No join is made solely on the displayed line number or a global stop pair. New patterns remain unshaped until rebuilt. An aggregate coverage gate of 95% fails before any enriched artifacts are written, so a stale cache cannot silently publish a heavily degraded road view.

The audit also checks path references and endpoints, coverage counts, ODbL provenance, 500,000 maximum vertices, topology under 3 MiB gzip and each movement chunk under 1 MiB gzip. Chunk sizes and hashes are recalculated from the exact enriched bytes; the manifest is replaced last.

## Rebuild the road cache

Keep raw extracts and build tools outside the checkout. The recorded matcher is pfaedle commit `99f2cd466696ecc6bdb73b2b3bb9008557fcb84a` with its unmodified `pfaedle.cfg` bus profile. It uses bus route relations, bus/PSV access and direction tags, and supported turn restrictions. Build it with CMake and a C++ compiler, or use an equivalently pinned container. `pyosmium` is needed only for merging extracts, not application or timetable builds.

```sh
git clone --recurse-submodules https://github.com/ad-freiburg/pfaedle.git /tmp/postbus-pfaedle
git -C /tmp/postbus-pfaedle checkout 99f2cd466696ecc6bdb73b2b3bb9008557fcb84a
git -C /tmp/postbus-pfaedle submodule update --init --recursive
cmake -S /tmp/postbus-pfaedle -B /tmp/postbus-pfaedle/build \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_POLICY_VERSION_MINIMUM=3.5
cmake --build /tmp/postbus-pfaedle/build --target pfaedle -j 8

# Select --pilot 30 for the first sample; omit it for the complete day.
npm run data:postbus:roads:prepare -- --output /tmp/postbus-feed
curl -fL https://download.geofabrik.de/europe/switzerland-260902.osm.pbf \
  -o /tmp/switzerland.osm.pbf
/tmp/postbus-pfaedle/build/pfaedle -m bus \
  -c /tmp/postbus-pfaedle/pfaedle.cfg -i /tmp/postbus-feed \
  -x /tmp/switzerland.osm.pbf -X /tmp/swiss-bus-roads.osm

# Border supplement: store its actual OSM timestamp alongside the downloaded file.
curl -fL --data-urlencode data@scripts/postbus-border-roads.overpass \
  https://overpass-api.de/api/interpreter -o /tmp/postbus-border.osm
python3 scripts/merge-postbus-osm.py --switzerland /tmp/swiss-bus-roads.osm \
  --border /tmp/postbus-border.osm --output /tmp/postbus-roads.osm.pbf

npm run data:postbus:roads:match -- \
  --pfaedle /tmp/postbus-pfaedle/build/pfaedle \
  --config /tmp/postbus-pfaedle/pfaedle.cfg \
  --osm /tmp/postbus-roads.osm.pbf --feed /tmp/postbus-feed \
  --output /tmp/postbus-matched
node scripts/enrich-postbus-roads.mjs --import /tmp/postbus-matched \
  --source 'Geofabrik Switzerland 2026-09-02 plus OSM border extract YYYY-MM-DD; pfaedle 99f2cd466696ecc6bdb73b2b3bb9008557fcb84a'
npm run data:postbus:roads
node scripts/audit-postbus.mjs
```

The Swiss PBF is about 545 MB; the border XML can be several hundred MB because complete route relations are retained. The combined filtered PBF used for the recorded result is about 76 MiB. These are offline preparation costs and none of these raw extracts ships to the browser. The border query covers the current day's Italian, Austrian, German and French gaps; newly introduced cross-border branches should trigger a fresh boundary review. The original run used Geofabrik's 2026-09-02 Swiss extract and an Overpass extract downloaded 2026-09-08. A later Overpass response may produce different results; output provenance records content hashes rather than pretending that the live query is immutable.

`match-postbus-roads.mjs` always enables `--no-trie -W`. This makes pfaedle report fallback hops for every individual pattern instead of only one representative of a group. The importer requires a completed run record and verifies hashes of the pattern index, logs, trips, stop times and shapes. It rejects explicit fallback hops even when pfaedle writes a straight-line shape for them. Loop slicing uses monotone `shape_dist_traveled`, never an ambiguous nearest-point search. Endpoints connect to the exact timetable platforms, and simplification preserves segment endpoints at 5 m tolerance.

The shared cache, including rejected-segment audit and input hashes, is committed for reproducible timetable application. The generated geometry is an OpenStreetMap-derived database under **ODbL 1.0**. Its attribution appears in the PA footer and metadata; the public manifest contains the delivered path database. Raw source files and the matcher binary remain local build inputs.
