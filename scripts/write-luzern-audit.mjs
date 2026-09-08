import { readFile, writeFile } from 'node:fs/promises'

const audit = JSON.parse(await readFile('data/luzern-study-audit.json', 'utf8'))
const shipping = JSON.parse(await readFile('data/luzern-shipping-probe.json', 'utf8'))
const n = value => value.toLocaleString('en-CH')
const pct = (a, b) => `${(100 * a / b).toFixed(2)}%`
const cell = s => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
const row = xs => `| ${xs.map(cell).join(' | ')} |`
const [friday, sunday] = audit.days
const source = name => audit.catalogue.sources.find(s => s.file === name)
const measures = [
  ['Annual-census routes active in civil day', d => d.routes.length],
  ['Civil-day movements, all modes', d => d.trips],
  ['Representative headway movements (not scheduled)', d => d.representativeHeadwayTrips],
  ['Admitted scheduled movements', d => d.admittedTrips],
  ['Excluded movements', d => d.excludedTrips],
  ['Admitted journeys using reviewed donor edges', d => d.admittedTripsUsingRepair],
  ['Directed pairs traversing reviewed repairs', d => d.repairedDirectedPairs],
  ['Admitted journeys using inferred OSM road fallback', d => d.admittedTripsUsingRoads],
  ['Directed pairs using inferred OSM road fallback', d => d.roadDirectedPairs],
  ['Journeys using reviewed road pattern exceptions (overlap with road row)', d => d.admittedTripsUsingRoadContexts],
  ['Reviewed road pair/context records', d => d.roadContextDirectedPairs],
  ['Unique route-specific stop pairs, ignoring context', d => d.uniqueRouteStopPairs],
  ['Admitted journeys using inferred federal rail corridors', d => d.admittedTripsUsingFederalRail],
  ['Directed pairs using inferred federal rail corridors', d => d.federalRailDirectedPairs],
  ['Admitted movements using federal cableway axes', d => d.admittedTripsUsingFederalCableways],
  ['Directed pairs using federal cableway axes', d => d.federalCablewayDirectedPairs],
  ['Preceding-service-day carry-in / admitted', d => `${n(d.carryInTrips)} / ${n(d.admittedCarryInTrips)}`],
  ['Routes with at least one admitted pattern', d => d.routes.filter(r => r.admittedTrips).length],
  ['Directed stop patterns / admitted', d => `${n(d.patterns)} / ${n(d.admittedPatterns)}`],
  ['Directed stop pair/context records / matched', d => `${n(d.directedPairs)} / ${n(d.matchedDirectedPairs)}`],
  ['Directed pair/context record geometry coverage', d => pct(d.matchedDirectedPairs, d.directedPairs)],
  ['Scheduled segment occurrences / matched', d => `${n(d.scheduledSegmentOccurrences)} / ${n(d.matchedScheduledSegmentOccurrences)}`],
  ['Scheduled segment geometry coverage', d => pct(d.matchedScheduledSegmentOccurrences, d.scheduledSegmentOccurrences)],
  ['All segment occurrences / matched (including headways)', d => `${n(d.segmentOccurrences)} / ${n(d.matchedSegmentOccurrences)}`],
  ['All-movement segment geometry coverage', d => pct(d.matchedSegmentOccurrences, d.segmentOccurrences)],
]
const groupIds = [...new Set(audit.days.flatMap(d => d.groups.map(g => g.id)))]
const groups = groupIds.map(id => {
  const first = audit.days.flatMap(d => d.groups).find(g => g.id === id)
  const values = audit.days.flatMap(d => { const g = d.groups.find(g => g.id === id); return g ? [`${n(g.admittedTrips)} / ${n(g.trips)}`, `${g.admittedPatterns} / ${g.patterns}`, pct(g.matchedSegmentOccurrences, g.segmentOccurrences)] : ['0 / 0', '0 / 0', '—'] })
  return row([`${id} · ${first.agency}`, ...values])
})
const status = day => `${day.admittedTrips}/${day.trips} ${day.status.replaceAll('-on-civil-day', '')}`
const roadRouteIds = new Set(audit.days.flatMap(d => d.directedStopPairs.filter(p => ['osm-road-inference', 'osm-road-pattern-inference'].includes(p.geometrySource) && p.admittedOccurrences).map(p => p.routeId)))
const railRouteIds = new Set(audit.days.flatMap(d => d.directedStopPairs.filter(p => p.geometrySource === 'fot-rail-inference' && p.admittedOccurrences).map(p => p.routeId)))
const cableRouteIds = new Set(audit.days.flatMap(d => d.directedStopPairs.filter(p => p.geometrySource === 'fot-cableway-inference' && p.admittedOccurrences).map(p => p.routeId)))
const routeRows = audit.inventory.map(r => row([`\`${r.routeId}\``, `${r.agencyId} · ${r.line}`, r.mode, r.annualTripRecords, ...r.days.map(status), [...r.sourceFeatures, ...(roadRouteIds.has(r.routeId) ? ['OSM fallback'] : []), ...(railRouteIds.has(r.routeId) ? ['FOT rail'] : []), ...(cableRouteIds.has(r.routeId) ? ['FOT cableway'] : [])].join(', ') || '—', [...new Set(r.days.flatMap(d => d.reasons))].join(', ') || '—']))
const unusedSources = audit.sourceInventory.filter(s => s.status !== 'used-for-admitted-patterns').map(s => row([s.key, s.properties.LINIENBEZ, s.status, s.gtfsRoutes.join(', ') || '—']))
const unmatchedStops = audit.sourceStopReview.filter(s => !s.gtfsStopPresent).map(s => row([s.id, s.name, s.municipality]))
const report = `# Luzern cantonal transit source adapter and audit

Built on 8 September 2026, starting from [the national source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#lu). **The entire pinned national timetable was scanned for Luzern membership: ${audit.annualRouteRecords} route records, ${audit.annualAgencies} feed agencies and ${n(audit.scope.annualScopedTripRecords)} annual trip records.** The delivered regional feeds contain **${n(friday.admittedTrips)} Friday and ${n(sunday.admittedTrips)} Sunday journeys**, on ${friday.routes.filter(r => r.admittedTrips).length} and ${sunday.routes.filter(r => r.admittedTrips).length} routes respectively. ${audit.inventory.filter(r => r.days.some(d => d.admittedTrips)).length} distinct route records have an admitted pattern on at least one date.

Only complete directed stop patterns with usable geometry are admitted. This is a complete **inventory of the scoped archive**, and a measured **partial regional motion feed**. It is not complete cantonal geometry, year-round validation or direction-certified street routing. The underlying official linework is undirected; the validation below establishes ordered source-call compatibility and plausible connected corridors.

## Deliverables

- [Friday 4 September full-day manifest](../public/data/luzern-region/2026-09-04/luzern-region-day-manifest.json) and [morning snapshot](../public/data/luzern-region/2026-09-04/luzern-region-morning.json).
- [Sunday 6 September full-day manifest](../public/data/luzern-region/2026-09-06/luzern-region-day-manifest.json) and [morning snapshot](../public/data/luzern-region/2026-09-06/luzern-region-morning.json).
- [Machine-readable audit](../data/luzern-study-audit.json): every annual route, every source line, every fixture directed pattern and route-specific directed pair/context record, with occurrences, admission, failures and source references.
- [Source snapshot catalogue](../data/luzern-sources/sources.json): raw GeoJSON pages, complete merged collections, object-ID responses, field/domain schemas, HTML metadata/terms and canton polygon, all hashed and retained in the repository.
- [Reviewed policy and operator crosswalk](../data/luzern-policy.json), [adapter](../scripts/luzern-line-geometry.mjs), [timetable census](../scripts/luzern-timetable.mjs), [builder](../scripts/build-luzern-region.mjs) and [independent artifact checker](../scripts/check-luzern-region.mjs).

The manifests use the existing network snapshot format with twelve two-hour chunks; chunk paths are relative to their manifest directory. They are data artifacts, not a new selectable UI study. Existing study selection, refresh and deployment are separate work. No website deployment is part of this data delivery.

## Canton and timetable scope

The geographical test is point-in-MultiPolygon against the complete swisstopo Luzern feature, including its separate pieces and holes. Its bounding box is only a prefilter. The census scans **${n(audit.scope.annualStopTimeRows)} national stop-time records**, selects trips with at least one source stop in the canton across **all** agencies and modes, then reads every call of fixture trips. It finds ${n(audit.scope.cantonStopRecords)} in-canton GTFS stop records (including parent/platform records), of which ${n(audit.scope.calledCantonStopRecords)} are called in the archive. Stop records are not unique physical stations.

This covers the agglomeration, Entlebuch, Sursee, Willisau, Seetal, Lake Lucerne and the Luzern shore of Hallwilersee. No vbl/PostAuto agency allowlist, tariff boundary or rectangular crop determines membership. Both bus replacement agencies, Pro Regio Huttwil, SGV, Hallwilersee and all represented mountain modes remain in the denominator. Source-only lines without a Luzern-calling GTFS route are explicitly listed below.

Every selected journey retains its cross-canton termini and all intermediate calls, even when the geometry ends earlier. No clipped trip is used to improve coverage. Services crossing the canton without a stop fall outside this passenger-service scope. St. Urban and St. Urban Ziegelei rail stops and the AVA Menziken corridor lie outside the polygon; their source lines remain in the source census, not silently admitted by a regional brand name. This does not establish a census of all real-world services absent from GTFS.

Fixtures are **Friday 2026-09-04** and **Sunday 2026-09-06**, in Europe/Zurich timetable time. Calendar exceptions are applied. Thursday 3 September and Saturday 5 September are also read for preceding-day trips crossing midnight. Trips ending after 24:00 keep their original times; the civil-day window defines visibility. A service labelled Friday in GTFS can depart after 24:00 and belong to Saturday's civil window. The per-route table therefore reports civil-day counts separately from the machine-readable active source-service-day counts.

Frequency templates are expanded on their source interval, with exact_times=0 marked as representative headway movements, never scheduled departures. The Hammetschwand lift supplies ${n(friday.representativeHeadwayTrips)} such movements per fixture; none is admitted because its geometry is absent. GTFS pickup/drop-off rules are retained, and any pattern requiring prior arrangement is excluded from unconditional fixed departures. No reservation patterns were encountered on these two fixtures. The annual record census and these dates do not prove winter, summer-pass, holiday or special-event coverage.

## Source dates, coordinates and attribution

| Source | Vintage / retrieval distinction | SHA-256 |
| --- | --- | --- |
| National GTFS | Feed ${audit.feed.feed_version}; valid 14 December 2025–12 December 2026 | \`${audit.sourceHashes.archive}\` |
| Luzern bus, 114 features | Metadata: 26 May 2026; FP_JAHR=2026 | \`${source('bus.geojson').sha256}\` |
| Luzern rail/mountain, 29 features | Metadata: 8 May 2026; FP_JAHR=2026 | \`${source('rail.geojson').sha256}\` |
| Luzern boat, 1 feature | Metadata: 5 August 2015; excluded from 2026 geometry | \`${source('boat.geojson').sha256}\` |
| Luzern regional stops, 1,448 records | Metadata: 6 August 2026 | \`${source('stops.geojson').sha256}\` |
| swisstopo canton polygon | Retrieved ${source('boundary.json').retrievedAt}; API response gives no source vintage | \`${source('boundary.json').sha256}\` |
| Federal rail network, 3,210 nodes / 3,424 segments | Used segment Stand: 6 July 2021; asset updated 18 January 2025; catalogue checked 8 September 2026 | \`${audit.federalRail.source.sha256}\` |

The cantonal source snapshot was acquired on 8 September 2026. Retrieval timestamps do not replace the layer dates. Line sources are EPSG:2056; the ArcGIS query transforms them to EPSG:4326. Matching uses those returned coordinates, metre-distance calculations, exact shared vertices keyed to seven decimal places, and output coordinates rounded to seven decimals. Cantonal paths are not simplified or joined by proximity. Five explicitly reviewed short gaps use exact edges copied from other lines in the same official bus source; their donor identities and coordinates are retained in the policy and feed metadata. Failed bus pairs additionally use the separately attributed OSM fallback described below. Failed rail pairs use the separately dated federal infrastructure fallback below. The boundary is the returned API polygon, with its supplied precision; an exact cadastral boundary survey is not implied.

**Attribution:** Timetable: **SBB / opentransportdata.swiss**. Cantonal data: **© rawi Kanton Luzern; © Verkehrsverbund Luzern**. Canton boundary: **© swisstopo**. Federal rail and cableways: **© Federal Office of Transport (FOT)**. Processed regional feeds and this audit are by **Gleislicht**. Cantonal [product metadata](https://daten.geo.lu.ch/produkt/oevxxxxx_col_v5) and [Open-By terms](https://geoportal.lu.ch/Nutzungsbedingungen) permit use with source attribution; the acquired pages are retained. The [national timetable terms](https://opentransportdata.swiss/en/terms-of-use/) require attribution, raw-data refresh and authorship of processed results. The [swisstopo terms](https://www.swisstopo.admin.ch/en/terms-and-conditions) govern the boundary. No blanket CC0 licence is assigned to the combined feed. Frozen fixtures are dated study artifacts, not a continuously refreshed live service.

The large national archive remains an external input, available at the [pinned download](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip); its hash is mandatory. Current cantonal APIs are not immutable, so reproduction should use the committed source snapshots, not a fresh download claimed to have the same bytes.

## Adapter and admission rules

Local TU enumeration values are decoded using each layer's saved domain. For example, **TU 11 means vbl and maps to GTFS agency 820**; it must not be confused with SBB's GTFS agency 11. The crosswalk keeps separate rail/bus identities for AVA and ASM. It strips only the documented bus prefix “Linie”, and joins exact operator, mode and displayed line. BLS S6's two source branches share the exact identity and graph. It does not borrow another operator's alignment because the line number matches.

Explicit reviewed aliases cover Tellbus 493, Zentralbahn IRLEX/LIX/IRLIX, SOB VAE, SBB N7 (source NEX), Vitznau cogwheel 82/88, Weggis cableway 2562, Sonnenberg 2515 and Gütsch 2510. The latter demonstrates source ownership versus timetable publishing: the source names Château Gütsch, while GTFS publishes it under vbl. TU=0 is not an operator; Sonnenberg is mapped by its explicit route and Kursbuch identity. Unresolved aliases remain excluded.

For each route and ordered platform pair the adapter projects stops onto that line's graph. It requires a connected path, endpoint gaps ≤120 m, path length ≤max(1,200 m, 4.5 × direct distance), and a noncollapsed path (≥1 m and, for stop separation over 30 m, at least half that separation). Nearby alternative line parts may be tried only within 5 m of the closest projection and within the same endpoint limit. Projected platform connectors are explicit in the output. Lines connect at shared source vertices; geometric crossings do not create junctions.

A **directed pattern** includes route ID, direction_id, the entire ordered stop-ID sequence, repeated stops and pickup/drop-off rules. Every adjacent pair is measured. A single failed pair excludes the entire pattern, with no omitted call, substituted chord, unsupported bridge or spliced shortened journey. Pair keys include route identity and direction through from/to ordering; reverse service is independently checked. Repeated-stop loops are retained in pattern identity and collapsed projections are rejected. Successful segments on an excluded pattern count as measured geometry in the unfiltered denominator but are not exported as an admitted journey.

The source has no one-way or direction field. A successful ordered match is an **inferred physical corridor**, not certification of the correct carriageway, running track, bridge deck, tunnel bore or temporary diversion. In particular, shortest paths through source loops can require operational review even when the numerical tests pass. No observed vehicle positions or realtime prediction is included. Missing national rail/mountain/boat geometry is not replaced with stop interpolation.

## Weekday / Sunday results

| Measure | Friday 4 September | Sunday 6 September |
| --- | ---: | ---: |
${measures.map(([label, f]) => row([label, ...audit.days.map(d => { const v = f(d); return typeof v === 'number' ? n(v) : v })])).join('\n')}

All exported journeys have 100% matched segments **by the admission rule**. The unfiltered scheduled-segment coverage (${pct(friday.matchedScheduledSegmentOccurrences, friday.scheduledSegmentOccurrences)} / ${pct(sunday.matchedScheduledSegmentOccurrences, sunday.scheduledSegmentOccurrences)}) is the useful measure of remaining work. Unique-pair percentages are lower; frequently repeated urban trips cannot conceal missing regional or mountain patterns. The audit keeps scheduled occurrences and representative-headway occurrences separate for each pair.

| Agency:mode | Friday admitted/total trips | Friday admitted/total patterns | Friday all-segment geometry | Sunday admitted/total trips | Sunday admitted/total patterns | Sunday all-segment geometry |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${groups.join('\n')}

## Exclusions and source limitations

### Inferred bus road fallback

The [road cache](../data/luzern-road-cache.json) covers **${audit.roads.agencies.reduce((n, a) => n + a.patterns, 0)} complete bus stop patterns across ${audit.roads.agencies.length} agencies**, including every bus pattern on both fixtures. Routing inputs retain the entire ordered platform sequence and coordinates, route ID and cross-canton termini. Each agency is matched independently using [pfaedle](https://github.com/ad-freiburg/pfaedle) at commit 99f2cd466696ecc6bdb73b2b3bb9008557fcb84a, with bus access/direction rules, explicit fallback warnings and trie aggregation disabled. These remain inferred paths, not operator-verified or diversion-certified routes.

Input roads are the **Geofabrik Swiss extract dated 2 September 2026 plus the border extract retrieved 8 September 2026**, reused from the [documented offline road pipeline](POSTBUS-ROAD-GEOMETRY.md). The combined filtered PBF SHA-256 is \`${audit.roads.metadata.source.osmSha256}\`. The dated extract is not replaced with today's mutable [Geofabrik download](https://download.geofabrik.de/europe/switzerland.html). Binary, configuration, input pattern, output shape, stop-time, trip and warning-log hashes are recorded per agency. The [compressed matcher evidence](../data/luzern-road-evidence) retains all original shapes, monotone stop distances, full pattern identities and explicit warnings, so the checker reconstructs and verifies every cached accepted or rejected segment offline.

Road inference is consulted **only after official bus geometry fails**. A reusable route-specific directed pair is accepted only when every occurrence in every complete input pattern yields an accepted, byte-identical road path. A failed context or a different branch blocks the pair; no successful representative hides another pattern's failure. Of ${n(audit.roads.consensusPairs)} bus pairs, ${n(audit.roads.acceptedConsensusPairs)} pass this road consensus and ${n(audit.roads.consensusPairs - audit.roads.acceptedConsensusPairs)} do not. These are fallback-candidate counts, not new delivered paths: successful official geometry always takes precedence. Final road paths retain the existing 120 m snapping and max(1,200 m, 4.5 × direct distance) detour limits, reject collapsed paths, and connect to the exact source platforms. Road interiors use the shared importer's 5 m simplification / six-decimal precision; final platform endpoints use seven decimals. Repeated calls are never removed.

The fallback adds **${n(friday.admittedTripsUsingRoads)} Friday and ${n(sunday.admittedTripsUsingRoads)} Sunday complete journeys**, bringing bus admission to **7,371 / 7,374 Friday** and **5,249 / 5,250 Sunday**. Gains include Sörenberg–Glaubenbielen line 241, Tellbus 493, Rotkreuz 73, Küssnacht 502/508/622, vbl branches, EV1 replacement buses and night routes. Every delivered journey has a per-segment geometrySources array; every road pair records its full roadPatternIds and the original officialAssessment. [Regression digests](../data/luzern-road-regression.json), anchored to commit 76bdc64, prove that all earlier matched official paths and all 8,486 / 6,292 earlier admitted journeys remain unchanged.

Two explicitly reviewed road-pattern exceptions now admit the three Friday **105** journeys. The outbound 23-call pattern uses the 369.7 m Oberstufenzentrum–Bankstrasse path; the inbound 24-call pattern uses the 678.6 m northern loop, preserving both Bahnhof visits. [Review panels](luzern-road-context-review.svg) show the distinct paths. Each policy entry pins the agency, route, full ordered routing-pattern hash (including coordinates and platform identities), stop pair and geometry hash. A new pattern, reversed direction, different route, changed geometry, failed matcher occurrence or conflicting repeated pair cannot inherit either exception. The shared pair remains rejected for general reuse. No snap or detour limit was increased.

These two records have geometrySources = **osm-road-pattern-inference**. Audit schema version 2 declares the pair-key model. These keys include the complete routing-pattern ID, and basePairKey preserves the underlying route/from/to identity. The audit distinguishes **${friday.uniqueRouteStopPairs} unique Friday stop pairs** from **${friday.directedPairs} pair/context records**: one shared pair has two separate geometry contexts. Segment occurrence denominators and every source call remain unchanged. The three added journeys also use ordinary OSM segments, so the two road journey rows overlap and must not be summed. [Context regression digests](../data/luzern-road-context-regression.json), anchored to d1ab9f2, preserve all previously admitted paths and all 12,513 / 10,397 earlier journeys.

The remaining bus exclusions are **one Friday 101 journey through Baldegg Kantonsschule**, **two Friday 233 journeys through Heiligkreuz Witebach**, and **one Sunday EV3 journey through Entlebuch Bahnhof**. The detailed failed segments and reasons remain in the machine audit. Other modes still have the exclusions below; near-complete bus fixtures do not mean complete cantonal transport coverage.

The road cache and OSM-derived path database are supplied under **[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)** with **[© OpenStreetMap contributors](https://www.openstreetmap.org/copyright)** attribution. Official source paths retain Open-By attribution. Feed metadata identifies both licenses and the complete public manifest exposes all delivered paths, distinguished by the journey geometrySources references. A future map UI must display the source attribution. No source is presented as endorsing the inferred routing.

[Eight geometry review panels](luzern-road-review.svg) were rendered and inspected: Sörenberg hairpins, both-source Tellbus routing, the 121 m Brüelstrasse platform turn, Dattenberg, Küssnacht, Rotkreuz, EV1 and N1. This is a geometry continuity and retained-call review without a basemap, not independent street-direction certification.

### Federal rail corridors

The [federal rail adapter](../scripts/luzern-rail-geometry.mjs) fills failed cantonal rail pairs using the [FOT railway network](https://opendata.swiss/en/dataset/schienennetz). The [retained source snapshot](../data/luzern-rail-sources/source.json) contains all 3,210 operating-point nodes and 3,424 infrastructure segments. Its XTF bytes match the SHA-256 published by the federal STAC catalogue. This is a dated infrastructure source: all segments used here have **Stand 6 July 2021**; **18 January 2025 is the asset update**, and **8 September 2026 is our catalogue check**. None of these dates certifies September 2026 running-track or diversion validity.

The crosswalk lists **55 exact annual route identities** for SBB, BLS and SOB on standard gauge, and Zentralbahn on metre gauge. It tests all **${audit.federalRail.directedPatterns.length} complete directed fixture patterns**, preserving every cross-canton call, direction, repeat and pickup/drop-off rule. Stops join only through their exact operating-point numbers; nearest coordinates or station names cannot substitute an identity. Every source edge is oriented from its declared start/end nodes, keeps its infrastructure segment ID, gauge and source validity dates, and must attach within 120 m. Platform-to-operating-point connections must be within 350 m; these are explicit station connections, not inferred running tracks. Paths use the same max(1,200 m, 4.5 × direct distance) detour ceiling and 5 m source simplification. Used station attachments reach 302.5 m; used source-node attachments reach 106.1 m.

Each search blocks every other called station, preventing an adjacent-pair route from visiting a later call out of order. All full-pattern contexts must agree on the identical path and directed source-segment sequence before a pair is reusable. The audit records ${n(audit.federalRail.consensusPairs)} candidate rail pairs, ${n(audit.federalRail.matchedConsensusPairs)} with compatible geometry; successful cantonal paths retain precedence. Per-journey geometrySources marks the added paths as fot-rail-inference. Every accepted pair records original officialAssessment, exact operating points, platform attachment distances, railPatternIds and directedSourceSegments. Source segment admission and rejection are separately inventoried across the entire federal snapshot.

This adds **${friday.admittedTripsUsingFederalRail} Friday and ${sunday.admittedTripsUsingFederalRail} Sunday journeys**. Rail admission is now **1,035 / 1,059 Friday** and **972 / 1,000 Sunday**. The delivered additions include full IR15, IC21, IR26/27, IR70, VAE, RE7, S77 and S44 journeys, plus compatible short workings and specials. [Regression digests](../data/luzern-rail-regression.json) anchored to b95f418 verify that all earlier cantonal/OSM paths and all 8,940 / 6,781 previously admitted journeys are unchanged. The checker independently reconstructs all paths from the retained XTF and [complete rail pattern inputs](../data/luzern-rail-inputs.json), then replays all original calls when the full timetable cache is supplied. Newly admitted IC, VAE and EXT services also retain the appropriate intercity, interregio and special-service display categories.

The remaining rail exclusions are whole **IR75 journeys serving Konstanz (22 Friday / 26 Sunday)** and **EC journeys serving Como S. Giovanni (2 on each date)**. GTFS operating-point numbers 8014586 and 8301307 have no corresponding station nodes in the acquired federal network. They remain excluded without trimming their foreign termini. The old cantonal VAE and RE7 geometry gaps remain documented in officialAssessment where federal geometry now succeeds.

Federal attribution is **© Federal Office of Transport (FOT)** with the source's [terms requiring attribution](https://opendata.swiss/terms-of-use/#terms_by). The catalogue's generic license field is retained verbatim as “proprietary”; the linked terms, source dates, checksums and authorship of this processed result remain explicit in both audit and feed. [Six rail geometry panels](luzern-rail-review.svg) show IC21, historic-route IR26, full VAE and RE7, IR15 and metre-gauge S44. The visual check covers continuity, calls and differing corridors; it does not certify individual running tracks.

### Federal cableway axes

The [cableway adapter](../scripts/luzern-cableway-geometry.mjs) uses the [FOT cableway dataset](https://www.bav.admin.ch/de/seilbahnen-mit-bundeskonzession-id-99). The [complete retained download](../data/luzern-cableway-sources/source.json) contains **653 installations, 1,349 stations and 653 alignment records**. The ZIP matches the federal catalogue checksum, and the checker independently extracts the XML from that ZIP before re-parsing it. The source model is Seilbahnen_V2_0. **Catalogue date: 7 November 2025; asset update: 29 January 2026; archive member: Seilbahnen_20260105.xtf; used installation Stand: 1 January 2025; retrieved and checked: 8 September 2026.** These dates describe separate source facts.

Five exact GTFS route/operator identities bind to six installations: **2500 → 72.062** (Marbach–Marbachegg), **2503 → 72.078** (Sörenberg–Rossweid), **2505 → 71.114** (Sörenberg–Brienzer Rothorn), **2516 → 72.016 and 72.017** (Kriens–Krienseregg–Fräkmüntegg), and **2517 → 71.141** (Fräkmüntegg–Pilatus Kulm). Federal operator numbers 1103, 1234 and 213 are checked independently from GTFS agencies 273, 283 and 13600. Only the reviewed cabin cableways qualify; chair lifts are not silently admitted by proximity or operator name.

Every pair requires two explicit station numbers on the same installation, one continuous source alignment, source validity across both fixture dates, source-endpoint attachment within **5 m**, timetable-station attachment within **120 m**, and the existing detour ceiling. Ordered source calls orient the path independently in both directions. The shared GTFS Krienseregg, Fräkmüntegg and Pilatus Kulm identities have explicit section-station aliases in policy; each keeps the same station distance gate and records its explanation. The largest measured station attachment is **49.1 m**. Krienseregg remains an intermediate call, including the distinct pickup/drop-off patterns.

The addition admits **${friday.admittedTripsUsingFederalCableways} Friday and ${sunday.admittedTripsUsingFederalCableways} Sunday timetable movement records**, covering 11 complete directed patterns and 12 route-specific directed pairs on each date. These are explicit scheduled records in the source GTFS, including its dense minute-by-minute cableway service representation, not observed cabins or an estimate of how many cabins are physically operating. Their original trip IDs, times, sequence and call rules survive unchanged. They are distinct from Hammetschwand’s 1,020 representative headway movements per date, which remain excluded. Per-pair evidence includes installation and segment IDs, ordered source station numbers, aliases and measured attachments; per-journey geometrySources identifies fot-cableway-inference. The axes are **2D**: cable sag, elevation profiles and individual cabins are not supplied.

The JSON audit additionally inventories every federal installation, its stations, source segments and reviewed route matches. Nine installations have a source station inside the canton polygon. This source-coordinate flag is separate from GTFS passenger-call membership, especially at canton boundaries: the reviewed Fräkmüntegg–Pilatus section remains included even though both of its federal station coordinates fall outside that polygon. The in-canton source-only chair installations **73.236** and **73.201** have no reviewed fixture route binding. Weggis–Rigi Kaltbad and Kriens–Sonnenberg retain their previously admitted cantonal paths. [Regression digests](../data/luzern-cableway-regression.json), anchored to b815755, verify every earlier path and complete admitted pattern is unchanged.

[Six cableway geometry panels](luzern-cableway-review.svg) show the full axes and original calls; the last panel compares the independently matched reverse direction. Source attribution is **© Federal Office of Transport (FOT)** under the [linked attribution terms](https://opendata.swiss/terms-of-use/#terms_by), with the catalogue license field retained verbatim. The source date, identity crosswalk and limits are embedded in feed metadata.

### Other modes and unresolved source geometry

All eight lake route records (SGV and Hallwilersee) remain in the annual inventory. The cantonal boat layer is a single 2015 settlement-service line; it has no complete 2026 route crosswalk. No water geometry is admitted. The existing repository lake router uses FOEN Vector25 shoreline polygons, edition 2007, to infer paths inside water; this is a cartographic alternative, not evidence of current SGV or Hallwilersee service alignments. It is therefore not substituted for the missing route geometry in this feed.

A follow-up probe of the **complete swissTLM3D 2026-02 TLM_SCHIFFFAHRT class** retains all ${shipping.classCount} national ferry features, with their original DBF attributes and PolylineZ source members. The [shipping probe](../data/luzern-shipping-probe.json) and [source catalogue](../data/luzern-shipping-sources/source.json) record the 24 February 2026 product date, 20 August 2026 asset update and 8 September 2026 retrieval separately. This class contains passenger/car ferry crossings; it does not supply a route-bound SGV or Hallwilersee course network. Beckenried–Gersau is a separate car ferry. Only Rotsee has a source endpoint inside the Luzern polygon. Its geometry modification is **5 November 2014**, with revision year **2024**; the [ferry owner’s notice](https://www.maihof-luzern.ch/rotsee/rotseefaehrewaerter) reports service suspended since **1 April 2025**. It is recorded as a source-only exclusion, with no fabricated timetable or addition to the 203 GTFS-route denominator. The raw notice is retained. Shipping geometry attribution is **© swisstopo**, under the linked swisstopo terms. Member hashes and ZIP CRC checks establish the extracted members; the large parent archive checksum is only publisher metadata and was not independently verified.

Hammetschwand’s vertical lift remains without admitted geometry; it is not one of the reviewed cableway installations. A vertical lift also needs an elevation-aware model, rather than a fabricated horizontal line. Rigi 82/88, Weggis–Rigi Kaltbad, Gütsch and Sonnenberg do have measured and admitted complete patterns.

The VAE cantonal source is named across its full corridor but its linework is much shorter. The BLS RE7 cantonal alignment stops short of Bern: the Konolfingen–Langnau pair is about 12.8 km away at the missing endpoint. These source limitations are preserved even though compatible federal rail paths now admit the full journeys. Remaining foreign-station and bus replacement failures have their own rows and exact reasons.

Bus linework is strong but not complete. The first pass found real separated components at Inwil, Sursee, Reiden, Menziken and Küssnacht. A follow-up checks each proposed repair against exact donor edges and existing target vertices, with a 100 m maximum path length. Every donor edge must exist in the cited source feature and the target endpoints must belong to disconnected components; changed source bytes, invented chords and already-connected endpoints fail validation. The repairs remain undirected corridor inference.

| Target line | Gap / donor path | Official donor | Review result |
| --- | --- | --- | --- |
| 111, Inwil | 23.8 / 24.1 m | 110 (B110), four source edges | Applied |
| 81, Sursee | 18.6 m | 86 (B086) | Applied |
| 399, Sursee | 18.6 m | 86 (B086) | Applied |
| 609, Reiden | 17.6 m | 608 (B608) | Applied |
| 399, Menziken | 8.5 m | 398 (B398) | Applied |
| 622 / 653, Küssnacht–Immensee | 9.8 m gap; available path detours 3.775 km | No short source path | Rejected; remains disconnected |

The five repairs recover **162 Friday and 144 Sunday complete journeys** over the initial adapter, without changing the inventory, schedules, snap thresholds or full-pattern admission rule. Every affected pair records geometryRepairIds and repairSourceFeatures; the checker validates the exact donor edges against the pinned bus snapshot. The original 8,324 / 6,148 counts and subsequent 8,486 / 6,292 official-only counts are preserved in Git. Source endpoints also miss Rotkreuz Schulanlagen (73, roughly 160–193 m) and Küssnacht Plaza (508, about 211 m). Repeated Brüelstrasse calls on vbl 25 collapse in the official source. These failures remain recorded in officialAssessment where the independently inferred road fallback now succeeds. Full route-specific pair names, gaps and occurrence counts are in the JSON audit.

The rawi stop-layer cross-check considers ${audit.sourceStopReview.length} source records inside the polygon. It compares DIDOK-derived SLOID identity, including GTFS generated platform IDs. The following direct identities do not occur among in-canton GTFS stop records; this is not automatic proof of missing service. Vitznau RB is represented in the Rigi fixture with GTFS's shared Vitznau identity 8508464 instead of the source's 8505070. The other discrepancies require source follow-up.

| Source SLOID | Source name | Municipality |
| --- | --- | --- |
${unmatchedStops.join('\n')}

Every source feature that produced no admitted fixture journey is listed here. “No annual Luzern-calling route” means no exact decoded identity in the polygon-based annual route census; it does not mean the route does not exist outside the canton. All 144 source line records, including used features, are in sourceInventory in the JSON audit.

| Source feature | Description | Status | Exact annual GTFS route matches |
| --- | --- | --- | --- |
${unusedSources.join('\n')}

## Complete annual route admission inventory

Counts below are admitted/total **civil-day movements**; inactive records remain in the table. “Partially admitted” means some complete patterns pass and others are excluded, never that a partial journey is exported. The JSON audit additionally records active source-service-day trip/template counts and all individual directed pattern reasons. A route can have several reasons; reason counts are not mutually exclusive.

| GTFS route ID | Agency · line | Mode | Annual trip records | Friday admitted/total, status | Sunday admitted/total, status | Source features | Fixture exclusion reasons |
| --- | --- | --- | ---: | --- | --- | --- | --- |
${routeRows.join('\n')}

## Reproduction and validation

Use Node 24 or newer and unzip, with installed project dependencies. These commands build dated source artifacts; they do not alter existing Basel/Lausanne studies or deploy the website.

\`\`\`sh
# Use the committed source directory for the measured snapshot.
node --max-old-space-size=4096 scripts/luzern-timetable.mjs \\
  /private/tmp/GTFS_FP2026_20260902.zip \\
  data/luzern-sources/boundary.json /private/tmp/luzern-timetable.json
node scripts/build-luzern-region.mjs /private/tmp/luzern-timetable.json
node scripts/check-luzern-region.mjs /private/tmp/luzern-timetable.json
node scripts/write-luzern-audit.mjs
node scripts/render-luzern-rail-review.mjs
node scripts/render-luzern-cableway-review.mjs

# Offline source/artifact checks without the large national archive or cache.
node scripts/check-luzern-region.mjs
npx vitest run scripts/luzern-region.test.mjs \\
  scripts/luzern-road-geometry.test.mjs scripts/enrich-postbus-roads.test.mjs \\
  scripts/luzern-cableway-geometry.test.mjs \\
  scripts/luzern-rail-geometry.test.mjs scripts/enrich-swiss-rail-geometry.test.mjs \\
  scripts/basel-line-geometry.test.mjs scripts/gtfs-frequencies.test.mjs

# Optional new acquisition: review vintages, domains and crosswalk before using.
node scripts/download-luzern-sources.mjs /private/tmp/luzern-new-sources
\`\`\`

The committed road cache, federal rail/cableway archives and retained timetable identity inputs are required by the pinned policy, so ordinary reproduction needs no matcher or network access. To regenerate the cache, use the same PBF and pinned matcher inputs from the offline pipeline above:

\`\`\`sh
node scripts/luzern-road-geometry.mjs prepare \\
  /private/tmp/luzern-timetable.json /private/tmp/luzern-road-feed
# Run for each agency listed in luzern-road-feed/index.json:
node scripts/match-postbus-roads.mjs \\
  --pfaedle /private/tmp/gleislicht-pfaedle/build/pfaedle \\
  --osm /private/tmp/gleislicht-postbus-roads.osm.pbf \\
  --config /private/tmp/gleislicht-pfaedle/pfaedle.cfg \\
  --feed /private/tmp/luzern-road-feed/801 \\
  --output /private/tmp/luzern-road-matched/801
node scripts/luzern-road-geometry.mjs import \\
  /private/tmp/luzern-road-feed /private/tmp/luzern-road-matched \\
  /private/tmp/luzern-road-cache.json /private/tmp/luzern-road-evidence
\`\`\`

Review regenerated cache/evidence hashes before updating policy. Matcher elapsed times and warning-log timings can change between runs; the committed evidence preserves the measured run. No changed cache can silently replace the pinned input. All **71 scoped unit tests pass**, including consensus failure/conflict isolation, explicit full-pattern exception isolation and pinned geometry, repeated-pair loops, reversed directions, changed identities, corrupt indices/endpoints, source hashes, detour/collapse limits and routing-only carry-in normalization. Rail tests additionally cover exact/ambiguous operating-point identities, reversed source geometry, called-station order, conflicting complete patterns, gauge/validity exclusion, station/topology attachment limits and detour rejection. Cableway tests cover source vertices, reversal, exact station/installation/operator identity, explicit aliases, station limits, source validity, disconnected geometry and malformed coordinates.

The checker also replays the complete shipping-class census and its source-only suspension exclusion. Regenerate it with \`node scripts/audit-luzern-shipping.mjs\`, or verify the committed result with \`node scripts/audit-luzern-shipping.mjs --check\`.

The checker independently verifies every stored source hash; exact ArcGIS object-ID sets; inventory totals; every chunk byte length/hash; duplicate journey consistency across chunks; morning membership; complete directed path endpoints; per-pattern, pair, route and agency totals; and admission/exclusion reconciliation. With the regenerated timetable cache it also replays **every admitted journey against all original GTFS calls, times, sequences, source-service-day identity and frequency metadata**. Unit tests cover exact donor-edge repairs and rejection of invented edges/changed snapshots/already-connected targets, truncated/duplicate pages, wrong CRS, changed operator domains/year, disconnected geometry, crossing-without-junction, reversal, loops, polygon holes, midnight carry-in, frequency semantics and rejection of malformed admitted paths.

The large source-line paths make the initial compressed manifests about ${(friday.artifacts.manifestGzipBytes / 1048576).toFixed(2)} / ${(sunday.artifacts.manifestGzipBytes / 1048576).toFixed(2)} MiB; compressed morning files are ${(friday.artifacts.morningGzipBytes / 1048576).toFixed(2)} / ${(sunday.artifacts.morningGzipBytes / 1048576).toFixed(2)} MiB. The largest compressed two-hour chunks are ${(Math.max(...friday.artifacts.chunks.map(c => c.gzipBytes)) / 1024).toFixed(1)} / ${(Math.max(...sunday.artifacts.chunks.map(c => c.gzipBytes)) / 1024).toFixed(1)} KiB. These are measured data artifacts, not a claim that existing UI payload budgets or route-direction review gates have passed.
`
await writeFile('docs/LUZERN-STUDY.md', report)
console.log('Wrote docs/LUZERN-STUDY.md')
