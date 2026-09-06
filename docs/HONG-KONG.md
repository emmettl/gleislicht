# Hong Kong — title to find

**An unnumbered Hong Kong motion study**

**Catalogue status:** second-wave source investigation; title and defining rail-motion path not yet admitted.

## Thesis under test

Hong Kong is built on narrow habitable edges between mountain and harbour. Its transport repeatedly reveals and denies that terrain: ferries cross the open surface, trams hold the north shore of Hong Kong Island, rail disappears beneath the harbour and through the hills, and stations become deep vertical rooms before the network emerges again on viaducts and reclaimed ground.

The strongest local sentence is therefore not simply density or skyline. It is **surface and void**: a city whose movement alternates between being completely exposed and completely hidden. A compact section from Central and Admiralty across Victoria Harbour to Tsim Sha Tsui and Hung Hom could place exact ferry departures on the water, a reconstructed tram field along the island edge, and MTR station volumes below the city without pretending that the available MTR data describes individual trains between stations.

The title remains open. Any Cantonese title or local phrase should be chosen with a native Cantonese reader rather than treated as interchangeable with a written-Chinese gloss. The source audit should first establish whether the finished work is about crossing the harbour, disappearing into the city, vertical interchange or the tension among all three.

## Feasibility verdict — 6 September 2026

Hong Kong is unusually strong for terrain, water, bilingual identity and station-scale three-dimensional evidence. Its weak point is the most consequential one for a Motion Study: no durable official static MTR timetable or vehicle-position feed has yet been found. The government-wide GTFS publication is a headway feed for surface transport and ferries, not the heavy-rail network.

| Scope | Status | What is defensible now |
| --- | --- | --- |
| Victoria Harbour ferry proof | **Green** | Star Ferry publishes exact machine-readable timetables for Central–Tsim Sha Tsui and Wan Chai–Tsim Sha Tsui. Hong Kong & Kowloon Ferry publishes timetables and one-minute ETA data. Departures can be replayed on a pinned service pattern; the course between piers remains schematic unless a separate observed or navigational track is sourced. |
| Tram and Peak Tram surface field | **Green as reconstruction / amber as timetable** | The Transport Department headway GTFS includes six Hong Kong Tramways route records and one Peak Tram route, plus stop sequences and service windows. Its frequency semantics do not identify exact individual departures, so motion must be visibly labelled as deterministic headway generation rather than scheduled vehicles. |
| MTR network topology and station section | **Green / amber by layer** | MTR publishes bilingual line/station order, while Lands Department's indoor WFS currently exposes 98 station venue envelopes and detailed floor/unit features. This can support a measured station-volume study. It does not establish track depth, tunnel alignment, passenger flow or the position of a train. |
| MTR train motion | **Red for reproducible trajectories / amber for live station pulses** | The official Next Train API publishes up to four arrival forecasts per direction at covered stations every ten seconds. It exposes destination, platform, sequence, predicted time and time-to-train, but no stable vehicle or trip identifier. It can drive forecast pulses at stations, not a train moving through the network or a historical timetable replay. |
| Terrain, harbour and built context | **Green technically / amber for presentation** | Lands Department publishes a territory-wide five-metre DTM and territory-wide 3D building, infrastructure, vegetation, water and terrain models. Whole-territory assets are too large for the client, and Map API use carries face-visible Lands Department logo and copyright requirements that must be reconciled with the minimal presentation. |

The opening surface-and-void proof therefore passes the **technical source-path** test. The full rail-led edition does not. Hong Kong should remain unnumbered until either an authoritative, retainable MTR timetable appears or the work proves that exact ferries, honest headway reconstruction and station-arrival forecasts form a sufficiently specific motion argument without invented rail trajectories.

## Rights and publication baseline

