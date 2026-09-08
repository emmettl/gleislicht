# Seegräben road binding — 8 September 2026

**Counter 2988 measures a municipal branch road, so it cannot be the ZH 340 endpoint of the proposed Uster–Seegräben recording.** Nearby counter 0392 also lies on a municipal branch. Their precise points are correct; moving either onto the nearest classified main road would misrepresent the measurements.

The [review](../data/seegraeben-road-review.json) resolves these two road associations using [pinned public evidence](../data/seegraeben-road-review-sources.json). It rejects three diagnostic counter pairs and identifies the next unresolved adjacency. It publishes no recording.

## Independent geometry evidence

The canton’s detailed `strassenachsen` WFS includes municipal and planned roads omitted from the classified main/secondary-road playback network. A complete bounding-box response around Seegräben contains seven detailed axes, including all competitors near both station points. A separate complete station WFS response contains the two counters. Both coordinates and the fresh collector identities and destination labels match the existing catalog/topology records.

| Counter | Collector road label | Detailed axis `strass_id` | Distance to that axis | Distance to ZH 340 |
| --- | --- | ---: | ---: | ---: |
| 2988 | Gstalderstrasse | 7862 | Under 0.01 m | 97.14 m |
| 0392 | Aretshaldenstrasse | 274 | 0.13 m | 39.11 m |

Both detailed axes have `eigentum: Gemeinde` and no numbered-road identifier. Axis 274 also has the explicit class `Gemeindestrassen`; axis 7862's class field is empty, so ownership and geometry provide the evidence there. Each branch meets the ZH 340 geometry at its own endpoint, away from the counter. These are separate road branches, not small coordinate errors in a main-road station.

The [municipality's Grossweid planning report](https://www.seegraeben.ch/_doc/4980850), dated 20 December 2023, §2.5.1 on page 11, describes Gstalderstrasse as connecting Sack to the main Zürcherstrasse. This corroborates the road context; the station association uses the exact station point, collector identity and detailed geometry rather than the planning document alone.

A planned-road feature is also only 90.29 m from 2988. All seven axes remain in the evidence and compete in the check. The review does not choose the expected municipal feature by ignoring another nearby road.

## Effect on the recording queue

The original direction audit conservatively includes nearby candidate paths for unmatched stations. Its pairs are research leads, not established same-road sections. Removing the disproved 2988 and 0392 associations in a copy of that topology retires **0188–2988, 2988–0392 and 0392–2788** as ZH 340 recording candidates. Their archived observation statistics remain in the review for traceability. In particular, 0188–2988's 245 complete minutes do not make it a same-road recording.

The next apparent adjacency becomes **0188–2788**, with a projected separation of **3,521.59 m**. It remains **not admitted**: Wetzikon 2788 (Usterstrasse) has an unresolved road association, 97 m from ZH 340. Uster 0188 still requires its Wetzikon homonym and opposing-lane extent review. No observation window is inferred for this new pair from the removed pairs, and no connecting section is approved merely because two false candidates were removed.

The subsequent [Wetzikon review](WETZIKON-ROAD-REVIEW.md) establishes that **2788** also measures a municipal branch. It rejects the apparent 0188–2788 follow-up pair and closes the eastward extension for the current catalog/path. Municipal-road playback, if pursued separately, would need its own network, direction and section evidence; these exclusions do not authorize that expansion.

## Implementation and validation

`reviewSeegraebenRoadBindings` verifies the pinned inputs, complete WFS responses, coordinate system, source identities, unchanged station points, municipal ownership, competing axes and branch junctions. It clears only the two reviewed candidate associations in a copy. It leaves coordinates, road paths and all other stations unchanged. The report then recomputes the diagnostic adjacency with the existing direction rules.

```sh
node scripts/audit-seegraeben-road.mjs --output=/tmp/seegraeben-road-review.json
cmp data/seegraeben-road-review.json /tmp/seegraeben-road-review.json
npx vitest run scripts/audit-seegraeben-road.test.mjs scripts/audit-hittnau-road.test.mjs scripts/oberland-road-candidates.test.mjs scripts/ingest-cantonal-road-topology.test.mjs scripts/validate-cantonal-road-directions.test.mjs
```

The [scope](../data/seegraeben-road-audit-scope.json) pins the original geometry, detector catalog, direction audit, observation coverage and fresh sources. The report reproduces exactly; all 33 targeted tests and lint pass. The six published recordings and original audit archives remain unchanged.
