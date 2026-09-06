# 006 — All Change

**A London motion study**

**All Change** is unmistakably London railway language: an instruction, a description of constant interchange, and a slightly ominous title for a glowing city after dark. It also names what is happening technically—the instrument is changing shape as it becomes capable of another place.

London is the next Motion Studies work because its transport system offers a useful inversion of Switzerland: an intensely layered metropolitan network whose identity comes from interchange, radial pressure, orbital lines and the River Thames rather than a national clockface and Alpine geography.

## First study

Start with one ordinary weekday from 06:45–08:45 and keep the first payload rail-led:

- London Underground, Elizabeth line, London Overground, DLR and Tramlink;
- Greater London boundary and the Thames as the dominant geographic anchors;
- real line geometry, station labels, service search, route isolation and follow cameras;
- the shared cyan motion grammar, with restrained official line colours used for selection rather than turning the whole scene into a conventional Tube map; and
- deterministic timetable interpolation with explicit provenance.

The first authored moment should show trains converging across central London while orbital and outer branches remain legible. A Thames-crossing follow view would provide the edition's first unmistakably London-specific composition.

## Adapter proofs

The first compiled fixtures are deliberately smaller than the first visible edition. They exercise the shared network contract without entering Gleislicht's public payload or edition selector:

- Bakerloo: 39 weekday journeys from Elephant & Castle across 25 NaPTAN stations;
- Northern: 84 journeys from Morden across short turns and the Bank/Charing Cross branch structures;
- DLR: 51 journeys from Bank split correctly toward Lewisham and Woolwich Arsenal;
- Tramlink: 17 journeys from Beckenham Junction, using TfL's alternate `Monday to Friday` schedule spelling;
- Lioness: 12 complete southbound journeys from Watford Junction to Euston; and
- Elizabeth line: 27 complete westbound journeys from Abbey Wood to Paddington.

The compiler now collapses TfL's repeated arrival/dwell interval records into one stop call with distinct arrival and departure times. Each interval pattern is matched to the ordered NaPTAN IDs for its own route branch before the official line string is split. Shared segments are reused, while genuinely different branches retain different geometry.

Run `npm run data:london:proofs` to refresh the bounded adapter proofs, or use the individual proof scripts for one request. `TFL_API_KEY` is supported for route-sequence access and should be used for repeated requests, in line with TfL's developer guidance. The generated metadata records retrieval time, source hashes, source endpoints, TfL's data-service terms, the selected weekday schedule and the fact that these are not realtime or complete London service-day claims.

`npm run data:london:catalogue` separately discovers every currently advertised line in the five rail-led modes. Its compact committed catalogue preserves 20 line identities and 125 directional branch definitions, each with ordered NaPTAN stops and a geometry hash. Three NaPTAN hierarchy samples retain interchange, entrance and platform children without inventing absent platform names.

TfL documents that its Journey Planner timetable feed covers Underground, bus, DLR, tram, cable car and river—not Elizabeth line or London Overground. Both rail modes do have current official public timetable PDFs. A separate grid extractor now accepts only columns with a complete, monotonic time at every station on a selected branch, records the PDF hash and validity dates, and combines the resulting movements with Unified API route geometry. This supplies honest bidirectional Elizabeth line and Lioness studies without pretending their unavailable Unified API timetable endpoints work. Regenerating those proofs requires Poppler's `pdftotext`; the compiled JSON remains dependency-free.

`npm run data:london:lattice:unified` fans out through every distinct branch origin advertised for Tube, DLR and Tramlink in both directions. It compiles 1,422 movements, 356 source-identified stops and 1,019 real path segments across 13 lines and 26 directions. Limited-stop trains use the complete branch geometry between calls; TfL's overlapping DLR terminal responses are retained only where their stop pattern matches the selected route. Two Metropolitan origins advertised in topology have no suitable Friday schedule and remain explicitly listed as inactive instead of disappearing.

`npm run data:london:assemble` adds the bounded bidirectional Elizabeth and Lioness studies to produce a 1,475-movement, 385-stop, five-mode morning contract. Stops and paths are deduplicated by source identity and exact geometry. It remains under `fixtures/tfl/`, so neither the 1.1 MB Unified artifact nor the assembled study enters Gleislicht's public payload.

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
- [ ] Extend PDF movement extraction across the remaining five Overground lines and the full Elizabeth branch family.
- Tune station-label hierarchy for the density of Zone 1 and interchange complexes.
- Preserve the existing phone transfer and frame-time budgets.

### LDN 2 — Day and pulse

- Add progressively loaded 24-hour chunks.
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

All Change must feel like another work made with the same instrument—not Gleislicht with different filenames, and not a generic dark-mode transport dashboard.
