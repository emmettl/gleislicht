# Edge follow-up: invisible scene work

The first performance changes improved the reported Windows Edge experience, but
the laptop still struggled with various layer combinations. The first follow-up
below used LUFT + Auto; the later screenshot identified vehicle trails as a
further CPU target shared by the rail and bus studies.

Two additional changes remove work that contributes no visible output:

- Road labels keep their canonical anchors and reusable sprites, but only visible
  badges are attached to the scene. Three.js otherwise updates world transforms
  even for invisible descendants. Zoom and selection still choose badges using
  the same collision and retention rules.
- Aircraft hit spheres remain available to CPU raycasting while their material
  is excluded from rendering. Their instance matrices still follow the aircraft,
  but are no longer marked for upload to the GPU on every frame.

## Isolated measurement

An isolated copy of committed baseline `87520a8` was compared with the same copy
plus only these changes. Other road-geometry and UI work in the shared workspace
was excluded. Production Chromium, Apple M4 Max / ANGLE Metal, 1280 × 720,
8× CPU throttling, SBB off, LUFT and Auto on, 300 measured frames:

| Metric | Before | After |
| --- | ---: | ---: |
| JavaScript time per frame | 14.14 ms | 10.99 ms |
| Frame rate | 59.2 FPS | 60.0 FPS |

This single comparison shows approximately 22% less scripting work, on top of the
previous committed improvements. It is not a Windows Edge measurement and does
not establish whether that laptop's remaining limitation is CPU, GPU or software
graphics rendering. The existing `scripts/benchmark-air-road.mjs` reproduces this
measurement with `CPU_RATE=8` and an optional `PROFILE_OUTPUT` file.

The browser checks verify that detached road badges retain their coordinates
through selection, and that aircraft hit spheres produce no draw calls or
per-frame uploads while remaining clickable with rail disabled. The latter
isolates aircraft picking from the separate rail/station pointer handler.

## Vehicle trails identified in the updated screenshot

The second Edge photo shows animation callbacks occupying 2,262.2 ms (86.4%) of
the selected interval. The callback at approximately column 73095 of deployed
`NationalNetworkScene-DUrs54Li.js` is `VehicleTrails`: 1,255.8 ms (48.0%) inclusive.
Its nested sample callback calls `projectedTrainPosition` (`bn`, column 35520).
These nested totals overlap and must not be added. Station and train label
callbacks also appear in the call tree. This is concrete evidence of substantial
CPU work, but the photograph alone cannot rule out additional GPU limitations.

The follow-up changes preserve the trail sample count and refresh frequency:

- Binary search finds the active stop interval instead of scanning from the
  first stop for every marker, label and trail sample. Schedule ordering is
  validated once per immutable stop array; irregular schedules retain the
  installed renderer's original implementation.
- Trail and vehicle buffer uploads cover only the active vertex prefix,
  rather than capacity reserved for the full timetable. Empty buffers need
  no upload; draw counts still update immediately.
- Trips outside the complete trail window are skipped before taking samples,
  and trail colours are written without allocating a temporary array per segment.

An isolated copy of the current workspace was built before these trail changes,
then rebuilt with only these changes. Both builds retain the preceding air/road
optimizations and identical other work. Production Chromium, Apple M4 Max / ANGLE
Metal, 1280 × 720, 8× CPU throttling, 180 measured frames per study:

| Study | Scripting before | Scripting after | FPS before → after |
| --- | ---: | ---: | ---: |
| National rail | 6.99 ms/frame | 6.76 ms/frame | 60.0 → 59.7 |
| PostBus | 17.30 ms/frame | 14.65 ms/frame | 52.4 → 59.3 |
| Zürich | 12.11 ms/frame | 11.35 ms/frame | 60.0 → 59.7 |

These single comparisons suggest about 15% less scripting for PostBus and 6%
for Zürich; the national rail difference is small. They are not measurements of
the user's Windows laptop. Reproduce with `CPU_RATE=8 STUDIES=CH,PA,ZH` and
`scripts/benchmark-layers.mjs --metal <preview-url>` on macOS. The `--metal` flag
is specific to the local measurement, not a Windows recommendation.

Differential tests compare the indexed lookup with the installed renderer over
real rail, Zürich and Geneva timetable boundaries, including backwards seeks,
duplicate times, cancellation and irregular schedules. Buffer tests exercise
growth, shrinkage, empty traffic and repopulation.

Validation: production build, lint, architecture checks and 138 unit tests passed.
Nine of ten targeted Chromium/WebKit browser checks passed, including PostBus
playback, chunk changes, backwards scrubbing and train picking. The mobile
station check repeated the Zürich HB → Salem mismatch already documented in
`LAYER-PERFORMANCE.md`; it remains a separate selection issue.

