# Roadmap

This is an iterative art-and-data project. Each stage should end in a coherent visual study rather than a long period of invisible infrastructure work.

## 0 — Motion language (now)

- [x] Establish the Vite, React, TypeScript, Three.js, oxlint and Vitest baseline.
- [x] Create a full-screen follow-camera prototype with procedural wireframe terrain.
- [x] Separate journey/timetable concepts from Three.js rendering.
- [x] Label synthetic data and add pause, scrub and camera controls.
- [x] Tune camera damping, scale, colour and fog across representative phone, tablet and desktop sizes.
- [x] Set and enforce the first mobile transfer budget; establish frame-time telemetry with the terrain work.

**Exit:** the prototype communicates “night train through luminous Swiss topography” in its first few seconds.

## 1 — Scheduled Switzerland

- [x] Add a repeatable, streaming ingestion script for the current Swiss GTFS Static archive.
- [x] Parse rail routes, trips, stop times, stops and service calendars offline.
- [x] Resolve service-day rules, exceptions, after-midnight times and source/version metadata.
- [x] Produce a compact morning artifact instead of shipping the 232 MB GTFS ZIP.
- [x] Render the Friday morning window in a national view with a deterministic simulation clock.
- [x] Frame the network with a simplified, luminous swissBOUNDARIES3D national outline.
- [x] Ground the network with simplified federal lake polygons and luminous shorelines.
- [x] Replace straight stop-to-stop segments with matched Federal Office of Transport rail geometry; retain explicit fallbacks where the join cannot be made.
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
- [x] Build a synchronized, progressively loaded 24-hour rural PostBus versus Zürich tram contrast mode.

**Exit:** regional connections and urban density read clearly at their own scales, and the rural–urban contrast is compelling without falsifying frequency or position.

See [docs/REGIONAL-STUDIES.md](./docs/REGIONAL-STUDIES.md) for the study and packaging model.
The measured corridor decision is recorded in [docs/POSTBUS-CORRIDOR.md](./docs/POSTBUS-CORRIDOR.md).

## 3 — Real terrain, real corridors

- [x] Establish LV95/WGS84/WebGL coordinate transforms and a single distance model.
- [x] Build an offline swissALTIRegio processing path: crop, resample, quantise and package on demand.
- [x] Create desktop and mobile terrain LODs around the matched Zürich–Chur rail shape.
- [x] Add terrain-integrated lake surfaces and station beacons to the first measured corridor.
- [x] Add a higher-resolution swissALTI3D Alpine corridor crop for Kiental–Griesalp, with road-following route geometry.
- [x] Add tunnel-aware line treatment to the Zürich–Chur rail corridor from SBB infrastructure records.
- [x] Show mandatory `© swisstopo` attribution wherever derived terrain appears.

**Exit:** Zürich–Chur and one Alpine corridor run over recognisable real terrain on laptop and mobile GPUs.

## 4 — Realtime without pretending

- [x] Build a small server-side poller contract with the required API key, redirects, user-agent, 30-second edge cache and restrictive CORS.
- [x] Decode binary protobuf and refuse to combine updates with a different GTFS Static release or service day.
- [x] Apply delays, cancellations and exactly matched skipped stops to scheduled animation.
- [x] Visually distinguish scheduled and realtime-adjusted interpolation, including delayed-train rings and label offsets.
- [x] Surface loading, feed mismatch, stale and offline fallbacks in a compact operations control.
- [x] Ship an explicitly labelled deterministic demo so the complete interaction can be reviewed without credentials.
- [ ] Provision the poller secret and URL, then regenerate current-day static artifacts before enabling LIVE by default.
- [ ] Add service-alert presentation after the Trip Updates path has run reliably in production.

The national GTFS-RT feed supplies trip updates and alerts, not vehicle positions. Unless another properly licensed position source is added, “live” means timetable motion corrected by realtime predictions—not GPS dots.

**Exit:** the current service day changes credibly when operations change, with provenance visible on demand.

See [docs/REALTIME.md](./docs/REALTIME.md) for the trust model, deployment contract and activation checklist.

## 5 — The visual instrument

