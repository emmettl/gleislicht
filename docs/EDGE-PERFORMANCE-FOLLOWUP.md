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
