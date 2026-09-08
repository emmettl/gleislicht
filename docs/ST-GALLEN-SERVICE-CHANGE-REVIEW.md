# St. Gallen: source changes at Sommerau and Rüti

The line-150 Sommerau extension and line-631 Rüti diversion explain four remaining endpoint failures, affecting **102 Friday / 33 Sunday trips**. Both need additional geometry; no new trips are admitted. The regional feed remains **10,652 Friday / 7,325 Sunday movements** with **1,004 / 773 complete directed patterns**.

The subsequent [OSM road pilot](ST-GALLEN-ROAD-PILOT.md) supplies numerical candidates for all four pairs, using every complete weekday/Sunday pattern on both routes. It identifies a 92.42 m unsupported inbound Sommerau connector and short, consistent Rüti candidates pending dated road/turn review. The exclusions remain in place; the new audit distinguishes candidate geometry from approved feed geometry.

## Gossau line 150: extension after the geometry export

Stadt Gossau's announcement, published via gossau24.ch on **27 April 2026**, states that service was extended from Eichen to Sommerau on **1 June 2026**. This is later than the pinned **24 March 2026 AL_OEV export**. The original Swiss timetable includes those new calls; changing Sommerau's coordinate or clipping the trips at Eichen would discard the documented extension.

Both Eichen↔Sommerau directions miss the original line-150 geometry by **512.68 m**. They affect **28 trips per direction on Friday**, two complete directed patterns. There are no Sunday occurrences of these failures.

The expanded diagnostic scans every **145 regional bus and 34 city/municipal bus source records**, regardless of operator. No individual record supplies a passing path in either direction. This establishes the gap in the pinned AL_OEV archive, not the absence of suitable geometry in every possible source. Obtain an updated or independently verified alignment for the extension.

## Rüti line 631: temporary replacement stop

The Kanton Zürich May construction notice covers **1 June through the end of October 2026**, encompassing both fixtures. It relocates the Eschenbach-bound line-631 Löwen stop into Bandwiesstrasse. Page 3 shows the replacement locations and the one-way regime. This corroborates the context of the pinned Bahnhof→Bandwies→Ferrach calls; the audit retains their original names, platform IDs and coordinates.

The Bandwies platform misses line 631's original geometry by **182.65 m**. Both adjoining pairs fail, affecting **46 Friday trips across two patterns** and **33 Sunday trips across three patterns**. Those totals count each trip once.

The all-operator scan finds one numerical candidate for Bahnhof→Bandwies: source `bus:138`, line 885, mapped to VZO agency `838` through the existing reviewed ZVV-label exception. Its path is **484.05 m**, with a **111.67 m** maximum endpoint snap. The candidate remains diagnostic and is not an approved cross-operator fallback. **No individual source record passes Bandwies→Ferrach**, so the full pattern cannot be recovered from this scan. The required next input is a complete verified diversion alignment.

The separate August notice concerns an expected **24–28 August 2026** closure at Werner-Weber-Strasse/Hauptstrasse. Its published interval does not cover either September fixture. It permits a weather-related extension but supplies no later end date; the audit does not invent one or substitute this short closure for the June–October regime.

## Dates, attribution and reproduction

Reviewed **9 September 2026, Europe/Zurich**. Retrieval times below are UTC. Publication dates, PDF modification dates, operational periods and the March geometry export remain distinct.

| Evidence | Published | PDF modified | Retrieved UTC | SHA-256 |
| --- | --- | --- | --- | --- |
| [Bessere ÖV-Erschliessung für die Sommerau](https://gossau24.ch/articles/376666-bessere-oev-erschliessung-fuer-die-sommerau) | 2026-04-27 | — | 2026-09-08T22:18:07.814224+00:00 | ac1468005b2cf7cc903ec61f3910f3c6dda28493e3fba09dd827483d792650fd |
| [Baustelleninfo Rüti/Dürnten, Mai 2026](https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/planen-bauen/tiefbau/baustellen/grosse-baustellen/rueti/R%C3%BCti%20-%20Baustelleninfo%20Ferrachstr%20H%C3%A4rtiplatz%20Dorfstr%2001.06.2026%20bis%20Ende%20Okt.%2026.pdf) | 2026-05 | 2026-05-13 | 2026-09-08T22:18:12.536222+00:00 | 5868b7385af0b955992e19decf84824068ec674e26a354fd7f87f4a360c9bdd6 |
| [Baustelleninfo Dürnten/Rüti, August 2026](https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/planen-bauen/tiefbau/baustellen/grosse-baustellen/rueti/rueti_tann_vollsperrung_haertiplatz_belagseinbau_24_08_28_08_2026.pdf) | 2026-08 | 2026-08-17 | 2026-09-08T22:18:16.884884+00:00 | 5daec84b652763d5339dfed95bd1c92100088f0c0e25005b47e951199b29a5e9 |

The [follow-up policy](../data/st-gallen-endpoint-followup-policy.json) pins the evidence bytes, both operational intervals, expected fixture coverage, exact pair keys and the sole cross-operator candidate hash. The [machine-readable review](../data/st-gallen-endpoint-followup.json) includes every negative scan result and the distinct weekday/Sunday affected-pattern totals. Source HTML/PDF files and geometry remain in the ignored local cache.

```sh
node scripts/review-st-gallen-endpoint-followup.mjs --fetch-evidence --check
node scripts/check-st-gallen-region.mjs --audit-only
```

The first command verifies evidence hashes, all 179 source records, the four directed pair searches, operational-period coverage and existing feed artifact hashes. It also preserves the earlier line-451/420/729 findings. The tracked audit checker rejects stale pair, candidate, event-date and feed bindings. No admission policy or feed payload is changed.

Attribution: **Stadt Gossau / gossau24.ch** for the service announcement; **Kanton Zürich, Baudirektion, Tiefbauamt** for construction notices; **© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG**, underlying **swissTNE Base / © swisstopo**, for geometry; **SBB / opentransportdata.swiss** for timetable and stops. The [canton study](ST-GALLEN-STUDY.md) retains publication restrictions and makes no claim of certified road direction.
