# Realtime operations

Gleislicht's realtime layer is an adjustment to the timetable, not a vehicle-position system. The Swiss national GTFS-RT product currently supplies Trip Updates and Alerts but no Vehicle Positions. A moving light therefore remains a scheduled interpolation between calls, shifted or removed by the latest prediction where the feed supports it.

## Trust rules

- Every normalized response declares its static feed version and service date.
- The browser applies it only when both values exactly match the displayed artifact.
- A cancellation removes the vehicle from the active animation.
- Delay values shift calls and continue forward until a later stop update changes them.
- A skipped stop is removed only when the adapter can match its source stop ID or a deterministic fixture supplies an exact stop position. GTFS `stop_sequence` is preserved for diagnostics but never guessed into the compact client artifact's ordinal.
- Added, replacement and structurally changed trips stay out of the first release because the static artifact may not contain their complete route geometry.
- Stale, incompatible and failed data always return the viewer to the labelled schedule.

The cyan outer ring identifies a realtime-adjusted vehicle while its normal colour still identifies the service category. Train labels show the current whole-minute offset. The national status card exposes PLAN, DEMO, LIVE, STALE, MATCH or OFF without adding another mobile panel.

## Bundled demo

`public/data/realtime-demo.json` is a deterministic fixture paired with static feed `20260902` on service date `2026-09-04`. It exists to make the complete interaction testable on GitHub Pages without leaking a key. It is labelled `fixture` in the payload and “Operations demo” in the interface.

## Production configuration

The poller, private storage and credential are provisioned. Prepared two-day releases publish an exact rail trip/stop identity index. The Worker verifies that index against the canonical app calendar, then filters updates against it and declares the validated static feed version and service date. There is no manually pinned feed version.

Calendar builds enable the public endpoint as a recoverable runtime capability. LIVE is the default operations mode when configured, with PLAN available from the operations badge; the browser still requires compatible, fresh data before applying corrections. Select **24H** and **Now** to inspect current national rail movements. LIVE does not provide historical predictions when scrubbing. Added/replacement trips and service alerts remain outside this Trip Updates release. See [regular refreshes](REGULAR-REFRESHES.md) for prepared dates, reviewed archives, rollout and monitoring.

The browser falls back to scheduled motion on a failed poll, invalid/future/stale source timestamp, or feed/date mismatch. Freshness uses the upstream `generatedAt`, so recently receiving an old feed cannot make it fresh. A successful compatible poll restores corrections.

## Edge adapter

`realtime-worker/index.ts` uses a one-minute Cloudflare Cron Trigger to fetch `https://api.opentransportdata.swiss/la/gtfs-rt`, follow redirects, send the required Bearer credential and identifying user-agent, and decode the protobuf. The normalized browser contract is written to `gtfs-rt/latest.json` in the private `gleislicht-observations` R2 bucket. Public requests only read that central object, so viewers in different edge regions cannot multiply calls against the upstream token.

The API key is never a Vite variable and never enters the static build. To validate locally:

```bash
npm run worker:check
npm run worker:build
```

For the initial calendar rollout, publish the prepared calendar and then deploy the upgraded Worker with `npm run worker:deploy:realtime`. Subsequent timetable refreshes require no Worker configuration change. Rotate the existing secret only when needed with `npx wrangler secret put OPENTRANSPORTDATA_API_KEY --config wrangler.realtime.jsonc`. The public freshness workflow checks the resulting app/data/Worker pairing.

The endpoint URL is public configuration; the Bearer key and R2 bucket stay at the edge. The browser polls once per minute, marks a response stale after 150 seconds, and keeps the last published schedule usable throughout. The Worker excludes updates explicitly dated for another Swiss service day. See [CLOUDFLARE.md](./CLOUDFLARE.md) for account setup and operational checks.

## Next increment — separate from LIVE enablement

Once Trip Updates have been observed reliably against refreshed current-day artifacts, add Alerts as a separate annotation layer. Alert text should not affect movement unless a corresponding Trip Update supplies an operational change.
