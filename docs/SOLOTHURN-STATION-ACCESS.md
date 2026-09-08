# Solothurn station-access follow-up

Reviewed 9 September 2026. All **seven residual directed pairs** were reconciled against the complete twelve-date audit. **No additional journeys are admitted.** The published feed remains **7,033 Friday / 5,695 Sunday**, with **123 / 124 exclusions**. All sampled rail geometry remains complete.

## Bus approaches compared

The [reproducible audit](../data/solothurn-audit/station-access-review.json) retains both full stop chains, original calls, candidate paths and hashes for every comparison. Distances below measure disagreement between paths with samples every 5 m; they are diagnostics, not a new acceptance tolerance.

| Directed pair | Candidate lengths | Maximum sampled separation | Shared prefix / suffix |
| --- | --- | --- | --- |
| Däniken, Post → Dulliken, Bahnhof | 3083.1 / 3028.5 m | 49.1 m | 2763.4 / 0.0 m |
| Schönenwerd SO, Bahnhof → Aarau, Bahnhof | 5219.4 / 5217.8 m | 7.3 m | 5.6 / 5031.4 m |
| Pieterlen, Bahnhof → Biel/Bienne, Carterminal | 10332.6 / 10240.1 m | 38.2 m | 0.0 / 9898.8 m |

Däniken → Dulliken has one terminating and one through-to-Olten context. Schönenwerd → Aarau has different complete origins. Pieterlen → Biel has different preceding Lengnau stops. Those context differences are retained: no candidate is chosen merely because it is shorter or nearly coincident.

## New primary-source review

- **Dulliken:** the [SBB replacement-stop plan](../data/solothurn-station-access-sources/dulliken-plan.pdf), **October 2024**, labels separate boarding positions towards Olten and towards Däniken/Aarau. Its red dotted lines show pedestrian access from the rail platforms. It supplies no bus approach or terminal-turnaround instruction.
- **Däniken:** the [SBB replacement-stop plan](../data/solothurn-station-access-sources/daniken-plan.pdf), **October 2024**, confirms the replacement stop name Däniken, Post and distinguishes Däniken, Bahnhof. Pedestrian paths do not establish road direction or select a bus itinerary. Both plans credit SBB, OpenStreetMap contributors, imagico, trafimage.ch and mapset.ch. They predate the July 2026 fixture.
- **Egerkingen:** the [ASTRA notice of 15 May 2026](https://www.astra.admin.ch/de/a1-luterbach-haerkingen-6-streifen-ausbau-neue-verkehrsfuehrung-in-egerkingen-bringt-entlastung) announces staged nearby road openings from May through July and continuing construction, subject to schedule changes. It does not specify BOGG 501 or its station approach. The winter and later original GTFS records differ by **9.4 m at Gäu Park** and **73.8 m at Bahnhof**. Neither identity is substituted for the other. The notice is regional construction context; no completion date is inferred.

The [source manifest](../data/solothurn-station-access-sources/sources.json) retains URLs, acquisition time, hashes, dates, attribution and decisions. PDFs and the notice are review evidence; no PDF geometry or inferred reuse licence enters the feed. Existing OSM candidate geometry is attributed to © OpenStreetMap contributors, ODbL-1.0, using the pinned 2 September 2026 extract.

## Remaining directed pairs

| Route | Original directed stop IDs | Sampled dates and failed-pair occurrences |
| --- | --- | --- |
| 10 (tram) | ch:1:sloid:88764:1:1 → ch:1:sloid:77:1:5 | 2026-01-16: 94; 2026-01-18: 103; 2026-04-03: 103; 2026-04-05: 103; 2026-07-17: 94; 2026-07-19: 103; 2026-08-01: 101; 2026-09-04: 94; 2026-09-06: 103; 2026-10-23: 94; 2026-10-25: 103; 2026-12-11: 94 |
| 10 (tram) | ch:1:sloid:77:1:5 → ch:1:sloid:88765:1:1 | 2026-01-16: 94; 2026-01-18: 100; 2026-04-03: 100; 2026-04-05: 100; 2026-07-17: 94; 2026-07-19: 100; 2026-08-01: 101; 2026-09-04: 94; 2026-09-06: 100; 2026-10-23: 94; 2026-10-25: 100; 2026-12-11: 94 |
| 501 (bus) | ch:1:sloid:88076 → ch:1:sloid:78916 | 2026-01-16: 29 |
| EV4 (bus) | ch:1:sloid:87627 → ch:1:sloid:10672 | 2026-04-05: 17; 2026-09-06: 21 |
| 501 (bus) | ch:1:sloid:88076:0:01 → ch:1:sloid:78916:0:02 | 2026-07-17: 29; 2026-09-04: 29; 2026-10-23: 29; 2026-12-11: 29 |
| EV1 (bus) | ch:1:sloid:82651 → ch:1:sloid:90406 | 2026-07-17: 3 |
| EV1 (bus) | ch:1:sloid:88650 → ch:1:sloid:2996 | 2026-07-17: 3 |

The two Arlesheim tram pairs share platform E and mostly affect the same journeys. The retained official-line and historical-tram comparisons still exceed the 80 m attachment limit; no operator-supported coordinate correction was found. The previous [Pieterlen and Egerkingen review](SOLOTHURN-STUDY.md#summer-rail-and-winter-bus-follow-up) continues to apply. No geometry threshold changes or stop substitutions follow from these documents.

| Date | Unique excluded journeys |
| --- | --- |
| 2026-01-16 | 123 |
| 2026-01-18 | 103 |
| 2026-04-03 | 103 |
| 2026-04-05 | 120 |
| 2026-07-17 | 129 |
| 2026-07-19 | 103 |
| 2026-08-01 | 101 |
| 2026-09-04 | 123 |
| 2026-09-06 | 124 |
| 2026-10-23 | 123 |
| 2026-10-25 | 103 |
| 2026-12-11 | 123 |

Reproduce offline with:

```sh
node scripts/review-solothurn-residual-gaps.mjs --check
node scripts/review-solothurn-station-access.mjs --check
```
