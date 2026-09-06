# 006 — All Change

**A London motion study**

*London, geographically and otherwise.*

**All Change** is unmistakably London railway language: an instruction, a description of constant interchange, and a slightly ominous title for a glowing city after dark. It also names what is happening technically—the instrument is changing shape as it becomes capable of another place.

London is the next Motion Studies work because its transport system offers a useful inversion of Switzerland: an intensely layered metropolitan network whose identity comes from interchange, radial pressure, orbital lines and the River Thames rather than a national clockface and Alpine geography.

## Thesis: two simultaneous Londons

The edition is not merely transport moving around London. Its subject is the gap between two equally real conceptions of the city:

- the **physical city** of crooked tracks, uneven distances, tunnels, the Thames and actual geography; and
- the **mental city** of Beck-space, where station order and interchange matter while distance politely lies.

Every train remains the same journey while the city changes underneath it. A service approaching King's Cross does not cut, restart or become a diagrammatic substitute: miles collapse around its unchanged route progress until the crooked physical railway resolves into a legible connection.

This makes the title operate on three levels: interchange, movement and the map literally changing its conception of space. The transformation is therefore not an optional display convenience; it is All Change's defining authored study.

## First study

Start with one ordinary weekday from 06:45–08:45 and keep the first payload rail-led:

- London Underground, Elizabeth line, London Overground, DLR and Tramlink;
- Greater London boundary and the Thames as the dominant geographic anchors;
- real line geometry, station labels, service search, route isolation and follow cameras;
- the shared cyan motion grammar, with restrained official line colours used for selection rather than turning the whole scene into a conventional Tube map; and
- deterministic timetable interpolation with explicit provenance.

The first authored moment should show trains converging across central London while orbital and outer branches remain legible. A Thames-crossing follow view would provide the edition's first unmistakably London-specific composition.

## Geography ↔ diagram

London should be legible in two coordinate systems. **GEOGRAPHY** shows the physical city: real track geometry, distances, the Greater London boundary and the Thames. **DIAGRAM** is an independently authored, Beck-inspired topological composition: station order, interchange and line relationships take precedence over distance and bearing. It must evoke London's diagrammatic tradition without reproducing TfL's current map artwork.

The switch is a continuous transformation, not a scene change. The clock, active vehicles, search result, selected service or station, label policy and playback state must survive it. Water and boundary geography recede as the diagram becomes dominant; interchange structure and restrained line identity become clearer. The Thames may remain as a simplified orienting stroke because it is meaningful in both Londons.

An optional **limited chrome** presentation mode leaves only the visualization and its timeline visible. It is implemented as an application view rather than depending on browser fullscreen support, so it behaves consistently on iPhone as well as desktop. The timeline retains an explicit exit button; `F` toggles the mode and Escape restores the complete interface without clearing the current selection.

The transition should be theatrical but intelligible. Terrain flattens, the Thames simplifies, stations settle onto an octilinear grid, curves resolve into horizontal, vertical and 45-degree runs, and labels rotate into their diagram positions. The camera moves from geographic perspective toward a near-orthographic diagram view. Each gesture must explain the changing spatial model; spectacle follows from that explanation rather than covering it.

### Runtime model

- Physical longitude/latitude remains the canonical source coordinate and is never overwritten.
- A separately loaded layout artifact maps stable stop or interchange IDs to authored diagram coordinates and supplies diagram paths for route branches. Platform children collapse onto their interchange node unless an authored study explicitly needs them.
- Every moving service retains one canonical timetable/path progress. At a transition value `t`, the renderer samples the physical and diagram paths independently at that progress, then interpolates the two resulting positions. It must not interpolate raw path vertices: geographic and diagram paths have different vertex counts and meanings.
- Static edges may be compiled into corresponding station-to-station spans with a shared normalized sample count, allowing the whole network to bend continuously without changing topology.
- Selected stations and followed vehicles remain anchored near their pre-transition screen position. The camera interpolates between physical and diagram framing rather than resetting to a second home view.
- Label anchors move with their nodes, but the accepted label set is frozen during the transformation and collision placement is recomputed once it settles. This prevents the map from sparkling as labels cross.

### Authoring and validation

The diagram layout should be generated offline and committed as a small deterministic artifact. An octilinear constraint solver may provide the first arrangement, but the finished result is an authored composition with explicit overrides for central interchanges, branches and the Thames. The compiler must verify that station order, branch membership, termini and interchange identity are identical in both layouts, while permitting only declared visual crossings.

