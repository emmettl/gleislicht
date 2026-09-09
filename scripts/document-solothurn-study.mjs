import { readFile, writeFile } from 'node:fs/promises'
const read = async name => JSON.parse(await readFile(`data/solothurn-audit/${name}.json`))
const s = await read('summary'), routes = await read('routes')
const corridors = await read('corridor-review'), railPlatforms = await read('rail-platform-review'), s29Precedence = await read('s29-precedence-review'), busJunction = await read('bus-junction-review'), accessRoads = await read('access-road-review'), bernTerminal = await read('bern-terminal-review'), s26 = await read('s26-review'), como = await read('como-review'), simplon = await read('simplon-review'), delle = await read('delle-review'), roadDetour = await read('road-detour-review'), m53 = await read('m53-review')
const topology = await read('topology-review'), supplements = await read('supplement-review'), seasonal = await read('seasonal-summary'), alignments = await read('alignment-review'), display = await read('display-release'), residual = await read('residual-gap-review')
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

**${s.days[0].coverage.trips - s.days[0].coverage.admittedTrips} Friday and ${s.days[1].coverage.trips - s.days[1].coverage.admittedTrips} Sunday journeys remain excluded.** Tram platform gaps, conflicting bus corridors and failed full-pattern road consensus remain explicit. Disagreement with OSM remains a review flag on already admitted cantonal paths. Current operator itineraries, temporary diversions and physical direction are not certified by these internal checks.

## Reviewed rail corridor follow-up

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], corridors.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The table shows cumulative admission since the pre-corridor baseline, including the subsequent platform, S29 precedence, bus-junction, access-road, Bern terminal, S26, Como, Simplon, Delle, Liesberg and M53 reviews below. The [corridor review](../data/solothurn-audit/corridor-review.json) and [source policy](../data/solothurn-corridor-policy.json) add three exact associations without broadening snap/detour limits:

- **asm S11:** Bern feature **413**, operator **ASm**, line **S11**, original GTFS route **91-11-M-j26-1 / agency 81**. All 51 distinct directed platform pairs in the twelve-date sample match within 13 m. Only gaps in the earlier cantonal geometry use this operator-specific graph. **150 Friday and 95 Sunday journeys are now admitted**, preserving the full Solothurn–Oensingen–Langenthal stop chain.
- **SBB S29:** Bern feature **450_S_b**, operator **SBB**, line **S29**, route **91-29-j26-1 / agency 11**. The Aarau–Olten return legs now have line-specific geometry, with platform snaps below 48 m on the two published dates. The initial corridor pass admitted **64/86 Friday and 65/86 Sunday** journeys. The bounded source-precedence review below resolves the remaining two conflicting directed platform pairs and admits **86/86 on both dates**.
- **Däniken–Schönenwerd:** two complete graphical SBB line-540 records **DK–DKO–SCOE**, with exact operating-point IDs 8502111/8502112, standard gauge N, intact coordinate joins and at most 100 m station attachment. Six explicitly listed SBB GTFS route identities can use this corridor; all full seasonal contexts must agree. It completes **all four Sunday SN11 journeys**. Schematic two-point records and unrelated foreign source records are retained for review but never supply this corridor.

Every earlier admitted pattern remains admitted. These are bounded source-alignment improvements, not certification of current physical running tracks or diversions. The S11 and S29 route-specific Bern graphs remain bidirectional; direction comes from the original ordered GTFS calls. Complete seasonal contexts, route/operator identity and unsuccessful alternatives remain auditable.

## Interlaken Ost platform-group review

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], railPlatforms.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The table shows cumulative admission since the pre-platform baseline, including the later S29 precedence, bus-junction, access-road, Bern terminal, S26, Como, Simplon, Delle, Liesberg and M53 reviews. The [platform review](../data/solothurn-audit/rail-platform-review.json) uses the existing pinned FOT source, with an explicit [route/platform crosswalk](../data/solothurn-rail-review-policy.json). The generic Interlaken Ost operating point **8507492** cannot route to Interlaken West in the selected standard-gauge graph. FOT separately identifies **8519309 / ch14uvag00165678** as **Interlaken Ost [Gleis 5-8]**, connected by **1435 mm segment ch14uvag00087489**. The review maps only original platform IDs **ch:1:sloid:7492:0:581416 (5)** and **ch:1:sloid:7492:0:460848 (7)** on exact SBB agency **11**, **IC61 route 91-61-A-j26-1** and **ICE route 91-3-Y-j26-1**. The twelve-date ICE sample uses platform 5; IC61 uses 5 and 7.

This adds **33 Friday and 19 Sunday complete journeys**, retaining every original platform ID, coordinate, time and ordered call. The source-node identity, connected segment and gauge are asserted. A changed known platform fails validation; an unknown platform or another route cannot inherit the crosswalk. Successful earlier paths remain unchanged, and the same 350 m station attachment, 120 m topology attachment, full-pattern stop-order constraints and all-context consensus apply. Both Interlaken West→Ost and Ost→West paths are tested across the retained seasonal contexts. Source dates and FOT attribution are unchanged; this corrects an operating-point association and does not certify a particular running track.

## S29 source-precedence review

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], s29Precedence.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The table shows cumulative admission since the pre-S29 baseline, including the later bus-junction, access-road, Bern terminal, S26, Como, Simplon, Delle, Liesberg and M53 reviews. The [precedence audit](../data/solothurn-audit/s29-precedence-review.json) retains every complete context and the prior candidate source, path length and geometry hash. For **SBB S29 / agency 11 / route 91-29-j26-1**, the two unresolved pairs run from **Olten platform ch:1:sloid:218:5:8** to **Aarau ch:1:sloid:2113:2:3** or **ch:1:sloid:2113:1:1**. FOT selects approximately **45.1 km** alternatives for some terminating patterns; longer patterns reject that path under their full stop-order constraints and use the **13.3 km** Bern S29 geometry. Those different candidates previously failed global consensus.

