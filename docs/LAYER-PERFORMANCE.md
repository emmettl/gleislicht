# Rail, regional transport and hub CPU work

Follow-up to [LUFT + Auto profiling](./AIR-ROAD-PERFORMANCE.md). Baseline here already
includes those earlier fixes. All measurements use production builds on an Apple
M4 Max, Chromium with ANGLE Metal, a 1280 × 720 viewport and 4× CPU throttling.
Each view was allowed to load and settle, then sampled for 180 animation frames.

## Changes

- Train-label priority sorting reuses a numeric Swiss German collator. Route and
  service-name comparison reuses the existing default-locale, accent-sensitive
  semantics. This removes repeated collator construction from rail, tram and bus
  labels without changing their text, ordering or label budgets.
- The hub's 60 clock ticks now use three line batches. Corridor spokes are grouped
  by identical material properties, including colour, opacity and depth settings.
  Segment coordinates and category emphasis remain unchanged. Old geometries and
  redundant materials are disposed; existing scene cleanup owns the new batches.
- The displayed study date is formatted when its date or language changes instead
  of on every clock update.

The guarded Vite adapter targets the installed `@motionstudies/three` alpha.5
renderer and fails if its hooks change. These shared-renderer optimizations should
eventually move upstream, replacing the edition adapter.

## Results

JavaScript milliseconds per rendered frame; single before/after runs:

| View | Before | After |
| --- | ---: | ---: |
| National rail, morning | 5.80 | 3.65 |
| National rail, 24 hours | 6.26 | 3.82 |
| PostBus | 7.07 | 7.25 |
| Zürich city | 23.69 | 5.48 |
| ZVV region | 2.62 | 2.41 |
| Geneva | 1.46 | 1.48 |
| City–valley comparison | 2.98 | 2.50 |
| Takt hub | 7.21 | 1.36 |
| Station platforms | 1.90 | 1.61 |
| Zürich–Chur terrain journey | 2.15 | 2.20 |

Zürich's measured frame rate rose from 38.4 to 60.0 FPS; its 95th percentile frame
interval fell from 33.4 to 16.8 ms. Other views stayed around 60 FPS. The main CPU
reductions were Zürich (77%), national rail (37–39%) and the hub (81%). Small
differences in the remaining views are inconclusive from single runs. PostBus,
Geneva and the journey show no material gain in these default camera views.

These are local throttled measurements, not results from Windows Edge or a
physical corporate laptop. The first profile pass identified the hub's draw-call
overhead and Zürich's sorting cost; it did not show a comparable dominant CPU
bottleneck in the platform or terrain views.

## Repeat and verify

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4193 --strictPort
# In another terminal; omit --metal outside macOS.
PROFILE_DIR=/tmp/layer-profiles CPU_RATE=4 node scripts/benchmark-layers.mjs --metal
# Optional subset:
STUDIES=CH,ZH,hub node scripts/benchmark-layers.mjs --metal
```

The script reports the actual renderer, frame timing, scripting time and hottest
sampled functions for each view. Optional CPU profiles can be opened in DevTools.
Unit checks compare train ordering and label identities to the installed renderer,
and compare every hub segment and material before/after batching, including
category selection. Browser checks cover clock tick geometry, category emphasis,
visible map picking and PostBus navigation in Chromium and WebKit.

Validation: 109 unit tests pass, along with build, lint, architecture and bundle
checks. Eleven of the twelve targeted browser scenarios pass across the final
runs. The mobile station-picking scenario selects Salem when its probe expects
Zürich HB; the identical failure also reproduces in an isolated checkout of
unchanged HEAD, so it remains a separate pre-existing issue. At the short desktop
viewport, the transport panel also overlaps the hub service legend; the hub
category-emphasis check uses keyboard activation. Neither issue was changed by
this performance pass.
