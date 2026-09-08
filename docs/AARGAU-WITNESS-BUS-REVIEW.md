# Aargau annual witness bus review

The [complete bus inventory](../data/aargau-witnesses/bus-inventory.json) accounts for **16 route records, 86 full directed platform patterns, 1,384 archived trip templates and 7,187 adjacent-call occurrences** left after the annual rail review. Fifteen route records are replacement buses; the PostAuto EXT record serves the Schupfart event corridor. Route identities and complete active service-date lists come from the independently verified GTFS archive, not public line labels. All calls outside Aargau remain included. No route is silently omitted.

The first bounded follow-up tests all six patterns of **AVA Ersatzverkehr, agency 7244, route 92-A07-9-j26-1, line EV**. Numerical road matching succeeds on all **4,616** occurrences. The [admission policy](../data/aargau-witness-ava-policy.json) accepts **2,466** April occurrences as inferred road geometry, holds **161** April occurrences for source-time review, and holds all **1,989** September occurrences for diversion review. Every prior **3,801** accepted occurrence is unchanged. Current annual compatibility is **6,267 / 10,988** occurrences: all **194 rail patterns** plus **one bus pattern** are complete. **4,721 bus occurrences across 85 incomplete patterns** remain excluded. This is a separate template candidate; no date-specific regional feed is expanded.

## Every bus route

Each archived trip template is counted once even if its calendar has multiple dates. The civil witness may include the preceding service day: AVA's selected **14 September** witness comes from the **13 September** calendar and continues after midnight. The operator notice ends the replacement period at **14 September, 01:30**, consistent with this distinction. Service dates and civil dates must not be interchanged.

| Route record / line | Agency | Patterns / templates | Source service dates: count, first–last | Selected civil witness | Remaining / original occurrences |
| --- | --- | --- | --- | --- | --- |
| 92-A07-9-j26-1 / EV | 7244 | 6 / 336 | 4: 2026-04-25 – 2026-09-13 | 2026-09-14 | 2,150 / 4,616 |
| 92-A04-B-j26-1 / EV1 | 7231 | 14 / 187 | 26: 2025-12-15 – 2026-11-05 | 2026-08-09 | 504 / 504 |
| 92-EV5-V-j26-1 / EV5 | 7231 | 2 / 71 | 3: 2026-05-23 – 2026-05-25 | 2026-05-23 | 391 / 391 |
| 92-A04-F-j26-1 / EV1 | 7231 | 10 / 165 | 37: 2026-04-13 – 2026-10-16 | 2026-09-14 | 328 / 328 |
| 92-EV8-F-j26-1 / EV8 | 7231 | 4 / 35 | 1: 2026-05-23 – 2026-05-23 | 2026-05-23 | 238 / 238 |
| 96-138-1-j26-1 / EXT | 801 | 12 / 32 | 3: 2026-09-25 – 2026-09-27 | 2026-09-25 | 207 / 207 |
| 92-A04-9-j26-1 / EV2 | 7231 | 8 / 135 | 24: 2026-03-08 – 2026-11-22 | 2026-08-09 | 191 / 191 |
| 92-EV1-D-j26-1 / EV1 | 7231 | 7 / 146 | 4: 2026-08-15 – 2026-10-11 | 2026-08-16 | 158 / 158 |
| 92-A01-N-j26-1 / EV4 | 7231 | 4 / 123 | 7: 2026-05-23 – 2026-10-18 | 2026-05-23 | 130 / 130 |
| 92-A05-X-j26-1 / EV3 | 7231 | 4 / 8 | 3: 2026-05-20 – 2026-05-22 | 2026-05-22 | 98 / 98 |
| 92-A08-U-j26-1 / EV1 | 7231 | 2 / 10 | 7: 2026-04-20 – 2026-11-03 | 2026-04-20 | 80 / 80 |
| 92-EV9-I-j26-1 / EV9 | 7231 | 2 / 39 | 3: 2026-05-23 – 2026-05-25 | 2026-05-23 | 78 / 78 |
| 92-EV7-R-j26-1 / EV7 | 7231 | 2 / 74 | 3: 2026-05-23 – 2026-05-25 | 2026-05-23 | 74 / 74 |
| 92-A01-Q-j26-1 / EV2 | 7231 | 5 / 14 | 4: 2026-09-14 – 2026-09-17 | 2026-09-14 | 59 / 59 |
| 92-A08-Z-j26-1 / EV2 | 7231 | 3 / 8 | 13: 2026-03-14 – 2026-10-11 | 2026-05-23 | 28 / 28 |
| 92-A01-U-j26-1 / EV3 | 7231 | 1 / 1 | 4: 2026-09-14 – 2026-09-17 | 2026-09-14 | 7 / 7 |

