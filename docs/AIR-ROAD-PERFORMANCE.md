# LUFT + Auto CPU work

The September 2026 Windows Edge report showed animation callbacks taking roughly
50–75 ms, with nearly all the selected interval spent in scripting. A screenshot
cannot identify individual minified functions or establish a Windows-specific cause.

Profiling the same layer combination locally found two avoidable costs:

- Aircraft label sorting called `localeCompare` with numeric options for every
  comparison on every frame. Reusing one English numeric `Intl.Collator` preserves
  the ordering while avoiding repeated collator construction.
- National road interpolation scanned the timeline and both observation arrays
  separately for each reporting site. The local sampler finds the time bracket
  once per timestamp, indexes its two observation arrays, and caches interpolated
  values for that timestamp. Animation, the movement counter and selected-road
  statistics all use it. The cache retains only two minute indexes per snapshot;
  its weak snapshot keys allow old chunks to be collected.

The air renderer also reuses its transformation object and avoids calculating an
unused `useRef` initializer on each React render. Curves, vehicle limits, animation
rate and visual quality settings are unchanged.

These are guarded Vite adaptations of `@motionstudies/three` 0.1.0-alpha.5, following
the existing edition adapters. An incompatible package update fails the build;
the adapters should be removed when equivalent changes ship in the shared package.

## Local measurement

Production build, Chromium, Apple M4 Max with ANGLE Metal, 1280 × 720 viewport,
4× CPU throttling, SBB disabled, LUFT and Auto enabled, 300 measured frames:

| Metric | Before | After |
| --- | ---: | ---: |
| JavaScript time per frame | 10.30 ms | 6.30 ms |
| Frame rate | 60.0 FPS | 60.0 FPS |
| 95th percentile frame interval | 16.7 ms | 16.8 ms |

This single before/after comparison shows about 39% less scripting work. Both
runs were already display-limited at 60 FPS. CPU throttling on a Mac does not
reproduce a corporate Windows laptop's CPU, GPU, browser policy or extensions.
Recheck on that laptop before claiming an Edge frame-rate improvement.

To repeat against a local production preview:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4193 --strictPort
# In another terminal; omit --metal outside macOS.
CPU_RATE=4 PROFILE_OUTPUT=/tmp/air-road.cpuprofile node scripts/benchmark-air-road.mjs --metal http://127.0.0.1:4193/
```

The script reports the actual GPU renderer and saves an optional DevTools CPU
profile. Software rendering results should be identified separately. Tests
compare indexed conditions and counts against the installed package over recorded
observations, forward/backward seeks, boundaries, missing sites and empty chunks,
and check that aircraft sorting retains numeric and selection priorities.
