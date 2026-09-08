# St. Gallen: endpoint evidence follow-up

The follow-up now covers **14 directed endpoint pairs**, affecting **120 Friday / 45 Sunday complete trips**, all retained as exclusions. The original operator-map review below covers ten pairs on lines 451, 420 and 729 (18 / 12 trips). The subsequent [service-change review](ST-GALLEN-SERVICE-CHANGE-REVIEW.md) adds four pairs on lines 150 and 631 (102 / 33 trips), with all-operator geometry searches and explicit construction-period checks.

The regional feed remains **10,652 Friday / 7,325 Sunday movements**, across **1,004 / 773 admitted complete directed patterns**. The remaining bus endpoint inventory stays at **103 pairs across 17 route records**, affecting **303 / 100 trips**. These totals are distinct complete trips, not sums of pair occurrences.

## Fixture results

| Route | Source candidate | Directed pairs | Friday affected trips / patterns | Sunday affected trips / patterns | Decision |
| --- | --- | --- | --- | --- | --- |
| 451, `96-249-1-j26-1` | `bus:89`, line 456 | 4 | 7 / 4 | 7 / 4 | Map does not corroborate line 451's Tamina Therme branch |
| 420, `92-420-j26-1` | `bus:18`, line 400 | 2 | 7 / 2 | 0 / 0 | Map omits the Seidenbaum extension |
| 729, `92-729-j26-1` | `bus:7`, N72 | 4 | 4 / 1 | 5 / 1 | Candidate loops away from the mapped direct branch |

The original national GTFS supplies the ordered calls and calendar fixtures. Map omissions do not establish that a scheduled trip is invalid. The exclusions concern insufficient or contradictory geometry evidence; every source call and all already admitted patterns are preserved.

## Bad Ragaz: line 451

The map shows Tamina Therme on the line-456 spur. It does not depict line 451 using that spur. Four failed pairs involve Dorfbad→Tamina Therme→Bahnhofstrasse and Bahnhofstrasse→Tamina Therme→Post. Line 456 supplies numerically passing candidates, but the map does not corroborate the missing line-451 branch. A route-specific alignment or applicable diversion map remains necessary.

## Trübbach: line 420

The operator's Buchs/Sargans map depicts line 420 at Dorf but omits Seidenbaum. The two failed directed Seidenbaum↔Dorf pairs have an original snap gap of approximately 820.7 m. Line 400 supplies passing candidate geometry, but this map does not establish the extension's street alignment. Seven Friday trips remain excluded; the reviewed failure has no Sunday occurrences.

## Uzwil: line 729

The Uzwil map depicts a seasonal/non-daily line-729 branch from Bahnhof toward Marienfried, Wespiwiese, Luxenburg and Henau Kirchplatz, separately from the Gemeindehaus–Coop–Sonnmatt loop. The source timetable preserves one affected directed pattern on both dates.

The N72 graph yields a **2,218.66 m source path** for Bahnhof→Marienfried, within the current numerical limits, but follows the loop. Replaying that exact candidate finds existing path vertices within **8.92 m of Gemeindehaus**, **1.93 m of Coop** and **2.01 m of Sonnmatt**. These are conservative vertex distances, not minimum perpendicular distances to the line. The named stops are geographic checkpoints on the candidate, not calls inserted into line 729.

This geometric mismatch prevents admitting the complete pattern even though its other three failed pairs also have passing N72 candidates. A corrected line-729 alignment for the direct branch remains necessary. Neither the snap tolerance nor the source stop sequence is changed.

## Source dates and attribution

All three PDFs were visually reviewed on **9 September 2026, Europe/Zurich**. Their printed validity starts on 14 December 2025. Retrieval times below are UTC and may fall on the preceding calendar date. PDF modification metadata is kept separate from timetable validity and the pinned **24 March 2026 AL_OEV export**.

| Evidence | Printed validity from | PDF modified | Retrieved UTC | SHA-256 |
| --- | --- | --- | --- | --- |
| [Bad Ragaz/Taminatal](https://www1.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/ostschweiz/liniennetzplan-bad-ragaz-taminatal.pdf?vs=10) | 2025-12-14 | 2026-01-20 | 2026-09-08T22:04:06.754018+00:00 | 60f55cf3689d2fccea7094103c7f407f9743c3848550daaa103bdc8d4ea11e66 |
| [Buchs/Sargans](https://www.bsw-bus.ch/fileadmin/bsw/reisen/liniennetzplaene/Liniennetzplan_Buchs_Sargans.pdf) | 2025-12-14 | 2025-11-14 | 2026-09-08T22:05:10.383561+00:00 | 40cd88047ca0186cd35c6daa72579a510b2a885a662d5d32f58c6ec3466a02a6 |
| [Ortsbus Uzwil](https://www.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/ostschweiz/liniennetz-ortsbus-uzwil.pdf) | 2025-12-14 | 2026-01-12 | 2026-09-08T22:05:42.737736+00:00 | 43cd8aca304f4c903bb696b8a3de3d4a7c032b167a8195290439f3f1677705c0 |

The subsequent [service-change review](ST-GALLEN-SERVICE-CHANGE-REVIEW.md) documents the additional Gossau announcement and Rüti notices with their own source dates and attribution.

The [review policy](../data/st-gallen-endpoint-followup-policy.json) also records byte counts, publishers, exact candidate hashes and checkpoint IDs. Source PDFs remain in the ignored local cache. The [machine-readable follow-up](../data/st-gallen-endpoint-followup.json) binds the policy, original timetable/source hashes, endpoint inventory and local feed artifact hashes.

Attribution: **PostAuto AG / OSTWIND** for Bad Ragaz and Uzwil maps; **BUS Sarganserland Werdenberg / BOS Gruppe / OSTWIND** for Buchs/Sargans; **© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG**, underlying **swissTNE Base / © swisstopo**, for candidate geometry; **SBB / opentransportdata.swiss** for timetable and stop coordinates. This audit does not redistribute source paths or grant feed publication rights. The [canton study](ST-GALLEN-STUDY.md) retains the source restrictions and direction-certification limits.

## Reproduction

```sh
node scripts/review-st-gallen-endpoint-followup.mjs --fetch-evidence --check
node scripts/check-st-gallen-region.mjs --audit-only
```

The first command acquires only missing evidence files and rejects changed bytes. It replays the original ten candidate paths and all 179 regional/city records for the four added failures, checks the three Uzwil checkpoints against the original Swiss stops, and verifies both manifests, morning windows and every feed chunk against their existing hashes. The audit-only checker validates the tracked review, source bindings, all reviewed pair identities, candidate hashes and weekday/Sunday affected-pattern totals without requiring the large source cache.

No feed rebuild or admission-policy change is made by this follow-up.
