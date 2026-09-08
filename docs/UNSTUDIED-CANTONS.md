# Eleven cantons: study opportunities and remaining evidence

Reviewed **9 September 2026**: Uri (UR), Schwyz (SZ), Obwalden (OW), Nidwalden (NW), Glarus (GL), Schaffhausen (SH), Appenzell Ausserrhoden (AR), Appenzell Innerrhoden (AI), Neuchâtel (NE), Jura (JU) and Basel-Landschaft (BL).

**All eleven have a credible next study.** The useful choices are several regional extensions, two shared study areas and a few focused new compositions. Eleven independent full-canton implementations would duplicate work. My recommended first implementation is an **Obwalden–Nidwalden rail-and-bus study**, reusing the Luzern foundation; **Basel-Landschaft's missing regional buses** are the strongest source-acquisition follow-up. **Neuchâtel** offers the most distinct new urban/regional composition, and **Glarus** the best bounded rural pilot.

“No study work” needs a narrower definition. All eleven already have entries in the [national source survey](SWISS-TRANSIT-SOURCE-INVENTORY.md), and some have substantial service coverage in neighbouring studies. What is missing is a dedicated canton-level timetable denominator, explicit admission/exclusion accounting and a study decision for each. This review supplies the decisions and evidence leads; it does **not** claim to have built or validated eleven new feeds.

## Method and evidence limits

I inspected the existing source inventory, pinned national agency census, Basel core, Luzern and St. Gallen route audits, and Rigi/Pilatus studies. I then checked official cantonal, operator and metadata pages for the proposed networks and unresolved sources. Links beside findings identify the external evidence; the [supporting evidence snapshot](../data/unstudied-cantons-review.json) retains selected feed identities, existing route results and hashes of the local inputs examined.

The national census is feed **20260902**, with Friday **4 September** and Sunday **6 September 2026** samples. Its agency totals cover each agency's **entire feed footprint**, include frequency templates once, and are neither canton totals nor complete regional membership. No new stop-time or polygon census was run for these eleven cantons. Existing Luzern/SG counts below are already admitted **civil-day journey instances**, with different semantics from the agency census. Basel uses feed **20260905** and **8/13 September**; do not merge those fixtures by date or line number alone.

Existing WMS/WFS findings below are explicitly inherited from the **8 September source probes**, not eleven freshly acquired vector datasets. This follow-up did resolve additional BL metadata and inspect current network/operating information. A map, a stop layer and a street network each answer different questions; none alone supplies validated directed passenger-service paths. Failed or inconclusive acquisition does not establish that a publisher has no data.

## Decisions at a glance

Priority expresses suggested next work, not measured implementation effort. “Start” means begin a scoped census and geometry pilot; it does not mean ready for publication.

| Canton | Recommended first composition | Relationship to existing work | Decision / first unresolved item |
| --- | --- | --- | --- |
| UR | Altdorf–Flüelen–Erstfeld interchange and valley buses | Luzern Tellbus, national rail/PostBus, Rigi lake context | Start a valley pilot; acquire or infer AAGU paths |
| SZ | Arth-Goldau–Schwyz–Brunnen with Muotatal feeders | Rigi and Luzern bus 502; Zug interfaces | Start an inner-canton extension; separately inventory Einsiedeln and March/Höfe |
| OW | Sarnen/Brünig plus Engelberg | Luzern Zentralbahn and Pilatus | First implementation, jointly with NW; complete local-bus scope and retain Engelberg |
| NW | Stans rail pulse and lake/valley feeders | Luzern Zentralbahn, lake and mountain work | First implementation, jointly with OW; resolve NW075 vectors or bus matching |
| GL | Schwanden interchange: main valley, Sernftal and Braunwald connection | National rail/PostBus; possible SG interfaces | Best small independent pilot; Sernftal geometry and headway semantics |
| SH | Schaffhausen/Neuhausen and regional bus spokes | National rail, neighbouring TG/ZVV services | Strong separate regional study; both vbsh identities and German road coverage |
| AR | Appenzeller rail branches and Herisau buses | Substantial SG route work | Joint AR/AI study; separate canton inventories and SG reuse constraints |
| AI | Appenzell–Wasserauen with fixed feeders and a clearly separate PubliCar explanation | AB rail in SG; national timetable | Joint AR/AI study; Oberegg and demand-responsive coverage need explicit accounting |
| NE | Littoral–mountains contrast, with Neuchâtel funicular connections | National rail; neighbouring studies only as possible donors | Highest-value new composition; resolve SITN line distribution or bus matching |
| JU | Delémont pulse, Ajoie branches and Franches-Montagnes | National rail/PostBus; BE/SO interfaces | Start a dated rural-network study; Moutier boundary and bus-layer export |
| BL | Liestal/Sissach/Laufental buses around the existing Basel core | Already extensive Basel BVB/BLT and bounded rail | First source-acquisition follow-up; inspect 2024 TNW export against 2026 service |