The first complete diagram artifact now provides that mechanical baseline. `npm run data:london:diagram` applies a central-London lens before snapping paths to horizontal, vertical and 45-degree segments. The lens enlarges the dense interchange field, compresses long outer branches, coalesces source IDs that describe the same named interchange and routes both travel directions through the same bend. All 505 source-identified stops and 1,414 path indexes remain stable through the morph. The resulting artifact is 62.1 KiB raw and 9.4 KiB compressed, including its separately authored Thames stroke. Its source-network and authored-override hashes, stop coverage, identity uniqueness, path coverage, Thames presence and octilinear geometry are enforced by the London build gate. `fixtures/tfl/all-change-diagram-overrides.json` remains the separate visual-editing seam: principal interchange cells, selected path bends and contextual strokes can be curated there without modifying the timetable artifact or runtime.

As the diagram resolves, the generic cyan traffic field recedes and an edition-owned line-identity layer appears. It uses TfL's current screen palette as a source, with only the darkest colours lifted for legibility in the Motion Studies night field; geography remains in the shared modal palette. This keeps the diagram recognisably London without presenting a reproduction of TfL's map artwork or making the physical view resemble a journey planner.

The first **PULSE** study reuses the shared clock-face engine around four deliberately contrasting interchanges: King's Cross St. Pancras, Bank, Waterloo and Stratford. Calls are derived from the same currently loaded timetable slice, so changing the main clock, playback speed or service-category emphasis also changes the orbit. The interchange can be changed from a compact status-card selector, `P` toggles the study, and selecting a geographic search result returns to the network without losing time.

The first prototype should cover the complete rail-led morning lattice rather than a single showcase line; the value of the transformation is seeing the entire city's physical irregularity resolve into logical structure. Acceptance criteria are:

- no vehicle jump, route reassignment or clock discontinuity during the morph;
- the current selection remains visible and understandable throughout;
- deterministic geometry and label results for recording and scrubbing;
- a reversible keyboard- and touch-accessible **GEOGRAPHY / DIAGRAM** control;
- a reduced-motion path that changes layout without a sweeping animation; and
- mobile frame time and artifact size included in the London-specific performance gates. The local iPhone browser matrix requires at least 18 animation frames in 1.8 seconds with a 95th-percentile interval below 125 ms. Hosted CI uses a 12-frame / 175 ms liveness floor because its headless WebKit software renderer is not a physical-device benchmark.

## Adapter proofs

The first compiled fixtures are deliberately smaller than the complete opening lattice. They exercise the shared network contract without entering Gleislicht's Swiss payload or edition selector:

- Bakerloo: 39 weekday journeys from Elephant & Castle across 25 NaPTAN stations;
- Northern: 84 journeys from Morden across short turns and the Bank/Charing Cross branch structures;
- DLR: 51 journeys from Bank split correctly toward Lewisham and Woolwich Arsenal;
- Tramlink: 17 journeys from Beckenham Junction, using TfL's alternate `Monday to Friday` schedule spelling;
- Lioness: bounded complete studies in both directions; and
- the PDF lattice: 321 morning journeys across every named Overground line and 16 active Elizabeth branch families.

The compiler now collapses TfL's repeated arrival/dwell interval records into one stop call with distinct arrival and departure times. Each interval pattern is matched to the ordered NaPTAN IDs for its own route branch before the official line string is split. Shared segments are reused, while genuinely different branches retain different geometry.

Run `npm run data:london:proofs` to refresh the bounded adapter proofs, or use the individual proof scripts for one request. `TFL_API_KEY` is supported for route-sequence access and should be used for repeated requests, in line with TfL's developer guidance. The generated metadata records retrieval time, source hashes, source endpoints, TfL's data-service terms, the selected weekday schedule and the fact that these are not realtime or complete London service-day claims.

`npm run data:london:catalogue` separately discovers every currently advertised line in the five rail-led modes. Its compact committed catalogue preserves 20 line identities and 125 directional branch definitions, each with ordered NaPTAN stops and a geometry hash. Three NaPTAN hierarchy samples retain interchange, entrance and platform children without inventing absent platform names.

