import { readFile, writeFile } from 'node:fs/promises'
const read = async name => JSON.parse(await readFile(`data/solothurn-audit/${name}.json`))
const s = await read('summary'), routes = await read('routes')
const corridors = await read('corridor-review')
const topology = await read('topology-review'), supplements = await read('supplement-review'), seasonal = await read('seasonal-summary'), alignments = await read('alignment-review'), display = await read('display-release')
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

Built from the pinned 2026 timetable, the cantonal public-transport network and separately attributed road, rail, boat and tram supplements. **All ${s.routeCount} canton-serving route records across ${s.agencyCount} GTFS agency identities and all ten districts are inventoried. ${admittedRoutes} route records contribute admitted journeys.** This is a whole-canton census with partial geometry admission, not complete service coverage.

Start with the [complete route admission/exclusion inventory](SOLOTHURN-ROUTE-INVENTORY.md), [machine audit](../data/solothurn-audit/summary.json) and [regional feed index](../public/data/solothurn-region/index.json). The original [national source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#so) explains source discovery.

## Scope and denominator

${s.census.boundaryRule} The boundary is the unsimplified swissBOUNDARIES3D **2026-01** canton polygon, including Dorneck/Thierstein and detached parts. Every one of the national archive's ${n(s.census.stopTimeRows)} stop-time rows was scanned for membership across ${n(s.census.allYearTrips)} trip records. ${n((await read('stops')).length)} GTFS stop records are inside the canton; only ${n(s.districts.reduce((n, d) => n + d.calledPlatforms, 0))} are called by the selected annual routes. Stop records include platforms and parent records; these are not counts of unique passenger stop places.

No agency whitelist or tariff boundary defines membership. Libero, A-Welle and TNW interfaces are represented by actual calls. The inventory includes national rail, PostAuto, local bus, replacement bus, BLT tram, Bielersee shipping and Weissenstein cableway identities. Representative agency IDs in the source survey were leads, not this denominator. Routes crossing the canton without any stop inside are outside the stated census. Services absent from fixed-stop GTFS, flexible service areas, and informal/private services are not claimed complete.

The ${s.routesByStatus['inactive-on-validation-dates']} inactive route records remain in the annual inventory. “Annual” means trip records in the pinned annual archive, not proven service on every day or a census of every seasonal operating pattern. Friday **4 September 2026** and Sunday **6 September 2026** use calendar exceptions, frequency expansion and previous-service-day spillover. A separate twelve-date winter, Easter, summer, National Day and autumn sample is documented below; it does not establish every-day or year-round completeness.

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

The adapter creates one graph per supported mode. Exact original LV95 part endpoints connect, including where a non-tunnel endpoint exactly equals another non-tunnel feature’s interior vertex. Nearby endpoints are never stitched. Interior-only crossings do not create junctions, and tunnel interiors are not joined to surface paths. The original tunnel flags are retained and tunnel endpoints may join surface infrastructure. This conservative topology can exclude real connections; the component counts are measured graph components, not claims about operational networks.

Paths follow shortest bidirectional source centrelines between projected GTFS calls. Retry projections must be within 5 metres of the nearest projection and only resolve disconnection/detour failures. No route/operator association is inferred from a segment ID. The [network inventory](../data/solothurn-audit/source-network.json) retains all source feature identities, mode, tunnel, part/vertex counts and graph inclusion status. Graph inclusion is not measured use of every segment or proof of route alignment.

${table(['Mode', 'Maximum endpoint snap', 'Maximum detour', 'Absolute detour allowance'], Object.entries(s.sources.limits).map(([mode, l]) => [mode, `${l.snapMetres} m`, `${l.detourRatio} × direct distance`, `${l.detourFloorMetres} m`]))}

The path must be no longer than the greater of the ratio limit and absolute allowance. Collapsed paths and mostly off-network movement are rejected. Short endpoint connectors are explicitly inferred. Output preserves source vertices, applies the swisstopo approximate LV95/WGS84 formula and rounds output to seven decimal places. There is no straight-line stop-to-stop fallback. Gaps can use separately attributed supplementary geometry under the rules below. Cantonal paths remain the first choice, including where the independent alignment comparison flags disagreement.

${table(['Journey exclusion', 'Friday', 'Sunday'], [...new Set(s.days.flatMap(d => Object.keys(d.coverage.excludedTrips)))].sort().map(reason => [reason, ...s.days.map(d => n(d.coverage.excludedTrips[reason] ?? 0))]))}

${table(['Unmatched directed-pair reason', 'Friday', 'Sunday'], [...new Set(s.days.flatMap(d => Object.keys(d.pairFailureReasons)))].sort().map(reason => [reason, ...s.days.map(d => n(d.pairFailureReasons[reason] ?? 0))]))}

Night services are explicitly absent from the Solothurn publisher's dataset. GTFS type 705, N/M/SN numeric labels and explicit night/Moonliner labels therefore require a separately sourced path on **every** segment; overlapping daytime geometry never supplies a night leg. Ordinary service-day carry-in is distinct from a marketed night route. BLT tram 10 and BSG boat 3216 use their own official line/operator geometry; Bahn is not treated as tram. Reservation/on-demand calls remain excluded, with no such exclusion required on these two dates.

Cross-canton journeys often extend beyond the graph or encounter disconnected parts. Endpoint gaps and disconnected patterns remain unresolved. Neither source topology nor shortest-path plausibility certifies road one-way compliance, a particular railway gauge/running track, bridge/tunnel engineering, the exact operator itinerary or temporary diversions. Further official route evidence is needed for that stronger claim.

The [source-stop inventory](../data/solothurn-audit/source-stops.json) retains every source stop, normalizes five-digit DiDok with the Swiss 8500000 prefix and joins the GTFS didok field exactly. It compares canton-contained GTFS stops only: ${Object.entries(s.sourceInventory.sourceStopReconciliation.byStatus).map(([k, v]) => `${v} ${k}`).join('; ')}. ${s.sourceInventory.sourceStopReconciliation.outsideCanton} source stops lie outside the canton. A missing canton-only match does not establish missing national service. The stop layer is an independent reconciliation aid; it does not replace original GTFS call coordinates.

## Exact source junction follow-up

The initial endpoint-only graph left genuine source-vertex contacts disconnected. The follow-up nodes **42 bus locations and one rail location** where one non-tunnel feature ends exactly at an interior vertex of another. These represent 45 bus interior-vertex references and one rail reference. No new edge or coordinate is added; interior-only crossings, near misses and tunnel interiors remain separate. Bus graph components fall from 121 to 101, and rail components from 30 to 29.

${table(['Date', 'Previously admitted journeys', 'Now admitted journeys', 'Additional complete patterns', 'Previously admitted patterns lost'], topology.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The [topology review](../data/solothurn-audit/topology-review.json) preserves each exact LV95 junction, endpoint/interior feature IDs, before/after denominators and every newly admitted complete stop chain. The [baseline](../data/solothurn-topology-baseline.json) identifies the original committed source hashes and admitted patterns. Rebuild and checking assert that source edge counts are unchanged and every previously admitted pattern remains admitted. This repairs network representation; it does not change the documented limits on route itinerary and physical-direction certainty.

## Supplementary geometry and alignment review

${table(['Date', 'Cantonal-only admission', 'With supplements', 'Additional complete patterns', 'Prior patterns lost'], supplements.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

${table(['Geometry source', 'Friday directed pairs / admitted occurrences', 'Sunday directed pairs / admitted occurrences'], [...new Set(supplements.days.flatMap(d => Object.keys(d.geometrySources)))].sort().map(source => [source, ...supplements.days.map(d => { const g = d.geometrySources[source]; return g ? `${g.directedPairs} / ${g.admittedOccurrences}` : '0 / 0' })]))}

- **Roads:** 805 complete bus patterns from 96 original route IDs across all twelve dates are matched with pfaedle, retaining real agency and platform identities. The bus profile respects supported OSM access, direction and turn restrictions. Every occurrence of a route-specific directed pair across complete pattern contexts must have a successful, identical path; failed matcher warnings, context disagreement and detours are rejected. Bus detours remain bounded by 3 × direct distance or 600 m. Raw routing inputs/results, logs, binary/config/source hashes and derived cache are retained in [road evidence](../data/solothurn-road-evidence/all.json.gz). This is inferred road geometry, not an operator itinerary certificate.
- **Standard-gauge rail:** 85 explicit annual SBB, BLS, SOB and OeBB route records may use FOT geometry. Only 1435 mm source segments are eligible. Original operating-point numbers, declared topology, source validity fields and full stop order constrain paths; other scheduled operating points cannot be shortcut between adjacent calls. Platform attachment is capped at 350 m, infrastructure attachment at 120 m and detour at 4.5 × or 3,000 m. FOT paths are simplified by 5 m before WGS84 conversion. asm and RBS records do not enter this standard-gauge supplement. No particular running track is certified.
- **Boat:** Bern line 3216, operator BSG, supplies Biel–Solothurn geometry for exact GTFS route 94-321-6-j26-1 / agency 182. Endpoint snap is at most 150 m, detour 3 × or 1,200 m.
- **Tram:** Basel-Stadt line 10 / operator BLT supplies exact GTFS route 91-10-j26-1 / agency 37. Endpoint snap is at most 80 m, detour 3 × or 600 m. The two directed pairs around Arlesheim Dorf platform E remain unresolved; no platform relocation is invented.

The [supplement review](../data/solothurn-audit/supplement-review.json) records every added pattern. The [alignment review](../data/solothurn-audit/alignment-review.json) compares admitted cantonal bus paths with independent road consensus and retains every excluded pattern with its failed pairs. Its 30 m threshold is diagnostic only: symmetric vertex-to-polyline distance cannot prove itinerary or road direction. It does not change admission.

${table(['Cantonal bus comparison', 'Friday directed pairs', 'Sunday directed pairs'], [...new Set(alignments.days.flatMap(d => Object.keys(d.busComparisons)))].sort().map(key => [key, ...alignments.days.map(d => d.busComparisons[key]?.directedPairs ?? 0)]))}

**${s.days[0].coverage.trips - s.days[0].coverage.admittedTrips} Friday and ${s.days[1].coverage.trips - s.days[1].coverage.admittedTrips} Sunday journeys remain excluded.** Source gaps, unverified foreign rail connections, platform gaps and failed full-pattern consensus remain explicit. Disagreement with OSM remains a review flag on already admitted cantonal paths. Current operator itineraries, temporary diversions and physical direction are not certified by these internal checks.

## Reviewed rail corridor follow-up

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], corridors.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The [corridor review](../data/solothurn-audit/corridor-review.json) and [source policy](../data/solothurn-corridor-policy.json) add three exact associations without broadening snap/detour limits:

- **asm S11:** Bern feature **413**, operator **ASm**, line **S11**, original GTFS route **91-11-M-j26-1 / agency 81**. All 51 distinct directed platform pairs in the twelve-date sample match within 13 m. Only gaps in the earlier cantonal geometry use this operator-specific graph. **150 Friday and 95 Sunday journeys are now admitted**, preserving the full Solothurn–Oensingen–Langenthal stop chain.
- **SBB S29:** Bern feature **450_S_b**, operator **SBB**, line **S29**, route **91-29-j26-1 / agency 11**. The Aarau–Olten return legs now have line-specific geometry, with platform snaps below 48 m on the two published dates. Admission rises to **64/86 Friday and 65/86 Sunday** journeys. Other full-pattern contexts still produce conflicting paths, so their whole journeys remain excluded.
- **Däniken–Schönenwerd:** two complete graphical SBB line-540 records **DK–DKO–SCOE**, with exact operating-point IDs 8502111/8502112, standard gauge N, intact coordinate joins and at most 100 m station attachment. Six explicitly listed SBB GTFS route identities can use this corridor; all full seasonal contexts must agree. It completes **all four Sunday SN11 journeys**. Schematic two-point records and unrelated foreign source records are retained for review but never supply this corridor.

Every earlier admitted pattern remains admitted. These are bounded source-alignment improvements, not certification of current physical running tracks or diversions. The S11 and S29 route-specific Bern graphs remain bidirectional; direction comes from the original ordered GTFS calls. Complete seasonal contexts, route/operator identity and unsuccessful alternatives remain auditable.

## Seasonal and holiday sample

${table(['Civil date', 'Source journeys', 'Admitted journeys', 'Complete admitted patterns'], seasonal.days.map(d => [d.date, d.trips, d.admittedTrips, d.admittedPatterns]))}

The sample applies the pinned GTFS calendars and exceptions to winter weekdays/Sundays, Good Friday, Easter Sunday, summer, Swiss National Day and autumn. **${seasonal.newlyActiveSeptemberExcludedRoutes.length}** of the September-inactive route records become active; **${seasonal.stillInactiveRoutes.length}** remain inactive on all twelve dates. The [seasonal inventory](../data/solothurn-audit/seasonal-summary.json) lists every annual route on every date, and the [pattern audit](../data/solothurn-audit/seasonal-patterns.json.gz) retains every directed stop chain, decision and matched mask. A durable [context snapshot](../data/solothurn-pattern-contexts.json.gz) retains 2,824 complete representative source patterns for offline revalidation and supplementary consensus.

Geometry from the recorded source vintages is applied to this timetable sample; historical/seasonal alignment validity is unproven. **25 October is the DST fallback day:** source stop order and geometry are tested, but the repeated local hour is not disambiguated into 25 elapsed hours. It is not promoted to an app day feed. Only the reviewed September Friday/Sunday can be promoted; this sample does not assert daily or year-round completeness.

## Sources, dates and attribution

- **National timetable:** SBB / Open data platform mobility Switzerland, feed **20260902**, valid **2025-12-14–2026-12-12**. [Dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [pinned ZIP](${s.sources.timetable.downloadUrl}), [terms](${s.sources.timetable.termsUrl}). SHA-256: \`${s.sourceHashes.archive}\`.
- **Solothurn network:** Öffentlicher Verkehr — Amt für Verkehr und Tiefbau / Amt für Geoinformation, Kanton Solothurn. Published **2025-12-17**, acquired **2026-09-08**. Publication is not a per-edge survey date; no more precise geometry vintage is supplied. [Source ZIP](${s.sources.records[0].url}), [metadata](${s.sources.metadataUrl}), [terms](${s.sources.termsUrl}). ZIP SHA-256: \`${s.sources.archiveSha256}\`.
- **Boundary:** © swisstopo, swissBOUNDARIES3D **2026-01**, [source](${s.sources.boundary.sourceUrl}), [terms](${s.sources.boundary.termsUrl}). Original GeoPackage SHA-256: \`${s.sources.boundary.sourceSha256}\`. Lossless canton/district row snapshot SHA-256: \`${s.sources.boundary.snapshotSha256}\`.

- **OSM roads:** © OpenStreetMap contributors, ODbL-1.0; Geofabrik Switzerland **2026-09-02** plus border extract acquired **2026-09-08**. [Source](https://download.geofabrik.de/europe/switzerland.html), [terms](https://www.openstreetmap.org/copyright). Extract SHA-256: \`${s.sources.supplements.road.source.osmSha256}\`.
- **FOT rail:** © Federal Office of Transport. Catalogue date **2021-07-06**, asset update **2025-01-18**, checked **2026-09-08**; no effective 2026 alignment date established. [Source](${s.sources.supplements.rail.sourceUrl}), [attribution terms](${s.sources.supplements.rail.termsUrl}). Source XTF SHA-256: \`${s.sources.supplements.rail.sha256}\`. The catalogue's proprietary licence label is preserved; no open licence is invented.
- **Bern boat geometry:** Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern. Data updated **2026-01-01**, package published **2026-07-09**, acquired **2026-09-08**. [Metadata](${s.sources.supplements.boat.source.metadataUrl}), [German terms](../public/data/solothurn-region/supplements/terms_of_use_de.pdf), [French terms](../public/data/solothurn-region/supplements/terms_of_use_fr.pdf). Bern archive SHA-256: \`${s.sources.supplements.boat.source.archiveSha256}\`.
- **SBB graphical railway corridors:** SBB Infrastructure / data.sbb.ch, attribution required under the retained terms_by licence. Dataset modified **2026-07-29**, data processed **2026-09-02**, acquired **2026-09-08**; these are publication/processing dates, not proof of each alignment's effective date. [Graphical dataset](https://data.sbb.ch/explore/dataset/linie-mit-polygon/), [retained terms](../public/data/solothurn-region/supplements/sbb-terms.html), [source hashes and URLs](../data/solothurn-sources/corridors/sbb/sources.json). Bern S11/S29 use the same dated Bern package and attribution as the boat source above.
- **Basel tram geometry:** Geodaten Kanton Basel-Stadt, acquired **2026-09-08**; no geometry effective date supplied. [Catalogue](${s.sources.supplements.tram.source.metadataUrl}), [model](${s.sources.supplements.tram.source.modelUrl}), [reuse context](${s.sources.supplements.tram.source.termsUrl}). The exact line/operator layer and acquisition catalogue are retained. Uncompressed GeoJSON SHA-256: \`${s.sources.supplements.tram.source.sha256}\`.

Solothurn's saved terms allow commercial and noncommercial use and recommend attribution; no Creative Commons licence is substituted. Source credit, links and exact acquisition times/hashes are embedded in every regional manifest and [sources.json](../public/data/solothurn-region/sources.json). Raw Solothurn ZIP, metadata, publication catalogue, terms and publisher validation log are retained in [data/solothurn-sources](../data/solothurn-sources/sources.json). The published feed also carries metadata and terms. National timetable attribution is opentransportdata.swiss; the processed results are authored by **Gleislicht**. This is an archival study, not a currently refreshed live timetable. Updating timetable, geometry or boundaries requires rebuilding both days and the admission audit.

## Feed and reproduction

The [feed index](../public/data/solothurn-region/index.json) links a full-day manifest and 06:45–08:45 morning snapshot for each date. Each day uses twelve two-hour chunks. The manifest carries stops, paths, edges, provenance and exact chunk hashes. Solothurn is available in the app's study picker and opens as a full civil day. Its feeds load on selection. Search covers admitted routes and out-of-canton stops; shares retain study, date, time and focus. English, German, French and Italian copy explicitly labels partial coverage and representative headway motion. Source credits and local terms remain accessible.

The app release uses the Friday fixture in [top-level manifest](../public/data/solothurn-region-day-manifest.json), morning snapshot and twelve verified chunks. [Display release proof](../data/solothurn-audit/display-release.json) records both dates: display simplification is bounded by 5 m with unchanged endpoints, calls and movements. The Friday manifest is ${n(display.dates[0].payload['solothurn-region-day-manifest.json'].gzipBytes)} bytes gzipped. Source archives remain unchanged by display simplification; FOT has its separately declared 5 m source transformation.

Regional refresh integration can promote only the two reviewed dates. For another date or a failed candidate build it retains a complete, validated published study (or the reviewed fixture on first-deployment 404), keeping its actual service date. A damaged published chunk never gets silently combined with another release. This integration is ready for deployment; no live deployment is part of this task.

Run from the repository root:

\`\`\`sh
# Re-decode the retained, hash-verified source archive and boundary row snapshot.
npm run data:solothurn:sources

# Re-census every annual stop time; requires the pinned national GTFS archive.
npm run data:solothurn:census -- /private/tmp/GTFS_FP2026_20260902.zip

# Rebuild the twelve-date census and durable full-pattern contexts.
npm run data:solothurn:census -- /private/tmp/GTFS_FP2026_20260902.zip --seasonal
node scripts/prepare-solothurn-contexts.mjs
# Supplemental source preparation can reuse committed snapshots offline.
node scripts/prepare-solothurn-supplements.mjs
node scripts/prepare-solothurn-corridors.mjs

# Build complete directed patterns, both feeds and all machine audits.
npm run data:solothurn
npm run data:solothurn:check
npm run data:solothurn:seasonal
npm run data:solothurn:seasonal:check
npm run data:solothurn:alignments
npm run data:solothurn:release
npm run data:solothurn:docs
npx vitest run scripts/solothurn-region.test.mjs scripts/solothurn-corridor.test.mjs scripts/solothurn-release.test.mjs
npx playwright test --config playwright.solothurn.config.ts
python3 -m unittest discover -s scripts -p 'test_bern_sources.py'
\`\`\`

The road cache/evidence can be validated offline. To rematch, prepare with \`node scripts/solothurn-road-geometry.mjs prepare data/solothurn-audit/seasonal-timetable-cache.json.gz /path/prepared\`, run \`scripts/match-postbus-roads.mjs\` on \`/path/prepared/all\` using the exact recorded pfaedle binary/config and OSM extract, then import with \`node scripts/solothurn-road-geometry.mjs import /path/prepared /path/matched\`. The large OSM input and matcher binary are external reproduction prerequisites; their hashes are retained. New bytes require fresh matching and review.

The timetable cache is an ignored regeneration intermediate; all deliverable feeds and audits are retained. Source preparation works offline from the committed archive and boundary snapshot. To reproduce the original boundary extraction, pass \`--boundary /path/to/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg\` to the Python preparation script. A newly downloaded aktuell source is not automatically accepted: the recorded survey hashes must match or a new release must be reviewed explicitly.

Validation covers real canton islands/districts, coordinate orientation, mode isolation, exact endpoint joins, disconnected parts and crossings, tunnel preservation, detour/collapse rejection, reverse/loop patterns, whole-journey exclusions, SN/night routes, conditional calls, previous-day spillover and representative frequencies. The artifact checker reconciles all route/operator and pattern/pair denominators, admission decisions, directed feed endpoints, every original call, morning subsets and exact bytes for all 24 chunks. It also re-routes every published journey against the retained mode graph and compares all emitted paths. These checks establish internal geometric and timetable consistency within the documented inference limits.
`
await writeFile('docs/SOLOTHURN-STUDY.md', text)
const reason = route => [...new Set(route.days.flatMap(d => Object.keys(d.excludedTrips)))].sort().join(', ') || (route.status === 'inactive-on-validation-dates' ? 'No civil-day instance on either date' : 'All dated journeys pass')
await writeFile('docs/SOLOTHURN-ROUTE-INVENTORY.md', `# Solothurn route admission and exclusion inventory

All ${routes.length} original GTFS route identities with at least one annual call in the canton. Labels can repeat across operators and route IDs. Each cell gives admitted / total civil-day instances, including separately labelled representative headway instances. See the [study](SOLOTHURN-STUDY.md) for geometry inference, supplementary night admission and calendar scope. Inactive records remain in the denominator. “Admitted-all-dated-trips” applies only to the two tested dates.

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