The [DATA.GOV.HK Terms and Conditions](https://data.gov.hk/en/terms-and-conditions), version 1.2 dated 26 May 2025, allow data to be downloaded, distributed and reproduced for commercial and non-commercial use free of charge. They require clear identification of the source, acknowledgement of the Government and relevant organisations' intellectual-property ownership, and proper attribution to those parties and DATA.GOV.HK. They also impose a broad user indemnity, provide the data as-is, permit terms to change without notice and make no promise that a dataset will remain available or current.

This is a much clearer publication baseline than several other candidate cities, but it is not permission to ignore source-specific conditions:

- retain a copy or hash of the DATA.GOV.HK terms in effect at every acquisition;
- preserve the named relevant organisation for each operator-owned dataset, including MTR, Star Ferry, Hong Kong & Kowloon Ferry and Hong Kong Tramways;
- treat documents and endpoints reached on an operator's own domain as potentially subject to separate website terms until confirmed; and
- do not use operator maps, logos, route marks, liveries or photographs merely because the underlying data is open.

The [Lands Department 3D Indoor MTR Station Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-mtr-station-map) has a more specific display rule: a map application must include the Lands Department logo on the map face and a copyright notice. That requirement affects the composition, not just the methodology page. Confirm whether a heavily transformed, precompiled station mesh remains a “map application” under those terms before making it part of the public canvas.

Before an MTR-derived browser artifact or recorded prediction study is published, obtain written answers from MTR/DATA.GOV.HK:

1. Do the DATA.GOV.HK terms fully govern output retrieved from the MTR Next Train endpoint and the CSV files hosted on `opendata.mtr.com.hk`?
2. May a small, non-reconstructive browser artifact contain selected line/station order and recorded prediction snapshots indefinitely?
3. May raw Next Train responses be retained privately as provenance for a dated artwork, and may transformed station events be redistributed?
4. Is there an official static timetable, trip-pattern or rail-alignment dataset not exposed in the current catalogue?
5. Which acknowledgement wording is required when MTR data, Government terrain and operator ferry data appear in one authored work?

## What the official headway GTFS actually contains

The [Transport Department headway dataset](https://data.gov.hk/en-data/dataset/hk-td-tis_11-pt-headway-en) is updated biweekly and offers separate Traditional Chinese, English and Simplified Chinese GTFS-like releases plus a historical-download interface. Its [data specification](https://static.data.gov.hk/td/pt-headway-en/dataspec/ptheadway_dataspec.pdf) is essential: for trips represented in `frequencies.txt`, the apparent arrival and departure values in `stop_times.txt` are not absolute vehicle times and must be ignored in favour of the published service window and headway.

The English ZIP retrieved for this investigation was the 27 August 2026 release:

- source: `https://static.data.gov.hk/td/pt-headway-en/gtfs.zip`;
- size: 13,675,759 bytes;
- SHA-256: `de570e95a99a36d05a19b75f5d34897a413b53647f4864edf33e767dac515933`;
- 14 agencies, 2,445 routes, 9,448 stops, 82,386 trips, 1,368,409 stop-time rows and 76,316 frequency rows; and
- only ten GTFS tables: `agency`, `calendar`, `calendar_dates`, `fare_attributes`, `fare_rules`, `frequencies`, `routes`, `stops`, `stop_times` and `trips`.

There is no `shapes.txt`, `transfers.txt`, `pathways.txt`, `levels.txt`, `feed_info.txt` or `attributions.txt`. The route agencies cover franchised buses, minibuses, MTR feeder buses, ferries, Peak Tram and Hong Kong Tramways. **MTR heavy rail is absent.** The inspected release contains 59 ferry routes, six tram routes and one Peak Tram route.

That evidence changes the compiler contract:

- generate frequency-based departures deterministically from `start_time`, `end_time` and `headway_secs`, and label them **reconstructed from published headways**;
- never display generated instances as operator-scheduled vehicle identities;
- retain exact/specified services separately from frequency-based records rather than silently normalising both into one timetable;
- join stop sequences to the Transport Department's spatial route publication only after measuring coverage and direction consistency; and
- pin the archived release, language, civil service date, checksum and generation seed so the reconstruction is repeatable.

The [Routes and fares of public transport GeoJSON](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson) supplies biweekly stop-sequence coordinates for buses, minibuses, ferries, Peak Tram and trams. It does not add MTR heavy rail, and its en-route coordinate sequence must not automatically be treated as surveyed track or vessel-course geometry. Inspect whether a record is a stop chain or a true path before rendering curves between points.

## MTR sources and their limits

### Lines and stations

The [MTR routes, fares and barrier-free facilities dataset](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities) is catalogued as monthly and owned by MTR Corporation. The current `MTR Lines (except Light Rail) & Stations` CSV inspected here contains 273 data rows describing line code, direction, station code, station ID, Chinese name, English name and sequence. It has no coordinates, geometry, calendar, departure time, service pattern, platform, transfer or trip identity. The retrieved file was 14,161 bytes with SHA-256 `e0e781152e2e6c5f6d7763262acbae76577b71ca4c66b4b7b72a97252175e0c3`.

Its role is therefore narrow but useful: authoritative bilingual line/station topology and an identity cross-check. Validate the date on each individual resource rather than trusting the dataset-level “monthly” label; the catalogue metadata and underlying file history are not necessarily updated together.

### Next Train forecasts

The [Real-time MTR train information dataset](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data) updates every ten seconds and currently advertises the next four trains for ten lines: Airport Express, Tung Chung, Tuen Ma, Tseung Kwan O, East Rail, South Island, Tsuen Wan, Island, Kwun Tong and Disneyland Resort.

The API is station-centric. Its prediction records include direction, destination, platform, sequence, a predicted time and time-to-train, but not a stable vehicle ID or static trip ID. Consecutive snapshots may resemble the progress of one train, yet joining them by order, destination and decreasing time would be an inference vulnerable to service changes and reordering. The only defensible visual states are:

- a live station forecast pulse;
- a recorded replay of exactly what the API predicted at each capture time; or
- an aggregate measure such as prediction density or change, with the aggregation method visible.

None is an observed trajectory. A forecast reaching zero is not by itself proof that a train physically arrived, and a sequence number is not a durable vehicle identity. The catalogue page and supplementary specifications have changed coverage at different times, so the recorder must save the exact data dictionary/API version and reject undocumented line or field changes.

## Surface and harbour operators

| Publisher | Available data | Use in the study |
| --- | --- | --- |
| [The “Star” Ferry Company](https://data.gov.hk/en-data/dataset/starferry-starferry-ferry-service-timetables-and-fare-tables-of-star-ferry) | Exact English, Traditional Chinese and Simplified Chinese timetable CSV/XLSX files for Central–Tsim Sha Tsui and Wan Chai–Tsim Sha Tsui; updated as necessary | Cleanest moving layer for the opening harbour proof. Retain the precise timetable resource, retrieval date and weekday/holiday rule. Use an explicitly schematic crossing curve until an authoritative course or recorded track is found. |
| [Hong Kong & Kowloon Ferry](https://data.gov.hk/en-data/dataset/hkkf-hkkfdata-hkkf-eta-data) | Pier and route identity, service timetables, fares and one-minute ETA JSON | Strong later expansion beyond the central harbour. ETA predicts a service event; it is not vessel position. |
| Hong Kong Tramways | [Main-route](https://data.gov.hk/en-data/dataset/hktramways-hktramways-main-routes) and [tram-stop](https://data.gov.hk/en-data/dataset/hktramways-hktramways-tram-stops) data, plus six headway routes in the TD feed | Defines the narrow north-island surface axis. Motion remains headway-generated unless a separate exact or observed source is found. |
| Peak Tram | One headway route and stop sequence in the TD publications | A powerful slope accent for a later terrain crop, but not the core of the harbour opening and not an exact timetable layer. |

The first proof does not need buses or minibuses. Their coverage is extensive and could turn a precise surface-and-void argument into a generic public-transport map before the rail evidence is solved.

## Terrain, water and vertical structure

| Source | What it supports | Limits |
| --- | --- | --- |
| [Lands Department Digital Terrain Model](https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1638158088368_93806) | Territory-wide terrain at a five-metre raster grid and stated ±5 m accuracy | Includes some non-ground elevated roads and bridges. It can establish mountain/harbour relief and approximate ground height, not track, platform, tunnel or vehicle elevation. Preserve CRS, vertical datum, release and resampling method. |
| [3D Visualisation Map — individualised models](https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1671676915450_88604) | Territory-wide buildings, infrastructure, vegetation, waterbody and terrain with geometry and texture models | Far too large for the opening client. Infrastructure categories may help locate railway, tunnel, portal and bridge features, but actual coverage and attributes must be inspected before assigning a line or vertical state. Use a simplified lazy crop without phototexture. |
| [3D Spatial Data API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-spatial-data-api) | WGS84 Cesium 3D Tiles for whole-territory building and infrastructure context | Requires a free key and has service limits. Prefer offline acquisition and a tiny transformed crop; confirm redistribution and on-canvas attribution for compiled geometry. |
| [3D Indoor MTR Station Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-mtr-station-map) | WFS venue, level, unit, opening, amenity and occupant features for station interiors | The live venue query returned 98 station envelopes on 6 September 2026. Venue height ranges are display envelopes, not platform surveys. Detailed features do not describe passenger flow, paid-area transfer time or trains. Lands Department logo/copyright requirements apply. |
| [3D Pedestrian Route Search API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-pedestrian-route-search) | Indoor/outdoor routes with vertical coordinates | Can support one authored interchange walk after coverage testing. A computed path is a routing result, not evidence of observed passenger movement, crowd volume or the route every rider takes. |

The inspected indoor venue response was 1,806,726 bytes with SHA-256 `c17c25651fabd0f9ceb83773229020c798b47edfb959bab0a4a38c2945ce73e4`. It includes Admiralty, Central, Hong Kong, Tsim Sha Tsui, East Tsim Sha Tsui, Exhibition Centre and Hung Hom. Admiralty's published display envelope runs from approximately -33.63 m to +12.435 m, which is enough to test a true section composition. It is not enough to assign each railway line to a measured depth; that requires the level/unit features and a documented join from indoor features to MTR line/platform identity.

Hong Kong's CRS history needs explicit treatment. Current CSDI GeoJSON services use WGS84, while older Transport Department and Lands Department releases may use Hong Kong 1980 Grid or another stated local reference. Record the source CRS and transformation for every input rather than assuming longitude/latitude from file format alone.

## What each visual claim requires

| Intended claim | Evidence required | Present feasibility |
| --- | --- | --- |
| Exact ferry departures across Victoria Harbour | Pinned operator timetable, service-day rule and pier identity | **Yes.** Star Ferry is the cleanest opening clock. The between-pier curve remains schematic without a course source. |
| Ferries as observed moving vessels | Timestamped positions or tracks with vessel/service identity and retention rights | **Not yet.** Timetables and ETA do not supply position. Do not manufacture an observed-looking wake from an interpolated schedule. |
| Tram density along the island edge | TD headway windows, stop sequence and deterministic generation | **Yes as reconstruction.** Label the layer as headway-generated and expose the seed/rule. |
| MTR trains crossing beneath the harbour | Static trips/times plus authoritative alignment and tunnel/depth classification | **Blocked.** The public sources found supply neither a static timetable nor train trajectories. Infrastructure may be shown without moving trains after geometry inspection. |
| MTR arrival rhythm at a station | Timestamped Next Train responses and explicit forecast semantics | **Yes live; reproducible only if recorded.** Visualise station predictions, not the inferred journey of a vehicle. |
| A deep interchange | Indoor station venue/level/unit geometry joined to authoritative line/platform identity | **Promising at selected stations.** The 98 venue envelopes prove coverage, but the detailed join and display terms still need validation. |
| A transfer path | Published indoor pedestrian network or route result | **Possible, not passenger flow.** Duration, accessibility and paid-area semantics need their own fields or labels. |
| Mountains determining the network | DTM plus source-backed infrastructure alignment and above/below-ground state | **Terrain yes; rail relation to inspect.** A route hidden by rendered terrain is not proof that the real line tunnels there. |
| Dense built city receding beneath transport | Simplified 3D building/infrastructure crop with clear source and payload boundary | **Yes as context.** Buildings should be nearly black and lazy; photorealistic texture is unnecessary and likely counterproductive. |

## Identity and compiler risks

- Namespace every identifier by publisher, release and language. TD route IDs, MTR station IDs and operator pier/stop IDs are not one shared registry.
- Keep Traditional Chinese and English source labels together. Do not use transliteration or English-name equality as the canonical identity join, and do not silently substitute Simplified Chinese for local Traditional Chinese.
- Record `Asia/Hong_Kong`, civil service date, retrieval time, source update time, terms version, language, CRS and SHA-256. Hong Kong currently has no daylight-saving transition, but after-midnight service remains attached to its source service day.
- Preserve exact timetable events, frequency-generated instances, live forecasts and recorded forecast snapshots as different data types. Their renderer symbols and provenance language should also differ.
- Never infer one MTR train across stations by matching destination, platform, sequence or time-to-train. Without a stable trip/vehicle key, the join is probabilistic.
- Do not turn station display-height envelopes into platform elevations. Store each geometry field's published meaning and only derive a track height from a source that actually identifies the track or platform.
- Measure stop-chain-to-geometry error for every surface route. No `shapes.txt` means curve construction is an authored operation with an error report, not a hidden compiler convenience.
- Keep official network maps, roundels, station-number graphics, operator logos, ferry/tram liveries and skyline photography out of the first proof. Use bilingual text and an authored palette.
- Treat the harbour edge as dated geometry. Reclamation changes the shoreline; retain the release date rather than presenting one outline as timeless.

## Recommended first proofs

### HK 0A — Harbour surface proof

Compile an ordinary weekday 18:00–20:00 HKT study bounded by Central, Admiralty, Wan Chai, Tsim Sha Tsui and Hung Hom.

- Use the exact Star Ferry timetable as the primary clock for the two central crossings.
- Add Hong Kong Tramways only as a clearly labelled headway-generated field along the island shore.
- Use a small DTM/waterbody crop to make the habitable edges and Victoria Harbour void legible.
- Show MTR stations and inspected infrastructure as dark structural context only; do not move trains.
- Represent ferry paths as authored schematic curves between authoritative piers and say so in the source panel.
- Target no more than 100 KiB gzip for timetable events, generated tram parameters, terrain, water and structure before JavaScript and CSS.

This proof asks whether visible surface movement and invisible rail structure can make Hong Kong recognisable without a skyline layer. It can proceed with the present sources after the attribution layout is designed.

### HK 0B — Admiralty vertical room

Build a single-station section from the indoor WFS, beginning with the venue, level, unit, opening and amenity features required to explain Admiralty's vertical volume.

- Verify every feature's elevation semantics and join to the authoritative MTR line/station table.
- Render platform or line depth only when a source field supports that assignment.
- Add recorded Next Train snapshots as pulses attached to a station/platform label, never as vehicles travelling away from it.
- Include the Lands Department logo and notice in a test canvas, then decide whether the requirement can coexist with the edition's limited chrome.
- Keep the detailed station mesh lazy and report source bytes, transformed bytes, feature counts and mobile frame time.

### HK 0C — Forecast, not trajectory

After confirming retention terms, record the Next Train API every ten seconds for a bounded two-hour period at no more than three stations. Store raw snapshots, response timestamps, source system time, dictionary version and checksums outside the client artifact.

Compile a station-event replay that shows how forecasts approach, disappear or change. Do not connect forecast rows into cross-station paths. The acceptance test is whether prediction rhythm can be emotionally and visually legible while remaining unmistakably different from scheduled or observed vehicle motion.

## Source-gate checklist

### Access and rights

- [ ] Save the DATA.GOV.HK terms version and the named intellectual-property owner for every admitted dataset.
- [ ] Obtain written confirmation for retaining and publishing transformed MTR station/order and Next Train snapshot data.
- [ ] Resolve Lands Department's logo/on-map attribution requirement for precompiled indoor and 3D geometry.
- [ ] Confirm source-specific terms for Star Ferry, Hong Kong & Kowloon Ferry and Hong Kong Tramways data reached on operator domains.
- [ ] Design bilingual, persistent source attribution before the first public artifact.

### Feed and geography inspection

- [x] Download and inventory the current English TD headway GTFS; record byte size, hash, tables and agency/mode coverage.
- [x] Confirm that MTR heavy rail and `shapes`, `transfers`, `pathways`, `levels`, `feed_info` and `attributions` are absent.
- [x] Inspect the MTR line/station CSV fields and confirm that it is topology without coordinates or timetable.
- [x] Query the indoor MTR venue layer and confirm central-harbour station coverage.
- [ ] Test the DATA.GOV.HK historical interface/API for a pinned TD release and record its retention behaviour.
- [ ] Measure exact versus frequency-based TD services by mode and validate deterministic departure generation against the specification.
- [ ] Inspect ferry/tram/Peak Tram coordinate records and report stop-chain geometry quality, direction and gaps.
- [ ] Download the Central–Tsim Sha Tsui and Wan Chai–Tsim Sha Tsui timetable CSVs; normalise weekday/holiday rules and record hashes.
- [ ] Inspect CSDI infrastructure subtypes and determine whether railway/tunnel/portal records can be joined authoritatively to MTR lines.
- [ ] Inspect Admiralty's detailed level/unit/opening data and separate venue display height from platform/track elevation.
- [ ] Probe Next Train responses for field stability, coverage, ordering changes, gaps and rate behaviour without creating inferred vehicle IDs.

### Proof and admission

- [ ] Compile HK 0A with exact ferry events, headway-generated tram motion and no MTR vehicle fiction.
- [ ] Test a bilingual Traditional Chinese/English label hierarchy on desktop and iPhone.
- [ ] Fit terrain, water and structural context within the 100 KiB-gzip opening-data target.
- [ ] Build the Admiralty section with on-canvas Lands Department attribution and measured mobile performance.
- [ ] Judge whether station forecasts can carry a motion study when individual MTR trajectories are unavailable.
- [ ] Keep the work unnumbered until a Hong Kong-specific signature action, durable source set and publication treatment all survive the proof.

## Exit criterion for the investigation

The limited source gate passes when exact Victoria Harbour ferry movement, explicitly reconstructed tram frequency and measured terrain/station structure can coexist on one clock without implying unsupported MTR motion. The full edition gate passes only when Hong Kong's defining rail disappearance and re-emergence can be shown from an authoritative, reproducible timetable/trajectory source—or when the surface-and-station proofs demonstrate a stronger local argument that genuinely does not require those trajectories.