The explicit [policy](../data/solothurn-s29-precedence-policy.json) now chooses Bern's exact **450_S_b / SBB / S29** line for these two pairs in every retained context before applying consensus. Both paths remain within the existing snap and detour limits, with maximum platform snaps below 11 m. Original platform records and source/context hashes are asserted. Reverse pairs, other platforms, operators, modes and route identities cannot inherit this precedence. No general consensus rule is relaxed and no source edge is invented. This adds **22 Friday and 21 Sunday journeys**, completing **all 86 S29 journeys on each published date** while preserving all previously emitted calls and paths. The Bern source dates, attribution and inference limitations above still apply.

At this stage, the remaining bus gaps included divergent road candidates at Liestal Bahnhof, excessive detours, and matcher-rejected replacement/night services; the later access-road review below resolves some of them. The Oberbuchsiten road candidates still disagree, but the separate cantonal-source junction review below supplies that exact pair. The [PostAuto 2026 Thal network map](https://www.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/nordschweiz/liniennetz-thal-26.pdf) and [Oristal/Dorneckberg network map](https://www.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/nordschweiz/liniennetz-oristal-dorneckberg-26.pdf?vs=4) were located as further operator-evidence leads. They are not ingested geometry or grounds to choose between the stored road candidates. The network maps alone do not admit those journeys; the subsequent source reviews below document any resolved pairs.

## Oberbuchsiten bus source-junction review

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], busJunction.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The table shows cumulative admission since the pre-junction baseline, including the later access-road, Bern terminal, S26, Como, Simplon, Delle, Liesberg and M53 reviews. The [junction audit](../data/solothurn-audit/bus-junction-review.json) and [explicit policy](../data/solothurn-bus-junction-policy.json) review just **PostAuto / agency 801 / line 126 / route 96-145-2-j26-1**, from **Oberbuchsiten Bahnhof ch:1:sloid:89885:0:01** to **Oberbuchsiten Löwen ch:1:sloid:81284:0:390682**. Two original, non-tunnel Bus features—**4562863f-1da7-42ea-9cf8-f580fb14b86c** and **64c5c5c2-6512-4ef1-a06e-4bac13d29b5d**—end at LV95 **[2624747.100, 1239883.090]** and **[2624747.099, 1239883.092]**, separated by **2.236 mm**.

A supplementary graph retains both features' original vertices and adds **one explicitly inferred connector, zero new vertices**, bounded by **3 mm**. The primary canton graph is unchanged; this is not global near-endpoint stitching. Feature hashes, mode, tunnel flags, endpoint positions, exact route/operator and original platform coordinates are checked. Unknown routes/platforms, reverse-pair reuse, larger gaps, altered geometry and tunnel endpoints cannot inherit the review. The existing bus snap/detour limits apply; the observed platform snaps remain below 7 m. All observed complete contexts receive the same source path. This admits **37 Friday and 18 Sunday additional whole journeys** without changing previously emitted calls or geometry.

The connection is an explicit inference between source endpoints, not a proven export defect or operator-confirmed road junction. Cantonal source dates and attribution remain as documented below. Bidirectional source geometry still does not certify legal road direction or current diversions. The original vertices remain in the source graph; ordinary seven-decimal WGS84 output can merge the two millimetre-separated positions at display precision.

The original Arlesheim and Liestal gaps, source hashes, endpoint coordinates, candidate paths and full-pattern IDs are retained in the [local-gap review](../data/solothurn-audit/local-gap-review.json). At **Arlesheim Dorf**, original tram platform **E / ch:1:sloid:77:1:5** is **138.4 m** from the retained BLT line, beyond its 80 m attachment limit. At **Liestal Bahnhof**, the inspected cantonal feature endpoints are **1.058 m** apart, and the two successful road candidates differ between a roughly **293 m** path and a **535 m** station loop. These cases do not meet the reviewed 3 mm connection rule. Arlesheim remains excluded. Liestal is resolved by the separately filtered road graph below, without moving a platform coordinate or stitching the cantonal gap.

## Service-road and stop-candidate review

This table is cumulative from its recorded baseline and includes the later Bern terminal, S26, Como, Simplon, Delle, Liesberg and M53 follow-ups. The service-road contribution remains 34 Friday / 119 Sunday journeys.

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], accessRoads.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The [access-road audit](../data/solothurn-audit/access-road-review.json) retains all candidate decisions from a new extraction of the pinned **Geofabrik Switzerland 2026-09-02** PBF, SHA-256 **39257b1c92a45da38ca94ddb745bdcf53551d0e66b02d89f3de3e7c064c3a29f**. The [source bundle](../data/solothurn-access-roads/source.json) retains the graph, exact filter/routing configurations, original routing input, raw matcher output, hashes and licence. It covers **all 72 complete twelve-date patterns on eight explicitly selected bus route records**, including the rejected alternatives. The [admission policy](../data/solothurn-access-policy.json) selects only six previously missing directed pairs; all earlier successful cantonal and supplementary paths take priority.

The pfaedle bus profile includes **highway=service** and tightens stop-position candidates and edge snaps to **20 m**. Existing access/road-class penalties, supported one-way and turn restrictions remain; no tag or access rule is removed. Candidate-search limits are distinct from post-match attachment measurements: the largest measured attachment across the entire imported run is **24.253 m**, below the unchanged 120 m importer limit. All 72 patterns produce **zero matcher fallbacks and zero importer issues**. Every selected pair must still have byte-identical geometry across every complete context and satisfy the existing **3 × / 600 m** road detour limits. This is OSM-based route inference, not operator-confirmed access, temporary diversions or exact physical direction.

- **Liestal Bahnhof Süd → Bahnhof, PostAuto 111:** both original platform-ID forms receive separately reviewed paths. The main platform pair agrees on the **534.6 m station loop across all three full contexts**; the generic-ID pair follows **454.8 m**. This adds **34 Friday and 33 Sunday journeys**.
- **Grenchen Nord ↔ Biel/Bienne Carterminal, EV6 / agency 7231:** both directed pairs now match the service-road graph, adding **79 Sunday replacement journeys**. The old matcher attached Grenchen Nord **129.2 m** away and rejected it; no original stop coordinate is replaced.
- **Solothurn Hauptbahnhof → Biberist Aesplistrasse, M11:** adds **3 Sunday night journeys**.
- **Aarau Aarepark → Kettenbrücke, N22:** adds **4 Sunday night journeys**. Night services still require supplemental geometry on every leg.

