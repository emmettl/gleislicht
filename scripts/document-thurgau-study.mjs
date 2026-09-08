import { gunzipSync } from 'node:zlib'
import { readFile, writeFile } from 'node:fs/promises'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const summary = await json('data/thurgau-audit/summary.json')
const regionalRoads = JSON.parse(gunzipSync(await readFile('data/thurgau-regional-roads/cache.json.gz')))
const railSource = await json('data/thurgau-rail-sources/source.json')
const sbbSource = await json('data/thurgau-sbb-rail-sources/sources.json')
const sbbPolicy = await json('data/thurgau-sbb-rail-policy.json')
const waterReview = await json('data/thurgau-water-review/review.json')
const boatReview = await json('data/thurgau-boat-sources/path-review.json')
const ferryReview = await json('data/thurgau-ferry-sources/path-review.json')
const shippingReview = await json('data/thurgau-shipping-sources/path-review.json')
const shippingPolicy = await json('data/thurgau-shipping-policy.json')
const railPolicy = await json('data/thurgau-rail-policy.json')
const routes = await json('data/thurgau-audit/routes.json')
const sourceLines = await json('data/thurgau-audit/source-lines.json')
const reports = await Promise.all(summary.days.map(d => json(`data/thurgau-audit/${d.serviceDate}.json`)))
const sum = (rows, fn) => rows.reduce((n, row) => n + fn(row), 0)
const percent = (a, b) => `${(100 * a / b).toFixed(1)}%`
const table = (head, rows) => `| ${head.join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}`
const clean = s => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
const totals = summary.days.map(d => d.coverage)
const labels = { 'admitted-all-dated-trips': 'All dated journeys admitted', 'partially-admitted': 'Some complete patterns admitted',
  excluded: 'Excluded', 'inactive-on-validation-dates': 'Inactive on both dates' }
