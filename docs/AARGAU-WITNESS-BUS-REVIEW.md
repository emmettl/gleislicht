# Aargau annual witness bus review

The [complete bus inventory](../data/aargau-witnesses/bus-inventory.json) accounts for **16 route records, 86 full directed platform patterns, 1,384 archived trip templates and 7,187 adjacent-call occurrences** left after the annual rail review. Fifteen route records are replacement buses; the PostAuto EXT record serves the Schupfart event corridor. Route identities and complete active service-date lists come from the independently verified GTFS archive, not public line labels. All calls outside Aargau remain included. No route is silently omitted.

The first bounded follow-up tests all six patterns of **AVA Ersatzverkehr, agency 7244, route 92-A07-9-j26-1, line EV**. Numerical road matching succeeds on all **4,616** occurrences. The [admission policy](../data/aargau-witness-ava-policy.json) accepts **2,466** April occurrences as inferred road geometry, holds **161** April occurrences for source-time review, and holds all **1,989** September occurrences for diversion review. Every prior **3,801** accepted occurrence is unchanged. A subsequent closure-localization review adds **1,836 September occurrences**, preserving all **6,267** earlier paths and retaining **153** September closure crossings. The Schupfart Festival follow-up adds another **195 occurrences**, preserving all **8,103** earlier paths and holding **12 zero-second intervals**. Current annual compatibility is **8,298 / 10,988** occurrences: all **194 rail patterns** plus **seven bus patterns** are complete. **2,690 bus occurrences across 79 incomplete patterns** remain excluded. This is a separate template candidate; no date-specific regional feed is expanded.

## Every bus route

Each archived trip template is counted once even if its calendar has multiple dates. The civil witness may include the preceding service day: AVA's selected **14 September** witness comes from the **13 September** calendar and continues after midnight. The operator notice ends the replacement period at **14 September, 01:30**, consistent with this distinction. Service dates and civil dates must not be interchanged.

| Route record / line | Agency | Patterns / templates | Source service dates: count, first–last | Selected civil witness | Remaining / original occurrences |
| --- | --- | --- | --- | --- | --- |
| 92-A07-9-j26-1 / EV | 7244 | 6 / 336 | 4: 2026-04-25 – 2026-09-13 | 2026-09-14 | 314 / 4,616 |
| 92-A04-B-j26-1 / EV1 | 7231 | 14 / 187 | 26: 2025-12-15 – 2026-11-05 | 2026-08-09 | 504 / 504 |
| 92-EV5-V-j26-1 / EV5 | 7231 | 2 / 71 | 3: 2026-05-23 – 2026-05-25 | 2026-05-23 | 391 / 391 |
| 92-A04-F-j26-1 / EV1 | 7231 | 10 / 165 | 37: 2026-04-13 – 2026-10-16 | 2026-09-14 | 328 / 328 |
| 92-EV8-F-j26-1 / EV8 | 7231 | 4 / 35 | 1: 2026-05-23 – 2026-05-23 | 2026-05-23 | 238 / 238 |
| 96-138-1-j26-1 / EXT | 801 | 12 / 32 | 3: 2026-09-25 – 2026-09-27 | 2026-09-25 | 12 / 207 |
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

The machine inventory records every full platform-coordinate chain, direction ID, source course, template digest, active service-date list, civil-date list and original failure assessment. The other **14 routes / 68 patterns / 2,364 occurrences** have not yet received a road review. AVA retains 314 held occurrences and Schupfart retains twelve. They remain a source-evidence backlog, not confirmed operating itineraries. The compact first/last dates above do not imply continuous daily service; consult the exact date arrays.

## Dated AVA evidence

AVA's [14 April notice](https://www.aargauverkehr.ch/aktuell/meldungen/wsb-ersatzbusse-zwischen-aarau-und-menziken-1) confirms replacement buses between Aarau and Menziken on **25–26 April 2026**. It substitutes **Aarau, Kantonsspital Ost** for Aarau Torfeld and omits Buchs AG. All four April source patterns use that hospital stop and omit both closed rail stops; the shorter workings turn at Bleien Liebegg. This confirms the service context and specified stop changes, not the precise road itinerary.