At this stage, the graph rejected the **Egerkingen Gäu Park → Bahnhof** and **Liesberg Seemättli → Ochsengasse** detours; the later bounded Liesberg review below resolves the latter; **EV4 Pieterlen → Biel** and **M53 Amthausplatz → Baseltor** still disagree between complete contexts. These whole journeys were excluded at this stage. Immediately after the service-road review, the study excluded **167 Friday / 175 Sunday journeys**, including **two Sunday M53 night journeys**. All previously emitted journey calls, timestamps, permissions and paths are unchanged.

Attribution is **© OpenStreetMap contributors, ODbL-1.0**; [copyright and terms](https://www.openstreetmap.org/copyright). This reuses the September 2 source, not a new effective alignment date. The exact pfaedle commit is **99f2cd466696ecc6bdb73b2b3bb9008557fcb84a**; its University of Freiburg / Patrick Brosi et al. configuration and GPL v3 [licence](../data/solothurn-access-roads/pfaedle-LICENSE) are retained. The original Luzern profile provenance is retained in [parent-source.json](../data/solothurn-access-roads/parent-source.json). The graph extraction is input-dependent; it is not claimed to establish complete national or cross-border road coverage.

## Bern platforms 49/50 and the eastern approach

This table is cumulative from its recorded baseline and includes the later S26, Como, Simplon, Delle, Liesberg and M53 follow-ups. The Bern terminal contribution remains 34 journeys on each published date.

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], bernTerminal.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The [Bern terminal audit](../data/solothurn-audit/bern-terminal-review.json) adds **34 complete journeys on each published date**: 18 SOB IR35, 13 SBB IR35, one BLS IR35, one SBB IR and one SBB IR16. All previous journey stops, timestamps, permissions and paths are retained. The five route/operator identities stay separate. This resolves every published-date exclusion on these five route records.

The SBB [Bern station plan](../data/solothurn-bern-terminal-sources/sbb-bern-plan-2026-08.pdf), dated **August 2026** and acquired **8 September 2026**, shows tracks **49/50 west of the central station**. The original GTFS coordinates are **446.0 / 427.8 m** from the FOT station point and exceed its unchanged 350 m platform limit. The plan establishes platform identity and station extent; it is not used to invent a surveyed alignment. Attribution: **© SBB 08/2026; © OpenStreetMap** as printed on the plan; no new open licence is asserted for the plan.

The [reviewed policy](../data/solothurn-bern-terminal-policy.json) projects those exact platform coordinates onto original SBB FOT station curve **ch14uvag00087328**, at **33.9 / 38.6 m**, within a separately bounded **75 m** projection limit. It retains the **427.2 / 408.2 m** station-centre side of that curve as an explicitly inferred terminal spur. The original Bern operating point stays in place. In this pattern-local graph it connects only to **Bern Wyler, ch14uvag00139673**, preserving the actual source vertices on the eastern approach; the other three Bern connections are removed from this variant. The source records have **2021-07-06** data stamps; their validity begins **2005-02-11 / 2015-10-21**, with no recorded end. These are not proof of present-day running-track or switch geometry.

Only a single terminal Bern call on one of the two exact platforms can use this graph. IR16 must have adjacent **Olten**; the other four identities must have adjacent **Burgdorf**. Through calls, unknown platforms, other operators and changed coordinates cannot inherit the review. Every complete retained pattern across all twelve dates participates in consensus, with the original FOT validity, **350 m station / 120 m topology** attachment, detour and stop-order rules unchanged. Only previously failed terminal pairs can change. Full source hashes, original and projected coordinates, removed connection IDs and emitted source-pair evidence are retained in the audit.


## S26 Aarau–Olten source conflict

This table is cumulative from its recorded baseline and includes the later Como, Simplon, Delle, Liesberg and M53 reviews. The S26 contribution remains one Friday journey.

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], s26.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The [S26 review](../data/solothurn-audit/s26-review.json) resolves the final **one Friday S26 journey**; Sunday admission is unchanged. It also resolves **one journey on each of 16 January, 23 October and 11 December** in the seasonal sample. All **41 Friday / 39 Sunday S26 journeys** are now admitted. Both full patterns run Muri AG–Wohlen–Lenzburg–Rupperswil–Aarau–Olten, with different Muri platforms. Their final **Aarau platform 5 → Olten platform 9** pair now follows the same **13,699.1 m** geometry. Every earlier journey keeps its original calls, timestamps, permissions and paths.

FOT segment **ch14uvag00087837**, between operating points **8502111 Däniken SO / ch14uvag00089021** and **8502143 Däniken Ost / ch14uvag00089022**, declares **mm1000**. It stays byte-for-byte unchanged and excluded from the standard-gauge graph. That missing link previously forced the Aarau–Olten search toward a detour through already-called stations, which the full-pattern stop-order rule correctly rejected.

The independent, retained **SBB Infrastructure** graphical line **540 / DK–DKO / km 45,673.43–46,100** declares gauge **N** and supplies **44 original vertices**. The [policy](../data/solothurn-s26-policy.json) adds this record as a separately named segment only in the reviewed S23/S26 graph, anchored to the exact FOT operating points within **${s26.source.attachments.map(n => n.toFixed(1)).join(' / ')} m**. It does not relabel the rejected FOT segment, borrow S29 route identity or relax source-topology, station-attachment, detour or stop-order limits. The complete earlier calls remain blocked against revisiting. The initial association covers only SBB agency **11**, route **91-26-j26-1**, line **S26**, and this directed original platform pair. The seasonal follow-up below adds four separately pinned S23/S26 pairs; other pairs cannot inherit the review.

