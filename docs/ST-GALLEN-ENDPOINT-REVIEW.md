# St. Gallen bus endpoint review

All **103 distinct directed bus endpoint-gap pairs** across the pinned Friday **4 September** and Sunday **6 September 2026** fixtures have been replayed. Friday has 94 failed pairs affecting **303 complete trips across 36 patterns**; Sunday has 70 affecting **100 trips across 24 patterns**. These are distinct trips per day, not sums of failed-pair occurrences. The review covers **17 GTFS route records**. All remain excluded, and the local regional feed remains **10,652 Friday / 7,325 Sunday movements**.

The [machine-readable report](../data/st-gallen-endpoint-review.json) records every directed route/platform pair, source feature, original snap distance, same-agency candidate path hash, evidence retrieval time and affected-pattern binding. The [canton study](ST-GALLEN-STUDY.md) remains the complete annual inventory; this review covers only bus endpoint failures.

## Replayed coverage

The production graph is replayed with original-precision Swiss GTFS platform coordinates, all existing reviewed repairs/corridors and the unchanged **120 m** snap limit. Each other individual AL_OEV regional or city bus feature mapped to the same GTFS agency is then tested independently with the existing detour limits. This examines every eligible record, including city features; it does not merge different routes into an admission graph.

**39 of 103 pairs** have at least one passing candidate on another source record. The other **64** have none in this search. A passing candidate establishes geometric proximity and connectivity only. It does not establish that the affected route uses the donor's alignment, especially on a construction date. No remaining candidate is admitted by this diagnostic review.

| GTFS route record | Line | Directed failed pairs | Pairs with a candidate | Maximum original snap (m) | Friday / Sunday affected trips |
| --- | --- | --- | --- | --- | --- |
| 92-705-D-j26-1 | 705 | 4 | 4 | 121.2 | 58 / 24 |
| 92-631-j26-1 | 631 | 2 | 0 | 182.6 | 46 / 33 |
| 92-323-j26-1 | 323 | 4 | 0 | 160.6 | 65 / 0 |
| 92-150-A-j26-1 | 150 | 2 | 0 | 512.7 | 56 / 0 |
| 96-224-1-j26-1 | 120 | 6 | 0 | 616.2 | 20 / 10 |
| 92-253-C-j26-1 | 253 | 4 | 0 | 775.5 | 19 / 0 |
| 92-331-B-j26-1 | 331 | 40 | 16 | 4537.8 | 6 / 10 |
| 96-249-1-j26-1 | 451 | 4 | 4 | 285.1 | 7 / 7 |
| 96-240-8-j26-1 | 628 | 3 | 3 | 211.2 | 12 / 0 |
| 92-729-j26-1 | 729 | 4 | 4 | 878.2 | 4 / 5 |
| 92-420-j26-1 | 420 | 2 | 2 | 820.7 | 7 / 0 |
| 92-623-j26-1 | 623 | 2 | 2 | 128.3 | 1 / 2 |
| 92-623-A-j26-1 | 623 | 2 | 2 | 128.3 | 0 / 3 |
| 96-224-A-j26-1 | 120 | 2 | 0 | 604.2 | 0 / 3 |
| 96-224-B-j26-1 | 121 | 4 | 0 | 265.3 | 0 / 3 |
| 92-151-j26-1 | 151 | 16 | 0 | 2408.6 | 1 / 0 |
| 92-706-C-j26-1 | 706 | 2 | 2 | 416.5 | 1 / 0 |

Route records with the same passenger line remain separate. A pattern can have other exclusion reasons as well; this table does not promise that resolving its endpoint failure would admit the whole trip. Line 331's 40 pairs, for example, include distant source-call sequences and additional failures. No source calls are removed, reordered or relocated by this review.

The separately documented [Vaduz extension](ST-GALLEN-VADUZ-REVIEW.md) admits 28 Friday line-24 trips after corroborating the common corridor and joint operation; its two recovered pairs are removed from this remaining-failure inventory. The [Gommiswald follow-up](ST-GALLEN-GOMMISWALD-REVIEW.md) retains line-628 failures: the operator map shows a Schulhaus branch and does not corroborate the missing Dorf alignment.

The [operator-map follow-up](ST-GALLEN-ENDPOINT-FOLLOWUP.md) retains ten candidate pairs on lines 451, 420 and 729. It pins three additional maps and identifies the line-729 N72 candidate loop via Gemeindehaus, Coop and Sonnmatt, which differs from the mapped direct branch.

## Line 323: Dornbirn Messeplatz

Four failed directed platform pairs surround Messeplatz: Heinzenbeer → Messeplatz → Lustenau Schmitter and the reverse direction. The two Messeplatz platform projections are approximately **160.6 m / 159.9 m** from line 323's AL_OEV record `bus:134`. These affect **65 Friday trips across four patterns**, with no Sunday occurrences of these failures. No other individual BOS regional/city source feature supplies a passing candidate for these pairs.

RTB's [official line-323 stop list](https://www.rtb.ch/reisen/info-haltestelle/detail-linie/323), cached on 8 September, confirms the named stops in both directions. It does not supply an authoritative street path resolving the offset. The public [Vorarlberg GTFS sample](https://mobilitaetsdaten.gv.at/daten/soll-fahrplandaten-gtfs) contains **295 routes but no route with passenger designation 323**. This is a finding about that July sample, not a claim that no authoritative line-323 geometry exists elsewhere. The reviewed pairs remain excluded; neither stop coordinates nor the snap limit were changed.