AVA's [2 September notice](https://www.aargauverkehr.ch/aktuell/meldungen/wsb-ersatzverkehr-und-bauarbeiten-zwischen-aarau-und-schoeftland) confirms **12–13 September** replacement buses on Aarau–Schöftland. It also closes Aarauerstrasse in Oberentfelden between Isengüetlistrasse and Suhrerstrasse from **11 September, 22:00, to 15 September, 05:00**. A signed diversion is announced. The initial AVA policy held both full September patterns; the municipal evidence below now localizes these holds to the two crossing segments. Neither complete September pattern is admitted. The [operating notice](https://www.aargauverkehr.ch/reisen/betrieb/betriebsmeldungen/uebersicht/s14-ersatzverkehr-aarau-schoeftland-5) states the replacement interval precisely as **12 September, 04:30, through 14 September, 01:30**.

All three original HTML responses, retrieval timestamps, publication dates where stated, raw/compressed SHA-256 values and **© Aargau Verkehr AG (AVA)** attribution are retained in [source metadata](../data/aargau-witness-ava-sources/sources.json). An absent publication date is left null rather than inferred from the service dates.

## September closure localization

The municipality's [7 September notice](https://oberentfelden.ch/erhaltungsmassnahmen-k-208-trasse-aargau-verkehr-ava-abschnitt-isengueetlistrasse-suhrerstrasse) and linked [diversion map, dated 11 August 2026, page 1](https://oberentfelden.ch/sites/default/files/2026-09/Umfahrung%20Baustelle%20AVA.pdf) identify an approximately 180 m closure between the two named junctions. The map was visually inspected for extent and signed-diversion context. It does not certify a complete bus itinerary through the source platforms.

The [localization policy](../data/aargau-witness-oberentfelden-policy.json) extracts **181.505 m** from historical OSM ways **48878570 / 769045499**, bounded by junction nodes **266859069 / 266859071**. The source calls the northern street **Isegüetlistrasse**, whereas the notice spells it **Isengüetlistrasse**; the map and named connected ways establish the same junction. Every coordinate comes from OSM. Source topology is retained and hashed, with no map linework copied into feed geometry.

Every line segment of each existing AVA polyline is tested against every closure segment, including intersections and collinear overlap. A conservative **20 m exclusion buffer** leaves **24 adjacent-call contexts / 1,836 template occurrences** clear, with a minimum distance of **73.713 m**. These unchanged OSM paths are admitted only for the exact **153 archived September templates**, after the original source-time screen. The **two Uerkenbrücke–Engelplatz directions / 153 occurrences** cross the closed corridor and stay excluded. This localizes a known closure; it does not assert that the other roads are operator-certified itineraries or that a new detour has been routed.

| Direction ID | Templates | Added clear occurrences | Held crossing occurrences |
| --- | --- | --- | --- |
| 1 | 76 | 912 | 76 |
| 0 | 77 | 924 | 77 |

The [source bundle](../data/aargau-witness-oberentfelden-sources/sources.json) retains original responses, raw/compressed hashes and retrieval timestamps on **8 September 2026**. The municipal notice is attributed to **Gemeinde Oberentfelden**. Map attribution is **© geoPro Suisse AG; © swisstopo; Daten des Kantons Aargau**, with its original rights statement retained. Historical OSM is queried at **2 September 2026, 00:00 UTC**, and remains **© OpenStreetMap contributors; ODbL-1.0**. Its closure coordinates supplement the earlier routing graph; no new geometry is synthesized.

## September detour timing reconciliation

The [directed detour diagnostic](../data/aargau-witnesses/oberentfelden-detour-review.json) follows the signed **Binzmattweg → Suhrenmattstrasse → Suhrerstrasse** corridor using the same historical OSM source. Both directions retain a **120-second** source interval in all **153** templates. Even the junction-to-junction core exceeds it:

| Direction ID | Templates held | Core metres | Minimum tagged-speed seconds | Source seconds |
| --- | --- | --- | --- | --- |
| 1 | 76 | 1754.67 | 135.79 | 120 |
| 0 | 77 | 1726.20 | 132.86 | 120 |

This is a minimum-time graph calculation, not a shortest-distance estimate. It respects OSM one-way and roundabout directions, removes the closed road edges and uses the mapped numeric speed tags. Both stop approaches, turn/access restrictions, signals, acceleration, congestion and dwell are omitted. Missing speed tags contribute **zero seconds**, including 20.47 m outbound. The retained **30 km/h** Binzmattweg tag materially affects the result. Thus the diagnostic is deliberately optimistic within the signed corridor and still needs source-time reconciliation. OSM tags are not current legal certification; the minute-granularity timetable also does not prove actual running times. No rounding allowance or revised call time is invented. The two crossing directions remain held, with **zero newly admitted occurrences** in this diagnostic.

## Initial directed road-pattern results

