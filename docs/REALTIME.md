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

The poller, private storage and credential are provisioned. On 9 September 2026 the public national timetable used feed `20260905`, while the Worker still declared `20260902`; the compatibility gate correctly withheld LIVE. The Worker configuration now uses `20260905`, matching the published morning and full-day manifests. An evening source check matched 1,355 of 2,304 scheduled trips by exact ID to the current updates, including 1,171 trips with positive stop delays. These are one verification sample, not fixed coverage guarantees.

LIVE is compiled into a release only after a fresh `/health` response matches its national timetable. It is then the default operations mode, with PLAN available from the operations badge. Select **24H** and **Now** to inspect current national rail movements. A current feed may have no updates for the archived morning window; LIVE does not provide historical predictions when scrubbing. Regional, road and aircraft studies retain their own dated data. Added/replacement trips and service alerts remain outside this first Trip Updates release.

The browser falls back to scheduled motion on a failed poll, invalid/future/stale source timestamp, or feed/date mismatch. Freshness uses the upstream `generatedAt`, so recently receiving an old feed cannot make it fresh. A successful compatible poll restores corrections.

## Edge adapter

`realtime-worker/index.ts` uses a one-minute Cloudflare Cron Trigger to fetch `https://api.opentransportdata.swiss/la/gtfs-rt`, follow redirects, send the required Bearer credential and identifying user-agent, and decode the protobuf. The normalized browser contract is written to `gtfs-rt/latest.json` in the private `gleislicht-observations` R2 bucket. Public requests only read that central object, so viewers in different edge regions cannot multiply calls against the upstream token.

The API key is never a Vite variable and never enters the static build. To validate locally:

```bash
npm run worker:check
npm run worker:build
```

For a static-feed upgrade or recovery (the account, bucket and feed key already exist):

1. Update `STATIC_FEED_VERSION` in `wrangler.realtime.jsonc` to the exact static artifact version being published.
2. Only if the secret needs provisioning or rotation, set it with `npx wrangler secret put OPENTRANSPORTDATA_API_KEY --config wrangler.realtime.jsonc`.
3. Deploy with `npm run worker:deploy:realtime`.
4. Let the Pages workflow regenerate the current Swiss service day and query the Worker's `/health` endpoint.
5. The workflow sets `VITE_GLEISLICHT_REALTIME_URL=https://<worker>/realtime.json` only when the service date, static-feed version and freshness all pass. A mismatch publishes the normal demo-capable site without LIVE mode.

The endpoint URL is public configuration; the Bearer key and R2 bucket stay at the edge. The browser polls once per minute, marks a response stale after 150 seconds, and keeps the last published schedule usable throughout. The Worker excludes updates explicitly dated for another Swiss service day. See [CLOUDFLARE.md](./CLOUDFLARE.md) for account setup and operational checks.

## Next increment — separate from LIVE enablement

Once Trip Updates have been observed reliably against refreshed current-day artifacts, add Alerts as a separate annotation layer. Alert text should not affect movement unless a corresponding Trip Update supplies an operational change.
