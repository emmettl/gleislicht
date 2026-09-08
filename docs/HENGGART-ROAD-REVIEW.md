# Henggart: Weinlandstrasse — review completed 9 September 2026

**Resolving counter 1997's road ambiguity would still leave both detector directions unresolved.** The [focused report](../data/henggart-road-review.json) adds a conditional direction check and checks the other endpoint of each archived recording candidate. Neither candidate is admitted.

## Two nearby roads

The unchanged precise station point lies 0.003 m from detailed ZH 15 feature **3117**. National-road feature **6531**, numbered **10040** in the detailed source, is **14.54 m** away. The fresh [classified-road response](../data/henggart-road-review-sources.json) contains both **ZH 15 and A4**, and reproduces the original classified station result and paths exactly. The A4 remains an excluded-class competitor, so the result stays **ambiguous-road** under the existing **15 m** margin.

The two detailed axes have almost exactly opposite local vertex order (rounded tangent agreement −1), consistent with roads running alongside each other. The [official orthophoto at this location](https://geo.zh.ch/maps?initialMapIds=OrthoAktuellZH&x=2694157.76&y=1268105.55&scale=1000&basemap=arelkbackgroundzh), inspected during this review, shows separate road surfaces beside one another. Its [source metadata](https://geo.zh.ch/data/datasets/867dd710-766c-4c7b-80b8-ea8318007c35) identifies the summer 2024/25 imagery. This is visual context, not a saved detector survey or a current traffic configuration; the reproducible report uses the pinned vector sources.

Neither the aerial view nor opposite vertex order assigns detector channels to a road or travel direction. The public collector supplies two normal-lane labels toward Winterthur and Schaffhausen, without detector-specific surveyed coordinates. A station-specific road-binding review is still required; the small shortfall in the ambiguity margin is not waived.

## Directions assuming ZH 15

The audit projects both existing destination references against the original candidate ZH 15 path **without changing the station's match or constructing an approved topology**. This reveals additional failures that the original geometry exclusion had prevented the direction validator from reaching.

| Detector | Destination | Conditional result | Evidence |
| --- | --- | --- | --- |
| 1997.01 | Winterthur | Bearing conflict | Agreement **−0.56**, below the required absolute **0.75**. The reference is 7,152.31 m away and 493.76 m from the path. |
| 1997.02 | Schaffhausen | Destination off-axis; bearing also fails | Reference is **1,652.20 m** from the path, above the **1,500 m** gate. Bearing is **+0.70**, also below 0.75. |

Both are conditional diagnostics. Neither detector is an independently validated anchor, and these failures are not settlement-extent conflicts that the existing opposing-lane review can resolve. Extending the path toward Schaffhausen alone would not fix Henggart's local bearing disagreement.

## Neighbouring recording candidates

| Candidate | Projected length | Complete observations | Independent remaining issues |
| --- | ---: | --- | --- |
| 4789 Neftenbach–1997 Henggart | 1,677.85 m | 225 complete minutes; longest run **104 min, 14:14–15:57 CEST** | At 4789, Neftenbach is 2,082.18 m off-axis and Schaffhausen is 1,652.20 m off-axis. Both directions remain unresolved. |
| 1997 Henggart–1900 Adlikon | 2,606.72 m | **0 complete minutes** | 1900 is disabled in the saved collector inventory. Both detectors are missing throughout 245 audited minutes; its Schaffhausen direction also remains off-axis. |

All observation figures refer to **8 September 2026**. They describe the existing diagnostic pairs, not approved same-road playback. A complete southern window cannot compensate for either endpoint's unresolved evidence. The report preserves collector status, all other-endpoint direction results and missing-observation reasons.

## Reproduce and resume

```sh
node scripts/audit-henggart-road.mjs --output=/tmp/henggart-road-review.json
cmp data/henggart-road-review.json /tmp/henggart-road-review.json
npx vitest run scripts/audit-henggart-road.test.mjs scripts/audit-cantonal-unmatched-roads.test.mjs scripts/ingest-cantonal-road-topology.test.mjs scripts/validate-cantonal-road-directions.test.mjs
```

The [scope](../data/henggart-road-review-scope.json) pins the complete-source batch scope and fresh classified response. All 28 targeted tests pass, lint is clean, and the report reproduces byte-for-byte. Tests cover the retained motorway competitor, hidden direction failures, unchanged inputs, observation windows, disabled neighbour, changed collector labels, incomplete sources and shifted paths.

Resume Henggart when independent station-to-road and detector-direction evidence is available. The southern candidate also needs both Neftenbach directions resolved before a section/junction review; the northern candidate needs usable paired observations as well. The six published recordings and original topology remain unchanged.