Before committing, the exact staged files were exported to an isolated checkout
without the other ongoing workspace edits. Its production build, lint, 122 unit
tests and all four air/road Chromium/WebKit checks passed.

## Auto-only clarification

The user subsequently confirmed that the remaining slowdown also happens with
Auto alone. `networkWithRailVisibility(snapshot, false)` empties the rail trains,
stops and paths, so the old photograph's populated vehicle-trail workload is not
representative of this configuration.

The benchmark now accepts `--road-only` and reports its enabled layers. On the
current local build (`NationalNetworkScene-DN4PGkaS.js`), 1280 × 720, 8× CPU
throttling, 300 frames, the same Auto-only case measured:

| Renderer | FPS | 95th percentile frame | Scripting per frame |
| --- | ---: | ---: | ---: |
| Apple M4 Max / ANGLE Metal | 60.0 | 16.8 ms | 5.45 ms |
| SwiftShader software rendering | 17.9 | 83.3 ms | 8.98 ms |

Both runs reported no page errors. These are single local comparisons, not
Windows Edge measurements. They establish software graphics as a plausible
remaining limitation, not a diagnosis of the laptop. Request the Graphics
Feature Status section of `edge://gpu` before choosing another rendering change.
Microsoft's troubleshooting guidance recommends this check:
https://learn.microsoft.com/en-us/troubleshoot/microsoft-edge/performance/edge-high-cpu-memory

The supplied GPU report subsequently confirmed hardware-accelerated WebGL on
Intel Iris Xe via ANGLE Direct3D11. Software fallback therefore does not explain
the reported laptop case; the local SwiftShader result is only a comparison.

## Fresh SBB-only recording: adaptive trail refresh

The later SBB-only photo names `NationalNetworkScene-BZ8ig2Zf.js`, which includes
the earlier optimizations. Its expanded call tree identifies `VehicleTrails`
(column 77834) at 4,324.3 ms / 48.9% inclusive, `projectedTrainPosition` (`kn`,
40402), directional path sampling (`pt`, 10630), path interpolation (`dt`, 10037),
path orientation (`ft`, 10472), and the indexed timetable lookup (`fe`, 4663).
These nested percentages overlap. This confirms a substantial remaining CPU
cost in SBB even though the separate Auto-only graphics diagnosis is unresolved.

Experiments that cached projected train routes and reused coordinate arrays
did not show a reliable overall gain and were discarded. The retained change
uses a smoothed frame interval to lower trail refresh from at most 30 Hz to
at most 15 Hz when sustained frame rate falls below about 40 FPS. Train markers
retain their normal frame updates, and trail sample times, geometry and length
are unchanged. Normal trail cadence returns after three seconds of recovery
above roughly 52 FPS. Isolated background-tab gaps do not trigger the change.

An isolated copy of the current source was built before and after only this
change. SBB only, Chromium / Apple M4 Max / ANGLE Metal, 1280 × 720, 24× CPU
throttling, 180 measured frames:

| Metric | Before | Adaptive trails |
| --- | ---: | ---: |
| Frame rate | 24.6 FPS | 27.6 FPS |
| Scripting per frame | 34.68 ms | 30.74 ms |
| 95th percentile frame interval | 66.6 ms | 66.6 ms |

This single comparison shows a modest improvement (about 11% less scripting),
not a complete fix or a Windows measurement. The tradeoff is less frequent
trail movement on struggling devices; the normal cadence is retained on smooth
ones. Unit tests cover load detection, recovery hysteresis and invalid deltas.
At 8× CPU throttling, the adaptive build retained 60.0 FPS (7.52 ms scripting
per frame). The final production build, focused lint, architecture checks and
all 225 unit tests passed.
Seven targeted Chromium/WebKit checks passed for schedule changes, route layouts,
24-hour playback and PostBus scrubbing; the suite intentionally skips the mobile
24-hour director scenario. These browser checks ran from the isolated source copy.

## Longer SBB recording: reduce overview clock reconciliation

The longer recording uses the same `NationalNetworkScene-BZ8ig2Zf.js` bundle.
Across roughly 36.9 seconds, animation callbacks occupy 27,842.3 ms (75.5%),
including 17,111.5 ms (46.4%) in trails. This confirms sustained work rather than
an isolated startup spike. These inclusive times overlap.

The second photo also shows 5,374.1 ms (14.6%) in scheduled work with React and
R3F reconciliation branches, and a separate microtask branch at 2,255.8 ms (6.1%).
The photographed `index-Cip1bvH1.js` asset was no longer available when checked,
so its exact minified functions were not independently mapped. The installed
renderer does confirm that `TrainSwarm` reports playback time through React up
to ten times per second.

