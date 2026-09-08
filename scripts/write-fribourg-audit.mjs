import { readFile, writeFile } from 'node:fs/promises'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const summary = await json('data/fribourg-audit/summary.json')
const routes = await json('data/fribourg-audit/routes.json')
const lines = await json('data/fribourg-audit/source-lines.json')
const works = await json('data/fribourg-audit/works.json')
const railReview = await json('data/fribourg-audit/rail-review.json')
const bulle = await json('data/fribourg-audit/bulle.json')
const bulleRegression = await json('data/fribourg-audit/bulle-regression.json')
const portalban = await json('data/fribourg-audit/portalban.json')
const portalbanRegression = await json('data/fribourg-audit/portalban-regression.json')
const boltigen = await json('data/fribourg-audit/boltigen.json')
const boltigenRegression = await json('data/fribourg-audit/boltigen-regression.json')
const broc = await json('data/fribourg-audit/broc.json')
const brocRegression = await json('data/fribourg-audit/broc-regression.json')
const laupen = await json('data/fribourg-audit/laupen.json')
const laupenRegression = await json('data/fribourg-audit/laupen-regression.json')
const jongny = await json('data/fribourg-audit/jongny.json')
const jongnyRegression = await json('data/fribourg-audit/jongny-regression.json')
const montCarmel = await json('data/fribourg-audit/mont-carmel.json')
const terminalRegression = await json('data/fribourg-audit/mont-carmel-regression.json')
const avry = await json('data/fribourg-audit/avry.json')
const regression = await json('data/fribourg-audit/rail-review-regression.json')
const bernPlatforms = await json('data/fribourg-audit/bern-platforms.json')
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

