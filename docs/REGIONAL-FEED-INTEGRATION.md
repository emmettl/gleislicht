# Existing regional feeds integrated into selectable studies

Integration date: **9 September 2026**. Scope: use the existing usable feeds, following the [eleven-canton review](UNSTUDIED-CANTONS.md). This work does not create new canton feeds.

## Decisions

| Existing feed | Application decision | Why / composition |
| --- | --- | --- |
| Luzern | New **LU** study | City, lake and valley connections: admitted trains, buses, boats and mountain journeys. |
| Zug | New **ZG** study | Lake and regional connections: admitted trains, buses, boats and funicular journeys. |
| Thurgau | New **TG** study | Rail, local and regional buses, and admitted lake/Rhine services. |
| Fribourg | New **FR** study | City and regional connections, retaining admitted journeys across canton boundaries and detached territories. The retained OGD evidence explicitly clears attributed vector redistribution. |
| Aargau | Keep as research feed | The [current alignment review](AARGAU-STUDY.md) still holds 222 flagged directed bus pairs. Complete automatic geometric compatibility does not satisfy the feed’s application-release gate. |
| St Gallen | Keep local | The [source study](ST-GALLEN-STUDY.md) retains unresolved vector-redistribution restrictions. Individual OSM supplements do not clear the combined feed. |

Other usable regional feeds already have study entries: ZVV, Genève, Zürich, Lausanne, Basel, Bern, Solothurn, Nyon, Ticino, Valais, Graubünden and Riviera. Existing mountain studies retain their distinct compositions. They are not duplicated. Territet–Glion’s compact label becomes **TGL** to distinguish it from Thurgau’s **TG**.

## What opens

Each new study is listed in the study browser and desktop/mobile selectors, with English, German, French and Italian descriptions. It defaults to the full civil day, with twelve two-hour movement chunks and an optional 06:45–08:45 morning extract. Friday **2026-09-04** and Sunday **2026-09-06** are independently selectable. These are archived fixtures from feed **20260902**, including preceding-service spillover where retained by the original feed.

Search, category selection, timeline seeking, station selection and shared links use the existing study system. Shared links retain the study, date, time and selected station/train. Unsupported linked dates fall back to the Friday fixture with an explicit unavailable-date notice. Each study has its own camera framing; complete out-of-canton calls remain in the data. Short localized headings fit the mobile header, while the browser retains the full descriptive titles.

New feeds are fetched only when selected. Full-day loading fetches the manifest and movement chunks without also downloading the morning snapshot. Switching study or date keys the cached morning snapshot by both values. Source attribution and downloadable release/source metadata are linked in the study controls and footer. The interface explicitly describes partial canton coverage, archived schedules and inferred geometry; frequency services disclose representative movement rather than exact departures.

## Packaged data and preserved evidence

The original source archives remain intact. [The packaging script](../scripts/package-regional-studies.mjs) creates display releases under `public/data/<region>/<date>/study/`. Luzern, Zug and Thurgau use their public audited archives; Fribourg uses its existing local archive and copies its resolved OGD evidence alongside the public display release.

Only polyline detail is reduced, with the existing measured Bern simplifier and an independently measured maximum deviation of **5 metres in approximate LV95**. Original endpoints, path indices, stop coordinates and every timetable record remain unchanged. Movement chunks are byte-identical to the corresponding archive. Simplification does not repair geometry, resolve source-direction questions or admit excluded journeys.

| Study | Friday journeys | Sunday journeys | Friday / Sunday manifest, gzip KiB |
| --- | ---: | ---: | ---: |
| Luzern | 12,585 | 10,478 | 315 / 340 |
| Zug | 3,530 | 2,225 | 143 / 159 |
| Thurgau | 4,360 | 2,724 | 218 / 203 |
| Fribourg | 5,578 | 3,803 | 338 / 339 |

[The release report](../data/regional-study-release.json) records source hashes, preserved invariants, measured deviations, vertex counts and byte/gzip sizes and hashes for every delivered payload. The packager rejects mismatched dates/feed versions, conflicting repeated journeys, altered chunk hashes, missing geometry, incomplete day coverage and unsafe chunk paths. It enforces 650 KiB compressed manifests, 1,600 KiB morning extracts and 450 KiB chunks; actual manifest sizes are substantially below the cap. Full-day loading avoids the larger morning extracts.

## Rebuild and verification

Run source checks before packaging; the display transformation does not replace those checks:

```sh
node scripts/check-luzern-region.mjs
node scripts/check-zug-region.mjs
node scripts/check-thurgau-region.mjs
node scripts/check-fribourg-region.mjs
npm run data:regional:studies
node scripts/build-study-summaries.mjs
npm run typecheck
npm run build
npm run check:bundle
npx vitest run src/studies/additional-regions.test.ts scripts/package-regional-studies.test.mjs src/editions/edition.test.ts
npx vitest run src/test/regions.dom.test.tsx src/test/loading.dom.test.tsx
npx playwright test e2e/regional-layout.spec.ts --project=desktop-chromium --project=iphone-webkit
```

All four source validators passed for the delivered fixtures. Luzern’s optional source-call replay was not run because the large original timetable cache was not supplied; its retained geometry, chunk and coverage checks passed. The focused application/packaging tests pass. Combined component and browser coverage checks lazy discovery, Friday/Sunday switching, station search, afternoon chunk loading, restored shares, attribution, unavailable dates, failed-request retry and switching back to the morning extract.

Latest-main verification on 9 September 2026: **1,220 unit tests pass**, along with typecheck, lint, edition-boundary checks, both worker dry-run builds and the Pages artifact check. First-view transfer budgets on CI’s Node 24.20.0 runtime pass: **358.8 KiB JavaScript against 360 KiB**, **9.9 KiB CSS against 10 KiB**, **394.1 KiB opening data against 450 KiB**, and **762.9 KiB total against 790 KiB**. Aircraft and airport rendering is deferred until the air layer opens, keeping the additional studies within the existing budget. Airport-label tests verify no renderer request before enabling Air, then visible labels before flight data arrives.

The latest-main CI fixes preserve exact source paths and identities while allowing negligible platform rounding only for derived geometry diagnostics. Solothurn display fixtures were rebuilt using the current bounded simplifier, and the ZH 3 recording regression now includes the evening recording. A scoped Miniflare override pins **sharp 0.35.4** because its upstream dependency remains exactly pinned to vulnerable 0.35.2; remove the override when Miniflare adopts a patched release. The installed dependency audit reports zero vulnerabilities, and native image encoding plus both worker builds pass.
