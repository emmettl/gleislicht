# Cloudflare operations

GitHub Pages remains the public static host. Cloudflare runs two narrowly scoped services against one private R2 bucket:

- `gleislicht-realtime` polls Swiss GTFS-RT once per minute, normalizes it and serves the central `gtfs-rt/latest.json` object at `/realtime.json`.
- `gleislicht-astra-recorder` waits until 24 seconds after each minute publication and writes append-only gzip snapshots below `astra/<scope>/<UTC date>/`.

Neither API token enters the browser, GitHub Pages artifact or repository. The two upstream products issue separate tokens even when they belong to the same API Manager application.

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

4. Confirm that `STATIC_FEED_VERSION` in `wrangler.realtime.jsonc` exactly matches the GTFS Static version used by the currently published Swiss artifact.
5. Add the product-specific secrets. Each command prompts without echoing or saving the token locally:

   ```sh
   npx wrangler secret put OPENTRANSPORTDATA_API_KEY --config wrangler.realtime.jsonc
   npx wrangler secret put ASTRA_API_KEY --config wrangler.astra.jsonc
   ```

6. Leave `COLLECTING_ENABLED` set to `false` for the first ASTRA deployment, then deploy both Workers:

   ```sh
   npm run worker:deploy:realtime
   npm run worker:deploy:astra
   ```

The ASTRA Worker has no public HTTP route. The realtime deployment prints its `workers.dev` URL; the browser endpoint is that URL followed by `/realtime.json`.

After an ASTRA credential has passed a one-shot local request, set `COLLECTING_ENABLED` to `true` in `wrangler.astra.jsonc` and redeploy. This explicit switch prevents a rejected or expired credential from generating a failed request every minute.

## Verification

Cron changes can take several minutes to propagate. Tail each Worker until one successful scheduled invocation appears:

```sh
npx wrangler tail gleislicht-realtime
npx wrangler tail gleislicht-astra-recorder
```

Then open the realtime `/realtime.json` endpoint. A healthy response has `metadata.kind: "live"`, a current `generatedAt`, the configured `staticFeedVersion`, and a non-empty `updates` array. A `503` immediately after deployment means the first Cron invocation has not populated R2 yet.

The public `/health` response contains only the current timestamps, service date and static-feed version. The Pages workflow uses it as a deployment gate: it regenerates the current Swiss service day and enables `VITE_GLEISLICHT_REALTIME_URL` only when that artifact exactly matches a fresh Worker snapshot. A scheduled Pages run performs the same check every morning. GitHub and Cloudflare credentials remain separate; the Worker URL is public configuration.

Use the Cloudflare dashboard's R2 object browser to confirm that a current gzip object exists under `astra/a1-zurich/<UTC date>/`. Do not make the bucket public.

## Scope and retention

The first deployment deliberately records only the eleven A1 Zürich groups. After it has produced a complete day, `RECORDING_SCOPE` can be changed to `national` in `wrangler.astra.jsonc` and the Worker redeployed. National mode derives 379 accepted station filters from the committed topology at build time.

To export a complete Swiss civil day for compilation, create an R2 object read token scoped to `gleislicht-observations`, then expose its S3-compatible values only to the command process:

```sh
CLOUDFLARE_ACCOUNT_ID=... \
R2_ACCESS_KEY_ID=... \
R2_SECRET_ACCESS_KEY=... \
npm run data:road:export -- --date=2026-09-06

npm run data:road:compile -- --date=2026-09-06
```

The exporter reads the adjacent UTC partitions needed to cover the requested Europe/Zurich day, decompresses the objects locally and writes owner-only files below the ignored `recordings/astra/` directory. Use `--scope=national` after national collection begins. The access key needs object-read permission only; it must not be committed or added to a Vite variable.

Do not add an automatic deletion rule until R2 download and daily compilation have been exercised. Once that path is proven, retain compiled, audited day chunks and expire raw national minute objects on an explicit rolling window. The GTFS latest object is overwritten and needs no lifecycle rule.

## Local checks

These checks require no credentials or Cloudflare account:

```sh
npm run worker:check
npm run worker:build
```

For local scheduled-event testing, put development-only tokens in the ignored `.dev.vars` file and use Wrangler's scheduled test route. Never put production tokens in a Vite variable or committed file.