Fixture audit updated: **9 September 2026**. Starting point: [Swiss transit source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#fr).

The entire canton is inventoried against the pinned annual national GTFS: **${summary.routeCount} route records, ${summary.agencyCount} agency identities and all seven districts**, including detached territories and complete out-of-canton journeys. The regional feed admits **${n(days[0].admittedTrips)} Friday journeys and ${n(days[1].admittedTrips)} Sunday journeys** with complete directed stop patterns from cantonal lines and explicitly tagged inferred OSM road and FOT/SBB rail fallback. This is partial geometry admission, not full service coverage. One route is a provisional geographic member because its sole in-canton platform is within a metre of the boundary; see below.

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
  ['Additional admitted instances from rail fallback including reviewed mappings', ...reports.map(r => n(r.railEffect.newlyAdmittedTrips))],
  measure('Admitted scheduled instances', 'admittedScheduledTrips'), measure('Admitted headway instances', 'admittedRepresentativeHeadwayTrips'),
  measure('Directed patterns tested', 'patterns'), measure('Complete/admitted directed patterns', 'admittedPatterns'),
  ['Matched unique directed route/platform pairs', ...days.map(d => `${n(d.matchedDirectedPairs)} / ${n(d.directedPairs)} (${pct(d.matchedDirectedPairs, d.directedPairs)})`)],
  ['Matched scheduled segment occurrences (before whole-pattern exclusion)', ...days.map(d => `${n(d.matchedScheduledSegmentOccurrences)} / ${n(d.scheduledSegmentOccurrences)} (${pct(d.matchedScheduledSegmentOccurrences, d.scheduledSegmentOccurrences)})`)],
  ['Matched occurrences including representative headways', ...days.map(d => `${n(d.matchedSegmentOccurrences)} / ${n(d.segmentOccurrences)} (${pct(d.matchedSegmentOccurrences, d.segmentOccurrences)})`)],
  measure('Segment occurrences retained in admitted complete journeys', 'admittedSegmentOccurrences'),
  ['Inferred road occurrences retained in admitted journeys', ...reports.map(r => n(r.roadEffect.admittedSegmentOccurrences))],
  ['Inferred rail occurrences retained in admitted journeys', ...reports.map(r => n(r.railEffect.admittedSegmentOccurrences))],
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

GTFS times remain unchanged. Among admitted journeys there are **${n(reports[0].timing.zeroDurationSegmentOccurrences)} Friday and ${n(reports[1].timing.zeroDurationSegmentOccurrences)} Sunday zero-duration segments**, of which ${n(reports[0].timing.zeroDurationOver100m)} / ${n(reports[1].timing.zeroDurationOver100m)} exceed 100 m of source centreline. Minute-rounded equal timestamps are not instantaneous-speed measurements; a renderer may jump at those transitions. Maximum positive-duration implied speeds are ${reports[0].timing.maximumPositiveDurationSpeedKmh.toFixed(1)} / ${reports[1].timing.maximumPositiveDurationSpeedKmh.toFixed(1)} km/h across all admitted modes. These are source-time plausibility flags, not validated vehicle speeds. The rail follow-up rejects the approximately 41 km FOT alternative between Olten and Aarau; its 306.7 km/h implied maximum exposed a detour that the initial 4.5× guard would have accepted. Geometry admission does not certify travel-time precision. No travel-time smoothing or invented call times are applied.

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

The matcher uses the pinned Geofabrik Switzerland **2 September 2026** road extract plus the **8 September 2026** border extract, SHA-256 **${summary.sources.roads.source.osmSha256}**, and pfaedle commit **${summary.sources.roads.source.matcherCommit}**. The copied configuration, binary hash, routing inputs, shapes, trips, stop times, complete warning logs and run hashes are retained in [road evidence](../data/fribourg-road-evidence). The checker reimports those outputs and verifies emitted pfaedle segments against them. The separately hashed Mont-Carmel, Jongny, Laupen and Broc reviews below reconstruct their source paths directly from retained OSM XML; rejected pfaedle geometry remains excluded.

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

The four updated urban panels and the Mont-Carmel terminal diagram were rendered and visually inspected for continuity, direction arrows, original endpoints and source/fallback separation; they are not independent operator evidence. Both dates and all other bus patterns are covered by the automated full-sequence and retained-output checks. The Mont-Carmel review below resolves the remaining TPF 3 terminal pair. The Jongny review below also resolves the remaining VMCV 213/216/217 gaps. The Laupen review below resolves PostAuto 121; remaining larger exclusion groups include Sunday replacement patterns; every failed pair and trip count remains in the machine audit.

### Mont-Carmel: directed terminal review for TPF 3

The original final pair \`ch:1:sloid:87238:0:15107 → ch:1:sloid:87238:0:15108\` has two distinct Mont-Carmel platforms. The cantonal source misses an endpoint by 212.1 m, and pfaedle rejects the final hop in both contributing full patterns. Neither original failure is erased or converted into a straight line. The [review policy](../data/fribourg-mont-carmel-policy.json) inventories all **${montCarmel.policy.patterns.length} complete route-3 patterns**, including the two unaffected reverse patterns. Only the final directed pair in the two contributing patterns can receive the new source-backed path; earlier, repeated, intermediate or changed platform contexts fail review.

The [retained OSM API response](../data/fribourg-mont-carmel-sources/map.osm.gz) supplies three connected road ways, their original node identities and all ${montCarmel.geometry.restrictionRecordsChecked} turn restrictions returned for the bounding box. The accepted **${montCarmel.geometry.lengthMetres.toFixed(1)} m** path follows one-way approach **1097802067**, the forward arc of roundabout **55700630**, then one-way exit **1095950865**. All three are tagged with trolley wires. The adapter rejects changed direction, missing shared nodes, conditional or restricted access, absent trolley wires and any returned restriction touching the selected ways or nodes. Exact source stop-position nodes have UIC 8587238; their connectors to the untouched GTFS platform coordinates measure **${montCarmel.geometry.attachmentsMetres.map(m => m.toFixed(1)).join(' / ')} m**, within a dedicated 15 m limit. No duplicate-name call is collapsed.

The [TPF operator page](https://www.tpf.ch/fr/horaires-et-reseaux/horaire-par-reseaux/agglo), retained with its hash, identifies line 3 as Mont-Carmel–Charmettes for the timetable starting 14 December 2025. Four OSM route relations support the arrival/departure stop identities, but their **j23 GTFS references are historical** and do not prove current operations or the turnaround. The [26 May 2026 municipal notice](https://www.givisiez.ch/article/deplacement-provisoire-de-larret-de-bus-mont-carmel-26052026) concerns a temporary stop displacement towards Belfaux; it is retained as context and does not authorize changing the original GTFS coordinates. The inferred terminal movement is not an operator-certified manoeuvre or assurance of temporary road access. OSM edit timestamps are not survey dates.

${table(['Directed OSM way', 'Version', 'Object edited'], montCarmel.geometry.directedSourceSegments.map(s => [s.wayId, s.version, s.timestamp]))}

The [complete terminal audit](../data/fribourg-audit/mont-carmel.json) retains the raw-source hashes, source dates, selected node chain, all restriction records, original failures and full contributing patterns. The two dated feeds add **74 Friday / 72 Sunday journeys**; TPF 3 now admits **147/147 and 143/143**. Every affected timetable journey keeps both terminal calls and their original 60-second interval, with a \`mont-carmel-terminal\` road-review marker. At commit 102d51f, the [Mont-Carmel regression checkpoint](../data/fribourg-audit/mont-carmel-regression.json), against **abd1fd8**, proved all **${n(terminalRegression.days.reduce((n, d) => n + d.previousJourneys, 0))} previous journeys and ${n(terminalRegression.days.reduce((n, d) => n + d.unchangedOriginalSegmentOccurrences, 0))} segment occurrences** retain identical calls, coordinates, permissions, times, directions and geometry.

![Mont-Carmel terminal source review](assets/fribourg-mont-carmel.svg)

### Jongny: independently corroborated VMCV road chain

VMCV **213, 216 and 217** share one failed downhill pair: **Jongny, Châtillon platform 2 → Corsier-Vevey, Cure d’Attalens platform 4**, exact original IDs \`ch:1:sloid:4959:0:2 → ch:1:sloid:4963:0:4\`. The stops are 420.8 m apart. Each original cantonal curve measures approximately **2,003.7 m**, beyond its 4.5× detour guard. All seven pfaedle contexts produced the same shorter **1,818.2 m** path, still beyond the separate 3× road guard. Both original failures remain retained; neither general threshold changes.

The [hashed review policy](../data/fribourg-jongny-policy.json) admits a separately reconstructed **${jongny.geometry.lengthMetres.toFixed(1)} m** source path, with a dedicated **2,050 m maximum**, only for the three exact directed route/platform pairs. Ten connected OSM road sections appear in the same order in all three independently read route relations: **8291117 (213), 8291116 (216), 12495927 (217)**. Each names its exact **j26 GTFS route**, VMCV operator, Vevey destination and the two consecutive source stop nodes. The adapter checks shared nodes, forward travel on one-way roads and the roundabout, ordinary vehicle access and all restrictions returned in the bounding box. This snapshot returns no restriction relations; that is bounded source evidence, not a guarantee that restrictions do not exist. Unknown conditional access, a conflicting relation sequence or an out-of-order called stop prevents admission.

Exact UIC numbers **8504959 / 8504963**, names, route memberships and bounded platform attachments (**${jongny.geometry.attachmentsMetres.map(m => m.toFixed(1)).join(' / ')} m**, maximum 15 m) connect the original calls to source nodes. The complete **${jongny.policy.patterns.length} full route patterns** remain in the policy; all seven contributing contexts must agree. Reverse patterns and previously accepted pairs receive no change. The original pfaedle path remains excluded: its shorter alignment cuts part of the detailed source route.

An independent diagnostic reconstruction of cantonal features **43/44/45** corroborates the longer path. The diagnostic permits a 5× ratio solely to retrieve the rejected source curves for comparison; it cannot admit them. Maximum vertex-to-other-polyline distances in both directions must remain below **10 m**. This check compares original vertices, not surveyed running lanes or continuous physical accuracy.

${table(['Cantonal source', 'Original length', 'Cantonal vertices → OSM curve', 'OSM vertices → cantonal curve'], jongny.cantonalComparison.map(c => [c.sourceId, c.diagnosticLengthMetres.toFixed(1) + ' m', c.cantonalToOsmMetres.toFixed(1) + ' m', c.osmToCantonalMetres.toFixed(1) + ' m']))}

The [official VMCV 2026 network plan](../data/fribourg-jongny-sources/vmcv-network-2026.pdf), valid **14 December 2025–12 December 2026**, was visually inspected. It supports the three line identities and consecutive stop relationship; no schematic geometry is extracted. The operator’s individual line-213 webpage returned HTTP 403 on direct acquisition and is recorded as unused. Source object edits span **2021–2026** and do not establish physical survey dates. Every exact version and timestamp is retained in the [source and full-pattern audit](../data/fribourg-audit/jongny.json). The reviewed path remains inferred centreline geometry, not operator-certified running lanes or temporary access.

The change adds **74 Friday / 57 Sunday journeys**: 213 adds **36 / 21**, 216 adds **19 / 16**, and 217 adds **19 / 20**. All three routes now admit every dated journey: **73/73, 37/37, 38/38 Friday; 42/42, 33/33, 40/40 Sunday**. Original call intervals remain 120 or 180 seconds on Friday and 120 seconds on Sunday, with explicit \`jongny-route-chain\` markers. At commit 71f8a5e, the [Jongny regression checkpoint](../data/fribourg-audit/jongny-regression.json), against **102d51f**, preserves all **${n(jongnyRegression.days.reduce((n, d) => n + d.previousJourneys, 0))} previous journeys and ${n(jongnyRegression.days.reduce((n, d) => n + d.unchangedOriginalSegmentOccurrences, 0))} segment occurrences**, including identical call identities, coordinates, permissions, times, directions and geometry.

![Jongny source-chain and rejected matcher review](assets/fribourg-jongny.svg)

### Laupen: dated western construction bypass for PostAuto 121

All **59 Friday / 20 Sunday** PostAuto 121 journeys originally failed a station pair. The [official construction notice](../data/fribourg-laupen-sources/sense-bridge-works-2025.pdf), page 4, explicitly assigns route 121 and its Cholholz shuttle to **Bauumfahrung West**. The [24 August 2026 update](../data/fribourg-laupen-sources/sense-bridge-update-2026.html) confirms bridge construction during September–December 2026 and planned reopening in summer 2027. The [project corridor description](../data/fribourg-laupen-sources/western-bypass.html) also identifies the temporary Industriestrasse stop. These establish the diversion corridor; their schematic maps provide no geometry.

The [hashed policy](../data/fribourg-laupen-policy.json) and [complete audit](../data/fribourg-audit/laupen.json) retain **29 detailed OSM road ways**, three exact directed platform pairs and all **six full route patterns**. Arrival follows Industriestrasse and the full western bypass to the station's one-way entrance. Departure continues forward around the station loop, returns over the full western bypass and reaches the distinct southbound Tuftera platform through its roundabout. It is not a reversal of the arrival path. Every selected source-node join is exact; one-way roads and roundabouts require forward traversal. Construction roads, parking aisles, conditional/restricted access, barriers and touching returned turn restrictions fail review. This bounding-box response returns zero restriction relations; it does not prove that no restrictions exist.

${table(['Original directed platform pair', 'Source-backed path', 'Original platform attachments', 'Full contexts'], laupen.assessments.map((a, i) => [laupen.policy.pairs[i].stops.map(s => s[4].split(':').at(-1)).join(' → '), a.lengthMetres.toFixed(1) + ' m', a.attachmentsMetres.map(m => m.toFixed(1)).join(' / ') + ' m', a.contributingPatterns.length]))}

Original GTFS station platforms **83983 and 602697** remain separate, with UIC 8570555 OSM stop-position evidence. Tuftera's original calls retain their coordinates and attach to reviewed road nodes within the fixed **15 m** limit. Platform-to-road assignment is inference, not a surveyed platform equivalence. No current OSM bus-121 relation was returned. The independently documented corridor supports the specific **2.0 km arrival / 2.5 km departure ceilings**; general road and cantonal detour guards are unchanged, and both original failures remain in the audit. The original Sense bridge, temporary footbridge and residential shortcuts outside the full western bypass remain excluded.

Two road ways and four nodes were edited on **7 September 2026**, after both fixture dates. The decoder restores their preceding versions from separately retained OSM way records and complete node histories, including two nodes removed from the later way sequences. It checks that all selected road/node versions predate 4 September and that the replaced versions remain valid through 6 September. All six restorations retain selected versions, available current records and next-edit timestamps; complete histories retain the subsequent deletion records for removed nodes. This establishes source-version chronology, not physical survey vintage; the remaining source-object dates and every original response hash are retained.

The [29 May station-access notice](../data/fribourg-laupen-sources/station-entrance-works-2026.html) schedules a full entrance closure and temporary PostAuto stops for **3–14 August**, outside these fixtures, while Neueneggstrasse works continue. No altered stop coordinates or assumed temporary traffic scheme are introduced. This review is restricted to **4 and 6 September 2026** and does not certify that announced construction dates remained unchanged or that the inferred centreline is the operator's exact running lane.

The feed now admits **59/59 Friday and 20/20 Sunday** route-121 journeys, all carrying \`laupen-western-bypass\` markers and retaining their original four- or five-minute station-pair intervals. At commit 4da95ce, the [Laupen regression checkpoint](../data/fribourg-audit/laupen-regression.json), against **71f8a5e**, preserves all **${n(laupenRegression.days.reduce((n, d) => n + d.previousJourneys, 0))} previously admitted journeys and ${n(laupenRegression.days.reduce((n, d) => n + d.unchangedOriginalSegmentOccurrences, 0))} segment occurrences**, including original platform identities, coordinates, permissions, times, directions and paths. The source PDF and the directed geometry diagram were rendered and visually inspected.

![Laupen western bypass and station loop](assets/fribourg-laupen.svg)

### Broc-Village: separate arrival and departure calls on TPF 260

The remaining **20 Friday / 16 Sunday** route-260 journeys contain consecutive Broc-Village calls: unlabelled arrival record \`ch:1:sloid:77727:0:10\`, then departure platform **B**, \`ch:1:sloid:77727:0:19835\`. The [official timetable](../data/fribourg-broc-sources/tpf-260-2026.pdf), valid **27 August–12 December 2026**, retains separate arrival/departure rows. The [undated TPF station plan](../data/fribourg-broc-sources/tpf-platforms.pdf) identifies B for Charmey–Jaun. Both documents were rendered and visually inspected; neither supplies extracted map geometry or assigns the unlabelled arrival record to platform A.

The [review policy](../data/fribourg-broc-policy.json) retains all **ten full route-260 patterns** and admits only the two contexts with the exact Epagny Prâ Dêrê / Broc Le Home neighbours. The original cantonal collapsed-path failure and pfaedle rejection remain retained. The adapter projects the untouched arrival coordinate onto one explicitly reviewed OSM edge, **1395561049 v2**, and follows it forward to stop-position **3313999352**, UIC **8577727**, beside B. This clips **${broc.geometry.sourceMetres.toFixed(1)} m** of source road. Original-call connectors measure **${broc.geometry.attachmentsMetres.map(m => m.toFixed(1)).join(' / ')} m**; total geometry is **${broc.geometry.lengthMetres.toFixed(1)} m**. The scoped limits are **10 m per connector**, **5–20 m of forward source road** and **15–35 m total**. No general short-path exemption, stop merging, station loop or turnaround is introduced.

The [source and pattern audit](../data/fribourg-audit/broc.json) retains the complete raw OSM response, two adjacent roads as context, source fractions, object versions/dates, hashes and attribution. The selected road was edited on **10 April 2026**; all selected context-road/node edits predate the fixtures, without establishing survey vintage. Changed direction, access restrictions, barriers, a touching returned turn restriction or a changed full pattern fails review. The bbox returns no turn restrictions; this is bounded evidence, not a certification of physical access.

Every added journey retains the **480-second interval** between the two calls. This short source-backed connection is a geometric inference between timetable coordinates, **not evidence that the bus moves during its eight-minute wait**, nor a surveyed arrival position. Reverse calls and platform C remain unchanged. Route 260 now admits **85/85 Friday and 69/69 Sunday** journeys. At commit 0f197fb, the [Broc regression checkpoint](../data/fribourg-audit/broc-regression.json), against **4da95ce**, preserves all **${n(brocRegression.days.reduce((n, d) => n + d.previousJourneys, 0))} previously admitted journeys and ${n(brocRegression.days.reduce((n, d) => n + d.unchangedOriginalSegmentOccurrences, 0))} segment occurrences** with identical original calls, times, permissions, directions and geometry. Every addition carries a \`broc-station-calls\` marker.

![Broc arrival-to-platform-B source review](assets/fribourg-broc.svg)

### Boltigen: independently corroborated TPF 259 hairpins

The two full TPF 259 patterns originally failed the directed **Schüpfboden → Schüpfen** and **Schüpfen → Schüpfboden** pairs under the unchanged general road detour guard. The [official TPF timetable](../data/fribourg-boltigen-sources/tpf-259-2026.pdf), valid **14 December 2025–12 December 2026**, confirms both call orders and their respective **one-minute / two-minute intervals**. Both pages were rendered and visually inspected. The retained original platform coordinates differ by direction; the adapter does not reverse one path or merge platforms.

The [hashed review policy](../data/fribourg-boltigen-policy.json) clips the detailed, bidirectional OSM secondary road **584938515**, ref **219**, preserving every intervening source vertex and adding only bounded connectors to the original calls. The complete raw bbox response and selected road/node versions are retained. The road was edited **30 December 2025**; all selected object edits predate both fixtures, without establishing survey vintage. Three OSM platform records provide context only: their identities and heights are not substituted for original GTFS platform records.

An independent decoder extracts exactly **one of 518 line records** from the retained original [Bern OEVTP GeoPackage archive](../data/bern-sources/oevtp.gpkg.zip): **objectid 300, line 20_259, operator TPF, bus type 2**. It matches both original platform pairs under the existing **80 m / 4.5× / 1,200 m** Bern bus guards. Its matched paths corroborate the OSM hairpins by maximum vertex-to-other-polyline distance in both directions. Bern geometry is diagnostic only; the emitted paths retain their **OSM road inference** classification. The other 517 Bern records are excluded from this scoped review.

${table(['Original directed platform pair', 'Emitted OSM path / vertices', 'Original-call attachments', 'Bern→OSM / OSM→Bern maximum vertex gap'], boltigen.assessments.map((a, i) => [boltigen.policy.pairs[i].stops.map(s => s[4].split(':').at(-1)).join(' → '), a.lengthMetres.toFixed(1) + ' m / ' + a.path.length, a.attachments.map(p => p.gapMetres.toFixed(1) + ' m').join(' / '), [a.comparison.bernToOsmMetres, a.comparison.osmToBernMetres].map(m => m.toFixed(1) + ' m').join(' / ')]))}

The scoped limits require **20 m maximum original-call attachment**, **900–1,200 m path length**, and **20 m maximum compared vertex gap in each direction**. Changed route, dates, full contexts, direction, access, missing nodes, post-fixture object edits or independent corridor disagreement fail review. An out-of-order called stop within 50 m of the inferred path also fails. Touching returned turn restrictions are rejected; the bbox returns none, which does not establish their real-world absence. The [complete audit](../data/fribourg-audit/boltigen.json) retains the original rejected road assessments, independent Bern paths, source fractions, source-node order, hashes and attribution. No generic matcher limit changes or lane-accuracy claim is made.

The Boltigen checkpoint admitted **12/12 Friday and 10/10 Sunday** route-259 journeys, bringing the regional feed at that checkpoint to **5,540 / 3,789**. At commit ac4d685, the [Boltigen regression checkpoint](../data/fribourg-audit/boltigen-regression.json), against **0f197fb**, preserves all **${n(boltigenRegression.days.reduce((n, d) => n + d.previousJourneys, 0))} previously admitted journeys and ${n(boltigenRegression.days.reduce((n, d) => n + d.unchangedOriginalSegmentOccurrences, 0))} segment occurrences**, including original calls, times, permissions, directions and geometry. Every addition carries a \`boltigen-corroborated-hairpins\` marker and retains the original direction-specific timetable interval. The geometry diagram was rendered and visually inspected.

![Boltigen directed hairpins and independent Bern comparison](assets/fribourg-boltigen.svg)

### Portalban: school/village street geometry in every context

TPF 544 originally excluded **12 Friday journeys** because its two school/village pairs had different inferred paths in different full-trip contexts. The cantonal source also fails: both calls project towards the same road section, producing collapsed-path assessments. The retained matcher alternatives include a two-point 84.7 m connection and paths of 93.3–105.3 m. These differences are not silently accepted under a generic tolerance.

The [scoped policy](../data/fribourg-portalban-policy.json) retains all **${portalban.policy.patterns.length} full route-544 patterns** and reconstructs the original directed pairs **school 1 → village 15626** and **village 15627 → school 1** from three detailed OSM streets: **43121098 Chemin du Four**, **464228790 Chemin du Ruisseau**, and **1433895409 La Râpe**. Source-node joins at **540239211** and **5141566792** are exact, every intervening vertex is retained, and the distinct original village coordinates remain unchanged. School and village coordinates project only onto their specifically reviewed streets. This is centreline inference with bounded original-call connectors; it does not establish a surveyed school platform, running lane or physical turnaround.

${table(['Original directed pair', 'Reconstructed geometry', 'Original-call attachments', 'Full contributing contexts'], portalban.assessments.map((a, i) => [portalban.policy.pairs[i].stops.map(s => s[4].split(':').at(-1)).join(' → '), a.lengthMetres.toFixed(1) + ' m / ' + a.path.length + ' vertices', a.attachments.map(p => p.gapMetres.toFixed(1) + ' m').join(' / '), a.contributingPatterns.length]))}

All **nine contributing contexts** pass the same independently reconstructed directed street paths. The [complete source/context audit](../data/fribourg-audit/portalban.json) preserves every original matcher path, including terminal and through-school cases. The scope allows at most **10 m per original-call attachment** and **90–130 m total geometry**. A changed complete context, route, fixture date, one-way rule, street identity, missing node, restricted access, barrier or touching returned turn restriction fails review. Other calls within 50 m of the path also fail. General road-consensus limits remain unchanged. The retained bbox returns no restriction relations, which does not prove their physical absence.

The [TPF annual timetable](../data/fribourg-portalban-sources/tpf-544-2026.pdf), created **16 October 2025** and declaring validity **14 December 2025–12 December 2026**, supports both call orders and the **one-minute interval**. Pages 1 and 6 were rendered and visually inspected. It is the PDF linked from the [retained current regional page](../data/fribourg-portalban-sources/tpf-regional-page.html.gz), not proof that no later timetable revisions exist. The indexed PDF claiming validity from 17 August returned [TPF re404 HTML](../data/fribourg-portalban-sources/tpf-timetable-redirect.html); that failed acquisition is retained and excluded from timetable evidence. Actual fixture calls and calendars continue to come from the pinned national GTFS.

Selected OSM street edits range from **15 June 2025 to 17 January 2026**, and all selected node edits predate the fixtures; survey vintage remains unknown. Two village platform nodes are retained as context only. One explicitly says \`physically_present=no\`; neither is substituted for an original GTFS platform, and no source school platform or turning facility is inferred from their presence.

Route 544 now admits **52/52 Friday and 34/34 Sunday journeys**. Sunday contains no school-call pattern; its geometry and admissions remain unchanged. At commit 52a1ae7, the [Portalban regression checkpoint](../data/fribourg-audit/portalban-regression.json), against **ac4d685**, preserves all **${n(portalbanRegression.days.reduce((n, d) => n + d.previousJourneys, 0))} previously admitted journeys and ${n(portalbanRegression.days.reduce((n, d) => n + d.unchangedOriginalSegmentOccurrences, 0))} segment occurrences**, including original calls, times, permissions, directions and geometry. Each addition carries a \`portalban-school-streets\` marker and retains the original 60-second interval. Both directed geometry panels were rendered and visually inspected.

![Portalban original matcher paths and reconstructed street geometry](assets/fribourg-portalban.svg)

### Bulle: directed L/M departures onto the unchanged Vuadens corridor

The remaining route-258 and route-454 failures share a **25-vertex, approximately 3.07 km path from Route de la Pâla to Vuadens**, identical in all six contributing contexts. Only their station-departure portions differ. The [scoped policy](../data/fribourg-bulle-policy.json) retains all **${bulle.policy.patterns.length} full patterns across both route identities**, including reverse and short-working patterns. It changes only **258: platform L (15884) → Vuadens (17067)** and **454: platform M (15898) → Vuadens (17067)**, after checking all three complete contexts for each pair, including journeys arriving from Riaz.

The [official 2026 TPF station plan](../data/fribourg-bulle-sources/tpf-platforms-2026.pdf), created **9 February 2026**, identifies **258 at L** and **454 at M**. It was rendered and visually inspected; no schematic geometry was extracted. The separately retained [older numbered-platform plan](../data/fribourg-bulle-sources/tpf-platforms-legacy.pdf) is excluded from L/M identity evidence. Original GTFS platform labels, IDs, coordinates and times remain unchanged. OSM stop-position **13273200096 / L** and **13273200097 / M** independently carry matching labels, UIC **8577725**, and bus identity.

Each reconstructed departure follows seven source-way sections forward: its own platform lane, the shared TPF station exit, Chemin des Crêts, the roundabout and Route de la Pâla. Across the two paths, **eight complete source ways** supply geometry and **three other ways** provide exit/restriction context. Every traversed source vertex and exact node join is retained. One-way roads and the roundabout are traversed in their source direction. The three used TPF-only ways have \`access=no\` together with explicit \`bus=designated\`; the review requires that bus permission and does not treat them as roads open to all vehicles.

${table(['Original departure', 'Rebuilt local prefix', 'Original-platform connector', 'Join to retained tail', 'Full Bulle–Vuadens geometry'], bulle.assessments.map((a, i) => [i ? '454 / M' : '258 / L', a.prefix.lengthMetres.toFixed(1) + ' m', a.prefix.attachmentMetres.toFixed(1) + ' m', (a.prefix.joinMetres * 100).toFixed(1) + ' cm', (a.lengthMetres / 1000).toFixed(3) + ' km']))}

The limits are **6 m per station-platform attachment**, **180–220 m local prefix**, and **0.1 m at the source/tail join**. All **25 raw suffix vertices remain byte-identical** in the emitted pair; an additional **2.3 cm connector**, also bounded by **0.1 m**, links the coarse final vertex to the original seven-decimal Vuadens coordinate. A changed suffix in even one contributing context fails review. This is a scoped reconstruction at the station, not a general tolerance for differing matcher outputs. The original 3× / 600 m whole-pair detour guard remains unchanged.

The [complete audit](../data/fribourg-audit/bulle.json) retains all six original matcher paths and all **seven returned no-U-turn relations**, checked against the traversed source-way transitions. In particular, the reviewed route enters Chemin des Crêts from the station rather than its opposing roundabout approach, and leaves Route de la Pâla southwest rather than turning back into its opposing entrance. The latter transition also requires agreement between the retained tail heading and the source exit direction. No retained prohibited transition is taken. This bounded check does not certify every real-world or temporary restriction. Changed access, bus designation, platform identity, one-way tags, node joins, source dates, route/date scope or a prohibited transition fails review. Other calls within 50 m of checked prefix vertices also fail.

Selected station-road edits range from **1 November to 16 December 2025**; all selected road/node and retained restriction edits predate the fixtures. Source edit dates do not establish survey vintage. The TPF plan supplies platform identity only, and neither source certifies the operator's precise running lanes or temporary traffic arrangements.

The review adds **9 Friday / 4 Sunday** route-258 journeys and **17 / 10** route-454 journeys. These routes now admit **19/19 and 33/33 Friday journeys**, and **8/8 and 28/28 Sunday journeys**, respectively. All additions retain their original **six-minute Bulle–Vuadens interval** and carry a \`bulle-directed-platform-exit\` marker. The [current regression checkpoint](../data/fribourg-audit/bulle-regression.json), against **52a1ae7**, preserves all **${n(bulleRegression.days.reduce((n, d) => n + d.previousJourneys, 0))} previously admitted journeys and ${n(bulleRegression.days.reduce((n, d) => n + d.unchangedOriginalSegmentOccurrences, 0))} segment occurrences**, including original calls, times, permissions, directions and geometry. Both directed source-comparison panels were rendered and visually inspected.

![Bulle directed platform exits and unchanged common tail](assets/fribourg-bulle.svg)






## Federal railway supplement and dated works review

The [rail adapter](../scripts/fribourg-rail-geometry.mjs) tests **${summary.sources.rail.completePatternsTested} full directed patterns across ${summary.sources.rail.policy.routes.length} annual route identities**: SBB, BLS and explicitly reviewed TPF S20/S21/RE2/RE3. The [complete input call chains](../data/fribourg-rail-inputs.json), [pattern results](../data/fribourg-audit/rail-patterns.json) and [all ${summary.sources.rail.segments} source segment assessments](../data/fribourg-audit/rail-source-segments.json) are retained. Metre-gauge TPF and MOB, gauge-changing GPX and unreviewed TPF special services remain outside this supplement.

The pinned [FOT railway network](https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf) has **${summary.sources.rail.nodes} operating-point nodes and ${summary.sources.rail.segments} infrastructure segments**. Exact operating-point identifiers attach original GTFS platforms within 350 m. No nearest-name station substitute or general platform override is allowed; the hashed Kerzers mappings and Bern western-terminal clipping described below are explicit exceptions. Infrastructure attachments must be within 120 m; source gauge must include 1435 mm and source validity fields must permit both dates. FOT geometry is simplified by 5 m; the reviewed SBB curve retains all 44 input vertices before output-coordinate rounding. The Fribourg supplement rejects paths above max(3,000 m, **2.5 × direct distance**); the stricter guard rejects the implausible approximately 41 km Olten–Aarau alternative. The later reviewed SBB Däniken curve supplies the missing permitted-gauge connection without changing the rejected FOT record.

All full pattern contexts must agree on the same directed source segment chain and path. Other called operating points are blocked when routing an intervening pair, preventing out-of-order shortcuts. Every previously accepted cantonal path is retained. The original failure, directed infrastructure IDs, attachment distances, contributing pattern IDs and resulting geometry hash accompany each inferred pair. A single remaining failure excludes the complete journey. Journeys tag their inferred rail segment count, and the checker reproduces every emitted path from the pinned XTF and, for the reviewed Däniken connection, the retained SBB curve.

${table(['Measure', 'Friday', 'Sunday'], [
  ['All rail instances', ...reports.map(r => n(r.groups.filter(g => g.id.endsWith(':rail')).reduce((v, g) => v + g.trips, 0)))],
  ['Admitted rail instances', ...reports.map(r => n(r.groups.filter(g => g.id.endsWith(':rail')).reduce((v, g) => v + g.admittedTrips, 0)))],
  ['Additional admitted journeys from rail fallback including review', ...reports.map(r => n(r.railEffect.newlyAdmittedTrips))],
  ['FOT-backed directed pairs', ...reports.map(r => n(r.railEffect.matchedDirectedPairs))],
  ['Lost previously admitted journeys', ...reports.map(r => n(r.railEffect.lostAdmittedTrips))],
  ...[...new Set(reports.flatMap(r => r.directedPairs.map(p => p.railFallback?.reason).filter(Boolean)))].sort().map(reason => [reason + ' — remaining directed pairs', ...reports.map(r => r.directedPairs.filter(p => p.railFallback?.reason === reason).length)]),
])}

The [TPF 2026 standard-gauge network statement, version 3.5](../data/fribourg-rail-sources/tpf-network-statement-2026-vn.pdf), dated **1 January 2026**, identifies Fribourg–Morat–Anet and Broc-Chocolaterie–Romont as its normal-gauge network; section 3.5.2 specifies 1435 mm. This supports route gauge review, not a claim that old FOT alignments reflect every rebuilt section. Catalogue date **6 July 2021** and asset update **18 January 2025** remain explicit; September 2026 alignment validity is unknown. Running track, signal direction and actual train paths remain inferred.

TPF's [La Verrerie–Vaulruz-Sud works notice](https://www.tpf.ch/fr/horaires-et-reseaux/perturbations-et-travaux/travaux-sur-le-troncon-ferroviaire-la-verrerie-vaulruz-sud) reports metre-gauge rebuilding during 2025–2027 and **no S50/S51 rail service between Bulle and Semsales after 21:00 on Sunday 6 September 2026**. The [reproducible works audit](../data/fribourg-audit/works.json) retains complete S50/S51 calls from both dates. It finds **${works.assessment[0].eveningCorridorSegments} corridor segment occurrences on ${works.assessment[0].eveningCorridorTrips} Friday trains, and ${works.assessment[1].eveningCorridorSegments} on Sunday**, in the same 21:00–24:00 window. The builder fails if Sunday calls contradict the notice. This is one dated consistency check, not a comprehensive diversion census; replacement bus geometry remains independently assessed by the road adapter. No new FOT paths are admitted on the altered metre-gauge corridor.

The current SBB Avry-Matran supplement resolves the remaining Sunday SN failures. Remaining rail exclusions include most TPF S50/S51, unlabelled TPF special journeys and all MOB/GPX journeys. The route inventory records exact dated counts rather than treating an admitted route label as proof of every branch.

![Rail corridor geometry review](assets/fribourg-rail-review.svg)

The S20, S21, RE2 and IC1 panels were rendered and visually inspected for continuity and source/fallback extent. They show accepted pairs even when another pair excludes the full journey; the graphic is not independent operational evidence.

### Kerzers and Däniken review

The [review policy](../data/fribourg-rail-review-policy.json), [source snapshots](../data/fribourg-rail-review-sources/sources.json) and [complete review audit](../data/fribourg-audit/rail-review.json) pin two independent corrections. Every originally accepted path remains unchanged. The review retains **${railReview.patterns.length} full directed patterns** for IR66 and IC1, including contexts that still fail; all contexts must agree before a directed pair is reused. At commit 007a946 this review added **26 Friday / 25 Sunday journeys** beyond the original FOT supplement; the following Bern review extends admission further.

- **Kerzers:** the [BLS platform table](../data/fribourg-rail-review-sources/bls-platforms-2026.pdf), state 28 May 2026 and valid from 6 June 2026, assigns physical tracks 4 and 6 to the Bern–Neuchâtel line. The [official station plan](../data/fribourg-rail-review-sources/bls-kerzers.svg), version 1.0 dated 9 March 2023, places those tracks on the western branch, separately from tracks 1 and 3. Only IR66 calls at original platforms \`ch:1:sloid:4400:2:4\` and \`ch:1:sloid:4400:3:6\` map to the existing FOT **Kerzers BLS operating point 8516192**. GTFS station identity 8504400, original call IDs, coordinates and times remain intact. Unknown platforms and other routes do not inherit the exception. No connection is invented across the two railway branches. That checkpoint admitted **23/40 Friday and 22/38 Sunday** IR66 journeys; the remaining Bern 49/50 terminal failures are resolved by the separate review below.
- **Däniken:** the original FOT segment \`ch14uvag00087837\` remains rejected with its raw **mm1000** attribute. The independently published [SBB line geometry query](https://data.sbb.ch/api/explore/v2.1/catalog/datasets/linie-mit-polygon/records?where=search%28%22D%C3%A4niken%22%29&limit=100) returns 21 records. Only line **540**, operating points **DK → DKO**, km positions **45673.43 → 46100**, contributes its **44 original vertices** and **N (normal-gauge)** classification. The other 20 query results are inventoried and excluded. Exact named endpoint nodes and bounded attachments (${railReview.attachments.map(m => m.toFixed(1)).join(' / ')} m) bind the curve to the FOT graph; no global gauge relabelling occurs. The review is restricted to IC1 and restores three Olten–Aarau journeys per date within the unchanged 2.5× detour guard.

The BLS table and station plan were visually inspected. The source records, rejected primary rail assessment, reviewed platform IDs or SBB segment identity, full pattern IDs and path hashes remain in the pair audit. Affected journeys carry explicit \`railReviewKinds\` markers. SBB metadata reports processing on **${railReview.source.dataProcessed}** and modification on **${railReview.source.modified}**; neither proves feature survey vintage or a specific train's running track. Geometry credits now include **SBB Infrastructure / data.sbb.ch**, with attribution-required commercial and noncommercial reuse terms preserved. BLS documents are supporting platform evidence rather than a geometry licence.

### Bern western-terminal review

The [August 2026 SBB station plan](../data/fribourg-bern-platform-sources/sbb-bern-plan-2026-08.pdf), exterior plan on page 3, locates tracks **49/50 at the western end** of Bern. Their exact GTFS coordinates are 446.0 / 427.8 m from the FOT station point, beyond the unchanged 350 m guard. The [hashed review policy](../data/fribourg-bern-platform-policy.json) covers only the two original platform IDs, five route identities (IR15, IC1, S1, S2 and IR66), and a **single Bern call at the start or end of the complete journey**. Intermediate, repeated or unknown Bern platform calls receive no exception.

Each eligible platform projects onto one explicitly pinned FOT western approach: Bern–JKLM for IR15/IC1/S1/S2, or Bern–Weyermannshaus for IR66. Projection is limited to **75 m**, and the clipped source length to **200–600 m**. The local graph replaces the Bern station point with the projection, retaining operating-point identity 8507000, clips only the selected approach, and removes **all four original station-centre connections**. This prevents an inferred movement back through the station centre or an invented link to an eastern approach. The original graph, GTFS call coordinates and source bytes remain unchanged. Standard gauge, source validity, the 350 m station / 120 m topology limits and the 2.5× detour guard still apply. The already reviewed Kerzers mapping composes with the IR66 terminal graph.

${table(['FOT approach', 'Track', 'Platform-to-curve connector', 'Source curve trimmed'], bernPlatforms.assessments.map(a => [a.sourceSegmentId, a.stopId.split(':').at(-1), a.projection.attachmentMetres.toFixed(1) + ' m', a.projection.removedMetres.toFixed(1) + ' m']))}

The [full-pattern audit](../data/fribourg-audit/bern-platforms.json) retains ${bernPlatforms.patterns.length} complete directed pattern contexts, all projections, original station/segment identities and prior rail failures. It adds **20 Friday and 20 Sunday journeys**. IR66 now admits **40/40 and 38/38** dated journeys; all dated IR15, IC1, S1 and S2 journeys also have complete geometry. Every added journey carries the \`bern-western-terminal\` review marker. This remains centreline inference, not a surveyed running track or switch route.

At commit fab6dd9, the Bern review preserved all **8,873 previously admitted journeys and 138,361 segment occurrences**, with all 40 additions carrying the Bern terminal marker. The current regression checkpoint below covers the subsequent Avry review. The SBB plan and the derived clipping diagram were visually inspected. The separate SBB station-description page returned HTTP 403 on direct acquisition and is explicitly unused as retained evidence.

![Bern western-terminal geometry review](assets/fribourg-bern-platforms.svg)

## Avry-Matran: current SBB operating point and curves

The pinned 2021 FOT graph predates operating point **8501632, Avry-Matran**. The canton’s [12 November 2025 announcement](https://www.fr.ch/dime/actualites/gare-routiere-et-parc-relais-a-la-future-halte-ferroviaire-davry-matran) schedules opening on **14 December 2025**. Current SBB platform records explicitly identify **AVRY / 8501632**, line 250, platforms 1 and 2; both original GTFS platform coordinates agree within 15 m. Current SBB traffic-count records independently supply the same exact operating-point number, name and coordinate in every occurrence. Their two-point links are **excluded as route geometry**.

The [hashed policy and source manifest](../data/fribourg-avry-policy.json) restrict this correction to SBB SN route \`91-2B-Y-j26-1\`. Its local graph replaces the old FOT Rosé–Matran edge with the two detailed, normal-gauge SBB curves below, joined at the new exact Avry node. The original FOT graph and all previously accepted paths remain unchanged. Every original call and direction is retained; all **${avry.patterns.length} complete SN patterns** are tested together, including patterns that do not need the correction. The full two-date validation adds **zero Friday / two Sunday journeys** and two previously missing directed pairs, Neyruz → Avry and Avry → Villars-sur-Glâne. Both additions run early on Sunday (source service date 6 September); their original service dates remain in the feed. Synthetic reverse-pattern tests also pass; these do not imply a dated reverse service exists.

${table(['Detailed SBB feature (line / from / to / km)', 'Original vertices', 'Exact node attachment distances'], avry.assessments.map(a => [a.feature.join(' / '), a.vertices, a.attachmentsMetres.map(m => m.toFixed(1) + ' m').join(' / ')]))}

The [full review audit](../data/fribourg-audit/avry.json) inventories all two curve records, two platform records and eight traffic-count records, with source URLs, hashes, retrieval timestamps, processing dates, reuse terms, complete patterns and original failures. The 350 m station, 120 m topology and 2.5× detour guards remain unchanged; traversal through another called station out of order is rejected. No curve is enabled before 14 December 2025. Source processing timestamps do not certify survey vintage, platform-specific running tracks or switches.

At commit abd1fd8, the [Avry regression checkpoint](../data/fribourg-audit/rail-review-regression.json) compared against **fab6dd9**: all **${n(regression.days.reduce((n, d) => n + d.previousJourneys, 0))} previously admitted journeys and ${n(regression.days.reduce((n, d) => n + d.unchangedOriginalSegmentOccurrences, 0))} segment occurrences** retain identical original calls, coordinates, permissions, times, directions and geometry. Only the two Sunday additions at that checkpoint carried new \`sbb-avry-operating-point\` evidence. All dated SBB and BLS rail journeys are now admitted; this does not establish completeness for inactive or untested seasonal dates.

![Avry-Matran source geometry review](assets/fribourg-avry.svg)

## Dates, reuse and attribution

${table(['Source', 'Pinned date / vintage', 'Attribution / reuse'], [
  ['National GTFS', 'Feed 20260902; valid 2025-12-14–2026-12-12', 'opentransportdata.swiss; processed by Gleislicht; platform terms, not an assigned CC licence'],
  ['Fribourg line layer', `${summary.sources.acquiredAt}; actual geometry vintage unknown`, 'Source: Etat de Fribourg; free use, sharing and reuse under dataset OGD terms'],
  ['Embedded Esri metadata', 'Created 2022-07-14', 'Metadata creation, not geometry vintage'],
  ['OGD catalogue item', `Created ${summary.sources.reuseEvidence.catalogueCreated}; modified ${summary.sources.reuseEvidence.catalogueModified}`, 'Catalogue timestamps, not geometry vintage'],
  ['OSM road supplement', 'Swiss extract 2026-09-02; border retrieved 2026-09-08', '© OpenStreetMap contributors; ODbL 1.0; inferred geometry database'],
  ['Mont-Carmel road topology', 'OSM API acquired 2026-09-08; three ways edited 2026-01-28; survey vintage unknown', '© OpenStreetMap contributors; ODbL 1.0'],
  ['Mont-Carmel operator / works evidence', 'TPF timetable from 2025-12-14; municipal notice 2026-05-26', 'TPF / Commune de Givisiez; supporting identity and works evidence'],
  ['Jongny road / route relations', 'OSM API acquired 2026-09-08; individual way edits 2021–2026; survey vintage unknown', '© OpenStreetMap contributors; ODbL 1.0'],
  ['Bulle OSM station exit', 'Selected ways edited 2025-11-01–2025-12-16; acquired September 2026; survey vintage unknown', '© OpenStreetMap contributors; ODbL 1.0'],
  ['Bulle TPF platform plan', '2026 plan created 2026-02-09; older numbered-platform plan excluded', 'TPF; supporting platform identity only'],
  ['Portalban OSM streets', 'Selected way edits 2025-06-15–2026-01-17; acquired September 2026; survey vintage unknown', '© OpenStreetMap contributors; ODbL 1.0'],
  ['Portalban TPF timetable / page', 'Annual PDF created 2025-10-16, valid 2025-12-14–2026-12-12; indexed revised PDF unavailable', 'TPF TRAFIC; supporting call-order evidence, not certification of later revisions'],
  ['Boltigen OSM hairpin road', 'Way 584938515 edited 2025-12-30; acquired September 2026; survey vintage unknown', '© OpenStreetMap contributors; ODbL 1.0'],
  ['Boltigen independent Bern line', 'Data updated 2026-01-01; package published 2026-07-09; acquired 2026-09-08; survey vintage unknown', boltigen.policy.sources[2].attribution + '; Bern terms 2026-01-20, free use with attribution'],
  ['Boltigen TPF timetable', 'Valid 2025-12-14–2026-12-12', 'TPF TRAFIC; call-order and timing evidence only'],
  ['Broc station OSM road', 'Way 1395561049 v2 edited 2026-04-10; acquired September 2026; survey vintage unknown', '© OpenStreetMap contributors; ODbL 1.0'],
  ['Broc TPF platform / timetable evidence', 'Platform plan undated; timetable valid 2026-08-27–2026-12-12', 'TPF; supporting identity and call-order evidence'],
  ['Laupen OSM roads and object histories', 'Acquired September 2026; pre-fixture versions restored for two ways and four nodes edited 7 September; survey vintage unknown', '© OpenStreetMap contributors; ODbL 1.0'],
  ['Laupen construction evidence', 'PDF filename 2025-07-30 (publication timestamp unverified); updates 2026-05-29 / 2026-08-24; undated corridor page', 'Kanton Bern / Gemeinde Laupen; supporting corridor/date evidence only'],
  ['VMCV network-plan evidence', 'Valid 2025-12-14–2026-12-12', 'VMCV; schematic identity evidence only'],
  ['SBB reviewed Däniken curve', `${railReview.source.dataProcessed}; individual survey vintage unknown`, 'SBB Infrastructure / data.sbb.ch; terms_by, reference required'],
  ...avry.policy.metadata.map(m => [`Avry SBB ${m.dataset}`, `Processed ${m.dataProcessed}; modified ${m.modified}; survey vintage unknown`, 'SBB Infrastructure / data.sbb.ch; terms_by, reference required']),
  ['Avry opening notice', 'Published 2025-11-12; announced opening 2025-12-14', 'Source: Etat de Fribourg; temporal evidence only'],
  ['Bern platform evidence', 'SBB station plan 08/2026; acquired September 2026', 'SBB / OpenStreetMap; identity and extent evidence, no map geometry extracted'],
  ['BLS Kerzers platform evidence', 'Table state 2026-05-28, valid 2026-06-06; plan state 2023-03-09', 'BLS Netz AG; supporting identity evidence'],
  ['FOT railway network', `${summary.sources.rail.catalogueDate}; asset updated ${summary.sources.rail.assetUpdated}; 2026 alignment validity unknown`, '© Federal Office of Transport (FOT); attribution-required OGD terms'],
  ['TPF gauge / works evidence', 'Network statement 2026 v3.5 (2026-01-01); works page retrieved September 2026', 'TPF; supporting documents, not geometry licences'],
  ['swissBOUNDARIES3D', '2026-01; original canton and seven district polygons', '© swisstopo; free geodata terms'],
  ...summary.sources.crosswalkSupportingDocuments.map(d => [d.file, `Timetable 2026; state ${d.dataUpdated}`, 'Official tp-info / oev-info timetable; identity evidence only']),
])}

GTFS SHA-256: \`${summary.sourceHashes.archive}\`. Decoded source snapshot: \`${summary.sourceHashes.source}\`. The acquisition and feed metadata retain every raw-response hash, URL and UTC retrieval timestamp. Mutable PDF URLs and live ArcGIS responses are not claimed to be permanent release URLs. Refreshing either source requires a new census, mapping review and both full directed-pattern validations.

The [dataset catalogue item](https://maps.fr.ch/portal/sharing/rest/content/items/518a09fdd5874b76b6eacfb0fe2bb8ec?f=pjson) explicitly permits free use, sharing and reuse with **Source: Etat de Fribourg** attribution. Its title incorrectly says stops, but its service URL and serviceItemId identify the service containing [polyline layer 1](https://maps.fr.ch/ags/rest/services/OpenData/Lignes_de_transport_public/FeatureServer/1). An independent complete query matches **all 128 geometries, vertex-for-vertex, and every original attribute** to the original MapServer snapshot; the OGD response adds the numeric TYPE_LIGNE field. The reproduction checks reject changed terms, missing/duplicate features, altered identities and even millimetre coordinate changes. Both raw snapshots and the catalogue/service metadata are preserved. **The vector reuse question is resolved**, without assigning a Creative Commons licence or relying on an uncertain ordinance product mapping.

The earlier [portal terms](https://map.geo.fr.ch/help/fr/conditions_utilisation.htm) and [geoinformation ordinance](https://bdlf.fr.ch/api/fr/versions/8468/pdf_file_with_annexes) remain supporting evidence. The linked [geocat record](https://www.geocat.ch/geonetwork/srv/fre/catalog.search#/metadata/d578f90c-348f-41de-80be-4385a57605b9) did not yield XML during the follow-up (HTTP 403/500 or a login page). Neither service declares a geometry update date; the OGD catalogue's July 2026 modification timestamp must not be presented as line vintage.

Timetable reuse follows the [national platform terms](https://opentransportdata.swiss/en/terms-of-use/); boundary reuse follows [swisstopo's terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices). The [OSM copyright terms](https://www.openstreetmap.org/copyright) require attribution and ODbL share-alike for derived data. The combined derived geometry database is offered under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), with the full derived road cache retained; this does not relabel the separate timetable or boundary sources. FOT reuse follows its linked [attribution-required OGD terms](https://opendata.swiss/terms-of-use/#terms_by); the catalogue's literal proprietary licence field is preserved separately, without inventing a CC licence. These credits are distinct and are embedded in both manifests and the feed's source record. No live-service accuracy or real-time position claim is made.

## Reproduction and checks

From the repository root (Node 24+, installed dependencies, Python 3, curl and unzip):

\`\`\`sh
# Offline source-byte verification and deterministic decoding.
python3 scripts/prepare-fribourg-sources.py --offline

# Full national census; temporary cache stays outside public hosting.
node --max-old-space-size=8192 scripts/fribourg-timetable.mjs \\
  /private/tmp/GTFS_FP2026_20260902.zip /private/tmp/fribourg-timetable.json.gz

# Both civil-day feeds and route/pattern/works audits using committed road and rail evidence.
node --max-old-space-size=8192 scripts/build-fribourg-region.mjs \\
  --archive /private/tmp/GTFS_FP2026_20260902.zip \\
  --timetable-cache /private/tmp/fribourg-timetable.json.gz
node scripts/check-fribourg-region.mjs
node scripts/check-fribourg-bulle-regression.mjs
node scripts/audit-fribourg-topology.mjs
node scripts/review-fribourg-roads.mjs
node scripts/review-fribourg-rail.mjs
node scripts/review-fribourg-bern-platforms.mjs
node scripts/review-fribourg-avry.mjs
node scripts/review-fribourg-mont-carmel.mjs
node scripts/review-fribourg-jongny.mjs
node scripts/review-fribourg-laupen.mjs
node scripts/review-fribourg-broc.mjs
node scripts/review-fribourg-boltigen.mjs
node scripts/review-fribourg-portalban.mjs
node scripts/review-fribourg-bulle.mjs
node scripts/write-fribourg-audit.mjs
python3 scripts/test_fribourg_sources.py
python3 scripts/test_fribourg_laupen.py
npx vitest run --dir scripts scripts/fribourg-region.test.mjs scripts/fribourg-road-geometry.test.mjs scripts/fribourg-rail-geometry.test.mjs scripts/fribourg-rail-review.test.mjs scripts/fribourg-bern-platforms.test.mjs scripts/fribourg-avry.test.mjs scripts/fribourg-mont-carmel.test.mjs scripts/fribourg-jongny.test.mjs scripts/fribourg-laupen.test.mjs scripts/fribourg-broc.test.mjs scripts/fribourg-boltigen.test.mjs scripts/fribourg-portalban.test.mjs scripts/fribourg-bulle.test.mjs scripts/luzern-rail-geometry.test.mjs scripts/bern-region.test.mjs

# Optional rail-input regeneration from the complete timetable cache and retained source bytes.
node scripts/fribourg-rail-geometry.mjs /private/tmp/fribourg-timetable.json.gz
node scripts/prepare-fribourg-rail-review.mjs
node scripts/prepare-fribourg-bern-platforms.mjs
node scripts/prepare-fribourg-avry.mjs
node scripts/prepare-fribourg-mont-carmel.mjs
node scripts/prepare-fribourg-jongny.mjs
node scripts/prepare-fribourg-laupen.mjs
node scripts/prepare-fribourg-broc.mjs
node scripts/prepare-fribourg-boltigen.mjs
node scripts/prepare-fribourg-portalban.mjs
node scripts/prepare-fribourg-bulle.mjs

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

The checker independently reconciles all routes, source identities, seven districts, both pattern sets and directed-pair occurrence counts. It reconstructs both full-day feeds from all 24 chunks, checks chunk hashes and trip identity, validates full original call counts, path direction, finite coordinates and ordered times, and reconciles every admitted pattern against the manifest. Focused tests cover source paging failures, coordinate-order errors, detached territory membership, bus/night/rail identity collisions, changed operator overrides, reverse/loop call chains, disconnected lines, gauge and validity rejection, conflicting full rail contexts, detour and station guards, dated works violations and whole-journey exclusion. Shared Bern behavior is regression-tested because Fribourg reuses its census, topology, calendar/frequency and snapshot validators.
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
