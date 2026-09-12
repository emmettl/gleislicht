# Cloudflare operations

The public static home is https://motionstudies.app/gleislicht/. GitHub Pages supplies the validated release artifact and remains an available mirror; see [publishing](PUBLISHING.md). The realtime and recording services use the private `gleislicht-observations` R2 bucket:

- `gleislicht-realtime` polls Swiss GTFS-RT once per minute, normalizes it and serves the central `gtfs-rt/latest.json` object at `/realtime.json`.
- `gleislicht-astra-recorder` waits until 24 seconds after each minute publication and writes append-only gzip snapshots below `astra/<scope>/<UTC date>/`.
- `gleislicht-road-daily` compiles yesterday's national recordings at 03:17 UTC, retries at 06:17 UTC, and retains dated minute chunks, hourly CSV and daily counter summaries under private `road-history/` keys. It promotes only complete days and never deletes source recordings. See [daily road history](ROAD-HISTORY.md).

The London observation Worker shares this bucket; its [operating guide](https://github.com/emmettl/allchange/blob/main/docs/CLOUDFLARE.md) and deployment commands now live in All Change.

No API token enters the browser, GitHub Pages artifact or repository. Each upstream product has its own Worker secret.

## Provisioned services and maintenance

The account, R2 bucket, realtime credential and ASTRA credential are already provisioned. The upgraded realtime Worker validates its pairing against the canonical app's prepared timetable calendar and trip/stop identity index; static feed upgrades no longer need a manually changed version setting. Publish the first calendar release, deploy the upgraded Worker once, and check the public freshness workflow. Credentials remain Worker secrets. See [regular refreshes](REGULAR-REFRESHES.md) for rollout and failure behavior.

## One-time account setup

1. Enable the Cloudflare Workers paid plan and R2 in the Cloudflare dashboard.
2. Authenticate this checkout:

   ```sh
   npx wrangler login
   ```

3. Create the shared private bucket once:

   ```sh
   npx wrangler r2 bucket create gleislicht-observations
   ```

4. Confirm that the public `_timetable-calendar.json` contains today and a checksum-verified rail identity index in its immutable data release.
5. Add the product-specific secrets. Each command prompts without echoing or saving the token locally:

   ```sh
   npx wrangler secret put OPENTRANSPORTDATA_API_KEY --config wrangler.realtime.jsonc
   npx wrangler secret put ASTRA_API_KEY --config wrangler.astra.jsonc
   ```

6. Leave `COLLECTING_ENABLED` set to `false` for the first ASTRA deployment, then deploy the Workers:

   ```sh
   npm run worker:deploy:realtime
   npm run worker:deploy:astra
   ```

The ASTRA Worker has no public HTTP route. The Swiss realtime deployment prints its `workers.dev` URL; the browser endpoint is that URL followed by `/realtime.json`.

After an ASTRA credential has passed a one-shot local request, set `COLLECTING_ENABLED` to `true` in `wrangler.astra.jsonc` and redeploy. This explicit switch prevents a rejected or expired credential from generating a failed request every minute.

## Verification

Cron changes can take several minutes to propagate. Tail each Worker until one successful scheduled invocation appears:

```sh
npx wrangler tail gleislicht-realtime
npx wrangler tail gleislicht-astra-recorder
```

Then open the realtime `/realtime.json` endpoint. A healthy response has `metadata.kind: "live"`, a current `generatedAt`, the configured `staticFeedVersion`, and a non-empty `updates` array. A `503` immediately after deployment means the first Cron invocation has not populated R2 yet.

The public `/health` response contains only the current timestamps, service date and static-feed version. The Pages workflow uses it as a deployment gate: it regenerates the current Swiss service day and enables `VITE_GLEISLICHT_REALTIME_URL` only when that artifact exactly matches a fresh Worker snapshot. A scheduled Pages run performs the same check every morning. GitHub and Cloudflare credentials remain separate; the Worker URL is public configuration.

Use the Cloudflare dashboard's R2 object browser to confirm that a current gzip object exists under `astra/national/<UTC date>/`. Do not make the bucket public.

## Scope and retention

The recorder was expanded to `national` on 7 September 2026 after verifying 991 A1 Zürich minute snapshots spanning 16½ hours, with two missing minutes. National mode derives 379 accepted station filters from the committed topology at build time and keeps the same single request per minute. The original A1 archive remains under `astra/a1-zurich/`; new recordings go under `astra/national/`. Earlier national conditions cannot be recovered from the latest-minute feed.

National coverage means the accepted federal counters on the national-road topology, not every Swiss road. The topology has 718 accepted directional sites and 609 counter-to-counter sections; unmatched federal sites remain excluded.

On 8 September 2026, the recorder configuration adds `ADDITIONAL_RECORDING_SCOPE=zurich-cantonal`. This unions 331 Zürich station filters with the existing 379 federal filters in one upstream request and writes the cantonal subset below `astra/zurich-cantonal/`. The first local verification reported 323 stations and 690 detectors. Each scope has independent freshness validation and coverage metadata; missing cantonal data does not prevent a valid federal minute from being stored. See [the cantonal pilot](./CANTONAL-ROADS.md) for source hashes, geometry matching and the remaining playback work. Remove the additional variable and redeploy to disable supplementary collection.

Deployment `b013bd36-d449-4042-ac8c-8140fec8ff9f` completed at 13:23:54 CEST. An R2 check at 13:47 CEST confirmed 23 consecutive cantonal measurement minutes (13:23–13:45) with no missing keys, and a matching current federal snapshot. Recording runs in Cloudflare and continued through the development Mac's interruption.

The first published national morning is 8 September 2026 from 06:45 through 08:45 CEST. All 121 expected minute snapshots passed the compiler's continuity gate, and accepted-site coverage ranged from 84.1% upward. The generated manifest and progressive chunks are public static artifacts; the raw R2 archive remains private.

On 9 September the same recording was extended to the complete 8 September civil day: all 1,440 snapshots from 7 September 22:00 UTC through 8 September 21:59 UTC passed compilation with `--minimum-samples=1440`. No minute is missing, and minimum accepted-site coverage remains 84.1%. The output contains 24 hourly chunks with identical observed samples overlapping at hour boundaries for interpolation. AUTO is available in both the morning and full-day national views. The cantonal pilots are unchanged.

To export a complete Swiss civil day for compilation, create an R2 object read token scoped to `gleislicht-observations`, then expose its S3-compatible values only to the command process:

```sh
CLOUDFLARE_ACCOUNT_ID=... \
R2_ACCESS_KEY_ID=... \
R2_SECRET_ACCESS_KEY=... \
npm run data:road:export -- --scope=national --date=2026-09-07

npm run data:road:compile:national -- --date=2026-09-07
```

The exporter reads the adjacent UTC partitions needed to cover the requested Europe/Zurich day, decompresses the objects locally and writes owner-only files below the ignored `recordings/astra-national/` directory. Use `--scope=a1-zurich` and `data:road:compile` to export and compile the earlier corridor archive in `recordings/astra/`. The access key needs object-read permission only; it must not be committed or added to a Vite variable.

Use `--scope=zurich-cantonal` to export the archive into `recordings/astra-zurich-cantonal/`. Audit availability with `scripts/audit-cantonal-road-coverage.mjs`, then use the separate cantonal compiler and pinned pilot builder described in [Cantonal roads](CANTONAL-ROADS.md). Seven recordings across six reviewed corridors are published; exporting later observations does not automatically extend their catalog windows or authorize additional road geometry.

Retain raw national and cantonal minute objects for historical analysis. No automatic expiry is configured; the existing lifecycle rule aborts only unfinished multipart uploads. Dated derived summaries and minute chunks are also retained. The GTFS latest object is overwritten and needs no lifecycle rule.

## Local checks

These checks require no credentials or Cloudflare account:

```sh
npm run worker:check
npm run worker:build
```

For local scheduled-event testing, put development-only tokens in the ignored `.dev.vars` file and use Wrangler's scheduled test route. Never put production tokens in a Vite variable or committed file.
