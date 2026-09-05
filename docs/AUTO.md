# AUTO — Road Study 001

AUTO is Gleislicht's third transport grammar. It does not pretend to track cars. It reconstructs a moving field from aggregate road-counter flow and speed, preserving the distinction between three ways movement becomes legible as data.

| Mode | What is known | What Gleislicht constructs |
| --- | --- | --- |
| Rail | Timetabled stop events | Interpolated journeys |
| LUFT | Broadcast position and velocity | Smoothed observed trajectories |
| AUTO | Aggregate directional flow and mean speed | Synthetic traffic particles |

## Road Study 001

The first study follows the A1 through the Zürich region, from the Aargau side through Zürich to Winterthur. Its path is anchored by georeferenced sites in the current ASTRA / Federal Roads Office Measurement Site Table. It shares the national 06:45–08:45 clock and is a separately loaded static JSON artifact, so the railway-first opening payload is unchanged.

The committed traffic values are **representative calibration**, not historical observations. ASTRA's realtime feed retains only the latest complete minute. Gleislicht has not yet accumulated an authenticated archive, so the prototype uses deterministic morning curves to test the visual and interaction model over authentic detector geography.

The artifact says this in machine-readable metadata:

```text
measurementKind: representative-calibration
model: Traffic-flow reconstruction / no vehicle tracking
```

## Reconstruction

For flow `q` in vehicles/hour and mean speed `v` in kilometres/hour, the estimated density is `k = q / v` vehicles per kilometre. The renderer takes a stable visual sample from that density, spaces marks along the physical corridor and advances them using the interpolated mean speed. Light vehicles appear as warm-white streaks; heavy vehicles are larger amber marks. Speed is integrated through the minute samples so neither scrubbing nor a new counter minute makes the stream jump.

The number shown in the status card is an approximate corridor occupancy derived from density and corridor length. A rendered mark represents part of an aggregate flow, never a particular road user.

## Artifact

- Builder: `npm run data:road`
- Output: `public/data/swiss-road-morning.json`
- Cadence: one minute
- Window: 06:45–08:45 on the shared study day
- Loading: only after AUTO is selected

## National motorway topology audit

AUTO now also loads a compact skeleton derived from FEDRO's official Axis of National Routes dataset. It contains 3,080 simplified axis segments across 25 numbered national roads and remains separate from the opening railway payload. High-confidence counter sites appear as restrained warm points; the complete axes remain dim until AUTO is selected.

The current Measurement Site Table contains 458 federal station IDs and 1,765 detector records. After removing emergency lanes and records without a usable direction, 848 directional groups remain. The reproducible audit reports 659 direct spatial matches, 49 matches resolved from neighbouring-counter continuity, 10 interchange directions resolved from FEDRO's own TMC point-to-road references and 130 unmatched groups. No ambiguous direction remains in review. In station terms, 379 of 458 federal sites are accepted on the national-axis model. Unmatched sites are retained in the artifact and are never silently forced onto the nearest motorway; the federal feed also contains counters on other important roads.

The accepted sites form 609 directional counter-to-counter sections after colocated detector records are collapsed. Where both counters lie on the same official axis branch, the artifact also carries the intervening simplified FEDRO geometry so observed motion follows the road rather than a chord. These are measurement-ready topology, not invented traffic observations: they define where a complete recorded feed can attach flow and speed. AUTO exposes every published A-road corridor through search, adds direct focus controls for A1, A2, A3, A9 and A13, and frames a selected corridor without removing its national context.

```sh
npm run data:road:topology -- \
  --axes /path/to/ch.astra.nationalstrassenachsen.xtf \
  --measurement-sites /path/to/astra-measurement-site-table.xml \
  --tmc-points /path/to/POINTS.DAT \
  --tmc-segments /path/to/SEGMENTS.DAT \
  --tmc-roads /path/to/ROADS.DAT \
  --tmc-version 7.5
```

Coordinates in the counter table are coarse, so a match is considered directly high confidence only within 800 metres and when a competing numbered road is at least 180 metres farther away. A second pass may accept a candidate when nearby directly accepted stations overwhelmingly support the same road. Remaining interchange ambiguity is resolved only when the Measurement Site Table's Alert-C location code maps to exactly one national road in FEDRO's TMC table. Anything farther than 1,500 metres remains `unmatched`. Direct, continuity-resolved and authoritative TMC-resolved sites participate in the section model.

## From calibration to recorded data

The repository includes an authenticated recorder for ASTRA's DATEX II 2.3 SOAP feed. It asks only for the eleven A1 counter groups used by this study, makes one pull after each minute publication, and writes append-only snapshots with receipt time, source publication time and detector-table version. The API key is read only from the process environment and the ignored recording directory is created with owner-only files.

```sh
# One snapshot; add -- --raw to retain the source XML beside it.
ASTRA_API_KEY=... npm run data:road:record

# Continue at one pull per minute. A failed pull is reported, never fabricated.
ASTRA_API_KEY=... npm run data:road:record:watch

# Record every accepted federal site into a separate archive.
ASTRA_API_KEY=... npm run data:road:record:watch -- --scope=national
```

National recording derives its explicit station filters from the committed topology and records the scope and requested-station count in every snapshot. It still makes one filtered request per minute; it does not multiply the polling cadence by the number of roads. The national archive is kept separate from the A1 study by default.

Once at least 60 complete national minutes exist, the national compiler validates continuity and coverage, aggregates parallel lanes at each accepted directional site and emits a small manifest plus time chunks. The browser loads only the current chunk and then its neighbours; it joins compact site samples to the 609 committed sections locally:

```sh
npm run data:road:compile:national -- \
  --input=recordings/astra-national \
  --date=2026-09-05
```

The output is deliberately separate from the public calibration until its date can be paired with matching rail and air studies and reviewed on real devices. Once the manifest is present, AUTO detects it automatically and replaces the calibration particles with observed minute conditions while retaining the disclosure that individual vehicles are synthetic.

Each directional cross-section can contain several lanes. The compiler sums those parallel lane flows and uses a flow-weighted lane speed. It then takes the median across successive counter sites, because summing those sites would count essentially the same motorway stream repeatedly. A minute is usable only when at least 60% of the configured sites in both directions report all four light/heavy flow and speed values.

```sh
npm run data:road:compile -- \
  --input=recordings/astra \
  --date=2026-09-05 \
  --output=public/data/swiss-road-recorded.json
```

Compilation requires at least 60 complete, consecutive minutes by default and rejects gaps over 75 seconds, mixed Swiss service dates and sparse directions. Its output uses the existing browser contract but declares `measurementKind: recorded` plus the precise UTC range, complete-minute count and minimum coverage. It does not overwrite the calibration artifact by default: a measured road study should be paired with rail data for the same service date and reviewed before becoming the public default.

Possible later studies include the A2 Gotthard approach and a full recorded day. `Fahrstrom` remains an appealing artwork title, but AUTO is the unambiguous interface name while the project also depicts railway traction infrastructure.
