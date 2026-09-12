# Regular timetable refreshes

## Release contract

The Pages workflow runs at 03:37 and 18:37 UTC. Each run resolves today's date in Europe/Zurich and builds both today and tomorrow, with the correct timetable year for each date. The evening run gives another opportunity to publish before midnight; correctness does not depend on a build finishing at midnight.

National rail, hubs, the cogwheel catalogue, national PostBus, Zürich city, ZVV, Geneva and Lausanne are prepared for both dates. Basel, Bern, Solothurn, Nyon and Riviera still pass through their reviewed-date refresh policies; outside those policies they retain verified historical artifacts. Other regional/mountain studies, road recordings and aircraft observations retain their existing dates. This change does not admit unreviewed regional coverage or turn recordings into live observations.

`scripts/timetable-calendar.mjs` requires exact dates, national feed agreement, complete national chunk coverage and checksums, source stop identities, and the existing regional geometry/size checks. It builds a rail identity index from the validated movement chunks. A missing tomorrow or a fallback with an older date fails assembly: the existing published release remains available and is never relabelled as current.

Both days are copied into `calendar/YYYY-MM-DD/` inside one immutable R2 release. Top-level aliases remain available to existing consumers. Before replacing live aliases, the build retains the checkout's reviewed weekday inputs under `weekday/YYYY-MM-DD/`. Orbital chooses these when today's aliases are weekend data, or a newer weekday alias when available. Orbital discovery excludes the calendar copies so preparing tomorrow cannot change its composite weekday policy. The app emits `_timetable-calendar.json` containing the prepared dates, identity checksums, exact immutable data root and configured realtime endpoint.

## Midnight

New sessions select the prepared Swiss date. Every manifest and movement chunk in a session uses that same date and immutable root. An active **Now** session checks for rollover every 15 seconds and when the document resumes, opens the prepared new day, and resumes **Now**. Paused/historical playback does not switch dates. Only the daily timetable studies participate; reviewed historical regions keep their own dates.

If no new day is available, the app retains the existing labelled schedule and the monitor reports the gap. An already-open historical session does not silently pick up a newly deployed data root. Date links can select either of the two days available in that release; the calendar is not a permanent archive of all prior dates.

## Realtime alignment

The Worker reads the canonical app calendar on its existing once-per-minute poll, selects today's exact entry, verifies the immutable rail identity index by SHA-256, and pairs normalized updates to that index's date and feed version. It caches index bytes until the release/hash changes. It admits only known trips with ordered source stop identities; exact dated cancellations may omit stop updates. Unknown trips, changed or reversed stops, and ambiguous sequence-only updates are discarded. GTFS sequence numbers are never inferred to be compact stop positions. This validates the usable subset; it does not assert that every upstream trip belongs to the static feed.

There is no `STATIC_FEED_VERSION` setting to maintain. The app's calendar build enables the endpoint before publication; runtime feed/date and 150-second source freshness checks still decide whether corrections can apply. This avoids needing a Worker already paired to an unpublished release. Worker failures leave the last stored snapshot untouched; the browser rejects it once stale or incompatible and returns to scheduled playback.

Deploy the updated Worker once with `npm run worker:deploy:realtime` after the first calendar release is publicly available. Its existing API secret and private R2 binding remain in place. Subsequent timetable releases need no Worker configuration changes. Until that deployment, the public monitor reports the missing alignment capability. Worker code changes continue to use the existing explicit deployment command.

## Public monitoring

`Check public freshness` runs hourly and after successful Cloudflare publication. It checks the public app calendar and release pointer agree, today exists, tomorrow is ready by Swiss noon, national manifests/indexes match their hashes, actual movement chunks are readable, all daily regions/PostBus have the correct date, and the Worker and public realtime response are fresh and paired to today's index/version/date. A quiet feed with zero updates is valid; LIVE cannot manufacture updates outside upstream coverage.

The checker retries briefly to tolerate deployment and minute-poll propagation. A persistent problem fails the GitHub Actions run with a specific error and a run summary. Notifications use repository Actions notification settings; there is no separate external alert subscription. The checker is read-only and does not repair or republish data.

Run it manually with `node scripts/check-public-freshness.mjs`. Local regression tests cover Swiss midnight/DST, absent dates, corrupt chunks/indexes, old fallback rejection, nested release references, stop identity mismatches and public freshness failures. Full source/geometry and production browser gates remain in the publication workflow.
