# St. Gallen: restoring line 164 with a reviewed stop anchor

Line 164 now contributes **58 Friday / 26 Sunday trips**, in both directions, using the existing St. Gallen AL_OEV line geometry. The regional feed contains **10,624 / 7,325 movements** across **1,002 / 773 complete directed patterns**. All previously admitted journeys, calls and paths are unchanged. The annual inventory remains **343 routes / 38 agencies**, with **195 route records** contributing to the two fixtures.

The change is one explicit **stop-level rendering anchor** at Dornbirn Treffpunkt a.d.Ach. It uses a published Vorarlberg platform coordinate to represent the Swiss stop. It does not assign direction-specific platforms, alter the original Swiss timetable file, import external route shapes or enlarge the 120 m geometry tolerance.

## Evidence and decision

The [Vorarlberg comparison](ST-GALLEN-VMOBIL-REVIEW.md) establishes that the pinned external and Swiss feeds have the same active line-164 trip counts, complete ordered stop names and every arrival/departure time on **4 and 6 September 2026**. It also finds a large coordinate discrepancy at Treffpunkt. The original-coordinate comparison remains available and continues to report that discrepancy.

| Role | Source stop ID | Longitude | Latitude |
| --- | --- | --- | --- |
| Original Swiss stop | `ch:1:sloid:1200511` | 9.72297836 | 47.40614449 |
| Selected external rendering anchor | `at:48:570:0:1` | 9.72965284 | 47.41016915 |
| Opposite external platform | `at:48:570:0:2` | 9.72976962 | 47.41015699 |

The selected anchor is **673.48 m** from the original Swiss coordinate. The opposite external platform is **8.90 m** from the selected anchor. Using either directional platform as a representative stop location places the stop in the same small area; the policy selects the first published coordinate exactly, rather than inventing a midpoint. The 8.90 m separation is retained in metadata so this stop-level approximation is explicit.

Only `92-164-C-j26-1` uses this Swiss stop in the two fixtures. With the anchor, every pair in its two complete directed stop patterns passes on the existing AL_OEV line-164 graph. The four formerly failed pairs are Schoren Bahnhof/ORF ↔ Treffpunkt ↔ Steggasse. The Messekreuzung discrepancy identified by the external shape review is not changed: the existing AL_OEV route already passes there. All source call IDs, stop names, times, pickup/drop-off rules and sequences are preserved.

This is a reviewed rendering decision supported by cross-source schedule agreement and published stop coordinates. It does not claim that the upstream Swiss record has been officially corrected, nor does it establish a formal cross-feed platform identity. The original coordinate and the adopted anchor are both exposed in the policy, audit and feed metadata.

## Admission controls and validation

The [policy](../data/st-gallen-policy.json) pins the Swiss timetable hash, external ZIP hash, exact external stop records, original Swiss ID/name/coordinate, permitted route and fixture dates. The [schedule evidence](../data/st-gallen-stop-anchor-evidence.json) retains the reviewed comparison against commit `2e0c599` and is itself hash-bound. Source preparation acquires the pinned external ZIP and licence without changing the AL_OEV catalogue.

The loader reads the original stop records directly from the pinned ZIP. It rejects changed timetable bytes, original or external coordinates, names, review evidence, dates or additional route usage. The configured correction cap is 700 m and the platform-spread cap is 15 m; neither is a generic stop-matching tolerance. They bound this individually identified anchor. Other stops continue to use their original Swiss coordinates.

The full checker reconstructs the effective stop table from source evidence and verifies **every emitted stop coordinate**, not just Treffpunkt. It replays the four anchored paths on the AL_OEV graph, checks their hashes and anchor tags, and verifies source calls and times. The audit-only checker validates policy/evidence bindings, anchor coordinates, pair tags and affected-trip totals without requiring the large source cache.

The [incremental regression](../data/st-gallen-stop-anchor-review.json) compares the feed against commit `2e0c599`:

| Fixture | Before | After | Added line-164 trips | Added complete patterns |
| --- | --- | --- | --- | --- |
| Friday 4 September | 10,566 | 10,624 | 58 | 2 |
| Sunday 6 September | 7,299 | 7,325 | 26 | 2 |

Every earlier admitted movement and matched geometry pair is unchanged. Cumulative regressions against the original canton feed and the pre-line-210 feed also pass. Dedicated tests reject unreviewed route/date scope, changed coordinates, duplicate anchors and enlarged caps; they verify that applying the anchor does not mutate the raw timetable or its calls.

## Dates, attribution and reuse

External source: the public Vorarlberg sample linked by [Mobilitätsdaten Österreich](https://mobilitaetsdaten.gv.at/daten/soll-fahrplandaten-gtfs), internal version **20260703**, valid **14 December 2025–12 December 2026**, retrieved **8 September 2026**. ZIP SHA-256: `c19094742f994a7c7b346d67a2021d35b71bce610a994e5825b0f8d1900438ed`. The Swiss timetable remains version **20260902**; AL_OEV remains the **24 March 2026** export. These dates and retrieval time have separate meanings.

Attribution: **Mobilitätsverbünde Österreich OG / Verkehrsverbund Vorarlberg** for the adopted coordinate and supporting timetable/shapes; **SBB / opentransportdata.swiss** for original calls/stops; **© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG**, with underlying **swissTNE Base / © swisstopo**, for linework. The external [custom licence and disclaimer](https://mobilitaetsdaten.gv.at/sites/default/files/metadataset/contract_examples/Lizenzvereinbarung_DBP_v1.1_0.pdf), including attribution, modification notices and validity conditions, are linked in the feed's anchor-source metadata. The modification is explicitly identified as a representative rendering anchor.

Raw external evidence and the generated regional feed remain local. St. Gallen redistribution restrictions remain unresolved. This change grants no publication permission and does not certify street direction, lanes or actual vehicle position.

## Reproduction

```sh
python3 scripts/prepare-st-gallen-sources.py --shared-evidence-only
node scripts/build-st-gallen-region.mjs
node scripts/check-st-gallen-region.mjs
npx vitest run scripts/st-gallen-stop-anchors.test.mjs
```

For the incremental regression, build a baseline using the policy at commit `2e0c599`, then run:

```sh
node scripts/check-st-gallen-topology-regression.mjs --anchor BASELINE_FEED_DIRECTORY BASELINE_AUDIT_JSON
```

Refresh the cumulative regressions and endpoint/detour/Vorarlberg reviews against the new day hashes before regenerating the study and running its audit-only checker. The remaining bus endpoint review now covers **105 pairs**, affecting **331 Friday / 100 Sunday trips**. Those exclusions remain in place.