const agencies = [...new Map(routes.map(r => [r.agencyId, r.agency])).entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
const byStatus = status => routes.filter(r => r.status === status).length
const gapReasons = ['missing-line', 'endpoint-gap', 'disconnected-line', 'collapsed-path', 'implausible-detour']
const cross = summary.weekdaySundayPatterns
const admitted = routes.filter(r => r.days.some(d => d.admittedTrips)).sort((a, b) => a.agencyId.localeCompare(b.agencyId, undefined, { numeric: true }) || a.name.localeCompare(b.name, undefined, { numeric: true }))

const usedRailIds = new Set(reports.flatMap(r => r.patterns.filter(p => ['fot-rail-inference', 'fot-sbb-rail-inference', 'fot-osm-border-rail-inference'].includes(p.geometrySource)).flatMap(p => p.railSupplement.segments.flatMap(s => s.directedSourceSegments.filter(e => !e.id.startsWith('sbb:') && !e.id.startsWith('osm-way:')).map(s => s.id)))))

const sbbPatterns = new Set(reports.flatMap(r => r.patterns.filter(p => p.geometrySource === 'fot-sbb-rail-inference').map(p => p.id)))
const doc = `# Thurgau canton transit study

Audit date: **8 September 2026**. Starting point: [Swiss transit source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#tg).

The complete canton-scoped GTFS inventory contains **${summary.routeCount} route records across ${summary.agencyCount} agency identities**, with calls in all **five districts**. The regional feed admits **${totals[0].admittedTrips} Friday journeys and ${totals[1].admittedTrips} Sunday journeys**, each retaining every original call and a validated path for every directed segment. **This is partial geometry coverage, not a complete canton service feed.** ${byStatus('admitted-all-dated-trips')} route records have all dated journeys admitted, ${byStatus('partially-admitted')} have partial admission, ${byStatus('excluded')} are excluded, and ${byStatus('inactive-on-validation-dates')} are inactive on both validation dates.

## Deliverables

- [Regional feed index](../public/data/thurgau-region/index.json): Friday **2026-09-04** and Sunday **2026-09-06**, each with a full civil-day manifest, twelve two-hour chunks and a 06:45–08:45 extract.
- [Complete route inventory](THURGAU-ROUTE-INVENTORY.md): every selected annual route, operator, source join, dated admission and exclusion reason.
- [Audit summary](../data/thurgau-audit/summary.json), [route records](../data/thurgau-audit/routes.json), [Friday patterns/pairs](../data/thurgau-audit/2026-09-04.json), [Sunday patterns/pairs](../data/thurgau-audit/2026-09-06.json).
- [All source line records](../data/thurgau-audit/source-lines.json), [all 718 source stops](../data/thurgau-audit/source-stops.json), [canton GTFS stop inventory](../data/thurgau-audit/stops.json), [reviewed route crosswalk](../data/thurgau-line-crosswalk.json).
- [Source metadata and request hashes](../data/thurgau-sources/sources.json), [raw request receipts](../data/thurgau-sources/requests.json). Original responses, boundary rows and the selected timetable fixture are preserved as gzip files in the repository.
- [SBB border source](../data/thurgau-sbb-rail-sources/sources.json), [explicit Konstanz joins](../data/thurgau-sbb-rail-policy.json), [all SBB candidate records and exclusions](../data/thurgau-audit/sbb-rail-source-segments.json), and [lake-source screening](../data/thurgau-water-review/review.json).
- [Lake/Rhine source responses](../data/thurgau-shipping-sources/sources.json), [eight exact dock-pair ways and policy](../data/thurgau-shipping-policy.json), [complete source-element inventory](../data/thurgau-audit/shipping-source-elements.json), [full-pattern review](../data/thurgau-shipping-sources/path-review.json), and [separate derived path database](../public/data/thurgau-region/shipping-paths.json).
- [Scoped Romanshorn ferry source](../data/thurgau-ferry-sources/sources.json), [policy](../data/thurgau-ferry-policy.json), [source inventory](../data/thurgau-audit/ferry-source-elements.json), [directed path review](../data/thurgau-ferry-sources/path-review.json), and [separate ODbL path database](../public/data/thurgau-region/ferry-paths.json).
- [Shipping source and attribution](../data/thurgau-boat-sources/sources.json), [exact boat policy](../data/thurgau-boat-policy.json), [all 69 shipping features](../data/thurgau-audit/boat-source-segments.json), and [full-pattern/dock review](../data/thurgau-boat-sources/path-review.json).
- [Federal rail source](../data/thurgau-rail-sources/source.json), [exact rail policy](../data/thurgau-rail-policy.json) and [all federal source segments](../data/thurgau-audit/rail-source-segments.json).
- [Regional bus road evidence](../data/thurgau-regional-roads/sources.json), [review notes](../data/thurgau-regional-roads/review-sources.json), and [OSM-derived regional path database](../public/data/thurgau-region/regional-road-paths.json).
- [City road source evidence](../data/thurgau-city-roads/sources.json), [OSM-derived city path database](../public/data/thurgau-region/city-road-paths.json), and [16-line geometry review](assets/thurgau-city-road-review.png).

## Whole-canton membership

The scanner reads **all ${summary.census.allYearTrips.toLocaleString('en-GB')} trip records and ${summary.census.stopTimeRows.toLocaleString('en-GB')} stop-time records** in the pinned national archive. A route belongs to the inventory if any original call falls in the unsimplified swissBOUNDARIES3D **2026-01** Thurgau polygon. No operator whitelist or rectangular crop selects membership. Parent/platform records are kept distinct; ${sum(summary.districts, d => d.calledPlatforms)} in-canton platform/stop IDs are actually called by these routes. Polygon membership, not the source bus-stop list, defines the denominator.

${table(['District', 'Called GTFS stop IDs', 'Annual route records'], summary.districts.map(d => [d.district, d.calledPlatforms, d.routeIds.length]))}

District route counts overlap. Journeys retain **every call outside Thurgau**, including Swiss and foreign termini; a route passing through without any in-canton stop does not enter this stop-based census. Full patterns extending beyond the available geometry are excluded, not shortened at the border. This includes the Lake Constance/Rhine services of URh, SBS, BSB and the Reichenau solar ferry. City, replacement, night and seasonal route records remain inventoried even when geometry is absent or no service operates on these dates.

${table(['Agency ID', 'GTFS identity', 'Annual routes', 'Friday admitted / total', 'Sunday admitted / total'], agencies.map(([id, name]) => {
  const rs = routes.filter(r => r.agencyId === id)
  return [id, clean(name), rs.length, ...[0, 1].map(i => `${sum(rs, r => r.days[i].admittedTrips)} / ${sum(rs, r => r.days[i].trips)}`)]
}))}

Four official call-taxi polygons are separately recorded in the audit: Bischofszell (Schweizersholz/Halden), Hohentannen (Heldswil), Erlen (Buchackern/Eppishausen), and one unnamed feature. The first three carry **80.945**. They define service areas, not fixed movements, and are excluded from the vehicle feed. A fixed-stop GTFS scan cannot prove completeness for services absent from the archive or for unrepresented flexible-service areas.

## Sources, dates and attribution

${table(['Source', 'Pinned evidence / vintage', 'Credit and reuse'], [
  ['National GTFS', 'Feed 20260902; valid 2025-12-14–2026-12-12. SHA-256 ' + summary.sourceHashes.archive, 'SBB / Open data platform mobility Switzerland; opentransportdata.swiss terms, not a blanket CC licence'],
  ['Thurgau WFS', 'Full original GML responses acquired 2026-09-08; EPSG:2056. Geometry effective date UNKNOWN.', '© Kanton Thurgau, Abteilung Öffentlicher Verkehr; Amt für Geoinformation. CC BY 4.0 declared by the cantonal dataset catalogue'],
  ['Cantonal catalogue', 'Modified ' + summary.sources.catalogueModified + '; creation 2000-01-01 is not a geometry vintage', 'Pinned catalogue.json records the dataset-specific licence and publisher'],
  ['Thurgau general terms', '2018-02-20; preserved alongside the catalogue declaration', 'Visible attribution on publication/redistribution; retain dataset-specific CC BY evidence'],
  ['swissBOUNDARIES3D', '2026-01; all original canton and district geometry rows retained', '© swisstopo; free-geodata terms'],
  ['Federal rail network', 'Checksum-verified FOT XTF; catalogue 2021-07-06, asset updated 2025-01-18, reused 2026-09-08; used segment Stand dates 2021-07-06', '© Federal Office of Transport (FOT); opendata.swiss terms_by, source attribution required; retain proprietary catalogue label without relabelling it CC'],
  ['SBB graphical lines', 'Pinned selected responses reused 2026-09-08; catalogue modified ' + sbbSource.modified + ', data processed ' + sbbSource.dataProcessed + '; no feature survey date supplied', 'SBB Infrastructure / data.sbb.ch; terms_by, commercial and non-commercial use with attribution'],
  ['Official shipping and lake shorelines', 'swissTLMRegio source acquired 2026-09-08; collection updated 2026-06-25 with temporal extent through 2025-12-02; individual shipping-feature vintage unknown. Original FOEN Bodensee and Untersee features retain 2007 shoreline reference.', '© swisstopo; shoreline © FOEN, swisstopo; swisstopo free-geodata terms. Literal proprietary STAC label preserved, not relabelled CC.'],
  ['Lake/Rhine OSM supplement', 'Historical state 2026-09-02; acquired 2026-09-08. Eight selected ferry ways edited 2025-04-16–2025-12-21. Rhine water relation 1679977 v3 edited 2026-01-19, retaining source=Landsat and its island. Edit timestamps are not survey dates or observed water levels.', '© OpenStreetMap contributors, ODbL 1.0; retained official segments and lake shoreline © swisstopo, FOEN with original terms.'],
  ['Romanshorn–Friedrichshafen ferry', 'OSM historical state 2026-09-02; acquired 2026-09-08. Way 26255860 version 25 dated 2025-11-05; individual node edit timestamps retained. No verified survey or operating-lane date.', '© OpenStreetMap contributors; separate ODbL 1.0 ferry database. Original Bodensee shoreline © FOEN, swisstopo (2007 reference).'],
  ['Wittenbach turnaround', 'Historical OSM state 2026-09-02; acquired 2026-09-08. Selected road version 9 (2026-08-02), roundabout version 14 (2024-01-29). Full original responses and scoped restriction query retained.', '© OpenStreetMap contributors; separate ODbL 1.0 inferred turnaround database.'],
  ['Bregenz OSM rail corridor', 'Historical Overpass query 2026-09-02T00:00:00Z; acquired 2026-09-08; 521 ways individually inventoried', '© OpenStreetMap contributors; separate border path database under ODbL 1.0'],
  ['City and regional road supplements', 'Geofabrik Switzerland 2026-09-02 plus OSM border extract 2026-09-08; pinned PBF SHA d5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b', '© OpenStreetMap contributors; derived path database under ODbL 1.0'],
])}

Official references: [national GTFS dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [national terms](https://opentransportdata.swiss/en/terms-of-use/), [Thurgau catalogue API](https://data.tg.ch/api/explore/v2.1/catalog/datasets/netz-des-offentlichen-verkehrs), [Thurgau WFS](https://ows.geo.tg.ch/geofy_access_proxy/oev?Request=GetCapabilities&Service=WFS&Version=2.0.0), [general terms](https://shop.geo.tg.ch/sites/default/files/pdf/Nutzungsbedingungen_Geodaten.pdf), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [swisstopo terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices).

The WFS layer metadata supplies no effective geometry date. Neither its response timestamp, the catalogue's July modification, nor its placeholder 2000 creation date proves a 2026 timetable alignment. This study explicitly labels the geometry vintage unknown. The [official 2026 eastern Switzerland rail map](https://www.thurbo.ch/fileadmin/user_upload/1_Reisen/Reiseinfos/L-11_SBB-RV-Ostschweiz-A1-26-SID.pdf) provides a network review aid (including S10 Wil–Weinfelden–Romanshorn and S15 Wil–Wängi–Frauenfeld); it is not used as digitized geometry or redistributed here.

Gleislicht authors the processed feed. Modifications comprise route selection, source graph construction, stop projection, bounded stop-access connectors, conversion to WGS84, output rounding and scheduled interpolation. The feed carries attribution, licence/terms URLs and local copies of the Thurgau licence evidence. It is an archival study, not current operational or realtime data; a refresh requires a new source snapshot and full revalidation.

## Source adapter and exclusions

${table(['WFS layer', 'Records', 'Role'], summary.sourceLayerInventory.map(l => [l.layer, l.count, {
  buslinie: 'Route-attributed bus centreline segments', bahnlinie_takt: '17 rail corridor segments, including two explicitly labelled S15',
  buslinie_takt: 'Frequency-rendering duplicate; acquired and inventoried, not a second geometry source', bushalte: 'DiDok + line + operator evidence',
  sammeltaxi: 'Service-area inventory; excluded from fixed movements',
}[l.layer]]).concat([['dist_bahn / dist_bus', 'Not downloaded', 'Advertised accessibility-distance layers; excluded because they are not vehicle paths']]))}

All **${sourceLines.length} bus/rail geometry records** are retained in the line audit; ${sourceLines.filter(l => l.routeIds.length).length} have route-crosswalk candidates. These are segmented source features, not that many passenger lines. Candidate status does not mean every vertex is used or every joined route is admitted.

Bus joins require an exact prefixed line number, a reviewed operator label, and at least **two distinct shared DiDok stops** between the source stop layer and the canton-scoped GTFS route. Reviewed source labels are PostAuto → 801, Bus Ostschweiz → 138 and REGO → 896. Each route's evidence IDs are saved. The GTFS line names alone are not unique operator identities. Prefix 70 is explicitly assigned only to 605/806; other reviewed regular bus codes use 80. A source token **20.207** is retained as written and is never silently corrected to 80.207.

Comma-separated source numbers are parsed independently. Parenthetical **nur zeitweise**, **Abendkurs** and **Kantibus** tokens are excluded from that route's graph because no operating-time rule is supplied; an unqualified token for another line on the same feature can still be used. **BN820** is not assumed to mean the GTFS line 820. Day and night labels are respected. The official line source lacks Frauenfeld and Kreuzlingen city routes; the separate OSM supplement below covers their fixed-route patterns. Replacement route records remain inventoried; the dated fixed service of operator 744 receives an independently identified GTFS/OSM pattern in the regional supplement.

For rail, SBB/THURBO use the 15 unlabelled regional corridor features as a routing graph; these are not preassigned GTFS line shapes. AB **S15** uses only its two explicitly labelled Frauenfeld–Wängi–Wil features, separately from the other rail graph. Full stop-chain geometry tests determine admission. Incomplete SBB/THURBO patterns can use the separately audited federal rail supplement below; complete cantonal paths remain unchanged. The separate official shipping supplement below admits only complete boat patterns that also pass shoreline validation; boats receive no road or rail substitute.

Original **EPSG:2056 east/north** vertices form the graph. The parser asserts CRS, axis ranges, unique IDs and full WFS returned/matched counts. Exact source vertices define connectivity; no gap is bridged and no near-coincident tracks are merged. The established swisstopo approximate LV95/WGS84 conversion has metre-level precision. Output coordinates round to seven decimals.

Every directed segment must project within **80 m for bus / 120 m for rail**. The path follows existing source edges; inferred connectors link the actual platform coordinates to the source line within those limits. Detours may not exceed the larger of 4.5 × straight-line distance and 1,200 m (bus) / 3,000 m (rail). Alternative projections can differ by at most 5 m from the nearest projection. No simplification or automatic connector between disconnected source parts is added.

Direction comes from the ordered GTFS platform chain, not a source road-direction field. This does **not** certify one-way access, a specific running track, bridge/tunnel correctness, a loop's exact operational alignment, or temporary diversions. Shortest source-path inference and bounded stop-access connectors remain model assumptions. Complete geometry is necessary for admission; it is not observed movement.

## City road supplement

The initial official-geometry feed admitted 376 Friday / 293 Sunday journeys. The city supplement adds **${summary.days.map(d => d.cityRoadCoverage.trips).join(' / ')} journeys**, bringing the earlier city-stage totals to **1437 / 687** before the regional extension below. All **six Kreuzlingen fixed routes (901, 902, 903, 905, 906, 907)** and **ten Frauenfeld fixed routes (801–805, 811–815)** are now admitted for both dates when scheduled. These account for 77 unique routing patterns across the two dates, with 16,980 scheduled segment occurrences and no matcher rejections. Per-day pattern counts can differ because the regional audit also preserves GTFS direction IDs.

The [official Frauenfeld timetable](https://www.frauenfeld.ch/wohnen-mobilitaet/mobilitaet/stadtbus/fahrplan.html/680), valid from 14 December 2025, distinguishes daytime 801–805 from evening/Sunday 811–815. Its night taxi drops passengers at requested destinations; **NT stays excluded**, including 15 Friday and 30 Sunday civil-day instances. The [Kreuzlingen city page](https://www.kreuzlingen.ch/lebenslagen/mobilitaet/oeffentlicher-verkehr) confirms six lines and Sunday service. These pages establish service scope, not street geometry. [Review notes](../data/thurgau-city-roads/review-sources.json) distinguish web-readable evidence from a failed direct HTML download; no unacquired source snapshot is claimed.

Road geometry uses pinned **pfaedle 99f2cd466696ecc6bdb73b2b3bb9008557fcb84a**, its unmodified bus profile, and the existing hashed Swiss/border OSM extract. The run enables **--no-trie -W** so every fallback hop is reported. Original pattern index, matcher log, shapes, stop times, trips and run hashes are preserved for each city. Offline verification reimports those outputs and requires exact equality with the derived cache. Maximum road snaps are **71.2 m Kreuzlingen / 38.8 m Frauenfeld** (rounded upwards), below the 120 m road limit; detour guard is max(6 × direct distance, 1,500 m), with 5 m simplification. These are separate from the tighter cantonal bus limits above.

Cache identity includes the exact GTFS route ID, complete ordered platform IDs and coordinates. Missing/changed patterns fail the build; no stop-pair or reverse-direction cache borrowing is allowed. Repeated loop calls are sliced with monotone source shape distances. Each journey retains its own pattern's geometry even where a directed pair has several path variants. Official source paths are preserved; the road supplement applies only to agencies 727 and 797. The resulting city database is OSM-derived **ODbL 1.0**, separately attributed from the cantonal CC BY geometry. The complete derived city database is distributed beside the regional feed.

![All 16 city lines with directed road-pattern overlays](assets/thurgau-city-road-review.png)

The plot was inspected for all 16 lines, including opposite directions, branches, termini and evening loops. It is a geometry overview without a basemap; it does not independently certify every street restriction or actual operator routing. The matcher uses supported OSM bus access, one-way and turn restrictions, whose accuracy and temporary changes remain source limitations.

## Regional bus road supplement

The regional supplement adds **${summary.days[0].regionalRoadCoverage.trips} Friday / ${summary.days[1].regionalRoadCoverage.trips} Sunday journeys** to the city-stage feed. It routes the complete, uncropped dated patterns for fixed buses operated by **Bus Ostschweiz (138), Automobildienst Appenzeller Bahnen (744), PostAuto (801) and Regiobus (896)**. GTFS operator and route IDs establish these road-pattern identities directly; this does not assert a previously unresolved cantonal line crosswalk or alter original WFS labels.

${table(['Agency', 'Routing patterns', 'Complete road patterns', 'Rejected segments', 'Maximum snap (m)'], Object.entries(regionalRoads.caches).map(([id, c]) => [id, Object.keys(c.patterns).length, Object.values(c.patterns).filter(p => p.every(i => i !== null)).length, c.report.rejectedPatternSegments, c.report.maxSnapMetres.toFixed(2)]))}

Across **59 fixed route records**, **292 of 296** routing patterns pass every road-segment check. Matcher runs on **8 September 2026** use the same pinned binary, unmodified bus configuration and Swiss/border OSM source as the city supplement. The 120 m snap, max(6 × direct, 1,500 m) detour and 5 m simplification limits are unchanged. Original patterns, log, shapes, trips, stop times and run receipts are preserved separately for each operator. Verification pins binary/config/source hashes and reimports every accepted and rejected segment from those original outputs. These are inferred road shapes, not newly acquired operator alignment data.

Complete official patterns retain their original paths. For an incomplete official pattern, the road supplement must provide the **entire exact ordered platform-and-coordinate chain**; it cannot patch a gap with another pattern's segment. Missing cache identities fail the build. The four original matcher rejections retain their diagnostics; the explicit Wittenbach supplement below resolves only their scoped missing first segment. Each admitted train keeps its own pattern geometry, even when another pattern traverses the same directed stop pair differently.

**Wittenbach Zentrum:** the original matcher gives distinct platforms 73966:0:341297 and 73966:0:256909 identical shape distances (0.0) in four PostAuto patterns. That failure remains preserved. A separately pinned road-turnaround inference now admits their **37 Friday journeys**, retaining both calls and every subsequent segment from the same full-pattern cache.

**RUB:** route 92-8-Y-j26-1 is GTFS type **715**, which denotes demand-responsive bus service in the [extended GTFS route reference](https://developers.google.com/transit/gtfs/reference/extended-route-types), last updated 16 October 2024 and checked 8 September 2026. Ordinary pickup/drop-off flags alone do not establish fixed operation. Its **30 Friday and 29 Sunday** instances remain excluded, alongside Frauenfeld NT. [Review notes](../data/thurgau-regional-roads/review-sources.json) preserve the source interpretation; they do not claim an original HTML snapshot.

The [original Wittenbach replay](../data/thurgau-audit/wittenbach-review.json) preserves the historical four-pattern failure against the original matcher stop-times. The platforms are **17.85 m apart**, but both shape distances remain 0.0. Reproduce this historical evidence with \`python3 scripts/review-thurgau-wittenbach.py\`; the original cache and its rejected slices are unchanged.

### Scoped Wittenbach turnaround

The [new source archive](../data/thurgau-wittenbach-sources/sources.json), [policy](../data/thurgau-wittenbach-policy.json), [source inventory](../data/thurgau-wittenbach-sources/inventory.json), [full-pattern review](../data/thurgau-wittenbach-sources/path-review.json) and [distributed ODbL path database](../public/data/thurgau-region/wittenbach-paths.json) record the resolution. An Overpass query requests **2 September 2026 at 00:00 UTC**, acquired **8 September 2026**. All 7,856 unique source elements are preserved, with 1,312 ways/relations inventoried. Only two ways supply new movement geometry: **1111858974**, Romanshornerstrasse, version **9** dated **2 August 2026**, and **26647200**, the roundabout, version **14** dated **29 January 2024**.

The source-road path runs west from the original platform-2 projection, traverses the **entire mapped roundabout in source order**, then returns east to the original platform-1 projection. The road and circle share exact node **292227795**. The **224.02 m** road path follows existing vertices and retains the closed ring; it cannot reverse instantly at the junction or replace the circle with a chord. Platform connectors measure **6.72 / 4.08 m**, within the explicit **15 m** cap. The platforms must lie on opposite right-hand sides of the directed approach. The selected road must remain bidirectional, the ring must remain a counterclockwise roundabout, and road length must remain within **150–400 m**. No GTFS coordinate is moved.

OSM arrival relations **17128888 (200)** and **16238506 (207)** include the selected approach and roundabout. Their departure counterparts **17128889 / 16238511** begin at the outbound source stop and omit the turnaround. These records support the terminus context but **do not verify the complete two-call movement**. The full ring is an explicit road inference from the ordered GTFS platforms. The [OSM roundabout definition](https://wiki.openstreetmap.org/wiki/Tag:junction%3Droundabout) specifies source traffic direction and implied one-way circulation. A separate dated query acquires all restrictions referencing the selected ways: **14866387**, an only-right-turn from another side road, lies outside the traversed subpath and is recorded as inapplicable. This is source validation, not legal, lane or operator certification.

Admission is restricted to segment zero of four exact **agency 801 / routes 200 and 207 / direction 1** patterns whose original cache has one missing first segment and complete subsequent slices. Changed route, platform coordinates, direction, source features or restrictions fail validation; other patterns cannot borrow this turnaround. Every later segment comes from that same preserved matcher pattern. Previously admitted bus, rail and boat journeys retain their paths and times unchanged. Sunday has no corresponding failed pattern and gains no journeys.

![Scoped turnaround and four complete patterns](assets/thurgau-wittenbach-turn-review.png)

The local road/roundabout and all four full-pattern overlays were inspected. The OSM-derived turnaround retains **© OpenStreetMap contributors / ODbL 1.0** attribution. Reproduce with \`node scripts/prepare-thurgau-wittenbach.mjs\`, \`node scripts/review-thurgau-wittenbach-turn.mjs\` and \`scripts/review-thurgau-wittenbach-turn.py\`, then rebuild and check the regional feed.

**All dated fixed bus journeys now have complete geometry: 3,361 Friday / 1,754 Sunday.** Together with all 919 / 895 rail journeys, the remaining dated exclusions are boats and explicitly demand-responsive services. This does not establish year-round coverage or certified physical routing.

The review plots overlay all 296 routing patterns across 59 route records: [page 1](assets/thurgau-regional-road-review-1.png), [page 2](assets/thurgau-regional-road-review-2.png), [page 3](assets/thurgau-regional-road-review-3.png), [page 4](assets/thurgau-regional-road-review-4.png). Every panel was inspected for branch shapes and endpoint loops. Grey paths include valid segments from incomplete patterns; their presence in a review plot is not feed admission. The plots have no basemap and do not certify temporary diversions or physical street restrictions. The complete regional derived database is distributed under **ODbL 1.0**, credited to **OpenStreetMap contributors**, separately from the cantonal CC BY geometry.

## Federal rail supplement

The federal-only infrastructure supplement adds **${summary.days[0].railCoverage.trips - summary.days[0].sbbRailCoverage.trips - summary.days[0].borderRailCoverage.trips} Friday and ${summary.days[1].railCoverage.trips - summary.days[1].sbbRailCoverage.trips - summary.days[1].borderRailCoverage.trips} Sunday journeys** to the preceding 3545 / 1938 feed. Its 169 unique newly admitted full patterns cover 17 route identities across the two dates. The policy inventories all **${railPolicy.routes.length}** annual SBB/THURBO rail route identities; inactive records remain visible. The original AB S15 and complete SBB/THURBO cantonal paths are preserved byte-for-byte.

The reused **Federal Office of Transport railway network** contains **${railSource.nodes} operating points and ${railSource.segments} infrastructure segments**. Original XTF, collection and asset metadata are retained. The uncompressed XTF SHA-256 is **${railSource.sha256}**, matching the published STAC asset checksum. This extension reuses the previously acquired bytes; it does not claim a new network download. The catalogue date is **6 July 2021**, the asset update is **18 January 2025**, and every segment used by this extension has **Stand 2021-07-06**. These dates do not establish alignment validity for the September 2026 timetable.

**${usedRailIds.size} distinct source segments** appear in admitted supplemental paths. The [complete source-segment inventory](../data/thurgau-audit/rail-source-segments.json) retains gauge, source Stand, validity interval, infrastructure operator, endpoint-attachment distance and exclusion reason for all ${railSource.segments} records. Gauge is **1435 mm** for the reviewed SBB (11) and THURBO (65) routes. Mixed-gauge segments must explicitly include 1435 mm. Future/expired segments, other gauges and excessive source endpoint gaps are excluded from the graph.

Each original platform is joined by exact operating-point number, with a **350 m station-to-operating-point limit**. Source geometry can attach to its explicitly referenced topology nodes within **120 m**; this is not a nearest-coordinate merge between separate networks. Paths may not exceed **max(3000 m, 4.5 × direct distance)** including station attachments. Source vertices receive **5 m LV95 simplification** and the established approximate swisstopo conversion, rounded to six decimals before final output. The largest accepted station attachment is **302.0 m** and topology attachment **90.6 m** (rounded upwards). These station-centre attachments are a different model from the 120 m cantonal rail projection limit; no existing cantonal threshold was increased.

The complete ordered stop chain constrains every directed search: other scheduled operating points are blocked until their turn. The matcher cannot pass a later call early just to shorten a path. The entire supplemental pattern must pass; no individual successful segment is borrowed to repair another failed pattern. Per-pattern evidence records ordered source segment IDs, directed topology endpoints, station attachment distances and hashes of the derived paths. The feed retains the original platform IDs, times and outside-canton calls.

**Interlaken Ost IC81:** the generic operating point 8507492 is disconnected from the standard-gauge graph. FOT separately identifies **8519309 / ch14uvag00165678** as **Interlaken Ost [Gleis 5-8]**, connected to the 1435 mm Interlaken West segment **ch14uvag00087489**. The policy maps only original IC81 platforms **ch:1:sloid:7492:0:460848 (7)** and **ch:1:sloid:7492:0:581416 (5)** to that source node. Source number, node name, gauge, route and platform labels are asserted; a changed or different platform cannot inherit the mapping. This admits all **15 Friday IC81 journeys**, preserving every original call. It is an explicit platform-group crosswalk, not a name or proximity guess.

**Rail coverage is complete for the two dated fixtures:** all **919 Friday / 895 Sunday rail journeys** retain every call and a path for every segment, including Konstanz and both St. Margrethen platforms for Bregenz. This is cartographic admission for those dates, not year-round or running-track certification. The primary federal source still lacks Bregenz and the 26 schematic SBB candidate records remain excluded as source geometry.

The [rail review overview, page 1](assets/thurgau-rail-review-1.png) and [page 2](assets/thurgau-rail-review-2.png) overlay all 169 newly admitted patterns. Both were inspected for complete branches, termini and the long cross-canton IC8/IC81/IC9 paths. These are infrastructure-centreline inferences, not certified running tracks, actual train positions or temporary diversion geometry. The plots have no basemap. Timetable precision and physically plausible speeds remain separate from geometric admission.

Credit is **© Federal Office of Transport (FOT), Railway network**, with the [source asset](https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf) and [source-attribution terms](https://opendata.swiss/terms-of-use/#terms_by). The collection's literal licence field is **proprietary**, while its licence link selects **terms_by**; this audit preserves both rather than assigning a Creative Commons licence. The [official terms page](https://opendata.swiss/en/terms-of-use), checked 8 September 2026, allows commercial and non-commercial reuse under that attribution condition. Source metadata and catalogue declarations accompany the feed in its rail-sources directory. The federal rail component retains these terms separately from the ODbL road databases and CC BY cantonal geometry.

## Konstanz SBB border supplement

The SBB supplement adds **${summary.days[0].sbbRailCoverage.trips} Friday / ${summary.days[1].sbbRailCoverage.trips} Sunday journeys**, covering **${sbbPatterns.size} unique complete patterns** across six exact GTFS route identities: THURBO RE1, S14, SN14, S44, RE75 and SBB IR75. Friday has 51 patterns and Sunday 39; SN14 operates here only on Sunday. All original foreign and Swiss calls, platform identities, times and call permissions remain intact. Every previously admitted cantonal, road and federal-only path is regression-checked byte-for-byte.

The [SBB graphical line dataset](https://data.sbb.ch/explore/dataset/linie-mit-polygon/) supplies two detailed normal-gauge curves: line **822 KRGR–KODB** (43 vertices) and line **824 KHGR–KODB** (42 vertices). Exact source feature identities include line number, operating-point codes and kilometre endpoints. The policy joins **KRGR / Kreuzlingen Grenze** to FOT **8518047 / ch14uvag00089372**, and **KHGR / Kreuzlingen Hafen Grenze** to **8518048 / ch14uvag00089349**. The two border nodes remain distinct. **KODB / Konstanz** is explicitly crosswalked to GTFS **8014586**; the graph station coordinate is the line 822 endpoint, with a bounded connector from line 824. Source-node connectors must be at most **${sbbPolicy.limits.sourceNodeAttachmentMetres} m**; both border joins are under one metre and the Konstanz inter-source connector is about five metres. The original Konstanz timetable stop has an approximately **78 m** inferred station attachment.

The full ordered call chain is routed through the combined FOT/SBB graph only when the primary pattern is incomplete and its route identity is explicitly reviewed. Every segment must pass the unchanged federal gauge, stop-order, station-attachment and detour limits. Pattern evidence identifies every SBB segment and each segment's original federal failure. Admitted mixed paths are labelled **fot-sbb-rail-inference**. Both SBB approaches have validated travel in both directions. No two-point schematic segment is admitted. The 59-record preserved Konstanz/Como response is fully inventoried: two records are used and 57 are excluded; the separate Bregenz query contributes 26 further exclusions.

The SBB source catalogue was modified **29 July 2026** and data processed **2 September 2026**; the selected Konstanz response was acquired and reused **8 September 2026**. These are publication/processing dates, with **no individual feature survey or alignment-validity date established**. All SBB vertices are retained before seven-decimal output rounding; unlike FOT geometry, they receive no LV95 conversion or 5 m simplification. Credit is **SBB Infrastructure / data.sbb.ch**. The pinned dataset metadata explicitly declares **terms_by** and **NonCommercialAllowed-CommercialAllowed-ReferenceRequired**, with the [SBB licence page](https://data.sbb.ch/page/licence/) as its terms reference. Original responses, metadata, terms HTML and hashes accompany the feed under sbb-rail-sources, separately from FOT and ODbL components.

The [six-route review](assets/thurgau-sbb-rail-review-1.png) overlays all 61 newly admitted patterns; the [border detail](assets/thurgau-sbb-border-review.png) shows both source curves and the Konstanz stop attachment. These are reviewed cartographic centreline inferences, not running-track, temporary-diversion or actual-movement certification.

## Bregenz OSM border rail supplement

This extension admits **${summary.days[0].borderRailCoverage.trips} Friday / ${summary.days[1].borderRailCoverage.trips} Sunday S7 journeys**, through **St. Margrethen SG platforms 2 and 3**, with complete original calls and successful federal segments unchanged. The [derived border path database](../public/data/thurgau-region/border-rail-paths.json), [source archive](../data/thurgau-border-rail-sources/sources.json), [route/station policy](../data/thurgau-border-rail-policy.json) and [source inventory](../data/thurgau-border-rail-sources/inventory.json) retain attribution, geometry and selection evidence. The [review plot](assets/thurgau-border-rail-review.png) compares the accepted directed border paths, the reviewed station connection and the earlier rejected reversal.

The Overpass query requests the historical state at **2026-09-02T00:00:00Z**, acquired **8 September 2026**; the server's database timestamp is separate from that requested snapshot. Original query and response bytes are preserved. All **521 rail ways** are inventoried: **240** are eligible standard-gauge main/branch tracks or crossovers explicitly tagged as main track. One additional exact passenger connector, reviewed below, brings the scoped graph to **241 eligible ways**. Other sidings, yards, spurs and other gauges remain excluded. All used ways carry gauge **1435**, and way version/timestamp evidence is retained. Original OSM node IDs define connectivity; equal coordinates on separate nodes do not create a junction.

Station identity requires exact **uic_ref** and reviewed OSM station IDs: **4886725252 / 8506314 / St. Margrethen SG** and **2459480034 / 8102336 / Bregenz**. Original timetable coordinates remain unchanged. Station identity must be within **350 m**, track projection within **60 m**, and an alternative projection within **5 m** of the nearest. Paths are capped at **18 km**; direction changes greater than **120°** are rejected to prevent instantaneous reversal at switches. The accepted border path is approximately **12.281 km**, with track attachments **1.91 m** at St. Margrethen platform 3 and **0.51 m** at Bregenz. No coordinate merge joins this network to FOT: each original adjacent stop pair is matched independently within the full S7 call chain, and the whole pattern must pass.

**Platform 2 is now resolved through an explicit source review.** OSM way **122064965**, version **10**, dated **2024-02-15T22:14:42Z**, has mixed tags: **service=siding**, **passenger_lines=1**, **gauge=1435**, **maxspeed=95** and **operator=SBB**. Its eight-node curve connects source nodes **1364831182** and **1364831187**, shared with the 883 main track (**275975818**) and 880 main track (**122064981**). This is a source-drawn connection, not a coordinate bridge or platform substitution. The policy pins the complete feature hash, endpoint IDs, adjoining main tracks and passenger/gauge/operator tags. A changed feature or connection requires a new review.

The additional way is available only after the primary graph fails, and only for the original pair **ch:1:sloid:6314:2:2 ↔ 8102336** within a reviewed full S7 pattern. Previously successful platform-3 paths are returned unchanged. The new platform-2 path is **12.280 km** and passes the original **120° turn**, **60 m projection**, **5 m alternative** and **18 km length** guards in both directions, adding the remaining **5 Friday / 6 Sunday journeys**. The policy does not generally admit sidings. The original graph without this connection still fails; relaxing its turn guard still produces the rejected reversing movement, which remains in the review evidence. Physical running-track selection, legal direction, signalling and diversions remain unverified even for admitted patterns.

The **Vorarlberg WFS** was fully acquired with **136 rail records**, count checks, source attributes and dataset metadata. The metadata declares **CC BY 4.0**, describes digitisation from **2012 aerial imagery**, and records revision **17 February 2025** and metadata date **29 July 2026**. Those later metadata dates do not establish an updated border alignment. [ÖBB's project account](https://infrastruktur.oebb.at/en/projekte-fuer-oesterreich/bahnstrecken/arlbergstrecke-innsbruck-bregenz/ausbau-st-margrethen-lauterach) documents the replacement Rhine crossing in March 2013. These records remain candidate evidence, with no geometry admitted from them. The [ÖBB Geo Netz catalogue](https://data.oebb.at/de/datensaetze~geo-netz~) lists its 12-2024 release as valid only through **13 December 2025**, so that alternative is also excluded from the 2026 feed.

The admitted OSM-derived border database is distributed separately under **ODbL 1.0**, credited **© OpenStreetMap contributors**, with the [OSM copyright and licence page](https://www.openstreetmap.org/copyright). Patterns using it are labelled **fot-osm-border-rail-inference**. FOT geometry retains its own attribution and terms. This is an inferred archival rail path, not a certified train trajectory.

## Lake and Rhine shipping supplement

The [official shipping adapter](../scripts/thurgau-boat-geometry.mjs) adds **26 complete Friday / 26 complete Sunday boat journeys**. Six of the 27 unique dated boat patterns pass, with all original dock calls, direction IDs, timestamps and permissions retained. This original official-line stage rejects **66 Friday / 61 Sunday boat journeys**, including the Romanshorn–Friedrichshafen ferry and all URh Rhine journeys. The scoped ferry supplement below resolves 32 / 28 of them; **34 Friday / 33 Sunday boat journeys remain after that stage**. The additional lake/Rhine supplement below resolves 22 / 21 more, leaving **12 boat journeys excluded on each date**. Original segment-specific failures remain in each day's audit and the [full pattern review](../data/thurgau-boat-sources/path-review.json).

${table(['Agency / line', 'GTFS route ID', 'Friday admitted / total', 'Sunday admitted / total'], routes.filter(r => r.mode === 'ferry').map(r => [r.agencyId + ' / ' + r.name, r.id, ...r.days.map(d => d.admittedTrips + ' / ' + d.trips)]))}

All 18 Reichenau solar-ferry journeys and all four Radolfzell journeys pass on each date. The other additions are one Rorschach–Horn–Arbon journey and three Immenstaad–Hagnau–Altnau–Güttingen–Immenstaad loops per date. Opposite directions are evaluated independently; only the solar-ferry pattern is admitted in both direction IDs on these fixtures. No successful pair supplies admission to a longer incomplete dock chain.

**Source acquisition:** 30 adjacent, uncapped official API envelopes cover every dated dock and the lake/Rhine corridor. They yield **69 distinct swissTLMRegio passenger-shipping line features**; all duplicates agree exactly. All original mixed-transport responses, request URLs, counts and hashes are preserved. Only features explicitly labelled **Kursschiff_Linie** enter the boat graph. A broad mixed-layer request with pagination omitted shipping records found in smaller requests, so it is not used as completeness evidence. These are generalized cartographic lines, not operator route shapes or navigational lanes. The [swisstopo product](https://www.swisstopo.admin.ch/en/landscape-model-swisstlmregio) describes 20–60 m generalisation accuracy. The collection was updated **25 June 2026**, with temporal extent through **2 December 2025**; neither establishes an individual feature survey date.

**Directed matching:** exact route, agency, route type, direction and full original dock/coordinate chains are required. Source vertices alone establish graph connectivity. Original dock projections are bounded by **150 m**, alternatives by **5 m** from the nearest, and detours by max(**3 × direct distance**, **1,200 m**). The largest admitted dock projection is **${boatReview.maximumAdmittedDockSnapMetres.toFixed(2)} m**. Source lines are not simplified or extended with topology bridges. Successful bus and rail paths remain unchanged.

**Shoreline validation:** the original FOEN **Bodensee feature 124** (8,714 vertices) and **Untersee feature 171** (3,834 vertices) are acquired with all rings and islands. Their reference date remains **2007**. Every inferred path edge is split at every shoreline intersection; fixed-distance sampling cannot skip an island. An outside-water interval is allowed only when both endpoints lie within **150 m of the same actual endpoint dock**. Every such discrepancy is disclosed in the audit: **${boatReview.admittedOutsideWaterIntervals.length} intervals across the six unique admitted patterns**, including repeated approaches. Intervals elsewhere reject the entire journey. This bounds disagreement between generalized shipping lines and the old dock/shoreline representation; it does not certify dock access. The longer dock-area discrepancies at Immenstaad and Radolfzell are visible in the detailed review. This original stage lacks Rhine water and fails the Schaffhausen attachment. The scoped lake/Rhine supplement below acquires that missing water polygon and distinct named ferry ways; the original source-policy limits remain unchanged.

![All admitted shipping patterns](assets/thurgau-boat-review.png)

![Every admitted dock and its 150 m discrepancy zone](assets/thurgau-boat-dock-review.png)

Both plots were inspected, covering all four admitted route identities, six complete patterns and eleven distinct docks. They compare source curves, original GTFS coordinates and shoreline constraints; they do not independently certify operator routing, seasonal validity or navigational safety. The feed labels these paths **swisstopo-boat-inference** and distributes the source responses, policy, attribution and terms alongside the dated manifests.

The earlier [display-polygon screening](../data/thurgau-water-review/review.json) remains reproducible: **${waterReview.stops.length}** docks, **${waterReview.stops.filter(s => !s.inDisplayLake).length}** outside its 60 m simplified polygon, and **${waterReview.stops.filter(s => s.distanceToDisplayWaterMetres > 150).length}** farther than 150 m away. The [original Bodensee-only screening](../data/thurgau-water-review/original-source-review.json) also remains preserved: 17 docks beyond that single lake feature and zero complete direct-water journeys. Those earlier failures are not the shipping source used here. Acquiring Untersee and the official shipping curves supplies distinct evidence; a lake polygon alone does not establish a route.

Reproduce offline with \`node scripts/prepare-thurgau-boats.mjs\`, \`node scripts/review-thurgau-boats.mjs\` and \`scripts/review-thurgau-boats.py\`, then rebuild and run the regional checker. A new acquisition or changed dock chain requires new policy hashes and a full review.

### Romanshorn–Friedrichshafen ferry

The [scoped OSM ferry adapter](../scripts/thurgau-ferry.mjs) adds **32 Friday / 28 Sunday journeys**, covering all four dated direction/operator patterns on **94-381-0-j26-1 (SBS, agency 195)** and **94-381-A-j26-1 (BSB, agency 360)**. Both retain line 3810, the original **Romanshorn Autoquai** and **Friedrichshafen Fähre** IDs and coordinates, call permissions and **46-minute** scheduled crossings. The [BSB operator page](https://www.bsb.de/de/fahrplan/bodensee-faehre), checked 8 September 2026, confirms this connection and joint operation; it supplies identity context, not the source geometry or archived operating-status verification.

The original official shipping graph rejects these journeys for remote shoreline crossings near Romanshorn. Its paths and failure hashes remain in the [new comparison review](../data/thurgau-ferry-sources/path-review.json). The new adapter selects only the explicitly named **OSM way 26255860**, **version 25, edited 5 November 2025**, from historical state **2 September 2026**. All **33 original vertices** are retained between near-endpoint projections; each output direction has 35 points, including the two actual GTFS docks. The inferred path is **13.018 km**, with maximum attachment **${ferryReview.patterns[0].maximumSnapMetres.toFixed(2)} m**. Source direction is traversed forward from Romanshorn and backward from Friedrichshafen; no independently verified shipping lane is claimed.

The bounded source query returned 1,044 entries, resolving to **${ferryReview.inventory.acquiredElements} unique elements** after exact duplicate checks. The [complete response inventory](../data/thurgau-audit/ferry-source-elements.json) admits only this way and its 33 vertices; **${ferryReview.inventory.exclusions} other elements** are excluded from this exact ferry scope. The envelope and recursively referenced content do not establish an OSM census of the entire lake or Rhine. Original responses, query, hashes and all element edit dates are preserved.

Dock projection and outside-water zones are limited to **10 m**, with no alternate snap and a **1.3 × direct-distance** detour bound. Every edge is split at every intersection with original FOEN Bodensee feature 124, including islands. Each direction records three small outside-water intervals at the two actual docks (approximately **3.48, 5.95 and 2.04 m**); they remain disclosed as disagreement with the **2007 shoreline**. No remote outside-water interval passes. Tests reject a thin remote island crossing and attachments beyond the limit. This is cartographic inference, not certified harbour access, operational service, navigation or temporary-diversion geometry.

![Both ferry directions and both dock approaches](assets/thurgau-ferry-review.png)

The full crossing and both dock panels were inspected. The feed identifies these journeys as **osm-romanshorn-ferry-inference** and distributes a separate **ODbL 1.0** path database credited to **OpenStreetMap contributors**, beside the pinned source response and policy. Shoreline validation retains **© FOEN, swisstopo** attribution and its original terms. All previously admitted bus, rail and boat paths, calls and permissions are regression-preserved.

Together these first two boat adapters admit **58 Friday / 54 Sunday journeys across ten unique patterns and six route identities**, leaving **34 / 33 boat journeys** for the following lake/Rhine stage. Demand-responsive exclusions remain unchanged. Reproduce offline with \`node scripts/prepare-thurgau-ferry.mjs\`, \`node scripts/review-thurgau-ferry.mjs\` and \`scripts/review-thurgau-ferry.py\` (Pillow), then rebuild and check the regional feed.

### Additional lake and Rhine patterns

The [lake/Rhine adapter](../scripts/thurgau-shipping.mjs) adds **22 Friday / 21 Sunday journeys** across **11 unique full patterns** (11 Friday, 10 Sunday). Line 3800 gains 13 / 12, line 3801 gains 1 / 1, and URh line 3820 gains **8 / 8**, covering all dated **Schaffhausen–Büsingen–Diessenhofen** journeys in both directions. All boat adapters together now admit **80 Friday / 75 Sunday journeys**, across all seven annual boat route identities. This brings the regional feed to **4,360 / 2,724 journeys**; fixed bus and rail coverage stays complete on these two dates.

Each successful segment from the original official boat matcher is retained byte-for-byte. Only a failed stop-to-stop segment may use its **exact reviewed OSM way**; neither endpoint nor any intermediate GTFS call is removed. No curve is joined to another source halfway through a segment, and no artificial topology bridge or water path is drawn. Source selection is restricted to the **17 originally rejected full dock/coordinate patterns** of three exact SBS/URh route identities. Any remaining failed segment excludes the whole pattern.

${table(['OSM way', 'Reviewed dock pair', 'Version / edit date', 'Snap / outside-water zone'], shippingPolicy.pairs.map(p => [p.wayId, clean(p.from[2]) + ' ↔ ' + clean(p.to[2]), p.version + ' / ' + p.timestamp.slice(0, 10), p.limits.snapMetres + ' m / ' + p.dockZoneMetres + ' m']))}

The lake replacements retain original **FOEN Bodensee feature 124**, including all island rings, while requiring **120 m** dock attachment with no alternate snap. Their discrepancy zones are **25 m**, except the explicitly reviewed **Meersburg–Kreuzlingen pair: 100 m**, still below the original official adapter's 150 m policy. At Meersburg the dock projection is **76.57 m** and an approximately **17 m** interval lies outside the 2007 shoreline. It is recorded, visible in the dock review and bounded by the actual GTFS dock; it does not certify harbour access. The largest replacement snap is **110.00 m**, on Arbon–Langenargen. Detours remain bounded by max(3 × direct distance, 1,200 m). Every edge is split at every shoreline intersection; remote outside-water intervals fail.

**Source identity conflict:** OSM way **1255942854** is named Meersburg–Kreuzlingen but carries an **URh** operator tag, while this dated GTFS route belongs to **SBS**. The tag is preserved and explicitly not used to assign the operator. The way supplies cartographic connection geometry only. [Rorschach's municipal account, published 12 February 2026](https://stadtinfo.rorschach.ch/stadtrat/tageskarten-der-schifffahrtsbetriebe-zum-vorzugspreis/), identifies the SBS service through Romanshorn and Kreuzlingen to Meersburg. Neither that account nor this geometric match independently verifies the vessel's operating lane.

**Rhine water:** the new source is **OSM relation 1679977**, version **3**, edited **19 January 2026**. Its exact outer way **122858269** contains **1,208 vertices**, and inner way **937838731** retains a **15-vertex island hole**. The adapter requires precisely those members and hashes every selected relation, way and node. No bounding rectangle or lake outline substitutes for the river. The source's **Landsat** tag is retained: this is a mapped water area, not a contemporary depth, water-level or navigability model. Both directed river paths pass with **25 m** attachments (maximum **10.93 m**) and **10 m** dock discrepancy zones. The small source discrepancies at Schaffhausen and Diessenhofen are approximately **3.54 m** and **6.67 m** respectively; there is no remote land crossing. Tests prove that removing the island fails source validation and that crossing its area fails the water test.

The [URh low-water timetable page](https://www.urh.ch/fahrplan_sommer_nw), checked 8 September 2026, lists Schaffhausen–Diessenhofen round trips from **27 June to 4 October 2026** and the interruption between Diessenhofen and Stein am Rhein. The selected GTFS patterns already reflect this separation. The adapter adds no journey across the interrupted section and retains all original trip times. This corroborates the service structure without establishing observed operation of every trip.

![Every newly admitted complete lake/Rhine pattern and the river island](assets/thurgau-shipping-review.png)

![All eleven new OSM dock attachments and their discrepancy zones](assets/thurgau-shipping-dock-review.png)

Both plots were inspected. The [source inventory](../data/thurgau-audit/shipping-source-elements.json) records every acquired way and relation, selected memberships, exclusions, versions and timestamps; all original nodes remain in the pinned raw responses. It includes **${shippingReview.inventory.shippingRecords} shipping-query way/relation records** and **${shippingReview.inventory.waterRecords} water-query records**. Only eight shipping ways and the exact Rhine water relation with its two rings enter the supplement. The two requests have explicit envelopes and recursive members; response completeness is not a claim that every real-world service or canton water feature is represented.

The feed labels these journeys **official-osm-shipping-inference**, with per-segment source evidence and the original failed matcher audit preserved. The separate derived database and raw OSM responses retain **ODbL 1.0 / © OpenStreetMap contributors** attribution; retained official geometry and lake shorelines retain **© swisstopo / FOEN** and their original terms. All previously admitted journeys retain their complete geometry, calls, permissions and times.

**Remaining boat exclusions: 12 Friday / 12 Sunday journeys**, in six full patterns: two Kreuzlingen–Mainau–Meersburg journeys, one Romanshorn–Immenstaad loop, and nine longer URh lake/Seerhein journeys. Their original failures and unavailable reviewed replacements remain in the [pattern audit](../data/thurgau-shipping-sources/path-review.json). These are not shortened to their matching portions. Demand-responsive services remain excluded. Reproduce offline with \`node scripts/prepare-thurgau-shipping.mjs\`, \`node scripts/review-thurgau-shipping.mjs\` and \`scripts/review-thurgau-shipping.py\` (Pillow), followed by the regional rebuild and checker.



## Weekday and Sunday directed validation

The date model is **local civil day 00:00–24:00**, including previous-service-day spillover (Thursday into Friday and Saturday into Sunday). Calendar exceptions apply. Frequency expansion and reservation permissions are handled; this selected fixture has zero active frequency templates. Original calls and pickup/drop-off permissions remain in exported journeys. A reservation/on-demand call, type-715 route or any failed segment excludes the entire journey.

The admitted feeds retain **${summary.days.map(d => d.timing?.admittedZeroDurationSegmentOccurrences).join(' / ')} zero-duration segment occurrences (Friday / Sunday)** where different stops share a timetable minute. No artificial seconds are inserted and no finite speed is assigned to those segments. Each day's timing diagnostics also retain the largest positive-duration implied speed by mode; the Sunday rail maximum is about ${Math.round(reports[1].timing.maximumPositiveDurationSegmentByMode.find(s => s.mode === 'rail').kilometresPerHour)} km/h on an SN30 segment. These are source-timing/model limitations, not measured or certified operating speeds. Geometry admission does not establish physically realistic timing at every call.

Pattern identity is GTFS **route ID + direction_id + full ordered original platform IDs**, including repeated calls and out-of-canton stops. Stop pairs remain ordered and route-scoped. A matched directed pair means at least one pattern context has a path. Segment-occurrence coverage is counted from each pattern’s own paths; a successful context does not confer coverage on a failed context of the same pair. Both include otherwise excluded incomplete journeys and must not be confused with admitted-feed counts.

${table(['Measure', 'Friday 4 September', 'Sunday 6 September'], [
  ['Dated journeys', ...totals.map(d => d.trips)],
  ['Admitted journeys', ...totals.map(d => d.admittedTrips + ' (' + percent(d.admittedTrips, d.trips) + ')')],
  ['Complete admitted patterns / all patterns', ...totals.map(d => d.admittedPatterns + ' / ' + d.patterns)],
  ['Matched directed pairs / all directed pairs', ...totals.map(d => d.matchedDirectedPairs + ' / ' + d.directedPairs + ' (' + percent(d.matchedDirectedPairs, d.directedPairs) + ')')],
  ['Matched scheduled segments / all occurrences', ...totals.map(d => d.matchedScheduledSegmentOccurrences + ' / ' + d.scheduledSegmentOccurrences + ' (' + percent(d.matchedScheduledSegmentOccurrences, d.scheduledSegmentOccurrences) + ')')],
  ['Segments in admitted journeys', ...totals.map(d => d.admittedSegmentOccurrences)],
  ['Carry-in journeys: admitted / total', ...summary.days.map(d => d.admittedCarryInTrips + ' / ' + d.carryInTrips)],
  ['Night-labelled journeys: admitted / total', ...summary.days.map(d => d.directedPatternChecks.admittedNightRouteTrips + ' / ' + d.directedPatternChecks.nightRouteTrips)],
  ['Patterns revisiting platforms: admitted / total', ...summary.days.map(d => d.directedPatternChecks.admittedPatternsRevisitingPlatforms + ' / ' + d.directedPatternChecks.patternsRevisitingPlatforms)],
])}

**${cross.shared} patterns are shared**, **${cross.weekdayOnly} occur only on Friday**, and **${cross.sundayOnly} occur only on Sunday**. Both direction IDs 0 and 1 are evaluated. All exported journeys have geometry for 100% of their segments; this does not turn canton-wide coverage into 100%.

${table(['Unmatched directed-pair reason', 'Friday', 'Sunday'], gapReasons.map(reason => [reason, ...reports.map(d => d.directedPairs.filter(p => p.reason === reason).length)]))}

Endpoint gaps can reflect source extent, missing termini, stop offsets or stale alignment; disconnections reflect exact source topology. No threshold was increased to hide these failures. All rejected pairs, their endpoint names and gap diagnostics are saved in each day's audit.

## Admitted routes

Counts below refer only to the two validated civil dates. Multiple records can share a passenger-facing number.

${table(['Agency', 'Line', 'GTFS route ID', 'Friday admitted / total', 'Sunday admitted / total'], admitted.map(r => [r.agencyId, r.name, r.id, ...r.days.map(d => d.admittedTrips + ' / ' + d.trips)]))}

## Reproduction and checks

Run from the repository root with Node, installed project dependencies, Python 3 and unzip. Source preparation uses Python's standard library; downloading additionally uses curl.

\`\`\`sh
# Re-decode preserved original GML and boundary rows without network access.
python3 scripts/prepare-thurgau-sources.py

# Full canton census and build from the pinned national archive (two complete
# stop-times scans; no city/operator whitelist). The crosswalk must reproduce.
node --max-old-space-size=8192 scripts/build-thurgau-region.mjs \\
  --archive /private/tmp/GTFS_FP2026_20260902.zip

# Faster identical build from the preserved selected timetable fixture.
node scripts/build-thurgau-region.mjs \\
  --archive /private/tmp/GTFS_FP2026_20260902.zip \\
  --timetable-cache data/thurgau-audit/timetable-cache.json.gz

# Recompute crosswalk evidence and every directed match; compare every exported
# stop, path, edge and journey; reconcile routes, groups, patterns and chunks.
node scripts/check-thurgau-region.mjs
node scripts/document-thurgau-study.mjs
npx vitest run scripts/thurgau-shipping.test.mjs scripts/thurgau-ferry.test.mjs scripts/thurgau-wittenbach.test.mjs scripts/thurgau-boat-geometry.test.mjs scripts/water-paths.test.mjs scripts/zug-boat-geometry.test.mjs scripts/thurgau-border-rail.test.mjs scripts/thurgau-sbb-rail.test.mjs scripts/thurgau-rail-geometry.test.mjs scripts/luzern-rail-geometry.test.mjs scripts/thurgau-regional-roads.test.mjs scripts/thurgau-region.test.mjs scripts/thurgau-city-roads.test.mjs scripts/bern-region.test.mjs
python3 scripts/test_thurgau_sources.py
\`\`\`

For a new acquisition, use \`python3 scripts/prepare-thurgau-sources.py --download --boundary PATH_TO_2026_GPKG\`, run \`node --max-old-space-size=8192 scripts/thurgau-timetable.mjs PATH_TO_PINNED_GTFS\`, then \`node scripts/crosswalk-thurgau.mjs\` and review changes before rebuilding. A new source snapshot invalidates the old timetable cache. Do not reuse an unreviewed geometry vintage or relax admission rules merely to increase counts.

To rebuild the city supplement, run \`node scripts/prepare-thurgau-city-roads.mjs\`, then \`scripts/match-postbus-roads.mjs\` separately for agency directories 727 and 797 with the pinned binary/config/PBF described in [PostBus road geometry](POSTBUS-ROAD-GEOMETRY.md). Use \`--output /private/tmp/thurgau-city-road-matched/AGENCY\`, then run \`node scripts/import-thurgau-city-roads.mjs\` and \`node scripts/check-thurgau-city-roads.mjs\`. The plot generator \`scripts/review-thurgau-city-roads.py\` uses Pillow and the macOS Helvetica font. Review every changed path before replacing the committed complete-pattern supplement.

To rebuild the regional supplement, run \`node scripts/prepare-thurgau-regional-roads.mjs\`, then the same matcher separately for agency directories 138, 744, 801 and 896, using input \`/private/tmp/thurgau-regional-road-feeds/AGENCY\` and output \`/private/tmp/thurgau-regional-road-matched/AGENCY\`. Run \`node scripts/import-thurgau-regional-roads.mjs\`, \`node scripts/check-thurgau-regional-roads.mjs\` and \`scripts/review-thurgau-regional-roads.py\` with a Pillow-enabled Python, inspect every panel and rejection, then rebuild and check the regional feed. Pinned review notes distinguish source dates and admission decisions.

To reproduce federal rail preparation from the existing pinned national snapshot, run \`node scripts/prepare-thurgau-rail.mjs data/aargau-rail-sources\`, then rebuild and run the Thurgau checker. The committed \`data/thurgau-rail-sources\` files already support an entirely offline feed build; the Aargau directory is only the default acquisition-reuse input. Generate the supplemental review with \`scripts/review-thurgau-rail.py\` using a Pillow-enabled Python. Reproduce SBB preparation with \`node scripts/prepare-thurgau-sbb-rail.mjs\`, using the already preserved Bregenz query; plot with \`scripts/review-thurgau-rail.py --sbb\`. Reproduce border source preparation offline with \`node scripts/prepare-thurgau-border-rail.mjs\`, generate path diagnostics with \`node scripts/review-thurgau-border-rail.mjs\` and its plot with \`scripts/review-thurgau-border-rail.py\`. Reproduce the water screening offline with \`node scripts/review-thurgau-water.mjs\`. The checker replays all supplements and proves every previously admitted bus, rail and boat path unchanged by the scoped turnaround. All fixed buses and all rail journeys must have complete dated geometry.

Validation covers source hashes, GML counts/axes/IDs, full canton/district membership, operator/line identity, direction and loop preservation, midnight spillover, whole-pattern rejection, repeated geometry replay, exact exported paths, complete calls, finite ordered times, all 24 chunk hashes and trip identities. **Two September days do not establish public-holiday, winter, summer-only or year-round completeness.** Temporary diversions and physical one-way/track legality remain unverified.
`
await writeFile('docs/THURGAU-STUDY.md', doc)

const inventory = `# Complete Thurgau route admission and exclusion inventory

Generated from the pinned 2026 GTFS canton census. See [study and method](THURGAU-STUDY.md) and [machine-readable route evidence](../data/thurgau-audit/routes.json). All **${routes.length}** annual route records appear below, including records inactive on both September dates. Day values are **admitted / total civil-day journeys**. Source candidates alone do not imply complete geometry.

${table(['Agency', 'Line', 'Mode', 'GTFS route ID', 'Districts', 'Friday', 'Sunday', 'Status / exclusion evidence'], [...routes].sort((a, b) => a.agencyId.localeCompare(b.agencyId, undefined, { numeric: true }) || a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id.localeCompare(b.id)).map(r => {
  const reasons = [...new Set(r.days.flatMap(d => Object.keys(d.excludedTrips)))]
  const reason = r.status === 'inactive-on-validation-dates' ? 'No service on these dates; annual membership retained' : r.wittenbachSupplement ? 'Complete original road patterns plus exact scoped Wittenbach turnaround; both calls and subsequent pattern slices retained' : r.ferrySupplement ? 'Scoped OSM ferry geometry; original two-dock chains, 10 m attachments and shoreline zones' : r.shippingSupplement ? 'Successful official segments plus exact OSM lake/Rhine replacements; whole-pattern admission' + (reasons.length ? '; exclusions: ' + reasons.join('; ') : '') : r.boatSupplement ? 'Official shipping-line inference with full dock chain and shoreline checks' + (reasons.length ? '; exclusions: ' + reasons.join('; ') : '') : r.railSupplement ? 'Complete cantonal patterns retained; full FOT/SBB rail patterns supplement gaps' + (reasons.length ? '; exclusions: ' + reasons.join('; ') : '') : r.type === 715 && r.name !== 'NT' ? 'GTFS type 715: demand-responsive route; ordinary call flags do not establish fixed paths' : r.roadSupplement?.startsWith('osm-regional-road') ? 'Complete official patterns retained; whole OSM regional patterns supplement gaps' + (reasons.length ? '; exclusions: ' + reasons.join('; ') : '') : r.roadSupplement ? 'Complete OSM-inferred city patterns; official line geometry absent' : r.name === 'NT' && r.agencyId === '797' ? 'Demand-responsive night taxi; fixed drop-off paths not inferred' : r.crosswalk.exclusionReason ?? (r.status === 'inactive-on-validation-dates' ? 'No service on these dates; annual membership retained' : reasons.join('; ') || 'Every dated pattern complete')
  return [r.agencyId + ' ' + clean(r.agency), clean(r.name), r.mode, r.id, r.districts.join(', '), ...r.days.map(d => d.admittedTrips + ' / ' + d.trips), labels[r.status] + ': ' + clean(reason)]
}))}
`
await writeFile('docs/THURGAU-ROUTE-INVENTORY.md', inventory)
console.log(`Documented ${routes.length} route records and ${admitted.length} routes with admitted journeys`)
