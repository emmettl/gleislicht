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
The regional/day loaders and their time-clamping effects still require separate
transition analysis before extraction. In particular, a future change must trace
pause while a chunk is pending, study changes during a request, and selection
through view switches rather than moving the whole app state into a context.
