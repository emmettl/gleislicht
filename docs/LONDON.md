# London edition

Working title: **GLEISLICHT — LONDON / London in motion**

London is the next edition because its transport system offers a useful inversion of Switzerland: an intensely layered metropolitan network whose identity comes from interchange, radial pressure, orbital lines and the River Thames rather than a national clockface and Alpine geography.

## First study

Start with one ordinary weekday from 06:45–08:45 and keep the first payload rail-led:

- London Underground, Elizabeth line, London Overground, DLR and Tramlink;
- Greater London boundary and the Thames as the dominant geographic anchors;
- real line geometry, station labels, service search, route isolation and follow cameras;
- existing Gleislicht cyan motion grammar, with restrained official line colours used for selection rather than turning the whole scene into a conventional Tube map; and
- deterministic timetable interpolation with explicit provenance.

The first authored moment should show trains converging across central London while orbital and outer branches remain legible. A Thames-crossing follow view would provide the edition's first unmistakably London-specific composition.

## Data strategy

Transport for London's Unified API is the primary adapter target. TfL describes it as a common multimodal model and exposes timetables, arrivals, routes, lines, topology and geographic data. API access should remain in offline tooling or a small credential-holding edge adapter; compact studies stay static and deterministic in the browser.

The initial geographic shell can use the Greater London boundary published by the London Datastore from Ordnance Survey Boundary-Line under the Open Government Licence. The Thames needs a separate simplified water polygon appropriate to the viewport.

TfL attribution and branding rules are part of the edition contract: the project must not imply that Gleislicht is an official TfL application, and each artifact must retain its source and licence metadata.

Sources:

- [TfL open data](https://tfl.gov.uk/info-for/open-data-users/)
- [TfL Unified API](https://tfl.gov.uk/info-for/open-data-users/unified-api)
- [TfL available datasets and attribution guidance](https://tfl.gov.uk/info-for/open-data-users/our-open-data)
- [Greater London boundary](https://data.london.gov.uk/dataset/london-boroughs-e55pw)

## Roadmap

### LDN 0 — Adapter proof

- Map TfL modes and line identifiers into the edition-neutral network schema.
- Resolve NaPTAN stops, platforms, line geometry and service-day times.
- Produce a source-audited two-hour fixture before attempting the whole city.

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

London must feel like another work made with the same instrument—not Switzerland with different filenames, and not a generic dark-mode transport dashboard.
