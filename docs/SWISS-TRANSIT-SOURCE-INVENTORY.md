# Swiss cantonal and regional transit source inventory

Survey date: **8 September 2026**. This extends the [initial regional survey](REGIONAL-NETWORK-SURVEY.md) to **all 26 cantons**, with a complete census of **473 agency records** in the pinned national timetable, **90 public endpoint checks**, and all **181 entries** in the national realtime coverage catalogue.

The geographical source survey is complete. Route-to-geometry validation is not: downloaded files, sample queries, map services and unresolved distribution leads are distinguished below. “Not found” means not verified in the documented sources searched, not that no such data exists. Tariff associations, commissioning authorities, operators and data publishers are different entities; none alone defines a complete service footprint.

The strongest additions are **Aargau's attributed, directed line records; Zug's downloadable bus geometry; Fribourg's queryable bus lines; Solothurn's downloadable network graph; and Bern's decoded GeoPackage schema**. Jura and Nidwalden have explicit transport map layers, but no acquired vector export. Vaud advertises a comprehensive product through an order workflow. Valais lists a transport dataset with no published download channel. These findings change the earlier source ranking, especially for Fribourg.

## Evidence and accompanying data

| File | Contents |
| --- | --- |
| [Cantons](../data/swiss-transit-cantons.json) | Every canton once: authority/publisher, regional review areas, representative agency IDs, source references, vintage, reuse constraints and next action |
| [Source requests](../data/swiss-transit-sources.json) | Exact URLs and expected response formats for 90 checks; multiple checks may concern one dataset |
| [Probe evidence](../data/swiss-transit-source-probes.json) | UTC request times, HTTP results, redirects, response hashes, formats, sample fields, capabilities, archive contents and table counts |
| [National agency census](../data/swiss-transit-agencies.json) | All 473 feed identities, raw source names/URLs, route types and Friday/Sunday service counts |
| [Realtime catalogue](../data/swiss-transit-realtime-catalogue.json) | All 181 official entries, including duplicate operator entries, partial coverage and line exclusions |

Public probes made unauthenticated GET requests, with at most four requests in flight. **78 returned HTTP 200; 77 passed the basic expected-format check.** Four returned 403, five 404, two 500 and one had a transport failure. An HTTP/format success is not semantic success: Graubünden's catalogue returned a database error inside a 200 HTML response. Conversely, rejected CKAN API requests did not prevent access through the official national dataset pages. Failed exploratory endpoints remain in the evidence instead of being silently discarded.

GeoPackage inspection reads SQLite schemas, record counts, geometry declarations and sample attributes; it does not validate every coordinate or route. Aargau inspection reads the archive and DBF properties, not shapefile coordinates. Thurgau returned actual GML features; Fribourg, Luzern and Genève returned actual GeoJSON features. Bern's GeoParquet check verifies the file signature only; the separately acquired GeoPackage provides the stronger evidence.

Downloaded response bodies are kept outside Git in `/private/tmp/gleislicht-national-survey`. Hashes identify what was examined; URLs containing `aktuell`, or services returning current data, are not immutable archives. Preserve the actual source files in a durable, terms-compatible snapshot before implementing an adapter. A fresh download need not reproduce these hashes.

## Shared national sources

