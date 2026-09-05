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

## Adapter proof

The first compiled fixture is deliberately smaller than the first visible edition: 39 weekday Bakerloo journeys overlapping 06:45–08:45, running outbound from Elephant & Castle across 25 NaPTAN stations. It uses TfL's timetable station intervals for movement timing and splits the official route-sequence line string into 24 station-to-station paths. The 25 KiB artifact lives under `fixtures/tfl/`, so it exercises the shared network contract without entering Gleislicht's public payload or edition selector.

Run `npm run data:london:proof` to refresh the proof from the Unified API. Anonymous access currently works for this bounded request; `TFL_API_KEY` is supported and should be used for repeated access, in line with TfL's developer guidance. The generated metadata records retrieval time, source hashes, both endpoints, TfL's data-service terms, the recurring weekday model and the fact that this is not realtime or a complete London service-day claim.

## Data strategy

Transport for London's Unified API is the primary adapter target. TfL describes it as a common multimodal model and exposes timetables, arrivals, routes, lines, topology and geographic data. API access should remain in offline tooling or a small credential-holding edge adapter; compact studies stay static and deterministic in the browser.

The initial geographic shell can use the Greater London boundary published by the London Datastore from Ordnance Survey Boundary-Line under the Open Government Licence. The Thames needs a separate simplified water polygon appropriate to the viewport.

TfL attribution and branding rules are part of the edition contract: the project must not imply that All Change is an official TfL application, and each artifact must retain its source and licence metadata.

Sources:

- [TfL open data](https://tfl.gov.uk/info-for/open-data-users/)
- [TfL Unified API](https://tfl.gov.uk/info-for/open-data-users/unified-api)
- [TfL available datasets and attribution guidance](https://tfl.gov.uk/info-for/open-data-users/our-open-data)
- [Greater London boundary](https://data.london.gov.uk/dataset/london-boroughs-e55pw)

## Roadmap

### LDN 0 — Adapter proof

- [x] Map the Bakerloo `tube` mode and line identity into the edition-neutral network schema.
- [x] Resolve NaPTAN stops, route geometry and recurring weekday station intervals.
- [x] Produce a source-audited two-hour fixture before attempting the whole city.
- [ ] Generalise the proof across the remaining rail-led modes, branches and platform-level stop structures.

### LDN 1 — Morning lattice

- Compile the five rail-led modes for the shared morning window.
- Add Greater London and Thames geometry.
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
