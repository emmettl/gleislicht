# Roadmap

This is an iterative art-and-data project. Each stage should end in a coherent visual study rather than a long period of invisible infrastructure work.

## 0 — Motion language (now)

- [x] Establish the Vite, React, TypeScript, Three.js, oxlint and Vitest baseline.
- [x] Create a full-screen follow-camera prototype with procedural wireframe terrain.
- [x] Separate journey/timetable concepts from Three.js rendering.
- [x] Label synthetic data and add pause, scrub and camera controls.
- [ ] Tune camera damping, scale, colour and fog using several representative screen sizes.
- [ ] Set initial frame-time and bundle-size budgets.

**Exit:** the prototype communicates “night train through luminous Swiss topography” in its first few seconds.

## 1 — Scheduled Switzerland

- [x] Add a repeatable, streaming ingestion script for the current Swiss GTFS Static archive.
- [x] Parse rail routes, trips, stop times, stops and service calendars offline.
- [x] Resolve service-day rules, exceptions, after-midnight times and source/version metadata.
- [x] Produce a compact morning artifact instead of shipping the 232 MB GTFS ZIP.
- [x] Render the Friday morning window in a national view with a deterministic simulation clock.
- [x] Frame the network with a simplified, luminous swissBOUNDARIES3D national outline.
- [x] Ground the network with simplified federal lake polygons and luminous shorelines.
- [ ] Replace straight stop-to-stop segments with matched rail geometry; the source feed has no `shapes.txt`.
- [x] Add a compact full-day artifact for the four hub pulse studies.
- [x] Add a separately loaded full service-day national study while preserving the fast morning load.

**Exit:** thousands of scheduled movements form a recognisable, scrubbable national rail network.

## 2 — Regional and urban pulse

- [x] Generalise GTFS preprocessing across Swiss rail, tram, bus, ferry, cableway, funicular and metro route types.
- [x] Produce a separately loaded Zürich city morning artifact and scale switcher.
- [x] Keep the national page load rail-only and derive the city study on demand.
- [x] Join the official ZVV/VBZ GTFS shapes after validating line, stop and date alignment.
- [x] Add a ZVV overview with zoom-dependent aggregation and regional map hierarchy.
- [x] Add a Genève/TPG study with French labels and carefully handled cross-border services.
- [x] Select Kiental–Griesalp route 220 from measured schedule and terrain criteria.
- [ ] Build a synchronized 24-hour rural PostBus versus Zürich tram contrast mode.

**Exit:** regional connections and urban density read clearly at their own scales, and the rural–urban contrast is compelling without falsifying frequency or position.

See [docs/REGIONAL-STUDIES.md](./docs/REGIONAL-STUDIES.md) for the study and packaging model.
The measured corridor decision is recorded in [docs/POSTBUS-CORRIDOR.md](./docs/POSTBUS-CORRIDOR.md).

## 3 — Real terrain, real corridors

- Establish LV95/WGS84/WebGL coordinate transforms and a single distance model.
- Build an offline swissALTI3D processing path: crop, resample, quantise and tile.
- Create corridor-level terrain LODs around selected rail shapes.
- Add terrain-integrated water depth, major station lights and tunnel-aware line treatment.
- Show mandatory `© swisstopo` attribution wherever derived terrain appears.

**Exit:** Zürich–Chur and one Alpine corridor run over recognisable real terrain on laptop and mobile GPUs.

## 4 — Realtime without pretending

- Fetch GTFS Realtime on a small server-side poller using the required API key, redirects and user-agent.
- Decode binary protobuf and align updates with the exact paired GTFS Static release.
- Apply delays, cancellations and changed stop sequences to scheduled animation.
- Visually distinguish planned interpolation, realtime-adjusted interpolation and unavailable data.
- Surface feed age and graceful stale/offline states.

The national GTFS-RT feed supplies trip updates and alerts, not vehicle positions. Unless another properly licensed position source is added, “live” means timetable motion corrected by realtime predictions—not GPS dots.

**Exit:** the current service day changes credibly when operations change, with provenance visible on demand.

## 5 — The visual instrument

- [x] Add the first national → selected-train camera descent and route highlight.
- [x] Search and select by train number, service, origin or destination.
- [x] Colour-code motion by service class while preserving night-view legibility.
- [x] Reveal collision-aware station labels progressively with map zoom.
- [x] Add context-aware, switchable labels for moving trains.
- [x] Add a hub-scale Takt pulse for Zürich HB, Bern, Basel SBB and Genève.
- [x] Loop the hub orbit across a full day with four authored playback tempos.
- [x] Add an alternate station-flow view with scheduled GTFS platform assignments.
- [ ] Replace the map-level selected-train follow with a terrain-backed corridor transition.
- Time-of-day presets, speed control and a short looping “director mode.”
- Authored palettes and camera behaviours for plateau, lake and Alpine routes.
- [x] Add three opt-in Driftbox cues with adaptive crossfades between network, hub and journey modes.
- Extend the score with spatial details derived from speed, tunnel state and terrain—never autoplayed.

**Exit:** viewers can explore deliberately or let Gleislicht compose a journey for them.

## 6 — Publish and sustain

- Automated source refreshes with validation and atomic artifact versions.
- Regression fixtures for DST changes, midnight rollover, missing shapes and feed mismatch.
- Performance telemetry without personal tracking; accessible non-WebGL fallback.
- Source, attribution and methodology pages.
- Recording/export workflow for shareable daily studies.
- Publish the reviewed static build through GitHub Pages; private previews remain non-canonical.

## Data sources to validate in implementation

- [Swiss GTFS Static cookbook](https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/) and the current timetable-year dataset
- [Swiss GTFS Realtime cookbook](https://opentransportdata.swiss/en/cookbook/realtime-prediction-cookbook/gtfs-rt/) and paired GTFS-RT dataset
- [swissALTI3D](https://www.swisstopo.admin.ch/en/height-model-swissalti3d) plus the applicable [open-geodata terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices)
- [swissBOUNDARIES3D](https://www.swisstopo.admin.ch/en/landscape-model-swissboundaries3d) for the national outline
- [FOEN Swiss hydrographic network](https://www.bafu.admin.ch/en/the-swiss-hydrographic-network) for named lake surfaces
- [ZVV/VBZ tram and bus GTFS](https://data.stadt-zuerich.ch/dataset/vbz_fahrplandaten_gtfs) for shape-aware Zürich regional geometry
- [ZVV network plans](https://www.zvv.ch/en/timetable-and-information/network.html) for regional information hierarchy, not as geographic source data
- [TPG line geometry from SITG](https://sitg.ge.ch/donnees/tpg-lignes) for Genève tram, trolleybus and bus paths, including cross-border branches
- [Kiental–Griesalp route 220](https://www.postauto.ch/en/leisure-offers/excursion-tips/kiental-griesalp-route) for the first measured rural PostBus and terrain study

## Early technical decisions

- Preprocess large source datasets in Node; serve small versioned binary/JSON assets to the client.
- Keep schedule/realtime/topography adapters independent of the renderer.
- Treat source timestamps, coordinate reference systems and attribution as data, not prose added at the end.
- Prefer a few measured levels of detail over runtime-heavy general GIS machinery.
- Keep the visual client statically deployable; add a minimal server component only for secrets and realtime polling.
