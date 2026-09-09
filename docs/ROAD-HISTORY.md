# Daily road archive and trend analysis

The private `gleislicht-road-daily` Cloudflare Worker compiles the previous
`Europe/Zurich` civil day at **03:17 UTC**, with a second attempt at **06:17 UTC**.
It reads the existing national ASTRA minute recordings in `gleislicht-observations`.
It needs no ASTRA API key, GitHub credential, public endpoint or development Mac.
The existing recorder continues collecting national and Zürich cantonal observations.
Daily derived products currently cover the accepted national counters only.

## Retention and publication

Original observations remain under `astra/<scope>/<UTC date>/`. The processor has
no deletion operation and writes only under `road-history/`. The bucket's only
lifecycle rule, checked on 9 September 2026, aborts unfinished multipart uploads;
it does not expire recorded objects. No automatic expiry is introduced.

Each derived day is saved under:

```text
road-history/v1/national/YYYY-MM-DD/<topology-and-policy-sha256>/
  minutes/00.json.gz ... minutes/23.json.gz
  hourly.csv.gz
  daily.json.gz
  topology.json.gz
  manifest.json
```

The manifest is written last. `road-history/v1/national/latest.json` advances only
when every expected source minute exists and every minute has usable observations
from at least 60% of accepted directional counters. Promotion is conditional on
the previous pointer's ETag; a backfill cannot move the latest date backwards.
Incomplete days retain summaries with explicit missing/sparse timestamps, but do
not replace the latest complete day. Such scheduled runs report failure and retry
at the second scheduled time. Complete dated products are reused on subsequent
runs; topology or policy changes get distinct archive identities.

Raw downloads, invalid JSON, detector-table changes, conflicting duplicate
detectors and storage errors fail the run. No successful manifest is published
from a partially written output. A daily scheduled invocation streams four raw
responses at a time and retains only one hour of minute values in memory.

These are private archival products. The website's curated recording remains a
separate publication decision; this job does not rewrite the dates of other layers
or publish a rolling road overlay. The minute archive uses elapsed seconds since
the actual Swiss midnight, with UTC start and offset-qualified local-hour labels.
It is not a drop-in replacement for the browser's civil-clock manifest.

## Measurements and comparisons

- Each summary row represents one directional counter, with its stable identifier,
  road, direction and detector set; parallel lanes are combined.
- Every configured lane must report usable flow for both classes. Positive flow
  requires positive speed. Zero flow may omit speed.
- `lightVehicles` and `heavyVehicles` integrate reported vehicles/hour over the
  observed one-minute intervals (`flow / 60`). These are estimated counter passages,
  not tracked or unique network vehicles. Missing minutes are never extrapolated.
- Mean speeds are weighted by vehicle flow across lanes and minutes. With no
  observed vehicles, speed and heavy-vehicle share are null. With no usable minutes,
  volumes are also null; measured zero is retained as zero.
- Every hourly and daily row reports expected and observed minutes and coverage.
  Do not add successive counters to estimate the number of unique vehicles.
- Swiss daylight-saving days contain 1,380 or 1,500 expected minutes and 23 or 25
  hourly rows per counter. Repeated autumn hours have different UTC timestamps
  and offset-qualified labels; the skipped spring hour is not fabricated.

The initial comparison command uses only counters with complete coverage on both
days, identical detector sets and an identical topology hash. It refuses comparisons
between different day lengths. It reports per-counter changes in estimated
passages, light-vehicle mean speed and heavy-vehicle share, without a network total.
Use comparable weekdays and account for holidays and source changes before treating
differences as trends. A longer archive is needed for baselines or anomaly detection.

## Local regeneration and analysis

Node 24 runs the shared TypeScript processor directly. Export the source day using
the existing R2 exporter, or reuse the ignored local recording directory:

```sh
node scripts/build-road-daily-archive.mjs --date=2026-09-08
node scripts/compare-road-days.mjs /path/to/baseline/daily.json.gz /path/to/current/daily.json.gz
```

The local builder defaults to yesterday and writes under
`recordings/road-history/`, which is ignored by Git. `--input` selects a recording
directory and `--output` selects a root mirroring R2 object keys. Exit status 2
means a retained incomplete day; other failures are errors. Hourly CSVs can be
decompressed for spreadsheet or analytical tools.

The 8 September seed contains all 1,440 minute files, a minimum minute coverage of
84.1%, and 17,232 hourly rows across 718 directional counters. There are 385 counters
with complete day coverage. Locally compressed hourly CSV is 405,745 bytes and the
daily summary is 28,279 bytes; Cloudflare compression may differ slightly.

An authenticated remote scheduled test on 9 September completed in 72 seconds.
The resulting R2 manifest, 24 chunk hashes and all 1,440 minute rows were read back
and verified; see [the seed audit](../data/road-daily-archive-audit.json). The live
Worker was deployed as version `c29f9e03-fa39-49d9-a847-c8f1fff2d1a4`, with both
daily triggers confirmed by Cloudflare.

## Deployment and checks

```sh
npx vitest run road-daily-worker scripts/compare-road-days.test.mjs
npx tsc -p road-daily-worker/tsconfig.json
npx wrangler deploy --config wrangler.road-daily.jsonc --dry-run --outdir .worker-dist/road-daily
npx wrangler deploy --config wrangler.road-daily.jsonc
```

The Pages workflow checks the processor's types and Worker build, but does not
deploy it. Deploy this independent Worker when its source changes. Its configured
CPU and subrequest limits bound a run; the existing paid Workers account supports
the per-day workload. See Cloudflare's [scheduled-handler documentation](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/)
and [conditional R2 writes](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
