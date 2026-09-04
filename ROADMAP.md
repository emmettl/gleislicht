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
- [ ] Replace straight stop-to-stop segments with matched rail geometry; the source feed has no `shapes.txt`.
- [x] Add a compact full-day artifact for the four hub pulse studies.
- [ ] Extend the national network itself from the two-hour study to a compact full service day.

**Exit:** thousands of scheduled movements form a recognisable, scrubbable national rail network.

## 2 — Real terrain, real corridors

- Establish LV95/WGS84/WebGL coordinate transforms and a single distance model.
- Build an offline swissALTI3D processing path: crop, resample, quantise and tile.
- Create corridor-level terrain LODs around selected rail shapes.
- Add understated water, major station lights and tunnel-aware line treatment.
- Show mandatory `© swisstopo` attribution wherever derived terrain appears.

**Exit:** Zürich–Chur and one Alpine corridor run over recognisable real terrain on laptop and mobile GPUs.

## 3 — Realtime without pretending

- Fetch GTFS Realtime on a small server-side poller using the required API key, redirects and user-agent.
- Decode binary protobuf and align updates with the exact paired GTFS Static release.
- Apply delays, cancellations and changed stop sequences to scheduled animation.
- Visually distinguish planned interpolation, realtime-adjusted interpolation and unavailable data.
- Surface feed age and graceful stale/offline states.

The national GTFS-RT feed supplies trip updates and alerts, not vehicle positions. Unless another properly licensed position source is added, “live” means timetable motion corrected by realtime predictions—not GPS dots.

**Exit:** the current service day changes credibly when operations change, with provenance visible on demand.

## 4 — The visual instrument

- [x] Add the first national → selected-train camera descent and route highlight.
- [x] Search and select by train number, service, origin or destination.
- [x] Colour-code motion by service class while preserving night-view legibility.
- [x] Reveal collision-aware station labels progressively with map zoom.
- [x] Add context-aware, switchable labels for moving trains.
- [x] Add a hub-scale Takt pulse for Zürich HB, Bern, Basel SBB and Genève.
- [x] Loop the hub orbit across a full day with four authored playback tempos.
- [ ] Replace the map-level selected-train follow with a terrain-backed corridor transition.
- Time-of-day presets, speed control and a short looping “director mode.”
- Authored palettes and camera behaviours for plateau, lake and Alpine routes.
- [x] Add three opt-in Driftbox cues with adaptive crossfades between network, hub and journey modes.
- Extend the score with spatial details derived from speed, tunnel state and terrain—never autoplayed.

**Exit:** viewers can explore deliberately or let Gleislicht compose a journey for them.

## 5 — Publish and sustain

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

## Early technical decisions

- Preprocess large source datasets in Node; serve small versioned binary/JSON assets to the client.
- Keep schedule/realtime/topography adapters independent of the renderer.
- Treat source timestamps, coordinate reference systems and attribution as data, not prose added at the end.
- Prefer a few measured levels of detail over runtime-heavy general GIS machinery.
- Keep the visual client statically deployable; add a minimal server component only for secrets and realtime polling.
