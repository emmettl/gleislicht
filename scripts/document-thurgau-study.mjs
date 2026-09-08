import { gunzipSync } from 'node:zlib'
import { readFile, writeFile } from 'node:fs/promises'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const summary = await json('data/thurgau-audit/summary.json')
const regionalRoads = JSON.parse(gunzipSync(await readFile('data/thurgau-regional-roads/cache.json.gz')))
const railSource = await json('data/thurgau-rail-sources/source.json')
const sbbSource = await json('data/thurgau-sbb-rail-sources/sources.json')
const sbbPolicy = await json('data/thurgau-sbb-rail-policy.json')
const waterReview = await json('data/thurgau-water-review/review.json')
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

const usedRailIds = new Set(reports.flatMap(r => r.patterns.filter(p => ['fot-rail-inference', 'fot-sbb-rail-inference'].includes(p.geometrySource)).flatMap(p => p.railSupplement.segments.flatMap(s => s.directedSourceSegments.filter(e => !e.id.startsWith('sbb:')).map(s => s.id)))))

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

For rail, SBB/THURBO use the 15 unlabelled regional corridor features as a routing graph; these are not preassigned GTFS line shapes. AB **S15** uses only its two explicitly labelled Frauenfeld–Wängi–Wil features, separately from the other rail graph. Full stop-chain geometry tests determine admission. Incomplete SBB/THURBO patterns can use the separately audited federal rail supplement below; complete cantonal paths remain unchanged. Lake services have no acquired water-compatible geometry and receive no road or rail substitute.

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

Complete official patterns retain their original paths. For an incomplete official pattern, the road supplement must provide the **entire exact ordered platform-and-coordinate chain**; it cannot patch a gap with another pattern's segment. Missing cache identities fail the build. Known rejected road patterns retain their official geometry diagnostics and remain excluded as whole journeys. Each admitted train keeps its own pattern geometry, even when another pattern traverses the same directed stop pair differently.

**Wittenbach Zentrum:** four PostAuto routing patterns on 200 and 207 give distinct platforms 73966:0:341297 and 73966:0:256909 identical matcher shape distances (0.0). The importer cannot extract a positive-length road segment. Their **37 Friday journeys** remain excluded with missing-shape evidence; neither call is dropped and no connector is invented.

