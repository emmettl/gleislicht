import { readFile, writeFile } from 'node:fs/promises'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const summary = await json('data/fribourg-audit/summary.json')
const routes = await json('data/fribourg-audit/routes.json')
const lines = await json('data/fribourg-audit/source-lines.json')
const reports = await Promise.all(summary.days.map(d => json(`data/fribourg-audit/${d.serviceDate}.json`)))
const n = value => value.toLocaleString('en-GB')
const pct = (a, b) => b ? `${(a / b * 100).toFixed(1)}%` : '—'
const esc = text => String(text ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ')
const table = (headers, rows) => [headers, headers.map(() => '---'), ...rows].map(r => `| ${r.map(esc).join(' | ')} |`).join('\n')
const days = reports.map(r => r.coverage)
const measure = (title, field) => [title, ...days.map(d => n(d[field]))]
const agencies = [...new Set(routes.map(r => r.agencyId))].sort((a, b) => Number(a) - Number(b))
const agencyRows = agencies.map(id => {
  const rs = routes.filter(r => r.agencyId === id)
  return [id, rs[0].agency, rs.length, ...reports.map(report => {
    const groups = report.groups.filter(g => g.id.startsWith(`${id}:`))
    return `${n(groups.reduce((v, g) => v + g.admittedTrips, 0))} / ${n(groups.reduce((v, g) => v + g.trips, 0))}`
  })]
})
const statuses = { excluded: 'Excluded', 'inactive-on-validation-dates': 'Inactive on both dates',
  'partially-admitted': 'Partially admitted', 'admitted-all-dated-trips': 'All dated trips admitted' }
const sourceStatus = `${lines.filter(l => l.routeIds.length).length} source records have a route-identity candidate; ${lines.filter(l => l.admittedRouteIds.length).length} support at least one admitted journey; ${lines.filter(l => !l.routeIds.length).length} have no matched canton-serving route identity.`
const districtRows = summary.districts.map(d => [d.district, d.calledPlatforms, d.routeIds.length,
  ...reports.map((_, i) => routes.filter(r => d.routeIds.includes(r.id) && r.days[i].admittedTrips).length)])
const failureReasons = [...new Set(reports.flatMap(r => Object.keys(r.pairFailures)))].sort()
const failureRows = failureReasons.map(reason => [reason, ...reports.map(r => {
  const p = r.pairFailures[reason]; return p ? `${n(p.directedPairs)} / ${n(p.segmentOccurrences)}` : '0 / 0'
})])
const doc = `# Fribourg / Freiburg cantonal source study

Fixture audit: **8 September 2026**. Starting point: [Swiss transit source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#fr).

The entire canton is inventoried against the pinned annual national GTFS: **${summary.routeCount} route records, ${summary.agencyCount} agency identities and all seven districts**, including detached territories and complete out-of-canton journeys. The regional feed admits **${n(days[0].admittedTrips)} Friday journeys and ${n(days[1].admittedTrips)} Sunday journeys** with complete directed stop patterns from cantonal lines and explicitly tagged inferred OSM road fallback. This is partial geometry admission, not full service coverage. One route is a provisional geographic member because its sole in-canton platform is within a metre of the boundary; see below.

The [regional feed index](../data/fribourg-region/index.json) points to both civil-day manifests, twelve two-hour chunks per date, and 06:45–08:45 extracts. It uses the existing network snapshot format, **not a new GTFS ZIP**. It is saved under \`data/\` as a **local archival research artifact**. The exact matching cantonal OGD service explicitly permits attributed vector redistribution. Geometry vintage and physical direction remain unverified; this archival study is not added to public hosting or the application's study selector.

## Deliverables and scope

- [Every admitted, partly admitted, excluded and inactive route](FRIBOURG-ROUTE-INVENTORY.md); [machine-readable routes](../data/fribourg-audit/routes.json).
- [Source feature inventory](../data/fribourg-audit/source-lines.json): all 128 records, raw timetable fields, operator/line interpretation, source geometry size, candidate routes and routes retaining at least one admitted official segment.
- [Friday directed-pattern and pair audit](../data/fribourg-audit/2026-09-04.json), [Sunday audit](../data/fribourg-audit/2026-09-06.json), [summary](../data/fribourg-audit/summary.json), [in-canton stop records](../data/fribourg-audit/stops.json).
- [Acquisition evidence](../data/fribourg-sources/acquisition.json), [source dates/credits/terms](../data/fribourg-sources/sources.json), [reviewed mapping policy](../data/fribourg-policy.json).

Every annual trip with at least one original GTFS call coordinate inside the unsimplified swissBOUNDARIES3D Fribourg polygon contributes to membership. No operator whitelist, tariff-zone rectangle or geometry match selects the denominator. The census scans **${n(summary.census.stopTimeRows)} national stop-time rows**; route membership includes inactive annual records. Full calls outside Fribourg are retained on the two validation dates. District route counts overlap because journeys can serve several districts.

${table(['District', 'Called in-canton platforms (annual)', 'Annual routes', 'Routes admitting Friday trips', 'Routes admitting Sunday trips'], districtRows)}

The source is the national fixed-stop timetable, not a verified census of every real-world service. School, seasonal, night, replacement bus, lake, funicular and cableway records present in the archive are included; services absent from that archive and GTFS-Flex service areas remain outside its evidence. Agency 3004 (Fribourg funicular) is present in the annual inventory but inactive on both fixture dates. This is not an assertion about its year-round operation.

### Boundary sensitivity

The canton and district polygons retain all rings and disconnected components. Source geometry is original LV95 XY; GTFS WGS84 points are classified using the repository's metre-level swisstopo approximation. Nine stop records within ten metres of the boundary are retained in the summary, on both sides, including parent records. **PostAuto 661 (\`96-247-j26-1\`) has only Sassel, Chapalettaz platform \`ch:1:sloid:70404:0:710788\` inside, at approximately 0.17 m from the polygon edge.** Its geographic membership remains excluded from feed admission even if road geometry is available, pending a higher-accuracy coordinate/boundary review. The other 206 route memberships have at least one platform beyond that uncertainty band. Route 661 is excluded from the geometry feed. The polygon is not buffered to hide this ambiguity.

## Friday and Sunday validation

Civil days are **Friday 4 September and Sunday 6 September 2026**, with calendar exceptions and preceding-service-day carry-in. Frequency templates are expanded according to GTFS \`exact_times\`; representative headway instances are counted separately from scheduled journeys. The same route, direction ID and **full ordered original platform IDs**, including repeats, define a directed pattern. Direction 0 and 1 are never merged or assumed to be simple reversals.

${table(['Measure', 'Friday 2026-09-04', 'Sunday 2026-09-06'], [
  measure('Civil trip instances', 'trips'), measure('Scheduled instances', 'scheduledTrips'), measure('Representative headway instances', 'representativeHeadwayTrips'),
  ['Admitted instances before OSM fallback', ...reports.map(r => n(r.roadEffect.officialCoverage.admittedTrips))],
  ['Additional admitted instances from OSM fallback', ...reports.map(r => n(r.roadEffect.newlyAdmittedTrips))],
  measure('Admitted scheduled instances', 'admittedScheduledTrips'), measure('Admitted headway instances', 'admittedRepresentativeHeadwayTrips'),
  measure('Directed patterns tested', 'patterns'), measure('Complete/admitted directed patterns', 'admittedPatterns'),
  ['Matched unique directed route/platform pairs', ...days.map(d => `${n(d.matchedDirectedPairs)} / ${n(d.directedPairs)} (${pct(d.matchedDirectedPairs, d.directedPairs)})`)],
  ['Matched scheduled segment occurrences (before whole-pattern exclusion)', ...days.map(d => `${n(d.matchedScheduledSegmentOccurrences)} / ${n(d.scheduledSegmentOccurrences)} (${pct(d.matchedScheduledSegmentOccurrences, d.scheduledSegmentOccurrences)})`)],
  ['Matched occurrences including representative headways', ...days.map(d => `${n(d.matchedSegmentOccurrences)} / ${n(d.segmentOccurrences)} (${pct(d.matchedSegmentOccurrences, d.segmentOccurrences)})`)],
  measure('Segment occurrences retained in admitted complete journeys', 'admittedSegmentOccurrences'),
  ['Inferred road occurrences retained in admitted journeys', ...reports.map(r => n(r.roadEffect.admittedSegmentOccurrences))],
  ['Official-only matched directed pairs before OSM fallback', ...reports.map(r => `${n(r.roadEffect.officialCoverage.matchedDirectedPairs)} / ${n(r.roadEffect.officialCoverage.directedPairs)}`)],
  ['Carry-in instances / admitted', ...reports.map(r => `${r.carryInTrips} / ${r.admittedCarryInTrips}`)],
  ['Night instances / admitted', ...reports.map(r => `${r.directedPatternChecks.nightRouteTrips} / ${r.directedPatternChecks.admittedNightRouteTrips}`)],
  ['Patterns revisiting platforms / admitted', ...reports.map(r => `${r.directedPatternChecks.patternsRevisitingPlatforms} / ${r.directedPatternChecks.admittedPatternsRevisitingPlatforms}`)],
])}

There are **${summary.weekdaySundayPatterns.shared} shared patterns, ${summary.weekdaySundayPatterns.weekdayOnly} Friday-only patterns and ${summary.weekdaySundayPatterns.sundayOnly} Sunday-only patterns**. These comparisons include failed and headway patterns. A matched segment in a failed journey contributes to source coverage, but that journey is excluded in full. Thus source-pair coverage must not be presented as the percentage of service admitted. Every segment actually emitted in the feed has geometry.

The Friday civil day ends before Friday-night departures after midnight; Sunday includes Saturday-night carry-in. Two September dates establish neither public-holiday nor winter/summer/year-round completeness. No authenticated realtime data or vehicle GPS positions are used.

## Source adapter and identity

The [cantonal ArcGIS layer](https://map.geo.fr.ch/arcgis/rest/services/PortailCarto/Theme_mobilite/MapServer/2) contains **128 lines**: bus and rail centrelines. Retrieval requests object IDs and a count independently, downloads explicit pages of 50 IDs in EPSG:2056, verifies every ID exactly once, rejects transfer-limit/error/invalid-coordinate responses and compares IDs again after acquisition. Original response bytes and SHA-256 hashes are retained; an ID-stable service is not an immutable historical snapshot. \`OBJECTID\` is used only within that hashed acquisition.

${sourceStatus}

- \`20.002\` is timetable field 20.002. Its reviewed TPF bus interpretation maps to display line **2**, agency **834**; it is not parsed as a decimal passenger number. Prefixes 10, 20 and 30 are accepted only for reviewed bus records.
- TPF rail uses agency **53**, buses **834**; \`Post Auto\` and \`Car Postal\` map to **801**. SBB, BLS and MOB remain separate identities. Replacement agencies never inherit their parent brand's paths.
- Named night labels in \`NOM_LIGNE\` take priority: field 20.143 maps to **N1**, and the source's regionally typed field 20.463 maps to **N24**. Anonymous Noctambus records remain unresolved. Source field 20.922 links to PDF 30.922; the raw mismatch is retained, while its explicit **M22** label controls the candidate match.
- Features 43–45 say \`Autre\`. The preserved official 2026 timetable PDFs identify **VMCV 213, 216, 217 (agency 876)**. Feature 3's field 254 PDF identifies **TPF RE2/RE3**. Exceptions require the exact source number, name, enterprise and mode. PDF identity evidence does not extend the source geometry to missing termini such as Broc-Chocolaterie.
- Explicit rail labels such as S20/S21 and R8 are matched exactly. Generic IC/IR, RE or Regio fields and unlabelled MOB services do not become universal rail graphs. No global nearest-line match or cross-operator cantonal geometry borrowing is used. The road fallback below is separately attributed and binds to the original agency and complete route/platform patterns.

Graph vertices join at identical LV95 coordinates, with one disclosed precision repair: source feature 22 (TPF line 9) has two components ending **11.22 mm apart** near Charmettes. The adapter moves only the pinned first vertex of part 0 onto the original last vertex of part 2. The original geometry hash, both coordinates and vertex indices are asserted before applying it; original source bytes remain unchanged. This is **inferred topology**, not a surveyed connection. Every affected route journey carries a geometryInference marker. No general nearest-endpoint bridge or crossing-node inference is added. Ordered calls orient each inferred path along the undirected source centreline. Bus projection limit: **80 m**; rail: **120 m**. Paths exceeding the greater of **4.5× straight-line distance** or **1,200 m bus / 3,000 m rail** are rejected. An alternative source-part projection is considered only within **5 m** of the nearest gap after a topology/detour failure. Collapsed paths are rejected. Endpoint connectors are bounded projections, not observed vehicle tracks. Output uses the shared approximate LV95/WGS84 transform and seven-decimal coordinates without line simplification.

Road one-way legality, rail running-track choice, bridge/tunnel topology and temporary diversions are **not certified** by these undirected source records. Exact source topology prevents invented connections at visual crossings, but does not prove physical direction. Original repeated calls remain in each pattern. Reservation/on-demand pickup or drop-off excludes an entire journey; none is silently converted to an ordinary fixed departure.

GTFS times remain unchanged. Among admitted journeys there are **${n(reports[0].timing.zeroDurationSegmentOccurrences)} Friday and ${n(reports[1].timing.zeroDurationSegmentOccurrences)} Sunday zero-duration segments**, of which ${n(reports[0].timing.zeroDurationOver100m)} / ${n(reports[1].timing.zeroDurationOver100m)} exceed 100 m of source centreline. Minute-rounded equal timestamps are not instantaneous-speed measurements; a renderer may jump at those transitions. Maximum positive-duration implied speeds are ${reports[0].timing.maximumPositiveDurationSpeedKmh.toFixed(1)} / ${reports[1].timing.maximumPositiveDurationSpeedKmh.toFixed(1)} km/h across all admitted modes. The Sunday maximum is TPF bus 544, Domdidier, gare → Avenches, Le Paon (2,668 m in a published 60 s interval); it is a source-time plausibility flag, not a validated bus speed. Geometry admission does not certify travel-time precision. No travel-time smoothing or invented call times are applied.

## Admission and exclusions

${table(['Agency ID', 'National feed identity', 'Annual route records', 'Friday admitted / all instances', 'Sunday admitted / all instances'], agencyRows)}

${table(['Route status across both dates', 'Records'], Object.entries(summary.routesByStatus).map(([status, count]) => [statuses[status], count]))}

${table(['Failed segment reason', 'Friday directed pairs / occurrences', 'Sunday directed pairs / occurrences'], failureRows)}

Failures remain route-scoped and directed. The machine audit names both original platforms and records projection gaps, detour lengths and fallback projection choices when available. \`missing-line\` means no verified source identity; it does not claim that a road or railway is absent. \`endpoint-gap\`, \`disconnected-line\`, \`implausible-detour\` and \`collapsed-path\` cause whole-pattern exclusion. Night, replacement, mountain and boat services are not silently dropped from the denominator. This adapter supplies no boat or mountain-mode geometry, and no rail geometry is repurposed for replacement buses.

### Geometry follow-up

Before the OSM supplement, the line 9 precision repair is evaluated against an unmodified-source baseline on each date. It adds **${reports[0].topologyRepairEffect.newlyAdmittedTrips} Friday / ${reports[1].topologyRepairEffect.newlyAdmittedTrips} Sunday complete journeys**, losing none. Source feature 22's affected route graphs admit ${reports[0].topologyRepairEffect.repairedAdmittedTrips} / ${reports[1].topologyRepairEffect.repairedAdmittedTrips} journeys after the repair; remaining extensions still fail the normal projection limits. The daily audit preserves baseline failed pairs and before/after counts.

The [reproducible topology diagnostic](../data/fribourg-audit/topology-followup.json) found a **9.024 m** break in line 1 (feature 128), a **561.161 m** component separation in line 2 (feature 16), and three components in S20/S21 (feature 10), with nearest separations of 0.026 m and 0.040 m. These remain unchanged: the bus breaks exceed the precision-repair limit, and the rail junction needs a separate topology review. Rail station/terminal projection failures also remain. The later road supplement can cover bus source gaps using actual inferred road paths; it does not alter these original source geometries.

### Complete bus-pattern road supplement

The [road adapter](../scripts/fribourg-road-geometry.mjs) prepares all **${summary.sources.roads.completePatternsTested} distinct full bus patterns** across both civil days and six active bus agency identities: TPF, PostAuto, VMCV and the three active replacement operators. Inactive annual agencies remain in the canton census. All source calls, out-of-canton termini, repeated platforms, short branches and night patterns are retained. Routing-only carry-in timestamps are shifted by whole days to satisfy GTFS input constraints; delivered timestamps are unchanged.

The matcher uses the pinned Geofabrik Switzerland **2 September 2026** road extract plus the **8 September 2026** border extract, SHA-256 **${summary.sources.roads.source.osmSha256}**, and pfaedle commit **${summary.sources.roads.source.matcherCommit}**. The copied configuration, binary hash, routing inputs, shapes, trips, stop times, complete warning logs and run hashes are retained in [road evidence](../data/fribourg-road-evidence). The checker reimports those outputs and verifies every emitted inferred segment against them.

A failed cantonal pair receives a road path only when **every complete pattern context containing the same agency/route/directed-platform pair has a valid, identical path**. A successful context cannot hide a failed context. Differing branch paths remain rejected; no context exception is added. Source-matched pairs retain their original paths. Explicit pfaedle fallback hops are rejected even if the matcher writes a straight segment. Monotone shape-distance slicing preserves direction and loops. Road projection is limited to 120 m; simplification is 5 m, followed by the stricter final detour guard of max(600 m, 3 × direct distance). These tolerances apply to inferred roads, separately from the cantonal 80 m bus projection guard.

${table(['Measure', 'Friday', 'Sunday'], [
  ['All bus instances', ...reports.map(r => n(r.groups.filter(g => g.id.endsWith(':bus')).reduce((v, g) => v + g.trips, 0)))],
  ['Admitted bus instances', ...reports.map(r => n(r.groups.filter(g => g.id.endsWith(':bus')).reduce((v, g) => v + g.admittedTrips, 0)))],
  ['Additional admitted journeys', ...reports.map(r => n(r.roadEffect.newlyAdmittedTrips))],
  ['Road-backed directed pairs', ...reports.map(r => n(r.roadEffect.matchedDirectedPairs))],
  ['Lost previously admitted journeys', ...reports.map(r => n(r.roadEffect.lostAdmittedTrips))],
  ...[...new Set(reports.flatMap(r => r.directedPairs.map(p => p.roadFallback?.reason).filter(Boolean)))].sort().map(reason => [reason + ' — remaining directed pairs', ...reports.map(r => r.directedPairs.filter(p => p.roadFallback?.reason === reason).length)]),
])}

The original cantonal failure is preserved as officialFailure and the road assessment records all contributing full pattern IDs. Journeys record their inferred segment count and geometry source. Reservation/on-demand calls, GTFS demand-responsive type 715 and provisional boundary route 661 remain excluded. The OSM profile uses bus/PSV access and direction tags with penalties; **it does not enforce an absolute one-way prohibition**. Physical legality, temporary restrictions and actual operator routing remain unverified. Complete directed stop matching is not a claim of certified road direction.

![Urban corridor geometry review](assets/fribourg-road-review.svg)

The four urban panels were rendered and visually inspected for continuity, extent and original/fallback separation; they are not independent operator evidence. Both dates and all other bus patterns are covered by the automated full-sequence and retained-output checks. Remaining larger exclusion groups include one direction of TPF 3, PostAuto 121, VMCV branches and Sunday replacement patterns; every failed pair and trip count remains in the machine audit.

## Dates, reuse and attribution

${table(['Source', 'Pinned date / vintage', 'Attribution / reuse'], [
  ['National GTFS', 'Feed 20260902; valid 2025-12-14–2026-12-12', 'opentransportdata.swiss; processed by Gleislicht; platform terms, not an assigned CC licence'],
  ['Fribourg line layer', `${summary.sources.acquiredAt}; actual geometry vintage unknown`, 'Source: Etat de Fribourg; free use, sharing and reuse under dataset OGD terms'],
  ['Embedded Esri metadata', 'Created 2022-07-14', 'Metadata creation, not geometry vintage'],
  ['OGD catalogue item', `Created ${summary.sources.reuseEvidence.catalogueCreated}; modified ${summary.sources.reuseEvidence.catalogueModified}`, 'Catalogue timestamps, not geometry vintage'],
  ['OSM road supplement', 'Swiss extract 2026-09-02; border retrieved 2026-09-08', '© OpenStreetMap contributors; ODbL 1.0; inferred geometry database'],
  ['swissBOUNDARIES3D', '2026-01; original canton and seven district polygons', '© swisstopo; free geodata terms'],
  ...summary.sources.crosswalkSupportingDocuments.map(d => [d.file, `Timetable 2026; state ${d.dataUpdated}`, 'Official tp-info / oev-info timetable; identity evidence only']),
])}

GTFS SHA-256: \`${summary.sourceHashes.archive}\`. Decoded source snapshot: \`${summary.sourceHashes.source}\`. The acquisition and feed metadata retain every raw-response hash, URL and UTC retrieval timestamp. Mutable PDF URLs and live ArcGIS responses are not claimed to be permanent release URLs. Refreshing either source requires a new census, mapping review and both full directed-pattern validations.

The [dataset catalogue item](https://maps.fr.ch/portal/sharing/rest/content/items/518a09fdd5874b76b6eacfb0fe2bb8ec?f=pjson) explicitly permits free use, sharing and reuse with **Source: Etat de Fribourg** attribution. Its title incorrectly says stops, but its service URL and serviceItemId identify the service containing [polyline layer 1](https://maps.fr.ch/ags/rest/services/OpenData/Lignes_de_transport_public/FeatureServer/1). An independent complete query matches **all 128 geometries, vertex-for-vertex, and every original attribute** to the original MapServer snapshot; the OGD response adds the numeric TYPE_LIGNE field. The reproduction checks reject changed terms, missing/duplicate features, altered identities and even millimetre coordinate changes. Both raw snapshots and the catalogue/service metadata are preserved. **The vector reuse question is resolved**, without assigning a Creative Commons licence or relying on an uncertain ordinance product mapping.

The earlier [portal terms](https://map.geo.fr.ch/help/fr/conditions_utilisation.htm) and [geoinformation ordinance](https://bdlf.fr.ch/api/fr/versions/8468/pdf_file_with_annexes) remain supporting evidence. The linked [geocat record](https://www.geocat.ch/geonetwork/srv/fre/catalog.search#/metadata/d578f90c-348f-41de-80be-4385a57605b9) did not yield XML during the follow-up (HTTP 403/500 or a login page). Neither service declares a geometry update date; the OGD catalogue's July 2026 modification timestamp must not be presented as line vintage.

Timetable reuse follows the [national platform terms](https://opentransportdata.swiss/en/terms-of-use/); boundary reuse follows [swisstopo's terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices). The [OSM copyright terms](https://www.openstreetmap.org/copyright) require attribution and ODbL share-alike for derived data. The combined derived geometry database is offered under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), with the full derived road cache retained; this does not relabel the separate timetable or boundary sources. These credits are distinct and are embedded in both manifests and the feed's source record. No live-service accuracy or real-time position claim is made.

## Reproduction and checks

From the repository root (Node 24+, installed dependencies, Python 3, curl and unzip):

\`\`\`sh
# Offline source-byte verification and deterministic decoding.
python3 scripts/prepare-fribourg-sources.py --offline

# Full national census; temporary cache stays outside public hosting.
node --max-old-space-size=8192 scripts/fribourg-timetable.mjs \\
  /private/tmp/GTFS_FP2026_20260902.zip /private/tmp/fribourg-timetable.json.gz

# Both civil-day feeds and complete route/pattern audit using the committed road cache.
node --max-old-space-size=8192 scripts/build-fribourg-region.mjs \\
  --archive /private/tmp/GTFS_FP2026_20260902.zip \\
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
node scripts/fribourg-road-geometry.mjs prepare \\
  /private/tmp/fribourg-timetable.json.gz /private/tmp/fribourg-road-feed
for agency in 834 876 7223 7231 801 7040; do
  node scripts/match-postbus-roads.mjs \\
    --pfaedle /private/tmp/gleislicht-pfaedle/build/pfaedle \\
    --config data/fribourg-road-evidence/pfaedle.cfg \\
    --osm /private/tmp/gleislicht-postbus-roads.osm.pbf \\
    --feed /private/tmp/fribourg-road-feed/$agency \\
    --output /private/tmp/fribourg-road-matched/$agency
done
node scripts/fribourg-road-geometry.mjs import \\
  /private/tmp/fribourg-road-feed /private/tmp/fribourg-road-matched

# Fresh acquisition changes hashes and requires renewed source review.
python3 scripts/prepare-fribourg-sources.py --boundary \\
  /private/tmp/swissboundaries3d-2026/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg
\`\`\`

The checker independently reconciles all routes, source identities, seven districts, both pattern sets and directed-pair occurrence counts. It reconstructs both full-day feeds from all 24 chunks, checks chunk hashes and trip identity, validates full original call counts, path direction, finite coordinates and ordered times, and reconciles every admitted pattern against the manifest. Focused tests cover source paging failures, coordinate-order errors, detached territory membership, bus/night/rail identity collisions, changed operator overrides, reverse/loop call chains, disconnected lines and whole-journey exclusion. Shared Bern behavior is regression-tested because Fribourg reuses its census, topology, calendar/frequency and snapshot validators.
`
await writeFile('docs/FRIBOURG-STUDY.md', doc)

const routeRows = routes.map(r => [r.agencyId, r.name, r.id, r.mode, r.districts.join(', '),
  r.sourceLines.join(', ') || '—', ...r.days.map(d => `${d.admittedTrips}/${d.trips}; ${d.admittedPatterns}/${d.patterns}`),
  `${statuses[r.status]}${r.boundarySensitive ? '; boundary-sensitive' : ''}`])
const inventory = `# Fribourg: complete annual route admission inventory

Generated from the [Fribourg audit](FRIBOURG-STUDY.md). Every one of the ${routes.length} annual canton-serving route records occurs once; agencies are feed identities, not counts of legal companies. Trip counts include representative headways. Each daily cell is **admitted/all trip instances; admitted/all directed patterns**. Zero/zero means inactive on that civil day, not absent from the annual feed. Source IDs refer to the 128-feature hashed ArcGIS snapshot. Districts are annual membership and overlap. PostAuto 661 is explicitly provisional at a sub-metre boundary; it is not admitted.

${table(['Agency', 'Line', 'GTFS route ID', 'Mode', 'Districts', 'Source feature IDs', 'Friday trips; patterns', 'Sunday trips; patterns', 'Status'], routeRows)}

## Every source feature

${table(['Snapshot ID', 'Timetable field', 'Source operator / type', 'Source name', 'Candidate routes', 'Routes with admitted trips', 'Unmapped reason'], lines.map(l => [l.OBJECTID, l.NUMERO_LIGNE, `${l.ENTREPRISE_VALEUR} / ${l.TYPE_LIGNE_VALEUR}`, l.NOM_LIGNE, l.routeIds.join(', ') || '—', l.admittedRouteIds.join(', ') || '—', l.exclusionReason || '—']))}
`
await writeFile('docs/FRIBOURG-ROUTE-INVENTORY.md', inventory)
console.log(`Documented ${routes.length} routes, ${lines.length} source features and both directed-pattern audits`)
