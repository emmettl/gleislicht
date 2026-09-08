# Hittnau direction evidence — 8 September 2026

**The 2992–3091 recording remains excluded.** Fresh public records confirm counter 3091's identity and precise location, but the checked sources do not independently bind detector 3091.02 to a travel direction on ZH 337. The [reproducible audit](../data/hittnau-road-review.json) preserves that distinction.

## What was verified

The [pinned source responses](../data/hittnau-road-review-sources.json) contain both Hittnau collector records and the complete local station WFS response. The collector records retain the same two normal-lane destination labels, Pfäffikon and Saland, at both counters. The WFS identifies permanent station **3091**, at LV95 **2,705,704.39 / 1,248,957.73**, matching the precise point already used in the topology. Its annual aggregate fields and point geometry contain no detector azimuth. A public WMS feature-info request returns the same station statistics without a station-plan link.

The [canton's dataset description](https://geolion.zh.ch/geodatensatz/1243.html) defines this point as the centroid of the loop arrangement. Its fuller 223.1 model documents a `messst_dateiname` field for the station document. The checked public responses for the OGD subset 223.2 do not expose that field. A precise centroid confirms location; it does not locate the individual loops or orient the detector channels.

The [VDE handbook, version 4.1 of 12 February 2025](https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/mobilitaet/mobilitaetsplanung/verkehrsgrundlagen/verkehrsdaten/dokumente/741.03_handbuch_vde-anlagen.pdf), §1.8.1, specifies a georeferenced station plan with loop positions, sensor labels, direction labels, road markings and a north arrow. The plan example in annex B-1 (PDF page 55) is explicitly **station 0124, Girenbadstrasse, Turbenthal**, with Turbenthal/Elgg direction arrows. It is not evidence for station 3091. Section 4.2.5.1 and annex F-1 describe field-channel numbering starting toward Zürich; this general convention does not prove Hittnau's installed channel-to-feed mapping or its direction on our stored path. PDF pages 11, 55 and 66 were rendered and visually inspected. The downloaded PDF hash is retained in the source manifest.

The [publisher's traffic-data page](https://www.zh.ch/de/mobilitaet/gesamtverkehrsplanung/verkehrsgrundlagen/verkehrsdaten.html) links project and operational documents in a password-protected area. No station-specific 3091 plan was obtained in this review. A guessed annual-report URL returned 404; that does not establish that a report or plan is unavailable from the publisher.

## Why the existing review cannot admit it

The [Oberland audit](OBERLAND-ROAD-CANDIDATES.md) retains both Pfäffikon ZH and SZ. Under its explicitly unapproved Zürich-qualified diagnostic, 2992 passes both directions and 3091.01 passes toward Pfäffikon ZH. However, 3091.02's Saland reference is **1,401.93 m** away, below the unchanged **1,500 m** direct-distance gate. Its 0.97 bearing agreement and 1,374.96 m projected separation do not remove that failure.

The existing opposing-normal-lane method handles settlement-extent conflicts only. The Hittnau audit exercises that method and confirms rejection. A regression test also confirms that falsely relabelling the failure as an extent conflict still fails the independent distance check. AlertC signs, the neighbouring counter and matching observations cannot substitute for the missing directional reference.

There are **227 complete minutes** across the archive and a longest complete run of **104 minutes, 14:14–15:57 CEST**, over **2,479.21 m**. These remain recording-coverage facts, separate from publication approval.

## Evidence needed to resume

Obtain the 3091 station plan, or another independently verified directional reference tied to this station and ZH 337. Review its date and station identity, geographic orientation, direction arrows and mapping between sensor/channel labels and feed detector **ZH.CH:3091.02**. Then complete the explicit Pfäffikon homonym review at both endpoints, a pinned direction review, and the section/junction audit before compiling playback.

The subsequent [Seegräben geometry review](SEEGRAEBEN-ROAD-REVIEW.md) resolves 2988 and 0392 as municipal-branch counters and rejects their ZH 340 associations. The [Wetzikon follow-up](WETZIKON-ROAD-REVIEW.md) also excludes municipal counter 2788 and closes that eastward main-road proposal. Hittnau still awaits its station-specific direction evidence.

## Reproduce

```sh
node scripts/audit-oberland-road-candidates.mjs --output=/tmp/oberland-road-candidate-audit.json
cmp data/oberland-road-candidate-audit.json /tmp/oberland-road-candidate-audit.json
node scripts/audit-hittnau-road.mjs --output=/tmp/hittnau-road-review.json
cmp data/hittnau-road-review.json /tmp/hittnau-road-review.json
npx vitest run scripts/audit-hittnau-road.test.mjs scripts/oberland-road-candidates.test.mjs scripts/audit-lindau-road.test.mjs
```

The [scope](../data/hittnau-road-audit-scope.json) pins the geometry, detector catalog, Oberland report and fresh evidence. Changes to source identity, coordinate system, detector labels, point position or available metadata require review. The audit emits no topology or playback artifact.
