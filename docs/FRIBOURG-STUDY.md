# Fribourg / Freiburg cantonal source study

Fixture audit: **8 September 2026**. Starting point: [Swiss transit source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#fr).

The entire canton is inventoried against the pinned annual national GTFS: **207 route records, 17 agency identities and all seven districts**, including detached territories and complete out-of-canton journeys. The regional feed admits **4,658 Friday journeys and 2,908 Sunday journeys** with complete directed stop patterns from cantonal lines and explicitly tagged inferred OSM road fallback. This is partial geometry admission, not full service coverage. One route is a provisional geographic member because its sole in-canton platform is within a metre of the boundary; see below.

The [regional feed index](../data/fribourg-region/index.json) points to both civil-day manifests, twelve two-hour chunks per date, and 06:45–08:45 extracts. It uses the existing network snapshot format, **not a new GTFS ZIP**. It is saved under `data/` as a **local archival research artifact**. The exact matching cantonal OGD service explicitly permits attributed vector redistribution. Geometry vintage and physical direction remain unverified; this archival study is not added to public hosting or the application's study selector.

## Deliverables and scope

- [Every admitted, partly admitted, excluded and inactive route](FRIBOURG-ROUTE-INVENTORY.md); [machine-readable routes](../data/fribourg-audit/routes.json).
- [Source feature inventory](../data/fribourg-audit/source-lines.json): all 128 records, raw timetable fields, operator/line interpretation, source geometry size, candidate routes and routes retaining at least one admitted official segment.
- [Friday directed-pattern and pair audit](../data/fribourg-audit/2026-09-04.json), [Sunday audit](../data/fribourg-audit/2026-09-06.json), [summary](../data/fribourg-audit/summary.json), [in-canton stop records](../data/fribourg-audit/stops.json).
- [Acquisition evidence](../data/fribourg-sources/acquisition.json), [source dates/credits/terms](../data/fribourg-sources/sources.json), [reviewed mapping policy](../data/fribourg-policy.json).

Every annual trip with at least one original GTFS call coordinate inside the unsimplified swissBOUNDARIES3D Fribourg polygon contributes to membership. No operator whitelist, tariff-zone rectangle or geometry match selects the denominator. The census scans **34,499,152 national stop-time rows**; route membership includes inactive annual records. Full calls outside Fribourg are retained on the two validation dates. District route counts overlap because journeys can serve several districts.

| District | Called in-canton platforms (annual) | Annual routes | Routes admitting Friday trips | Routes admitting Sunday trips |
| --- | --- | --- | --- | --- |
| La Gruyère | 352 | 51 | 20 | 25 |
| Sense | 290 | 33 | 17 | 21 |
| La Glâne | 229 | 48 | 25 | 20 |
| See | 199 | 39 | 16 | 11 |
| La Veveyse | 127 | 22 | 15 | 13 |
| La Sarine | 600 | 83 | 36 | 45 |
| La Broye | 207 | 34 | 18 | 14 |

The source is the national fixed-stop timetable, not a verified census of every real-world service. School, seasonal, night, replacement bus, lake, funicular and cableway records present in the archive are included; services absent from that archive and GTFS-Flex service areas remain outside its evidence. Agency 3004 (Fribourg funicular) is present in the annual inventory but inactive on both fixture dates. This is not an assertion about its year-round operation.

### Boundary sensitivity

The canton and district polygons retain all rings and disconnected components. Source geometry is original LV95 XY; GTFS WGS84 points are classified using the repository's metre-level swisstopo approximation. Nine stop records within ten metres of the boundary are retained in the summary, on both sides, including parent records. **PostAuto 661 (`96-247-j26-1`) has only Sassel, Chapalettaz platform `ch:1:sloid:70404:0:710788` inside, at approximately 0.17 m from the polygon edge.** Its geographic membership remains excluded from feed admission even if road geometry is available, pending a higher-accuracy coordinate/boundary review. The other 206 route memberships have at least one platform beyond that uncertainty band. Route 661 is excluded from the geometry feed. The polygon is not buffered to hide this ambiguity.

## Friday and Sunday validation

Civil days are **Friday 4 September and Sunday 6 September 2026**, with calendar exceptions and preceding-service-day carry-in. Frequency templates are expanded according to GTFS `exact_times`; representative headway instances are counted separately from scheduled journeys. The same route, direction ID and **full ordered original platform IDs**, including repeats, define a directed pattern. Direction 0 and 1 are never merged or assumed to be simple reversals.

| Measure | Friday 2026-09-04 | Sunday 2026-09-06 |
| --- | --- | --- |
| Civil trip instances | 8,556 | 6,326 |
| Scheduled instances | 5,812 | 4,062 |
| Representative headway instances | 2,744 | 2,264 |
| Admitted instances before OSM fallback | 2,595 | 1,692 |
| Additional admitted instances from OSM fallback | 2,063 | 1,216 |
| Admitted scheduled instances | 4,658 | 2,908 |
| Admitted headway instances | 0 | 0 |
| Directed patterns tested | 849 | 588 |
| Complete/admitted directed patterns | 545 | 318 |
| Matched unique directed route/platform pairs | 3,883 / 4,509 (86.1%) | 3,933 / 4,607 (85.4%) |
| Matched scheduled segment occurrences (before whole-pattern exclusion) | 83,392 / 89,328 (93.4%) | 56,909 / 62,231 (91.4%) |
| Matched occurrences including representative headways | 83,392 / 92,072 (90.6%) | 56,909 / 64,495 (88.2%) |
| Segment occurrences retained in admitted complete journeys | 74,446 | 49,782 |
| Inferred road occurrences retained in admitted journeys | 5,593 | 3,240 |
| Official-only matched directed pairs before OSM fallback | 3,350 / 4,509 | 3,424 / 4,607 |
| Carry-in instances / admitted | 97 / 63 | 179 / 121 |
| Night instances / admitted | 0 / 0 | 53 / 42 |
| Patterns revisiting platforms / admitted | 9 / 6 | 6 / 2 |

There are **327 shared patterns, 522 Friday-only patterns and 261 Sunday-only patterns**. These comparisons include failed and headway patterns. A matched segment in a failed journey contributes to source coverage, but that journey is excluded in full. Thus source-pair coverage must not be presented as the percentage of service admitted. Every segment actually emitted in the feed has geometry.

The Friday civil day ends before Friday-night departures after midnight; Sunday includes Saturday-night carry-in. Two September dates establish neither public-holiday nor winter/summer/year-round completeness. No authenticated realtime data or vehicle GPS positions are used.

## Source adapter and identity

The [cantonal ArcGIS layer](https://map.geo.fr.ch/arcgis/rest/services/PortailCarto/Theme_mobilite/MapServer/2) contains **128 lines**: bus and rail centrelines. Retrieval requests object IDs and a count independently, downloads explicit pages of 50 IDs in EPSG:2056, verifies every ID exactly once, rejects transfer-limit/error/invalid-coordinate responses and compares IDs again after acquisition. Original response bytes and SHA-256 hashes are retained; an ID-stable service is not an immutable historical snapshot. `OBJECTID` is used only within that hashed acquisition.

116 source records have a route-identity candidate; 111 support at least one admitted journey; 12 have no matched canton-serving route identity.

- `20.002` is timetable field 20.002. Its reviewed TPF bus interpretation maps to display line **2**, agency **834**; it is not parsed as a decimal passenger number. Prefixes 10, 20 and 30 are accepted only for reviewed bus records.
- TPF rail uses agency **53**, buses **834**; `Post Auto` and `Car Postal` map to **801**. SBB, BLS and MOB remain separate identities. Replacement agencies never inherit their parent brand's paths.
- Named night labels in `NOM_LIGNE` take priority: field 20.143 maps to **N1**, and the source's regionally typed field 20.463 maps to **N24**. Anonymous Noctambus records remain unresolved. Source field 20.922 links to PDF 30.922; the raw mismatch is retained, while its explicit **M22** label controls the candidate match.
- Features 43–45 say `Autre`. The preserved official 2026 timetable PDFs identify **VMCV 213, 216, 217 (agency 876)**. Feature 3's field 254 PDF identifies **TPF RE2/RE3**. Exceptions require the exact source number, name, enterprise and mode. PDF identity evidence does not extend the source geometry to missing termini such as Broc-Chocolaterie.
- Explicit rail labels such as S20/S21 and R8 are matched exactly. Generic IC/IR, RE or Regio fields and unlabelled MOB services do not become universal rail graphs. No global nearest-line match or cross-operator cantonal geometry borrowing is used. The road fallback below is separately attributed and binds to the original agency and complete route/platform patterns.

Graph vertices join at identical LV95 coordinates, with one disclosed precision repair: source feature 22 (TPF line 9) has two components ending **11.22 mm apart** near Charmettes. The adapter moves only the pinned first vertex of part 0 onto the original last vertex of part 2. The original geometry hash, both coordinates and vertex indices are asserted before applying it; original source bytes remain unchanged. This is **inferred topology**, not a surveyed connection. Every affected route journey carries a geometryInference marker. No general nearest-endpoint bridge or crossing-node inference is added. Ordered calls orient each inferred path along the undirected source centreline. Bus projection limit: **80 m**; rail: **120 m**. Paths exceeding the greater of **4.5× straight-line distance** or **1,200 m bus / 3,000 m rail** are rejected. An alternative source-part projection is considered only within **5 m** of the nearest gap after a topology/detour failure. Collapsed paths are rejected. Endpoint connectors are bounded projections, not observed vehicle tracks. Output uses the shared approximate LV95/WGS84 transform and seven-decimal coordinates without line simplification.

Road one-way legality, rail running-track choice, bridge/tunnel topology and temporary diversions are **not certified** by these undirected source records. Exact source topology prevents invented connections at visual crossings, but does not prove physical direction. Original repeated calls remain in each pattern. Reservation/on-demand pickup or drop-off excludes an entire journey; none is silently converted to an ordinary fixed departure.

GTFS times remain unchanged. Among admitted journeys there are **5,699 Friday and 4,367 Sunday zero-duration segments**, of which 5,695 / 4,367 exceed 100 m of source centreline. Minute-rounded equal timestamps are not instantaneous-speed measurements; a renderer may jump at those transitions. Maximum positive-duration implied speeds are 132.4 / 160.1 km/h across all admitted modes. The Sunday maximum is TPF bus 544, Domdidier, gare → Avenches, Le Paon (2,668 m in a published 60 s interval); it is a source-time plausibility flag, not a validated bus speed. Geometry admission does not certify travel-time precision. No travel-time smoothing or invented call times are applied.

## Admission and exclusions

| Agency ID | National feed identity | Annual route records | Friday admitted / all instances | Sunday admitted / all instances |
| --- | --- | --- | --- | --- |
| 11 | Schweizerische Bundesbahnen SBB | 23 | 160 / 334 | 163 / 334 |
| 33 | BLS AG (bls) | 8 | 89 / 443 | 33 / 384 |
| 53 | Transports publics fribourgeois | 14 | 55 / 265 | 59 / 280 |
| 64 | Montreux-Oberland Bernois | 6 | 0 / 50 | 0 / 50 |
| 182 | Bielersee-Schifffahrts-Gesellschaft AG | 1 | 0 / 2 | 0 / 2 |
| 189 | Lacs de Neuchâtel et Morat | 5 | 0 / 16 | 0 / 16 |
| 801 | PostAuto AG | 22 | 507 / 602 | 244 / 272 |
| 834 | Service d'automobiles TPF | 92 | 3,747 / 3,918 | 2,298 / 2,435 |
| 876 | Transports publics Vevey-Montreux-Chillon-Villeneuve | 3 | 74 / 148 | 58 / 115 |
| 3004 | Transports publics fribourgeois | 1 | 0 / 0 | 0 / 0 |
| 3005 | Kaisereggbahnen Schwarzsee AG | 1 | 0 / 1,020 | 0 / 1,080 |
| 3009 | Centre Touristique Moléson | 2 | 0 / 104 | 0 / 104 |
| 3258 | TéléCharmey SA | 1 | 0 / 1,620 | 0 / 1,080 |
| 7040 | Montreux-Oberland Bernois Ersatzverkehr | 1 | 0 / 0 | 4 / 9 |
| 7223 | Transports publics fribourgeois Ersatzverkehr | 5 | 2 / 2 | 10 / 10 |
| 7230 | BLS Netz AG Ersatzverkehr | 3 | 0 / 0 | 0 / 0 |
| 7231 | SBB Infrastruktur AG Bahnersatz | 19 | 24 / 32 | 39 / 155 |

| Route status across both dates | Records |
| --- | --- |
| Excluded | 34 |
| Inactive on both dates | 48 |
| Partially admitted | 29 |
| All dated trips admitted | 96 |

| Failed segment reason | Friday directed pairs / occurrences | Sunday directed pairs / occurrences |
| --- | --- | --- |
| collapsed-path | 3 / 32 | 1 / 16 |
| disconnected-line | 5 / 76 | 0 / 0 |
| endpoint-gap | 164 / 2,583 | 162 / 2,391 |
| implausible-detour | 3 / 74 | 3 / 57 |
| missing-line | 451 / 5,915 | 508 / 5,122 |

Failures remain route-scoped and directed. The machine audit names both original platforms and records projection gaps, detour lengths and fallback projection choices when available. `missing-line` means no verified source identity; it does not claim that a road or railway is absent. `endpoint-gap`, `disconnected-line`, `implausible-detour` and `collapsed-path` cause whole-pattern exclusion. Night, replacement, mountain and boat services are not silently dropped from the denominator. This adapter supplies no boat or mountain-mode geometry, and no rail geometry is repurposed for replacement buses.

### Geometry follow-up

Before the OSM supplement, the line 9 precision repair is evaluated against an unmodified-source baseline on each date. It adds **143 Friday / 151 Sunday complete journeys**, losing none. Source feature 22's affected route graphs admit 143 / 151 journeys after the repair; remaining extensions still fail the normal projection limits. The daily audit preserves baseline failed pairs and before/after counts.

The [reproducible topology diagnostic](../data/fribourg-audit/topology-followup.json) found a **9.024 m** break in line 1 (feature 128), a **561.161 m** component separation in line 2 (feature 16), and three components in S20/S21 (feature 10), with nearest separations of 0.026 m and 0.040 m. These remain unchanged: the bus breaks exceed the precision-repair limit, and the rail junction needs a separate topology review. Rail station/terminal projection failures also remain. The later road supplement can cover bus source gaps using actual inferred road paths; it does not alter these original source geometries.

### Complete bus-pattern road supplement

The [road adapter](../scripts/fribourg-road-geometry.mjs) prepares all **614 distinct full bus patterns** across both civil days and six active bus agency identities: TPF, PostAuto, VMCV and the three active replacement operators. Inactive annual agencies remain in the canton census. All source calls, out-of-canton termini, repeated platforms, short branches and night patterns are retained. Routing-only carry-in timestamps are shifted by whole days to satisfy GTFS input constraints; delivered timestamps are unchanged.

The matcher uses the pinned Geofabrik Switzerland **2 September 2026** road extract plus the **8 September 2026** border extract, SHA-256 **d5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b**, and pfaedle commit **99f2cd466696ecc6bdb73b2b3bb9008557fcb84a**. The copied configuration, binary hash, routing inputs, shapes, trips, stop times, complete warning logs and run hashes are retained in [road evidence](../data/fribourg-road-evidence). The checker reimports those outputs and verifies every emitted inferred segment against them.

A failed cantonal pair receives a road path only when **every complete pattern context containing the same agency/route/directed-platform pair has a valid, identical path**. A successful context cannot hide a failed context. Differing branch paths remain rejected; no context exception is added. Source-matched pairs retain their original paths. Explicit pfaedle fallback hops are rejected even if the matcher writes a straight segment. Monotone shape-distance slicing preserves direction and loops. Road projection is limited to 120 m; simplification is 5 m, followed by the stricter final detour guard of max(600 m, 3 × direct distance). These tolerances apply to inferred roads, separately from the cantonal 80 m bus projection guard.

| Measure | Friday | Sunday |
| --- | --- | --- |
| All bus instances | 4,702 | 2,996 |
| Admitted bus instances | 4,354 | 2,653 |
| Additional admitted journeys | 2,063 | 1,216 |
| Road-backed directed pairs | 533 | 509 |
| Lost previously admitted journeys | 0 | 0 |
| road-excessive-detour — remaining directed pairs | 12 | 11 |
| road-matcher-rejected — remaining directed pairs | 3 | 5 |
| road-pattern-dependent-path — remaining directed pairs | 18 | 12 |

The original cantonal failure is preserved as officialFailure and the road assessment records all contributing full pattern IDs. Journeys record their inferred segment count and geometry source. Reservation/on-demand calls, GTFS demand-responsive type 715 and provisional boundary route 661 remain excluded. The OSM profile uses bus/PSV access and direction tags with penalties; **it does not enforce an absolute one-way prohibition**. Physical legality, temporary restrictions and actual operator routing remain unverified. Complete directed stop matching is not a claim of certified road direction.

![Urban corridor geometry review](assets/fribourg-road-review.svg)

The four urban panels were rendered and visually inspected for continuity, extent and original/fallback separation; they are not independent operator evidence. Both dates and all other bus patterns are covered by the automated full-sequence and retained-output checks. Remaining larger exclusion groups include one direction of TPF 3, PostAuto 121, VMCV branches and Sunday replacement patterns; every failed pair and trip count remains in the machine audit.

## Dates, reuse and attribution

| Source | Pinned date / vintage | Attribution / reuse |
| --- | --- | --- |
| National GTFS | Feed 20260902; valid 2025-12-14–2026-12-12 | opentransportdata.swiss; processed by Gleislicht; platform terms, not an assigned CC licence |
| Fribourg line layer | 2026-09-08T18:02:36.135027+00:00; actual geometry vintage unknown | Source: Etat de Fribourg; free use, sharing and reuse under dataset OGD terms |
| Embedded Esri metadata | Created 2022-07-14 | Metadata creation, not geometry vintage |
| OGD catalogue item | Created 2024-09-20T13:26:30.775000+00:00; modified 2026-07-08T14:41:59.462000+00:00 | Catalogue timestamps, not geometry vintage |
| OSM road supplement | Swiss extract 2026-09-02; border retrieved 2026-09-08 | © OpenStreetMap contributors; ODbL 1.0; inferred geometry database |
| swissBOUNDARIES3D | 2026-01; original canton and seven district polygons | © swisstopo; free geodata terms |
| timetable-10.213.pdf | Timetable 2026; state 2025-12-19 | Official tp-info / oev-info timetable; identity evidence only |
| timetable-10.216.pdf | Timetable 2026; state 2025-12-19 | Official tp-info / oev-info timetable; identity evidence only |
| timetable-10.217.pdf | Timetable 2026; state 2026-05-28 | Official tp-info / oev-info timetable; identity evidence only |
| timetable-254.pdf | Timetable 2026; state 2025-09-25 | Official tp-info / oev-info timetable; identity evidence only |

GTFS SHA-256: `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`. Decoded source snapshot: `e8523af34fcedca7f8b0cbe495446ff93a75d8563c62b243da942c39c5243f47`. The acquisition and feed metadata retain every raw-response hash, URL and UTC retrieval timestamp. Mutable PDF URLs and live ArcGIS responses are not claimed to be permanent release URLs. Refreshing either source requires a new census, mapping review and both full directed-pattern validations.

The [dataset catalogue item](https://maps.fr.ch/portal/sharing/rest/content/items/518a09fdd5874b76b6eacfb0fe2bb8ec?f=pjson) explicitly permits free use, sharing and reuse with **Source: Etat de Fribourg** attribution. Its title incorrectly says stops, but its service URL and serviceItemId identify the service containing [polyline layer 1](https://maps.fr.ch/ags/rest/services/OpenData/Lignes_de_transport_public/FeatureServer/1). An independent complete query matches **all 128 geometries, vertex-for-vertex, and every original attribute** to the original MapServer snapshot; the OGD response adds the numeric TYPE_LIGNE field. The reproduction checks reject changed terms, missing/duplicate features, altered identities and even millimetre coordinate changes. Both raw snapshots and the catalogue/service metadata are preserved. **The vector reuse question is resolved**, without assigning a Creative Commons licence or relying on an uncertain ordinance product mapping.

The earlier [portal terms](https://map.geo.fr.ch/help/fr/conditions_utilisation.htm) and [geoinformation ordinance](https://bdlf.fr.ch/api/fr/versions/8468/pdf_file_with_annexes) remain supporting evidence. The linked [geocat record](https://www.geocat.ch/geonetwork/srv/fre/catalog.search#/metadata/d578f90c-348f-41de-80be-4385a57605b9) did not yield XML during the follow-up (HTTP 403/500 or a login page). Neither service declares a geometry update date; the OGD catalogue's July 2026 modification timestamp must not be presented as line vintage.

Timetable reuse follows the [national platform terms](https://opentransportdata.swiss/en/terms-of-use/); boundary reuse follows [swisstopo's terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices). The [OSM copyright terms](https://www.openstreetmap.org/copyright) require attribution and ODbL share-alike for derived data. The combined derived geometry database is offered under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), with the full derived road cache retained; this does not relabel the separate timetable or boundary sources. These credits are distinct and are embedded in both manifests and the feed's source record. No live-service accuracy or real-time position claim is made.

## Reproduction and checks

From the repository root (Node 24+, installed dependencies, Python 3, curl and unzip):

```sh
# Offline source-byte verification and deterministic decoding.
python3 scripts/prepare-fribourg-sources.py --offline

# Full national census; temporary cache stays outside public hosting.
node --max-old-space-size=8192 scripts/fribourg-timetable.mjs \
  /private/tmp/GTFS_FP2026_20260902.zip /private/tmp/fribourg-timetable.json.gz

# Both civil-day feeds and complete route/pattern audit using the committed road cache.
node --max-old-space-size=8192 scripts/build-fribourg-region.mjs \
  --archive /private/tmp/GTFS_FP2026_20260902.zip \
  --timetable-cache /private/tmp/fribourg-timetable.json.gz
node scripts/check-fribourg-region.mjs
node scripts/audit-fribourg-topology.mjs
node scripts/review-fribourg-roads.mjs
node scripts/write-fribourg-audit.mjs
python3 scripts/test_fribourg_sources.py
npx vitest run scripts/fribourg-region.test.mjs scripts/fribourg-road-geometry.test.mjs scripts/bern-region.test.mjs

# Optional offline road rebuild: prepare all patterns, match each agency directory
# with scripts/match-postbus-roads.mjs --no-trie/-W wrapper and the pinned extract,
# then import all six outputs. Renew policy hashes after review.
node scripts/fribourg-road-geometry.mjs prepare \
  /private/tmp/fribourg-timetable.json.gz /private/tmp/fribourg-road-feed
for agency in 834 876 7223 7231 801 7040; do
  node scripts/match-postbus-roads.mjs \
    --pfaedle /private/tmp/gleislicht-pfaedle/build/pfaedle \
    --config data/fribourg-road-evidence/pfaedle.cfg \
    --osm /private/tmp/gleislicht-postbus-roads.osm.pbf \
    --feed /private/tmp/fribourg-road-feed/$agency \
    --output /private/tmp/fribourg-road-matched/$agency
done
node scripts/fribourg-road-geometry.mjs import \
  /private/tmp/fribourg-road-feed /private/tmp/fribourg-road-matched

# Fresh acquisition changes hashes and requires renewed source review.
python3 scripts/prepare-fribourg-sources.py --boundary \
  /private/tmp/swissboundaries3d-2026/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg
```

The checker independently reconciles all routes, source identities, seven districts, both pattern sets and directed-pair occurrence counts. It reconstructs both full-day feeds from all 24 chunks, checks chunk hashes and trip identity, validates full original call counts, path direction, finite coordinates and ordered times, and reconciles every admitted pattern against the manifest. Focused tests cover source paging failures, coordinate-order errors, detached territory membership, bus/night/rail identity collisions, changed operator overrides, reverse/loop call chains, disconnected lines and whole-journey exclusion. Shared Bern behavior is regression-tested because Fribourg reuses its census, topology, calendar/frequency and snapshot validators.
