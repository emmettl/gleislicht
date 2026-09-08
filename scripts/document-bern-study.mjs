import { readFile, writeFile } from 'node:fs/promises'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const summary = await json('data/bern-audit/summary.json'), routes = await json('data/bern-audit/routes.json')
const sourceLines = await json('data/bern-audit/source-lines.json')
const days = await Promise.all(summary.days.map(d => json(`data/bern-audit/${d.serviceDate}.json`)))
const n = value => value.toLocaleString('en-GB')
const pct = (a, b) => `${(100 * a / b).toFixed(2)}%`
const safe = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
const table = (headers, rows) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.map(safe).join(' | ')} |`).join('\n')}`
const dayRow = (label, fn) => [label, ...days.map(fn)]
const modeRows = []
for (const mode of ['bus', 'tram', 'rail', 'ferry', 'funicular', 'cableway']) {
  const values = days.map(d => {
    const groups = d.groups.filter(g => g.id.endsWith(`:${mode}`))
    const sum = key => groups.reduce((total, g) => total + g[key], 0)
    return `${n(sum('admittedTrips'))} / ${n(sum('trips'))}; ${pct(sum('matchedSegmentOccurrences'), sum('segmentOccurrences'))}`
  })
  modeRows.push([mode, ...values])
}
const operatorRows = []
for (const agencyId of [...new Set(routes.map(r => r.agencyId))].sort((a, b) => Number(a) - Number(b))) {
  const operatorRoutes = routes.filter(r => r.agencyId === agencyId)
  operatorRows.push([agencyId, operatorRoutes[0].agency, operatorRoutes.length,
    ...days.map((_, i) => `${n(operatorRoutes.reduce((v, r) => v + r.days[i].admittedTrips, 0))} / ${n(operatorRoutes.reduce((v, r) => v + r.days[i].trips, 0))}`)])
}
const reasonRows = [...new Set(days.flatMap(d => d.directedPairs.filter(p => !p.matched).map(p => p.reason)))].sort().map(reason => [reason,
  ...days.map(d => { const pairs = d.directedPairs.filter(p => !p.matched && p.reason === reason); return `${n(pairs.length)} / ${n(pairs.reduce((v, p) => v + p.occurrences, 0))}` })])

