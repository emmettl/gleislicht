# AUTO — Road Study 001

AUTO is Gleislicht's third transport grammar. It does not pretend to track cars. It reconstructs a moving field from aggregate road-counter flow and speed, preserving the distinction between three ways movement becomes legible as data.

| Mode | What is known | What Gleislicht constructs |
| --- | --- | --- |
| Rail | Timetabled stop events | Interpolated journeys |
| LUFT | Broadcast position and velocity | Smoothed observed trajectories |
| AUTO | Aggregate directional flow and mean speed | Synthetic traffic particles |

## Road Study 001

The [regional road source survey](REGIONAL-ROAD-SOURCE-SURVEY.md) documents potential additions to the federal and Zürich cantonal sources, including verified Basel/Thurgau API samples and the requirements for using hourly count archives.

The first study follows the A1 through the Zürich region, from the Aargau side through Zürich to Winterthur. Its path is anchored by georeferenced sites in the current ASTRA / Federal Roads Office Measurement Site Table. It shares the national 06:45–08:45 clock and is a separately loaded static JSON artifact, so the railway-first opening payload is unchanged.

The public national study uses **recorded observations** from 8 September 2026. It contains every minute from 06:45 through 08:45 CEST, covering 718 accepted directional sites and 609 sections; the weakest accepted minute still covers 84.1% of sites. ASTRA's realtime feed retains only the latest complete minute, so Gleislicht records an append-only historical series before compilation. Authenticated A1 collection began on 6 September 2026 and expanded nationally on 7 September.

The artifact says this in machine-readable metadata:

```text
measurementKind: recorded
model: Section traffic-flow reconstruction / no vehicle tracking
```

## Reconstruction

For flow `q` in vehicles/hour and mean speed `v` in kilometres/hour, the estimated density is `k = q / v` vehicles per kilometre. The renderer takes a stable visual sample from that density, spaces marks along the physical corridor and advances them using the interpolated mean speed. Light vehicles appear as warm-white streaks; heavy vehicles are larger amber marks. Speed is integrated through the minute samples so neither scrubbing nor a new counter minute makes the stream jump.

The number shown in the status card is an approximate corridor occupancy derived from density and corridor length. A rendered mark represents part of an aggregate flow, never a particular road user.

## Artifact

- Builder: `npm run data:road:compile:national`
- Output: `public/data/swiss-road-national-manifest.json` and `public/data/swiss-road-national/`
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

## Recorded data pipeline

Zürich cantonal-road collection is now implemented as a separate `zurich-cantonal` scope, using 331 stations from the shared Measurement Site Table. An initial live request reported 323 stations. The supplementary Worker scope shares the national request cadence and archives observations separately; AUTO also loads 246 official Zürich road axes on demand, with 298 stations matched to geometry. Cantonal cards show mapped length and a geometry-only notice. The Horgen ZH 3 card additionally offers a 1.3 km afternoon pilot: 40 complete recorded minutes on 8 September 2026 across three windows, with vehicles hidden in the two explicit observation gaps and a separate afternoon timeline. The ZH 1 card offers the reviewed Wallisellen–Bassersdorf pilot: 3.46 km in both directions, with 104 complete minutes from 14:14–15:57 CEST on the same date. Search either town to find it, or choose **Road recordings** from the main view to browse the published pilots. The picker shows dates, time windows and observation gaps before opening a recording paused. Both pilots disclose unmeasured junction turns and load their recording only when selected or opened through a recording link. **Share study** restores the selected pilot, its recording date and playback time, paused; Horgen gap times remain visibly unavailable. See [Cantonal roads — Zürich pilot](./CANTONAL-ROADS.md) for the source inventory, limitations and implementation sequence.

The repository includes an authenticated recorder for ASTRA's DATEX II 2.3 SOAP feed. Its default scope asks for the eleven A1 counter groups used by this study; `national` and `zurich-cantonal` use explicit station filters from their respective topology/catalog. It makes one pull after each minute publication and writes append-only snapshots with receipt time, source publication time and detector-table version. The API key is read only from the process environment and the ignored recording directory is created with owner-only files.

For unattended collection, `astra-worker/index.ts` provides the equivalent Cloudflare Cron Worker. It waits until 24 seconds after each nominal minute and writes gzip-compressed append-only snapshots to the private `gleislicht-observations` R2 bucket. The configuration uses `national` with the supplementary `zurich-cantonal` scope: 379 accepted federal station filters plus 331 Zürich station filters in one request per minute, archived separately. See [CLOUDFLARE.md](./CLOUDFLARE.md).

Completed R2 days can be pulled into the same ignored local recording format with `npm run data:road:export -- --date=YYYY-MM-DD`. The exporter uses read-only S3-compatible R2 credentials and deliberately fetches adjacent UTC partitions so a Europe/Zurich civil day is not clipped at midnight.