The additional change reduces overview clock reports to at most five per second
under sustained load, using the same recovery policy as trails. Selected trains
and train comparisons keep their existing ten-per-second reporting cadence,
because their focus markers consume that clock. Train swarm positions continue
to advance every frame. The visible overview clock updates less often under
load; direct seeking and paused clock control retain their existing paths.

Using the same isolated source snapshot and 24× CPU / Metal benchmark settings:

| Metric | Adaptive trails only, repeat | Trails plus adaptive overview clock, repeat |
| --- | ---: | ---: |
| Frame rate | 29.7 FPS | 35.1 FPS |
| Scripting per frame | 28.46 ms | 24.00 ms |
| 95th percentile frame interval | 50.1 ms | 50.0 ms |

An earlier run of the combined change measured 34.4 FPS and 23.99 ms scripting
per frame. The repeat suggests about 16% less scripting from the clock change
alone, with no meaningful p95 improvement in that pair. These are local stress
tests, not verification on Windows Edge; neither change establishes a complete
fix for the laptop or for the separate Auto-only configuration.

The combined change passed its production build, five focused unit tests and
focused lint. Eleven Chromium/WebKit checks passed for schedule switching,
station and route selection, selected-train navigation, 24-hour playback and
PostBus scrubbing; one mobile director scenario was intentionally skipped.

## PostBus trace and stress comparison

The subsequent PostBus photograph shows a similar busy animation-frame call
tree, but is too blurred to assign exact timings or source offsets confidently.
Source inspection confirms that PostBus uses the same `NationalNetworkScene`,
`VehicleTrails` and playback-clock reporting as SBB, so both pending adaptive
changes apply to it.

PostBus alone, with the same isolated builds, Chromium / M4 Max / ANGLE Metal,
1280 × 720, 24× CPU throttling and 180 measured frames:

| Metric | Before both adaptive changes | Adaptive trails and overview clock |
| --- | ---: | ---: |
| Frame rate | 13.4 FPS | 15.0 FPS |
| Scripting per frame | 67.40 ms | 60.21 ms |
| 95th percentile frame interval | 83.4 ms | 83.4 ms |

Both runs reported no page errors. This single comparison indicates about 11%
less scripting and 12% higher average FPS, but the stressed case remains slow.
At frame rates below 15 FPS, a 15 Hz trail cap can still execute on every frame;
the pending changes do not eliminate the underlying path-sampling workload.
These are local stress measurements, not Windows verification. The PostBus
playback, route selection and scrubbing checks already passed in both browsers
with this same combined change, as recorded above.

## Readable PostBus recording from build 175

GitHub Pages run 34237359259 identifies successful build 175 as revision
`3633515673ea47d5e25b7dabbe8b170218c15325`. That revision includes the earlier
indexed timetable and active-buffer optimizations, but neither pending adaptive
change. The live entry `index-B59HLuvx.js` resolves the scene filename to
`NationalNetworkScene-0MZ9ukI9.js` (uppercase I). Reading that exact public bundle
confirms the photographed offsets:

| Activity | Column | Inclusive time | Share of selected recording |
| --- | ---: | ---: | ---: |
| Animation frame fired | — | 11,847.5 ms | 77.9% |
| VehicleTrails frame callback | 77829 | 7,699.3 ms | 50.6% |
| Trail sample mapping | 78389 | 3,612.0 ms | 23.7% |
| Projected position within trail mapping (`kn`) | 40397 | 3,502.8 ms | 23.0% |
| Directional path sampling (`pt`) | 10625 | 1,800.4 ms | 11.8% |
| Path interpolation (`dt`) | 10032 | 920.2 ms | 6.0% |
| Path orientation (`ft`) | 10467 | 767.3 ms | 5.0% |
| Indexed timetable lookup (`fe`) | 4658 | 1,130.4 ms | 7.4% |

These nested times overlap and must not be added. The deployed trail callback
still explicitly uses the fixed `1 / 30` interval. The new evidence therefore
confirms the remaining trail workload before the adaptive changes are deployed.

The accompanying live metrics show LCP 1.60 s (the h1), CLS 0.00, and INP 688 ms.
The interaction list attributes 688/624 ms keyboard interactions and 248/216 ms
pointer interactions to `button.postbus-study-toggle`. This establishes slow
interaction feedback, but does not separate input delay from handler execution
or presentation delay. The study-switch handler updates the active network and
resets selection/time state; the screenshots cannot establish which part of
that work, versus the ongoing animation workload, caused the worst interaction.
No additional switch-handler change was made from this evidence alone.