All twelve retained dates participate in supplementary consensus; this exact pair occurs in two complete contexts and produces identical geometry. Source bytes, hashes, gauge conflict, added curve, measured attachments and whole-journey admission changes are retained. SBB metadata was modified **2026-07-29**, data processed **2026-09-02**, and the source acquired **2026-09-08**. These are publication/processing dates, not per-feature alignment validity. Attribution: **SBB Infrastructure / data.sbb.ch**, [retained source catalogue and terms](../data/solothurn-sources/corridors/sbb/sources.json); FOT source dates and attribution remain as listed below. Exact running track, switch geometry and effective seasonal alignment remain unverified.


## Chiasso–Como passenger corridor

This table is cumulative from its baseline and includes the later Simplon, Delle, Liesberg and M53 reviews. The Como contribution remains two journeys per published date.

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], como.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The [Como review](../data/solothurn-audit/como-review.json) adds **two complete EC journeys on each published date**, retaining every earlier journey unchanged. It reviews only SBB agency **11**, EC route **91-3R-Y-j26-1**, and exact directed pairs **Chiasso platform 1 → Como S. Giovanni (8301307)** and **Como S. Giovanni → Chiasso platform 6**. The entire retained twelve-date scope contains **eight complete route patterns**; three contexts in each direction contain the foreign pair. Como must be a single terminal call. Other routes, unknown platforms, shortened patterns and changed original coordinates cannot inherit admission.

The [retained source bundle](../data/solothurn-como-sources/sources.json) contains a historical OSM snapshot at **2026-09-02 00:00 UTC**, acquired **2026-09-08**, with every source way's tags, version, timestamp and referenced nodes. The 8 September response-database timestamp is not the requested historical snapshot date. Original shared node IDs alone establish connectivity. Only 1435 mm passenger main-line ways are used; there are no siding exceptions or coordinate-based joins. The paths pass through **Monte Olimpino I, OSM way 25148357** and measure **4,123.8 / 4,228.8 m**. Track attachments measure **6.7 / 9.4 m** outward and **9.4 / 23.5 m** inward. The unchanged source matcher limits are **350 m station identity**, **60 m track attachment**, **5 m projection alternatives**, **45° maximum turn** and **8 km maximum path**. These are inferred corridor paths, not legal rail direction or exact running-track certification.

The independent Regione Lombardia 1:10,000 rail inventory is complete against its separate object-ID query: **eight records**, including five RFI standard-gauge records along the reviewed corridor and three excluded records representing the longer bypass or unrelated branch. The maximum one-way vertex-to-path separation for the five selected records is **37.8 m**, within the **50 m** review threshold. This comparison does not establish exact track alignment or reciprocal coverage. **No Lombardia geometry enters the feed.** Metadata revision is **2024-06-27**; the retrieved dataset metadata does not specify a licence, and the generic terms page does not establish one. The original JSON, metadata, terms and all inclusion/exclusion decisions are retained.

Feed geometry attribution is **© OpenStreetMap contributors, ODbL-1.0**, with [retained terms](../data/solothurn-como-sources/osm-terms.html.gz). The independent comparison is attributed to **Regione Lombardia**. The [Solothurn policy](../data/solothurn-como-policy.json) pins both directed path hashes, ordered way IDs, station identities, exact platforms and all eight context IDs. The source bundle's copied scope.json records the parent Zug source review; it does not define Solothurn admission. Seasonal application does not establish historical operation or year-round physical alignment.


## Brig–Domodossola passenger corridor

The table is cumulative from the shared pre-Simplon/Delle baseline. The Simplon contribution is six Friday and eight Sunday journeys; Delle contributes one further Friday journey. The table also includes the later five-journey Sunday Liesberg and two-journey Sunday M53 reviews.

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], simplon.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The [Simplon audit](../data/solothurn-audit/simplon-review.json) adds **six Friday / eight Sunday complete EC journeys**. It checks all **56 complete retained twelve-date patterns** on SBB agency **11**, EC route **91-2W-Y-j26-1**, including every previously unsuccessful platform variant. Eight exact directed Brig–Domodossola pairs are reviewed; the foreign call must occur exactly once at a journey terminal. Original calls, platform coordinates, permissions, times and every earlier successful path remain unchanged.

The retained SBB/FOT [station record](../data/solothurn-simplon-sources/sbb-domodossola-stations.json) explicitly links **8501607 Domodossola** to timetable number **8301003**, with edition **2024-09-19** and validity beginning **2024-12-15**. This is an exact source association, not a name/proximity guess. The SBB **2024-08-06** [station factsheet](../data/solothurn-simplon-sources/sbb-domodossola.pdf), target-status diagram on page 3, distinguishes **Domodossola FS 83-01003-3** from the separate FM and Domodossola II facilities. The crosswalk applies only at the internal graph boundary: the original GTFS foreign ID remains in every emitted call.

The [source bundle](../data/solothurn-simplon-sources/sources.json) retains an OSM snapshot at **2026-09-08 00:00 UTC**, including source tags, versions, timestamps and complete referenced nodes. Original shared-node topology supplies standard-gauge running lines. The one explicitly pinned passenger crossover **643956810**, gauge **1435**, passenger_lines **2**, inside the **Simplontunnel**, is used by five of the eight platform-pair paths. The other three use the connected running lines without it. No siding, yard or arbitrary coordinate connection is admitted. Every directed path and source-edge order is hash-pinned. Paths measure **40,671.0–40,876.5 m**, with track attachments no greater than **34.0 m**. Source limits remain **350 m station identity**, **120 m track attachment**, **5 m projection alternatives**, **90° maximum turn** and **50 km maximum path**.

The retained BLS [works notice](../data/solothurn-simplon-sources/bls-closures.html.gz), rechecked **8 September**, describes the Iselle–Domodossola weekday closure **27 July–11 December, 10:30–13:30**, plus a later October/November extension and specified November night closures. The six published Friday EC legs run **08:44–09:12, 08:48–09:16, 14:44–15:12, 16:48–17:16, 19:44–20:12 and 19:48–20:16**; none overlaps the applicable Friday window. The eight Sunday legs are outside the notice's weekday scope. This is a consistency check, not operator confirmation of every historical journey or passage time within a seasonal work zone. The copied field-145 timetable PDF concerns the parent Aargau IC 1303 review and does not set this EC route's times or calendars.