TfL documents that its Journey Planner timetable feed covers Underground, bus, DLR, tram, cable car and river—not Elizabeth line or London Overground. Both rail modes do have current official public timetable PDFs. A separate grid extractor records each PDF hash and validity period, then accepts only columns with both requested endpoints, monotonic times and calls in official route order. Limited-stop columns are explicit: their path geometry spans the omitted non-calling stations rather than fabricating calls. It also understands repeated grids, side-by-side tables and TfL's weekday heading variants. Regenerating the lattice requires Poppler's `pdftotext`; the compiled JSON remains dependency-free.

`npm run data:london:lattice:unified` remains the bounded morning proof. The full-day equivalent compiles 8,797 movements, 353 source-identified stops and 1,008 real path segments across 13 lines and 26 directions. Limited-stop trains use the complete branch geometry between calls; TfL's overlapping DLR terminal responses are retained only where their stop pattern matches the selected route. Three Metropolitan origins advertised in topology exposed no suitable weekday schedule at retrieval and remain explicitly listed as inactive instead of disappearing.

The PDF day compiler derives 43 branch-audit tasks from the catalogue and accepts 39 active full-day branch patterns across every named Overground line and the Elizabeth family. Two Elizabeth and two Windrush topology branches have no auditable through column and remain in `metadata.coverage.inactiveBranches`. `npm run data:london:day` acquires both source families and combines them into a 10,455-movement, 505-stop, five-mode contract. It assigns 462 stable station-name ranks, derives the 1,708-movement opening window from exactly the same topology, and writes twelve two-hour chunks. Stops and paths are therefore index-identical between the morning, full day and diagram; changing the clock never changes a journey's spatial identity.

The topology manifest is 30.9 KiB compressed and the largest movement chunk is 169.7 KiB compressed. Chunk byte length and SHA-256 are checked before adoption, adjacent chunks are prefetched only after the current one is usable, and the complete 1.38 MiB day never enters the opening request graph. Build-time staging copies the opening lattice, geography, diagram and progressive day artifacts into ignored public files for `/london.html`; the Swiss entry never requests them and Git retains one canonical copy.

## AIR — observed London

The optional **AIR** study replays observed ADS-B/MLAT positions over Greater London on the same Friday and clock as the railway. It is deliberately atmospheric rather than infrastructural: small magenta needles occupy compressed real altitude, leave only a three-minute afterimage and never create a permanent air-route network. Rail stays brighter and denser.

The opening 06:45–08:45 BST artifact contains 374 filtered flight tracks and 15,741 position samples. Its 582 KiB JSON is 199 KiB compressed and is fetched only after AIR is enabled, leaving the rail-led opening payload unchanged. Selecting AIR again in the transport legend applies the normal category emphasis: rail infrastructure, trains and their labels recede while observed flights remain legible.

The 24-hour study indexes 3,182 flight segments and 137,886 samples. A 64 KiB compressed manifest supports callsign and six-character ICAO-address search across the whole day; 24 overlapping one-hour motion files are loaded progressively around the shared railway clock. The busiest file is 132 KiB compressed and the complete air day is about 1.92 MiB compressed, but is never parsed as one browser payload.

Selecting a search result or aircraft needle moves the clock into its observed interval, enters the shared damped follow camera and exposes callsign, ICAO address, altitude, groundspeed and derived heading. Aircraft and trains share the same context-sensitive label control. Heathrow (`LHR` / `EGLL`), London City (`LCY` / `EGLC`) and Gatwick (`LGW` / `EGKK`) are also first-class search results. Selecting one restores geographic space, frames its location, isolates AIR and retains emphasis on the observed tracks which enter its low-altitude approach envelope; unrelated aircraft, rail labels and surface movement recede.

Airport association is deliberately observational rather than scheduled. A track is associated when its recorded samples enter the airport's explicit low-altitude approach envelope, and the resulting identifier is baked into the morning artifact, every progressive day chunk and the day manifest. This preserves the association after an aircraft climbs away while avoiding a false claim that callsign alone reveals origin or destination. The current artifacts identify 144 Heathrow, 46 London City and 27 Gatwick tracks in the morning study, and 1,343, 385 and 153 respectively across the complete day.

The source is the ADSB.lol historical heatmap release for 4 September 2026, cropped to `-0.75,51.2,0.4,51.75` and interpreted at BST (`UTC+1`). The same ground, stale-position and slow/light-aircraft filters as LUFTRAUM are applied offline. Published artifacts preserve ADSB.lol provenance and the ODbL 1.0 licence; raw receiver slices never ship to the browser.

## ROAD — London Orbital