This table preserves the first AVA policy's decisions. The subsequent September additions and remaining holds are recorded above.

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

## Schupfart Festival: weekday, Sunday and after-midnight patterns

The official [festival travel page](https://www.schupfartfestival.ch/de/festival/index.php) links a [2026 special timetable](https://www.schupfartfestival.ch/docs/de/Fahrplan_Schupfart_2026_V1.pdf?m=1787834203&), alongside older 2025 links that are not used. Page 1 was visually inspected and its **32 advertised bus portions / 113 major calls** independently transcribed, then matched uniquely to all **32 GTFS templates** of **PostAuto 801, route 96-138-1-j26-1, line EXT**. The dates are **Friday 25, Saturday 26 and Sunday 27 September 2026**. All original intermediate calls, complete platform coordinates and out-of-canton stops remain retained. Printed **Eiken, Kirchgasse (Volg)** binds explicitly to GTFS **Eiken, Kirchgasse**; no general name alias is introduced.

Connecting rail services and regular buses are not counted as extra EXT trips. The published transfers at Wegenstetten distinguish the short shuttle from through workings. Returns printed after midnight under Friday/Saturday stay on those event/service dates as **24:xx / 25:xx**. For example, Friday's **01:33** departure is GTFS **25:33** on **25 September**, physically running on Saturday morning. The policy verifies this convention and cannot inherit the older 2025 calendar or another daily-feed instance.

The [event policy](../data/aargau-witness-schupfart-policy.json) tests **all twelve complete directed platform patterns / 207 occurrences** using the same pinned pfaedle binary, configuration and OSM graph as the AVA review. Numerical routing has **zero fallback warnings or rejected hops**, and maximum projection is **54.39 m**. All twelve complete paths were visually inspected. The unchanged **120 m / 6× / 1,500 m / 5 m** geometry limits and **80 km/h** mean-speed review threshold remain in force. **195 inferred OSM occurrences** are admitted: **81 direction 0 / 114 direction 1**. Six additional bus patterns become complete.

| Full pattern ID | Direction | Full endpoint pair | Templates | Admitted / held occurrences |
| --- | --- | --- | --- | --- |
| a0fd5d4d1f423b08df50 | 0 | Wegenstetten, Oberdorf → Schupfart, Abzw. Flugplatz | 8 | 16 / 0 |
| c6b3af7c62a74255cc29 | 0 | Frick, Bahnhof → Schupfart, Abzw. Flugplatz | 6 | 24 / 0 |
| 1c629e66251f31948b61 | 0 | Gelterkinden, Bahnhof → Schupfart, Abzw. Flugplatz | 2 | 22 / 4 |
| 090f7028ea3de6e6c6af | 0 | Möhlin, Bahnhof → Schupfart, Abzw. Flugplatz | 1 | 19 / 1 |
| d72165abd6ba9e8d4dc9 | 1 | Schupfart, Abzw. Flugplatz → Wegenstetten, Oberdorf | 2 | 4 / 0 |
| a6b8327bf0b3ae456f78 | 1 | Schupfart, Abzw. Flugplatz → Wegenstetten, Oberdorf | 2 | 4 / 0 |
| 671a8c9e80f63888afda | 1 | Schupfart, Abzw. Flugplatz → Frick, Bahnhof | 2 | 8 / 0 |
| b3f931d99e179a849bbe | 1 | Schupfart, Abzw. Flugplatz → Frick, Bahnhof | 3 | 12 / 0 |
| 518aabe925344e9a9182 | 1 | Schupfart, Abzw. Flugplatz → Gelterkinden, Bahnhof | 2 | 24 / 2 |
| 7b517e285b057ee285f8 | 1 | Schupfart, Abzw. Flugplatz → Gelterkinden, Bahnhof | 2 | 24 / 2 |
| d0c503db71a2b86ccb42 | 1 | Schupfart, Abzw. Flugplatz → Möhlin, Bahnhof | 1 | 18 / 1 |
| cdd639b7efbb35713c9a | 1 | Schupfart, Abzw. Flugplatz → Möhlin, Bahnhof | 1 | 20 / 2 |

The other **twelve occurrences in eight segment contexts** have a literal zero-second interval between different stops. They remain held without invented running time or interpolation. The major-call PDF does not resolve these intermediate-call times:

| Pattern | Directed pair | Templates held | Source seconds | Diagnostic road metres |
| --- | --- | --- | --- | --- |
| 1c629e66251f31948b61 | Ormalingen, Hemmikerstrasse → Ormalingen, Zwischbach | 2 | 0 | 310.36 |
| 1c629e66251f31948b61 | Hemmiken, Stiegelmatt → Hemmiken, Friedhof | 2 | 0 | 408.85 |
| 090f7028ea3de6e6c6af | Zeiningen, Mitteldorf → Zeiningen, Ausserdorf | 1 | 0 | 420.05 |
| 518aabe925344e9a9182 | Hemmiken, Friedhof → Hemmiken, Stiegelmatt | 2 | 0 | 394.32 |
| 7b517e285b057ee285f8 | Hemmiken, Friedhof → Hemmiken, Stiegelmatt | 2 | 0 | 235.53 |
| d0c503db71a2b86ccb42 | Zuzgen, Niederhofen → Zeiningen, Bernet | 1 | 0 | 1256.08 |
| cdd639b7efbb35713c9a | Wegenstetten, Mitteldorf → Wegenstetten, Abzw. Schupfart | 1 | 0 | 431.97 |
| cdd639b7efbb35713c9a | Zuzgen, Niederhofen → Zeiningen, Bernet | 1 | 0 | 1300.02 |

The [source bundle](../data/aargau-witness-schupfart-sources/sources.json) retains the original HTML and PDF, raw/compressed hashes and retrieval timestamps on **9 September 2026 (Europe/Zurich)**. Attribution is **Schupfart Festival; PostAuto AG**, as branded on the timetable. The PDF metadata records creation and modification at **5 May 2026, 11:59:24 UTC**; verified publication dates remain null. Printed service dates are not publication dates. Full routing outputs and hashes are retained separately; inferred geometry remains **© OpenStreetMap contributors; ODbL-1.0**, with the original **2/8 September 2026** graph provenance. The advertised timetable confirms service context and major calls, not precise roads or legal directions.

## Regression and next work

The [candidate audit](../data/aargau-witnesses/schupfart-review-summary.json) replays the previous closure-localization candidate before applying the Schupfart event policy, preserves all original stop coordinates and complete calls, verifies exact path endpoints and compares all other source assessments unchanged. The [candidate paths](../data/aargau-witnesses/schupfart-review-patterns.json.gz) retain the prior rejection information on admitted segments. Held diagnostic paths remain in their separate AVA or Schupfart cache and policy. Exact source-template hashes, calendars, route/agency/mode/direction identities and complete platform chains prevent inheritance by another service or a dated release feed.

Next work is to reconcile the two April timing pairs and the two remaining September closure-crossing directions against the signed road diversion, reconcile Schupfart’s zero-second calls, and acquire dated evidence and route the remaining 68 bus patterns. The separate **222 September bus-alignment reviews**, civil-day extraction of additional witness dates, DST repeated-hour handling and application release checks also remain open. The original Friday/Sunday and twelve-date seasonal feeds are unchanged; publication readiness remains false. This bus follow-up was checked on **9 September 2026**.

## Reproduction

```sh
node scripts/inventory-aargau-witness-buses.mjs --check
node scripts/prepare-aargau-witness-ava.mjs /tmp/aargau-ava-preparation
node scripts/match-postbus-roads.mjs --pfaedle /path/pfaedle --config /path/pfaedle.cfg --osm /path/pinned-roads.osm.pbf --feed /tmp/aargau-ava-preparation/7244 --output /tmp/aargau-ava-matched/7244
# Offline replay uses archived outputs; no routing binary or network is required:
node scripts/package-aargau-witness-ava.mjs --check
node scripts/prepare-aargau-witness-ava-policy.mjs --check
node scripts/review-aargau-witness-ava.mjs --check
node scripts/prepare-aargau-witness-oberentfelden.mjs --check
node scripts/review-aargau-witness-oberentfelden.mjs --check
node scripts/review-aargau-oberentfelden-detour.mjs --check
# Schupfart routing preparation uses the same pinned matcher/configuration/graph:
node scripts/prepare-aargau-witness-schupfart.mjs /tmp/aargau-schupfart-preparation
node scripts/package-aargau-witness-schupfart.mjs --check
node scripts/prepare-aargau-witness-schupfart-policy.mjs --check
node scripts/review-aargau-witness-schupfart.mjs --check
node scripts/document-aargau-witness-buses.mjs --check
npx vitest run scripts/aargau-witness-schupfart.test.mjs scripts/aargau-oberentfelden-detour.test.mjs scripts/aargau-witness-oberentfelden.test.mjs scripts/aargau-witness-ava.test.mjs scripts/aargau-road-geometry.test.mjs scripts/enrich-postbus-roads.test.mjs
```
