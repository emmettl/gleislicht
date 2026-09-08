# Lindau 2491: Lindauerstrasse — 9 September 2026

**The candidate lies beside a crossing beneath the A1, and resolving its road level would still leave both recording options without validated directions.** The [audit](../data/lindau-2491-road-review.json) retains the motorway competitors, checks both neighbouring counters and tests every exact Lindau settlement alternative. This is **2491 on ZH 766**, distinct from the previously reviewed **0908 on ZH 1**.

## Crossing geometry and road level

The unchanged precise point is 0.002 m from detailed ZH 766 feature **2634**. The two A1 carriageway axes, **623 / 10101** and **614 / 10010**, are **14.61 m** and **31.21 m** away. The unrounded distance difference to the closest competitor rounds to **14.60 m**, below the unchanged 15 m ambiguity margin.

The fresh [classified response](../data/lindau-2491-road-review-sources.json) contains ZH 766, both A1 carriageways and ZH 1. Rebuilding from those full features reproduces the original station match and road paths exactly. The station remains **ambiguous-road**.

ZH 766 and each motorway axis share an **interior horizontal vertex**, respectively **17.94 m** and **38.05 m** from the station. These coordinates describe geometric crossings. They do not establish a junction or permit connecting the road graphs. The audit records them separately and tests that endpoint-only traversal does not connect these three features.

The [official aerial map](https://geo.zh.ch/maps?initialMapIds=OrthoAktuellZH&x=2693580.94&y=1254069.26&scale=1000&basemap=arelkbackgroundzh), visually inspected for this review, shows the local road passing beneath the motorway. The displayed layer is the [summer 2024/25 orthophoto](https://geo.zh.ch/data/datasets/867dd710-766c-4c7b-80b8-ea8318007c35). This supplies road-level context; it is not a station-specific detector survey or a saved machine-validated binding. No automatic geometry override is applied.

An indexed ASTRA inventory example names the Lindauerstrasse underpass, but its [PDF](https://www.astra.admin.ch/dam/astra/de/dokumente/standards_fuer_nationalstrassen/astra_1b001_inventarobjekte2010v140.pdf.download.pdf/astra_1b001d.pdf) and the current indexed filename returned HTTP 502 during this review. The relevant map could not be inspected. That document remains an **unverified follow-up lead**, not evidence used to approve the crossing or station.

## Direction checks and all Lindau alternatives

Assuming ZH 766 only for a diagnostic projection, detector **2491.01 toward Lindau** remains ambiguous. **2491.02 toward Effretikon** is only **1,000.69 m** from its destination reference, below the 1,500 m direct-distance gate. Its good local bearing (−0.90) does not override that failure.

The fresh exact SwissNames query returns the same four settlement alternatives as the original archive. Every alternative is tested separately at both 2491 and neighbour 1320, without selecting a name or changing the automatic ambiguity.

| Lindau settlement feature | At 2491 | At 1320 |
| --- | --- | --- |
| **272265**, local Lindau | Too close: **1,199.45 m** | Too close: **928.34 m**; bearing is also only +0.54 |
| **416642** | Off-axis: 47,926.45 m | Off-axis: 47,926.45 m |
| **88405** | Off-axis: 43,982.49 m | Off-axis: 43,982.49 m |
| **143694** | Off-axis: 28,343.61 m | Off-axis: 28,343.61 m |

Thus even a separately justified selection of the local Lindau would not validate either detector. All four alternatives remain in the report; no nearest-name heuristic or qualified-name alias is introduced.

## Recording candidates

Both existing diagnostic pairs have a **104-minute complete run, 14:14–15:57 CEST on 8 September 2026**.

| Pair | Projected length | Other endpoint's remaining evidence |
| --- | ---: | --- |
| 2491–1320, Lindauerstrasse | 405.50 m | Effretikon is only **1,387.45 m** away; Lindau remains ambiguous, and its local alternative is also too close. |
| 1292–2491, Illnau-Effretikon–Lindau | 3,219.79 m | Illnau is only **929.04 m** away. The Effretikon direction has an extent conflict, but no independently validated opposing anchor exists for the existing review method. |

The report preserves total complete minutes separately from the uninterrupted runs. Neither a short section nor good observation coverage replaces direction evidence at either endpoint.

## Reproduction and remaining work

```sh
node scripts/audit-lindau-2491-road.mjs --output=/tmp/lindau-2491-road-review.json
cmp data/lindau-2491-road-review.json /tmp/lindau-2491-road-review.json
npx vitest run scripts/audit-lindau-2491-road.test.mjs scripts/audit-witikon-road.test.mjs scripts/audit-cantonal-unmatched-roads.test.mjs scripts/ingest-cantonal-road-topology.test.mjs scripts/validate-cantonal-road-directions.test.mjs
```

The [scope](../data/lindau-2491-road-review-scope.json) pins the full batch scope, classified response and exact-name response. All 34 targeted tests pass, lint is clean, and the report reproduces byte-for-byte. Checks cover road-source completeness, unchanged station matching, interior crossings versus endpoint connections, all settlement alternatives, unchanged inputs, partner labels and observation windows.

Resume with a reviewed station-to-road-level binding and independent direction evidence for both selected endpoints, followed by section and junction checks. No topology, approved direction mapping or recording is added by this audit.