Attribution: **© OpenStreetMap contributors, ODbL-1.0** for emitted geometry; **SBB Infrastructure / opentransportdata.swiss** for station identity and the SBB diagram; **BLS** for works context. No open licence is invented for the retained SBB document. The [policy](../data/solothurn-simplon-policy.json) records original IDs, coordinates, full-pattern scope, source hashes and the crossover exception. The September 8 OSM snapshot postdates the published September 4/6 timetable sample. Applying it to those dates or other seasons remains an explicitly unproven historical alignment inference; running tracks and legal physical directions are not certified.


## Delle–Boncourt passenger corridor

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], delle.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

This table shares the pre-Simplon baseline and includes both border reviews and the later Liesberg road and M53 corridor reviews. The [Delle audit](../data/solothurn-audit/delle-review.json) adds **one Friday journey and no Sunday journeys**, for exact SBB agency **11**, **RE route 91-54-Y-j26-1**, **Delle 8718444 → Boncourt platform 3 / ch:1:sloid:128:2:3**. All **eight complete retained route patterns** are checked; four contain this directed pair. Delle must occur once at a terminal. The opposite direction, unknown platforms and other routes cannot inherit admission. All previous paths, stop coordinates, original IDs, calls and times are preserved.

The [source bundle](../data/solothurn-delle-sources/sources.json) retains the exact bounded Overpass query, original response and SHA-256 hashes, retrieved **8 September 2026** at historical snapshot **2 September 2026 00:00 UTC**. OSM station nodes **3080770163 / Delle / 8718444** and **3080770156 / Boncourt / 8500128** supply exact identities. The passenger station is not conflated with the distinct FOT **8500129 Delle-Frontière** operating point. Twelve original **1435 mm passenger branch-line ways**, connected at shared source nodes, form the **1,603.9 m** path. Station identity offsets are **34.1 / 28.6 m**; track attachments are **13.2 / 1.3 m**. There are no siding, yard or spur exceptions and no added junctions. The [policy](../data/solothurn-delle-policy.json) retains the **350 m station identity**, **60 m track attachment**, **5 m projection alternatives**, **45° turn** and **8 km maximum path** bounds. Full-pattern and all-context consensus checks remain in force.

The official [SNCF TER Delle station page](https://www.ter.sncf.com/bourgogne-franche-comte/se-deplacer/prochains-departs/delle-87184440), reviewed **8 September**, identifies the passenger station and lists trains toward Porrentruy/Delémont. This supplies station/passenger-service context; live platform displays do not prove the archived journey's running track. The [SBB Boncourt works notice](https://news.sbb.ch/fr/019d7b77-1725-7b43-86b8-b37fb2c2d611/modernisation-de-la-gare-de-boncourt), published **8 January 2025**, describes central-platform and track renewal, planned commissioning in late 2025 and finishing works through summer 2026. It is planned works context, not proof of completion. The retained [review observations](../data/solothurn-delle-sources/official-station-review.json) are clearly identified as web-reviewed notes: direct SNCF download returned 403, so no raw page body is claimed retained.

Geometry attribution is **© OpenStreetMap contributors, ODbL-1.0**; timetable attribution remains **opentransportdata.swiss**, with **SNCF TER / SBB** credited for official review context. Applying this OSM snapshot to other seasons remains a historical alignment inference. No exact running track or physical direction is certified. **All rail journeys in the two published-date canton-serving samples now have complete geometry**; this does not assert that every rail service runs on those dates or that every seasonal pattern is admitted.

## Liesberg road-detour and remaining local gaps

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], roadDetour.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

This table is cumulative and includes the later two-journey Sunday M53 review. The [road-detour audit](../data/solothurn-audit/road-detour-review.json) adds **five Sunday line-118 journeys**, retaining every Friday journey and all earlier Sunday admissions unchanged. The exact exception is **PostAuto / agency 801 / route 96-131-8-j26-1**, from **Liesberg, Seemättli ch:1:sloid:72196** to **Ochsengasse ch:1:sloid:72197**. Its **688.3 m** path exceeds the generic **600 m / 3 × direct distance** rule because the road climbs around the hillside. The [policy](../data/solothurn-road-detour-policy.json) permits at most **700 m for this directed pair only**. Every other route and pair retains the original bounds.

The emitted path is the unchanged result from the retained, verified pfaedle service-road run. Its one unique complete routing context includes the return call at Seemättli; calls are never deduplicated or shortened. All eight reviewed bus routes and all 72 complete routing inputs remain checked against the durable twelve-date context. Source hashes, matcher logs, original coordinates and the exact admitted geometry hash are asserted. The matcher must still report no fallback or import issue, and every occurrence must agree before a pair can be reused. The exception does not permit a failed or conflicting pattern to pass.

The [source bundle](../data/solothurn-road-detour-sources/sources.json), retrieved **8 September 2026**, retains OSM at **2 September 2026 00:00 UTC**. Relation **11568519**, explicitly tagged **PAG / bus 118 / GTFS 96-131-8-j26-1**, records consecutive Seemättli → Ochsengasse stops. Original ways **204519958 / Seemättliweg** and **204513892 / Im Pfarrgarten** connect through the shared node **2145136622**. The review follows their declared relation order and direction, with exact source-feature hashes and no invented connection. Sampling both polylines every **5 m** gives maximum distances of **17.5 m from emitted path to source corridor** and **5.2 m in the reverse comparison**, within the explicit **20 m** comparison bound. These are sampled corridor comparisons, not exact Hausdorff bounds or proof of operational direction. The OSM relation is an additional representation from the same community source as the routing PBF, not an independent provider.