The machine inventory records every full platform-coordinate chain, direction ID, source course, template digest, active service-date list, civil-date list and original failure assessment. The other **15 routes / 80 patterns / 2,571 occurrences** are not newly road-matched in this increment. They remain a source-evidence backlog, not confirmed operating itineraries. The compact first/last dates above do not imply continuous daily service; consult the exact date arrays.

## Dated AVA evidence

AVA's [14 April notice](https://www.aargauverkehr.ch/aktuell/meldungen/wsb-ersatzbusse-zwischen-aarau-und-menziken-1) confirms replacement buses between Aarau and Menziken on **25–26 April 2026**. It substitutes **Aarau, Kantonsspital Ost** for Aarau Torfeld and omits Buchs AG. All four April source patterns use that hospital stop and omit both closed rail stops; the shorter workings turn at Bleien Liebegg. This confirms the service context and specified stop changes, not the precise road itinerary.

AVA's [2 September notice](https://www.aargauverkehr.ch/aktuell/meldungen/wsb-ersatzverkehr-und-bauarbeiten-zwischen-aarau-und-schoeftland) confirms **12–13 September** replacement buses on Aarau–Schöftland. It also closes Aarauerstrasse in Oberentfelden between Isengüetlistrasse and Suhrerstrasse from **11 September, 22:00, to 15 September, 05:00**. A signed diversion is announced but not resolved by this audit. A successful normal-road match therefore cannot admit either September pattern. The [operating notice](https://www.aargauverkehr.ch/reisen/betrieb/betriebsmeldungen/uebersicht/s14-ersatzverkehr-aarau-schoeftland-5) states the replacement interval precisely as **12 September, 04:30, through 14 September, 01:30**.

All three original HTML responses, retrieval timestamps, publication dates where stated, raw/compressed SHA-256 values and **© Aargau Verkehr AG (AVA)** attribution are retained in [source metadata](../data/aargau-witness-ava-sources/sources.json). An absent publication date is left null rather than inferred from the service dates.

## Directed road-pattern results

| Full pattern | Direction ID | Source period / templates | Admitted occurrences | Held occurrences |
| --- | --- | --- | --- | --- |
| Aarau, Bahnhof Süd → Bleien Liebegg, Bahnhof | 0 | april / 22 | 132 | none |
| Aarau, Bahnhof Süd → Menziken, Bahnhof | 0 | april / 70 | 1120 | 70 timing |
| Bleien Liebegg, Bahnhof → Aarau, Bahnhof Süd | 1 | april / 22 | 110 | 22 timing |
| Schöftland, Bahnhof → Aarau, Bahnhof Süd | 1 | september / 76 | 0 | 988 diversion |
| Aarau, Bahnhof Süd → Schöftland, Bahnhof | 0 | september / 77 | 0 | 1001 diversion |
| Menziken, Bahnhof → Aarau, Bahnhof Süd | 1 | april / 69 | 1104 | 69 timing |

