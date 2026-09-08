# St. Gallen: Vorarlberg line-164 shape validation

The official Vorarlberg July GTFS sample reproduces **all 58 Friday / 26 Sunday Swiss line-164 trips**, including the full directed stop order and every arrival/departure time. Using the original Swiss coordinates does **not** resolve the geometry exclusion: the feeds disagree on the location of **Dornbirn, Treffpunkt a.d.Ach by 673–679 m**. Both the original St. Gallen geometry and the external shapes remain too far from the Swiss stop coordinate. The subsequent [reviewed stop rendering anchor](ST-GALLEN-STOP-ANCHOR-REVIEW.md) resolves this discrepancy for rendering on existing AL_OEV linework. All 58 / 26 trips are now admitted, and the regional feed contains **10,652 Friday / 7,325 Sunday movements**. This comparison deliberately retains the original Swiss coordinates; no external shapes are admitted.

The [machine-readable review](../data/st-gallen-vmobil-review.json) contains each active shape variant's ordered stop correspondence, coordinate differences, directed pair slices as hashes and distances, calendar counts, schedule equality and exact source/day bindings. It extends the [complete endpoint review](ST-GALLEN-ENDPOINT-REVIEW.md).

## Identity and calendar reconciliation

The Swiss route is `92-164-C-j26-1`, agency `81_VVV` (Verkehrsverbund Vorarlberg). The external route is `at:vvv:164:`, agency `33` (Landbus Unterland). Numeric agency IDs are not interchangeable across feeds. The comparison uses the reviewed passenger designation, all ordered stop names, direction, active calendars and complete call times. It does not infer identity from the number 164 alone. The external route's long name says “Lustenau-Lauterach-Wolfurt”; its actual trip headsigns and calls run between Widnau and Dornbirn. The long name was therefore not used as route-membership evidence.

Case, punctuation and `ß`/`ss` differences are normalized, with an explicit expansion of Philipp-Krapf-Str. This establishes a candidate correspondence between names, not permission to substitute coordinates or platform IDs. Both sources' stop IDs remain recorded separately. Swiss source calls and coordinates are untouched.

| Fixture | Direction | Swiss / external trips | Active external shapes | Complete call times |
| --- | --- | --- | --- | --- |
| Friday 4 September | Widnau → Dornbirn | 29 / 29 | `1.1.R`: 28; `1.2.R`: 1 | All identical |
| Friday 4 September | Dornbirn → Widnau | 29 / 29 | `1.5.H`: 29 | All identical |
| Sunday 6 September | Widnau → Dornbirn | 13 / 13 | `1.2.R`: 13 | All identical |
| Sunday 6 September | Dornbirn → Widnau | 13 / 13 | `1.5.H`: 13 | All identical |

Shape IDs in this table have prefix `14-164-E-j26-`. The outbound pattern has 20 calls; the return has 21, including Widnau Rheinstrasse. Dornbirn Bahnhof uses different external platform variants in `1.1.R` and `1.2.R`; these variants are retained separately. The remaining four of the source's seven shapes have no active trips on either fixture and are inventoried with hashes, not borrowed for an inactive service pattern.

Active services are resolved from weekday flags, date ranges and `calendar_dates` additions/removals. The review verifies that line 164 has no preceding-day spillover and no calls extending beyond midnight on these dates before comparing service-day totals to the Swiss civil-day totals. A future feed introducing spillover fails this bounded review rather than silently comparing unlike counts.

## Directed shape and stop-coordinate results

Each shape is sorted by numeric `shape_pt_sequence`. Every call pair is sliced forward using the source `shape_dist_traveled` values, preserving intermediate vertices and repeated locations. This avoids reversing a shape or finding an undirected shortcut through a loop. Every pair records its source distance interval, geometry hash, length and endpoint gaps. These are source-directed shape slices, not certification of legal road directions.

