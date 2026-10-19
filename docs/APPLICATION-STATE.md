# Application state boundaries

19 October 2026 · First bounded extraction

`src/studies/use-startup-assets.ts` owns eager national rail, boundary and lake
requests, their cancellation, loaded values and the blocking national-rail error.
Boundary and lake errors remain optional warnings. It does not fetch regional,
full-day, air, road or hub data, retry automatically, or control playback.
Cleanup aborts all three requests and ignores late results and failures even if a
transport or JSON decoder ignores cancellation.

The application retains playback intent (`playbackEnabled`), displayed timetable
time, playback rate, study selection and the Now clock. Suspension derives the
effective playing state without changing the user's stored intent. Loading an
opening asset cannot set playing state or seek the clock. The existing Now tests
protect pause, seek and suspension; startup tests protect independent assets,
blocking versus optional failures, source changes and teardown.

This is a local responsibility boundary, not a shared application controller.
Regional/PostBus clock handoff now lives in
`src/studies/use-chunked-playback.ts`. It owns the pending explicit seek and the
handoff back to scene ticks. The shared `useProgressiveNetworkDay` hook continues
to own manifests, chunks, integrity checking and request cancellation. The app
retains play/pause intent, source selection, Now mode, road-specific seeks and
selection/view commands.

| Transition | Result |
| --- | --- |
| Seek into an unloaded chunk | Display the requested time immediately; gate scene playback until ready. |
| Pause before the chunk arrives | Keep paused intent and the sought time when data arrives; only explicit resume restarts playback. |
| Seek again while waiting | The latest seek wins; a queued frame from the old time cannot undo it. |
| Change study, date, range or PostBus layer | A new clock owner rejects old scene commands, including after returning to the original study. |
| Retry a failed chunk | Use the shared loader's explicit retry; retain time, selection and play/pause intent. |
| Unmount or suspend | Reject retired callbacks or paused scene ticks. |

Regional retry no longer toggles activation with a timer. Optional morning
requests also ignore obsolete failures after cancellation, matching their existing
success guard. Existing selection/view ownership is unchanged; regional searches,
dated shares and PostBus route/layer transitions remain covered by integration
and browser journeys.

This is a local coordination hook, not a shared controller or a new npm API.
National-day loading now uses the same published progressive network-day hook.
It preserves the national morning fallback until a manifest is available, then
uses the full-day metadata with empty traffic while the requested chunk is
pending. Current chunk readiness gates scene playback, with the same paused-seek
handoff used by regional and PostBus views. Failed manifests/chunks expose an
explicit Retry button without changing time or playback intent. Successful
neighbour prefetches survive another neighbour's failure; obsolete responses
cannot affect a later seek or another study. Other source-specific state remains
separate.

Validation: 59 focused unit/DOM cases and 14 Chromium/WebKit journeys passed,
including a held regional response released after pause, explicit retry, dated
regional searches/shares, and PostBus playback/selection. Type, lint,
architecture, fixture build and bundle checks passed; lint retains three existing
Date-purity warnings. Opening JavaScript: 376.9 KiB gzip / 380 KiB limit.


National-day migration checks: nine new app regressions cover fallback, manifest
and chunk retry, pause during loading, midnight/end-of-day boundaries, repeated
seeks, study switches and independent neighbouring prefetches. The focused set
covers 68 unit/DOM cases. Opening JavaScript is 376.6 KiB gzip / 380 KiB limit.