Full-context routing uses **pfaedle v0.1.6-208-g99f2cd4**, with independent pattern warnings enabled and trie aggregation disabled. The graph combines **Geofabrik Switzerland 2 September 2026** with the earlier **8 September border extract**. Source SHA-256 is **d5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b**. It postdates the April services and does not establish their historical running alignment. The configuration, binary hash, complete matcher logs, original shape/stop-time outputs, imported cache and replay hashes are retained in [routing evidence](../data/aargau-witness-ava-sources/routing.json).

There are **zero matcher fallback warnings or rejected hops**, and maximum road projection is **49.89 m**, within the unchanged **120 m** limit. The existing **6× detour bound / 1,500 m allowance** and **5 m simplification** remain unchanged. Paths were also inspected as six complete directed chains. Successful geometry remains explicitly **© OpenStreetMap contributors; ODbL-1.0** inference, not operator-certified routing or physical-direction certification.

## Source-time holds

The candidate applies a conservative **80 km/h required-mean review threshold** to every adjacent interval of every exact source template. This is an audit screen, not a legal limit or a claim that paths below it are physically certified. The source uses minute-granularity calls; no assumed rounding allowance or fabricated dwell time is added. The following two directed pairs in three full contexts are held:

| Pattern | Directed pair | Templates | Source seconds | Road metres | Required mean km/h |
| --- | --- | --- | --- | --- | --- |
| cc38949a02f498ac83a1 | Teufenthal AG, Bahnhof → Unterkulm Nord, Bahnhof | 70 | 60 | 1683.97 | 101.04 |
| 7e8f70e7aaf84f5e3c57 | Bleien Liebegg, Bahnhof → Gränichen, Oberdorfstrasse | 22 | 60 | 1356.28 | 81.38 |
| c616f19869a798948f8c | Bleien Liebegg, Bahnhof → Gränichen, Oberdorfstrasse | 69 | 60 | 1356.28 | 81.38 |

The Teufenthal–Unterkulm Nord endpoints are already **1,538.42 m** apart in a straight line, so its one-minute source interval needs reconciliation beyond merely finding a shorter road path. Bleien Liebegg–Gränichen Oberdorfstrasse is **1,300.49 m** straight-line versus **1,356.28 m** on the candidate road path. Both complete return contexts retain the same held road geometry as evidence. Every original call and time remains unchanged.

## Regression and next work

The [candidate audit](../data/aargau-witnesses/ava-review-summary.json) replays the previous rail candidate before applying AVA, preserves all original stop coordinates and complete calls, verifies exact path endpoints and compares all other source assessments unchanged. The [candidate paths](../data/aargau-witnesses/ava-review-patterns.json.gz) retain the prior rejection information on admitted segments. Held diagnostic paths are preserved only in the separate AVA cache and policy. Exact source-template hashes, calendars, route/agency/mode/direction identities and complete platform chains prevent inheritance by another service or a dated release feed.

Next work is to reconcile the two April timing pairs and September's signed road diversion, then acquire dated evidence and route the remaining 80 bus patterns. The separate **222 September bus-alignment reviews**, civil-day extraction of additional witness dates, DST repeated-hour handling and application release checks also remain open. The original Friday/Sunday and twelve-date seasonal feeds are unchanged; publication readiness remains false.

## Reproduction

```sh
node scripts/inventory-aargau-witness-buses.mjs --check
node scripts/prepare-aargau-witness-ava.mjs /tmp/aargau-ava-preparation
node scripts/match-postbus-roads.mjs --pfaedle /path/pfaedle --config /path/pfaedle.cfg --osm /path/pinned-roads.osm.pbf --feed /tmp/aargau-ava-preparation/7244 --output /tmp/aargau-ava-matched/7244
# Offline replay uses archived outputs; no routing binary or network is required:
node scripts/package-aargau-witness-ava.mjs --check
node scripts/prepare-aargau-witness-ava-policy.mjs --check
node scripts/review-aargau-witness-ava.mjs --check
node scripts/document-aargau-witness-buses.mjs --check
npx vitest run scripts/aargau-witness-ava.test.mjs scripts/aargau-road-geometry.test.mjs scripts/enrich-postbus-roads.test.mjs
```
