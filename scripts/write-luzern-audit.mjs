import { readFile, writeFile } from 'node:fs/promises'

const audit = JSON.parse(await readFile('data/luzern-study-audit.json', 'utf8'))
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
  ['Preceding-service-day carry-in / admitted', d => `${n(d.carryInTrips)} / ${n(d.admittedCarryInTrips)}`],
  ['Routes with at least one admitted pattern', d => d.routes.filter(r => r.admittedTrips).length],
  ['Directed stop patterns / admitted', d => `${n(d.patterns)} / ${n(d.admittedPatterns)}`],
  ['Route-specific directed stop pairs / matched', d => `${n(d.directedPairs)} / ${n(d.matchedDirectedPairs)}`],
  ['Unique directed-pair geometry coverage', d => pct(d.matchedDirectedPairs, d.directedPairs)],
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
const routeRows = audit.inventory.map(r => row([`\`${r.routeId}\``, `${r.agencyId} · ${r.line}`, r.mode, r.annualTripRecords, ...r.days.map(status), r.sourceFeatures.join(', ') || '—', [...new Set(r.days.flatMap(d => d.reasons))].join(', ') || '—']))
const unusedSources = audit.sourceInventory.filter(s => s.status !== 'used-for-admitted-patterns').map(s => row([s.key, s.properties.LINIENBEZ, s.status, s.gtfsRoutes.join(', ') || '—']))
const unmatchedStops = audit.sourceStopReview.filter(s => !s.gtfsStopPresent).map(s => row([s.id, s.name, s.municipality]))
const report = `# Luzern cantonal transit source adapter and audit

Built on 8 September 2026, starting from [the national source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#lu). **The entire pinned national timetable was scanned for Luzern membership: ${audit.annualRouteRecords} route records, ${audit.annualAgencies} feed agencies and ${n(audit.scope.annualScopedTripRecords)} annual trip records.** The delivered regional feeds contain **${n(friday.admittedTrips)} Friday and ${n(sunday.admittedTrips)} Sunday journeys**, on ${friday.routes.filter(r => r.admittedTrips).length} and ${sunday.routes.filter(r => r.admittedTrips).length} routes respectively. ${audit.inventory.filter(r => r.days.some(d => d.admittedTrips)).length} distinct route records have an admitted pattern on at least one date.

Only complete directed stop patterns with usable geometry are admitted. This is a complete **inventory of the scoped archive**, and a measured **partial regional motion feed**. It is not complete cantonal geometry, year-round validation or direction-certified street routing. The underlying official linework is undirected; the validation below establishes ordered source-call compatibility and plausible connected corridors.

## Deliverables

- [Friday 4 September full-day manifest](../public/data/luzern-region/2026-09-04/luzern-region-day-manifest.json) and [morning snapshot](../public/data/luzern-region/2026-09-04/luzern-region-morning.json).
- [Sunday 6 September full-day manifest](../public/data/luzern-region/2026-09-06/luzern-region-day-manifest.json) and [morning snapshot](../public/data/luzern-region/2026-09-06/luzern-region-morning.json).
- [Machine-readable audit](../data/luzern-study-audit.json): every annual route, every source line, every fixture directed pattern and route-specific directed pair, with occurrences, admission, failures and source references.
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

The cantonal source snapshot was acquired on 8 September 2026. Retrieval timestamps do not replace the layer dates. Line sources are EPSG:2056; the ArcGIS query transforms them to EPSG:4326. Matching uses those returned coordinates, metre-distance calculations, exact shared vertices keyed to seven decimal places, and output coordinates rounded to seven decimals. No line simplification, automatic gap bridging, OSM fallback or nationwide rail fallback was applied. The boundary is the returned API polygon, with its supplied precision; an exact cadastral boundary survey is not implied.

**Attribution:** Timetable: **SBB / opentransportdata.swiss**. Cantonal data: **© rawi Kanton Luzern; © Verkehrsverbund Luzern**. Canton boundary: **© swisstopo**. Processed regional feeds and this audit are by **Gleislicht**. Cantonal [product metadata](https://daten.geo.lu.ch/produkt/oevxxxxx_col_v5) and [Open-By terms](https://geoportal.lu.ch/Nutzungsbedingungen) permit use with source attribution; the acquired pages are retained. The [national timetable terms](https://opentransportdata.swiss/en/terms-of-use/) require attribution, raw-data refresh and authorship of processed results. The [swisstopo terms](https://www.swisstopo.admin.ch/en/terms-and-conditions) govern the boundary. No blanket CC0 licence is assigned to the combined feed. Frozen fixtures are dated study artifacts, not a continuously refreshed live service.

The large national archive remains an external input, available at the [pinned download](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip); its hash is mandatory. Current cantonal APIs are not immutable, so reproduction should use the committed source snapshots, not a fresh download claimed to have the same bytes.

## Adapter and admission rules

Local TU enumeration values are decoded using each layer's saved domain. For example, **TU 11 means vbl and maps to GTFS agency 820**; it must not be confused with SBB's GTFS agency 11. The crosswalk keeps separate rail/bus identities for AVA and ASM. It strips only the documented bus prefix “Linie”, and joins exact operator, mode and displayed line. BLS S6's two source branches share the exact identity and graph. It does not borrow another operator's alignment because the line number matches.

Explicit reviewed aliases cover Tellbus 493, Zentralbahn IRLEX/LIX/IRLIX, SOB VAE, SBB N7 (source NEX), Vitznau cogwheel 82/88, Weggis cableway 2562, Sonnenberg 2515 and Gütsch 2510. The latter demonstrates source ownership versus timetable publishing: the source names Château Gütsch, while GTFS publishes it under vbl. TU=0 is not an operator; Sonnenberg is mapped by its explicit route and Kursbuch identity. Unresolved aliases remain excluded.

For each route and ordered platform pair the adapter projects stops onto that line's graph. It requires a connected path, endpoint gaps ≤120 m, path length ≤max(1,200 m, 4.5 × direct distance), and a noncollapsed path (≥1 m and, for stop separation over 30 m, at least half that separation). Nearby alternative line parts may be tried only within 5 m of the closest projection and within the same endpoint limit. Projected platform connectors are explicit in the output. Lines connect at shared source vertices; geometric crossings do not create junctions.

A **directed pattern** includes route ID, direction_id, the entire ordered stop-ID sequence, repeated stops and pickup/drop-off rules. Every adjacent pair is measured. A single failed pair excludes the entire pattern, with no omitted call, substituted chord, inferred bridge or spliced shortened journey. Pair keys include route identity and direction through from/to ordering; reverse service is independently checked. Repeated-stop loops are retained in pattern identity and collapsed projections are rejected. Successful segments on an excluded pattern count as measured geometry in the unfiltered denominator but are not exported as an admitted journey.

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

All eight lake route records (SGV and Hallwilersee) remain in the annual inventory. The cantonal boat layer is a single 2015 settlement-service line; it has no complete 2026 route crosswalk. No water geometry is admitted. Pilatus/Kriens-Fräkmüntegg, Sörenberg, Marbachegg and Hammetschwand lack admitted source geometry. Rigi 82/88, Weggis–Rigi Kaltbad, Gütsch and Sonnenberg do have measured and admitted complete patterns.

Long-distance SBB/SOB services without an exact source line are excluded. The VAE line is named across its full corridor but the acquired geometry is much shorter; no full VAE fixture journey passes. The BLS RE7 alignment stops short of Bern: the Konolfingen–Langnau pair is about 12.8 km away at the missing endpoint. It is excluded without trimming the journey. Other partial rail patterns, special services and replacement buses have their own rows and reasons.

Bus linework is strong but not complete. Confirmed graph discontinuities include approximately **23.8 m at Inwil (111), 9.8 m near Küssnacht/Immensee (622 and shared 653 corridor), 18.6 m near Sursee (81), and 17.6 m at Reiden (609)**. These are real separated components in the acquired coordinates, not merely platform snap offsets. They remain unbridged. Source endpoints also miss Rotkreuz Schulanlagen (73, roughly 160–193 m) and Küssnacht Plaza (508, about 211 m). Repeated Brüelstrasse calls on vbl 25 can collapse to the same graph point and are rejected. Full route-specific pair names, gaps and occurrence counts are in the JSON audit.

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

# Offline source/artifact checks without the large national archive or cache.
node scripts/check-luzern-region.mjs
npx vitest run scripts/luzern-region.test.mjs \\
  scripts/basel-line-geometry.test.mjs scripts/gtfs-frequencies.test.mjs

# Optional new acquisition: review vintages, domains and crosswalk before using.
node scripts/download-luzern-sources.mjs /private/tmp/luzern-new-sources
\`\`\`

The checker independently verifies every stored source hash; exact ArcGIS object-ID sets; inventory totals; every chunk byte length/hash; duplicate journey consistency across chunks; morning membership; complete directed path endpoints; per-pattern, pair, route and agency totals; and admission/exclusion reconciliation. With the regenerated timetable cache it also replays **every admitted journey against all original GTFS calls, times, sequences, source-service-day identity and frequency metadata**. Unit tests cover truncated/duplicate pages, wrong CRS, changed operator domains/year, disconnected geometry, crossing-without-junction, reversal, loops, polygon holes, midnight carry-in, frequency semantics and rejection of malformed admitted paths.

The large source-line paths make the initial compressed manifests about ${(friday.artifacts.manifestGzipBytes / 1048576).toFixed(2)} / ${(sunday.artifacts.manifestGzipBytes / 1048576).toFixed(2)} MiB; compressed morning files are ${(friday.artifacts.morningGzipBytes / 1048576).toFixed(2)} / ${(sunday.artifacts.morningGzipBytes / 1048576).toFixed(2)} MiB. The largest compressed two-hour chunks are ${(Math.max(...friday.artifacts.chunks.map(c => c.gzipBytes)) / 1024).toFixed(1)} / ${(Math.max(...sunday.artifacts.chunks.map(c => c.gzipBytes)) / 1024).toFixed(1)} KiB. These are measured data artifacts, not a claim that existing UI payload budgets or route-direction review gates have passed.
`
await writeFile('docs/LUZERN-STUDY.md', report)
console.log('Wrote docs/LUZERN-STUDY.md')
