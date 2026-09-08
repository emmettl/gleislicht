# Stallikon 3387: Schwandenstrasse — 9 September 2026

**The short Stallikon candidate still needs road-level and Zürich direction evidence at its endpoints, plus a review of the intervening ZH 642 roundabout.** The [audit](../data/stallikon-road-review.json) exposes these separate issues. It adds no recording or direction approval.

## Surface road and A3 geometry

The unchanged precise point is approximately 0.001 m from detailed ZH 650 feature **3632**. A3 axes **6572 / 10301** and **6570 / 10030** are **6.50 m** and **40.83 m** away in horizontal projection. ZH 642 feature **3631** also remains a competitor, 46.94 m away. The fresh [classified response](../data/stallikon-road-review-sources.json) reproduces the original station result and road paths exactly; the station stays **ambiguous-road** under the unchanged 15 m margin.

The surface-road axis and the A3 axes share interior XY vertices **9.98 m** and **62.39 m** from counter 3387. These horizontal crossings do not establish a junction or identify a detector's road level.

The [official aerial map](https://geo.zh.ch/maps?initialMapIds=OrthoAktuellZH&x=2678308.74&y=1244867.79&scale=1500&basemap=arelkbackgroundzh), inspected during the review, shows the surface roads and roundabout, with no surface motorway at these crossings. The [canton's Uetliberg tunnel description](https://www.zh.ch/de/news-uebersicht/medienmitteilungen/2003/02/durchschlag_uetliberg.html) describes the tunnel through Ettenberg and Uetliberg and its Reppischtal construction section. Together these support the tunnel-level interpretation as context. They do not provide a station-specific survey or approved detector-to-road-level binding. The pinned machine report therefore retains the original ambiguity.

## Conditional directions and the other endpoint

The 3387 check assumes ZH 650 only to identify remaining direction issues. It does not change the station match.

| Counter / destination | Result | Evidence |
| --- | --- | --- |
| 3387 / Zürich | Too little distance along the available path; off-axis and bearing also fail | Direct distance **5,554.62 m**, but projected separation only **570.80 m**, below 750 m. Reference is **5,521.98 m** off-axis; bearing is **−0.05**. |
| 3387 / Stallikon | Passes conditionally | Reference is 3,742.17 m away, 34.57 m off-axis, with −3,884.29 m projected separation and −0.94 bearing. |
| 3287 / Zürich | Off-axis; bearing also fails | Reference is **5,521.98 m** off-axis, with bearing **+0.07**. |
| 3287 / Stallikon | Already validated in the original audit | The existing negative stored-path direction is retained. |

The `destination-too-close` status at 3387 refers to **projected separation**, not Zürich's direct distance. This distinction matters: replacing only the geometry match would not fix it. Nor can the passing Stallikon direction authorize an override of Zürich's off-axis or bearing failures through the existing extent-only opposing-lane review.

## Roundabout between the counters

The detailed source contains a closed three-part **K-001 ring**, features **6268–6270**, and separate schematic centre connections **6271–6273**. ZH 650 approaches **3633** and **3632**, plus ZH 642 approach **3631**, each join the ring at an endpoint. Their projections lie between the counter positions, about **95–116 m** along the candidate from 3287.

The audit checks the ring closure and all three approach joins. It records the ring separately from its schematic centre representation. No turning flow, lane assignment or vehicle route through the circle is inferred. The ZH 642 branch means the two observations cannot be presented as measured uninterrupted through traffic.

## Observations and reproduction

The existing diagnostic pair **3287–3387** is **208.39 m** along the available path. It has **235 complete minutes**, including a longest complete run of **149 minutes, 14:14–16:42 CEST on 8 September 2026**. Counter 3387 alone has a 182-minute run; that station total is not the paired recording window.

```sh
node scripts/audit-stallikon-road.mjs --output=/tmp/stallikon-road-review.json
cmp data/stallikon-road-review.json /tmp/stallikon-road-review.json
npx vitest run scripts/audit-stallikon-road.test.mjs scripts/audit-lindau-2491-road.test.mjs scripts/audit-cantonal-unmatched-roads.test.mjs scripts/ingest-cantonal-road-topology.test.mjs scripts/validate-cantonal-road-directions.test.mjs scripts/review-cantonal-road-direction.test.mjs
```

The [scope](../data/stallikon-road-review-scope.json) pins the full source batch and fresh classified response. The targeted tests pass, lint is clean and the report reproduces byte-for-byte. Tests cover the retained competitors, conditional versus approved directions, both endpoint failures, paired window, intervening branch, broken ring, changed collector labels and incomplete road responses.

Resume with independent station-to-road-level evidence and Zürich direction references for both counters, then review the roundabout and section geometry. The original topology and six-recording catalog remain unchanged.