- [x] Add the first national → selected-train camera descent and route highlight.
- [x] Search and select by train number, service, origin or destination.
- [x] Colour-code motion by service class while preserving night-view legibility.
- [x] Reveal collision-aware station labels progressively with map zoom.
- [x] Add context-aware, switchable labels for moving trains.
- [x] Add a hub-scale Takt pulse for Zürich HB, Bern, Basel SBB and Genève.
- [x] Loop the hub orbit across a full day with four authored playback tempos.
- [x] Add an alternate station-flow view with scheduled GTFS platform assignments.
- [x] Replace the first supported map-level selected-train follow with a terrain-backed corridor transition.
- [x] Add a first-class selector for switching directly between the authored terrain journeys.
- [x] Add time-of-day presets, speed control and a short looping “director mode.”
- [x] Add authored palettes and camera behaviours for plateau, lake and Alpine routes.
- [x] Add three opt-in Driftbox cues with adaptive crossfades between network, hub and journey modes.
- [x] Extend the score with spatial details derived from speed, tunnel state and terrain—never autoplayed.

**Exit:** viewers can explore deliberately or let Gleislicht compose a journey for them.

## 6 — Publish and sustain

- [x] Add reviewed, automated national source refreshes with validation and atomic artifact versions.
- [x] Add regression fixtures for DST changes, midnight rollover and missing shapes; reject mismatched national artifact sets.
- [x] Add opt-in local performance telemetry without personal tracking.
- [x] Add an accessible non-WebGL fallback.
- [x] Publish a source, attribution and methodology page.
- [x] Add a user-initiated recording/export workflow for shareable visual studies.
- [x] Publish the reviewed static build through GitHub Pages; private previews remain non-canonical.

## 7 — LUFTRAUM

- [x] Add a named, optional air study without turning the railway atlas into a generic transport map.
- [x] Prepare one matching historical hour of observed ADS-B positions as a compact static artifact.
- [x] Filter ground traffic, stale tracks and slow low-level light-aircraft noise in preprocessing.
- [x] Replay aircraft deterministically on the shared clock with compressed real altitude.
- [x] Render aircraft as restrained magenta needles with short, ephemeral trails—never a permanent air network.
- [x] Lazy-load the complete study only after the visitor selects **LUFT**.
- [x] Make aircraft selectable and expose callsign, altitude, groundspeed, heading and a tilted follow camera.
- [ ] Judge the visual experiment on real phones before considering a longer window, richer filtering or live polling.

**Exit:** the observed sky reads as a sparse atmospheric stratum above the deliberately built rail lattice, while the opening national study remains railway-first and unchanged in payload.

See [docs/LUFTRAUM.md](./docs/LUFTRAUM.md) for the data contract, filtering and visual grammar.

## 8 — AUTO

- [x] Define road movement as aggregate reconstruction rather than individual vehicle tracking.
- [x] Anchor Road Study 001 to current ASTRA detector sites along the A1 through Zürich.
- [x] Add a deterministic two-hour calibration artifact without increasing the opening payload.
- [x] Reconstruct separate light- and heavy-vehicle streams from flow, speed and corridor length.
- [x] Render warm-white and amber traffic beneath the cyan rail and magenta air layers.
- [x] Make AUTO an optional, isolatable service category with multilingual provenance.
- [x] Add a credential-safe, filtered one-minute ASTRA recorder and a completeness-gated compiler.
- [x] Audit all federal counters against official national-road axes and render the lazy national skeleton.
- [x] Resolve 49 of 59 ambiguous directional matches from neighbouring-counter continuity.
- [x] Build 609 measurement-ready directional sections and searchable A-road corridor focus.
- [x] Resolve the final 10 interchange directions from FEDRO TMC point-to-road identifiers rather than proximity.
- [x] Add a progressive national minute-study compiler, loader and section-flow renderer ready for recorded snapshots.
- [ ] Begin authenticated one-minute snapshot recording and replace calibration values with a complete measured hour.
- [ ] Judge the A1 composition on real phones before adding A2 Gotthard or a recorded full day.

**Exit:** the three layers remain visually and methodologically distinct: scheduled rail journeys, observed aircraft trajectories and synthetic traffic reconstructed from aggregate measurement.

See [docs/AUTO.md](./docs/AUTO.md) for the data contract, reconstruction and recording path.

## 9 — Motion Studies / All Change

