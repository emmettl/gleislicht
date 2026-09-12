# Gleislicht data releases

The production app loads its public study datasets from `https://data.motionstudies.app`, backed by the `motionstudies-data` R2 bucket. The existing private `gleislicht-observations` bucket is separate.

Each release lives at `/gleislicht/releases/<sha256>/`. The identifier hashes a sorted inventory of every file's path, byte count and SHA-256. A release is immutable: keep previous releases available so open sessions, previous app versions and rollbacks continue to work. Do not apply an automatic expiration policy to this prefix.

`src/editions/data-release.json` pins the app's release. The build emits this pointer as `_data-release.json`; data files are excluded from `dist`. `npm run build` does not regenerate timetables and works without `public/data`. It typechecks production application code; `npm run typecheck` still includes test code and fixture imports. Development uses committed fixtures; `npm run build:fixtures` explicitly creates an offline build. `VITE_GLEISLICHT_DATA_URL` permits an HTTPS data-root override for testing. Never put an upload credential in a `VITE_` variable.

## Publishing data

1. Assemble and validate the intended dated datasets under `public/data`.
2. Run `npm run data:prepare` to generate matching app catalogues and orbital blocks.
3. Run `npm run data:release:prepare` to validate chunk references and write `.data-release/release.json`.
4. Supply `CLOUDFLARE_R2_ACCESS_KEY_ID` and `CLOUDFLARE_R2_SECRET_ACCESS_KEY` through the environment and run `npm run data:release:publish`.
5. Build the app, run `npm run check:bundle` and `npm run pages:prepare`.

The publisher uploads to the new release prefix, verifies every file through the public domain (including browser CORS and SHA-256), and writes `_release.json` last. Only after successful verification does it update the app pointer. Failed uploads never activate an app release. Re-running an already completed release verifies it without overwriting it. `node scripts/publish-data-release.mjs <inventory> <directory> --verify-only` verifies without publication or pointer changes.

The Pages workflow is the single scheduled publisher of live national and regional data. The separate `Refresh national test fixtures` workflow is manual-only and prepares reviewed fixture updates. Its build job now waits for browser tests, publishes verified R2 data using the existing protected `cloudflare-pilot` environment, then builds the small app artifact and runs Chromium/iPhone WebKit checks against its pinned R2 release before uploading it. That environment needs `CLOUDFLARE_R2_ACCESS_KEY_ID` and `CLOUDFLARE_R2_SECRET_ACCESS_KEY` from an R2 account token with Object Read & Write permission limited to `motionstudies-data`. The publisher uses the S3-compatible API: bucket-scoped object credentials do not authorize Cloudflare REST API uploads. The existing Worker deployment token remains unchanged. A missing permission fails publication and keeps the previous app live. The Cloudflare follow-up uses trusted main-branch publishing code in this repository and retains successful-run, provenance, archive and cache-policy checks.

Failed upstream downloads recover the release pinned by the current public app. Original service dates remain intact. The legacy GitHub Pages data URL is accepted only when the live app has no external-data pointer yet.

## Host configuration

- Bucket/domain/account: `config/data-host.json`.
- Browser access: `config/data-cors.json`, GET/HEAD from any origin, no credentials.
- Cache rule: `Gleislicht immutable R2 releases`, matching only `https://data.motionstudies.app/gleislicht/releases/*`. Eligible for cache; use origin Cache-Control and bypass caching when absent; respect origin browser TTL.
- Objects: `Cache-Control: public, max-age=31536000, immutable`.
- JSON uses `application/json`. Precompressed orbital blocks use `application/gzip` with no Content-Encoding, because the client decompresses them explicitly. Archived HTML evidence uses `text/plain` to preserve its exact bytes through the CDN.
- Raw recordings and ingestion inputs under `data/` are not part of this publication. Only the existing public study payload under `public/data` is inventoried.

The first migrated release preserves the latest successful public national/regional artifacts from Pages run `34578446883` (11 September 2026), the existing static public studies with their recorded dates, and orbital blocks regenerated from those inputs. `migration-provenance.json` records this provenance.

## Rollback

Rebuild or redeploy an earlier app artifact to use its existing data release. For a source-level rollback, restore the earlier data pointer and its matching generated study summaries and road catalogue together. Never replace bytes beneath an existing release identifier.

## Local build and fixture boundaries

- `npm run build`: application assets and the pinned release pointer only; no timetable generation or local study payload required.
- `npm run typecheck` and `npm test`: retain the committed fixtures for full regression checks.
- `npm run data:prepare && npm run build:fixtures`: explicitly regenerate app catalogues and orbital fixtures, then build an offline app. Catalogue generation changes tracked source files; restore them after temporary fixture experiments before building the pinned production release.
- `public/data` remains the fixture/source input directory, not a second production data store. Do not delete it until dependent tests have smaller replacement fixtures.
- `.data-release` is ignored staging output. Keep completed R2 releases available; local staging cleanup does not require deleting published objects.