The optional **ROAD** study reconstructs traffic on the M1, M3, M4, M11, M23, M25 and M40 from National Highways WebTRIS observations. It does not represent tracked automobiles. Each warm light particle is a deterministic visual sample of the measured directional flow, while particle speed and the heavier amber stream follow the detector's mean speed and vehicle-length classes. Selecting ROAD applies the same highlight/dim convention as a rail category; searching a motorway isolates its corridor and frames it geographically.

The first full-day artifact records Friday 5 September 2025, a comparable historical weekday because observations for the railway study's future 2026 date do not yet exist. The compiler samples 304 active mainline detector directions at roughly one-kilometre spacing on radial roads and two-kilometre spacing around the M25. It joins them into 292 directional motorway sections and preserves all 96 quarter-hour WebTRIS observations with complete selected-site coverage. This date remains visible in the selection card so the composition never implies that the road and rail layers are contemporaneous observations.

Topology, a small manifest and four six-hour motion chunks are fetched only after ROAD is enabled. The complete optional study is about 222 KiB compressed; the largest motion chunk is about 43 KiB. `npm run data:london:roads` deterministically rebuilds the artifacts from the official site inventory and daily-report API, while the London payload gate validates coverage, time sequence and size. The methodology remains explicit: **traffic-flow reconstruction / no vehicle tracking**.

## SURFACE — Thames crossings

The optional **SURFACE** study adds the three currently advertised scheduled River Bus lines—RB1, RB4 and RB6—and London Cable Car in both directions. It is a physical-map layer, so enabling it enters the 24-hour Friday study and keeps the current clock while diagram mode rests. RB4 and RB6 are already visible during the morning opening; RB1 and the cable car begin later according to the published timetable.

The 492-journey artifact contains 26 source-identified stops and 77 route-path segments, and is about 21 KiB compressed. It stays outside the opening request graph. River and cable movements retain separate `ferry` and `cableway` categories, remain searchable by route or stop, and can be isolated through the same legend policy as rail. `npm run data:london:surface` rebuilds the file from TfL route sequences and Journey Planner timetables; the compiler records source hashes and states that positions are scheduled interpolation rather than observed craft or cabin telemetry.

## Data strategy

Transport for London's Unified API is the primary adapter target. TfL describes it as a common multimodal model and exposes timetables, arrivals, routes, lines, topology and geographic data. API access should remain in offline tooling or a small credential-holding edge adapter; compact studies stay static and deterministic in the browser.

The initial geographic shell is now compiled directly from the Greater London Authority's official web-map context service. Its dedicated London GLA boundary and River Thames polygon layers are transformed to WGS84, rounded and simplified at a 35-metre tolerance. `npm run data:london:geography` reduces 10,921 boundary and 6,191 Thames source vertices to 803 and 256 respectively, producing a 24 KiB source-hashed artifact without relying on a runtime basemap.

TfL attribution and branding rules are part of the edition contract: the project must not imply that All Change is an official TfL application, and each artifact must retain its source and licence metadata.

Sources:

- [TfL open data](https://tfl.gov.uk/info-for/open-data-users/)
- [TfL Unified API](https://tfl.gov.uk/info-for/open-data-users/unified-api)
- [TfL available datasets and attribution guidance](https://tfl.gov.uk/info-for/open-data-users/our-open-data)
- [TfL Elizabeth line timetables](https://tfl.gov.uk/modes/elizabeth-line/elizabeth-line-timetables)
- [TfL London Overground timetables](https://tfl.gov.uk/modes/london-overground/london-overground-timetables)
- [GLA web-map context service](https://gis.london.gov.uk/arcgis/rest/services/apps/webmap_context_layer/MapServer)
- [Greater London boundary layer](https://gis.london.gov.uk/arcgis/rest/services/apps/webmap_context_layer/MapServer/0)
- [River Thames layer](https://gis.london.gov.uk/arcgis/rest/services/apps/webmap_context_layer/MapServer/1)
- [ADSB.lol historical data](https://www.adsb.lol/docs/open-data/historical/)
- [National Highways WebTRIS](https://webtris.nationalhighways.co.uk/)
- [TfL colour standard](https://content.tfl.gov.uk/tfl-colour-standard.pdf)

## Roadmap

### LDN 0 — Adapter proof

- [x] Map the Bakerloo `tube` mode and line identity into the edition-neutral network schema.
- [x] Resolve NaPTAN stops, route geometry and recurring weekday station intervals.
- [x] Produce a source-audited two-hour fixture before attempting the whole city.
- [x] Generalise dwell handling and route matching across Tube branches, DLR and Tramlink.
- [x] Catalogue all five rail-led modes, 20 current line identities, 125 directional branches and representative platform/interchange structures.
- [x] Resolve bounded Elizabeth line and London Overground movement proofs from TfL's official current timetable PDFs.

### LDN 1 — Morning lattice

- [x] Merge representative services from all five rail-led modes into one shared morning contract.
- [x] Expand every Unified API timetable mode to all advertised lines and both directions without losing short-turn, limited-stop or branch identity.
- [x] Add source-audited Greater London and Thames geometry.
- [x] Audit all six Overground lines and the full Elizabeth branch family against the current public PDFs, compiling active patterns and recording unmatched topology branches.
- [x] Compile a stable station-label hierarchy for Zone 1 density and interchange complexes without changing the Swiss fallback ranking.
- [x] Hold the complete opening movement and geography fixtures below a 260 KiB compressed transfer ceiling.
- [x] Ship a dedicated `/london.html` preview with its own catalogue, theme, metadata and request graph over the shared renderer, camera, search and playback engine.
- [x] Hold the complete first view, including the immediately requested 3D renderer and opening data, below a 650 KiB compressed transfer ceiling.
- [x] Cover the London bootstrap, data isolation, layout capability and keyboard station selection in the desktop and iPhone browser matrix.
- [x] Add a phone-safe limited-chrome presentation mode which preserves the timeline, clock, playback and selection state.
- [x] Add a London-specific frame-time gate when the first visible edition scene exists.

### LDN 2 — Day, pulse and dual geometry

- [x] Add a complete Friday study with 10,455 journeys in twelve progressively loaded two-hour chunks.
- [x] Keep the 24-hour topology and movements out of the opening request graph; verify chunk size and SHA-256 before adoption.
- [x] Compile an independent Beck-inspired diagram baseline with stable stop identities, route-path indexes and octilinear geometry.
- [x] Replace generic graph relaxation with a London-shaped central lens, shared interchange cells and direction-invariant schematic bends.
- [x] Animate continuously between **GEOGRAPHY** and **DIAGRAM** without resetting time, selection or follow context; recede physical geography and move toward a top-down camera as the diagram resolves.
- [x] Preserve the accepted station/train label set during the morph and provide an immediate reduced-motion path.
- [x] Keep the diagram lazy, hash-bound to its network and below a 16 KiB compressed transfer ceiling.
- [x] Add an authored override layer for principal interchanges and a simplified Thames, leaving branch bends and label placement in the same curation seam for later visual passes.
- [x] Add an edition-owned line palette which echoes TfL line identities in diagram mode without overwhelming the Motion Studies night palette.
- [x] Add `D` / `G` keyboard shortcuts for the layout switch without allowing them to escape from the search field.
- [x] Include reduced-motion layout switching in the desktop and iPhone browser matrix.
- [x] Create the first shared-clock pulse study for four contrasting interchanges rather than simply ranking the largest stations.
- [x] Add geometry-derived **ALL / RADIAL / ORBITAL** pulse lenses, opposing arrival/departure flow signals and a shared-clock night transition.

### LDN 3 — Surface city

- Add buses as separately loaded borough or corridor studies; never ship the complete bus network in the opening scene.
- [x] Add a separately loaded 24-hour River Bus and cable-car study where the Thames and east-London crossing add geographic meaning.
- Consider a deliberate central-London contrast between subterranean rail and street-level flow.

### LDN 4 — Observed London

- Add realtime predictions only after static timetable identity and line geometry are stable.
- Record bounded historical studies for deterministic playback rather than presenting current API predictions as vehicle telemetry.
- [x] Add an optional, same-clock aviation study with a lazy two-hour opening slice and a progressively loaded 24-hour replay.
- [x] Reuse the restrained needle/trail grammar, category isolation, callsign/ICAO search, label policy, metrics and altitude-aware follow camera without making aviation part of the default payload.
- [x] Add an independently lazy 24-hour motorway study from WebTRIS detector flow and speed, with ROAD isolation, corridor search and explicit non-tracking semantics.

## Exit criterion

All Change must feel like another work made with the same instrument—not Gleislicht with different filenames, and not a generic dark-mode transport dashboard. Its signature image is a living London changing between physical and mental space without interrupting a single journey.