- [x] Separate the visual language and CSS tokens from transport-domain types.
- [x] Define a typed edition contract for identity, time, theme and lazy data assets.
- [x] Move the complete Switzerland asset catalogue behind that contract.
- [x] Generalise boundary and water types without changing existing artifacts.
- [x] Define the first London study, source strategy and staged delivery plan.
- [x] Establish Motion Studies as the catalogue identity: 005 Gleislicht / Switzerland and 006 All Change / London.
- [x] Build the TfL adapter proof from a bounded weekday Bakerloo fixture with NaPTAN stops, route geometry and station intervals.
- [x] Compile the London morning lattice with Greater London and Thames geometry.
- [x] Add a dedicated London entry point once the fixture passes source and payload validation.
- [x] Add a limited-chrome London presentation mode that leaves the timeline available on desktop and iPhone.
- [x] Add an edition-neutral alternate-layout contract and a lazy, deterministic Beck-inspired diagram artifact.
- [x] Animate continuously between London's geographic and diagram spaces without resetting journeys or selection.
- [x] Reshape the logical layout around central-London expansion, compressed outer branches, shared interchange cells and stable two-way bends.
- [x] Add authored interchange/path overrides, a simplified Thames and an optional TfL-echoing line palette to complete the iconic-map composition.
- [x] Enforce the future package/repository boundary in CI so shared runtime code remains place-neutral.
- [x] Add a separately loaded, integrity-checked 24-hour London timetable in progressive two-hour chunks.
- [x] Add an optional observed-aircraft layer for London with matching two-hour and progressively loaded 24-hour studies, searchable flight codes, airport approach/departure selection and category emphasis.
- [x] Add an optional National Highways motorway study with real detector geometry, recorded flow/speed, progressive 24-hour loading, ROAD isolation and searchable corridor focus.
- [x] Add the first London-specific interchange pulse study across four contrasting hubs.
- [x] Add a separately loaded 24-hour London surface study for scheduled River Bus and cable-car movement.
- [x] Prove surface buses as a separate progressive corridor study with route 26/N26, shared-clock search and category isolation.

**Exit:** Gleislicht and All Change are independently authored Motion Studies, sharing runtime behaviour and visual grammar without sharing titles or place-specific assumptions.

See [docs/EDITIONS.md](./docs/EDITIONS.md) for the reusable boundary and [docs/LONDON.md](./docs/LONDON.md) for the second-edition plan.

## 10 — Catalogue programme

- [x] Fix the first four-work catalogue: 005 Gleislicht, 006 All Change, 007 Local / Express and 008 Correspondances.
- [x] Give New York and Paris distinct visual theses, signature studies and edition-level exit criteria.
- [x] Define admission criteria that prevent Motion Studies becoming one renderer with interchangeable bounding boxes.
- [x] Finish All Change's authored diagram overrides, interchange pulse studies and mobile frame-time gate.
- [x] Audit licensing, service-day semantics, identifiers, geometry and historical reproducibility for New York and Paris before ingesting complete feeds; keep New York unpublished while its application terms remain unresolved.
- [x] Prove one bounded New York local/express corridor through the current edition contract.
- [x] Turn that proof into an independent Local / Express entry point with Manhattan shoreline context, a lazy directional diagram, pattern isolation, search and a scheduled-overtake director.
- [x] Make the overtake director isolate both journeys, preserve local/express route identity and frame the completed order reversal.
- [x] Add an integrity-checked authored diagram layer for station rhythm, direction gaps, bends and schematic rivers.
- [x] Complete the 007 publication review and keep its page/data out of Pages until MTA clarifies transformation and application licensing.
- [x] Compile the bounded 007 service day into twelve lazy two-hour chunks while preserving the fast opening study.
- [x] Enforce a 390 KiB compressed first-view budget and desktop/iPhone browser gates for the New York foundation.
- [ ] Use the third fully viable city edition—not calendar ambition or a predetermined place—as the extraction trigger for `@motionstudies/core`, `@motionstudies/three` and the edition repositories.
- [ ] Hold further 007 Local / Express expansion and public release at the MTA licensing gate; retain its bounded proof as technical evidence.
- [x] Build 008 Correspondances through a Métro/RER opening study, a continuous centre–periphery scale study and three source-backed interchange compositions.
- [x] Give Correspondances an independent source-pinned shell, exact transfer evidence, official Seine/city context and a lazy 24-hour two-line study within a phone-first payload gate.
- [x] Begin the source and feasibility audit for **NORIKAE — A Tokyo motion study**: separate the durable Toei proof, conditional Tokyo Metro path and Challenge 2026-only Yamanote/private-railway coverage.
- [ ] Resolve the ODPT browser-artifact and historical-refresh terms, then compile a rights-clean Toei 07:00–09:00 loop-and-crossings proof before attempting the complete operator lattice.
- [x] Begin San Francisco's source and feasibility audit: separate 511's strong historical/observed technical path from the unresolved 511/SFMTA public-artifact terms, and keep the title open until the vertical signature study is proven.
- [ ] Resolve 511 browser-artifact, historical-use and sublicensing terms with MTC and SFMTA, then compile a bounded 08:00–10:00 hills-to-Bay proof over DataSF terrain.
- [x] Audit **MANIFEST — World trade in motion**: distinguish observed AIS movement from self-reported vessel data, inferred port-to-port voyages and aggregate commodity evidence; gate global individual tracks on written derived-publication rights.
- [ ] Prototype MANIFEST's global cargo/tanker field with non-commercial hourly vessel presence, compare identical commercial AIS evaluation slices at China/Gulf/choke-point coverage, and compile one rights-clean regional track proof before procurement.
- [ ] Keep Tokyo, Hong Kong, Berlin, San Francisco, Venice and MANIFEST unnumbered until each has passed the catalogue admission test.

