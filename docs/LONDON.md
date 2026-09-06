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

The first complete diagram artifact now provides that mechanical baseline. `npm run data:london:diagram` applies a deterministic topology relaxation, assigns all 505 source-identified stops to unique grid positions and emits 1,414 path-index-compatible horizontal, vertical or 45-degree routes. The resulting artifact is 61.7 KiB raw and 9.5 KiB compressed. Its source-network and authored-override hashes, stop coverage, identity uniqueness, path coverage and octilinear geometry are enforced by the London build gate. `fixtures/tfl/all-change-diagram-overrides.json` is the intentionally separate, initially empty visual-editing seam: future station grid positions and path bends can be curated there without modifying the solver, timetable artifact or runtime.

The first prototype should cover the complete rail-led morning lattice rather than a single showcase line; the value of the transformation is seeing the entire city's physical irregularity resolve into logical structure. Acceptance criteria are:

- no vehicle jump, route reassignment or clock discontinuity during the morph;
- the current selection remains visible and understandable throughout;
- deterministic geometry and label results for recording and scrubbing;
- a reversible keyboard- and touch-accessible **GEOGRAPHY / DIAGRAM** control;
- a reduced-motion path that changes layout without a sweeping animation; and
- mobile frame time and artifact size included in the London-specific performance gates.

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
- Add a London-specific frame-time gate when the first visible edition scene exists.

### LDN 2 — Day, pulse and dual geometry

- [x] Add a complete Friday study with 10,455 journeys in twelve progressively loaded two-hour chunks.
- [x] Keep the 24-hour topology and movements out of the opening request graph; verify chunk size and SHA-256 before adoption.
- [x] Compile an independent Beck-inspired diagram baseline with stable stop identities, route-path indexes and octilinear geometry.
- [x] Animate continuously between **GEOGRAPHY** and **DIAGRAM** without resetting time, selection or follow context; recede physical geography and move toward a top-down camera as the diagram resolves.
- [x] Preserve the accepted station/train label set during the morph and provide an immediate reduced-motion path.
- [x] Keep the diagram lazy, hash-bound to its network and below a 16 KiB compressed transfer ceiling.
- Add an authored override layer for interchanges, branch spacing, crossings, label placement and a simplified Thames.
- [x] Add `D` / `G` keyboard shortcuts for the layout switch without allowing them to escape from the search field.
- [x] Include reduced-motion layout switching in the desktop and iPhone browser matrix.
- Create hub studies for a small set of contrasting interchanges rather than simply ranking the largest stations.
- Explore radial versus orbital pulse views and night-service transitions.

### LDN 3 — Surface city

- Add buses as separately loaded borough or corridor studies; never ship the complete bus network in the opening scene.
- Add River Bus and cable-car movement where they add geographic meaning.
- Consider a deliberate central-London contrast between subterranean rail and street-level flow.

### LDN 4 — Observed London

- Add realtime predictions only after static timetable identity and line geometry are stable.
- Record bounded historical studies for deterministic playback rather than presenting current API predictions as vehicle telemetry.
- Evaluate aviation and road layers independently; London does not need to reproduce Switzerland's triad by default.

## Exit criterion

All Change must feel like another work made with the same instrument—not Gleislicht with different filenames, and not a generic dark-mode transport dashboard. Its signature image is a living London changing between physical and mental space without interrupting a single journey.
