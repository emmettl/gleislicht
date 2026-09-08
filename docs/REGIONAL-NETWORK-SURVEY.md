# Regional network source and feasibility survey

**National follow-up:** the [Swiss transit source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md) now covers all 26 cantons, all 473 agency records in the pinned feed, 90 endpoint checks and the complete realtime coverage catalogue. It adds downloaded AG/ZG/SO geometry, an inspected Bern GeoPackage and verified Fribourg bus samples. Use that inventory for current source status; the eight-region sample and its original measurements below remain a historical baseline.

Surveyed **8 September 2026**. Lausanne is already being tackled separately; see [its kickoff audit](LAUSANNE-STUDY.md). Zürich/ZVV, Genève/TPG and the existing Lake Lucerne–Rigi composition are the reuse baseline, not new candidates.

**Recommended next regional studies: Basel/TNW, Bern, then Luzern.** All three have official local line geometry as well as the shared Swiss timetable. Basel offers the strongest new cross-border urban composition; Bern offers a compact interchange-led network; Luzern can connect the existing lake-and-mountain study to everyday urban transport. St.Gallen is the next geometry-backed candidate. Ticino and Graubünden are worthwhile, but should begin with smaller areas while bus geometry and boundary coverage are resolved.

This is a source survey and engineering assessment, not an implementation or a claim that geometry is production-ready. Rankings and proposed boundaries below are our judgement. Live source checks and the older reproducible timetable fixture are dated separately.

**Basel follow-up:** the [integrated core study](BASEL-CORE.md) includes complete BVB/BLT local journeys, bounded Swiss-side regional rail and preceding-day services. Tuesday/Sunday contain 8,808/6,163 trip records; all five geometry groups pass 95% and payload budgets pass. The app now provides Basel selection, lazy full-day loading, translated labels, search/sharing, attribution and validated dated recovery. Desktop and iPhone checks pass. The [geometry repair review](BASEL-GEOMETRY-REPAIRS.md) adds 1,406/806 Tuesday/Sunday movements across the initial and follow-up repairs, bringing all trams, regional rail and BVB buses to 100% geometry while preserving all prior accepted paths. The release record documents exact rail boundaries, dated tram topology, a rejected bus shortcut and the sole remaining EV11 Freilager–Schaulager geometry gap; this remains a schematic core rather than complete TNW. The [earlier local audit](BASEL-STUDY.md) retains the official-source acquisition findings and service-day baseline. These measured audits take precedence over the preliminary readiness estimates here.

## Shortlist

“High” means a credible scheduled first study using the existing pipeline, subject to a measured geometry join. It does not mean complete network coverage has been demonstrated. Effort is relative adapter/validation work, not an elapsed-time estimate.

| Priority | Candidate and first scope | Feasibility / effort | Geometry evidence | Main unresolved work |
| --- | --- | --- | --- | --- |
| 1 | **Basel / TNW core** — BVB + BLT, regional rail, retained cross-border branches | High / medium | Basel WFS tram/bus samples downloaded; BL advertises TNW-wide line files | Date-specific diversions, BL extension, French/German termini and directions |
| 2 | **Bern and inner Libero** — BERNMOBIL + RBS, scoped BLS/SBB/PostAuto feeders | High / medium | Cantonal OEVTP line download works; documented operator/line fields | Directed path join and an explicit regional membership rule |
| 3 | **Luzern agglomeration** — vbl + rail and selected regional bus feeders | High / medium | Current cantonal bus GeoJSON sample and feature count verified | Line variants, feeder selection, separating urban scope from full Passepartout |
| 4 | **St.Gallen and nearby Appenzell approaches** — VBSG, AB, regional rail/feeders | Medium–high / medium | Official annual line dataset and download location identified | Undirected geometry; cantonal subsidy scope does not define all OSTWIND |
| 5 | **Ticino / Arcobaleno** — start with Luganese, then Bellinzona/Locarnese | Medium / higher | National rail geometry; cantonal geoservices lead, no local bus line export verified | Bus paths, operator families, Italian extensions and lake geometry |
| 6 | **Graubünden** — Chur–Landquart first; Engadin as a separate study | High for rail-led pilot; medium for full multimodal / higher | Existing rail and PostBus infrastructure; local bus line source unresolved | Alpine paths, seasonal dates, non-PostAuto buses and Tirano coverage |
| 7 | **Fribourg / TPF** — Fribourg agglomeration, then Bulle/RER connection | Medium / medium–higher | Timetable operators verified; official network plans available | Bus geometry and separate TPF rail/bus/funicular agency IDs |
| 8 | **Neuchâtel / transN** — littoral first; upper canton later | Medium / medium–higher | Timetable operators verified; official network plans and rail documentation | Several agency IDs, Littorail classification, local bus/funicular paths |