Official [timetable field 50.118](../data/solothurn-road-detour-sources/50.118.pdf), dated **3 December 2025**, confirms Seemättli → Ochsengasse → Dorfplatz → Seemättli and the overnight services. It provides stop-order/calendar context, not road coordinates. Geometry remains attributed to **© OpenStreetMap contributors, ODbL-1.0**, timetable context to **PostAuto / oev-info.ch**, and the national feed to **opentransportdata.swiss**. No licence is inferred for the timetable PDFs. Historical alignment, physical access and current diversions remain unproven.

The same review preserves negative findings:

- **Egerkingen Gäu Park → Bahnhof, BOGG 501:** [official field 50.501](../data/solothurn-road-detour-sources/bogg-501.pdf), dated **29 October 2025**, confirms the consecutive stops. Historical OSM relation **6455364** has the exact route/operator identity, but its mapped road corridor differs from the retained **1,213.2 m** pfaedle candidate: sampled distances reach **177.8 / 321.8 m** in the two comparison directions. The cantonal **1,316.4 m** candidate also differs. The evidence does not justify choosing one or raising the detour limit. **All 29 Friday journeys remain excluded.** The [rejected review](../data/solothurn-road-detour-sources/egerkingen-rejected-review.json) and audit retain the relation, source edges and candidate hash. Original BOGG website links returned 404; the retained official timetable-field download is the accessible replacement source.
- **Arlesheim Dorf platform E, tram 10:** original coordinate **[7.61942041, 47.49339586]** remains **${roadDetour.source.exclusions.arlesheim.nearestTrackMetres.toFixed(1)} m** from the nearest retained historical OSM tram track, beyond the **80 m** attachment limit. This corroborates the previous **138.4 m** gap to Basel's official linework. No source-supported platform relocation was established. **94 Friday / 103 Sunday journeys remain excluded.**
- **EV4 Pieterlen → Biel Carterminal:** the retained complete-pattern road candidates disagree; **21 Sunday replacement-bus journeys remain excluded**. M53 was unresolved at this stage; the subsequent official-corridor review below admits its two Sunday journeys.

Final exclusions are **${s.days[0].coverage.trips - s.days[0].coverage.admittedTrips} Friday / ${s.days[1].coverage.trips - s.days[1].coverage.admittedTrips} Sunday journeys**, all tram or bus. Every rail journey in both published-date samples still has complete geometry.

## M53 official night-line corridor and Pieterlen alternatives

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete patterns', 'Previous patterns lost'], m53.days.map(d => [d.date, d.before.admittedTrips, d.after.admittedTrips, d.newlyAdmittedPatterns.length, d.lostAdmittedPatterns.length]))}

The [M53 audit](../data/solothurn-audit/m53-review.json) admits **two Sunday night-bus journeys**, with no Friday change. Bern's original line feature **9353**, line **M53**, operator **Busbetrieb Solothurn und Umgebung**, is explicitly associated with **agency 883 / route 92-M53-j26-1**. The [policy](../data/solothurn-m53-policy.json) covers only **Amthausplatz platform A / ch:1:sloid:494:0:1 → Baseltor / ch:1:sloid:72386**. Its **847.6 m** path attaches within **29.1 m**, satisfying the unchanged **60 m snap, 3 × direct distance / 600 m minimum detour allowance and 5 m alternative-snap** limits. All earlier successful paths take precedence.

Both retained complete M53 contexts, containing **44 and 43 original calls**, are checked against the twelve-date snapshot. The prior **1,040.2 m and 870.0 m** road alternatives remain retained with their complete calls and geometry; neither is selected by relaxing road consensus. The separately attributed official night-line feature supplies this exact pair. Solothurn's own network excludes night routes, so every other M53 leg still requires admitted supplementary geometry. Unknown routes, operators, platforms and the reverse direction cannot inherit this association.

The [source bundle](../data/solothurn-m53-sources/sources.json) pins the unchanged Bern feature and package hashes. Bern data was updated **1 January 2026**, the package published **9 July 2026**, and acquired **8 September 2026**. Attribution is **Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern**, under the retained [German](../data/solothurn-m53-sources/terms_of_use_de.pdf) and [French](../data/solothurn-m53-sources/terms_of_use_fr.pdf) cantonal terms, dated **20 January 2026**. No generic Creative Commons licence is substituted. Official [timetable field 40.953](../data/solothurn-m53-sources/40.953.pdf), dated **10 September 2025**, confirms Kofmehl → Amthausplatz → Baseltor, with departures 01:08/02:38, 01:13/02:43 and 01:15/02:45 respectively. It supplies operator and stop-order context; the pinned national GTFS remains authoritative for emitted calls and times. Timetable context is credited to **BSU / oev-info.ch**, without an inferred PDF reuse licence.

The same bundle retains the **two full EV4 contexts** and their Pieterlen Bahnhof → Biel Carterminal candidates, **10,332.6 m and 10,240.1 m**. They differ mainly at the Pieterlen station forecourt, including a loop in one candidate. The retained official SBB works page documents replacement buses for **5–7 September 2026, Saturday 04:00 to Monday 04:00**, covering the Sunday validation date. Its [parking plan](../data/solothurn-m53-sources/pieterlen-parking-plan.pdf), created **11 June 2026**, shows parking closures and relocation westward from July 2026 through November 2027. Those documents do not establish a replacement-bus itinerary or prove that either candidate was prohibited. **All 21 Sunday EV4 journeys therefore remain excluded.** The historical OSM review is retained and attributed to **© OpenStreetMap contributors, ODbL-1.0**; works context is credited to **SBB**. Applying any source vintage to other seasons remains an inference, with no certification of physical direction or current diversions.

## Seasonal and holiday sample

${table(['Civil date', 'Source journeys', 'Admitted journeys', 'Complete admitted patterns'], seasonal.days.map(d => [d.date, d.trips, d.admittedTrips, d.admittedPatterns]))}

