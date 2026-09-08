import { readFile, writeFile } from 'node:fs/promises'
const read = async name => JSON.parse(await readFile(`data/solothurn-audit/${name}.json`))
const s = await read('summary'), routes = await read('routes')
const reports = await Promise.all(s.days.map(d => read(d.serviceDate)))
const n = x => Number(x).toLocaleString('en-CH')
const percent = (a, b) => `${(100 * a / b).toFixed(1)}%`
const esc = x => String(x ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.map(esc).join(' | ')} |`)].join('\n')
const admittedRoutes = routes.filter(r => r.days.some(d => d.admittedTrips)).length
const agencies = [...new Set(routes.map(r => r.agencyId))].sort((a, b) => +a - +b)
const totals = key => s.days.map(d => d.coverage[key])
const row = (label, key) => [label, ...totals(key).map(n)]
const text = `# Solothurn canton transit study

Built from the pinned 2026 timetable and the cantonal public-transport network. **All ${s.routeCount} canton-serving route records across ${s.agencyCount} GTFS agency identities and all ten districts are inventoried. ${admittedRoutes} route records contribute admitted journeys.** This is a whole-canton census with partial geometry admission, not complete service coverage.

Start with the [complete route admission/exclusion inventory](SOLOTHURN-ROUTE-INVENTORY.md), [machine audit](../data/solothurn-audit/summary.json) and [regional feed index](../public/data/solothurn-region/index.json). The original [national source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#so) explains source discovery.

## Scope and denominator

${s.census.boundaryRule} The boundary is the unsimplified swissBOUNDARIES3D **2026-01** canton polygon, including Dorneck/Thierstein and detached parts. Every one of the national archive's ${n(s.census.stopTimeRows)} stop-time rows was scanned for membership across ${n(s.census.allYearTrips)} trip records. ${n((await read('stops')).length)} GTFS stop records are inside the canton; only ${n(s.districts.reduce((n, d) => n + d.calledPlatforms, 0))} are called by the selected annual routes. Stop records include platforms and parent records; these are not counts of unique passenger stop places.

No agency whitelist or tariff boundary defines membership. Libero, A-Welle and TNW interfaces are represented by actual calls. The inventory includes national rail, PostAuto, local bus, replacement bus, BLT tram, Bielersee shipping and Weissenstein cableway identities. Representative agency IDs in the source survey were leads, not this denominator. Routes crossing the canton without any stop inside are outside the stated census. Services absent from fixed-stop GTFS, flexible service areas, and informal/private services are not claimed complete.

The ${s.routesByStatus['inactive-on-validation-dates']} inactive route records remain in the annual inventory. “Annual” means trip records in the pinned annual archive, not proven service on every day or a census of every seasonal operating pattern. Friday **4 September 2026** and Sunday **6 September 2026** use calendar exceptions, frequency expansion and previous-service-day spillover. Two September days do not establish holiday, winter or year-round completeness.

## Weekday and Sunday directed patterns

${table(['Measure', 'Friday 2026-09-04', 'Sunday 2026-09-06'], [
  row('Civil-day journey instances', 'trips'), row('Scheduled instances', 'scheduledTrips'), row('Representative headway instances', 'representativeHeadwayTrips'),
  row('Admitted scheduled instances', 'admittedScheduledTrips'), row('Admitted representative headway instances', 'admittedRepresentativeHeadwayTrips'), row('Total admitted instances', 'admittedTrips'),
  row('Distinct directed patterns', 'patterns'), row('Admitted complete patterns', 'admittedPatterns'),
  ['Matched route-specific directed stop pairs', ...s.days.map(d => `${n(d.coverage.matchedDirectedPairs)} / ${n(d.coverage.directedPairs)} (${percent(d.coverage.matchedDirectedPairs, d.coverage.directedPairs)})`)],
  ['Matched scheduled segment occurrences', ...s.days.map(d => `${n(d.coverage.matchedScheduledSegmentOccurrences)} / ${n(d.coverage.scheduledSegmentOccurrences)} (${percent(d.coverage.matchedScheduledSegmentOccurrences, d.coverage.scheduledSegmentOccurrences)})`)],
  ['Matched all segment occurrences', ...s.days.map(d => `${n(d.coverage.matchedSegmentOccurrences)} / ${n(d.coverage.segmentOccurrences)} (${percent(d.coverage.matchedSegmentOccurrences, d.coverage.segmentOccurrences)})`)],
  row('Segment occurrences in admitted whole journeys', 'admittedSegmentOccurrences'),
  ['Previous-day carry-in / admitted', ...s.days.map(d => `${d.carryInTrips} / ${d.admittedCarryInTrips}`)],
  ['Patterns revisiting a platform / admitted', ...s.days.map(d => `${d.directedPatternChecks.patternsRevisitingPlatforms} / ${d.directedPatternChecks.admittedPatternsRevisitingPlatforms}`)],
  ['Explicit night journeys / admitted', ...s.days.map(d => `${d.directedPatternChecks.nightTrips} / ${d.directedPatternChecks.admittedNightTrips}`)],
])}

Pattern identity includes the GTFS route ID, direction_id and the full ordered original platform IDs, including repeats and out-of-canton calls. Both directions 0 and 1 occur. There are **${s.weekdaySundayPatterns.shared} shared patterns**, **${s.weekdaySundayPatterns.weekdayOnly} Friday-only** and **${s.weekdaySundayPatterns.sundayOnly} Sunday-only** patterns. Exact per-pattern matched masks, decisions and counts are retained in the [Friday audit](../data/solothurn-audit/2026-09-04.json) and [Sunday audit](../data/solothurn-audit/2026-09-06.json).

Every admitted journey keeps every original source call, has an oriented geometry path for every adjacent pair, finite nondecreasing source times and intact call permissions. A missing segment excludes the whole journey; no call chain is cropped to improve coverage. Matched segments in an excluded journey remain in the audit denominator but are not emitted as partial vehicles. Pair counts are route-specific; shared road segments do not collapse distinct route identities.

Weissenstein accounts for all ${n(s.days[0].coverage.representativeHeadwayTrips)} / ${n(s.days[1].coverage.representativeHeadwayTrips)} representative exactTimes=0 headway instances. These are not that many observed cabins or exact scheduled departures. All motion is scheduled interpolation, not GPS or realtime observations.

Original GTFS times can place distinct calls in the same minute. The admitted feeds retain **${n(reports[0].timingResolution.zeroDurationSegmentOccurrences)} / ${n(reports[1].timingResolution.zeroDurationSegmentOccurrences)} zero-duration segment occurrences**. These cannot imply finite measured speed; animation can jump at the common timestamp. The audit lists the affected directed pairs and nominal positive-duration speeds. Geometry admission is not certification of physical vehicle speed, and no sub-minute times are fabricated.

## Entire-canton district coverage

${table(['District', 'Called GTFS platforms', 'Annual route records', 'Routes calling district in feed', 'Platforms called in feed'], s.districts.map(d => [d.district, d.calledPlatforms, d.routeIds.length, d.admittedRouteIds.length, d.admittedCalledPlatforms]))}

District route counts overlap because one route may serve multiple districts. Feed columns require an actually admitted journey calling the district; admission elsewhere on the same route does not count. The source polygon, not town-name matching, assigns districts. The census discloses ${s.census.nearBoundary.length} GTFS records within 10 metres of the boundary, including both sides at Salhöhe, Dornach Bahnhof, Bärschwil Station, Nuglar and Erlinsbach. They are reported without silently buffering the canton. The approximate coordinate transform has metre-level precision; this is a disclosed membership sensitivity, not a survey-accuracy claim.

## Network adapter and exclusions

The retained source has **3,951 MultiLineString network records and 775 point stops** in EPSG:2056. There are no line numbers, operator identifiers or directed route shapes. The empty linestructure helper table contains zero features and is not missing network coverage.

${table(['Source mode → adapter', 'Source records', 'Parts', 'Graph vertices', 'Graph edges', 'Components', 'Tunnel records'], Object.entries(s.sourceInventory.graph).map(([mode, g]) => [`${({ bus: 'Bus', rail: 'Bahn', cableway: 'Seilbahn' })[mode]} → ${mode}`, g.sourceRecords, g.parts, g.vertices, g.edges, g.components, g.tunnelRecords]))}

The adapter creates one graph per supported mode. Exact original LV95 part endpoints connect; nearby endpoints are never stitched. Interior crossings do not create junctions, so stacked paths and tunnels are not joined midway. The original tunnel flags are retained and tunnel endpoints may join surface infrastructure. This conservative topology can exclude real connections; the component counts are measured graph components, not claims about operational networks.

Paths follow shortest bidirectional source centrelines between projected GTFS calls. Retry projections must be within 5 metres of the nearest projection and only resolve disconnection/detour failures. No route/operator association is inferred from a segment ID. The [network inventory](../data/solothurn-audit/source-network.json) retains all source feature identities, mode, tunnel, part/vertex counts and graph inclusion status. Graph inclusion is not measured use of every segment or proof of route alignment.

${table(['Mode', 'Maximum endpoint snap', 'Maximum detour', 'Absolute detour allowance'], Object.entries(s.sources.limits).map(([mode, l]) => [mode, `${l.snapMetres} m`, `${l.detourRatio} × direct distance`, `${l.detourFloorMetres} m`]))}

The path must be no longer than the greater of the ratio limit and absolute allowance. Collapsed paths and mostly off-network movement are rejected. Short endpoint connectors are explicitly inferred. Output preserves source vertices, applies the swisstopo approximate LV95/WGS84 formula and rounds output to seven decimal places. There is no straight-line stop-to-stop fallback or externally inferred road repair.

${table(['Journey exclusion', 'Friday', 'Sunday'], [...new Set(s.days.flatMap(d => Object.keys(d.coverage.excludedTrips)))].sort().map(reason => [reason, ...s.days.map(d => n(d.coverage.excludedTrips[reason] ?? 0))]))}

${table(['Unmatched directed-pair reason', 'Friday', 'Sunday'], [...new Set(s.days.flatMap(d => Object.keys(d.pairFailureReasons)))].sort().map(reason => [reason, ...s.days.map(d => n(d.pairFailureReasons[reason] ?? 0))]))}

Night services are explicitly absent from the publisher's dataset. GTFS type 705, N/M/SN numeric labels and explicit night/Moonliner operator or route labels are excluded even where a daytime graph overlaps. Ordinary service-day carry-in is distinct from an explicitly marketed night route. No supplementary night alignment has been established. Tram and ferry are excluded because no compatible, separately verified graph exists; Bahn is not automatically treated as tram. Reservation/on-demand calls are rejected by policy, with no such exclusion required on these two dates.

Cross-canton journeys often extend beyond the graph or encounter disconnected parts. Endpoint gaps and disconnected patterns remain unresolved. Neither source topology nor shortest-path plausibility certifies road one-way compliance, a particular railway gauge/running track, bridge/tunnel engineering, the exact operator itinerary or temporary diversions. Further official route evidence is needed for that stronger claim.

The [source-stop inventory](../data/solothurn-audit/source-stops.json) retains every source stop, normalizes five-digit DiDok with the Swiss 8500000 prefix and joins the GTFS didok field exactly. It compares canton-contained GTFS stops only: ${Object.entries(s.sourceInventory.sourceStopReconciliation.byStatus).map(([k, v]) => `${v} ${k}`).join('; ')}. ${s.sourceInventory.sourceStopReconciliation.outsideCanton} source stops lie outside the canton. A missing canton-only match does not establish missing national service. The stop layer is an independent reconciliation aid; it does not replace original GTFS call coordinates.

## Sources, dates and attribution

- **National timetable:** SBB / Open data platform mobility Switzerland, feed **20260902**, valid **2025-12-14–2026-12-12**. [Dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [pinned ZIP](${s.sources.timetable.downloadUrl}), [terms](${s.sources.timetable.termsUrl}). SHA-256: \`${s.sourceHashes.archive}\`.
- **Solothurn network:** Öffentlicher Verkehr — Amt für Verkehr und Tiefbau / Amt für Geoinformation, Kanton Solothurn. Published **2025-12-17**, acquired **2026-09-08**. Publication is not a per-edge survey date; no more precise geometry vintage is supplied. [Source ZIP](${s.sources.records[0].url}), [metadata](${s.sources.metadataUrl}), [terms](${s.sources.termsUrl}). ZIP SHA-256: \`${s.sources.archiveSha256}\`.
- **Boundary:** © swisstopo, swissBOUNDARIES3D **2026-01**, [source](${s.sources.boundary.sourceUrl}), [terms](${s.sources.boundary.termsUrl}). Original GeoPackage SHA-256: \`${s.sources.boundary.sourceSha256}\`. Lossless canton/district row snapshot SHA-256: \`${s.sources.boundary.snapshotSha256}\`.

Solothurn's saved terms allow commercial and noncommercial use and recommend attribution; no Creative Commons licence is substituted. Source credit, links and exact acquisition times/hashes are embedded in every regional manifest and [sources.json](../public/data/solothurn-region/sources.json). Raw Solothurn ZIP, metadata, publication catalogue, terms and publisher validation log are retained in [data/solothurn-sources](../data/solothurn-sources/sources.json). The published feed also carries metadata and terms. National timetable attribution is opentransportdata.swiss; the processed results are authored by **Gleislicht**. This is an archival study, not a currently refreshed live timetable. Updating timetable, geometry or boundaries requires rebuilding both days and the admission audit.

## Feed and reproduction

The [feed index](../public/data/solothurn-region/index.json) links a full-day manifest and 06:45–08:45 morning snapshot for each date. Each day uses twelve two-hour chunks. The manifest carries stops, paths, edges, provenance and exact chunk hashes. Existing regional snapshot consumers can load these artifacts directly; this task does not add a new app view or enable realtime.

Run from the repository root:

\`\`\`sh
# Re-decode the retained, hash-verified source archive and boundary row snapshot.
npm run data:solothurn:sources

# Re-census every annual stop time; requires the pinned national GTFS archive.
npm run data:solothurn:census -- /private/tmp/GTFS_FP2026_20260902.zip

# Build complete directed patterns, both feeds and all machine audits.
npm run data:solothurn
npm run data:solothurn:check
npm run data:solothurn:docs
npx vitest run scripts/solothurn-region.test.mjs scripts/bern-region.test.mjs
python3 -m unittest discover -s scripts -p 'test_bern_sources.py'
\`\`\`

The timetable cache is an ignored regeneration intermediate; all deliverable feeds and audits are retained. Source preparation works offline from the committed archive and boundary snapshot. To reproduce the original boundary extraction, pass \`--boundary /path/to/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg\` to the Python preparation script. A newly downloaded aktuell source is not automatically accepted: the recorded survey hashes must match or a new release must be reviewed explicitly.

Validation covers real canton islands/districts, coordinate orientation, mode isolation, exact endpoint joins, disconnected parts and crossings, tunnel preservation, detour/collapse rejection, reverse/loop patterns, whole-journey exclusions, SN/night routes, conditional calls, previous-day spillover and representative frequencies. The artifact checker reconciles all route/operator and pattern/pair denominators, admission decisions, directed feed endpoints, every original call, morning subsets and exact bytes for all 24 chunks. It also re-routes every published journey against the retained mode graph and compares all emitted paths. These checks establish internal geometric and timetable consistency within the documented inference limits.
`
await writeFile('docs/SOLOTHURN-STUDY.md', text)
const reason = route => [...new Set(route.days.flatMap(d => Object.keys(d.excludedTrips)))].sort().join(', ') || (route.status === 'inactive-on-validation-dates' ? 'No civil-day instance on either date' : 'All dated journeys pass')
await writeFile('docs/SOLOTHURN-ROUTE-INVENTORY.md', `# Solothurn route admission and exclusion inventory

All ${routes.length} original GTFS route identities with at least one annual call in the canton. Labels can repeat across operators and route IDs. Each cell gives admitted / total civil-day instances, including separately labelled representative headway instances. See the [study](SOLOTHURN-STUDY.md) for geometry inference, night exclusions and calendar scope. Inactive records remain in the denominator. “Admitted-all-dated-trips” applies only to the two tested dates.

## Agency census

${table(['GTFS agency', 'Source name', 'Annual routes', 'Routes contributing feed', 'Friday admitted / total', 'Sunday admitted / total'], agencies.map(id => {
 const rr = routes.filter(r => r.agencyId === id)
 return [id, rr[0].agency, rr.length, rr.filter(r => r.days.some(d => d.admittedTrips)).length,
  ...[0, 1].map(i => `${rr.reduce((n, r) => n + r.days[i].admittedTrips, 0)} / ${rr.reduce((n, r) => n + r.days[i].trips, 0)}`)]
}))}

## Every route record

${table(['Route ID', 'Agency', 'Line / mode', 'Districts', 'Status', 'Friday admitted / total', 'Sunday admitted / total', 'Exclusions / explanation'], routes.map(r => [r.id, r.agencyId, `${r.name} / ${r.mode}`, r.districts.join(', '), r.status,
 ...r.days.map(d => `${d.admittedTrips} / ${d.trips}`), reason(r)]))}

Machine detail: [routes](../data/solothurn-audit/routes.json), [Friday patterns and directed pairs](../data/solothurn-audit/2026-09-04.json), [Sunday patterns and directed pairs](../data/solothurn-audit/2026-09-06.json). Every failed pair retains a reason, and every excluded pattern retains its complete original stop chain.
`)
console.log(`Documented ${routes.length} routes, ${agencies.length} agencies and both civil days`)