## UR — Uri

**What it adds.** A compact study could show long-distance and regional trains arriving at Altdorf and Flüelen, then buses distributing into the Reuss valley. A later Göschenen–Andermatt and summer-pass composition would add a different mountain rhythm. The canton's [2026 service notice](https://www.ur.ch/mmdirektionen/131678?_display-mode=a11y) identifies the SOB mountain-route stops, AAGU, the Winkelriedbus/Stans–Seelisberg connections and seasonal pass services. These are useful scope witnesses, not replacement timetable data.

**Existing foothold.** Luzern's route audit already admits Tellbus **493**, route `92-493-A-j26-1`, with **28 Friday / 5 Sunday** journeys. [AAGU's timetable page](https://www.aagu.ch/fahrplan) confirms the Altdorf–Luzern connection through the Seelisberg tunnel. That work covers one connection, not AAGU's local network. The pinned agency census also contains AAGU `816`, MGB bus `851` and Ortsbus Andermatt `7095`; the latter has annual routes but zero active records on both sample dates. It must remain a seasonal candidate.

**Next concrete work.** Census all UR-calling trips, then pilot one complete AAGU valley route in both directions, with Altdorf station access and a rail connection. The earlier Uri WFS exposes stops and cableway axes but no verified bus-line export. Seek the line source through the canton's public-transport/GIS team; an attributed OSM match is a viable fallback. Review tunnel routing explicitly. Do not promote all cableway axes to passenger services: freight/ski installations and operating calendars need separate evidence. **Proceed with the valley; defer a whole pass network until seasonal witnesses are available.**

## SZ — Schwyz

**What it adds.** Connect the existing Rigi composition to everyday travel around Arth-Goldau, Schwyz and Brunnen. A bus-to-mountain branch toward Muotathal/Schwyz Stoosbahn is a clear first extension. [AAGS's 2025/26 timetable page](https://www.aags.ch/fahrplan) identifies line 501 via Goldau–Schwyz–Muotathal, line 502 along the lake and a connection to Rotkreuz on 526. It also warns that construction can supersede its downloadable timetables: use dated GTFS and notices together.

**Existing foothold.** Rigi already includes the Arth-Goldau railway approach. Luzern admits **28/29 journeys** of AAGS route `92-502-A-j26-1`; those are the LU-calling subset, not all journeys of the passenger-facing line. AAGS `841` has **23 annual route records** in the national census, while Freienbach `755` is a separate identity. Neither an AAGS-only extraction nor a Rigi view represents the whole canton.

**Next concrete work.** Build an all-mode canton census with explicit Schwyz/Brunnen, Küssnacht, Einsiedeln and March/Höfe review groups. Test whether retained Luzern/Zug patterns match the new fixture exactly, then fill the bus gaps. The prior Schwyz catalogue probe found no verified bus-line vector export; the newly checked [official stop dataset](https://data.sz.ch/explore/dataset/haltestellen-des-offentlichen-verkehrs/) is an anchor source, not route geometry. Add Stoos only after its own funicular/cableway and frequency review. **Start with inner Schwyz; keep the eastern canton as visible unimplemented scope.**

## OW — Obwalden

**What it adds.** Sarnen and the Brünig corridor offer a strong contrast to the separate Engelberg valley. A shared OW/NW study follows the actual Zentralbahn network while still exposing which parts of each canton are represented. The operator [describes its Luzern–Engelberg and Luzern–Interlaken network](https://www.zentralbahn.ch/de/kennenlernen/die-zentralbahn/zahlen-und-fakten); canton boundaries should select relevant journeys, not cut them in half.

**Existing foothold.** The [Luzern audit](LUZERN-STUDY.md) already admits complete S5, S55 and interregional Zentralbahn route patterns, including external calls. [Pilatus](PILATUS-STUDY.md) is already a dedicated Alpnachstad–summit study with 34 dated trains. These are substantial OW-related assets, but leave Sarnen-area buses, side valleys and Engelberg local transport unaudited at canton scale. Engelberger Auto-Betriebe `7058` has **8 annual route records**, with active service on both national census dates.

**Next concrete work.** Use the complete OW MultiPolygon, including the Engelberg exclave, and keep the main valley and Engelberg as distinct review groups. Reuse exact Zentralbahn patterns; add local buses through verified official paths or OSM. Check Engelberg works/replacement buses against the fixture: the [operator's site](https://www.zentralbahn.ch/) advertised Bodenkurve works for **2 August–5 September 2026**, overlapping the Friday sample. Mountain operators around Engelberg require their own scope and headway checks. The earlier OW WMS provided no verified transit-line layer. **Proceed jointly with NW; do not let existing Pilatus coverage substitute for local mobility.**

## NW — Nidwalden

**What it adds.** Centre the study on Stans: regional rail arrives, buses fan toward the lake and valley, and selected mountain connections form a later layer. The canton's [2025/26 transport funding report](https://www.nw.ch/_docn/380626/03_Bericht_Rahmenkredit_oeV_202526.pdf) enumerates rail, buses, night services and cableways, including services outside the federally subsidised group. It is a completeness checklist, not a geometry licence or timetable.

**Existing foothold.** Luzern admits Zentralbahn **S4 82/82** and **S44 14/2** journeys. Other Luzern lake/mountain artifacts can supply reviewed methods and exact-pattern candidates, but their LU-calling denominator omits NW-only journeys. Beckenried–Gersau ferry `3190` is a separate feed identity from SGV `185`.

**Next concrete work.** Resolve the earlier WMS layer **NW075 / `ch.nw.oeffentlicher-verkehr`** through GIS Daten AG: obtain the underlying line export, schema, date and derived-asset reuse terms. NW076 cableways must be treated separately. If the line export remains unavailable, route one complete Stans feeder with OSM and carry exclusions forward. Validate lake endpoints/water paths independently; a rail/bus first release need not wait for every mountain installation. **Proceed with OW, retaining a separate NW completeness report.**

## GL — Glarus

**What it adds.** Schwanden is a promising small interchange composition: rail along the main valley, Sernftal buses toward Elm, and a southern continuation toward Linthal/Braunwald. This is a manageable hypothesis for a rural study, not a measured cost estimate. The [Sernftal operator timetable listing](https://sernftalbus.ch/de/fahrplan.html) supplies line and cantonal-network review leads; search retrieval found it, while direct page retrieval returned 403 in this pass, so no detailed timetable was independently acquired from that page.

**Existing foothold.** National rail and PostBus provide baseline methods; they do not cover the distinct Sernftal agency `856`, whose census contains **7 annual route records**. Braunwald `105` has frequency templates on both dates: a raw trip-record total substantially understates expanded movement instances, and those instances may be representative headways rather than scheduled departures. Walensee shipping `197` needs its own water-path review.

**Next concrete work.** Census Glarus Nord, Glarus and Glarus Süd; choose a complete Schwanden–Elm bus pattern for an OSM geometry pilot, checking terminal loops and access roads. The earlier GL WFS had no verified passenger-line layer. Add Braunwald only when timetable semantics and funicular alignment agree. Retain Klöntal, other side valleys and seasonal services in the inventory even if absent on the chosen day. **Proceed as a compact rail/bus study, with mountain and water additions staged separately.**

## SH — Schaffhausen

**What it adds.** The city/Neuhausen bus pulse and quieter Klettgau/Reiat spokes can share one clock. Border geography gives the study a distinctive shape, but a rectangular city crop would hide important gaps.

**Evidence and scope.** The [vbsh network page](https://www.vbsh.ch/fahrplan/liniennetz) explicitly excludes **Stein am Rhein, Buchberg and Rüdlingen** from its coverage claim. Its linked [2026 regional map](https://api.vbsh.ch/fileadmin/data/assets/pdf/dateien-2026/netzplan-region-schaffhausen-2026.pdf) is a review aid. The national census splits vbsh into **836 and 846**, with **13 and 12 annual route records** respectively. Those identities are not substitutes for all SH-serving operators. Include the separate canton pieces, Büsingen interfaces and relevant foreign termini; do not treat Büsingen as Swiss territory.

**Next concrete work.** Begin with both vbsh identities plus rail, then reconcile the full canton-stop census against the omitted areas and other operators. Obtain a line export or prepare road matching with sufficient German OSM extent. A Swiss-only road extract can truncate a valid whole journey. Resolve one cross-border pattern and one urban loop before scaling. Existing TG/ZVV assets are candidate donors only where operator, route, date and ordered platforms match. Rhine/Untersee shipping `193` is a later seasonal layer. The earlier SH OGD search found traffic-load data, not transit alignments. **Proceed as a separate regional study, with border controls built into its first pilot.**

## AR — Appenzell Ausserrhoden

**What it adds.** A joint Appenzellerland study could connect the AB rail branches with Herisau and the local buses, while preserving AR's own western, central and eastern review areas. The [cantonal commissioning page](https://ar.ch/verwaltung/departement-bau-und-volkswirtschaft/departementssekretariat/fachstelle-oeffentlicher-verkehr/fahrplan-und-bestellverfahren/) lists AB, SOB, Thurbo, PostAuto and Regiobus/Verkehrsbetriebe Herisau. That independently demonstrates why AB alone is too narrow.

**Existing foothold.** The SG audit contains all nine annual AB rail records. Examples already fully admitted are **S21 78/74**, **S22 36/0** and **S23 60/59** journeys. S20's four Friday candidates remain excluded. These are SG-calling patterns, not AR totals. Herisau `799` has **5 annual route records** in the national census; AB bus `744` is separate from rail `22`.

**Next concrete work.** Census AR independently of SG/OSTWIND, then compare complete AB patterns before reusing geometry. Add a Herisau bus pilot and retain the eastern branches in the scope. The prior AR WMS did not establish a line export. Critically, [SG's source terms](ST-GALLEN-STUDY.md#acquisition-dates-and-attribution) leave redistribution of its raw/derived vectors unresolved; its local feeds are not automatically public reusable assets. A public Appenzell study can instead build from appropriately licensed FOT/OSM inputs and use the SG audit as evidence. **Proceed jointly with AI; keep separate canton denominators and source rights.**

## AI — Appenzell Innerrhoden

**What it adds.** Appenzell–Wasserauen rail and fixed feeders offer a focused Alpine study. A separate explanation of flexible service would show why public transport coverage can exist without a fixed animated route.

**Evidence and scope.** [PubliCar Appenzell](https://www.postauto.ch/de/fahrplan-und-netz/publicar/appenzell) is explicitly a reservation-based, door-to-door service. The publisher also describes extensions to Teufen, Stein and Gais in AR. An operating area and service hours do not reveal actual journeys, departure times or vehicle positions. The prior AI WMS search did not establish fixed bus-route geometry. Existing AB work is useful but does not establish complete Innerrhoden coverage.

**Next concrete work.** Include every AI polygon component, especially **Oberegg**, rather than only the Appenzell basin. Inventory fixed AB/PostAuto services and the separate mountain identities, including Ebenalp `215` and Hoher Kasten `253`, against source calls. Start with rail plus any fixed feeder that passes whole-pattern checks. PubliCar may have a source-linked explanatory card; only add a geographic area if reusable boundary evidence is obtained. **Proceed within the joint AR/AI study; defer demand-responsive vehicle animation unless a suitable actual service dataset becomes available.** A fixed timetable fabricated from operating hours would be misleading.

## NE — Neuchâtel

**What it adds.** A littoral-versus-mountains composition would connect Neuchâtel's urban/funicular pulse with La Chaux-de-Fonds, Le Locle and the valleys. It adds a French-speaking urban/regional network distinct from the existing Léman studies.

**Evidence and scope.** The [transN plan collection](https://www.transn.ch/plans/) has network, sector, night and interchange plans valid from **14 December 2025**. The [2026 network plan](https://www.transn.ch/fileadmin/transn/pdf/Plans/plan_reseau_2026_transN.pdf) distinguishes rail, bus, funicular, boat and seasonal services. The pinned census spreads the network across `44`, `73`, `153`, `156`, `166`, `792`, `796` and `15300`; additionally, **replacement publisher `7255` has four annual route records** and must be checked. These are seeds, not an exhaustive brand-to-canton crosswalk.

**Next concrete work.** Ask the SITN distribution question precisely: the inspected [TP02 metadata](https://sitn.ne.ch/geoshop2_api/metadata/tp02_arrets_tp/html/) describes **stops**, while the [transport digitisation guide](https://sitn.ne.ch/web/metadonnees/GuideSaisieTransportsPublics.pdf) describes a line database. Neither establishes a downloadable current line graph. Resolve that graph's identifier, version, direction/branch schema and reuse terms; otherwise use FOT plus OSM. Pilot the Neuchâtel station/funicular connection and one urban bus route, then inventory all five review areas: littoral, La Chaux-de-Fonds, Le Locle, Val-de-Ruz and Val-de-Travers. Keep LNM `189`, other through operators, night and seasonal services visible as candidates. **Prioritise as the next genuinely new regional composition after the first reuse-led extension.**

## JU — Jura

**What it adds.** Delémont's arrival/departure pulse can open into Ajoie and the Franches-Montagnes. The official [RER Jura launch notice](https://www.jura.ch/fr/Autorites/Administration/CHA/SIC/Centre-medias/Communiques-2025/Le-RER-Jura-est-lance.html) describes the 2026 Delémont–Porrentruy–Delle/Bonfol structure and late returns. This makes both connections and preceding-day carry-in relevant first-class study elements.

**Evidence and scope.** [MOBIJU's operator explanation](https://www.mobiju.ch/A-propos-de-Mobiju-bus-jura) says its bus operation is entrusted to PostAuto; the brand is not a separate GTFS agency filter. Retain CJ rail `43`, CJ bus `833`, national operators and all other geographically selected candidates. The [official Moutier transfer record](https://www.jura.ch/fr/Autorites/Moutier/Communiques-de-presse/Moutier-dans-le-Jura-Communiques-de-presse.html) establishes **1 January 2026** as the change date. For September 2026, Moutier belongs in the JU denominator, not merely an optional Bern border extension.

**Next concrete work.** Verify the boundary edition with a named Moutier stop control before the full census. The prior WMS exposed `ju.sdt_09_07_lignes_de_bus`, night buses and rail; the WFS did not advertise those line layers. XML metadata yielded image distributions, and PDF/inventory requests failed. Resolve the raw line distribution through SIT Jura, or route PostAuto/CJ bus patterns with OSM. Keep Delle and complete cross-canton journeys; add Friday/Saturday-night witnesses rather than inferring the night network from Friday/Sunday daytime counts. **Proceed as a rural regional study; boundary correctness and night semantics precede claims of canton completeness.**

## BL — Basel-Landschaft

**What it adds.** Extend Basel outward around Liestal, Sissach, Laufen and their bus feeders, rather than duplicate its urban core. The [current Basel core](BASEL-CORE.md) already includes BVB/BLT, tram 19 and bounded rail to Sissach and Laufen. It excludes AAGL and other regional services. Its clipped rail runs cannot be silently reclassified as whole canton-serving journeys.

**New source finding.** The [official transport catalogue](https://www.baselland.ch/politik-und-behorden/direktionen/volkswirtschafts-und-gesundheitsdirektion/amt-fur-geoinformation/geoportal/geodaten/verkehr) was readable in this pass and advertises free GeoShop acquisition of a TNW rail/tram/bus Shapefile. Its [resolved dataset documentation](https://www.geocat.ch/geonetwork/srv/api/records/add1f3ed-0310-40ce-9d78-ffd1163b54c9/formatters/bl_datadoku_html?language=ger) identifies **41-BL**, **EPSG:2056**, and **8 August 2024** as its update state. The description says TNW while the perimeter field says BL: inspect actual extent, do not assume either field proves completeness. The GeoShop link failed through web retrieval; no Shapefile or dataset-specific redistribution terms were acquired. Public/free access alone does not resolve those terms.

**Next concrete work.** Acquire and inspect the advertised export; compare 2024 operator/line identities and alignments against the 2026 census before building an adapter. Prioritise **AAGL `811`** (nine annual feed route records), canton-serving PostAuto and missing upper-Baselbiet/Laufental patterns. Compare existing Basel paths only against exact matching source identities and service dates. If the export remains inaccessible or outdated, the existing FOT/OSM method offers a fallback. **Prioritise acquisition, then extend the existing Basel study with a separately measured BL scope.** A new BL button alone would not close the gap.

## Implementation sequence and completion criteria

1. **OW + NW first:** produce two canton inventories, one shared rail/bus candidate and a measured list of new versus reused complete patterns. This recommendation rests on demonstrated Luzern pattern coverage; bus completeness remains unmeasured.
2. **BL source investigation next:** acquire 41-BL and decide whether its 2024 geometry is useful for a 2026 extension. An unusable export should trigger the established FOT/OSM path, not an indefinite wait.
3. **NE and GL:** NE for a distinct city/region experience; GL for a smaller geometry and interchange pilot. SH follows with an explicit foreign-road fixture.
4. **UR and SZ extensions, AR + AI shared study, then JU:** preserve their individual canton inventories even when they share renderer/data tooling. This is a sequencing judgement, not a finding that the later cantons have less worthwhile transport.

Every implementation should first select **all annual trips with an actual call inside the full, correctly dated canton polygon**, across every agency and mode. Preserve complete ordered calls beyond the canton and national border. Report annual candidates, fixture-active and inactive routes, complete admitted journeys and explicit exclusions separately. Polygon membership is passenger-service scope; nonstopping through traffic and services absent from the feed remain outside that denominator.

Use a common pinned feed/date pair where reuse is intended. Apply calendar exceptions, previous-service-day carry-in, pickup/drop-off restrictions and frequency semantics. Add targeted seasonal and night witnesses after inspecting actual annual calendars. Zero activity on two September dates never means “no service”. Do not transfer a path merely because a brand or line number matches.

For a first reviewable artifact, require one complete rail/bus connection, both directed bus patterns, all original calls/times, endpoint/loop/tunnel checks, source hashes and attribution, measured payloads, and a readable coverage table. Lake and mountain modes may remain explicit exclusions. Schematic or inferred paths must stay labelled; automatic matching percentages are not evidence of lane-level correctness or guaranteed passenger transfers.

No canton warrants abandonment on the evidence found. What should remain deferred is **unsupported completeness**, unverified vector redistribution, mountain/boat geometry without the right source, and invented demand-responsive movements. This review changes the research queue and documents feasible starting points; it adds no app studies, deployed assets or publisher correspondence.