## Line 705: Wil Psychiatrie

Four directed pairs cover Bahnhof ↔ Psychiatrie ↔ Zürcherstrasse. The original city-line record `city:26` misses Psychiatrie by **121.2 m**, affecting **58 Friday / 24 Sunday trips**, two complete patterns per day.

BOS regional source records `bus:110` (733) and `bus:112` (734) each yield geometrically passing paths: approximately **494 m** between Bahnhof and Psychiatrie and **298 m** between Psychiatrie and Zürcherstrasse. Their output geometry hashes differ, so the review does not describe them as identical independent corroboration. Matching another line, or missing the snap threshold by only 1.2 m, does not justify silently switching the route's source.

WilMobil's [nominal line-705 page](https://www.wilmobil.ch/reisen/info-haltestelle/detail-linie/705) lists Gallusstrasse and Lenzenbüel. The [line-734 page](https://www.wilmobil.ch/reisen/info-haltestelle/detail-linie/734) includes Winkelriedstrasse, Psychiatrie and Zürcherstrasse. Its [operating notices](https://www.wilmobil.ch/reisen/stoerungen/betriebsmeldungen) supply overlapping construction context:

- One line-705 notice closes Gallusstrasse/Lenzenbüel until 31 December and names Psychiatrie or Zürcherstrasse as alternatives.
- Another line-705 notice describes a 150 m relocation toward Zürcherstrasse until 12 December.
- A notice for lines 705 and 734 replaces Winkelriedstrasse with Psychiatrie from **24 August 05:00 to 21 September 23:59**, encompassing both fixtures.

These are evidence for temporary replacement stops, but do not specify the complete diverted street alignment or settle the overlapping descriptions. The pinned Swiss GTFS provides the fixture call order; live notices do not override it. The candidates remain diagnostic pending an applicable diversion map or equivalent route-specific geometry evidence.

## External source lead: Vorarlberg line 164

The official Mobilitätsdaten Österreich catalogue links the public sample `20260703-0010_gtfs_flex_vmobil_2026.zip`. Its internal feed version is **20260703**, with validity **14 December 2025–12 December 2026**. This differs from the catalogue's broad metadata validity interval; the report preserves the feed's actual fields. Retrieval is **8 September 2026**, not the source edition date. ZIP SHA-256:

`c19094742f994a7c7b346d67a2021d35b71bce610a994e5825b0f8d1900438ed`

The sample includes `at:vvv:164:` (Landbus Unterland, Lustenau–Lauterach–Wolfurt), **142 source trip records**, **seven referenced shapes** and **3,108 shape points**. These are inventory counts, not active Friday/Sunday trips. No external shapes have been admitted or substituted for the pinned Swiss timetable. The subsequent [directed line-164 review](ST-GALLEN-VMOBIL-REVIEW.md) confirms identical fixture calls and times but finds a 673–679 m discrepancy between the feeds at Treffpunkt a.d.Ach. The external shapes still fail at the original Swiss endpoints. A separately reviewed [stop rendering anchor](ST-GALLEN-STOP-ANCHOR-REVIEW.md) now admits all 58 Friday / 26 Sunday line-164 trips on the existing AL_OEV geometry; its four recovered pairs are removed from this remaining-failure review.

## Source dates, attribution and reuse

The report binds the original March AL_OEV export, Swiss GTFS archive/version, policy and exact day-audit hashes. Operator HTML snapshots, catalogue, licence and external ZIP have separate retrieval times and byte hashes. No edition date is invented for undated webpages. Changed live notices will not reproduce historical bytes; the cached snapshots define this review.

Attribution: **© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG** for AL_OEV; **SBB / opentransportdata.swiss** for Swiss timetable and stops; **RTB Rheintal Bus and WilMobil / BOS Gruppe** for operator evidence; **Mobilitätsverbünde Österreich OG / Verkehrsverbund Vorarlberg** for the external sample; **Mobilitätsdaten Österreich / AustriaTech** for its catalogue.

The external sample has a [custom licence](https://mobilitaetsdaten.gv.at/sites/default/files/metadataset/contract_examples/Lizenzvereinbarung_DBP_v1.1_0.pdf), not an asserted CC licence. Its terms provide free reproduction/adaptation subject to attribution, licence/disclaimer links, change notices and other conditions, including dataset-validity restrictions. This endpoint review uses it for source inventory; the separately documented line-164 anchor adopts one published stop coordinate for the local feed. The St. Gallen vector/feed redistribution restriction remains unchanged. Tracked review artifacts contain source references, hashes and measurements, not source paths or copied webpage bodies. All raw evidence stays in the ignored local cache. No road-direction certification is implied.

## Reproduce and verify

With original source and evidence caches present:

```sh
node scripts/review-st-gallen-endpoints.mjs --check
node scripts/check-st-gallen-region.mjs
node scripts/check-st-gallen-region.mjs --audit-only
```

The diagnostic replay verifies source bytes, reproduces every candidate and inventories the pinned external ZIP. The audit-only checker works from tracked files, verifying report/day/source hashes, exact failed-pair coverage, original distances, candidate source identities and distinct affected-pattern/trip totals. The full feed checker replays the original Swiss source calls and generated feed.

To acquire evidence and regenerate the diagnostic report, run `node scripts/review-st-gallen-endpoints.mjs --fetch-evidence`, inspect changed evidence and results, then run `node scripts/document-st-gallen-study.mjs`. Neither mode changes the source adapter, admission policy or regional feed payloads.