| Stop / direction | Swiss ↔ external stop separation | Swiss endpoint ↔ corresponding shape position | Result |
| --- | --- | --- | --- |
| Treffpunkt a.d.Ach toward Dornbirn | 673.5 m | 676.0 m | Both adjacent pairs fail |
| Treffpunkt a.d.Ach toward Widnau | 679.2 m | 676.2 m | Both adjacent pairs fail |
| Messekreuzung toward Dornbirn | 143.2 m | 143.5 m | Both adjacent directed slices fail |

The external platform coordinates themselves lie within **6.7 m** of their corresponding shape positions across all active variants. This is an internal consistency check of the Vorarlberg source; it does not prove which source coordinate should override the other.

A separate diagnostic applies the existing nearest-projection matcher to each complete external shape with the unchanged 120 m limit. It still rejects the four directed pairs adjacent to Treffpunkt, whose nearest full-shape projections are approximately **675.9 m** away. Thus the failure is not an artifact of clipping by source distance. At Messekreuzung, a nearer point elsewhere on the shape passes that diagnostic; the 143.5 m discrepancy is a finding about the corresponding source stop position, not a newly introduced production exclusion. No whole external variant passes the directed-slice comparison with unchanged Swiss coordinates.

The recorded evidence supports a **cross-source coordinate discrepancy**. It does not establish its cause, an official cross-feed platform mapping or authorization to relocate the Swiss stop. The separate anchor review documents coordinate provenance and treats one published platform as a representative stop-level rendering point, with the opposite platform 8.90 m away. It does not claim a direction-specific platform assignment or alter the source timetable. Relaxing the snap radius or drawing a connector of roughly 676 m would conceal this unresolved discrepancy.

## Sources, dates and attribution

The [official Mobilitätsdaten Österreich catalogue](https://mobilitaetsdaten.gv.at/daten/soll-fahrplandaten-gtfs) supplied the public `20260703-0010_gtfs_flex_vmobil_2026.zip` sample. Its internal edition is **3 July 2026**, valid **14 December 2025–12 December 2026**; the local snapshot was retrieved **8 September 2026**. It is compared with the pinned **2 September Swiss GTFS** and the existing March AL_OEV source binding. Retrieval, edition and fixture dates remain distinct.

ZIP SHA-256: `c19094742f994a7c7b346d67a2021d35b71bce610a994e5825b0f8d1900438ed`.

Attribution: **Mobilitätsverbünde Österreich OG / Verkehrsverbund Vorarlberg** for external timetable, stops and shapes; **Mobilitätsdaten Österreich / AustriaTech** for the catalogue; **SBB / opentransportdata.swiss** for Swiss timetable/stops; **© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG** for the original geometry. The external [custom licence and disclaimer](https://mobilitaetsdaten.gv.at/sites/default/files/metadataset/contract_examples/Lizenzvereinbarung_DBP_v1.1_0.pdf) and its validity conditions remain applicable. The source archive and coordinates are kept in the ignored local cache; tracked artifacts contain measurements, names, IDs and hashes. St. Gallen redistribution restrictions and the feed's local-only status remain unchanged.

## Reproduce and verify

With the source caches described in the endpoint review:

```sh
node scripts/review-st-gallen-vmobil.mjs --check
npx vitest run scripts/st-gallen-vmobil.test.mjs
node scripts/check-st-gallen-region.mjs --audit-only
node scripts/check-st-gallen-region.mjs
```

The first command reopens the pinned ZIP, checks its evidence hashes and replays calendars, complete schedules, directed slices and nearest-shape diagnostics. The unit tests cover forward clipping through repeated coordinates, reversed/out-of-range intervals, calendar exceptions and distinct stop names. The audit-only checker verifies exact day/pattern coverage, shape bindings, stop chains, counts, distance-based decisions and the separately reviewed anchor admission without needing the external ZIP. The full regional checker continues to validate the unchanged Swiss calls and feed.
