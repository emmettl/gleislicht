# St. Gallen: line 24 to Vaduz Post

The regional feed now admits all **28 Friday trips** on line 24, in **two complete directed stop patterns**. The Sunday fixture contains no line-24 service and gains no trips. Total admitted coverage is **10,652 Friday / 7,325 Sunday movements**, **1,004 / 773 patterns**, with **196 of 343 annual route records** contributing to at least one fixture. All 38 agencies remain in the inventory.

## Evidence and source dates

The pinned AL_OEV records `bus:3` and `bus:137` identify `24 Buchs SG - Sevelen (-Vaduz)` under BOS. Their geometry ends near Lettstrasse, leaving the two ordered Lettstrasse–Post pairs outside the 120 m limit: approximately 310 m towards Post and 249 m in reverse.

LIEmobil's [2024 annual report, page 15](https://liemobil.li/static/Geschftsbericht---LIEmobil---2024---Web-bfa49b23b23343ad8318e2932e3ba27d.pdf) confirms that line 24 is jointly operated with Bus Ostschweiz and was extended to Vaduz Post at the December 2024 timetable change. The [July 2026 network map](https://liemobil.li/static/Liniennetz---Hoch---2026-07-9a6aa7e01e96eefc0f43acdc71a4c703.pdf), visually reviewed on 8 September, shows line 24 via Rheinparkstadion and Lettstrasse to Post, using the central Vaduz corridor shared with line 11. The map is schematic evidence of route identity; its coordinates are not used.

| Evidence | PDF modification date | Retrieved UTC | SHA-256 |
| --- | --- | --- | --- |
| LIEmobil Liniennetz, July 2026 | 2026-07-13 | 2026-09-08T19:47:24.083830+00:00 | d79959e62a2174a99cff39f86bb3e20afd31606f08a094d3c35dc9e1c7e51c86 |
| LIEmobil Geschäftsbericht 2024 | 2025-04-15 | 2026-09-08T19:51:50.413355+00:00 | 5f78150f39b7a1c678e3f458123bcfcea2b917813ee7336f25dc5ba931c7618a |

The network-map edition comes from the publisher filename; no precise validity-start date is inferred from it. The annual report covers 2024 and its PDF was produced in April 2025. These dates do not change the **24 March 2026 AL_OEV export** or **2 September 2026 Swiss GTFS** edition. The policy pins both evidence files, source identities and output geometry hashes. Originals remain in the ignored local cache.

## Exact admission boundary

The two missing pairs use the existing AL_OEV line-11 record `bus:33`, with the unchanged 120 m snap limit and existing detour checks. Lettstrasse→Post platform `ch:1:sloid:9985:0:02` produces a **334.65 m** path; Post platform `ch:1:sloid:9985:0:01`→Lettstrasse produces **260.33 m**. Maximum stop connector distance is **38.47 m**. The line-12E record independently contains identical candidate paths, but only line 11 is selected as donor.

The joint-operation exception requires the exact existing target-feature override to agency `805` and line `24`, the BOS target operator, LIEmobil donor operator, pinned joint-operation evidence, route `92-24-C-j26-1`, and the two reviewed fixture dates. Each direction has its own exact route/platform-pair approval and geometry hash. A different route, platform, source identity, date or path fails validation or receives no fallback. Passing primary paths remain untouched. This does not change the general BOS operator mapping.

All source stops, IDs, times, sequences, pickup/drop-off rules and international endpoints are retained. AL_OEV remains undirected linework; this is an inferred alignment with bounded stop connectors, not lane-level or direction-certified road geometry.

## Validation and remaining exclusions

The [incremental regression](../data/st-gallen-vaduz-review.json) compares against commit `baaf1da`. Every one of the **10,624 Friday / 7,325 Sunday previously admitted journeys** retains identical calls, timing and paths. Every previously matched directed pair is unchanged. Only the 28 line-24 Friday trips are added. The older topology, line-210 and stop-anchor regressions now include this subsequent addition in their cumulative comparisons.

All **17 focused tests**, the full source replay and the tracked audit checks pass. The source replay verifies every admitted and excluded directed pattern against the original Swiss timetable, evidence hashes and emitted artifacts. The remaining bus endpoint review covers **103 distinct pairs**, affecting **303 Friday / 100 Sunday trips**, across **17 route records**. Existing detour exclusions remain in place. The [Gommiswald follow-up](ST-GALLEN-GOMMISWALD-REVIEW.md) retains line-628 failures because the operator map does not corroborate its missing Dorf branch.

Attribution: **Verkehrsbetrieb LIECHTENSTEINmobil** for the supporting map and report; **© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG**, underlying **swissTNE Base / © swisstopo**, for alignment geometry; **SBB / opentransportdata.swiss** for timetable data. Regional payloads and original vectors remain local under the restrictions documented in the [canton study](ST-GALLEN-STUDY.md).

## Reproduction

```sh
python3 scripts/prepare-st-gallen-sources.py --shared-evidence-only
node scripts/build-st-gallen-region.mjs
node scripts/check-st-gallen-region.mjs
npx vitest run scripts/st-gallen*.test.mjs
node scripts/check-st-gallen-topology-regression.mjs --vaduz BASELINE_FEED_DIRECTORY BASELINE_AUDIT_JSON
```

The last command uses the feed and audit from `baaf1da`; build that baseline with its policy using the exported `buildStGallenRegion` function. Also refresh the older regression reports, endpoint/detour/Vorarlberg reviews, generated study and audit-only check as described in the canton study.