```sh
# One snapshot; add -- --raw to retain the source XML beside it.
ASTRA_API_KEY=... npm run data:road:record

# Continue at one pull per minute. A failed pull is reported, never fabricated.
ASTRA_API_KEY=... npm run data:road:record:watch

# Record every accepted federal site into a separate archive.
ASTRA_API_KEY=... npm run data:road:record:watch -- --scope=national
```

National recording derives its explicit station filters from the committed topology and records the scope and requested-station count in every snapshot. It still makes one filtered request per minute; it does not multiply the polling cadence by the number of roads. The national archive is kept separate from the A1 study by default. Negative or nonnumeric flow/speed values are omitted and counted in `metadata.invalidMeasurementValues` so one bad detector field does not discard a national minute. Missing fields remain missing; stale publications and repeated detector records still fail validation.

Once at least 60 complete national minutes exist, the national compiler validates continuity and coverage, aggregates parallel lanes at each accepted directional site and emits a small manifest plus time chunks. The browser loads only the current chunk and then its neighbours; it joins compact site samples to the 609 committed sections locally:

```sh
npm run data:road:compile:national -- \
  --input=recordings/astra-national \
  --date=2026-09-05
```

The national renderer uses at most 1,500 light and 520 heavy vehicle marks across the network. Combined with hourly data chunks loaded on demand, this bounds the client workload while preserving one-minute source measurements. Road selection increases the visual sampling density of the selected corridor. These limits are implementation bounds, not a substitute for checking frame times on real devices.

The recorded output remains separate from the A1 calibration. AUTO detects the manifest automatically and replaces the fallback particles with observed minute conditions while retaining the disclosure that individual vehicles are synthetic. The first public road recording is dated 8 September 2026; the currently committed rail and air studies retain their own source dates and share only the 06:45–08:45 playback clock.

Each directional cross-section can contain several lanes. The compiler sums those parallel lane flows and uses a flow-weighted lane speed. The A1 compiler then takes the median across successive counter sites, because summing those sites would count essentially the same motorway stream repeatedly. A minute is usable only when at least 60% of the configured sites in both A1 directions, or 60% of accepted national directional sites, report usable light and heavy conditions. An explicitly zero vehicle flow remains usable when mean speed is absent: the compiled numeric speed is zero as an empty-class playback placeholder. Missing flows and positive flows without speed remain incomplete. The first national samples had approximately 88% usable directional-site coverage.

```sh
npm run data:road:compile -- \
  --input=recordings/astra \
  --date=2026-09-05 \
  --output=public/data/swiss-road-recorded.json
```

Compilation requires at least 60 complete, consecutive minutes by default and rejects gaps over 75 seconds, mixed Swiss service dates and sparse directions. Its output uses the existing browser contract but declares `measurementKind: recorded` plus the precise UTC range, complete-minute count and minimum coverage. Publishing the manifest does not overwrite the calibration artifact, which remains a resilient fallback.

Possible later studies include the A2 Gotthard approach and a full recorded day. `Fahrstrom` remains an appealing artwork title, but AUTO is the unambiguous interface name while the project also depicts railway traction infrastructure.

## Selecting roads and comparing traffic

Click a visible motorway line or A-road shield to select it (touch uses a larger
screen-space tolerance). The road card plots estimated vehicles per kilometre per
direction for the complete available recording, on a zero-based scale that stays
fixed during playback. Its slider pauses and seeks the shared map clock. The
quieter-to-busier indicator compares the current density with that road's peak
within this recording; it does not classify congestion or road capacity. Missing
minutes remain gaps, measured zero remains zero, and the calibration fallback is
labelled as an illustrative profile. The card includes the road recording's own
date and the limits of its measured coverage.

Moving road marks now follow arc-length interpolation on connected published axis
polylines. The renderer uses the directional counter's matched axis segment to
recover paths through a small graph of official vertices, joining only vertices
within two metres to allow for coordinate rounding. It no longer draws spline
shortcuts or substitutes a counter-to-counter chord when a path is missing.
Disconnected, distant or implausibly circuitous routes omit moving marks while
retaining the road baseline and the counter observations in the summary/history.
This deliberately reduces the animated coverage of the present incomplete topology.

The recording picker also includes **Kilchberg–Thalwil**: 4.8 km of ZH 3 / Seestrasse with 142 uninterrupted recorded minutes from 14:14–16:35 CEST on 8 September 2026. ZH 3 now has separate Horgen and Kilchberg–Thalwil recording identities and an in-card selector. The fourth recording, **Meilen–Stäfa**, adds 4.1 km and 245 uninterrupted minutes from 13:23–17:27 CEST. Its direction review uses the official St. Gallen KS17 continuation to resolve Rapperswil; playback stays between the original Zürich counters.

**Meilen** is the fifth recording: the adjacent 2.9 km Seestrasse section, with 142 uninterrupted minutes from 14:14–16:35 CEST. It has its own shareable identity and three mapped junction areas. The ZH 17 card can switch between Meilen and Meilen–Stäfa.
