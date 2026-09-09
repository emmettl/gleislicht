# E2E to Vitest migration — 9 September 2026

The [original review](E2E-TEST-REVIEW.md) covered 142 logical scenarios in 52 files, registered 284 times across Chromium and iPhone WebKit. The migrated suite has **49 logical scenarios in 22 files, registered 94 times**: 49 Chromium and 45 WebKit. This removes 190 browser executions (67%) before device-specific skips and retries. The separate Solothurn configuration is retired; its data and UI behavior are covered by the common component suite.

## Where the coverage moved

There are **106 mounted component and hook tests** in `src/test`. They use the real `App`, lazy UI components, production hooks, validators, timetable transformations and committed fixture bytes. Only GPU scenes and external I/O are replaced. Other Vitests retain the Node environment; these seven files opt into jsdom individually.

| Original browser coverage | Replacement |
| --- | --- |
| Seven cantonal recordings: identity, final observation, gaps, links, retries and stale responses | [recordings.dom.test.tsx](../src/test/recordings.dom.test.tsx), [controls.dom.test.tsx](../src/test/controls.dom.test.tsx) |
| Basel, Bern, Solothurn, Lausanne, Luzern, Zug, Thurgau, Fribourg and Ticino: day/date selection, search, seeking, shares, morning/chunk retries and translations | [regions.dom.test.tsx](../src/test/regions.dom.test.tsx) |
| Gornergrat, Pilatus, Rochers, Territet and Jungfrau: actual calls, arrivals, replay, direction/departure selection, manual exit, terrain/timetable failures and retries | [journeys.dom.test.tsx](../src/test/journeys.dom.test.tsx) |
| Glion: exact shared connection, interchange, wrong-date responses, independent leg failures and unreviewed descent; Rigi: approaches, transfers, Kaltbad, replay and corridor retries | [journeys.dom.test.tsx](../src/test/journeys.dom.test.tsx), [terrain-state.dom.test.tsx](../src/test/terrain-state.dom.test.tsx) |
| Movement counts, operations/day controls, frequency UI, cogwheel/PostBus failures, road catalogues, airport board, performance overlay, Rigi rhythm and all nine guide selections | [controls.dom.test.tsx](../src/test/controls.dom.test.tsx) |
| Delayed and failed translations | [language.dom.test.tsx](../src/test/language.dom.test.tsx) |
| National road chunk adoption, regional response cancellation, unavailable dates | [loading.dom.test.tsx](../src/test/loading.dom.test.tsx) |

Existing pure tests continue to cover exhaustive timetable calls, dwell interpolation, directions, terrain masks, geometry binding, URL serialization, counts and worker scheduling. The new layer tests their client-side integration rather than repeating those algorithms in a second implementation.

Some assertions are stronger than their predecessors: midnight retries require an exact prior-day train identity in the scene's input; road loading checks the adopted minute values instead of attribution copy; the airport test actually changes the clock and checks the departure board. Cancellation tests resolve the delayed response after switching away, including transports that ignore abort.

## What remains in browsers

- Real raycasting and mouse/touch station, train, aircraft and road selection.
- Actual geometry buffers, labels, batching, worker execution and worker disposal.
- Responsive layout, overflow, long translated regional headings, keyboard shortcuts, focus and native dialog behavior.
- Actual lazy module/network requests and module failure recovery; representative share-and-reload and recording geometry retry flows.
- Eight terrain smoke cases covering each separately wired mountain route, Glion's two renderers, timetable Rigi and scenic Rigi. Measured-terrain cases require a rendered frame and verify continued playback when a tunnel/covered/alignment boundary unmounts the scene.
- Orbit transitions, mobile hub/journey flows and the JavaScript-disabled methodology page.

Chromium runs pure buffer/batching invariants and the static methodology test once. WebKit still checks workers, picking, scene lifecycle, touch and layout. Keeping each mountain route's renderer wiring makes the final count slightly higher than the review's initial 35–45 scenario target.

Removed success-only screenshots and camera-only sleeps had no assertions. Failure screenshots and traces remain. Core tests now attach request listeners before navigation, and device-specific skips run before starting the app.

## Run locally

Use Node 24 from `.nvmrc`.

```sh
npm test                  # Entire Vitest suite, including component tests
npm run test:components   # The 106 migrated component/hook cases
npm run test:e2e          # Browser-specific coverage
E2E_PORT=4293 npm run test:e2e -- --workers=1
```

The optional port permits an isolated Vite server when the default 4180 is occupied. CI still uses the same checks and three browser runners; Chromium shards contain 25 and 24 registrations, and WebKit has 45. No deployment gate was removed.

Local Node 24 validation passed 1,329 Vitests in 32.82 seconds; the focused 106-case component suite took 12.24 seconds. Browser validation passed all 90 runnable project cases with retries disabled: 88 in the 7.9-minute discovery run and both renamed guide cases in a 7.9-second focused rerun, with four existing device-specific skips. The guide title changed after initial discovery, so those two registrations could not execute in that run. Build, typecheck, lint, edition boundaries, worker checks/dry builds, Node 24 bundle budgets and Pages artifact preparation also passed.

Hosted wall-clock savings still need measurement: browser registration reduction is not a proportional runtime guarantee, and timetable generation remains on the deployment critical path.