**Exit:** every announced edition has a local argument, a defensible source model, an authored signature image and an independent payload budget; shared packages exist because three real works proved the seam.

See [docs/CATALOGUE.md](./docs/CATALOGUE.md), [docs/NEW-YORK.md](./docs/NEW-YORK.md), [docs/PARIS.md](./docs/PARIS.md), [docs/TOKYO.md](./docs/TOKYO.md), [docs/SAN-FRANCISCO.md](./docs/SAN-FRANCISCO.md) and [docs/MANIFEST.md](./docs/MANIFEST.md).

## Data sources to validate in implementation

- [Swiss GTFS Static cookbook](https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/) and the current timetable-year dataset
- [Swiss GTFS Realtime cookbook](https://opentransportdata.swiss/en/cookbook/realtime-prediction-cookbook/gtfs-rt/) and paired GTFS-RT dataset
- [swissALTIRegio](https://www.swisstopo.admin.ch/en/height-model-swissaltiregio) for wide-area terrain, [swissALTI3D](https://www.swisstopo.admin.ch/en/height-model-swissalti3d) for tighter future crops, plus the applicable [open-geodata terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices)
- [swissBOUNDARIES3D](https://www.swisstopo.admin.ch/en/landscape-model-swissboundaries3d) for the national outline
- [FOEN Swiss hydrographic network](https://www.bafu.admin.ch/en/the-swiss-hydrographic-network) for named lake surfaces
- [Federal Office of Transport rail network](https://map.geo.admin.ch/#/map?lang=en&center=2660000,1190000&z=1&topic=ech&layers=ch.bav.schienennetz) for national infrastructure geometry
- [SBB railway tunnels](https://data.sbb.ch/explore/dataset/tunnel/) for named tunnel portals and published lengths on measured rail journeys
- [ZVV/VBZ tram and bus GTFS](https://data.stadt-zuerich.ch/dataset/vbz_fahrplandaten_gtfs) for shape-aware Zürich regional geometry
- [ZVV network plans](https://www.zvv.ch/en/timetable-and-information/network.html) for regional information hierarchy, not as geographic source data
- [TPG line geometry from SITG](https://sitg.ge.ch/donnees/tpg-lignes) for Genève tram, trolleybus and bus paths, including cross-border branches
- [Kiental–Griesalp route 220](https://www.postauto.ch/en/leisure-offers/excursion-tips/kiental-griesalp-route) for the first measured rural PostBus and terrain study
- [ADSB.lol historical data](https://www.adsb.lol/docs/open-data/historical/) for the optional observed-aircraft study, distributed under ODbL 1.0
- [ASTRA / FEDRO road traffic counters](https://opentransportdata.swiss/en/cookbook/road-traffic-cookbook/rt-road-traffic-counters/) and the [Measurement Site Table](https://data.opentransportdata.swiss/en/dataset/trafficcounters) for directional aggregate flow, speed and detector geography

## Early technical decisions

- Preprocess large source datasets in Node; serve small versioned binary/JSON assets to the client.
- Keep schedule/realtime/topography adapters independent of the renderer.
- Treat source timestamps, coordinate reference systems and attribution as data, not prose added at the end.
- Prefer a few measured levels of detail over runtime-heavy general GIS machinery.
- Keep the visual client statically deployable; add a minimal server component only for secrets and realtime polling.
