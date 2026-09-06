# Istanbul — title to find

**An unnumbered Istanbul motion study**

**Catalogue status:** source investigation complete; historically reproducible proof available, current full multimodal motion blocked.

## Thesis under test

Istanbul is two continents made into one transport space. Ferries repeatedly cross the Bosphorus in the open while Marmaray passes beneath it; bridges carry road traffic above the same water. The local visual sentence is not merely a busy strait, but **one geographic division crossed at three different vertical states**.

The opening composition should make Europe and Asia impossible to read as separate maps. A bounded field from Karakoy and Eminonu through Uskudar and Kadikoy could hold ferries on the surface and the Marmaray alignment structurally beneath them. It must not animate a present-day railway service from an obsolete timetable.

## Feasibility verdict — 6 September 2026

| Scope | Status | Defensible interpretation |
| --- | --- | --- |
| Historic multimodal network | **Green technically / amber for publication** | IBB's frozen public-transport GTFS contains Metro Istanbul, Marmaray/TCDD and five ferry operators with trips, stop times and shapes. Its operator components were last refreshed between 2018 and 2020 and the publisher says the dataset will not be updated. It can support a clearly dated historical work after the licence text is retained. |
| Current IETT bus motion | **Green / amber for geometry** | IBB publishes a maintained IETT GTFS with calendar, routes, trips, stops and stop times. The catalogue does not list `shapes.txt`, so another authoritative geometry join is required. Buses are not the proposed edition's core. |
| Current rail and ferry motion | **Red as one reproducible feed** | Current rail and ferry timetables exist on operator websites, but this audit found no maintained official machine-readable source covering the defining modes together. Metro Istanbul exposes timetable pages and Sehir Hatlari publishes timetable pages/PDFs; neither is a stable GTFS replacement. |
| Bosphorus section | **Amber** | The water, shores and crossings are straightforward. Exact Marmaray alignment and depth/portal evidence, bridge deck elevation and ferry-course semantics still need source-specific validation. |

Istanbul therefore passes only as either a deliberately historical study or a smaller present-day ferry reconstruction compiled from retained timetable documents. It does not yet pass as a current, full-network Motion Study.

## Transport evidence

### Frozen IBB multimodal GTFS

The [IBB Open Data catalogue API](https://data.ibb.gov.tr/api/3/action/package_search?q=gtfs) describes a `Public Transport GTFS Data` package with `agency`, `calendar`, `frequencies`, `routes`, `shapes`, `stop_times`, `stops` and `trips`. The inspected agency table contains Sehir Hatlari, TCDD, Metro Istanbul, Minibus, Taxi Dolmus, IDO, Turyol and Dentur Avrasya. The route table contains 499 records and includes GTFS ferry routes.

The package notes are decisive: its components were last updated from January 2018 to July 2020 and **will not be updated**. Preserve those component dates rather than presenting the package's later metadata timestamp as service currency. The feed is valuable precisely because it provides one coherent historic network; it is unsuitable as evidence of Istanbul today.

The compiler would need to retain:

- ZIP and table checksums, retrieval date and every operator component date;
- `Europe/Istanbul`, source service day and after-midnight interpretation;
- exact timetable events and `frequencies.txt` reconstructions as different event types; and
- a visible historical date in the work, not just in a methodology drawer.

### Current official sources

The IBB catalogue also exposes a maintained `IETT GTFS Data` package. It covers the municipal bus operator rather than the full rail-and-water thesis and should not silently replace the frozen network.

[Metro Istanbul's service-detail page](https://www.metro.istanbul/SeferDurumlari/SeferDetaylari) publishes current operating hours and intervals for metro, tram, funicular and cable-car lines. [Sehir Hatlari's domestic timetable page](https://sehirhatlari.istanbul/en/timetables/domestic-trips) publishes current ferry services and downloadable timetable documents. These are authoritative references, but a scraper would inherit page changes, document formatting and ambiguous version retention. A published proof should use manually retained source documents only after confirming reuse terms and modelling each departure rule explicitly.

No official vehicle-position, trip-update or historical realtime archive suitable for permanent replay was found in this audit. Timetable interpolation would be scheduled motion, not observed vessel or train position.

## Rights and publication gate

The IBB package metadata identifies the **Istanbul Metropolitan Municipality Open Data License**, but the human-readable licence page returned access errors during this audit. That makes the catalogue label evidence of intent, not a sufficient retained legal record.

Before public compilation:

1. retain the full licence text and version that governs each downloaded package;
2. confirm commercial exhibition, redistribution of transformed route geometry and indefinite hosting of compact artifacts;
3. establish whether operator-hosted timetable PDFs carry separate terms; and
4. keep operator brands, maps, icons and liveries out unless separately permitted.

Until those checks are complete, the source path is technically reproducible but publication remains amber.

## Geography and vertical evidence

The opening needs four independent geometry classes: land/water boundary, ferry route, fixed crossings and ground/building context. IBB's open-data catalogue includes municipal geographic layers, but each chosen resource needs its own date, CRS and rights record. A Copernicus or other rights-clean global DEM can provide broad relief if no adequately documented municipal elevation model is available.

Marmaray must be treated conservatively. A schematic project alignment can establish that the rail crossing is below the Bosphorus, but it does not assign exact track depth continuously. Bridge and tunnel state should be compiled as authored segments with source citations and confidence, never inferred merely because a line crosses water.

## Evidence boundaries

| Visual claim | Required evidence | Current position |
| --- | --- | --- |
| A ferry departs at a stated time | Retained current or historic operator timetable and service-day rule | **Possible.** Historic GTFS is cleaner; current documents require manual versioning. |
| A vessel follows an exact course | Observed track or authoritative navigational geometry | **Not established.** GTFS shapes are service geometry, not proof of an observed wake. |
| A Marmaray train crosses beneath the strait | Matching timetable plus sourced alignment and tunnel classification | **Historic only from the audited feed.** Current train animation is blocked. |
| Three vertical crossing states coexist | Source-backed ferry surface, bridge deck and tunnel/rail section | **Promising**, with engineering geometry still to acquire. |
| Passenger flows bind two continents | OD, count or fare-gate measurements | **Not established.** Frequency is not demand. |

## Recommended proof

Build no current full-network prototype yet. The defensible first proof is a **labelled 2019 Bosphorus hour**, using the frozen IBB release to place ferries and Marmaray trips over a compact cross-strait section. Keep bridges structural unless a separate measured road-flow source is acquired. If historical framing weakens the intended work, pause instead and seek maintained operator data.

### Source gate

- [ ] Retain and review the IBB Open Data License text.
- [ ] Download the frozen package again, record hashes and verify all service calendars for one 2019 date.
- [ ] Measure route/shape/stop-time completeness by operator.
- [ ] Source shore, bridge and Marmaray tunnel geometry with explicit vertical semantics.
- [ ] Decide whether the historical date strengthens or compromises the thesis.
- [ ] Obtain a maintained rail/ferry data path before describing the work as present-day Istanbul.

**Exit:** Istanbul advances only if the historical proof reads as an intentional work, or maintained rail and ferry evidence replaces the frozen source without weakening reproducibility.
