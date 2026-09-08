# St. Gallen: restoring PostAuto line 210

Line 210 now contributes **66 Friday and 35 Sunday trips**, preserving every source call and both travel directions. The regional feed admits **10,624 Friday / 7,325 Sunday movements**, across **1,002 / 773 complete directed patterns**. The annual canton inventory remains 343 route records and 38 agencies; 195 route records now contribute to at least one fixture.

## Evidence and scope

The pinned AL_OEV record `bus:95` identifies line 210 from St. Gallen through Mörschwil and Tübach to Arbon, but its geometry leaves the common St. Gallen–Tübach section largely uncovered. Stop-to-line gaps in that section reach approximately 4.1 km. The adjacent PostAuto record `bus:96`, for line 211, contains geometry that passes the existing numerical checks for the missing pairs.

PostAuto's [St. Gallen Ost network map](https://www1.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/ostschweiz/liniennetzplan-st-gallen-ost.pdf?vs=7) was downloaded and visually inspected on **8 September 2026**. Page 1 shows lines 210 and 211 together from St. Gallen through Mörschwil to Tübach Schulstrasse, with different branches towards Steinach and Horn beyond that section. The map states validity from **14 December 2025**; PDF metadata records modification on **20 January 2026**. Neither date changes the AL_OEV geometry export date of **24 March 2026**.

The map corroborates the shared corridor; it is not digitised into a new road alignment. The fallback uses only geometry from the exact, name-checked official line-211 record. All raw vectors and the supporting PDF remain in the ignored local cache. The [policy](../data/st-gallen-policy.json) pins the map URL, bytes, hash, retrieval time, source identities and approved pairs.

## Admission controls

- Apply only to PostAuto agency `801`, line `210`, route `96-250-8-j26-1`, after the primary graph returns `endpoint-gap`.
- Require an exact approved route/from-stop/to-stop key and matching names. The 64 approved platform pairs cover 32 ordered name pairs along the 17-stop shared sequence. The reverse direction has its own approval.
- Route on the line-211 graph with the original **120 m** snap limit, **5 m** alternative-projection allowance and **max(1,200 m, 4.5 × direct distance)** detour ceiling.
- Require the resulting geometry hash to match the individual reviewed pair. New platforms, coordinates, names, source records or paths require review.
- Preserve every passing primary path. The Horn branch, arbitrary same-operator edges and unrelated routes receive no fallback.

The Friday fixture uses 48 approved pairs across six newly admitted complete patterns. Sunday uses 64 across seven patterns, including preceding-service-day platform variants. The original GTFS times, pickup/drop-off rules and all external calls are preserved. AL_OEV remains undirected source linework: this is an inferred shared alignment, without certification of street direction, lanes or temporary diversions.

## Regression and remaining work

The [incremental regression](../data/st-gallen-shared-corridor-review.json), against commit `7926448`, verifies that all **10,500 / 7,264 previously admitted journeys** retain identical calls, timing and paths. Every previously matched pair is unchanged. The line-210 step adds 66 / 35 trips; the refreshed cumulative comparison additionally includes 58 / 26 line-164 trips from the separately reviewed stop anchor. The earlier line-321 repair is preserved. The [cumulative regression](../data/st-gallen-topology-review.json) also compares against the original canton feed in commit `2351822`.

At the line-210 step, endpoint-gap exclusions across all modes fell from **945 to 879 Friday trips** and **573 to 538 Sunday trips**; buses then accounted for **389 / 126** affected trips. Other failure reasons can overlap these counts. The largest remaining bus cases include line 323 at Dornbirn Messeplatz, Wil line 705 at Psychiatrie, Gossau line 150 at Sommerau and line 631 at Rüti Bandwies. These require their own source evidence. The separately reviewed 352/353, 400 and 432 detours remain excluded.

Attribution: **PostAuto AG / OSTWIND** for the supporting map; **© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG**, with underlying **swissTNE Base / © swisstopo**, for geometry; **SBB / opentransportdata.swiss** for GTFS. The [canton study](ST-GALLEN-STUDY.md) documents reuse restrictions. This extension does not grant redistribution rights or publish the local regional feed.

## Reproduction

```sh
python3 scripts/prepare-st-gallen-sources.py --shared-evidence-only
node scripts/build-st-gallen-region.mjs
node scripts/check-st-gallen-region.mjs
npx vitest run scripts/st-gallen-region.test.mjs scripts/st-gallen-shared-corridors.test.mjs
```

The evidence command reuses matching cached bytes or downloads the pinned map and verifies its hash. A changed publisher file fails validation. Add `--inspect-cache` to disable acquisition. Source acquisition for the full canton also includes this check.

To regenerate regression reports, first rebuild the respective baseline feed and audit using the policy from the stated commit and the exported `buildStGallenRegion` function. Run `node scripts/check-st-gallen-topology-regression.mjs --shared BASELINE_FEED_DIRECTORY BASELINE_AUDIT_JSON` for commit `7926448`; omit `--shared` for commit `2351822`. Then refresh the unchanged detour diagnostics with their cached operator evidence, regenerate the study and run the audit-only checker as documented in the canton study.

The subsequent [line-164 stop anchor](ST-GALLEN-STOP-ANCHOR-REVIEW.md) adds 58 Friday / 26 Sunday trips. Current bus endpoint failures affect 331 / 100 trips. The refreshed shared-corridor regression is cumulative from commit 7926448 and now permits both the reviewed line-210 and line-164 additions; the separate anchor regression isolates the latter against commit 2e0c599.
