# Allmendstrasse and Adliswil — 8 September 2026

**Adliswil counter 4087 now has a validated, scoped direction review. Allmendstrasse 0197 still needs city-road geometry and detector evidence, so no recording is added.** The [combined report](../data/allmend-road-review.json) keeps these two outcomes separate.

## Allmendstrasse is at a network boundary

The complete detailed-road source puts the unchanged 0197 station point on feature **5329**, a city-owned **4.1** axis. Its first endpoint is only **3.60 m** from the station point and is shared with both **7020**, another city-owned 4.1 feature, and **7017**, an A3W motorway-ramp feature (`16161`). The point is therefore close to a represented junction, not simply between independent parallel roads.

The fresh [classified-road response](../data/allmend-road-review-sources.json) contains 13 features in the local query, including ZH 4 and the nearby motorway/ramp axes, but no 4.1 axis. Rebuilding the station's classified match from this response reproduces its original result exactly: **excluded-road-class**, with A3W 3.60 m away and ZH 4 49.27 m away. The detailed city axis is present in one source and absent from the classified network used for playback.

This does not justify moving the station onto ZH 4 or ignoring the motorway competitor. A reviewed city-axis connection, the ownership/scope boundary and the junction relationship must be represented explicitly before considering a through section. The public labels describe four detectors: normal/passing lanes toward Zürich and passing/normal lanes toward Luzern. No detector-to-axis assignment is established here.

## Adliswil's direction issue is resolved locally

The saved [4087 review](../data/adliswil-road-direction-reviews.json) uses the existing `opposing-main-carriageway-lanes` method. It pins the original geometry, detector catalog and detector audit. Fresh public collector labels and the precise station point are also checked against the complete source inventory.

- **4087.02 toward Langnau am Albis** already validates negative stored-path order.
- **4087.01 toward Zürich** passes direct distance (6,287.92 m), off-axis distance (1,207.61 m), projected separation (+5,785.54 m) and bearing (+0.82). Its only failure is the large Zürich settlement extent crossing the station.
- The catalog has exactly two opposing main-carriageway normal-lane detectors. The scoped review therefore validates 4087.01 in the positive direction, preserving its original extent-conflict result and review provenance.

This is the existing source-based opposing-lane inference, not a surveyed movement or a change to the general geometry/direction gates. Applying the saved entry changes **only 4087's station audit**. All other station audits and every existing section reproduce unchanged. The review file can be reused by a later corridor builder; it does not by itself enable playback.

## Both adjacent recording options remain blocked

| Diagnostic pair | Projected length | Complete run | Remaining blocker |
| --- | ---: | ---: | --- |
| 4087–0197, Adliswil–Allmendstrasse | 3,175.91 m | 245 min | City-axis extension, junction review and all four 0197 detector mappings. |
| 1520–4087, Langnau–Adliswil | 4,219.72 m | 245 min | 1520 has an Adliswil extent conflict and a Langnau reference only 701.95 m away, with −442.21 m projected separation and −0.07 bearing agreement. It has no validated anchor for the extent review. |

Both windows are **13:23–17:27 CEST on 8 September 2026**. Neither paired observation coverage nor the successful review at 4087 substitutes for evidence at the other endpoint. The report includes the resulting endpoint audits for both options.

## Reproduce and resume

```sh
node scripts/audit-allmend-road.mjs --output=/tmp/allmend-road-review.json
cmp data/allmend-road-review.json /tmp/allmend-road-review.json
npx vitest run scripts/audit-allmend-road.test.mjs scripts/audit-cantonal-unmatched-roads.test.mjs scripts/review-cantonal-road-direction.test.mjs scripts/validate-cantonal-road-directions.test.mjs
```

The [scope](../data/allmend-road-review-scope.json) pins the complete-source batch scope, classified response and Adliswil review. Tests cover the missing city axis, unchanged classification, station-specific direction approval, unchanged neighbouring stations/sections, source drift, collector changes and changed review anchors. The report reproduces exactly, and all 22 targeted tests and lint pass. Original geometry/direction archives, the six-recording catalog and public playback artifacts remain unchanged.

Allmendstrasse resumes when the city-network and detector mapping evidence is available. The next independent city-network investigation is **Witikonerstrasse 1101**: its detailed city-owned axis is absent from the current match, but no paired recording window has yet been established there.
