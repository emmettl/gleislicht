# CI build time

The Pages workflow checks code and committed fixture budgets before starting the expensive work. Once those checks pass, five runners work independently:

- Chromium shard 1/2.
- Chromium shard 2/2.
- iPhone WebKit, the touch/layout/lifecycle suite.
- Today's national timetable.
- Today's Zürich city, ZVV and Genève morning/full-day timetables.

A final build job waits for the browser shards, combines the two verified data artifacts, explicitly prepares app catalogues and orbital blocks, checks realtime compatibility, and publishes the immutable R2 release using bucket-scoped S3 credentials. It then builds the small app pinned to that release. Regional work overlaps national generation and browser tests.

Each browser runner installs only its own engine and uses one worker. `fullyParallel` is enabled in CI so Playwright splits individual tests across shards, including tests in the large `gleislicht.spec.ts` file. The worker limit still prevents simultaneous software WebGL scenes on one runner. Local runs retain the existing two-worker, file-level behaviour.

Deployment requires both the live build and **every** browser shard to succeed. Browser failures do not cancel sibling shards, so their diagnostics remain available. The live build still downloads current official sources, verifies fallback data if the download fails, checks realtime compatibility, and enforces the final payload and publication gates.

Browser tests retain the committed demo data and Vite development server: selection, label and geometry assertions inspect the development React Three Fiber module. They cannot simply use the production preview server. A separate final smoke suite (`e2e/remote-data.spec.ts`) runs against the production preview in Chromium and iPhone WebKit, checking successful R2 timetable/chunk loading, no same-origin data fallback, and orbital decompression before publication. The initial check explicitly runs `npm run data:prepare && npm run build:fixtures` to catch compile and payload failures; the later live build uses the refreshed data and resolved realtime configuration.

## Measured baseline

[Run 34226664670](https://github.com/emmettl/gleislicht/actions/runs/34226664670), 8 September 2026:

| Work | Duration |
| --- | ---: |
| Browser regression step | 20m 51s |
| Download current timetable sources | 24s |
| Generate today's timetable | 5m 28s |
| Compile application | 3s |
| Entire build job | 28m 02s |

The browser tests passed, but the final JavaScript budget failed at 360.7 KiB against a 360 KiB ceiling. Checking the fixture build first exposes that kind of regression before spending minutes on browsers and timetable generation.

Mapping the recorded individual test durations onto the new shards gives approximately 7m and 7m 40s for Chromium, versus 5m 42s for WebKit. This suggests roughly **8–10 minutes** for the workflow's critical path rather than 28 minutes. This is an estimate, not a measured hosted result: runner setup, queueing, retries and subsequently added tests affect the actual duration. Aggregate runner minutes are not expected to fall by the same proportion.

## Run and inspect

Install engines once with `npx playwright install chromium webkit`. Reproduce the CI partitions locally, one command at a time:

```bash
CI=1 npm run test:e2e:ci -- --project=desktop-chromium --shard=1/2 --workers=1
CI=1 npm run test:e2e:ci -- --project=desktop-chromium --shard=2/2 --workers=1
CI=1 npm run test:e2e:ci -- --project=iphone-webkit --shard=1/1 --workers=1
```

Append `--list` to inspect a partition without starting browsers. All partitions together must equal the unsharded discovery list, with no duplicated project/test pairs. After the [E2E migration](E2E-TEST-MIGRATION.md), discovery contains 94 registrations: 25 and 24 Chromium cases, and 45 WebKit cases, including device-specific skips. The 106 replacement component/hook tests run with the existing `npm test` gate.

Each hosted job uploads an `e2e-report-<project>-<shard>` artifact. Its Actions summary includes wall time, total test time including retries, failures, flaky outcomes and the ten slowest tests. Use those measured durations to assess future changes to the split. The summary reporter has tests covering retries, timing order, failed assertions and setup failures.

Local validation used the working tree, including other pending feature work, and passed 199 unit tests, typechecking, lint, edition boundaries, both worker dry builds, the application build and publication budgets. The three browser partitions passed 99 cases with six existing device-specific skips, and exposed a WebKit station-selection timing failure. That test now waits for a settled camera and validates rounded coordinates using the correct touch picking rules. All 12 repeated station/train checks across both browsers then passed with retries disabled. A hosted run of the revised workflow remains necessary to measure the actual CI saving.

References: [Playwright test sharding](https://playwright.dev/docs/test-sharding) and [GitHub Actions job dependencies](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds).

## Node version and language payloads

Use the Node version selected by `.nvmrc` for local bundle checks. Node 24.20.0 reproduced the hosted JavaScript measurement of 361.0 KiB for commit `5404341`; Node 26's gzip output understated it by about 1 KiB. The 360 KiB JavaScript limit remains unchanged. German, French and Italian interface dictionaries now load individually when selected, with English available immediately and retained if a translation cannot load. Browser regressions cover lazy requests, all four languages and saved language restoration; mounted Vitests cover a delayed translation arriving after another selection and failed translation fallback.

On Node 24.20.0 the isolated fix measures 351.8 KiB of opening JavaScript. The language regression also exposed a phone menu beneath the search controls; the open language menu now raises the masthead above them.

## Let publication finish during parallel work

On 8 September, successive pushes repeatedly cancelled otherwise progressing
Pages runs, leaving the Lausanne integration unpublished despite passing build
and regional-data checks. The `pages` concurrency group now uses
`cancel-in-progress: false`: the active run completes and only the newest pending
push is retained. An intermediate validated revision may publish before that
newest revision; no validation or browser test is bypassed. This follows
[GitHub's workflow concurrency semantics](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## September 9 main regressions

[Run 34290968691](https://github.com/emmettl/gleislicht/actions/runs/34290968691) failed four unit tests. Schupfart’s evidence replay and Oberentfelden’s detour diagnostic now allow only sub-micrometre/sub-nanosecond floating-point differences in derived measurements; source coordinates, ordered edges, identities, admission decisions and geometry hashes remain exact. A mutation test rejects meaningful measurement drift and non-finite values. Solothurn’s display files and release proof were regenerated after the shared simplifier changed; unchanged chunk bytes, source calls, endpoints and the 5 m bound remain checked. The ZH 3 regression now explicitly lists all three reviewed recordings, including Horgen evening. Local test discovery excludes nested worktrees and their dependency tests.

Dependabot’s same-revision update failed because Miniflare pins `sharp` 0.35.2 exactly. A scoped npm override selects the patched 0.35.4 while retaining Wrangler’s existing version. Remove it when Miniflare adopts a patched version. The installed tree passes `npm audit`, native image encoding and both worker dry-run builds.

## R2 production smoke checks

```bash
npm run build
E2E_PREVIEW=1 npm run test:e2e:ci -- e2e/remote-data.spec.ts --workers=1
```

Use `E2E_PORT` when another preview already uses port 4180. Production builds omit local datasets and do not regenerate fixtures. `npm run typecheck` continues to check application and test code together.