const doc = `# Bern canton: source adapter, regional feed and admission audit

Study by **Gleislicht**, using the pinned national timetable and the canton’s OEVTP source. Validation dates: **Friday 4 September and Sunday 6 September 2026**, each a Europe/Zurich civil day including the preceding service day’s after-midnight journeys. This is a reproducible historical regional feed, not a live service or a claim of year-round completeness.

The full-source census identifies **${n(summary.routeCount)} GTFS route records from ${n(summary.agencyCount)} agency identities**, covering **all ten districts** of Bern. All **518 OEVTP line records and 5,321 OEVTP stop records** are retained in the source snapshot. The regional feed admits complete directed stop patterns only: **${n(days[0].coverage.admittedTrips)} Friday and ${n(days[1].coverage.admittedTrips)} Sunday journey instances**. Failed patterns remain in the audit; no unsourced straight-line segments are emitted as admitted journeys.

## Deliverables

- [Feed index](../public/data/bern-region/index.json), [Friday manifest](../public/data/bern-region/2026-09-04/bern-region-day-manifest.json), [Sunday manifest](../public/data/bern-region/2026-09-06/bern-region-day-manifest.json). Each date has twelve two-hour chunks and a 06:45–08:45 morning extract. These use the existing network snapshot/chunk schema. Application study-picker integration is outside this data deliverable.
- [Complete route and operator inventory](BERN-ROUTE-INVENTORY.md): every route, its exact GTFS identity, source line codes, status and weekday/Sunday admitted versus candidate counts. [Machine-readable routes](../data/bern-audit/routes.json) include per-date exclusions, directed pairs, patterns and geometry counts.
- [Audit summary](../data/bern-audit/summary.json), [Friday pattern/pair evidence](../data/bern-audit/2026-09-04.json), [Sunday pattern/pair evidence](../data/bern-audit/2026-09-06.json), [all source-line records](../data/bern-audit/source-lines.json), [cantonal GTFS stop records](../data/bern-audit/stops.json).
- [Explicit operator and exceptional line crosswalk](../data/bern-operator-crosswalk.json), [source adapter](../scripts/bern-line-geometry.mjs), [canton timetable census](../scripts/bern-timetable.mjs), [builder](../scripts/build-bern-region.mjs), [independent artifact checker](../scripts/check-bern-region.mjs).
- [Preserved original OEVTP archive](../data/bern-sources/oevtp.gpkg.zip), [source manifest](../data/bern-sources/sources.json), [lossless boundary-row snapshot](../data/bern-sources/boundary-rows.json.gz). The decoded source includes every line and stop, not a BERNMOBIL sample.

## Geographic denominator

The importer scans all **${n(summary.census.allYearTrips)} trip records and ${n(summary.census.stopTimeRows)} stop-time rows**, without an agency whitelist. A trip belongs to the canton census when at least one **original GTFS call coordinate** lies inside the unsimplified Bern polygon from swissBOUNDARIES3D 2026-01. Parent stations alone do not select journeys. All-year route membership includes records inactive on the two validation dates; it does not assert daily operation.

For each selected dated journey, **every original call is retained**, including out-of-canton endpoints, intermediate calls and repeated platform visits. Neither a rectangle nor Libero zones define membership. Through-journeys without any stop in Bern are outside this explicitly stop-based scope. Services absent from both the GTFS and OEVTP sources, and separate GTFS-Flex service areas, are not proven covered by this inventory.

${table(['District', 'All-year route records touching district', 'Called GTFS stop records inside district'], summary.districts.map(d => [d.district, n(d.routeIds.length), n(d.calledPlatforms)]))}

District route counts overlap. They cover Bern-Mittelland; Biel/Seeland; Oberaargau; Emmental; Thun; all three Oberland districts; and **Jura bernois**, which a Bern-city or Libero-only scope would miss. The 2026 polygon excludes **Moutier**; a regression test fixes that boundary behaviour. Three source stop records within ten metres of the border, including two records for Brienzer Rothorn cable station on the outside, are listed in the audit’s \`census.nearBoundary\`. Approximate coordinate transformation uncertainty is not resolved by silently enlarging the polygon.

Admitted journeys retain ${n(days[0].admittedOutsideCantonPlatforms)} Friday and ${n(days[1].admittedOutsideCantonPlatforms)} Sunday out-of-canton stop records. Full cross-canton journeys fail admission if the official source does not cover their complete chain. Rail and bus replacement services remain separate GTFS identities.

## Directed-pattern and geometry results

${table(['Measure', 'Friday', 'Sunday'], [
  dayRow('Candidate journey instances', d => n(d.coverage.trips)),
  dayRow('Scheduled journey instances', d => n(d.coverage.scheduledTrips)),
  dayRow('Representative headway instances (exact_times=0)', d => n(d.coverage.representativeHeadwayTrips)),
  dayRow('Admitted scheduled instances', d => n(d.coverage.admittedScheduledTrips)),
  dayRow('Admitted representative headway instances', d => n(d.coverage.admittedRepresentativeHeadwayTrips)),
  dayRow('Admitted total instances', d => n(d.coverage.admittedTrips)),
  dayRow('Directed stop patterns: complete / candidate', d => n(d.coverage.completePatterns) + ' / ' + n(d.coverage.patterns)),
  dayRow('Route-specific directed stop pairs: matched / candidate', d => n(d.coverage.matchedDirectedPairs) + ' / ' + n(d.coverage.directedPairs)),
  dayRow('All modeled segment occurrences: matched / candidate', d => n(d.coverage.matchedSegmentOccurrences) + ' / ' + n(d.coverage.segmentOccurrences)),
  dayRow('All modeled segment occurrence coverage', d => pct(d.coverage.matchedSegmentOccurrences, d.coverage.segmentOccurrences)),
  dayRow('Scheduled-only segment occurrence coverage', d => pct(d.coverage.matchedScheduledSegmentOccurrences, d.coverage.scheduledSegmentOccurrences)),
  dayRow('Carry-in journeys: admitted / candidate', d => n(d.admittedCarryInTrips) + ' / ' + n(d.carryInTrips)),
  dayRow('Night-route journeys: admitted / candidate', d => n(d.directedPatternChecks.admittedNightRouteTrips) + ' / ' + n(d.directedPatternChecks.nightRouteTrips)),
  dayRow('Patterns revisiting a platform: admitted / candidate', d => n(d.directedPatternChecks.admittedPatternsRevisitingPlatforms) + ' / ' + n(d.directedPatternChecks.patternsRevisitingPlatforms)),
])}

Coverage percentages use **all candidates**, not only the admitted feed. Every admitted journey has 100% matched segments by construction; that must not be advertised as 100% cantonal service coverage. Headway grids are deterministic representative motion, not exact scheduled departures or GPS. Their counts can be large on continuously operating lifts; scheduled-only counts and coverage are therefore reported separately. Calendar exceptions, Saturday-night carry-in, interval end exclusivity and the source frequency anchor are preserved. A journey with conditional pickup/drop-off is excluded from fixed-motion admission, rather than asserting an on-demand departure; booking conditions absent from GTFS remain an upstream limitation.

There are **${n(summary.weekdaySundayPatterns.shared)} shared**, **${n(summary.weekdaySundayPatterns.weekdayOnly)} Friday-only** and **${n(summary.weekdaySundayPatterns.sundayOnly)} Sunday-only** patterns. Pattern identity is the GTFS route, direction_id and full ordered platform sequence; reversed trips and repeated loop calls cannot collapse into a set. Each report contains a stop-by-stop match mask. Route-specific directed pairs retain source stop IDs, endpoint snap distances, failure reasons and occurrence counts.

${table(['Mode', 'Friday admitted / candidate; segment coverage', 'Sunday admitted / candidate; segment coverage'], modeRows)}

### Adapter and admission policy

OEVTP’s \`tucode\` is an operator abbreviation, not a GTFS agency ID. Mapping checks the pinned agency name as well as its ID, compatible mode, and complete passenger line number. Moonliner uses the full \`tuname\` because it spans multiple operators. Rack railways have explicit R-prefix handling. Cable and boat records with blank display numbers use their timetable field; exceptional identifiers are enumerated in the crosswalk. The Grindelwald bus source maps to STI identities 859/605, BOB/WAB replacement records have explicit line overrides, and BLS boat cruise IDs are tested against their lake-specific source lines. Rail shapes are never reused for a bus merely because its number resembles a rail line.

${sourceLines.filter(s => s.routeIds.length).length} of 518 source line records have a reviewed crosswalk candidate among the canton-serving GTFS routes. The remaining ${sourceLines.filter(s => !s.routeIds.length).length} remain individually listed, including unresolved operators, source lines beyond the canton, missing timetable entries and changed identifiers. A crosswalk candidate is not geometry admission.

The decoder checks GeoPackage/WKB headers, EPSG:2056, geometry types, byte exhaustion and coordinate ranges; it preserves disconnected parts and polygon holes. Derived geometry uses original XY vertices without simplification, the swisstopo approximate CH1903+/WGS84 formula and seven-decimal output. Exact shared vertices alone create graph connections; line crossings do not automatically join and disconnected pieces are not bridged. Projected endpoint paths use these limits:

${table(['Mode', 'Maximum platform snap', 'Maximum path length'], [
  ['Bus, tram, cableway, funicular', '80 m', 'max(1,200 m, 4.5 × straight distance)'],
  ['Rail', '120 m', 'max(3,000 m, 4.5 × straight distance)'],
  ['Ferry', '150 m', 'max(1,200 m, 4.5 × straight distance)'],
])}

Alternative source-part projections may be at most 5 m farther from each endpoint than its nearest projection, and must still satisfy the snap limit. Collapsed paths fail. Every segment is oriented from its actual preceding call to its next call; the final artifact checker verifies endpoint orientation after all stop/path reindexing. A pattern is admitted only if **every segment** passes. Boats use official water-line geometry and mountain transport its own mode-compatible line. No road-routing, generic rail-infrastructure or straight-line fallback is inserted.

**Physical limits:** these are undirected official centrelines with directions inferred from GTFS calls. They do not certify one-way road legality, a particular running track, tunnel level, boat navigation safety or current diversions. They are suitable as dated schematic movement candidates, not operational navigation. No authenticated realtime feed or temporary-diversion layer was exercised. Two September days do not establish winter pass, holiday or year-round service coverage.

## Exclusions and review evidence

Across both dates: **${summary.routesByStatus['admitted-all-dated-trips']} routes admit all dated journeys**, **${summary.routesByStatus['partially-admitted']} admit some**, **${summary.routesByStatus.excluded} admit none**, and **${summary.routesByStatus['inactive-on-validation-dates']} are inactive on both dates**. The complete route appendix distinguishes these states; inactive annual records are not silently erased or described as failed geometry.

${table(['Unmatched geometry reason', 'Friday directed pairs / occurrences', 'Sunday directed pairs / occurrences'], reasonRows)}

Concrete cases preserved for follow-up:

- **BERNMOBIL 7A/8A buses:** no reviewed mode-compatible line crosswalk. The source tram 7/8 paths are not treated as bus geometry. Some tram 6 patterns also fail endpoint matching.
- **RBS S8:** the OEVTP S8 record is Bern–Jegenstorf, while some complete GTFS journeys continue toward Bätterkinden. Those longer patterns fail rather than being cut to an apparently complete short line.
- **Eiger Express 2444:** its two directed endpoint pairs have a maximum snap of **215.3 m**, exceeding the cable limit. **Grindelwald–Männlichen GGM** has **93.4 m** terminal mismatch. Matching the installation’s identity does not authorize moving its source stops or raising the threshold.
- **Schilthorn variants 24602/24603/24604:** changed installation identifiers lack reviewed source-line assignments. The matched 2460 patterns do not imply all variants are covered.
- **Matte lift 2352 and Wiriehorn 2365:** no matching acquired OEVTP line. **SBB/BLS/SOB and MOB long-distance or changed labels**, replacement buses, and complete journeys beyond the source extent remain explicitly excluded or partial. No whole operator is claimed complete from its admitted subset.
- **Biel/Seeland, Oberaargau, Emmental and regional bus terminal/platform gaps:** many routes have high segment coverage yet fail whole-pattern admission. The route and directed-pair files identify each failure; high occurrence coverage does not excuse a missing terminal movement.

## Source dates, attribution and reuse

${table(['Source', 'Data vintage / release', 'Preserved evidence and attribution'], [
  ['National GTFS', 'Feed 20260902; valid 2025-12-14 to 2026-12-12', 'opentransportdata.swiss; original platform IDs, calendar and frequency semantics'],
  ['Bern OEVTP lines and stops', 'Updated 2026-01-01; package published 2026-07-09; acquired 2026-09-08', 'Original ZIP, decoded records, metadata PDFs and terms in data/bern-sources'],
  ['swissBOUNDARIES3D', '2026-01 edition', '© swisstopo; complete Bern and ten district rows preserved with original geometry blobs'],
])}

**Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern.** The [official metadata](https://www.agi.dij.be.ch/de/start/geoportal/geodaten/detail.html?code=OEVTP&type=geoproduct) and packaged [line metadata PDF](../data/bern-sources/metadata_oevtp_linie_de.pdf) identify the data vintage. Free private/commercial use and reproduction require attribution; online applications must link the metadata and recipients must receive the terms. [German terms](../public/data/bern-region/terms_of_use_de.pdf) and [French terms](../public/data/bern-region/terms_of_use_fr.pdf), dated **20 January 2026**, accompany the feed. No generic CC licence is assigned to these cantonal data. The original acquired archive is kept because the download URL is mutable.

Timetable data: **opentransportdata.swiss**; processed feed and analysis: **Gleislicht**. The [platform terms](https://opentransportdata.swiss/en/terms-of-use/) require attribution, refresh of raw data and the data user’s authorship for processed results. This delivery is explicitly an archival two-date study; it must be rebuilt and re-audited before being presented as current service. Administrative boundaries: **© swisstopo**, under the [official OGD terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices). No OpenStreetMap geometry is used in this adapter.

SHA-256 identities:

- National GTFS ZIP: \`${summary.sourceHashes.archive}\`.
- Original OEVTP ZIP: \`${summary.sourceHashes.geometryArchive}\`.
- Original boundary GeoPackage: \`${summary.sources.boundary.sourceSha256}\`.
- Extracted boundary-row snapshot: \`${summary.sources.boundary.snapshotSha256}\`.
- Decoded source: \`${summary.sourceHashes.source}\`.
- Operator/line crosswalk: \`${summary.sourceHashes.crosswalk}\`.

## Reproduction and checks

Python 3 uses only the standard library; Node uses the repository’s pinned \`@motionstudies/data\` package. Run from the repository root. No authenticated service is needed.

\`\`\`sh
# Decode the preserved source ZIP and boundary rows; no network required.
npm run data:bern:sources

# Obtain the exact timetable fixture if not already present.
curl --fail --location \\
  https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip \\
  --output /private/tmp/GTFS_FP2026_20260902.zip

# Complete all-year geographic census, two civil days, geometry, feeds and audit.
npm run data:bern -- --archive /private/tmp/GTFS_FP2026_20260902.zip

# Independent offline checks of emitted bytes and all audit denominators.
npm run data:bern:check
npm run data:bern:docs
npx vitest run scripts/bern-region.test.mjs scripts/basel-line-geometry.test.mjs \\
  scripts/civil-day.test.mjs scripts/gtfs-frequencies.test.mjs
python3 scripts/test_bern_sources.py
\`\`\`

The full build creates \`data/bern-audit/timetable-cache.json.gz\` as an ignored local acceleration cache; subsequent geometry-only builds may pass \`--timetable-cache\` with that path. Cache source hashes must agree with the pinned GTFS and decoded boundary/line source. To reconstruct the original boundary snapshot, pass the original 2026-01 GeoPackage with \`python3 scripts/prepare-bern-sources.py --boundary PATH\`.

Validation covers all emitted stop/path references, finite and ordered call times, retained source call counts, original directed platform sequences, complete-path admission, shared-edge orientation, previous-day identity, representative frequencies, twelve contiguous chunks per date, chunk checksums/byte counts, identical repeated journeys across chunks, source/crosswalk hashes, all route/operator/district denominators, and independent reconstruction of pair occurrences from every pattern. Unit tests cover polygon holes and detached parts, Moutier’s transfer, separate operators and modes, number collisions, blank ferry labels, disconnected geometry, reversed/loop patterns, conditional-service rejection and after-midnight frequency instances.
`

