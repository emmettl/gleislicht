# Fribourg / Freiburg cantonal source study

Fixture audit: **8 September 2026**. Starting point: [Swiss transit source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#fr).

The entire canton is inventoried against the pinned annual national GTFS: **207 route records, 17 agency identities and all seven districts**, including detached territories and complete out-of-canton journeys. The regional feed admits **2,452 Friday journeys and 1,541 Sunday journeys** with complete source-backed directed stop patterns. This is partial geometry admission, not full service coverage. One route is a provisional geographic member because its sole in-canton platform is within a metre of the boundary; see below.

The [regional feed index](../data/fribourg-region/index.json) points to both civil-day manifests, twelve two-hour chunks per date, and 06:45–08:45 extracts. It uses the existing network snapshot format, **not a new GTFS ZIP**. It is saved under `data/` as a **local archival research artifact**. Dataset-specific vector redistribution clearance and geometry vintage remain unresolved, so this study does not add it to public hosting or the application's study selector.

## Deliverables and scope

- [Every admitted, partly admitted, excluded and inactive route](FRIBOURG-ROUTE-INVENTORY.md); [machine-readable routes](../data/fribourg-audit/routes.json).
- [Source feature inventory](../data/fribourg-audit/source-lines.json): all 128 records, raw timetable fields, operator/line interpretation, source geometry size, candidate routes and admitted routes.
- [Friday directed-pattern and pair audit](../data/fribourg-audit/2026-09-04.json), [Sunday audit](../data/fribourg-audit/2026-09-06.json), [summary](../data/fribourg-audit/summary.json), [in-canton stop records](../data/fribourg-audit/stops.json).
- [Acquisition evidence](../data/fribourg-sources/acquisition.json), [source dates/credits/terms](../data/fribourg-sources/sources.json), [reviewed mapping policy](../data/fribourg-policy.json).

Every annual trip with at least one original GTFS call coordinate inside the unsimplified swissBOUNDARIES3D Fribourg polygon contributes to membership. No operator whitelist, tariff-zone rectangle or geometry match selects the denominator. The census scans **34,499,152 national stop-time rows**; route membership includes inactive annual records. Full calls outside Fribourg are retained on the two validation dates. District route counts overlap because journeys can serve several districts.

| District | Called in-canton platforms (annual) | Annual routes | Routes admitting Friday trips | Routes admitting Sunday trips |
| --- | --- | --- | --- | --- |
| La Gruyère | 352 | 51 | 12 | 10 |
| Sense | 290 | 33 | 13 | 13 |
| La Glâne | 229 | 48 | 18 | 14 |
| See | 199 | 39 | 11 | 9 |
| La Veveyse | 127 | 22 | 9 | 5 |
| La Sarine | 600 | 83 | 22 | 25 |
| La Broye | 207 | 34 | 14 | 12 |

The source is the national fixed-stop timetable, not a verified census of every real-world service. School, seasonal, night, replacement bus, lake, funicular and cableway records present in the archive are included; services absent from that archive and GTFS-Flex service areas remain outside its evidence. Agency 3004 (Fribourg funicular) is present in the annual inventory but inactive on both fixture dates. This is not an assertion about its year-round operation.

### Boundary sensitivity

The canton and district polygons retain all rings and disconnected components. Source geometry is original LV95 XY; GTFS WGS84 points are classified using the repository's metre-level swisstopo approximation. Nine stop records within ten metres of the boundary are retained in the summary, on both sides, including parent records. **PostAuto 661 (`96-247-j26-1`) has only Sassel, Chapalettaz platform `ch:1:sloid:70404:0:710788` inside, at approximately 0.17 m from the polygon edge.** Its geographic membership is provisional pending a higher-accuracy coordinate/boundary review. The other 206 route memberships have at least one platform beyond that uncertainty band. Route 661 is excluded from the geometry feed. The polygon is not buffered to hide this ambiguity.

## Friday and Sunday validation

Civil days are **Friday 4 September and Sunday 6 September 2026**, with calendar exceptions and preceding-service-day carry-in. Frequency templates are expanded according to GTFS `exact_times`; representative headway instances are counted separately from scheduled journeys. The same route, direction ID and **full ordered original platform IDs**, including repeats, define a directed pattern. Direction 0 and 1 are never merged or assumed to be simple reversals.

| Measure | Friday 2026-09-04 | Sunday 2026-09-06 |
| --- | --- | --- |
| Civil trip instances | 8,556 | 6,326 |
| Scheduled instances | 5,812 | 4,062 |
| Representative headway instances | 2,744 | 2,264 |
| Admitted scheduled instances | 2,452 | 1,541 |
| Admitted headway instances | 0 | 0 |
| Directed patterns tested | 849 | 588 |
| Complete/admitted directed patterns | 338 | 196 |
| Matched unique directed route/platform pairs | 3,348 / 4,509 (74.3%) | 3,422 / 4,607 (74.3%) |
| Matched scheduled segment occurrences (before whole-pattern exclusion) | 76,952 / 89,328 (86.1%) | 52,740 / 62,231 (84.7%) |
| Matched occurrences including representative headways | 76,952 / 92,072 (83.6%) | 52,740 / 64,495 (81.8%) |
| Segment occurrences retained in admitted complete journeys | 34,595 | 24,547 |
| Carry-in instances / admitted | 97 / 29 | 179 / 49 |
| Night instances / admitted | 0 / 0 | 53 / 10 |
| Patterns revisiting platforms / admitted | 9 / 2 | 6 / 0 |

There are **327 shared patterns, 522 Friday-only patterns and 261 Sunday-only patterns**. These comparisons include failed and headway patterns. A matched segment in a failed journey contributes to source coverage, but that journey is excluded in full. Thus source-pair coverage must not be presented as the percentage of service admitted. Every segment actually emitted in the feed has geometry.

The Friday civil day ends before Friday-night departures after midnight; Sunday includes Saturday-night carry-in. Two September dates establish neither public-holiday nor winter/summer/year-round completeness. No authenticated realtime data or vehicle GPS positions are used.

## Source adapter and identity

The [cantonal ArcGIS layer](https://map.geo.fr.ch/arcgis/rest/services/PortailCarto/Theme_mobilite/MapServer/2) contains **128 lines**: bus and rail centrelines. Retrieval requests object IDs and a count independently, downloads explicit pages of 50 IDs in EPSG:2056, verifies every ID exactly once, rejects transfer-limit/error/invalid-coordinate responses and compares IDs again after acquisition. Original response bytes and SHA-256 hashes are retained; an ID-stable service is not an immutable historical snapshot. `OBJECTID` is used only within that hashed acquisition.

116 source records have a route-identity candidate; 75 support at least one admitted journey; 12 have no matched canton-serving route identity.

- `20.002` is timetable field 20.002. Its reviewed TPF bus interpretation maps to display line **2**, agency **834**; it is not parsed as a decimal passenger number. Prefixes 10, 20 and 30 are accepted only for reviewed bus records.
- TPF rail uses agency **53**, buses **834**; `Post Auto` and `Car Postal` map to **801**. SBB, BLS and MOB remain separate identities. Replacement agencies never inherit their parent brand's paths.
- Named night labels in `NOM_LIGNE` take priority: field 20.143 maps to **N1**, and the source's regionally typed field 20.463 maps to **N24**. Anonymous Noctambus records remain unresolved. Source field 20.922 links to PDF 30.922; the raw mismatch is retained, while its explicit **M22** label controls the candidate match.
- Features 43–45 say `Autre`. The preserved official 2026 timetable PDFs identify **VMCV 213, 216, 217 (agency 876)**. Feature 3's field 254 PDF identifies **TPF RE2/RE3**. Exceptions require the exact source number, name, enterprise and mode. PDF identity evidence does not extend the source geometry to missing termini such as Broc-Chocolaterie.
- Explicit rail labels such as S20/S21 and R8 are matched exactly. Generic IC/IR, RE or Regio fields and unlabelled MOB services do not become universal rail graphs. No global nearest-line match or cross-operator geometry borrowing is used.

Graph vertices join only at identical original LV95 coordinates. Separate line parts remain separate; no nearest-endpoint bridge or crossing-node inference is added. Ordered calls orient each inferred path along the undirected source centreline. Bus projection limit: **80 m**; rail: **120 m**. Paths exceeding the greater of **4.5× straight-line distance** or **1,200 m bus / 3,000 m rail** are rejected. An alternative source-part projection is considered only within **5 m** of the nearest gap after a topology/detour failure. Collapsed paths are rejected. Endpoint connectors are bounded projections, not observed vehicle tracks. Output uses the shared approximate LV95/WGS84 transform and seven-decimal coordinates without line simplification.

Road one-way legality, rail running-track choice, bridge/tunnel topology and temporary diversions are **not certified** by these undirected source records. Exact source topology prevents invented connections at visual crossings, but does not prove physical direction. Original repeated calls remain in each pattern. Reservation/on-demand pickup or drop-off excludes an entire journey; none is silently converted to an ordinary fixed departure.

GTFS times remain unchanged. Among admitted journeys there are **2,380 Friday and 1,697 Sunday zero-duration segments**, of which 2,380 / 1,697 exceed 100 m of source centreline. Minute-rounded equal timestamps are not instantaneous-speed measurements; a renderer may jump at those transitions. Maximum positive-duration implied speeds are 132.4 / 160.1 km/h across all admitted modes. The Sunday maximum is TPF bus 544, Domdidier, gare → Avenches, Le Paon (2,668 m in a published 60 s interval); it is a source-time plausibility flag, not a validated bus speed. Geometry admission does not certify travel-time precision. No travel-time smoothing or invented call times are applied.

## Admission and exclusions

| Agency ID | National feed identity | Annual route records | Friday admitted / all instances | Sunday admitted / all instances |
| --- | --- | --- | --- | --- |
| 11 | Schweizerische Bundesbahnen SBB | 23 | 160 / 334 | 163 / 334 |
| 33 | BLS AG (bls) | 8 | 89 / 443 | 33 / 384 |
| 53 | Transports publics fribourgeois | 14 | 55 / 265 | 59 / 280 |
| 64 | Montreux-Oberland Bernois | 6 | 0 / 50 | 0 / 50 |
| 182 | Bielersee-Schifffahrts-Gesellschaft AG | 1 | 0 / 2 | 0 / 2 |
| 189 | Lacs de Neuchâtel et Morat | 5 | 0 / 16 | 0 / 16 |
| 801 | PostAuto AG | 22 | 311 / 602 | 189 / 272 |
| 834 | Service d'automobiles TPF | 92 | 1,800 / 3,918 | 1,060 / 2,435 |
| 876 | Transports publics Vevey-Montreux-Chillon-Villeneuve | 3 | 37 / 148 | 37 / 115 |
| 3004 | Transports publics fribourgeois | 1 | 0 / 0 | 0 / 0 |
| 3005 | Kaisereggbahnen Schwarzsee AG | 1 | 0 / 1,020 | 0 / 1,080 |
| 3009 | Centre Touristique Moléson | 2 | 0 / 104 | 0 / 104 |
| 3258 | TéléCharmey SA | 1 | 0 / 1,620 | 0 / 1,080 |
| 7040 | Montreux-Oberland Bernois Ersatzverkehr | 1 | 0 / 0 | 0 / 9 |
| 7223 | Transports publics fribourgeois Ersatzverkehr | 5 | 0 / 2 | 0 / 10 |
| 7230 | BLS Netz AG Ersatzverkehr | 3 | 0 / 0 | 0 / 0 |
| 7231 | SBB Infrastruktur AG Bahnersatz | 19 | 0 / 32 | 0 / 155 |

| Route status across both dates | Records |
| --- | --- |
| Excluded | 82 |
| Inactive on both dates | 48 |
| Partially admitted | 40 |
| All dated trips admitted | 37 |

| Failed segment reason | Friday directed pairs / occurrences | Sunday directed pairs / occurrences |
| --- | --- | --- |
| collapsed-path | 9 / 66 | 6 / 38 |
| disconnected-line | 42 / 1,055 | 29 / 645 |
| endpoint-gap | 378 / 5,955 | 380 / 4,346 |
| implausible-detour | 6 / 90 | 3 / 57 |
| missing-line | 726 / 7,954 | 767 / 6,669 |

Failures remain route-scoped and directed. The machine audit names both original platforms and records projection gaps, detour lengths and fallback projection choices when available. `missing-line` means no verified source identity; it does not claim that a road or railway is absent. `endpoint-gap`, `disconnected-line`, `implausible-detour` and `collapsed-path` cause whole-pattern exclusion. Night, replacement, mountain and boat services are not silently dropped from the denominator. This adapter supplies no boat or mountain-mode geometry, and no rail geometry is repurposed for replacement buses.

## Dates, reuse and attribution

| Source | Pinned date / vintage | Attribution / reuse |
| --- | --- | --- |
| National GTFS | Feed 20260902; valid 2025-12-14–2026-12-12 | opentransportdata.swiss; processed by Gleislicht; platform terms, not an assigned CC licence |
| Fribourg line layer | 2026-09-08T18:02:36.135027+00:00; actual geometry vintage unknown | Source: Etat de Fribourg; dataset-specific vector redistribution unresolved |
| Embedded Esri metadata | Created 2022-07-14 | Metadata creation, not geometry vintage |
| swissBOUNDARIES3D | 2026-01; original canton and seven district polygons | © swisstopo; free geodata terms |
| timetable-10.213.pdf | Timetable 2026; state 2025-12-19 | Official tp-info / oev-info timetable; identity evidence only |
| timetable-10.216.pdf | Timetable 2026; state 2025-12-19 | Official tp-info / oev-info timetable; identity evidence only |
| timetable-10.217.pdf | Timetable 2026; state 2026-05-28 | Official tp-info / oev-info timetable; identity evidence only |
| timetable-254.pdf | Timetable 2026; state 2025-09-25 | Official tp-info / oev-info timetable; identity evidence only |

GTFS SHA-256: `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`. Decoded source snapshot: `e8523af34fcedca7f8b0cbe495446ff93a75d8563c62b243da942c39c5243f47`. The acquisition and feed metadata retain every raw-response hash, URL and UTC retrieval timestamp. Mutable PDF URLs and live ArcGIS responses are not claimed to be permanent release URLs. Refreshing either source requires a new census, mapping review and both full directed-pattern validations.

The [portal terms](https://map.geo.fr.ch/help/fr/conditions_utilisation.htm) explicitly permit attributed map images and defer to data suppliers. The [current geoinformation ordinance](https://bdlf.fr.ch/api/fr/versions/8468/pdf_file_with_annexes), effective 1 March 2024, requires attribution for reproduction and lists the cantonal transport plan (56-FR) as level A. The layer metadata does not identify itself conclusively as that product or supply vector terms. This is supporting evidence, not a claimed dataset-specific licence; both documents are preserved with the feed. **The feed remains local research-only until that mapping/reuse question and a suitable geometry vintage are resolved.**

Timetable reuse follows the [national platform terms](https://opentransportdata.swiss/en/terms-of-use/); boundary reuse follows [swisstopo's terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices). These credits are distinct and are embedded in both manifests and the feed's source record. No live-service accuracy or real-time position claim is made.

## Reproduction and checks

From the repository root (Node 24+, installed dependencies, Python 3, curl and unzip):

```sh
# Offline source-byte verification and deterministic decoding.
python3 scripts/prepare-fribourg-sources.py --offline

# Full national census; temporary cache stays outside public hosting.
node --max-old-space-size=8192 scripts/fribourg-timetable.mjs \
  /private/tmp/GTFS_FP2026_20260902.zip /private/tmp/fribourg-timetable.json.gz

# Both civil-day feeds and complete route/pattern audit.
node --max-old-space-size=8192 scripts/build-fribourg-region.mjs \
  --archive /private/tmp/GTFS_FP2026_20260902.zip \
  --timetable-cache /private/tmp/fribourg-timetable.json.gz
node scripts/check-fribourg-region.mjs
node scripts/write-fribourg-audit.mjs
python3 scripts/test_fribourg_sources.py
npx vitest run scripts/fribourg-region.test.mjs scripts/bern-region.test.mjs

# Fresh acquisition changes hashes and requires renewed source review.
python3 scripts/prepare-fribourg-sources.py --boundary \
  /private/tmp/swissboundaries3d-2026/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg
```

The checker independently reconciles all routes, source identities, seven districts, both pattern sets and directed-pair occurrence counts. It reconstructs both full-day feeds from all 24 chunks, checks chunk hashes and trip identity, validates full original call counts, path direction, finite coordinates and ordered times, and reconciles every admitted pattern against the manifest. Focused tests cover source paging failures, coordinate-order errors, detached territory membership, bus/night/rail identity collisions, changed operator overrides, reverse/loop call chains, disconnected lines and whole-journey exclusion. Shared Bern behavior is regression-tested because Fribourg reuses its census, topology, calendar/frequency and snapshot validators.