The sample applies the pinned GTFS calendars and exceptions to winter weekdays/Sundays, Good Friday, Easter Sunday, summer, Swiss National Day and autumn. **${seasonal.newlyActiveSeptemberExcludedRoutes.length}** of the September-inactive route records become active; **${seasonal.stillInactiveRoutes.length}** remain inactive on all twelve dates. The [seasonal inventory](../data/solothurn-audit/seasonal-summary.json) lists every annual route on every date, and the [pattern audit](../data/solothurn-audit/seasonal-patterns.json.gz) retains every directed stop chain, decision and matched mask. A durable [context snapshot](../data/solothurn-pattern-contexts.json.gz) retains 2,824 complete representative source patterns for offline revalidation and supplementary consensus.

Geometry from the recorded source vintages is applied to this timetable sample; historical/seasonal alignment validity is unproven. **25 October is the DST fallback day:** source stop order and geometry are tested, but the repeated local hour is not disambiguated into 25 elapsed hours. It is not promoted to an app day feed. Only the reviewed September Friday/Sunday can be promoted; this sample does not assert daily or year-round completeness.

## Seasonal platform follow-up and residual evidence

The [residual-gap audit](../data/solothurn-audit/residual-gap-review.json) extends the already reviewed station associations to **SBB IC81 / agency 11 / route 91-81-A-j26-1** at Interlaken Ost and **BLS IR17 / agency 33 / route 91-17-B-j26-1** at Bern. It checks **all five IC81 and all 27 IR17 complete retained contexts**. IC81 uses only original Interlaken Ost platforms **5/7** and the existing FOT node explicitly labelled **tracks 5–8**. IR17 uses only the terminal **Burgdorf platform 2 → Bern platform 50** pair, the original Bern station point and the already reviewed eastern approach and station curve. Neither association changes station coordinates, gauge filters, attachment limits, stop-order guards or full-context consensus.

${table(['Date', 'Before admitted', 'After platform review', 'Platform-stage additions'], residual.days.filter(d => d.platformAddedJourneys).map(d => [d.date, d.beforeAdmitted, d.beforeAdmitted + d.platformAddedJourneys, d.platformAddedJourneys]))}

This adds **seven IC81 journeys on 1 August** and **one IR17 journey on each of five dates**, for **12 additional seasonal journey instances** across seven complete patterns. September Friday/Sunday counts are unchanged. The source vintages remain those recorded for the FOT infrastructure and the **August 2026 SBB Bern station plan** above; the review does not turn those sources into a certification of historical running tracks. Applying the August plan to earlier timetable dates remains an explicit inference. All **2,824 complete source contexts** are replayed against the [previous segment-hash baseline](../data/solothurn-seasonal-platform-baseline.json.gz): every previously selected segment and every previously admitted complete pattern is preserved.

### Summer rail and winter bus follow-up

The subsequent review uses its own [complete-context baseline](../data/solothurn-seasonal-completion-baseline.json.gz), after the IC81/IR17 additions, and adds **79 seasonal journey instances**. Every previously selected segment and all earlier complete admissions remain unchanged. The September feeds retain **7,033 Friday / 5,695 Sunday movements**.

${table(['Date', 'Previously admitted', 'Now admitted', 'Additional complete journeys'], residual.days.filter(d => d.completionAddedJourneys).map(d => [d.date, d.completionBeforeAdmitted, d.admitted, d.completionAddedJourneys]))}

**Rail: four journeys on 17 July.** Two S23 journeys, exact SBB agency **11 / route 91-23-j26-1**, run **Däniken SO platform 2 → Aarau platform 3 or 2**. Two S26 journeys, exact SBB agency **11 / route 91-26-j26-1**, use **Däniken SO platform 2 → Aarau platform 2** and **Aarau platform 5 → Dulliken platform 4**. All four original complete contexts cross the previously reviewed SBB **DK–DKO** curve. The three Däniken–Aarau paths measure **7,186.5–7,194.5 m**; Aarau–Dulliken measures **10,022.6 m**, with endpoint station attachments below **45 m**. The expanded [S26 source policy](../data/solothurn-s26-policy.json) pins the exact route/operator, original coordinates and full-pattern IDs. No rejected metre-gauge FOT record enters a path. All original intermediate calls remain blocked against revisiting and every prior successful leg takes precedence. **Every rail journey in all twelve audited-date samples now has complete geometry.** This does not establish year-round coverage or the effective historical alignment of the later-published SBB source.

**Bus: 75 winter/spring journeys.** A fresh, offline [service-road source bundle](../data/solothurn-seasonal-roads/source.json) retains **all 50 complete patterns on BOGG 507, BOGG N51 and SBB replacement EV1**. The run reuses the previously reviewed service-road configuration: **20 m stop candidates**, supported original access/direction/turn restrictions, and unchanged **3 × direct distance / 600 m minimum detour allowance**. There are **zero matcher/import issues** and the maximum imported snap is **19.96 m**. The [five-pair policy](../data/solothurn-seasonal-road-policy.json) admits only unanimous complete-context results:

- **BOGG 507 / agency 793 / route 92-507-j26-1:** Am Kreuzbach ↔ Gäuerstübli (**342.8 m** each direction) and Am Kreuzbach → Kappel Schulhaus (**1,844.4 m**). Four, five and three complete contexts respectively agree, admitting **63 journeys on 16 January**.
- **BOGG N51 / agency 793 / route 92-N51-j26-1:** Hägendorf Gässli → Solothurnerstrasse (**413.8 m**), with all three complete contexts agreeing. This admits **four night journeys on each of 18 January, 3 April and 5 April**. Every other night-service leg still requires supplementary geometry.
- **SBB replacement EV1 / agency 7231 / route 92-A01-T-j26-1:** Däniken Post → Schönenwerd Bahnhof (**2,957.7 m**) agrees across both complete contexts. This is a partial geometry improvement only. **Däniken Post → Dulliken Bahnhof** and **Schönenwerd Bahnhof → Aarau Bahnhof** still disagree; all **six EV1 journeys on 17 July remain excluded**. The audit retains all seven reviewed pair assessments and every full-context alternative, including the failures.

