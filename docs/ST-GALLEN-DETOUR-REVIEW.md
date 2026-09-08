# St. Gallen bus detour review

The seven remaining bus stop pairs rejected for implausible detours were investigated against the pinned March 2026 AL_OEV geometry, September 2026 GTFS, and operator pages retrieved **8 September 2026**. They affect **128 Friday trips across seven patterns** and **59 Sunday trips across six patterns**. These are distinct affected complete trips, not a sum that counts a trip again for every failed pair. All remain excluded. Following the separate line-210 corridor and [line-164 rendering anchor](ST-GALLEN-STOP-ANCHOR-REVIEW.md), the regional feed admits **10,624 Friday / 7,325 Sunday movements**.

The [machine-readable review](../data/st-gallen-detour-review.json) records every pair's actual stop IDs and direction, distances, source records, affected-pattern hashes, source hashes and operator evidence URLs/retrieval times. The [canton study](ST-GALLEN-STUDY.md) provides the complete inventory, admission policy and attribution. This review covers the bus `implausible-detour` reason; endpoint gaps, disconnected lines, missing lines and other modes are separate exclusions.

## Replayed geometry

| Line | Ordered calls | Original source path | Diagnostic outcome | Friday / Sunday affected trips |
| --- | --- | --- | --- | --- |
| 352 | Widnau, Nöllenstrasse → Heerbrugg, Rosenbergsaustrasse | 1,609 m | Combined BOS regional bus linework still gives 1,584 m and fails | 23 / 21 |
| 353 | Heerbrugg, Rosenbergsaustrasse → Widnau, Nöllenstrasse | 1,609 m | Combined BOS regional bus linework still gives 1,584 m and fails | 14 / 10 |
| 400 | Sargans, Post → Sargans, Castels | 2,244 m | Combined linework gives a 485 m candidate borrowing another line's edge | 24 / 0 |
| 400 | Sargans, Castels → Sargans, Post | 2,304 m | Combined linework gives a 431 m candidate borrowing the same edge | 24 / 0 |
| 432 | Mels, Oberdorf → Mels, Fabrik | 1,844 m | Combined linework still fails | 14 / 14 |
| 432 | Mels, Fabrik → Mels, Oberdorf, two source-stop variants | 1,698 m / 1,846 m | Both variants still fail | 29 / 14 |

All three original source graphs are connected. Repeating snapping with **every edge as a separate candidate**, within the unchanged 5 m allowance, leaves all seven failures in place. The long paths therefore are not resolved by considering additional projections within the existing tolerance. The production 120 m snap limit and max(1,200 m, 4.5 × direct distance) detour ceiling remain unchanged.

The operator-union experiment joins only exact vertices across **BOS regional bus records**. This is a diagnostic comparison, not an approved route graph: a physically connected edge used by another line does not establish this line's route, direction or use on a construction date.

For line 400, the shorter candidate uses one **33.30 m** edge from `bus:86`, the AL_OEV record for lines 429/430. Its ends already occur in the connected line-400 record `bus:18`. Within the BOS regional bus layer, only the donor record supplies this edge. The review retains its part/vertex references and an edge hash, without copying coordinates. This differs from the admitted line-321 repair: it exceeds that repair's 15 m cap, changes an already connected graph and lacks its two additional corroborating source records. No line-400 shortcut was installed.

## Operator evidence and dates

RTB's [line 352 stop list](https://www.rtb.ch/reisen/info-haltestelle/detail-linie/352) places Nöllenstrasse before Rosenbergsaustrasse; its [line 353 list](https://www.rtb.ch/reisen/info-haltestelle/detail-linie/353) reverses this pair within the circular service. These lists corroborate stop order, but contain no street-level path that establishes the approximately 1.6 km source detour.

BUS Sarganserland Werdenberg's [line 432 stop list](https://www.bsw-bus.ch/reisen/info-haltestelle/detail-linie/432) includes Oberdorf and Fabrik consecutively in both directions. Its [operating notices](https://www.bsw-bus.ch/reisen/stoerungen/betriebsmeldungen), captured on 8 September, report construction from 10 August to 31 January 2027 and a replacement Oberdorf stop about 20 m towards Verrucano. The same snapshot reports line-400 construction closing the Wolfriet and Kantonsschule stops from 10 August to 18 December 2026, with Castels and Pizolcenter as alternatives. Both intervals overlap both fixture dates. The notices provide context for source/timetable differences, but neither specifies the complete diverted street alignment. They do not prove the cause of every failed pair.

The operator pages have **no asserted edition date**. Retrieval time, notice applicability and the geometry's March export date are recorded separately. Live pages can change or remove notices; the saved hashes refer to the local snapshots. The review is not a realtime disruption monitor and does not override the pinned GTFS call sequence.

Attribution: **RTB Rheintal Bus and BUS Sarganserland Werdenberg / BOS Gruppe** for stop-order and operating-notice evidence; **© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG** for AL_OEV; **SBB / opentransportdata.swiss** for the timetable. The source's underlying alignment attribution and reuse limits remain as documented in the canton study. Raw HTML and source geometry remain in the ignored local cache. No street-direction certification or redistribution permission is inferred.

## Reproduce and check

With the pinned timetable, geometry and original operator snapshots cached:

```sh
node scripts/review-st-gallen-detours.mjs --check
node scripts/check-st-gallen-region.mjs
node scripts/check-st-gallen-region.mjs --audit-only
```

The first command replays every diagnostic and compares the result with the tracked review. It verifies cached timetable, geometry, catalogue and operator snapshot hashes. The audit-only command needs no cache and checks the review hash, source bindings, exact day-audit bindings, all seven pair identities and affected-pattern totals.

To acquire current operator evidence and regenerate the review, use `node scripts/review-st-gallen-detours.mjs --fetch-evidence`, inspect its changes, then run `node scripts/document-st-gallen-study.mjs`. This refresh does not reproduce the original webpage bytes; changed stop lists or notice text require review. Neither diagnostic mode changes source graphs, production limits or regional feed payloads.
