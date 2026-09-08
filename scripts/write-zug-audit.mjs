import { readFile, writeFile } from 'node:fs/promises'
import { checkZugRegion } from './check-zug-region.mjs'

await checkZugRegion()
const audit = JSON.parse(await readFile('data/zug-study-audit.json','utf8'))
const count = n => n.toLocaleString('en-CH')
const percent = (a,b) => `${(100*a/b).toFixed(2)}%`
const table = (headers,rows) => [`| ${headers.join(' | ')} |`,`| ${headers.map(()=>'---').join(' | ')} |`,...rows.map(row=>`| ${row.join(' | ')} |`)].join('\n')
const days = audit.days
const source = audit.catalogue
const lines = [...new Set(audit.sourceInventory.map(s=>s.line))].sort((a,b)=>Number(a)-Number(b))
const text = `# Zug canton: source adapter, regional feed and admission audit

Inventory and source review: **8 September 2026**. Start point: [Swiss transit source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#zg).

**The annual timetable inventory covers the whole canton. The regional bus and rail feed has partial geometry coverage.** It admits only complete directed stop patterns passing the numerical source checks, on Friday **4 September 2026** and Sunday **6 September 2026**. Admission is not certification of a current 2026 alignment, one-way street, running track or temporary diversion.

## Scope and evidence

All **${audit.annualRouteRecords} annual route records**, **${audit.annualAgencies} feed agencies**, **${count(audit.scope.annualScopedTripRecords)} annual trip records** and all **11 municipalities** are inventoried. The census streams **${count(audit.scope.annualStopTimeRows)} national stop-time rows**, without an operator whitelist. It selects every annual trip with at least one stop inside the complete official Zug multipolygon, then retains the whole selected trip including out-of-canton and foreign termini. No-stop through traffic is outside this passenger-service scope.

The polygon contains **${audit.scope.cantonStopRecords} GTFS stop records**, of which **${audit.scope.calledCantonStopRecords}** have annual calls. These are source records, including platform/station identities, not a count of unique physical stations. Annual route-to-canton-stop membership is retained even for routes inactive on both test dates. A census of this feed does not establish coverage of private, unrepresented or demand-responsive services.

- [Machine audit](../data/zug-study-audit.json): every route, source feature/line membership, municipality, directed pattern, pair, exclusion, geometry hash, operator/mode denominator and daily occurrence count.
- [Pinned extracted timetable](../data/zug-timetable.json.gz): complete calls and times for both civil days, annual route membership and source hashes.
- [Source catalogue](../data/zug-sources/sources.json), [preserved acquisition records](../data/zug-sources/acquisition.json), [policy and identity crosswalk](../data/zug-policy.json).
- [Friday feed](../public/data/zug-region/2026-09-04/zug-region-day-manifest.json), [Sunday feed](../public/data/zug-region/2026-09-06/zug-region-day-manifest.json). Each has twelve two-hour chunks and a 06:45–08:45 morning snapshot. The existing compact network schema is used. UI selection, scheduled refresh and deployment are not part of these artifacts.

## Dates, attribution and source reconciliation

The national timetable is release **${audit.feed.feed_version}**, valid **${audit.feed.feed_start_date}–${audit.feed.feed_end_date}**, SHA-256 **${audit.sourceHashes.archive}**. [Official GTFS dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [pinned archive](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip), [timetable terms](https://opentransportdata.swiss/en/terms-of-use/). Credit: **SBB / opentransportdata.swiss**. Gleislicht publishes the derived results under its own authorship. The feed has no shapes.txt.

The [official Buslinien archive](https://services.geo.zg.ch/datarepo/Buslinien/data.zip) is preserved as [buslinien.zip](../data/zug-sources/buslinien.zip), SHA-256 **${source.sources.find(s=>s.file==='buslinien.zip').sha256}**. It contains **175 LineStrings**, **${lines.length} distinct line labels** and **${audit.sourceInventory.length} feature/line memberships**. Comma-separated labels identify shared segments, not complete directed route shapes. The archive's HTTP Last-Modified is **${source.archiveLastModified}**; the GeoPackage's internal last_change is **${source.geopackageLastChange}**. Neither is a proven 2026 alignment date.

The complete current WFS tooltip layer and its independent hits count both contain **175** records. Every t_id, exact line-label string, vertex count and ordered LV95 coordinate matches the archive within **1 mm** (maximum ordinate difference **${source.comparison.maximumCoordinateDeltaMetres.toFixed(9)} m**). WFS feature IDs differ from GeoPackage row IDs, so they are not used as a crosswalk. Raw [WFS](../data/zug-sources/wfs.gml), [hits](../data/zug-sources/wfs-hits.xml) and [capabilities](../data/zug-sources/capabilities.xml) are retained with retrieval times and hashes. The current WFS repeats old geometry; its retrieval date is not a new vintage. Planning/vehicle-length layers are not mixed into this source.

Credit for bus geometry: **Quelle: GIS Kanton Zug**. The [official terms](https://zg.ch/de/planen-bauen/geoinformation/geoinformationen-nutzen/nutzungsbedingungen) permit commercial and noncommercial use with source credit; no generic Creative Commons licence is assigned. [Terms snapshot](../data/zug-sources/terms.html). Canton boundary: current official swisstopo feature 9, retained losslessly as returned; its API attributes do not declare an edition. Municipal polygons: **swissBOUNDARIES3D 2026-01**, all eleven original GeoPackage rows retained in [municipality-rows.json.gz](../data/zug-sources/municipality-rows.json.gz). Credit: **© swisstopo**, [terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices).

The [ZVB 2026 line directory](https://www.zvb.ch/fahrplan/fahrplan-zvb-2026/) is retained for identity review. GTFS agency 839 maps to the explicitly listed ZVB source line labels; 801 maps only to PostAuto 73, 110 and 280. There is no prefix/substring matching, agency-wide geometry admission or automatic renumbering. Historic source line **528** has no annual Zug-calling GTFS route and is not silently assigned to 525/526.

## Federal rail expansion

The [preserved federal rail source](../data/zug-rail-sources/source.json) adds **529 Friday** and **431 Sunday** complete SBB/SOB trips to the bus baseline. Source credit: **© Federal Office of Transport (FOT)**. The source collection links [attribution terms](https://opendata.swiss/terms-of-use/#terms_by); its literal STAC licence field is retained as proprietary, without substituting a Creative Commons licence. The [catalogue](../data/zug-rail-sources/catalogue.json), [collection metadata](../data/zug-rail-sources/collection.json) and [original compressed XTF](../data/zug-rail-sources/network.xtf.gz) are preserved. [Official federal dataset](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz).

The XML SHA-256 is **${audit.railSource.sha256}**, verified against the published multihash. Catalogue datetime is **${audit.railSource.catalogueDate}**, asset-updated timestamp **${audit.railSource.assetUpdated}**, catalogue checked **${audit.railSource.catalogueCheckedOn}**. All **3,424 source segments** carry an internal Stand of **2021-07-06**. These timestamps do not prove September 2026 validity. The audit records every segment's gauge, infrastructure operator, validity fields, endpoint attachment and admission disposition: **1,814** segments enter the candidate graph, **1,604** fail standard-gauge selection and **6** exceed the source topology attachment limit. Funiculars are not in this dataset.

The adapter admits only explicitly inventoried SBB/SOB route identities and **mm1435** source segments. It uses exact Swiss operating-point numbers, rejecting missing/ambiguous identities; there is no name or nearest-station fallback. Source endpoints connect through declared node references with attachments at most **120 m**; GTFS stations may attach to their exact operating point within **350 m**. Source linework is simplified at **5 m in LV95** and transformed by the existing parser to six-decimal WGS84 coordinates. These operating-point and station connectors are inferred geometry.

Each adjacent-call search blocks all other known scheduled operating points in the full pattern, preventing a shortcut through a later or earlier call. The detour limit is **max(3,000 m, 4.5 × direct distance)**, including station attachments. Each accepted pair retains ordered source segment IDs and node references. Rail contexts with different complete stop sequences remain distinct in the cache and audit. This validates numerical corridor continuity and stop order, not actual running-track choice, freight/passenger access rights, temporary diversions or observed movement. International trip calls are retained in full even when their missing foreign geometry causes exclusion.

## Neighbouring official bus source

Five exact-identity Luzern bus features were evaluated against the entire Zug timetable scope. The [supplement catalogue](../data/zug-luzern-sources/sources.json) preserves original URL, retrieval time and SHA-256 for the complete **114-feature** upstream page, its independent ID list, the operator enumeration, metadata and terms. The five selected features are checked byte-for-value against that page; no geometry edits or new connections are introduced. Source vintage is **26 May 2026**, all five FP_JAHR values are **2026**, and acquisition was **8 September 2026**. This is a reviewed source vintage, not a guarantee that every September diversion is represented.

Credit: **© rawi Kanton Luzern; © Verkehrsverbund Luzern**, **Open-By**. [Official product metadata](https://daten.geo.lu.ch/produkt/oevxxxxx_col_v5), [terms](https://geoportal.lu.ch/Nutzungsbedingungen). The service performs EPSG:2056 to WGS84 conversion; its returned GeoJSON coordinates are retained without simplification. Local TU codes 11/3/4 map explicitly to GTFS agencies 820/801/839; TU=11 must not be mistaken for SBB agency 11.

Successful original Zug pairs remain unchanged. Only a failed pair can use the entire adjacent-call path of its exact mapped Luzern operator/line. The tolerance remains 120 m; source graphs are never spliced at a midpoint or joined to fill a gap. Source changes occur only at preserved GTFS stops, whose coordinates anchor both paths. Every attempt retains its original Zug failure and the supplemental result, including failures. This adds **156 Friday trips** and **94 Sunday trips** to the preceding bus/rail release (2,767 / 1,680 trips).

${table(['Source feature','Agency / line','Friday added trips','Sunday added trips','Disposition'],audit.supplementInventory.map(s=>[s.feature,`${s.agencyId} / ${s.line}`,...s.days.map(d=>d.admittedTrips),s.days.some(d=>d.admittedTrips)?'complete trips admitted':'attempted; no complete trip admitted']))}

For 73, the Luzern corridor supplies the missing Luzern end while existing Zug geometry supplies Rotkreuz stop pairs that fail projection against Luzern alone. For 110, the supplement supplies the Hochdorf station pair. Line 23 has no original Zug line identity and uses the complete mapped Luzern route. Line 653 still fails around Hohle Gasse/Ebnet, with additional weekday Plaza/station gaps. N73 remains disconnected around Luzernerhof/Brüelstrasse. Matched pairs from these excluded patterns are counted as partial geometry coverage, not admitted trips. Source-feature, route, per-day attempted/matched pair and occurrence totals are retained in supplementInventory.

## Geometry and directed stop-pattern method

Decode the original EPSG:2056 GeoPackage with strict geometry/schema checks. Transform XY with the existing swisstopo approximate LV95-to-WGS84 polynomial at full floating precision; no simplification. Graph identity uses seven decimal places. Shared source vertices connect only within the exact mapped line. Geometric crossings do not create junctions. The source has no direction attribute: shortest connected source corridors are oriented by the ordered GTFS calls and remain inferred alignments.

Every pair must pass **120 m** maximum stop projection, connectivity, and a detour bound of **max(1,200 m, 4.5 × direct distance)**. Alternative source-part projections may add at most **5 m** to the nearest projection. Paths include the short stop-to-source projection connectors; those are inferred access geometry, not measured trajectories. Collapsed paths fail. Full repeated-stop sequences, branches, direction_id and pickup/drop-off rules form distinct patterns. A failure in any pair excludes the entire pattern. Prior-arrangement pickup/drop-off codes 2/3 also exclude a pattern from unconditional animation; none occur in these fixtures.

Three explicitly reviewed source discontinuities are joined by short inferred connectors, pinned to exact source feature IDs and vertex indices. Each includes an existing source endpoint, stays within identical line memberships, connects distinct original components and is less than one metre. No general nearest-neighbour gap filling is enabled.

${table(['Join','Lines','Length','Source vertices'],audit.policy.topologyJoins.joins.map(j=>[j.id,j.lines.join(', '),`${j.metres.toFixed(3)} m`,j.vertices.map(v=>`feature ${v.featureId} / vertex ${v.index}`).join(' → ')]))}

The audit and feed metadata retain the join policy; affected pairs carry geometryRepairIds and inferredJoinMetres. **${days[0].admittedTripsUsingRepair} Friday trips** and **${days[1].admittedTripsUsingRepair} Sunday trips** use these connectors. Their small lengths do not establish lawful street direction. The initial bus-only release admitted 1,668 Friday trips and 1,009 Sunday trips without these connectors; the joins raised its bus admission to 2,238 and 1,249. The subsequent rail expansion is counted separately below.

## Weekday and Sunday results

Calendar exceptions and preceding service-day spillover are applied. The civil day is 00:00–24:00 Europe/Zurich. Source identities and negative carry-in times are preserved; no source call is trimmed. Friday after-midnight night departures belonging to Friday service fall on Saturday's civil day; Sunday's N1–N6 and N73 departures include Saturday service carry-in. Calendar active-source counts therefore differ from civil-day counts. Frequency templates would retain source-anchored headway semantics; both selected fixtures contain zero representative headway trips.

${table(['Measure',...days.map(d=>d.date)], [
  ['Civil-day trips',...days.map(d=>count(d.trips))],
  ['Admitted / excluded trips',...days.map(d=>`${count(d.admittedTrips)} / ${count(d.excludedTrips)}`)],
  ['Admitted / all directed patterns',...days.map(d=>`${d.admittedPatterns} / ${d.patterns}`)],
  ['Matched / all routing-context pairs',...days.map(d=>`${d.matchedDirectedPairs} / ${d.directedPairs} (${percent(d.matchedDirectedPairs,d.directedPairs)})`)],
  ['Fully matched / all unique directed route-stop pairs',...days.map(d=>`${d.fullyMatchedUniqueDirectedRouteStopPairs} / ${d.uniqueDirectedRouteStopPairs}`)],
  ['Matched / all scheduled segment occurrences',...days.map(d=>`${count(d.matchedSegmentOccurrences)} / ${count(d.segmentOccurrences)} (${percent(d.matchedSegmentOccurrences,d.segmentOccurrences)})`)],
  ['All / admitted carry-in trips',...days.map(d=>`${d.carryInTrips} / ${d.admittedCarryInTrips}`)],
])}

Rail pair routing depends on the complete ordered pattern, so days[].directedPairs and group pair counts include pattern context for rail. Bus pairs retain the route/from/to key. The separate uniqueDirectedRouteStopPairs count collapses context; fullyMatchedUniqueDirectedRouteStopPairs requires success in every tested context. These denominators must not be confused when comparing the original bus-only release with this expansion. Matched occurrences include good pairs on ultimately excluded patterns. They are not a percentage of admitted full trips. All modes and excluded operators stay in the denominator. Every emitted trip has a non-null, correctly oriented path for every adjacent source call.

${table(['Date','Agency / mode','Trips admitted / all','Patterns admitted / all','Pairs matched / all','Occurrences matched / all'],days.flatMap(d=>d.groups.map(g=>[d.date,`${g.id} — ${g.agency}`,`${g.admittedTrips} / ${g.trips}`,`${g.admittedPatterns} / ${g.patterns}`,`${g.matchedDirectedPairs} / ${g.directedPairs}`,`${g.matchedSegmentOccurrences} / ${g.segmentOccurrences}`])))}

Failures are also broken down by operator/mode, reason, unique directed route-stop pair, scheduled occurrence, affected pattern and trip in days[].groups[].failures. A trip can have several reasons; affected-trip counts across reasons must not be summed.

## All municipalities

Counts overlap: a whole trip or annual route can serve several municipalities. These rows must not be summed into a canton total. Stop counts include uncalled source stop records. Source polygons retain holes and all parts; all 945 canton stop records have municipal membership.

${table(['Municipality','Source stops','Annual route records','Friday admitted / all trips','Sunday admitted / all trips'],audit.municipalityReview.map(m=>[m.name,m.cantonStopIds.length,m.annualRouteIds.length,...m.days.map(d=>`${d.admittedTrips} / ${d.trips}`)]))}

Neuheim has no admitted Sunday trip: current 631 patterns extend beyond the old line source and N2 has no mapped geometry. This is an explicit coverage gap, not absence of service.

## Complete annual route admission/exclusion inventory

Each row is an exact GTFS route_id, not a unique passenger-facing line. Counts are admitted/all civil-day trips; “inactive” means no trip overlaps that day, not nonexistent or excluded from the annual census.

${table(['GTFS route ID','Agency','Line / mode','Annual trips','Friday','Sunday','Failure reasons'],audit.inventory.map(r=>[r.routeId,r.agencyId,`${r.line} / ${r.mode}`,r.annualTripRecords,...r.days.map(d=>d.trips?`${d.admittedTrips}/${d.trips}`:'inactive'),[...new Set(r.days.flatMap(d=>d.reasons))].join(', ')||'—']))}

Principal exclusions: complete international EC patterns at Chiasso–Como S. Giovanni and IR75 patterns at Kreuzlingen–Konstanz have no exact foreign operating-point match in the preserved rail source; S26/RE6 patterns using Däniken SO–Schönenwerd SO fail source connectivity/detour/stop-order checks. Their complete trips remain excluded. No reviewed funicular geometry for Zugerbergbahn; no reviewed water routes for Zugersee/Ägerisee; no mapped source lines for 525, 526, 619, 627, 652, replacement buses or ZVB night services; attempted PostAuto N73 still has disconnected geometry. Known source identity alone does not admit incomplete linework: 604's Grienbach stop projects about 155 m away; 609's Rothenthurm extension about 2.5 km; Neuheim branches exceed 1 km; 648's Knonau variant exceeds 4 km; the original Zug export lacks PostAuto 73's Luzern end and 110's Hochdorf station pair, now supplied by the exact Luzern supplement. Walchwil 626 has a collapsed projected pair. Full pair details and stop names are in the machine audit.

## Every source line label

${table(['Source label','Segment memberships','Mapped agencies','Annual matched route IDs'],lines.map(line=>{
  const items=audit.sourceInventory.filter(s=>s.line===line)
  return [line,items.length,[...new Set(items.flatMap(s=>s.agencyIds??[]))].join(', ')||'unmapped',[...new Set(items.flatMap(s=>s.gtfsRoutes))].join(', ')||'none']
}))}

## Reproduction and verification

The durable source bytes and extracted two-day timetable are in the repository. No live service or credentials are needed for offline reproduction. Refreshing a source is a new review: preserve new bytes, reconcile versions, recheck terms and identity mapping, and update the pinned policy deliberately.

\`\`\`sh
# Decode and reconcile the preserved archive and WFS; no network.
npm run data:zug:sources

# Optional full national re-census (requires the pinned archive).
npm run data:zug:census -- /private/tmp/GTFS_FP2026_20260902.zip \\
  data/zug-sources/boundary.json data/zug-timetable.json.gz

npm run data:zug
npm run data:zug:check
npm run data:zug:report
python3 -m unittest discover -s scripts -p test_prepare_zug_sources.py
npx vitest run scripts/zug-region.test.mjs scripts/zug-bus-supplement.test.mjs scripts/zug-rail-geometry.test.mjs scripts/luzern-region.test.mjs \\
  scripts/civil-day.test.mjs scripts/gtfs-frequencies.test.mjs
\`\`\`

The checker verifies source/policy/timetable hashes, annual census totals, all directed patterns including exclusions, all rematched pair hashes, source-specific bus alternatives and rail pattern contexts, unique/context pair totals, operator and route aggregates, source call/timing replay, carry-in identities, path endpoints, morning membership and every chunk hash/length. Tests reject duplicate/truncated WFS responses, changed labels/coordinates, wrong operator joins, substring matching, arbitrary gaps/crossings, unreviewed topology joins and reversed or missing paths.

Remaining scope limits: two September dates do not validate winter, holiday, summer boat or all seasonal/engineering patterns. The old line geometry has no proven 2026 validity and has not been certified against street-direction restrictions or diversions. The feed is scheduled interpolation with explicit inferred projection/topology pieces. It is not observed vehicle movement. Full cantonal motion coverage remains incomplete.
`
await writeFile('docs/ZUG-STUDY.md',text)
console.log('Wrote docs/ZUG-STUDY.md after successful source and artifact validation')