**Timetable.** The national 2026 GTFS is the shared starting point for every canton, including many foreign and mountain operators. The agency census uses feed **20260902**, valid **14 December 2025–12 December 2026**, SHA-256 `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`. The current dataset page also advertised a newer 20260905 release at survey time; the census deliberately retains the earlier reproducible fixture. [Official dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [pinned archive](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip).

| Measure | Full archive | Friday 4 September | Sunday 6 September |
| --- | ---: | ---: | ---: |
| Agency identities | 473 | 411 active | 414 active |
| Route records | 5,142 | 3,946 active | 3,073 active |
| Trip records | 2,143,227 | 221,799 active | 148,207 active |
| Active frequency templates | — | 579 | 597 |

Calendar exceptions are applied. Active trip counts include frequency templates once, not their expanded departures; the census does not read stop times, clip to a civil day, assign geography or join geometry. A service inactive on both dates may operate in another season. These are **feed records, not counts of legal operators or unique passenger-facing lines**. Raw agency URLs can be generic or surprising and are not verified corporate homepages. A complete regional membership audit must select actual routes/stops, especially for SBB, PostAuto, BLS and cross-border agencies.

The inspected archive has no `shapes.txt`. Stop coordinates describe stops, not the path between them. Other formats such as HRDF and flexible-service products can carry information that GTFS does not represent fully. See the [official GTFS documentation](https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/) and the existing [data pipeline](DATA-PIPELINE.md).

**Rail infrastructure.** The FOT/BAV railway network remains the shared rail-geometry baseline. Its current [STAC item](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz) was checked. Infrastructure edges are not already directed passenger-trip shapes: gauge, operator scope, topology, border extensions, stop projection and plausible path choice still need the checks used by existing studies. Cableways, funiculars, water routes and road vehicles require their appropriate sources; rail coverage is not a substitute for them.

**Realtime.** The public [operator coverage CSV](https://data.opentransportdata.swiss/dataset/27aba9bd-59ed-4d7c-bc71-a3813d1d1799/resource/83b8b8d0-e345-453b-857e-1192d48c4c64/download/go-realtime.csv) has 181 rows: `etAUS` is yes for 151, no for 3 and n.a. for 27; `complete` is yes for 106, no for 28 and n.a. for 47. These describe catalogue rows, not distinct GTFS operators. Preserve the source system, SBOID, VDV ID and comment together. Multiple PostAuto rows and operators split across rail/bus sources must not be deduplicated by brand. The saved catalogue contains exclusions such as tl m2 and particular TPG, AB, TPC and TMR lines.

No authenticated live feed was exercised in this survey. Before enabling realtime for a region, verify its current line coverage, static/realtime identifier matching, freshness, cancellation behaviour and missing-data fallback. The platform's documentation states that **vehicle positions are not available**; trip updates must not be described as observed GPS tracks. See [GTFS Realtime documentation](https://opentransportdata.swiss/en/cookbook/realtime-prediction-cookbook/gtfs-rt/) and [the project's realtime design](REALTIME.md).

**National access and reuse.** File downloads require neither registration nor payment; service access requires registration/access credentials and request limits. The platform terms require source attribution, regular refresh of raw data and publication of processed results under the user's authorship. Keep the actual terms with the source record rather than applying a generic CC licence. [Official terms](https://opentransportdata.swiss/en/terms-of-use/).

**Road, boat and mountain gaps.** Where no suitable official line source is established, use the existing [PostBus road-geometry method](POSTBUS-ROAD-GEOMETRY.md) as an explicit inferred-path fallback. Reuse requires matching route identity and ordered stop pattern; another operator sharing the road is not automatically covered. Preserve OpenStreetMap provenance and applicable ODbL obligations. Review bridges, tunnels, one-way roads, loops and access restrictions. Boats need water-compatible routes; mountain modes and flexible services need the separate rules in [mountain transport](MOUNTAIN-TRANSPORT.md). Published schematic maps are membership/review aids, not street alignments or implicit redistribution permission.

## Regional tariff and border cross-check

SBB's [official network/product directory](https://www.sbb.ch/de/angebote/tarifverbuende) lists the following **23 entries**. This cross-check prevents treating the earlier eight cities as all regional networks. The areas below are review groupings, **not exact tariff-zone polygons**; validity and fare boundaries must come from each current product map. The directory was readable through web retrieval; the direct host probe returned 403.

| Directory entry | Review area / relationship |
| --- | --- |
| A-Welle | Aargau and eastern Solothurn; interfaces with Z-Pass/TNW |
| Arcobaleno | Ticino and adjoining southern Graubünden services |
| Bodensee Ticket | Lake Constance cross-border journeys, including DE/AT/CH |
| BÜGA | Graubünden-wide travel product; not a distinct geometry feed |
| Engadin mobil | Upper Engadin; separate local bus review |
| Frimobil | Fribourg and adjoining service areas |
| HochRhein Ticket | High Rhine border corridor |
| LémanPass | Greater Geneva cross-border network; distinct from Unireso |
| Libero | Bern/Solothurn core and adjoining service areas |
| Mobilis | Vaud regional network |
| OndeVerte | Neuchâtel and adjoining service areas |
| OSTWIND | SG, TG, SH, GL, AR and AI, with cross-boundary services |
| Passepartout | LU, OW and NW |
| TNW | Basel region, including BL and parts of AG/SO |
| Transreno | Chur/Rhine valley |
| Triregio | Basel tri-national travel product |
| Tarifverbund Schwyz | Schwyz regional network |
| Tarifverbund Zug | Zug regional network |
| Unireso | Geneva cantonal network |
| Vagabond | Jura regional network |
| Verkehrsbetriebe Davos | Davos local network/product |
| Z-Pass | Corridors combining ZVV and neighbouring networks |
| ZVV | Zürich regional network, extending beyond canton boundaries |

Uri and Valais still receive full canton records even though this directory does not give them a single equivalent canton-wide tariff association. UriTicket and local Valais products are supplementary review leads. National direct transport, local tickets, tourist passes and international products are not all independent transit authorities.

Do not crop paths at administrative boundaries before reviewing the service: Basel–Weil/Saint-Louis, Geneva–France, Schaffhausen/Büsingen, the Lake Constance/Rhine area, Rheintal–Liechtenstein/Austria, Ticino–Italy, Tirano/Livigno and Jura–France all need explicit foreign endpoints. Also review domestic boundary changes against the chosen service date, canton exclaves such as Engelberg and Oberegg, Chablais across VD/VS, and the lake/mountain networks spanning cantons.

## All 26 cantons

Status refers to the strongest **local line-geometry evidence**, not the availability of the national timetable or completion of a canton-wide implementation. Representative agency IDs are starting points validated against the 473-record census, not complete memberships. Named public-transport bodies identify the planning/source relationship, not a claim that tariff bodies publish the vectors.

| Canton | Local geometry evidence | Main network/product references |
| --- | --- | --- |
| [ZH — Zürich](#zh) | Existing integration in part | ZVV, Z-Pass |
| [BE — Bern](#be) | Cantonal adapter; partial service admission | Libero |
| [LU — Luzern](#lu) | Vector sample verified | Passepartout |
| [UR — Uri](#ur) | No line export verified | UriTicket (supplementary product) |
| [SZ — Schwyz](#sz) | No line export verified | Tarifverbund Schwyz, Z-Pass, OSTWIND (edge services) |
| [OW — Obwalden](#ow) | No line export verified | Passepartout |
| [NW — Nidwalden](#nw) | Map layer only | Passepartout |
| [GL — Glarus](#gl) | No line export verified | OSTWIND |
| [ZG — Zug](#zg) | Cantonal inventory and bus/rail adapters; partial admission | Tarifverbund Zug, Z-Pass |
| [FR — Fribourg / Freiburg](#fr) | Cantonal adapter; local archival feed | Frimobil |
| [SO — Solothurn](#so) | Network adapter; partial service admission | Libero, A-Welle, TNW |
| [BS — Basel-Stadt](#bs) | Existing integration in part | TNW, Triregio, HochRhein Ticket |
| [BL — Basel-Landschaft](#bl) | Metadata / export unresolved | TNW, Triregio |
| [SH — Schaffhausen](#sh) | No line export verified | OSTWIND, Z-Pass, Bodensee Ticket |
| [AR — Appenzell Ausserrhoden](#ar) | No line export verified | OSTWIND |
| [AI — Appenzell Innerrhoden](#ai) | No line export verified | OSTWIND |
| [SG — St.Gallen](#sg) | Cantonal adapter; local feed with partial admission | OSTWIND, Z-Pass, Bodensee Ticket |
| [GR — Graubünden / Grigioni / Grischun](#gr) | Initial FOT rail / OSM bus study; local catalogue error | BÜGA, Transreno, Engadin mobil, Verkehrsbetriebe Davos |
| [AG — Aargau](#ag) | Download inspected | A-Welle, TNW, Z-Pass |
| [TG — Thurgau](#tg) | Cantonal adapter; partial service admission | OSTWIND, Bodensee Ticket |
| [TI — Ticino](#ti) | No line export verified | Arcobaleno |
| [VD — Vaud](#vd) | Metadata / export unresolved | Mobilis, LémanPass (border travel) |
| [VS — Valais / Wallis](#vs) | Full canton census; initial rail/OSM bus study | Regional/cross-border tickets (no single canton-wide tariff union in SBB list) |
| [NE — Neuchâtel](#ne) | No line export verified | OndeVerte |
| [JU — Jura](#ju) | Map layer only | Vagabond |
| [GE — Genève](#ge) | Existing integration in part | Unireso, LémanPass |

<a id="zh"></a>

### ZH — Zürich

**Authority/publisher:** ZVV; Stadt Zürich / VBZ data publisher. **Review areas:** Zürich; Winterthur; Glattal; Oberland; Zimmerberg; Weinland.

**Evidence:** Integrated ZVV GTFS with shapes is the existing implementation baseline. The city catalogue API still resolves the 2026 download and declares cc-zero. This is a regional feed, not an independent feed for every operator.

**Vintage:** 2026 archive advertised; existing measured integration retains its own pinned source date.

**Reuse:** City catalogue declares CC0 for the feed; retain provenance and distinguish other cantonal layers.

**Next action:** Refresh the pinned ZVV feed and assess all route patterns and cross-canton termini before expanding the existing footprint. Representative GTFS agencies: `11`, `65`, `82`, `773`, `807`, `838`, `849`, `882`.

**Checked references:** [zh-gtfs-catalogue](https://data.stadt-zuerich.ch/api/3/action/package_show?id=vbz_fahrplandaten_gtfs).

<a id="be"></a>

### BE — Bern

**Authority/publisher:** Canton Bern public transport planning; cantonal Geoportal / Amt für Geoinformation. **Review areas:** Bern; Biel/Seeland; Oberaargau; Emmental; Thun; Berner Oberland.

**Evidence:** OEVTP GeoPackage downloaded and SQLite tables inspected: 518 line records, 5,321 stop records and 139 Libero polygons, plus catchment/accessibility layers. Line fields include liniencode, liniennr, tucode, tuname and kubunr. GeoParquet also downloaded, but only its signature was checked.

**Vintage:** Line layer updated 1 January 2026; packaged metadata published 9 July 2026.

**Reuse:** Packaged terms dated 20 January 2026 allow free private/commercial use and reproduction with attribution. Online applications must link metadata; pass terms on with redistributed data. Layer credit: Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern.

**Implementation follow-up:** The [Bern cantonal study](BERN-STUDY.md) now inventories all 705 canton-serving GTFS route records across 101 agency identities, tests Friday/Sunday directed patterns, and emits a regional feed containing complete matched patterns. See the [full admission/exclusion inventory](BERN-ROUTE-INVENTORY.md) and [machine-readable audit](../data/bern-audit/summary.json). The reviewed urban, regional-bus, Wiriehorn, Schilthorn and federal rail supplements bring the September feeds to **36,803 Friday / 32,004 Sunday journeys**, preserving all prior calls and paths. The [Interlaken audit](../data/bern-audit/interlaken-followup.json) adds two scheduled RE8 journeys on each date by binding original platforms 5 and 8 to the explicitly named federal tracks 5–8 node and one exact West–Ost standard-gauge curve; all 10 Friday / 7 Sunday RE8 candidates now pass. Other Interlaken route identities, metre-gauge groups and the Bönigen depot continuation remain outside this review. The [Morges audit](../data/bern-audit/morges-followup.json) adds 15 Friday IR15 journeys by splitting one exact federal mainline curve at the original platform-1 projection while preserving both approaches; IR15 now passes all 44 Friday / 43 Sunday candidates, with no Sunday Morges service invented. SBB platform identity and December 2023 commissioning evidence are retained. The [TPF terminal audit](../data/bern-audit/tpf-terminal-followup.json) adds 81 Friday / 78 Sunday scheduled journeys, completing both TPF S20/S21 records through nine exact directed Fribourg platform bindings and three bounded station sections. All prior movements and other route exclusions remain unchanged; the retained SBB plan is dated September 2025. The [IR16 terminal audit](../data/bern-audit/ir16-followup.json) adds all 32 Friday / 31 Sunday SBB IR16 journeys with seven exact Zürich HB terminal projections and a bounded Bern platform-49 eastern-approach spur; through-station IC5 gaps remain separate. The [IR66 platform audit](../data/bern-audit/ir66-followup.json) adds all 40 Friday / 38 Sunday BLS IR66 journeys through exact Kerzers 4/6 operating-point bindings and bounded projections of nine original Bern terminal platform records onto the retained western approach. The [further cross-canton rail audit](../data/bern-audit/crosscanton-rail-followup.json) adds 6 Friday / 81 Sunday scheduled journeys across six TPF/SBB/BLS route identities; three occasional route records become complete, while the original Fribourg attachment and generic Interlaken topology failures remain in its historical evidence; the later terminal/platform-group reviews resolve those TPF and RE8 bindings. The [regional/intercity rail audit](../data/bern-audit/regional-rail-followup.json) adds 178 Friday / 194 Sunday scheduled journeys; seven additional regional route records pass every dated journey, while their original IR15/IC5 exclusions remain in the historical audit; the later Morges review resolves IR15. The [S36/S4 rail audit](../data/bern-audit/rail-followup.json) adds 93 Friday / 79 Sunday scheduled journeys using exact federal operating-point and segment identities; both routes now pass all dated patterns. The source catalogue is dated July 2021 and its checksum was rechecked in September 2026; current alignment validity is unconfirmed. The [Schilthorn section audit](../data/bern-audit/schilthorn-followup.json) adds 78 scheduled journeys on each date with exact source-part bindings for Mürren–Birg and Birg–Schilthorn. The [regional bus audit](../data/bern-audit/regional-road-followup.json) retains 120 complete road patterns across 17 routes; 15 now pass every dated journey. Seven extra winter/holiday fixtures activate 50 further route records; their audit is separate from the application feed. Dated BERNMOBIL evidence exposes a 7A/8A temporary-stop coordinate conflict, which remains excluded alongside unresolved Eiger/Männlichen and Matte geometry. See the [supplement review](../data/bern-audit/supplement-followup.json) and [seasonal matrix](../data/bern-audit/seasonal-summary.json). This is a whole-canton source census with partial service admission; it does not establish complete or year-round geometry coverage. Representative GTFS agencies from the original survey: `11`, `33`, `38`, `56`, `64`, `81`, `88`, `101`, `827`, `850`, `859`, `870`, `871`, `889`.

**Checked references:** [be-metadata](https://www.agi.dij.be.ch/de/start/geoportal/geodaten/detail.html?code=OEVTP&type=geoproduct), [be-product-pdf](https://www.geo2.apps.be.ch/de/pdf/geoproduct/OEVTP), [be-gpkg](https://geofiles.be.ch/geoportal/pub/download/OEVTP/oevtp.gpkg.zip), [be-lines](https://geofiles.be.ch/geoportal/pub/download/OEVTP/oevtp_linie.parquet).

<a id="lu"></a>

### LU — Luzern

**Authority/publisher:** Verkehrsverbund Luzern (VVL); rawi / Geoportal Luzern. **Review areas:** Luzern agglomeration; Entlebuch; Sursee; Willisau; Seetal; Lake Lucerne.

**Implemented follow-up:** [Luzern cantonal adapter and audit](LUZERN-STUDY.md) inventories 203 route records across 24 agencies using the whole canton polygon. Complete weekday/Sunday calls are validated against cantonal alignments, 700 bus road patterns, 627 federal rail patterns and six federal cableway installations. The regional feeds admit 12,541 Friday and 10,424 Sunday scheduled movement records, including the source’s dense cableway schedules. Every original call is preserved. All 7,374 Friday and 5,250 Sunday bus journeys are now admitted; Two detailed SBB border curves, checked across 45 complete IR75/EC patterns, now complete all 40 IR75 journeys per date through Konstanz. Como rail termini, Hammetschwand and lake services remain excluded. Two separately bound Hochdorf road patterns and a 19-pattern strict access-road supplement preserve context and short platform attachments. A complete 27-feature swissTLM3D ferry census records Rotsee as suspended since April 2025; it supplies no SGV/Hallwilersee course network. Full source snapshots, station/operator crosswalks, source dates, attribution, geometry review panels and reproducible regression checks are included.

**Evidence:** Cantonal bus layer advertises 114 features and returns GeoJSON. Fields include BUL_ROUTE, FP_JAHR, LINIENNR, KURSBUCHNR and a local TU enumeration. Rail, boat and stop products are also documented. Coverage includes bus lines with at least one section inside the canton.

**Vintage:** Bus layer: 26 May 2026; annual timetable update. Stop layers have different dates.

**Reuse:** Bus product is Open-By; retain the required rawi Kanton Luzern copyright and metadata. A public access class alone is not the licence.

**Next action:** Download full lines, decode TU enums rather than treating them as GTFS IDs, and measure regional as well as vbl patterns. Representative GTFS agencies: `11`, `33`, `82`, `86`, `185`, `801`, `812`, `819`, `820`.

**Checked references:** [lu-metadata](https://daten.geo.lu.ch/produkt/oevxxxxx_col_v5), [lu-layer](https://public.geo.lu.ch/ogd/rest/services/managed/OEVXXXXX_COL_V5_MP/MapServer?f=pjson), [lu-sample](https://public.geo.lu.ch/ogd/rest/services/managed/OEVXXXXX_COL_V5_MP/MapServer/8/query?where=1%3D1&outFields=*&outSR=4326&returnGeometry=true&resultRecordCount=3&f=geojson), [lu-terms](https://geoportal.lu.ch/Nutzungsbedingungen).

<a id="ur"></a>

### UR — Uri

**Authority/publisher:** Canton Uri public transport planning; geo.ur.ch. **Review areas:** Reuss valley; Urseren; Andermatt; Lake Lucerne; Side valleys.

**Evidence:** WFS capabilities expose a bus-stop inventory and cableway/ski-lift axes and stations. No bus-route vector layer was verified in the advertised service. Cableway axes need passenger/ski/freight filtering.

**Vintage:** No bus-line vintage established; date each ancillary layer separately.

**Reuse:** Layer-specific reuse terms remain to be established before importing the ancillary geometry.

**Next action:** Scope Auto AG Uri, PostAuto and Andermatt services; obtain bus alignments or run a measured road-matching pilot. Representative GTFS agencies: `11`, `48`, `82`, `93`, `185`, `801`, `816`, `851`, `7095`.

**Checked references:** [ur-portal](https://geo.ur.ch/), [ur-wfs](https://geo.ur.ch/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities).

<a id="sz"></a>

### SZ — Schwyz

**Authority/publisher:** Canton Schwyz public transport planning; cantonal geodata portal. **Review areas:** Schwyz/Brunnen; Einsiedeln; March/Höfe; Küssnacht; Rigi/Fronalp.

**Evidence:** Published WMS catalogue checked. National rail/topographic and other transport-adjacent layers are present; no current bus-line vector export was established. Existing Rigi coverage does not establish cantonal bus coverage.

**Vintage:** No local bus-line source vintage established.

**Reuse:** No bus dataset-specific reuse permission established.

**Next action:** Review Auto AG Schwyz, Freienbach and scoped PostAuto/SOB patterns, including links into Zug, Uri and Zürich. Representative GTFS agencies: `11`, `82`, `801`, `841`, `755`.

**Checked references:** [sz-catalogue](https://data.geo.sz.ch/public/Themen/A100A/wms.html).

<a id="ow"></a>

### OW — Obwalden

**Authority/publisher:** Canton Obwalden public transport planning; GIS Daten AG. **Review areas:** Sarnen valley; Lungern/Brünig; Engelberg exclave; Pilatus.

**Evidence:** Official OW WMS capabilities checked; no public transport line layer identified. Regional Luzern sources may contain through-lines but are not canton-complete evidence. Engelberg must be reviewed as an OW exclave.

**Vintage:** No cantonal bus-line vintage established.

**Reuse:** No local line dataset licence established.

**Next action:** Inventory PostAuto, Zentralbahn and Engelberg local services, then separate mountain geometry and winter/summer calendars. Representative GTFS agencies: `86`, `136`, `801`, `7058`.

**Checked references:** [ow-wms](https://www.gis-daten.ch/wms/ow/service?REQUEST=GetCapabilities&SERVICE=WMS).

<a id="nw"></a>

### NW — Nidwalden

**Authority/publisher:** Canton Nidwalden public transport planning; GIS Daten AG. **Review areas:** Stans; Buochs/Beckenried; Engelberg valley approaches; Lake Lucerne.

**Evidence:** WMS advertises ch.nw.oeffentlicher-verkehr (NW075), a combined public transport map, and NW076 cableways. Rendering capability confirms a map exists; no reusable vector line download was acquired.

**Vintage:** Layer data vintage unresolved.

**Reuse:** WMS visibility does not establish vector redistribution rights.

**Next action:** Locate the underlying NW075 line export, distinguish tariff/stop/quality polygons, and validate PostAuto and lake connections. Representative GTFS agencies: `86`, `107`, `145`, `185`, `801`, `3190`.

**Checked references:** [nw-wms](https://www.gis-daten.ch/wms/nw/service?REQUEST=GetCapabilities&SERVICE=WMS).

<a id="gl"></a>

### GL — Glarus

**Authority/publisher:** Canton Glarus public transport planning; cantonal geoinformation. **Review areas:** Glarus valley; Sernftal; Linth plain; Braunwald; Walensee.

**Evidence:** Public WFS capabilities checked; no public transport route layer identified among the advertised layers. Roads and other line themes must not be mistaken for service paths.

**Vintage:** No local bus-line vintage established.

**Reuse:** General cantonal open-geodata policy is a lead; a particular transport dataset and its terms still need identification.

**Next action:** Use national timetable and rail baseline; investigate Sernftal/PostAuto bus alignments and separately validate mountain/lake services. Representative GTFS agencies: `11`, `105`, `197`, `801`, `856`.

**Checked references:** [gl-wfs](https://wfs.geo.gl.ch/?REQUEST=GetCapabilities&SERVICE=WFS&VERSION=1.1.0).

<a id="zg"></a>

### ZG — Zug

**Authority/publisher:** Canton Zug public transport planning; GIS Kanton Zug. **Review areas:** Zug/Baar; Cham/Risch; Ägeri; Menzingen; Zugerberg/lake.

**Evidence:** Official Buslinien ZIP downloaded: Shapefile, GeoPackage, INTERLIS and DXF. GeoPackage has 175 LineString records in EPSG:2056 with id, t_id and liniennummer. WFS exposes line-specific layers. Future vehicle-length/planning layers are separate products.

**Vintage:** Archive Last-Modified 18 September 2025; internal GeoPackage last_change 26 March 2024. The full current WFS matches all 175 records within 1 mm but does not establish 2026 alignment validity.

**Reuse:** Free commercial/noncommercial use with mandatory credit: Quelle: GIS Kanton Zug.

**Implementation:** [Zug study and full admission/exclusion audit](ZUG-STUDY.md) inventories 77 annual route records across nine agencies and all eleven municipalities, retains the source bytes, implements exact shared-segment line membership and tests every Friday/Sunday directed stop pattern. The regional feed admits 3,530 Friday trips and 2,225 Sunday trips, including 529/431 complete SBB/SOB rail trips from the preserved federal standard-gauge network. The exact federal Zugerbergbahn alignment adds 72/70 trips, with both directions verified against exact operating-point IDs and small, recorded endpoint connectors. Unresolved bus patterns remain explicit exclusions. Exact 2026 Luzern bus supplements add 156/94 complete trips on lines 23, 73 and 110, with per-pair provenance and unchanged tolerances. The rail source has an internal Stand of 6 July 2021; these source dates do not establish September 2026 alignment validity. The federal cableway collection is dated 7 November 2025, retrieved 8 September 2026; individual features have no alignment date. Federal source credit and attribution terms are retained. A separately attributed OSM fallback, tested against all six 653 and both N73 complete patterns, adds 126/62 trips after official geometry fails; successful official pair paths stay unchanged. OSM source dates, ODbL attribution, matcher evidence and original official failures are retained. A second independent road run covers all 73 patterns on the remaining 19 incomplete bus routes, adding 304/202 trips. The remaining bus gap is 604 Grienbach (original road snap 188.7 m). A preserved four-pattern control and two diagnostic matcher runs resolve the projection error, but retain a 981–994 m roundabout return within the one-minute Grienbach–V-Zug source interval. These candidates remain excluded pending reconciliation of the stop placement, direction and timing; no trial path enters the feed. A subsequent six-platform review compares a historical OSM stop extract with source call order and the operator’s two direction lists. Inbound Grienbach is 188–200 m from both same-UIC OSM positions, whereas the outbound coordinate is within 4 m of one. Dated city/ZVB notices distinguish the outbound Industriestrasse relocation from inbound traffic and the later September 11 closure. They support a suspected coordinate/direction inconsistency, but supply no authoritative replacement SLOID coordinate; all 105 inbound exclusions and original coordinates remain unchanged. The complete atlas validity-history export adds 155,869 preserved national records and all 12 versions for the six adjacent platforms. Exact SLOID/owner/status/date checks find one applicable record per fixture; all six coordinates agree with GTFS within 0.397 m, including inbound Grienbach within 0.231 m. The March 2026 versions preserve the same coordinates and supply no travel bearings. This rules against an adapter coordinate-conversion error but does not independently establish physical stop placement or a corrected approach. The master-data review therefore retains every exclusion and changes no geometry. Source dates, full-export hashes and atlas/SKI/ZVB attribution are documented. A subsequent historical OSM direction review matches all four complete 604 patterns to exact route relations. The direction-specific inbound Grienbach node remains 188.51 m from the original coordinate; its five-way local approach still fails the unchanged 120 m projection test at 153.80 m. All 11 returned restrictions are inventoried, and outbound relation geometry is explicitly noted as inconsistent with the dated diversion. The operator’s original 2026 departure poster independently matches every Friday/Sunday service-day departure and the one-minute V-Zug interval. Its 66/37 service-day totals reconcile to 67/38 complete civil-window trips after previous-day carry-in and following-day tail calls are accounted for; the holiday-only Sunday 05:44 is excluded correctly. Source PDF, raw OSM, dates, attribution and reproducible comparisons are retained without changing admissions. N6 now retains all three successful full-pattern variants into Sins Bahnhof, adding three Sunday trips and completing all six N6 trips. The shapes share 35 vertices and differ only within 97 m of the destination; the rejected shared-pair consensus remains recorded, and context-free reuse stays prohibited. A separately scoped line 619 trial retains the mapped Chlösterlistrasse service road and adds eight Friday/nine Sunday trips, completing all 38/25 line 619 trips. All four patterns are retained in both trial and control runs; only the two explicit failed Chlösterli pairs may use the new source, and previous successes remain unchanged. Raw local OSM, the exact configuration change, both matcher outputs, source timestamps and ODbL attribution are preserved. Dated ZVB notices distinguish later September 11–14 Grienbach works from the September 4/6 fixtures. Four exact SBB graphical rail segments add 62/66 trips, completing S26, RE6 and IR75 through Däniken–Schönenwerd and Kreuzlingen–Konstanz. The federal Däniken metre-gauge label remains unchanged and documented; SBB independently labels the selected corridor normal gauge. SBB source dates, attribution and rejected two-point Como geometry are preserved. A separate historical OSM rail extract now completes all 26 EC trips per date through Monte Olimpino I, covering all 16 distinct full patterns and Sunday’s Rotkreuz variant. Exact station UICs, original Chiasso platforms, two pinned source-way chains and all calls/times are retained. The 4.124/4.229 km paths attach within 24 m of the original stop coordinates; eight official Lombardia records independently corroborate the corridor, with no geometry splicing. All railway ways, exclusions, source dates, ODbL attribution and the original official failure remain auditable. Every rail trip on the two fixtures now passes; annual rail patterns remain a separate validation scope. An 18-segment swissTLMRegio lake supplement adds eight Friday and eleven Sunday boat trips, covering all Ägerisee patterns. Generalized paths and 200 m dock connectors are checked against unsimplified 2007 shorelines, including islands and both Zugersee polygon parts. Dock-area discrepancies and the original remote land-crossing failures remain recorded. A water-aware diagnostic removes four land-crossing source edges without adding geometry. The Zug–Walchwil alternative is water-valid but loops through the southern lake, requiring a 27.15 km/h mean over 33 minutes, close to the operator’s published 27/28 km/h vessel maxima; its actual service path remains unresolved. Risch–Zug still fails the original detour limit. All filtered-network trial paths, rejected edges, source intervals and fleet evidence remain diagnostic only. A separate historical OSM ferry census now binds all ten full directed lake patterns to exact route relations. Two original direct ways independently complete Zug–Walchwil and Risch–Zug, adding one Friday/two Sunday trips and completing all 9/13 boat trips. The 8.884/5.417 km paths attach within 25 m of original docks, pass the unchanged shoreline rules and imply 16.15/16.25 km/h over the original 33/20-minute intervals. All source vertices, route/stop identities, full-pattern contexts, element vintages and ODbL attribution are preserved; prior successful geometry is unchanged. The complete 27-feature national swissTLM3D ferry class is also inventoried and has no overlap with either lake envelope. Source dates, raw queries and © swisstopo / © FOEN attribution are preserved. Three pinned sub-metre topology joins are disclosed as inferred geometry. The census adds agencies `179`, `820` and `7231` to the representative survey list `11`, `82`, `158`, `186`, `801`, `839`.

**Next action:** Resolve the remaining inbound 604 Grienbach inconsistency, verify current alignments and street directions, and validate seasonal/holiday dates before claiming complete cantonal motion coverage.

**Checked references:** [zg-catalogue](https://zg.ch/de/planen-bauen/geoinformation/geoinformationen-nutzen/geoinformationen-von-a-bis-z), [zg-wfs](https://services.geo.zg.ch/ows/buslinien?REQUEST=GetCapabilities&SERVICE=WFS), [zg-download](https://services.geo.zg.ch/datarepo/Buslinien/data.zip), [zg-terms](https://zg.ch/de/planen-bauen/geoinformation/geoinformationen-nutzen/nutzungsbedingungen).

<a id="fr"></a>

### FR — Fribourg / Freiburg

**Authority/publisher:** Canton Fribourg mobility planning; cantonal geoportal / SIT. **Review areas:** Fribourg/Freiburg; Bulle/Gruyère; Romont/Glâne; Broye; Murten/Morat; Sense; Châtel-St-Denis/Veveyse.

**Evidence:** ArcGIS Theme_mobilite layer 2 is a queryable polyline source: 128 total features. GeoJSON samples include rail and actual TPF urban buses. NUMERO_LIGNE values such as 20.002 are timetable-field identifiers, not simply display line 2. Other fields include type, enterprise and name.

**Vintage:** Current geometry vintage not established; service response date is only an access check.

**Reuse:** The exact matching cantonal OGD feature service permits free attributed vector use, sharing and reuse (Source: Etat de Fribourg). All 128 geometries and original attributes are independently reconciled; the dataset-specific catalogue evidence is preserved with the feed.

**Implementation follow-up:** The [Fribourg cantonal study](FRIBOURG-STUDY.md) now inventories 207 annual canton-serving GTFS route records across 17 agency identities and all seven districts, including one explicitly provisional boundary membership. All 128 source features were acquired and every Friday/Sunday directed pattern tested. The [regional feed](../data/fribourg-region/index.json) admits 5,540 Friday and 3,789 Sunday journeys with complete geometry; the [full route/source inventory](FRIBOURG-ROUTE-INVENTORY.md) retains every exclusion. It is a local archival research artifact with dataset-specific attributed vector reuse resolved. Before road supplementation, one disclosed, hashed 11.22 mm source endpoint repair on TPF line 9 adds 143 Friday / 151 Sunday journeys. An explicitly inferred OSM supplement tests all 614 full bus patterns and adds a further 2,063 / 1,216 journeys, retaining original source failures and rejecting differing or failed road contexts. A separately pinned Mont-Carmel terminal review follows three directed OSM road ways, preserves both original calls and adds 74 / 72 TPF 3 journeys; all 8,915 prior journeys retain identical calls and geometry. The Jongny review independently reconstructs ten directed OSM ways common to three j26 VMCV route relations, corroborated within 10 m at checked vertices by cantonal features 43/44/45. A 2.05 km ceiling scoped to the three downhill pairs adds 74 / 57 journeys, preserves all 9,061 prior journeys and completes VMCV 213/216/217 on both dates. The Laupen review follows the independently documented western construction bypass on 29 OSM road ways, restoring two way versions and four node versions edited after the fixtures from retained histories. All six complete route-121 patterns pass: 59 / 20 added journeys, all 9,192 prior journeys unchanged, and bounded platform attachments below 10 m. The Broc station review retains separate arrival/platform-B calls, connecting them with 9.2 m of directed source road and bounded original-call connectors. It adds 20 / 16 TPF 260 journeys, preserves all 9,271 prior journeys and the original eight-minute wait, and makes no claim that the bus moves throughout that interval. The Boltigen review retains the detailed OSM hairpins in both TPF 259 directions, corroborated within 5.3 m at compared vertices by an independently decoded official Bern line. Original-call attachments remain below 20 m; both complete patterns pass without generic limit changes. It adds 12 / 10 journeys, preserves all 9,307 prior journeys and their geometry, and retains the original one/two-minute intervals. Bus admission is 4,593/4,702 Friday and 2,828/2,996 Sunday. A separately attributed FOT supplement tests 412 complete directed rail patterns across 35 reviewed standard-gauge route identities, adding 597 Friday / 659 Sunday journeys. A further hashed review maps only Kerzers tracks 4/6 on IR66 to the BLS operating point and imports one detailed SBB Däniken curve for IC1, adding 26 / 25 journeys while preserving all 8,822 previously admitted journeys. A separate Bern tracks 49/50 terminal review clips only pinned western approaches within 75 m of the original platforms, adding 20 / 20 journeys and preserving all 8,873 previously admitted journeys. Current SBB exact operating-point and detailed curve evidence for Avry-Matran adds two Sunday SN journeys, preserving all 8,913 prior journeys and their geometry. Rail admission is 947/1,092 and 961/1,048; exact operating-point identity, full-context agreement and a 2.5× detour guard retain remaining failures. The dated TPF Sunday 21:00 Bulle–Semsales closure reconciles with the full S50/S51 timetable. FOT catalogue date 6 July 2021 and asset update 18 January 2025 do not establish 2026 alignment validity. Actual cantonal geometry vintage remains unknown; embedded metadata creation (14 July 2022) and catalogue modification (8 July 2026) are not line update dates. Next steps are geometry vintage, physical direction, failed-pattern alignment review and additional seasonal dates. Representative GTFS agencies from the original survey: `11`, `53`, `801`, `834`, `3004`.

**Checked references:** [fr-layer](https://map.geo.fr.ch/arcgis/rest/services/PortailCarto/Theme_mobilite/MapServer/2?f=pjson), [fr-count](https://map.geo.fr.ch/arcgis/rest/services/PortailCarto/Theme_mobilite/MapServer/2/query?where=1%3D1&returnCountOnly=true&f=json), [fr-sample](https://map.geo.fr.ch/arcgis/rest/services/PortailCarto/Theme_mobilite/MapServer/2/query?where=1%3D1&outFields=*&outSR=4326&returnGeometry=true&resultRecordCount=3&f=geojson), [fr-bus-sample](https://map.geo.fr.ch/arcgis/rest/services/PortailCarto/Theme_mobilite/MapServer/2/query?where=TYPE_LIGNE_VALEUR%20LIKE%20%27%25Bus%25%27&outFields=*&outSR=4326&returnGeometry=true&resultRecordCount=3&f=geojson), [fr-catalogue](https://geo.fr.ch/), [fr-terms-canonical](https://map.geo.fr.ch/help/fr/conditions_utilisation.htm).

<a id="so"></a>

### SO — Solothurn

**Authority/publisher:** Amt für Verkehr und Tiefbau; Amt für Geoinformation Solothurn. **Review areas:** Solothurn/Grenchen; Olten/Gösgen/Gäu; Thal; Dorneck/Thierstein.

**Evidence:** ch.so.avt.oev GeoPackage downloaded: 3,951 MultiLineString network segments and 775 stops in EPSG:2056. Network fields only identify mode and tunnel status; there are no line/operator identifiers. Stops include DiDok. The empty linestructure helper table is not missing network coverage.

**Vintage:** Published 17 December 2025. Metadata explicitly excludes night services.

**Reuse:** Linked dataset terms permit commercial/noncommercial use; source attribution is recommended.

**Implementation follow-up:** The [Solothurn study](SOLOTHURN-STUDY.md) inventories all **193 canton-serving GTFS route records across 19 agencies and all ten districts**, retaining full cross-canton calls. **151 route records** contribute **7,033 Friday / 5,695 Sunday movements**, including **1,078 / 1,108** representative Weissenstein headway instances. Cantonal geometry is supplemented by full-pattern OSM bus consensus, gauge/stop-order constrained FOT rail, Bern boat 3216 and Basel tram 10. Reviewed Bern S11/S29 linework and SBB Däniken–Schönenwerd geometry add 209 / 157 whole journeys; the [corridor audit](../data/solothurn-audit/corridor-review.json) preserves each source association. An exact FOT Interlaken Ost tracks 5–8 [platform crosswalk](../data/solothurn-audit/rail-platform-review.json) adds another 33 / 19 IC61 and ICE journeys. A bounded [S29 source-precedence review](../data/solothurn-audit/s29-precedence-review.json) adds 22 / 21 journeys and completes all 86 S29 journeys on both dates. An explicit 2.236 mm [Oberbuchsiten source-junction connection](../data/solothurn-audit/bus-junction-review.json) adds 37 / 18 route-126 journeys; the [local-gap review](../data/solothurn-audit/local-gap-review.json) preserves the original measurements. Six explicitly reviewed [service-road pairs](../data/solothurn-audit/access-road-review.json), checked across 72 full patterns on eight routes, add 34 / 119 journeys and resolve the Liestal contexts; other failed bus candidates remain excluded. Night services require supplementary geometry on every leg. The bounded [Bern platforms 49/50 review](../data/solothurn-audit/bern-terminal-review.json) adds 34 / 34 journeys using the SBB station plan and pinned FOT station/eastern-approach curves, preserving original platforms and the station point. The [S26 source-conflict review](../data/solothurn-audit/s26-review.json) adds one Friday journey using independent standard-gauge SBB Däniken geometry while retaining the rejected FOT gauge record unchanged. A [Chiasso–Como passenger-corridor review](../data/solothurn-audit/como-review.json) adds two EC journeys on each date using pinned OSM geometry and an independent complete Lombardia comparison, with eight full seasonal route contexts retained. A scoped [Brig–Domodossola review](../data/solothurn-audit/simplon-review.json) adds six / eight EC journeys using the official station-code association and pinned OSM passenger railway. The [Delle–Boncourt review](../data/solothurn-audit/delle-review.json) adds one Friday RE journey on original passenger branch-line ways. All rail journeys in the two published-date samples now have complete geometry. A [Liesberg hillside-road review](../data/solothurn-audit/road-detour-review.json) admits five Sunday line-118 journeys with a 700 m bound for one exact directed pair, corroborated by the mapped bus relation and official timetable. The same review retains Egerkingen corridor disagreement and Arlesheim platform-gap evidence. The [M53 review](../data/solothurn-audit/m53-review.json) admits two Sunday night-bus journeys using Bern’s operator-specific line 9353 for Amthausplatz → Baseltor, preserving both rejected road alternatives and the unchanged general limits. Bern data is dated 1 January 2026, package publication 9 July; the retained official timetable is dated 10 September 2025. Pieterlen works documents do not establish the EV4 bus itinerary, so its 21 Sunday journeys remain excluded. **123 / 124 tram and bus journeys remain excluded**; all prior admissions are retained. The [route inventory](SOLOTHURN-ROUTE-INVENTORY.md), [supplement review](../data/solothurn-audit/supplement-review.json) and [alignment review](../data/solothurn-audit/alignment-review.json) retain exclusions and source disagreements. Twelve seasonal/holiday dates activate nine additional route records; 33 are inactive throughout that sample. Solothurn is integrated into the app and regional refresh with a verified, honestly dated fallback. Inferred geometry does not certify physical one-way/running-track alignment or current operator diversions. The DST fallback date is audit-only, and year-round coverage remains unproven.

**Checked references:** [so-publications](https://data.geo.so.ch/themepublications?query=ch.so.avt.oev), [so-lines](https://files.geo.so.ch/ch.so.avt.oev/aktuell/ch.so.avt.oev.gpkg.zip), [so-metadata](https://files.geo.so.ch/ch.so.avt.oev/aktuell/meta/datenbeschreibung.html), [so-terms](https://files.geo.so.ch/nutzungsbedingungen.html).

<a id="bs"></a>

### BS — Basel-Stadt

**Authority/publisher:** Canton Basel-Stadt mobility planning; Geoportal / BVB. **Review areas:** Basel core; Riehen/Bettingen; Weil am Rhein; Saint-Louis.

**Evidence:** Official line WFS remains reachable. The separate Basel study contains more advanced BVB/BLT joins and diversion handling; its current audit is authoritative for measured coverage. A successful BS source check is not a complete TNW claim.

**Vintage:** Use the exact source snapshots and operating dates in the Basel audit.

**Reuse:** Retain the BS source attribution and the dataset terms already tracked by the Basel pipeline.

**Next action:** Extend from measured BVB/BLT patterns to all regional operators and cross-border branches, maintaining separate baseline and diversion geometry. Representative GTFS agencies: `11`, `37`, `823`, `801`.

**Checked references:** [bs-wfs](https://wfs.geo.bs.ch/?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities).

<a id="bl"></a>

### BL — Basel-Landschaft

**Authority/publisher:** Canton Basel-Landschaft public transport planning; GeoView / GeoShop. **Review areas:** Liestal; Birseck/Leimental; Waldenburg; Laufental; Upper Baselbiet.

**Evidence:** TNW/transport Shapefile is advertised in prior official metadata research, but this pass did not acquire the export. Direct metadata request returned 403. The existing Basel audit has stronger evidence for individual BVB/BLT paths, not the whole canton.

**Vintage:** Advertised export vintage not independently established.

**Reuse:** Resolve the exact dataset terms and automated acquisition, not just a portal login.

**Next action:** Obtain the advertised export and audit AAGL, PostAuto and BLT regional bus patterns, including through-lines in the Aargau source. Representative GTFS agencies: `37`, `801`, `811`.

**Checked references:** [bl-metadata](https://www.baselland.ch/politik-und-behorden/direktionen/volkswirtschafts-und-gesundheitsdirektion/amt-fur-geoinformation/geoportal/geodaten/verkehr).

<a id="sh"></a>

### SH — Schaffhausen

**Authority/publisher:** Canton Schaffhausen public transport planning; cantonal GIS / vbsh. **Review areas:** Schaffhausen/Neuhausen; Klettgau; Reiat; Stein am Rhein; Büsingen interfaces.

**Evidence:** Public OGD directory checked. Traffic-load data are available but are not transit service geometry. A portal journey planner using search.ch/OSM is not evidence of a reusable official line export. vbsh has multiple feed identities.

**Vintage:** No bus-line source vintage established.

**Reuse:** No bus-line dataset licence established.

**Next action:** Inventory both vbsh identities and cross-border routes; obtain official alignments or validate road matching, including German enclaves and termini. Representative GTFS agencies: `11`, `65`, `193`, `836`, `846`.

**Checked references:** [sh-catalogue](https://data.geo.sh.ch/ogd/).

<a id="ar"></a>

### AR — Appenzell Ausserrhoden

**Authority/publisher:** Canton Appenzell Ausserrhoden public transport planning; Geoinformation und Vermessung. **Review areas:** Herisau; Teufen; Trogen; Heiden; Appenzeller Vorderland.

**Evidence:** KTAR WMS capabilities checked; no actual public transport line network identified. The regional geodata shop advertises GeoPackage acquisition with registration, but that does not establish a bus dataset. SG subsidised-line coverage cannot be extended to all AR by assumption.

**Vintage:** No local bus-line vintage established.

**Reuse:** Cantonal data-source credit and dataset-specific terms need carrying through any acquired export.

**Next action:** Review AB rail and bus separately, plus Herisau and PostAuto; investigate local export availability before road matching. Representative GTFS agencies: `22`, `82`, `744`, `799`, `801`.

**Checked references:** [ar-wms](https://www.geoportal.ch/services/wms/ktar?SERVICE=WMS&REQUEST=GetCapabilities).

<a id="ai"></a>

### AI — Appenzell Innerrhoden

**Authority/publisher:** Canton Appenzell Innerrhoden public transport planning; cantonal Geoportal. **Review areas:** Appenzell; Schwende-Rüte; Oberegg exclave; Alpstein.

**Evidence:** KTAI WMS and official portal checked. Transport-related matches are rail-noise or contaminated-site layers, not passenger service paths. No bus-line export verified. Flexible PubliCar service areas cannot be rendered as fixed scheduled routes.

**Vintage:** No bus-line vintage established.

**Reuse:** No transport dataset-specific licence established.

**Next action:** Separate fixed AB/PostAuto services, flexible bookings and mountain operators; include Oberegg rather than treating the canton as contiguous. Representative GTFS agencies: `22`, `801`.

**Checked references:** [ai-portal](https://www.ai.ch/themen/planen-und-bauen/geodaten-und-plaene/geoportal), [ai-wms](https://www.geoportal.ch/services/wms/ktai?SERVICE=WMS&REQUEST=GetCapabilities).

<a id="sg"></a>

### SG — St.Gallen

**Authority/publisher:** Amt für öffentlichen Verkehr; AREG / Geoportal St.Gallen. **Review areas:** St.Gallen/Rorschach; Fürstenland/Wil; Toggenburg; Rheintal; Sarganserland; Werdenberg; See-Gaster.

**Implementation:** [Full St. Gallen audit](ST-GALLEN-STUDY.md) and [regional feed index](../data/st-gallen-region/index.json). The complete annual pinned-GTFS polygon census covers **343 route records and 38 agency identities**. The local feed admits **10,652 Friday / 7,325 Sunday movements** across **1,004 / 773 complete directed patterns**, including the reviewed line-321 repair and [line-210 shared corridor](ST-GALLEN-SHARED-CORRIDOR-REVIEW.md). The [Vaduz extension](ST-GALLEN-VADUZ-REVIEW.md) adds 28 Friday line-24 trips using a documented joint-operation corridor. All earlier admitted journeys and paths are preserved. The [endpoint review](ST-GALLEN-ENDPOINT-REVIEW.md) replays all 103 remaining directed bus endpoint failures, affecting 303 Friday / 100 Sunday trips; all remain excluded pending route-specific geometry evidence. The [Vorarlberg comparison](ST-GALLEN-VMOBIL-REVIEW.md) matches line-164 calls and times; a [reviewed stop rendering anchor](ST-GALLEN-STOP-ANCHOR-REVIEW.md) now resolves its coordinate discrepancy on the original AL_OEV geometry. Every excluded pattern remains audited; geometry admission is partial and the generated feed stays local pending redistribution permission.

**Evidence:** Acquired all **226 AL_OEV features**: 45 rail, 145 regional bus, 34 city/municipal bus, one cableway and one Walensee feature. The working download is the public share's current DAV file URL, recorded in [the source catalogue](../data/st-gallen-sources/sources.json). The old archive endpoint's 404 remains historical probe evidence. LV95 geometry has operator/line fields and explicitly no travel direction. The adapter uses reviewed feed identity mappings, full ordered stop chains and bounded projections; it does not certify one-way roads or silently bridge gaps.

**Vintage:** Pinned archive and supplied description **24 March 2026**, representing the 2026 timetable alignment; per-feature survey dates are absent. The live description's 3 September 2026 date is not a new archive geometry vintage. Source retrieval times and exact hashes are preserved separately.

**Reuse:** The supplied 1 June 2019 terms and current SG website terms retain an express-permission requirement for redistribution/own geoservices. No dataset-specific open licence was supplied. Source vectors and the generated feed stay in ignored local directories outside public assets; the tracked adapter, index and admission/exclusion audit are reviewable. Required attribution, source dates, lack of legal effect and publisher disclaimer are recorded.

**Next action:** Resolve publication permission, geometry exclusions and road/track/water direction review; validate seasonal and holiday dates before claiming complete annual cantonal motion coverage. SG does not stand in for all six OSTWIND cantons. Representative GTFS agencies: `22`, `65`, `82`, `138`, `744`, `805`, `810`, `832`, `885`, `896`.

**Checked references:** [sg-source-page](https://www.sg.ch/bauen/geoinformation/aktuelles.html), [sg-model](https://services.geo.sg.ch/wss/service/metadaten/guest/datenbeschreibung/AOEV_AL_OEV_Datenbeschreibung.pdf), [sg-download-page](https://data.geo.sg.ch/s/RMgBWPofwkaCawf?dir=/Geodaten/3%20-%20Bev%C3%B6lkerung%20und%20Wirtschaft/P%20-%20Verkehr/AbgeltungsberechtigteLinien), [sg-archive](https://data.geo.sg.ch/s/RMgBWPofwkaCawf/download?path=%2FGeodaten%2F3%20-%20Bev%C3%B6lkerung%20und%20Wirtschaft%2FP%20-%20Verkehr%2FAbgeltungsberechtigteLinien), [sg-share-path](https://data.geo.sg.ch/s/RMgBWPofwkaCawf?path=%2FGeodaten%2F3%20-%20Bev%C3%B6lkerung%20und%20Wirtschaft%2FP%20-%20Verkehr%2FAbgeltungsberechtigteLinien), [sg-terms](https://www.sg.ch/bauen/geoinformation/datenbezug/agb.html).

<a id="gr"></a>

### GR — Graubünden / Grigioni / Grischun

**Initial study:** [Full methodology, reuse and exclusions](GRAUBUENDEN-STUDY.md) · [Every annual route](GRAUBUENDEN-ROUTE-INVENTORY.md) · [Coverage audit](../data/graubuenden-audit/summary.json).

The entire pinned national GTFS census finds **380 routes across 67 agency identities** with a call in the complete GR canton polygon. Every fixture journey retains all calls, including external termini. The validated initial application scope admits **9,001 Friday / 7,778 Sunday complete instances (including 2,395 representative headways each day)**, using reviewed FOT gauge/operator topology attributed OSM full-pattern bus matching, and six aerial cableway and three funicular axes. Inactive seasonal records and excluded mountain, boat and other services remain in the denominator.

**Official local investigation:** current GeoGR pages and official map-search documentation confirm transport layers, including local/night buses, PostAuto, rail and mountain services. The metadata catalogue and its embedded service inventory still return ORA-24415 inside HTTP 200. No current operational local line export with verified identifiers, vintage and dataset-specific reuse was acquired. All request outcomes and compressed evidence are saved in [source probes](../data/graubuenden-sources/probes.json).

**Vintage and reuse:** GTFS 20260902; FOT segment Stand 2021-07-06 (asset timestamp 2025-01-18); OSM Switzerland 2026-09-02 plus border 2026-09-08. Attribution accompanies the study; its derived OSM bus database is supplied under ODbL. No unverified local vectors are included. Neither a source retrieval date nor two September fixtures establish year-round/current alignment validity.

**Rail follow-up:** explicit reviewed attachments on the existing Sagliains–Lavin and Alvaneu–Filisur curves recover 100 Friday / 86 Sunday complete journeys, including the Viaduktshuttle. Original accepted paths remain identical; no primary distance limit was raised. [Before/after audit](../data/graubuenden-audit/rail-anchor-review.json).

**Next action:** obtain and review official local line exports and terms; review border/valley bus geometry, the generic INFO rail identity, and seasonal or mountain-service coverage. Existing graph limits remain unchanged.

The [complete bus-pattern review](GRAUBUENDEN-BUS-REVIEW.md) evaluates all 187 patterns on all 24 routes with a previously excluded bus journey and admits 35 newly complete road patterns: +145 Friday / +119 Sunday, with every earlier complete path unchanged. A fresh GR-specific service-road graph replaces a rejected reuse experiment whose actual extent had no GR overlap. Both results and every trial disposition are preserved. The [twelve-date seasonal inventory](GRAUBUENDEN-SEASONAL-STUDY.md) checks 374,218 complete source journey instances and finds 58 additional active route records; its extra dates and geometry remain audit-only.

The [Bern/Basel completion review](GRAUBUENDEN-RAIL-COMPLETION.md) adds 30 Friday / 31 Sunday complete journeys: a bounded source-curve extension for Bern platform 50 and a single existing FOT DICH segment for ICE. All prior complete journeys and matched pairs remain identical; rail admission is 854/856 and 840/842. GeoShop’s public cableway/ski-lift product is now confirmed through its live metadata description, but dated geometry, route identities and dataset-specific reuse remain unverified. No local geometry or extra seasonal date is admitted.

The initial [cableway review](GRAUBUENDEN-CABLEWAYS.md) inventoried all 57 annual mountain routes and admitted six complete directed patterns on Rhäzüns–Feldis, Sils–Furtschellas and Bernina–Diavolezza (+151/+147). It reuses the pinned national FOT cableway archive, with installation Stand 2025-01-01 and attribution terms, independently of the unverified local component. Exact station-number matches have attachments below 7 m; all original rail/bus paths remain unchanged. Operator timetable endpoint discrepancies are documented without altering the pinned GTFS. Seventeen mountain routes are inactive on both dates; all 54 then-unreviewed annual mountain routes remained in the inventory.

The cableway expansion audits all 54 remaining annual mountain routes. Fourteen have exact two-station cabin candidates: three additional routes (Chur–Känzeli, Churwalden–Heidbüel, Celerina–Marguns) pass the unchanged limits; ten fail attachment checks; Samnaun is withheld despite a numeric pass because the operator documents summer 2026 L1 refurbishment and L2 operation. The additions preserve the initial three cableway axes and every earlier journey, adding 2,092 Friday / 2,094 Sunday instances, including 2,040 representative headways each day. All official supporting responses and rejected trials are preserved.

The funicular follow-up admits 213 complete instances per date on Schatzalp, Muottas Muragl and Davos Dorf–Höhenweg. Exact station identities attach within 1.5 m; all twelve previous aerial paths and every earlier journey are unchanged. All six annual funicular routes are audited, including the unreviewed upper Parsenn section and two inactive St. Moritz records. Official seasonal pages and timetable endpoint discrepancies are preserved.

<a id="ag"></a>


### AG — Aargau

**Authority/publisher:** Abteilung Verkehr; AGIS Service Center. **Review areas:** Aarau; Baden/Wettingen; Brugg; Lenzburg; Freiamt; Fricktal; Zurzibiet.

**Evidence:** AGIS.avk_oevlinien Shapefile acquired. DBF has 366 records with mode, line number, direction, itinerary, timetable field and GO operator code/name. It includes through-lines outside AG, e.g. AAGL 72. DBF properties and archive structure inspected; all coordinates now decoded in the canton adapter.

**Vintage:** Dataset filename and metadata: 23 April 2026. Normal timetable only; temporary diversions explicitly excluded. HTTP Last-Modified in September is not the geometry date.

**Reuse:** August 2024 terms: generally free use, required credit Daten des Kantons Aargau; API limit 20 requests/minute and WMS 10/minute. Preserve the supplied terms; do not relabel as CC0.

**Implementation:** The [Aargau canton audit](AARGAU-STUDY.md) now decodes all 366 line records and inventories all 5,142 national routes against the official canton boundary: 289 archived Aargau-calling routes across 23 agency identities. Friday/Sunday civil-day feeds retain 11,193 / 7,767 complete journeys, including preceding-day carry-in. AGIS plus explicitly inferred OSM bus and FOT rail geometry covers every full-journey segment occurrence on both dates, including all occurrences touching an Aargau stop. All Sunday night bus and rail occurrences, Hallwilersee loops, S36 and Rheinfelden bus 7312 now have geometry. The final Brugg service-loop and Bern extended-platform fixes close all 37 Friday / one Sunday gaps with unchanged projection guards and full regression preservation. Every retained directed pattern and stop pair has geometry. FOT catalogue date is July 2021, current validity unconfirmed, with exact operating-point and directed topology evidence. Every prior AGIS/OSM path is regression-preserved. Every source record, admitted route and geometry exclusion is documented; this is complete automatic geometry coverage for these two fixtures, not running-track certification or a deployed study.

**Seasonal follow-up:** The [twelve-date audit](AARGAU-SEASONAL-AUDIT.md) independently verifies 110,050 journeys and 1,821,846 calls, identifies 1,146 directed patterns absent from September and 12 newly active routes, and leaves 45 archived routes inactive in the sample. The [annual witness audit](AARGAU-ANNUAL-WITNESSES.md) now finds active dates for all 45, covered by 19 selected civil dates; their 2,019 archived trip templates introduce 280 directed patterns. A separate exact-template FOT policy adds 3,616 compatible occurrences, and an explicit Interlaken parent/track-group binding adds another 162, preserving every earlier path. A final exact-template Bern platform-50 projection and Waldshut corridor review adds the last 11 rail occurrences, preserving all 3,790 prior paths. All 194 rail patterns now have geometry. The [bus follow-up](AARGAU-WITNESS-BUS-REVIEW.md) inventories all 86 bus patterns and adds 2,466 AVA April occurrences, preserving all 3,801 prior paths. One bus pattern is complete; 4,721 occurrences across 85 incomplete bus patterns remain, including 161 source-time holds and 1,989 September AVA occurrences awaiting road-diversion evidence. A 460-pattern road extension fills 16,364 prior seasonal gaps, and 63 exact seasonal border/platform/rail rules fill another 583 occurrences, and two exact IC 1303 rules resolve Brig–Domodossola using pinned OSM rail topology and an official station-code association. All twelve samples now have complete geometric compatibility, preserving every prior path. A separate Friday review candidate corrects four occurrences on the evidenced line 136 Wittnau bypass and line 358 Seesteg direct variant; 222 of the original 224 flagged directed bus pairs remain under review. The missing FOT terminal is handled only by those two scoped OSM rail inferences; every original call and platform coordinate stays intact. The archived September feeds and their date-scoped exceptions remain unchanged.

**Next action:** Resolve the 222 remaining source-alignment review pairs and resolve the remaining 4,721 bus template geometry gaps, including the AVA source-time and road-diversion holds, on the newly witnessed routes before expanding release scope. Then integrate reviewed fixtures into the application. The complete route inventory supersedes the representative agency shortlist for Aargau membership.

**Checked references:** [ag-metadata](https://www.ag.ch/geoportal/geodatenshop/Datendokumentation.aspx?Datensatzelement=6224), [ag-lines](https://api.geo.ag.ch/v1/data/downloads/AGIS.avk_oevlinien/download/Shapefile/kanton_aargau), [ag-terms](https://www.ag.ch/geoportal/geodatenshop/Nutzungsbedingungen.aspx?Typ=NutzungsbedingungenAGIS1), [ag-download-detail](https://www.ag.ch/de/verwaltung/dfr/geoportal/geodaten/geodatenliste?rewriteRemoteUrl=/details/AGIS.avk_oevlinien?searchcontext%3D%C3%B6V-Linien).

<a id="tg"></a>

### TG — Thurgau

**Authority/publisher:** Canton Thurgau public transport planning; cantonal geoinformation. **Review areas:** Frauenfeld; Kreuzlingen; Weinfelden; Arbon/Romanshorn; Untersee; Hinterthurgau.

**Evidence:** The [Thurgau cantonal study](THURGAU-STUDY.md) preserves the complete official WFS export: 337 bus-line segments, 17 rail corridors, 337 bus-frequency records, 718 bus stops and four call-taxi areas. EPSG:2056 GML is decoded with explicit east/north axis, count and ID validation. The two accessibility-distance layers are inventoried as non-vehicle geometry.

**Vintage:** Geometry effective date remains unknown. WFS acquired 8 September 2026; the cantonal catalogue's modification timestamp is 31 July 2026. Its 1 January 2000 creation date and WFS response timestamps are not verified timetable vintages.

**Reuse:** The [cantonal dataset catalogue](https://data.tg.ch/api/explore/v2.1/catalog/datasets/netz-des-offentlichen-verkehrs) explicitly declares **CC BY 4.0**. The original declaration and general terms are preserved with source hashes and accompany the feed. Credit: Kanton Thurgau, Abteilung Öffentlicher Verkehr; Amt für Geoinformation. The city and regional road supplements are attributed OpenStreetMap-derived databases under ODbL 1.0. Federal rail infrastructure retains FOT attribution and opendata.swiss terms_by; the literal proprietary catalogue label is preserved. SBB Infrastructure / data.sbb.ch border curves retain terms_by attribution and pinned source evidence. The separate OSM Bregenz rail, Wittenbach turnaround, Romanshorn ferry and lake/Rhine shipping databases retain ODbL 1.0 and OpenStreetMap attribution. Shipping geometry is credited © swisstopo; original shoreline geometry © FOEN, swisstopo. The free-geodata terms, 2007 shoreline reference and unknown individual shipping-feature vintage accompany the feed. National GTFS and swisstopo boundaries retain their separate terms.

**Implementation follow-up:** The [complete route inventory](THURGAU-ROUTE-INVENTORY.md) covers **132 annual GTFS route records across 15 agency identities and all five districts**, retaining cross-border calls, boats, city networks, night, replacement and inactive services. Directed Friday/Sunday validation admits **4,360 / 2,724 complete journeys** across 109 route records, including 77 full OSM-inferred city patterns for all six Kreuzlingen and ten Frauenfeld fixed routes, plus 296 audited regional road patterns (292 complete) across 59 fixed regional route records. Federal rail infrastructure adds 169 unique complete patterns (476 Friday / 490 Sunday journeys), including an explicitly reviewed IC81 platform-group join at Interlaken Ost. Two detailed SBB border links close all Konstanz patterns, adding 61 unique full patterns (212 Friday / 207 Sunday journeys) across six route identities; all prior paths are regression-preserved. [Regional feed](../public/data/thurgau-region/index.json); [machine-readable audit](../data/thurgau-audit/summary.json). Frauenfeld NT and GTFS type-715 RUB remain excluded as demand-responsive. The four original Wittenbach zero-distance matcher failures now use a separately pinned 224 m mapped-road turnaround, adding 37 Friday journeys with both original calls and subsequent matcher slices preserved. All 3,361 Friday / 1,754 Sunday fixed bus journeys now have complete geometry. The turnaround remains explicit OSM inference, with 6.72 / 4.08 m platform attachments and no operator-routing certification. A dated OSM rail graph admits all 10 Friday / 14 Sunday Bregenz S7 journeys through St. Margrethen platforms 2/3. One exact passenger-tagged siding connection resolves platform 2 without relaxing turn or attachment guards; all previously admitted paths are preserved. All 919 Friday / 895 Sunday rail journeys now have full geometry. Official swissTLMRegio shipping curves now admit 26 boat journeys per date across four route identities, including all dated Reichenau solar-ferry and Radolfzell journeys. The scoped OSM Romanshorn–Friedrichshafen ferry adds 32 Friday / 28 Sunday journeys across both SBS/BSB identities and both directions, using named way 26255860 with 10 m dock limits. Those stages admit 58 / 54 boat journeys. Eight exact OSM lake/Rhine ways and a pinned Rhine water polygon now add 22 Friday / 21 Sunday journeys, retaining successful official segments and complete original dock chains. Total boat admission is 80 / 75 across all seven boat route identities. Twelve boat journeys per date remain excluded: Mainau (2), the Immenstaad loop (1), and longer URh lake/Seerhein patterns (9). The ferry source is historical state 2026-09-02; way version 25 was edited 2025-11-05 and acquired 2026-09-08. This is explicitly inferred routing; all previously admitted paths remain unchanged. The Bregenz SBB response contains only schematic two-point lines; the original 8,714-vertex FOEN Lake Constance feature is now acquired and screened alongside the display polygon. That Bodensee-only screening leaves 17 docks more than 150 m from water and no complete direct-water journey. A separate 30-tile acquisition now inventories 69 official shipping curves and acquires original Untersee geometry; six complete boat patterns pass with 150 m dock attachment and disclosed dock-area shoreline discrepancies. The additional Rhine source closes all dated Schaffhausen–Büsingen–Diessenhofen journeys in both directions. Its relation 1679977 v3 (2026-01-19 edit; historical state 2026-09-02) retains the complete outer boundary and island hole. Remaining lake/Seerhein patterns still fail whole-pattern admission. The source operator-tag conflict at Meersburg and its bounded dock-area shoreline discrepancy are explicitly audited. SBB catalogue modification is 2026-07-29 and data processing 2026-09-02, with no individual feature survey date established. FOT source Stand dates are 2021-07-06, with an asset update on 2025-01-18; this is not certified 2026 alignment geometry. This is a whole-canton inventory with partial geometry admission, not year-round or physical-direction certification.

**Checked references:** [tg-wfs](https://ows.geo.tg.ch/geofy_access_proxy/oev?Request=GetCapabilities&Service=WFS&Version=2.0.0), [tg-count](https://ows.geo.tg.ch/geofy_access_proxy/oev?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms%3Abuslinie&RESULTTYPE=hits), [tg-sample](https://ows.geo.tg.ch/geofy_access_proxy/oev?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms%3Abuslinie&COUNT=3&SRSNAME=EPSG%3A4326), [tg-terms](https://shop.geo.tg.ch/sites/default/files/pdf/Nutzungsbedingungen_Geodaten.pdf).

<a id="ti"></a>

### TI — Ticino

**Authority/publisher:** Sezione della mobilità / Ufficio dei trasporti pubblici; Centro di competenza geoinformazione. **Review areas:** all eight districts, with explicit Luganese, Bellinzonese, Locarnese, Mendrisiotto, Leventina/Blenio, Vallemaggia and Centovalli controls.

**Implemented:** [Initial regional study](TICINO-STUDY.md), [complete route inventory](TICINO-ROUTE-INVENTORY.md) and [coverage audit](../data/ticino-audit/summary.json). All national routes and stop times scanned; 209 canton route candidates across 32 agency identities. Pinned national timetable, reviewed FOT rail topology and attributed OSM bus inference. Whole admitted journeys are available in the application on 4 and 6 September 2026; all exclusions remain audited.

**Official local evidence:** WFS (314 feature types), WMS and download catalogue acquired. No TI-12 bus-line vectors found. The legal catalogue identifies **TI-12** as the public transport network; **TI-11** is cantonal road axes, correcting the earlier survey. Related accessibility, topographic infrastructure and cable installation layers are not a dated bus-line export.

**Vintage/reuse:** No acquired TI-12 line vintage established. Official access-A data permit use, modification, redistribution and commercial use with “Fonte: Amministrazione cantonale - Canton Ticino”. WFS capabilities still request formal contact. The initial study separately preserves timetable, FOT, swisstopo and ODbL terms.

**Next action:** Obtain TI-12 distribution and dated cross-border identities; resolve rail, bus, mountain and lake exclusions and additional seasons. [Investigation and hashed source evidence](../data/ticino-sources/local-geometry-review.json).

**Checked references:** [services](https://www4.ti.ch/dt/sg/sai/ugeo/temi/geoportale-ticino/geoportale/geoservizi), [WFS](https://wfs.geo.ti.ch/service?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities), [download catalogue](https://data.geo.ti.ch/), [legal catalogue](https://www3.ti.ch/CAN/RLeggi/public/index.php/raccolta-leggi/legge/num/565), [reuse terms](https://www4.ti.ch/dt/sg/sai/ugeo/temi/geoportale-ticino/geoportale/condizioni-utilizzo).

<a id="vd"></a>

### VD — Vaud

**Authority/publisher:** Direction générale de la mobilité et des routes; Direction du cadastre et de la géoinformation / viageo. **Review areas:** Lausanne; La Côte/Nyon; Morges; Nord vaudois; Broye; Riviera; Pays-d’Enhaut; Chablais.

**Evidence:** Transports publics (complet) documents road, rail, lake lines and commercial stops. Lines continuing into neighbouring cantons are digitised in full. XML metadata links WMS road/rail/lake layers. The export is supplied through an order workflow; no vector export acquired.

**Vintage:** Data 6 March 2026; metadata 5 June 2026; annual update in first quarter.

**Reuse:** Catalogue advertises CHF 1/km², minimum CHF 1/maximum CHF 3,000 plus CHF 25 per order, with conditional exemptions. Licence/order conditions require resolution for the intended delivery; no exemption assumed.

**Next action:** Resolve distribution cost and reuse terms, then audit the whole canton. Existing Lausanne/tl work is not evidence for Nyon, TRAVYS, Riviera or Chablais bus coverage. Representative GTFS agencies: `11`, `23`, `29`, `42`, `55`, `64`, `66`, `97`, `151`, `184`, `738`, `741`, `764`, `818`, `876`, `895`.

**Checked references:** [vd-metadata](https://viageo.ch/md/599d9cd5-1218-4372-8783-43cd5c5bc4dc), [vd-xml](https://viageo.ch/geodonnee/metadonnee/599d9cd5-1218-4372-8783-43cd5c5bc4dc.xml).

<a id="vs"></a>

### VS — Valais / Wallis

**Implemented:** The [Valais initial study](VALAIS-STUDY.md) inventories 385 annual route records across 78 agencies and all 13 districts. Complete Friday/Sunday feeds admit 5,102 / 3,445 journeys using reviewed gauge/operator-scoped FOT rail and attributed full-pattern OSM buses. Every candidate, inactive route, geometry exclusion and reuse term is audited. The renewed local investigation retains all 247 public catalogue items and current service metadata; no operational cantonal line export or dataset-specific vector licence was established.

**Authority/publisher:** Service de la mobilité; Centre de compétence géomatique. **Review areas:** Monthey/Chablais; Martigny; Sion; Sierre; Leuk/Visp/Brig; Goms; Side valleys.

**Evidence:** Official geodata inventory row 376 identifies Transport en commun / Öffentlicher Verkehr, owner SDM. Its publication/download channel cells are blank. This establishes a data lead, not a current open line export. Geoservices portal is reachable.

**Vintage:** Inventory generated 26 August 2026; transport dataset row dated 5 July 2018.

**Reuse:** No public-vector distribution channel or dataset licence established.

**Next action:** Locate current SDM data and review Rhône valley plus each side valley, separating RegionAlps, TMR, MGB, TPC and local bus identities. Representative GTFS agencies: `23`, `48`, `61`, `74`, `93`, `142`, `713`, `714`, `765`, `801`, `814`, `818`, `835`, `855`.

**Checked references:** [vs-inventory](https://www.vs.ch/documents/17311/17591/Inventaire%2Bdes%2Bg%C3%A9odonn%C3%A9es%2B-%2BInventar%2Bder%2BGeodaten/2fd849d0-ab9f-4bfc-965a-3920ebd18a08), [vs-services](https://geo.vs.ch/geoservices), [vs-portal](https://geo.vs.ch/).

<a id="ne"></a>

### NE — Neuchâtel

**Authority/publisher:** Canton Neuchâtel transport planning; SITN. **Review areas:** Neuchâtel littoral; La Chaux-de-Fonds; Le Locle; Val-de-Ruz; Val-de-Travers.

**Evidence:** Public SITN WMS capabilities and services documentation checked. No transport line export verified in that service. Published stop metadata and transport digitisation documentation are leads, not an acquired bus graph. transN spans multiple rail, bus and funicular identities.

**Vintage:** No acquired line-layer vintage established.

**Reuse:** No bus-line dataset-specific terms established.

**Next action:** Resolve line-layer distribution with SITN metadata, then audit all transN feed identities and through operators rather than a single brand match. Representative GTFS agencies: `11`, `33`, `44`, `73`, `153`, `156`, `166`, `792`, `796`, `15300`.

**Checked references:** [ne-services](https://sitn.ne.ch/services/), [ne-wms](https://sitn.ne.ch/services/wms?SERVICE=WMS&REQUEST=GetCapabilities).

<a id="ju"></a>

### JU — Jura

**Authority/publisher:** Service du développement territorial / transports; SIT Jura. **Review areas:** Delémont; Ajoie/Porrentruy; Franches-Montagnes; Clos du Doubs; Moutier interface.

**Evidence:** WMS advertises ju.sdt_09_07_lignes_de_bus, night-bus and railway layers. WFS does not advertise those transport layers. Bus-layer XML metadata returned, but its distribution links are rendered images; the PDF and geodata-inventory endpoints returned 500.

**Vintage:** Bus-line geometry vintage unresolved.

**Reuse:** WMS rendering and image download do not grant raw-vector redistribution rights.

**Next action:** Locate vector distribution and terms, map MOBIJU branding to actual feed routes, and audit night lines, French termini and current administrative boundaries. Representative GTFS agencies: `11`, `43`, `801`, `833`.

**Checked references:** [ju-wms](https://geoservices.jura.ch/wms?SERVICE=WMS&REQUEST=GetCapabilities), [ju-wfs](https://geoservices.jura.ch/wfs?SERVICE=WFS&REQUEST=GetCapabilities&VERSION=2.0.0), [ju-bus-wms-metadata](https://geoservices.jura.ch/wms?request=GetMetadata&layer=ju.sdt_09_07_lignes_de_bus), [ju-bus-metadata](https://geo.jura.ch/geodonnees/fiches/Fiche_SDT_9_07_Lignes_de_bus.pdf), [ju-inventory](https://geo.jura.ch/geodonnees).

<a id="ge"></a>

### GE — Genève

**Authority/publisher:** Office cantonal des transports; TPG / SITG. **Review areas:** Genève core; Cantonal outskirts; French cross-border branches; Lake and Léman Express interfaces.

**Evidence:** TPG_LIGNES metadata and ArcGIS GeoJSON samples are accessible. Fields include LIGNE, NOM_LIGNE, DIRECTION, VEHICULE and TYPE_SERVICE. OBJECTID is explicitly not a permanent identifier. Existing TPG integration is a baseline; lake and Léman Express are separate operator/geometry scopes.

**Vintage:** Metadata advertises twice-yearly updating and publication 12 June 2025; metadata refresh on 8 September 2026 is not a new geometry vintage.

**Reuse:** SITG marks access as free but dataset use restrictions are unfilled. Preserve existing SITG/TPG credits and resolve applicable reuse terms for any new redistribution.

**Next action:** Refresh the pinned line data and revalidate directed branches and French termini; include boats and railway records through explicit route scoping. Representative GTFS agencies: `11`, `184`, `199`, `881`.

**Checked references:** [ge-layer](https://sitg.ge.ch/donnees/tpg-lignes), [ge-service](https://vector.sitg.ge.ch/arcgis/rest/services/TPG_LIGNES/MapServer?f=pjson), [ge-sample](https://vector.sitg.ge.ch/arcgis/rest/services/TPG_LIGNES/MapServer/0/query?where=1%3D1&outFields=*&outSR=4326&resultRecordCount=3&f=geojson).

## Recommended implementation sequence and remaining checks

This ordering is engineering judgement based on the evidence above, not a measured ranking of entire regions.

1. **Complete the existing Basel and Lausanne audits on their own terms.** Their latest detailed reports take precedence over this broad survey for measured route/path admission. Keep Zürich and Genève source refreshes distinct from geographical expansion.
2. **Implement reusable official-line adapters for Bern and Aargau; extend to Luzern.** Bern has line/operator attributes and documented reuse, Aargau adds direction and GO codes, and Luzern has explicit 2026 line identifiers. Do not assume their code systems are interchangeable. These are the most useful next full joins.
3. **Continue Zug coverage; evaluate Fribourg and Thurgau.** Zug's archive/WFS reconciliation and full-canton timetable inventory now support a partial regional bus/rail feed; the [detailed audit](ZUG-STUDY.md) records remaining branches, modes and vintage limits. Fribourg now has a full census, source adapter and local archival feed; vector reuse is resolved; geometry vintage, physical direction and failed-pattern coverage remain unresolved; Thurgau now has a full source adapter and dated admission audit; lake/Rhine geometry gaps and true cantonal geometry vintage remain unresolved; fixed city/regional buses have audited OSM supplements, inland rail has a federal infrastructure supplement, and Konstanz uses explicit detailed SBB border joins.
4. **Continue Solothurn network coverage.** The full-canton census, mode-filtered graph and exact-junction audit now produce complete Friday/Sunday stop patterns. Road/rail/boat/tram supplements and twelve seasonal dates are now audited. Review remaining alignment disagreements and excluded full patterns; source segments are not certified operator route shapes.
5. **Resolve SG redistribution and distribution for BL, VD, JU and NW.** SG now has an acquired source adapter and audited local feed, with publication permission unresolved; BL advertises an export; VD has a priced order workflow; JU/NW expose transport maps. The canton entries record the precise next action without pretending acquisition succeeded.
6. **Continue source discovery or measured road matching for UR, SZ, OW, GL, SH, AR, AI, TI, GR, VS and NE.** Prioritise a regional route inventory first so that an official source, operator contribution or inferred path can be judged against an explicit denominator.

Before calling a region complete, produce an admission/exclusion inventory for all selected routes and operators, with unambiguous border scope. Evaluate normal weekday, Sunday/holiday, night and seasonally distinct service dates; add winter mountain and summer pass/boat cases as appropriate. Two September service dates do not establish year-round completeness. Include demand-responsive services as such, rather than inventing fixed movements from their service areas.

For each geometry adapter, preserve source hash, true data vintage, coordinate system, licence/credit, operator/line mapping and transformation parameters. Test every admitted directed stop pattern; report failures by operator/mode, unique directed stop pair and scheduled segment occurrence. Check terminals, loops, bridges, tunnels, stacked tracks, one-way streets and foreign termini. Distinguish surveyed normal alignments from temporary diversions. Do not suppress unresolved paths or label interpolation as measured movement. Existing [Basel](BASEL-STUDY.md) and [Lausanne](LAUSANNE-STUDY.md) reports provide the more detailed precedent.

Source discovery is the completed deliverable here. The unresolved items are documented adapter, acquisition or licence questions; no full-canton geometry coverage percentage is implied by the source counts.

## Reproduction and verification

Run from the repository root. The agency census requires the repository's installed `@motionstudies/data` package, Node and `unzip`; probes use Python's standard library plus `curl`. Realtime parsing and offline checks do not require authenticated services.

```sh
# Offline cross-file consistency: no network or large archives required.
node scripts/check-swiss-transit-survey.mjs

# Regenerate the full agency census from the pinned downloaded archive.
node scripts/audit-swiss-transit-agencies.mjs \
  /private/tmp/GTFS_FP2026_20260902.zip \
  2026-09-04,2026-09-06 data/swiss-transit-agencies.json

# Refresh live public checks; results and hashes may change.
python3 scripts/probe-transit-sources.py \
  data/swiss-transit-sources.json data/swiss-transit-source-probes.json \
  /private/tmp/gleislicht-national-survey

# Preserve all official realtime flags/comments in machine-readable form.
python3 scripts/catalogue-swiss-realtime.py \
  /private/tmp/gleislicht-national-survey/national-rt-csv.body \
  data/swiss-transit-source-probes.json data/swiss-transit-realtime-catalogue.json

# Re-inspect previously downloaded bytes without fetching newer data.
python3 scripts/probe-transit-sources.py \
  data/swiss-transit-sources.json data/swiss-transit-source-probes.json \
  /private/tmp/gleislicht-national-survey ALL --inspect-cache
```

An optional fourth probe argument selects comma-separated source IDs and merges results. Keep access checks narrowly scoped and respect each publisher's limits; a failed speculative URL is not evidence that the publisher lacks data. Review response contents and update the canton narrative after a refresh: the script's expected-format flag deliberately does not infer semantic validity, licences or transit completeness.

Validation for this survey: all 26 standard canton codes occur once; all representative agency IDs exist in the pinned census; all cited probe IDs resolve; source/probe URLs and registry hash agree; agency daily aggregates and realtime category totals reconcile; each canton has a documentation anchor. Cached-response hashes were verified during offline reinspection. Source acquisition and these consistency checks are separate from the future geometry joins described above.
