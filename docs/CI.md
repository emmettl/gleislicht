# CI build time

The Pages workflow checks code and committed fixture budgets before starting the expensive work. Once those checks pass, four runners work independently:

- Chromium shard 1/2.
- Chromium shard 2/2.
- iPhone WebKit, the complete suite.
- Today's national timetable and the live Pages build.

Each browser runner installs only its own engine and uses one worker. `fullyParallel` is enabled in CI so Playwright splits individual tests across shards, including tests in the large `gleislicht.spec.ts` file. The worker limit still prevents simultaneous software WebGL scenes on one runner. Local runs retain the existing two-worker, file-level behaviour.

Deployment requires both the live build and **every** browser shard to succeed. Browser failures do not cancel sibling shards, so their diagnostics remain available. The live build still downloads current official sources, verifies fallback data if the download fails, checks realtime compatibility, and enforces the final payload and publication gates.

Browser tests retain the committed demo data and Vite development server: selection, label and geometry assertions inspect the development React Three Fiber module. They cannot simply use the production preview server. The fixture build in the initial check job catches compile and payload failures; the later live build uses the refreshed data and resolved realtime configuration.

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

Append `--list` to inspect a partition without starting browsers. All partitions together must equal the unsharded discovery list, with no duplicated project/test pairs. As of this change the working tree discovers 106 cases: 27 and 26 Chromium cases, and 53 WebKit cases, including their existing device-specific skips.

Each hosted job uploads an `e2e-report-<project>-<shard>` artifact. Its Actions summary includes wall time, total test time including retries, failures, flaky outcomes and the ten slowest tests. Use those measured durations to assess future changes to the split. The summary reporter has tests covering retries, timing order, failed assertions and setup failures.

Local validation used the working tree, including other pending feature work, and passed 199 unit tests, typechecking, lint, edition boundaries, both worker dry builds, the application build and publication budgets. The three browser partitions passed 99 cases with six existing device-specific skips, and exposed a WebKit station-selection timing failure. That test now waits for a settled camera and validates rounded coordinates using the correct touch picking rules. All 12 repeated station/train checks across both browsers then passed with retries disabled. A hosted run of the revised workflow remains necessary to measure the actual CI saving.

References: [Playwright test sharding](https://playwright.dev/docs/test-sharding) and [GitHub Actions job dependencies](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds).
