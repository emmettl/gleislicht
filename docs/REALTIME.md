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

## Edge adapter

`realtime-worker/index.ts` fetches `https://api.opentransportdata.swiss/la/gtfs-rt`, follows redirects, sends the required Bearer credential and identifying user-agent, decodes the protobuf and emits the small JSON contract used by the browser. Cloudflare's cache coalesces viewers onto a 30-second response, respecting the upstream query ceiling.

The API key is never a Vite variable and never enters the static build. To validate locally:

```bash
npm run worker:check
npm run worker:build
```

To activate production after creating the Worker account and feed key:

1. Update `STATIC_FEED_VERSION` in `wrangler.realtime.jsonc` to the exact static artifact version being published.
2. Set the secret with `npx wrangler secret put OPENTRANSPORTDATA_API_KEY --config wrangler.realtime.jsonc`.
3. Deploy with `npx wrangler deploy --config wrangler.realtime.jsonc`.
4. Build the static client with `VITE_GLEISLICHT_REALTIME_URL=https://<worker>/realtime.json`.
5. Verify the returned service date matches the current published GTFS service day before promoting the Pages build.

The endpoint URL is public configuration; the Bearer key stays at the edge. The browser polls at 30 seconds, marks a response stale after 90 seconds, and keeps the last published schedule usable throughout.

## Next increment

Once Trip Updates have been observed reliably against refreshed current-day artifacts, add Alerts as a separate annotation layer. Alert text should not affect movement unless a corresponding Trip Update supplies an operational change.