## Shared sources and what the current pipeline can reuse

The [official Swiss GTFS](https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/) supplies timetables, agencies, route types, platform coordinates, service calendars/exceptions and frequency templates. The inspected archive is **feed 20260902**, valid **14 December 2025–12 December 2026**; the counts below use **Friday 4 September 2026**. Its ZIP has no `shapes.txt`. This fixture is not a claim about today's operations or the newer Lausanne fixture.

Use the [current timetable resource](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020/permalink) for acquisition, but pin the resolved archive, feed version and SHA-256 for every build. Static data are publicly downloadable; the [platform terms](https://opentransportdata.swiss/en/terms-of-use/) require source attribution. Keep attribution to `opentransportdata.swiss` in the study and provenance.

Existing project components already provide:

- **Rail:** the FOT `ch.bav.schienennetz` graph and offline path matcher. Infrastructure paths are inferred between timetable stops; a successful match does not prove the correct track, platform, tunnel or border extension. See [DATA-PIPELINE.md](DATA-PIPELINE.md#geometry-model-and-limits).
- **Official local paths:** ZVV supplies a shape-feed join; Genève supplies the closer precedent for the new cantonal line graphs. Match by mode, operator, line and directed stop pair, with distance/detour checks. Do not assume display line numbers are globally unique.
- **Road fallback:** the existing [PostBus/pfaedle workflow](POSTBUS-ROAD-GEOMETRY.md) can inform matching other buses to OpenStreetMap. Its reported PostBus coverage does not transfer to another operator. Reuse paths only when route identity and the complete ordered platform/coordinate sequence agree; new patterns require new matching and review. Retain OSM attribution and the workflow's ODbL requirements.
- **Rendering and delivery:** separate regional artifacts, full-day two-hour chunks, lazy loading, search, operator labels, regional corridor aggregation and four interface languages. Existing regional gzip ceilings are 650 KiB manifest, 450 KiB movement chunk and 1,600 KiB morning artifact; see [EXPLORATION.md](EXPLORATION.md#automatic-publication). These are limits to measure against, not forecasts for this shortlist.
- **Frequency services:** exact and illustrative headway semantics already exist. Preserve template provenance and disclosures; do not turn every template into one scheduled vehicle. See [FREQUENCY-SERVICES.md](FREQUENCY-SERVICES.md).

A regional membership rule must distinguish the tariff association, an operator's footprint and a camera crop. SBB and PostAuto cannot be admitted nationally merely because they serve the chosen region. Conversely, do not clip an admitted local route at a canton or national boundary. Define admitted routes and terminal policy first, then derive bounds.

## 1. Basel / TNW

**First study:** Basel SBB–Badischer Bahnhof–city tram network, BVB and BLT local services, plus a scoped rail backbone. Keep relevant branches toward Saint-Louis, Weil am Rhein and Rodersdorf. Expand into wider TNW only after auditing the additional bus operators and rail footprint. BVB's [official network page](https://www.bvb.ch/de/fahrplan/liniennetz/) confirms its international extent and currently distinguishes a temporary network valid **7 September–23 October 2026**. Geometry vintage therefore matters even within one timetable year.

**Usable sources:** Basel-Stadt's [line-network model](https://models.geo.bs.ch/Modellbeschreibungen/LN_LiniennetzOeV_KGDM_V1_0.pdf) documents WFS layers `ms:LN_Tramlinie`, `ms:LN_Buslinie` and `ms:LN_SBahnLinie`, plus stops and night services. [WFS capabilities](https://wfs.geo.bs.ch/?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities) and three-feature tram/bus GeoJSON requests returned HTTP 200 without credentials. Separate `resultType=hits` requests reported **46 tram features and 86 bus features**. These are GIS objects, not counts of distinct lines or active services. Samples contain `ln_liniennr`, `ln_tu`, `ln_strecke` and `ln_angebot`; both LineString and MultiLineString occur.

Basel-Landschaft advertises a [TNW-wide rail/tram/bus Shapefile product](https://www.baselland.ch/politik-und-behorden/direktionen/volkswirtschafts-und-gesundheitsdirektion/amt-fur-geoinformation/geoportal/geodaten/verkehr), with free acquisition through GeoShop. That broader export was not downloaded here. BS geometry must not be assumed to replace it.

**Access and reuse:** BS sample services need no key. Its [March 2026 notice](https://www.bs.ch/news/2026-anpassung-der-kgeoiv) changes the general attribution rule for public geodata and allows dataset-specific exceptions. Preserve publisher attribution regardless and record the selected layer's terms when freezing a build. BL's public/free access classification is verified; its detailed export terms and update date remain to be captured.

**Integration decision:** use the Genève line-graph approach, seeded by `(operator, line, mode)`. Audit loops, shared tracks, opposite-direction streets and national border termini. Preserve BLT line 19's feed classification rather than treating every BLT service as ordinary national rail. Do not add complete French/German networks in the first increment; if through-service data prove incomplete, identify a licensed neighbouring feed and its duplicate-service policy separately.

**Next concrete check:** join all active BVB/BLT patterns on one weekday, report coverage per line and direction, and inspect border branches plus temporary diversions. Only then choose between a Basel core release and a wider TNW study.

## 2. Bern / Libero

**First study:** Bern HB, BERNMOBIL tram/bus, RBS rail/bus and selected BLS/SBB/PostAuto feeders. Use the inner network as the first composition; a whole-canton crop would also pull in substantial Oberland and Jura services.

**Usable sources:** Bern's [OEVTP metadata](https://www.geo2.apps.be.ch/de/pdf/geoproduct/OEVTP) describes rail, bus, tram, night, cableway and boat layers, stops and Libero zones. It covers an extended canton footprint, is maintained annually, and records **1 January 2026** as the update date. Shapefile, GeoPackage and individual GeoParquet downloads are advertised. The [line GeoParquet](https://geofiles.be.ch/geoportal/pub/download/OEVTP/oevtp_linie.parquet) downloaded successfully: **1,887,084 bytes**, with Parquet file signatures at both ends. This survey did not decode its geometry or measure its row count.

The [documented schema](https://geofiles.be.ch/geoportal/pub/deltachecker/OEVTP_MODEL.pdf) contains `LINIENCODE`, `LINIENNR`, `TUCODE`, `TUNAME`, `KUBUNR`, mode fields and `LIBERO`; geometry uses LV95. These are strong join candidates, not evidence of a direct GTFS ID match. The Libero zone polygons help define scope but do not by themselves enumerate every admitted trip.

**Access and reuse:** direct download needs no key; metadata permits internet publication and reuse with a visible source credit to the cantonal public transport office. The opendata.swiss CKAN API returned HTTP 403 during probing, while the publisher's direct file worked. This is a catalogue-access limitation, not unavailable Bern data. Archive an accepted source vintage locally; older editions may require a paid order.

**Integration decision:** adapt a line-graph join, reproject LV95 to WGS84 and reconcile the source's operator codes with GTFS. Explicitly include BERNMOBIL `827`, RBS rail `88` and RBS bus `850`; add regional rail and PostAuto by scoped routes. Audit the Bern station approaches and tram/rail distinction at Worb. Treat Marzili/Matte as optional separate vertical-mode work.

**Next concrete check:** decode the line file, inspect both directions of each urban tram line and a sample of RBS/BLS feeders, then measure all active local stop-pair coverage. Bern has a particularly good prospect for a reusable cantonal geometry adapter.

## 3. Luzern / central Switzerland

**First study:** Luzern HB–Emmen–Kriens urban network with selected rail and regional bus feeders. Add a clear handoff to the existing Rigi study. The first scope should not claim all Passepartout or every Lake Lucerne service.

**Usable sources:** the [cantonal transport collection, version 5](https://daten.geo.lu.ch/produkt/oevxxxxx_col_v5) includes bus, rail and boat line geometry and stops. Bus coverage is defined as lines with at least one section in the canton. The bus layer is updated annually, currently **26 May 2026**, and exposes `BUL_ROUTE`, `FP_JAHR`, `LINIENNR`, `KURSBUCHNR` and coded operator `TU`. GeoPackage/Shapefile downloads, WFS, ArcGIS and STAC access are advertised.

The [ArcGIS service](https://public.geo.lu.ch/ogd/rest/services/managed/OEVXXXXX_COL_V5_MP/MapServer?f=pjson) returned layer metadata, a bus count of **114 features**, and a three-feature WGS84 GeoJSON sample. Sample line 282 has `FP_JAHR=2026` and operator code `3` (PostAuto in the catalogue). Layer IDs observed were bus `8`, rail `253`, ship `10`, stops `7` and stop platforms `0`; discover these from metadata on refresh rather than assuming IDs will never change.

**Access and reuse:** the collection is **Open-By**. [Luzern's terms](https://geoportal.lu.ch/Nutzungsbedingungen) permit commercial and non-commercial use with source attribution; the service credits Verkehrsverbund Luzern. No API key was needed for the probes.

**Integration decision:** use the official bus paths before inferred roads. Reconcile route labels and operator enumerations, handle branches and validate direction-specific approaches. Keep SBB, Zentralbahn, BLS and SOB selection bounded. Boat line graphics still need checking against water, stops and timetable patterns; their availability does not establish navigable paths. Retain the existing Rigi provenance when composing the two studies.

**Next concrete check:** join vbl plus a few different regional operators, assess all patterns and inspect terminal loops. This is also a practical test of whether Bern and Luzern can share the same normalised line-geometry adapter.

## 4. St.Gallen / Appenzell approaches

**First study:** St.Gallen HB, VBSG, Appenzeller Bahnen approaches and selected Thurbo/PostAuto/regional buses. A later OSTWIND expansion needs a separate multi-canton boundary and source audit.

**Usable sources:** St.Gallen publishes [Abgeltungsberechtigte Linien](https://www.sg.ch/bauen/geoinformation/aktuelles.html), introduced with the December 2025 timetable. The [technical description](https://services.geo.sg.ch/wss/service/metadaten/guest/datenbeschreibung/AOEV_AL_OEV_Datenbeschreibung.pdf) specifies annual updating, LV95, Shapefile/INTERLIS 2 and operator/line information. It explicitly says the geometry does **not encode travel direction**. Coverage is subsidised lines in St.Gallen and adjacent areas; that is not a completeness guarantee for VBSG, Appenzell or OSTWIND.

The publisher links a [public download folder](https://data.geo.sg.ch/s/RMgBWPofwkaCawf?dir=/Geodaten/3%20-%20Bev%C3%B6lkerung%20und%20Wirtschaft/P%20-%20Verkehr/AbgeltungsberechtigteLinien). Its location was verified on the publisher page; archive contents were not fetched. Keep `AL_OEV` distinct from the related line-economics dataset `KL_OEV`.

**Access and reuse:** the announcement says downloads are free. Follow the [cantonal use terms](https://www.sg.ch/bauen/geoinformation/datenbezug/agb.html), including the documented source/copyright credit. Pin the downloaded edition; unattended stable-URL acquisition remains untested.

**Integration decision:** moderate confidence until the file proves local coverage. Match stops onto each undirected line, then review one-way bus streets and shared AB urban approaches. Start with national rail and the matched local subset; record missing operators/routes explicitly.

**Next concrete check:** retrieve the archive, reconcile VBSG/AB routes against it, and report missing operators and both-direction coverage before proposing an OSTWIND label.

## 5. Ticino / Arcobaleno

**First study:** Luganese, with TPL buses, Lugano–Ponte Tresa and scoped TILO/SBB services. Bellinzona–Locarno and the Centovalli make a second increment; defer boats and summit systems unless their geometry is independently reviewed.

**Sources:** the timetable sample verifies TPL, its separate funicular agency, FLP, FART rail/bus and ARL records. [Arcobaleno's 2026 timetable notes](https://arcobaleno.ch/it/cambio-orario) provide a useful boundary/line check, including Italian TILO extensions. [Geoportale Ticino](https://www4.ti.ch/dt/sg/sai/ugeo/temi/geoportale-ticino/geoportale/geoservizi) publishes WFS access infrastructure, but this survey did **not** establish a current, licensed local bus line dataset or operator GTFS containing shapes. A portal offering WFS is not evidence that a particular transport layer is available.

**Feasibility:** rail-led motion is practical using the existing timetable and infrastructure matcher; credible urban bus paths need an official export or a measured OSM matching pass. TPL is `955` and its funicular is `3955`; FLP is `47`; FART rail/bus are `49`/`817`; ARL is `858`. This is not a complete Arcobaleno operator list. TILO must be selected through actual route/trip records, not an assumed single agency named “TILO”.

**Access and reuse:** the Swiss baseline is ready; permissions, vintage and automated access for local geometry remain unresolved. Operator network maps are references, not an implied geometry redistribution licence.

**Next concrete check:** create a Luganese route/stop inventory including foreign termini, then compare official geometry availability with an offline road-matching pilot. Review border rail gaps before promising through motion into Italy. Lake Lugano navigation and mountain services remain separate geometry tasks.

## 6. Graubünden

**First study:** Chur–Landquart–Rhine valley with RhB, CHUR BUS and selected PostAuto feeders. Keep Engadin as an independently framed later study rather than making one camera cover the whole canton.

**Sources:** RhB `72`, Chur bus `766` and Engadin bus `815` are present in the fixture. The project's national rail and PostBus studies supply the initial data architecture. PostAuto's [official regional network plans](https://www.postauto.ch/de/fahrplan-und-netz/liniennetz) separate Chur/Landquart, Prättigau, Surselva, Engadin and other territories, useful for defining manageable compositions. [GeoGR's catalogue](https://geogr.ch/geodaten) and the [cantonal data-access page](https://geo.gr.ch/geodaten/geodatenbezug) are further discovery routes; a complete local bus line export was not verified here.

**Feasibility:** strong for a rail-led pilot, more work for a complete regional system. An inferred rail path needs inspection at loops, tunnels and stacked alignments. Existing PostBus paths do not cover CHUR BUS or Engadin bus automatically. Seasonal mountain and pass services require dated summer/winter inventories, while RhB extensions toward Tirano need explicit foreign geometry checks.

**Access and reuse:** use existing national/OSM provenance for the pilot; any additional GeoGR layer needs its own dataset terms and dated export. A general free-download portal does not establish a particular layer's suitability.

**Next concrete check:** audit the Chur–Landquart local bus patterns and rail approaches against the existing paths, then build a summer/weekend comparison inventory. Add terrain after the planar paths are credible; route-type alone must not classify every RhB train as cogwheel.

## 7. Fribourg / TPF

**First study:** Fribourg agglomeration and its RER approaches, then the Bulle–Romont connection. TPF publishes [2026 network plans](https://www.tpf.ch/fr/horaires-et-reseaux/plans-du-reseau/reseaux-tpf) for these distinct scopes; use them to review membership and interchange structure.

**Sources and limits:** timetable identities are split between rail `53`, **bus `834` (Service d'automobiles TPF)** and funicular `3004`. Searching only for an agency named “Transports publics fribourgeois” misses the bus network. The original survey did not find a local bus export; the [national follow-up](SWISS-TRANSIT-SOURCE-INVENTORY.md#fr) now verifies an ArcGIS line layer with 128 features and actual TPF bus GeoJSON samples. Full acquisition, vintage, reuse terms and directed timetable joins remain unresolved.

**Feasibility / next check:** evaluate the newly found official line source before selecting the geometry adapter. Inventory the three agency families, match urban bus patterns, and inspect station loops and bridge approaches. The funicular requires a separately verified alignment and height treatment. Wider Frimobil includes more than TPF; add other operators through an explicit route inventory, not an operator-name shortcut.

## 8. Neuchâtel / transN

**First study:** the littoral network around Neuchâtel station and Place Pury, with Littorail and selected rail approaches. La Chaux-de-Fonds/Le Locle and Val-de-Travers can follow as another scale.

**Sources and limits:** [transN network plans](https://www.transn.ch/plans/) and its [2026 railway network statement](https://www.transn.ch/fileadmin/transn/pdf/Infrastructure/2026_Network_statement.pdf) give authoritative scope references. The GTFS sample spans agencies `44`, `73`, `153`, `792`, `166` and `15300`; a single transN ID would be incomplete. No current bus shape feed or downloadable local line graph was verified here. Rail documentation is not a trip-specific shape feed.

**Feasibility / next check:** a bounded study is plausible using the rail matcher and a new bus matching pass. Check Littorail's actual source mode and path rather than inferring classification from its name; reconcile funicular identities and separate their paths from roads. A whole [Onde Verte](https://www.ondeverte.ch/?L=0) study would also need CFF, BLS, CarPostal, CJ and TPF selection, rather than simply relabelling transN coverage.

## Measured timetable source presence

The committed [machine-readable audit](../data/regional-network-survey.json) records exact agency names, IDs, source route types, active routes, non-frequency records, frequency templates and archive SHA-256. These are deliberately **operator samples, not complete regional-network totals or payload estimates**. SBB, BLS, PostAuto and other operators outside each listed sample are excluded. All route IDs are retained separately even if their display numbers coincide.

| Sample | Agency IDs | Calendar-active route records | Calendar-active trip records | Of which frequency templates |
| --- | --- | ---: | ---: | ---: |
| Basel | 823, 37 | 49 | 9,088 | 0 |
| Bern | 827, 88, 850 | 79 | 8,271 | 0 |
| Luzern | 820, 86 | 43 | 4,991 | 0 |
| St.Gallen | 885, 22, 744, 65 | 46 | 3,255 | 0 |
| Ticino | 955, 3955, 47, 49, 817, 858 | 35 | 2,801 | 2 |
| Graubünden | 72, 766, 815 | 55 | 2,232 | 0 |
| Fribourg | 53, 834, 3004 | 96 | 4,219 | 0 |
| Neuchâtel | 44, 73, 153, 792, 166, 15300 | 32 | 3,838 | 0 |

The two Ticino templates are included in the 2,801 records; they are not two exact departures. The audit applies `calendar.txt` and `calendar_dates.txt`, but does not read `stop_times.txt`, expand headways, spatially clip trips or exclude records running after 24:00. A final civil-day study must do those checks. Counts on one Friday say nothing about weekend night routes, winter-only lines or seasonal completeness.

Reproduce with the pinned archive using the project's Node environment:

```sh
node scripts/audit-regional-network-survey.mjs \
  /path/GTFS_FP2026_20260902.zip 2026-09-04 \
  data/regional-network-survey.json
```

The [geometry probe record](../data/regional-geometry-source-probes.json) stores the exact public request URLs, HTTP results, response sizes/hashes, sampled properties and separate count URLs. Basel and Luzern samples were parsed as GeoJSON; Bern was downloaded and checked for Parquet signatures only. Full exports, directed GTFS joins and source completeness remain unmeasured. These live source probes are not required by the application or CI.

## Realtime feasibility

Every candidate can begin as scheduled interpolation. The national [GTFS-RT documentation](https://opentransportdata.swiss/en/cookbook/realtime-prediction-cookbook/gtfs-rt/) and [business-organisation coverage catalogue](https://data.opentransportdata.swiss/en/dataset/go-realtime) are the common investigation path for delays and cancellations. The latter includes organisations with present **or future** availability; membership alone cannot establish live coverage. No authenticated realtime samples were requested for these regions.

Reuse [Gleislicht's adapter and fallback rules](REALTIME.md) only after validating current credentials, the static-feed version, freshness and actual route/trip coverage for the chosen study. Do not infer vehicle GPS from trip updates or treat an operator's passenger app as an open position API. Realtime is not a dependency for the proposed regional build sequence.

## Implementation handoff

1. **Basel first:** freeze a weekday timetable plus contemporaneous BS/BL geometry, write the operator/route admission list and audit cross-border branches. Release the validated core before claiming complete TNW.
2. **Bern next:** decode OEVTP and implement a normalised cantonal line adapter. Make operator, mode, line identity, coordinates and source date explicit inputs so Luzern can reuse it.
3. **Luzern third:** apply that adapter and connect the urban study to the existing Rigi composition. Keep both independently loadable.
4. **St.Gallen in parallel with source discovery, if staffed:** establish what `AL_OEV` actually covers; no automated implementation is started by this survey.
5. **Ticino/Graubünden, then Fribourg/Neuchâtel:** use small pilot footprints and the measured road-matching workflow where an official local line source remains unavailable.

For each implementation, publish a report of admitted/excluded routes, geometry coverage both by unique directed stop pair and by scheduled segment occurrence, per-mode/operator failures, implausible detours and unresolved foreign termini. Review representative loops, bridges, tunnels, terminals and one-way streets. Existing ingestion thresholds are minimum guards, not proof of quality; set the candidate's acceptance target after inspecting its failures. Validate weekday/weekend calendars, frequency disclosures, compressed artifacts and phone rendering before adding it to the study catalogue. Keep every unresolved path visibly identified as interpolation and preserve source hashes and dates.