await writeFile('docs/BERN-STUDY.md', doc)
const routeRows = [...routes].sort((a, b) => Number(a.agencyId) - Number(b.agencyId) || a.name.localeCompare(b.name, 'en', { numeric: true }) || a.id.localeCompare(b.id)).map(r => [
  r.id, `${r.agencyId}: ${r.name || '(blank)'}`, r.mode, r.status,
  ...r.days.map(d => `${n(d.admittedTrips)} / ${n(d.trips)}`), r.sourceLines.join(', ') || '—',
  [...new Set(r.days.flatMap(d => Object.keys(d.excludedTrips)))].join(', ') || (r.status === 'inactive-on-validation-dates' ? 'Not active on these dates' : '—'),
])
await writeFile('docs/BERN-ROUTE-INVENTORY.md', `# Bern: complete route and operator inventory\n\nGenerated from the [Bern audit](BERN-STUDY.md). Counts are admitted / candidate journey instances, including representative headway instances; they are not all exact scheduled departures. All ${routes.length} annual canton-serving route records and ${operatorRows.length} source agency identities are shown. A zero on both dates means inactive in the two validation fixtures, not absent from the annual inventory. A partial route retains only complete source stop patterns.\n\n## Operators\n\n${table(['GTFS agency', 'Source name', 'Annual route records', 'Friday admitted / candidate', 'Sunday admitted / candidate'], operatorRows)}\n\n## Routes\n\n${table(['GTFS route ID', 'Agency: line', 'Mode', 'Admission status', 'Friday', 'Sunday', 'OEVTP line codes', 'Exclusion reasons'], routeRows)}\n`)
console.log('Wrote docs/BERN-STUDY.md and docs/BERN-ROUTE-INVENTORY.md')