The road input is the pinned **Geofabrik Switzerland 2 September 2026** extract, rematched **9 September 2026**. Geometry attribution remains **© OpenStreetMap contributors, ODbL-1.0**; pfaedle and its retained configuration are credited to **University of Freiburg / Patrick Brosi et al., GPL v3**. Original calls, coordinates, permissions and timetable dates are preserved; source hashes, the road graph, full routing inputs and matcher logs are retained. A September road snapshot applied to winter or spring is an explicitly unverified historical alignment inference, not operator confirmation.

The audit also inventories **${residual.residualPairs.length} still-unmatched route-specific directed pairs** across all twelve dates, retaining original coordinates, platform IDs, full-pattern references and per-date occurrences. These now cover Arlesheim tram platform E, the winter and later Egerkingen 501 stop identities, Pieterlen EV4 and the two remaining summer EV1 pairs. The winter BOGG 507/N51 and all sampled rail gaps are resolved. A journey with two failed pairs is counted once in the per-route exclusion totals; failed-pair occurrence counts must not be summed as unique journeys. The linked seasonal pattern audit retains all original calls and matched masks.

New [residual source evidence](../data/solothurn-residual-sources/sources.json), reviewed **9 September 2026**, supports retaining the following exclusions:

- **Pieterlen EV4:** the official [SBB replacement-bus plan](../data/solothurn-residual-sources/pieterlen-replacement-plan.pdf), dated **May 2025**, marks the boarding location and dotted pedestrian access from the railway platforms. Those dotted paths are not bus routes. The plan predates the 2026 works and does not choose between the two retained full-context departure paths. Credits as printed: **SBB / OpenStreetMap contributors / imagico / trafimage.ch / mapset.ch**.
- **Egerkingen 501:** the mapped bus relation uses **${residual.egerkingenAlternatives.relationPathMetres.toFixed(1)} m** of original road geometry, ending **${residual.egerkingenAlternatives.toStopGapMetres.toFixed(1)} m** from the original GTFS Bahnhof coordinate. It differs from the **1,213.2 m** road-matcher and **1,316.4 m** cantonal candidates. The municipal [planning report](../data/solothurn-residual-sources/egerkingen-planning-2020.pdf), dated **10 November 2020**, proposes a direct bus link and relocated stops; its target-state map is not evidence that the works were completed. Credit: **Einwohnergemeinde Egerkingen / KFB Pfister AG**, with an **AVT 19 October 2017** conceptual map on page 6. BOGG's retained current stop-plan page supplies an Olten plan but no reviewed Egerkingen itinerary. No stop substitution or detour exception is admitted.
- **Arlesheim tram 10:** the original platform E coordinate remains unsupported by both the retained official line and historical tram tracks. The previously recorded **138.4 / 120.7 m** gaps and unchanged **80 m** attachment limit remain decisive; no source-supported platform correction was established.

![Egerkingen source-path alternatives](../data/solothurn-audit/egerkingen-alternatives.svg)

The cantonal path in this comparison is obtained with an explicitly **diagnostic-only 1,400 m search**; it does not change the admission limits. All three paths remain excluded. The new PDFs are retained as review context; no reuse licence is inferred and no PDF geometry enters the feed. The residual audit states what additional operating or platform evidence each September case needs. Year-round coverage and current physical directions remain uncertified.

A subsequent [station-access follow-up](SOLOTHURN-STATION-ACCESS.md) quantifies both full-context EV1/EV4 alternatives and checks October 2024 SBB Däniken/Dulliken boarding plans plus a May 2026 ASTRA Egerkingen road-work notice. All seven residual pairs are reconciled across twelve dates. The documents do not select bus approaches or correct tram platform E, so no additional journey is admitted.

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
node scripts/prepare-solothurn-access-roads.mjs
node scripts/match-postbus-roads.mjs --pfaedle /private/tmp/gleislicht-pfaedle/build/pfaedle --osm /private/tmp/solothurn-access-network.osm --config data/solothurn-access-roads/routing.cfg --feed /private/tmp/solothurn-access-feed --output /private/tmp/solothurn-access-matched
node scripts/import-solothurn-access-roads.mjs
node scripts/prepare-solothurn-seasonal-roads.mjs
node scripts/match-postbus-roads.mjs --pfaedle /private/tmp/gleislicht-pfaedle/build/pfaedle --osm /private/tmp/solothurn-seasonal-road-network.osm --config data/solothurn-seasonal-roads/routing.cfg --feed /private/tmp/solothurn-seasonal-road-feed --output /private/tmp/solothurn-seasonal-road-matched
node scripts/import-solothurn-seasonal-roads.mjs

# Build complete directed patterns, both feeds and all machine audits.
npm run data:solothurn
node scripts/review-solothurn-local-gaps.mjs
npm run data:solothurn:check
npm run data:solothurn:seasonal
npm run data:solothurn:seasonal:check
npm run data:solothurn:alignments
npm run data:solothurn:release
node scripts/review-solothurn-residual-gaps.mjs
node scripts/review-solothurn-residual-gaps.mjs --check
node scripts/review-solothurn-station-access.mjs --check
npm run data:solothurn:docs
npx vitest run scripts/solothurn-region.test.mjs scripts/solothurn-corridor.test.mjs scripts/solothurn-rail-review.test.mjs scripts/solothurn-s29-precedence.test.mjs scripts/solothurn-bus-junction.test.mjs scripts/solothurn-access-roads.test.mjs scripts/solothurn-bern-terminal.test.mjs scripts/solothurn-s26-review.test.mjs scripts/solothurn-como-rail.test.mjs scripts/solothurn-simplon-rail.test.mjs scripts/solothurn-delle-rail.test.mjs scripts/solothurn-road-detours.test.mjs scripts/solothurn-m53-corridor.test.mjs scripts/solothurn-residual-gaps.test.mjs scripts/solothurn-seasonal-roads.test.mjs scripts/solothurn-release.test.mjs
npx vitest run src/test/regions.dom.test.tsx -t solothurn-region
npx playwright test e2e/regional-layout.spec.ts --workers=1
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