**RUB:** route 92-8-Y-j26-1 is GTFS type **715**, which denotes demand-responsive bus service in the [extended GTFS route reference](https://developers.google.com/transit/gtfs/reference/extended-route-types), last updated 16 October 2024 and checked 8 September 2026. Ordinary pickup/drop-off flags alone do not establish fixed operation. Its **30 Friday and 29 Sunday** instances remain excluded, alongside Frauenfeld NT. [Review notes](../data/thurgau-regional-roads/review-sources.json) preserve the source interpretation; they do not claim an original HTML snapshot.

The review plots overlay all 296 routing patterns across 59 route records: [page 1](assets/thurgau-regional-road-review-1.png), [page 2](assets/thurgau-regional-road-review-2.png), [page 3](assets/thurgau-regional-road-review-3.png), [page 4](assets/thurgau-regional-road-review-4.png). Every panel was inspected for branch shapes and endpoint loops. Grey paths include valid segments from incomplete patterns; their presence in a review plot is not feed admission. The plots have no basemap and do not certify temporary diversions or physical street restrictions. The complete regional derived database is distributed under **ODbL 1.0**, credited to **OpenStreetMap contributors**, separately from the cantonal CC BY geometry.

## Federal rail supplement

The federal-only infrastructure supplement adds **${summary.days[0].railCoverage.trips - summary.days[0].sbbRailCoverage.trips} Friday and ${summary.days[1].railCoverage.trips - summary.days[1].sbbRailCoverage.trips} Sunday journeys** to the preceding 3545 / 1938 feed. Its 169 unique newly admitted full patterns cover 17 route identities across the two dates. The policy inventories all **${railPolicy.routes.length}** annual SBB/THURBO rail route identities; inactive records remain visible. The original AB S15 and complete SBB/THURBO cantonal paths are preserved byte-for-byte.

The reused **Federal Office of Transport railway network** contains **${railSource.nodes} operating points and ${railSource.segments} infrastructure segments**. Original XTF, collection and asset metadata are retained. The uncompressed XTF SHA-256 is **${railSource.sha256}**, matching the published STAC asset checksum. This extension reuses the previously acquired bytes; it does not claim a new network download. The catalogue date is **6 July 2021**, the asset update is **18 January 2025**, and every segment used by this extension has **Stand 2021-07-06**. These dates do not establish alignment validity for the September 2026 timetable.

**${usedRailIds.size} distinct source segments** appear in admitted supplemental paths. The [complete source-segment inventory](../data/thurgau-audit/rail-source-segments.json) retains gauge, source Stand, validity interval, infrastructure operator, endpoint-attachment distance and exclusion reason for all ${railSource.segments} records. Gauge is **1435 mm** for the reviewed SBB (11) and THURBO (65) routes. Mixed-gauge segments must explicitly include 1435 mm. Future/expired segments, other gauges and excessive source endpoint gaps are excluded from the graph.

Each original platform is joined by exact operating-point number, with a **350 m station-to-operating-point limit**. Source geometry can attach to its explicitly referenced topology nodes within **120 m**; this is not a nearest-coordinate merge between separate networks. Paths may not exceed **max(3000 m, 4.5 × direct distance)** including station attachments. Source vertices receive **5 m LV95 simplification** and the established approximate swisstopo conversion, rounded to six decimals before final output. The largest accepted station attachment is **302.0 m** and topology attachment **90.6 m** (rounded upwards). These station-centre attachments are a different model from the 120 m cantonal rail projection limit; no existing cantonal threshold was increased.

The complete ordered stop chain constrains every directed search: other scheduled operating points are blocked until their turn. The matcher cannot pass a later call early just to shorten a path. The entire supplemental pattern must pass; no individual successful segment is borrowed to repair another failed pattern. Per-pattern evidence records ordered source segment IDs, directed topology endpoints, station attachment distances and hashes of the derived paths. The feed retains the original platform IDs, times and outside-canton calls.

**Interlaken Ost IC81:** the generic operating point 8507492 is disconnected from the standard-gauge graph. FOT separately identifies **8519309 / ch14uvag00165678** as **Interlaken Ost [Gleis 5-8]**, connected to the 1435 mm Interlaken West segment **ch14uvag00087489**. The policy maps only original IC81 platforms **ch:1:sloid:7492:0:460848 (7)** and **ch:1:sloid:7492:0:581416 (5)** to that source node. Source number, node name, gauge, route and platform labels are asserted; a changed or different platform cannot inherit the mapping. This admits all **15 Friday IC81 journeys**, preserving every original call. It is an explicit platform-group crosswalk, not a name or proximity guess.

**Remaining rail exclusions:** Bregenz (8102336) still lacks an admitted detailed source connection. All **10 Friday / 14 Sunday Bregenz-reaching S7 journeys** remain excluded in full. The 8 September SBB Bregenz query returned 26 records, all schematic two-point lines; their original response and individual exclusions are preserved. Konstanz is resolved by the separate SBB supplement below. No border node substitutes for a foreign destination and no journey is cropped at the last Swiss call.

The [rail review overview, page 1](assets/thurgau-rail-review-1.png) and [page 2](assets/thurgau-rail-review-2.png) overlay all 169 newly admitted patterns. Both were inspected for complete branches, termini and the long cross-canton IC8/IC81/IC9 paths. These are infrastructure-centreline inferences, not certified running tracks, actual train positions or temporary diversion geometry. The plots have no basemap. Timetable precision and physically plausible speeds remain separate from geometric admission.

Credit is **© Federal Office of Transport (FOT), Railway network**, with the [source asset](https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf) and [source-attribution terms](https://opendata.swiss/terms-of-use/#terms_by). The collection's literal licence field is **proprietary**, while its licence link selects **terms_by**; this audit preserves both rather than assigning a Creative Commons licence. The [official terms page](https://opendata.swiss/en/terms-of-use), checked 8 September 2026, allows commercial and non-commercial reuse under that attribution condition. Source metadata and catalogue declarations accompany the feed in its rail-sources directory. The federal rail component retains these terms separately from the ODbL road databases and CC BY cantonal geometry.

## Konstanz SBB border supplement

The SBB supplement adds **${summary.days[0].sbbRailCoverage.trips} Friday / ${summary.days[1].sbbRailCoverage.trips} Sunday journeys**, covering **${sbbPatterns.size} unique complete patterns** across six exact GTFS route identities: THURBO RE1, S14, SN14, S44, RE75 and SBB IR75. Friday has 51 patterns and Sunday 39; SN14 operates here only on Sunday. All original foreign and Swiss calls, platform identities, times and call permissions remain intact. Every previously admitted cantonal, road and federal-only path is regression-checked byte-for-byte.

The [SBB graphical line dataset](https://data.sbb.ch/explore/dataset/linie-mit-polygon/) supplies two detailed normal-gauge curves: line **822 KRGR–KODB** (43 vertices) and line **824 KHGR–KODB** (42 vertices). Exact source feature identities include line number, operating-point codes and kilometre endpoints. The policy joins **KRGR / Kreuzlingen Grenze** to FOT **8518047 / ch14uvag00089372**, and **KHGR / Kreuzlingen Hafen Grenze** to **8518048 / ch14uvag00089349**. The two border nodes remain distinct. **KODB / Konstanz** is explicitly crosswalked to GTFS **8014586**; the graph station coordinate is the line 822 endpoint, with a bounded connector from line 824. Source-node connectors must be at most **${sbbPolicy.limits.sourceNodeAttachmentMetres} m**; both border joins are under one metre and the Konstanz inter-source connector is about five metres. The original Konstanz timetable stop has an approximately **78 m** inferred station attachment.

The full ordered call chain is routed through the combined FOT/SBB graph only when the primary pattern is incomplete and its route identity is explicitly reviewed. Every segment must pass the unchanged federal gauge, stop-order, station-attachment and detour limits. Pattern evidence identifies every SBB segment and each segment's original federal failure. Admitted mixed paths are labelled **fot-sbb-rail-inference**. Both SBB approaches have validated travel in both directions. No two-point schematic segment is admitted. The 59-record preserved Konstanz/Como response is fully inventoried: two records are used and 57 are excluded; the separate Bregenz query contributes 26 further exclusions.

The SBB source catalogue was modified **29 July 2026** and data processed **2 September 2026**; the selected Konstanz response was acquired and reused **8 September 2026**. These are publication/processing dates, with **no individual feature survey or alignment-validity date established**. All SBB vertices are retained before seven-decimal output rounding; unlike FOT geometry, they receive no LV95 conversion or 5 m simplification. Credit is **SBB Infrastructure / data.sbb.ch**. The pinned dataset metadata explicitly declares **terms_by** and **NonCommercialAllowed-CommercialAllowed-ReferenceRequired**, with the [SBB licence page](https://data.sbb.ch/page/licence/) as its terms reference. Original responses, metadata, terms HTML and hashes accompany the feed under sbb-rail-sources, separately from FOT and ODbL components.

The [six-route review](assets/thurgau-sbb-rail-review-1.png) overlays all 61 newly admitted patterns; the [border detail](assets/thurgau-sbb-border-review.png) shows both source curves and the Konstanz stop attachment. These are reviewed cartographic centreline inferences, not running-track, temporary-diversion or actual-movement certification.

## Lake and Rhine source screening

All **92 Friday / 87 Sunday boat journeys** remain excluded, retaining their complete dock chains. The [reproducible screening](../data/thurgau-water-review/review.json) preserves the existing local FOEN/swisstopo lake display artifact and its hash. Its metadata labels the reference edition **2007** and shoreline simplification **60 m**. Among the **${waterReview.stops.length}** called dock IDs, **${waterReview.stops.filter(s => !s.inDisplayLake).length}** lie outside the display lake polygon and **${waterReview.stops.filter(s => s.distanceToDisplayWaterMetres > 150).length}** are more than 150 m from it. These measurements describe the display polygon, not verified dock access.

This display asset is not enabled as a boat routing source. The next acquisition needs unsimplified water geometry including islands, Rhine connections and foreign docks, followed by source-date/attribution review and complete directed dock-chain validation. A lake polygon alone does not establish shipping routes; the water router cannot supply missing river channels or justify discarding distant calls.

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
npx vitest run scripts/thurgau-sbb-rail.test.mjs scripts/thurgau-rail-geometry.test.mjs scripts/luzern-rail-geometry.test.mjs scripts/thurgau-regional-roads.test.mjs scripts/thurgau-region.test.mjs scripts/thurgau-city-roads.test.mjs scripts/bern-region.test.mjs
python3 scripts/test_thurgau_sources.py
\`\`\`

For a new acquisition, use \`python3 scripts/prepare-thurgau-sources.py --download --boundary PATH_TO_2026_GPKG\`, run \`node --max-old-space-size=8192 scripts/thurgau-timetable.mjs PATH_TO_PINNED_GTFS\`, then \`node scripts/crosswalk-thurgau.mjs\` and review changes before rebuilding. A new source snapshot invalidates the old timetable cache. Do not reuse an unreviewed geometry vintage or relax admission rules merely to increase counts.

To rebuild the city supplement, run \`node scripts/prepare-thurgau-city-roads.mjs\`, then \`scripts/match-postbus-roads.mjs\` separately for agency directories 727 and 797 with the pinned binary/config/PBF described in [PostBus road geometry](POSTBUS-ROAD-GEOMETRY.md). Use \`--output /private/tmp/thurgau-city-road-matched/AGENCY\`, then run \`node scripts/import-thurgau-city-roads.mjs\` and \`node scripts/check-thurgau-city-roads.mjs\`. The plot generator \`scripts/review-thurgau-city-roads.py\` uses Pillow and the macOS Helvetica font. Review every changed path before replacing the committed complete-pattern supplement.

To rebuild the regional supplement, run \`node scripts/prepare-thurgau-regional-roads.mjs\`, then the same matcher separately for agency directories 138, 744, 801 and 896, using input \`/private/tmp/thurgau-regional-road-feeds/AGENCY\` and output \`/private/tmp/thurgau-regional-road-matched/AGENCY\`. Run \`node scripts/import-thurgau-regional-roads.mjs\`, \`node scripts/check-thurgau-regional-roads.mjs\` and \`scripts/review-thurgau-regional-roads.py\` with a Pillow-enabled Python, inspect every panel and rejection, then rebuild and check the regional feed. Pinned review notes distinguish source dates and admission decisions.

To reproduce federal rail preparation from the existing pinned national snapshot, run \`node scripts/prepare-thurgau-rail.mjs data/aargau-rail-sources\`, then rebuild and run the Thurgau checker. The committed \`data/thurgau-rail-sources\` files already support an entirely offline feed build; the Aargau directory is only the default acquisition-reuse input. Generate the supplemental review with \`scripts/review-thurgau-rail.py\` using a Pillow-enabled Python. Reproduce SBB preparation with \`node scripts/prepare-thurgau-sbb-rail.mjs\`, using the already preserved Bregenz query; plot with \`scripts/review-thurgau-rail.py --sbb\`. Reproduce the water screening offline with \`node scripts/review-thurgau-water.mjs\`. The checker replays all rail paths and additionally proves every previously admitted cantonal/city/regional-road and federal-only path unchanged.

Validation covers source hashes, GML counts/axes/IDs, full canton/district membership, operator/line identity, direction and loop preservation, midnight spillover, whole-pattern rejection, repeated geometry replay, exact exported paths, complete calls, finite ordered times, all 24 chunk hashes and trip identities. **Two September days do not establish public-holiday, winter, summer-only or year-round completeness.** Temporary diversions and physical one-way/track legality remain unverified.
`
await writeFile('docs/THURGAU-STUDY.md', doc)

const inventory = `# Complete Thurgau route admission and exclusion inventory

Generated from the pinned 2026 GTFS canton census. See [study and method](THURGAU-STUDY.md) and [machine-readable route evidence](../data/thurgau-audit/routes.json). All **${routes.length}** annual route records appear below, including records inactive on both September dates. Day values are **admitted / total civil-day journeys**. Source candidates alone do not imply complete geometry.

${table(['Agency', 'Line', 'Mode', 'GTFS route ID', 'Districts', 'Friday', 'Sunday', 'Status / exclusion evidence'], [...routes].sort((a, b) => a.agencyId.localeCompare(b.agencyId, undefined, { numeric: true }) || a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id.localeCompare(b.id)).map(r => {
  const reasons = [...new Set(r.days.flatMap(d => Object.keys(d.excludedTrips)))]
  const reason = r.status === 'inactive-on-validation-dates' ? 'No service on these dates; annual membership retained' : r.railSupplement ? 'Complete cantonal patterns retained; full FOT/SBB rail patterns supplement gaps' + (reasons.length ? '; exclusions: ' + reasons.join('; ') : '') : r.type === 715 && r.name !== 'NT' ? 'GTFS type 715: demand-responsive route; ordinary call flags do not establish fixed paths' : r.roadSupplement?.startsWith('osm-regional-road') ? 'Complete official patterns retained; whole OSM regional patterns supplement gaps' + (reasons.length ? '; exclusions: ' + reasons.join('; ') : '') : r.roadSupplement ? 'Complete OSM-inferred city patterns; official line geometry absent' : r.name === 'NT' && r.agencyId === '797' ? 'Demand-responsive night taxi; fixed drop-off paths not inferred' : r.crosswalk.exclusionReason ?? (r.status === 'inactive-on-validation-dates' ? 'No service on these dates; annual membership retained' : reasons.join('; ') || 'Every dated pattern complete')
  return [r.agencyId + ' ' + clean(r.agency), clean(r.name), r.mode, r.id, r.districts.join(', '), ...r.days.map(d => d.admittedTrips + ' / ' + d.trips), labels[r.status] + ': ' + clean(reason)]
}))}
`
await writeFile('docs/THURGAU-ROUTE-INVENTORY.md', inventory)
console.log(`Documented ${routes.length} route records and ${admitted.length} routes with admitted journeys`)
