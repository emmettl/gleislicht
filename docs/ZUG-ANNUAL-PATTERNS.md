# Zug: annual directed stop-pattern and calendar audit

Prepared **9 September 2026** from the same frozen national GTFS release as the [regional feed and geometry audit](ZUG-STUDY.md). This expands the annual inventory; it adds no feed dates or geometry admissions.

## Findings

All **22'676 annual trip records**, **77 routes** and **5'036 services** are now retained with their complete calls and calendars. They contain **3'614 exact directed patterns**. The September 4/6 civil fixtures exercise **511** distinct patterns across both dates; **3'103** active patterns are absent. No pattern is inactive throughout the declared feed-validity window. Both complete fixture timetables reconstruct exactly, including previous-service-day carry-in, following-day tails, source IDs, call rules and all original times.

An exact pattern includes route ID, direction ID, every ordered GTFS stop/platform ID and every pickup/drop-off rule. Repeated stops stay repeated. A differing platform is a distinct pattern even when the station name is unchanged. Pattern identity does not include the trip's departure time.

| Mode | Routes | Annual exact patterns | Seen on fixtures | Additional exact patterns | Additional parent-station patterns |
| --- | --- | --- | --- | --- | --- |
| rail | 27 | 3'385 | 323 | 3'062 | 186 |
| bus | 47 | 217 | 176 | 41 | 35 |
| mountain | 1 | 2 | 2 | 0 | 0 |
| boat | 2 | 10 | 10 | 0 | 0 |

### Platform changes versus station-sequence changes

Following only explicit GTFS **parent_station** references yields **492** ordered parent-station patterns. **221** parent-station patterns are absent from the fixtures. Of the 3'103 additional exact patterns, **2'128** share a route/direction/call-rule parent sequence with a fixture pattern; the remaining **975** do not. This comparison retains call order, repeated calls and pickup/drop-off rules. It grants no permission to substitute platforms or reuse a fixture path on another date.

Rail accounts for most additional exact variants. The source still needs date-specific platform, path and timing validation; matching parent stations alone cannot certify running tracks or construction diversions. All ten annual lake patterns and both mountain patterns already occur on the fixtures, but their operation and geometry on other dates have not been validated.

## Calendar coverage and proposed review dates

The inventory expands weekly calendar flags and applies every retained calendar_dates addition/removal, including services with only exceptions. Expansion is bounded by feed_info validity **20251214–20261212**. It preserves **724'022 exception rows**. There are **0 scoped frequency templates**; the extractor nevertheless preserves and checks the frequency table. Counts of service-trip records describe source records active on a service date, not expanded headway departures.

Among additional exact patterns, **338** operate only on Saturdays and **520** only on Sundays. A weekday/Sunday-only sample cannot exercise the Saturday-only variants. **1'328** additional patterns have only one active service date, spread over **298 distinct dates**. Therefore at least that many source service dates are needed to exercise every exact annual pattern. The deterministic greedy cover selects **305 dates**, with every additional exact pattern assigned once; it is not asserted to be minimal.

The separate parent-station comparison requires **51 proposed dates** under the same greedy method. The first twelve selections below prioritize station-sequence coverage. The machine audit retains the complete selections and exact pattern IDs, plus all eligible dates and the source trips for every pattern.

| Source service date | Weekday | New parent-station patterns |
| --- | --- | --- |
| 2026-05-10 | sunday | 31 |
| 2026-07-09 | thursday | 21 |
| 2026-08-01 | saturday | 14 |
| 2026-02-12 | thursday | 11 |
| 2026-03-01 | sunday | 11 |
| 2026-05-23 | saturday | 9 |
| 2026-06-06 | saturday | 9 |
| 2026-01-18 | sunday | 8 |
| 2026-05-28 | thursday | 8 |
| 2026-08-10 | monday | 7 |
| 2026-10-11 | sunday | 7 |
| 2026-03-07 | saturday | 6 |

These are **service dates**, not civil feed dates. A source departure at 24:xx belongs to the following civil day; some patterns active under a September 4/6 service ID consequently occur outside those civil fixtures. Proposed review dates can overlap a fixture service date for this reason. Before building more civil feeds, account for both source-day tails and preceding-day carry-in. The dates identify declared service in the September 2 release, not independently observed historic operation. Calendar exceptions are not automatically classified as public holidays.

## Every annual route

“Seen” means an exact complete pattern appears in either existing fixture, regardless of its admission result. “Additional” means active within feed validity and absent from both fixtures. Existing rejected 604 patterns remain rejected. Each route ID is kept separately even when display line names coincide.

| Route ID | Agency / line | Mode | Annual trip records | Exact patterns | Seen | Additional | Additional parent sequences |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 91-1-A-j26-1 | Schweizerische Bundesbahnen SBB / S1 | rail | 2'268 | 452 | 77 | 375 | 24 |
| 91-2-C-j26-1 | Schweizerische Bundesbahnen SBB / S2 | rail | 343 | 68 | 11 | 57 | 0 |
| 91-2-G-j26-1 | Schweizerische Bundesbahnen SBB / IC2 | rail | 802 | 281 | 21 | 260 | 13 |
| 91-2-P-j26-1 | Schweizerische Bundesbahnen SBB / RE2 | rail | 72 | 6 | 0 | 6 | 2 |
| 91-21-D-j26-1 | Schweizerische Bundesbahnen SBB / IC21 | rail | 17 | 14 | 0 | 14 | 6 |
| 91-24-j26-1 | Schweizerische Bundesbahnen SBB / S24 | rail | 1'524 | 436 | 21 | 415 | 12 |
| 91-26-j26-1 | Schweizerische Bundesbahnen SBB / S26 | rail | 2'168 | 401 | 35 | 366 | 21 |
| 91-2A-Y-j26-1 | Schweizerische Bundesbahnen SBB / EC | rail | 682 | 152 | 16 | 136 | 11 |
| 91-2L-Y-j26-1 | Schweizerische Bundesbahnen SBB / RE | rail | 59 | 50 | 2 | 48 | 2 |
| 91-35-Y-j26-1 | Schweizerische Bundesbahnen SBB / IR | rail | 132 | 91 | 6 | 85 | 2 |
| 91-46-C-j26-1 | Schweizerische Bundesbahnen SBB / IR46 | rail | 28 | 18 | 2 | 16 | 1 |
| 91-46-j26-1 | Schweizerische Südostbahn (sob) / IR46 | rail | 678 | 207 | 18 | 189 | 6 |
| 91-5-C-j26-1 | Schweizerische Bundesbahnen SBB / S5 | rail | 1'177 | 200 | 20 | 180 | 15 |
| 91-5-G-j26-1 | Schweizerische Bundesbahnen SBB / SN5 | rail | 1 | 1 | 0 | 1 | 1 |
| 91-5F-Y-j26-1 | Schweizerische Bundesbahnen SBB / IC | rail | 227 | 96 | 4 | 92 | 10 |
| 91-5G-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | rail | 24 | 20 | 1 | 19 | 7 |
| 91-6-W-j26-1 | Schweizerische Bundesbahnen SBB / RE6 | rail | 68 | 24 | 3 | 21 | 2 |
| 91-70-A-j26-1 | Schweizerische Bundesbahnen SBB / IR70 | rail | 1'635 | 285 | 37 | 248 | 4 |
| 91-75-j26-1 | Schweizerische Bundesbahnen SBB / IR75 | rail | 1'602 | 446 | 43 | 403 | 15 |
| 91-A6-Y-j26-1 | Schweizerische Südostbahn (sob) / EXT | rail | 10 | 7 | 0 | 7 | 1 |
| 91-AI-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | rail | 8 | 8 | 0 | 8 | 6 |
| 91-AP-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | rail | 3 | 3 | 0 | 3 | 3 |
| 91-AS-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | rail | 1 | 1 | 0 | 1 | 1 |
| 91-AW-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | rail | 8 | 8 | 1 | 7 | 6 |
| 91-D8-Y-j26-1 | Schweizerische Bundesbahnen SBB / S | rail | 84 | 12 | 0 | 12 | 5 |
| 91-N7-j26-1 | Schweizerische Bundesbahnen SBB / N7 | rail | 134 | 89 | 5 | 84 | 8 |
| 91-VAE-j26-1 | Schweizerische Südostbahn (sob) / VAE | rail | 42 | 9 | 0 | 9 | 2 |
| 92-23-j26-1 | Verkehrsbetriebe Luzern AG / 23 | bus | 44 | 3 | 2 | 1 | 1 |
| 92-525-j26-1 | Zugerland Verkehrsbetriebe / 525 | bus | 108 | 2 | 2 | 0 | 0 |
| 92-526-j26-1 | Zugerland Verkehrsbetriebe / 526 | bus | 22 | 4 | 4 | 0 | 0 |
| 92-601-A-j26-1 | Zugerland Verkehrsbetriebe / 601 | bus | 382 | 2 | 2 | 0 | 0 |
| 92-602-A-j26-1 | Zugerland Verkehrsbetriebe / 602 | bus | 257 | 4 | 4 | 0 | 0 |
| 92-602-C-j26-1 | Zugerland Verkehrsbetriebe / 602 | bus | 1 | 1 | 1 | 0 | 0 |
| 92-603-B-j26-1 | Zugerland Verkehrsbetriebe / 603 | bus | 414 | 7 | 7 | 0 | 0 |
| 92-604-B-j26-1 | Zugerland Verkehrsbetriebe / 604 | bus | 348 | 6 | 4 | 2 | 2 |
| 92-605-A-j26-1 | Zugerland Verkehrsbetriebe / 605 | bus | 128 | 2 | 2 | 0 | 0 |
| 92-606-j26-1 | Zugerland Verkehrsbetriebe / 606 | bus | 392 | 9 | 9 | 0 | 0 |
| 92-607-j26-1 | Zugerland Verkehrsbetriebe / 607 | bus | 214 | 2 | 2 | 0 | 0 |
| 92-609-j26-1 | Zugerland Verkehrsbetriebe / 609 | bus | 192 | 8 | 8 | 0 | 0 |
| 92-610-A-j26-1 | Zugerland Verkehrsbetriebe / 610 | bus | 172 | 6 | 5 | 1 | 0 |
| 92-611-B-j26-1 | Zugerland Verkehrsbetriebe / 611 | bus | 764 | 13 | 7 | 6 | 6 |
| 92-612-C-j26-1 | Zugerland Verkehrsbetriebe / 612 | bus | 31 | 3 | 3 | 0 | 0 |
| 92-613-C-j26-1 | Zugerland Verkehrsbetriebe / 613 | bus | 325 | 2 | 2 | 0 | 0 |
| 92-614-j26-1 | Zugerland Verkehrsbetriebe / 614 | bus | 318 | 9 | 5 | 4 | 4 |
| 92-616-A-j26-1 | Zugerland Verkehrsbetriebe / 616 | bus | 62 | 3 | 3 | 0 | 0 |
| 92-619-j26-1 | Zugerland Verkehrsbetriebe / 619 | bus | 88 | 4 | 4 | 0 | 0 |
| 92-626-A-j26-1 | Zugerland Verkehrsbetriebe / 626 | bus | 8 | 1 | 1 | 0 | 0 |
| 92-627-j26-1 | Zugerland Verkehrsbetriebe / 627 | bus | 18 | 1 | 1 | 0 | 0 |
| 92-631-A-j26-1 | Zugerland Verkehrsbetriebe / 631 | bus | 250 | 6 | 6 | 0 | 0 |
| 92-632-j26-1 | Zugerland Verkehrsbetriebe / 632 | bus | 136 | 9 | 8 | 1 | 0 |
| 92-634-j26-1 | Zugerland Verkehrsbetriebe / 634 | bus | 248 | 5 | 4 | 1 | 0 |
| 92-636-j26-1 | Zugerland Verkehrsbetriebe / 636 | bus | 283 | 4 | 4 | 0 | 0 |
| 92-641-A-j26-1 | Zugerland Verkehrsbetriebe / 641 | bus | 350 | 3 | 3 | 0 | 0 |
| 92-642-j26-1 | Zugerland Verkehrsbetriebe / 642 | bus | 250 | 6 | 6 | 0 | 0 |
| 92-643-j26-1 | Zugerland Verkehrsbetriebe / 643 | bus | 362 | 6 | 6 | 0 | 0 |
| 92-648-j26-1 | Zugerland Verkehrsbetriebe / 648 | bus | 284 | 11 | 11 | 0 | 0 |
| 92-651-j26-1 | Zugerland Verkehrsbetriebe / 651 | bus | 176 | 2 | 2 | 0 | 0 |
| 92-652-A-j26-1 | Zugerland Verkehrsbetriebe / 652 | bus | 118 | 2 | 2 | 0 | 0 |
| 92-653-j26-1 | Zugerland Verkehrsbetriebe / 653 | bus | 314 | 6 | 6 | 0 | 0 |
| 92-A04-R-j26-1 | SBB Infrastruktur AG Bahnersatz / EV1 | bus | 10 | 5 | 0 | 5 | 5 |
| 92-A0A-N-j26-1 | SBB Infrastruktur AG Bahnersatz / EV2 | bus | 1 | 1 | 0 | 1 | 1 |
| 92-A0A-W-j26-1 | Zugerbergbahn / EV1 | bus | 36 | 2 | 0 | 2 | 2 |
| 92-EV1-Z-j26-1 | SBB Infrastruktur AG Bahnersatz / EV1 | bus | 203 | 12 | 2 | 10 | 9 |
| 92-EV2-S-j26-1 | SBB Infrastruktur AG Bahnersatz / EV2 | bus | 5 | 2 | 0 | 2 | 1 |
| 92-N1-D-j26-1 | Zugerland Verkehrsbetriebe / N1 | bus | 6 | 2 | 2 | 0 | 0 |
| 92-N2-D-j26-1 | Zugerland Verkehrsbetriebe / N2 | bus | 6 | 2 | 2 | 0 | 0 |
| 92-N3-E-j26-1 | Zugerland Verkehrsbetriebe / N3 | bus | 6 | 2 | 2 | 0 | 0 |
| 92-N4-C-j26-1 | Zugerland Verkehrsbetriebe / N4 | bus | 6 | 2 | 2 | 0 | 0 |
| 92-N5-A-j26-1 | Zugerland Verkehrsbetriebe / N5 | bus | 8 | 4 | 4 | 0 | 0 |
| 92-N6-A-j26-1 | Zugerland Verkehrsbetriebe / N6 | bus | 7 | 5 | 5 | 0 | 0 |
| 93-256-6-j26-1 | Zugerbergbahn / 2566 | mountain | 71 | 2 | 2 | 0 | 0 |
| 94-366-0-j26-1 | Schifffahrtsgesellschaft für den Zugersee AG / 3660 | boat | 10 | 8 | 8 | 0 | 0 |
| 94-366-1-j26-1 | Ägerisee Schifffahrt AG / 3661 | boat | 3 | 2 | 2 | 0 | 0 |
| 96-180-1-j26-1 | PostAuto AG / 280 | bus | 1'244 | 5 | 5 | 0 | 0 |
| 96-352-3-j26-1 | PostAuto AG / 73 | bus | 143 | 17 | 12 | 5 | 4 |
| 96-357-7-j26-1 | PostAuto AG / 110 | bus | 53 | 2 | 2 | 0 | 0 |
| 96-359-A-j26-1 | PostAuto AG / N73 | bus | 2 | 2 | 2 | 0 | 0 |

## Additional bus patterns

All **41** additional exact bus patterns are listed below in full stop order. The machine audit retains exact stop IDs and call rules as well as the original source-trip IDs; names here are for reading only. Active-date count and first/last dates do not imply continuous service between those dates. “Known parent sequence” remains a comparison, not geometry approval.

| Pattern ID (prefix) | Route / direction | Active service dates | First / last | Known parent sequence | Complete ordered calls |
| --- | --- | --- | --- | --- | --- |
| 12c40327cb4d3cd5 | 92-EV1-Z-j26-1 / 0 | 5 | 2026-04-13 / 2026-09-07 | no | Zug, Bahnhof/Damm → Baar, Bahnhof → Horgen Oberdorf, Bahnhof → Oberrieden Dorf, Bahnhof → Thalwil, Bahnhof |
| 15aea71d08e2de40 | 92-611-B-j26-1 / 0 | 4 | 2026-05-28 / 2026-05-31 | no | Zug, Eichwaldstrasse → Zug, Feldstrasse → Zug, Feldhof → Zug, Gartenstadt → Zug, Aabachstrasse → Zug, Dammstrasse/Bahnhof |
| 20aa7a8583a1d78d | 92-EV2-S-j26-1 / 0 | 1 | 2026-07-13 / 2026-07-13 | no | Schlieren, Zentrum/Bahnhof → Urdorf, Bahnhof-/Bergstrasse → Urdorf Weihermatt, Bahnhof → Birmensdorf ZH, Zentrum → Bonstetten-Wettswil, Bahnhof → Hedingen, Güpf → Affoltern a.A., Bahnhof → Mettmenstetten, Bahnhof → Knonau, Bahnhof → Steinhausen, Bahnhof → Steinhausen, Rigiweg → Zug, Bahnhof/Damm |
| 2e889b1a0c6c0ce3 | 96-352-3-j26-1 / 1 | 2 | 2026-02-12 / 2026-02-16 | no | Rotkreuz, Bahnhof Süd → Rotkreuz, Schulanlagen → Rotkreuz, Weidstrasse → Rotkreuz, Ibikon → Rotkreuz, Breitfeld → Meierskappel, Dorfplatz → Meierskappel, Käppelihof → Meierskappel, Feissenacher → Meierskappel, Robmatt → Udligenswil, Dreiangel → Udligenswil, Schützenmatt → Udligenswil, alte Post → Udligenswil, Frohsinn → Udligenswil, Neuheim → Udligenswil, Götzentalstrasse → Adligenswil, Chliäbnet → Adligenswil, Sagi → Adligenswil, Blatte → Adligenswil, Dorf → Adligenswil, Rigiblick → Adligenswil, Luegisland → Luzern, Hochhüsliweid → Luzern, Schädrütihalde → Luzern, Schlösslihalde → Luzern, Brüelstrasse → Luzern, Wey |
| 36cd4ff34ab3dc8f | 92-611-B-j26-1 / 1 | 4 | 2026-05-28 / 2026-05-31 | no | Zug, Dammstrasse/Bahnhof → Zug, Aabachstrasse → Zug, Gartenstadt → Zug, Feldhof → Zug, Feldstrasse → Zug, Eichwaldstrasse |
| 3733727109603d88 | 92-634-j26-1 / 1 | 50 | 2025-12-20 / 2026-12-12 | yes | Oberägeri, Station → Oberägeri, Fischmatt → Oberägeri, Lohmatt → Unterägeri, Buechli → Unterägeri, Seefeld → Unterägeri, Zentrum → Unterägeri, Zimmel → Unterägeri, Spinnerei → Neuägeri, Rössli → Neuägeri, Alte Post → Neuägeri, Schmittli → Allenwinden, St. Meinrad → Allenwinden, Dorf → Allenwinden, Grüt → Allenwinden, Egg → Allenwinden, Inkenberg → Baar, Moosrank (Höllgrotten) → Baar, Talacher → Baar, Geissbüel → Baar, Hof Himmelrich → Baar, Chriesimatt → Baar, Oberdorf → Baar, Kreuzplatz → Baar, Bahnhof |
| 39d165eddfd22cbc | 92-614-j26-1 / 0 | 40 | 2026-07-06 / 2026-08-14 | no | Zug, Gimenen → Zug, Hasenbüel → Zug, Meisenberg → Zug, Freudenberg → Zug, Roost → Zug, Athene → Zug, Bibliothek → Zug, Kolinplatz → Zug, Postplatz → Zug, Steinhof → Zug, Metalli/Bahnhof → Zug, Bleichi → Zug, Göbli → Inwil bei Baar, Ebel → Inwil bei Baar, Kirche → Inwil bei Baar, Zuwebe → Inwil bei Baar, Rigistrasse |
| 40ddd60834b92fc6 | 92-614-j26-1 / 0 | 34 | 2026-07-06 / 2026-08-14 | no | Zug, Metalli/Bahnhof → Zug, Bleichi → Zug, Göbli → Inwil bei Baar, Ebel → Inwil bei Baar, Kirche → Inwil bei Baar, Zuwebe → Inwil bei Baar, Rigistrasse |
| 420b91b70b1bb5c5 | 92-23-j26-1 / 0 | 24 | 2026-04-07 / 2026-05-08 | no | Ebikon, Bahnhof → Ebikon, Weichlen → Ebikon, Schindler → Ebikon, Fildern → Dierikon, Migros → Root D4, Oberfeld → Root, Wiesstrasse → Root, Ronmatt → Root, Dorf → Root, Wilweg → Root, Schlosshof → Gisikon-Root, Bahnhof → Gisikon, Weitblick → Honau, Hirschen → Rotkreuz, Industriestrasse → Rotkreuz, Ried → Rotkreuz, Forren → Holzhäusern ZG, St. Wendelin → Hünenberg, Seeblick → Hünenberg, Rothus |
| 556aae84521ce9de | 92-EV1-Z-j26-1 / 0 | 35 | 2026-03-29 / 2026-09-17 | no | Affoltern a.A., Bahnhof → Mettmenstetten, Bahnhof → Knonau, Bahnhof → Steinhausen, Bahnhof → Steinhausen, Rigiweg → Zug, Bahnhof/Damm |
| 5880cbde7050eabc | 92-EV2-S-j26-1 / 0 | 20 | 2026-07-14 / 2026-08-02 | no | Schlieren, Zentrum/Bahnhof → Urdorf, Bahnhof-/Bergstrasse → Urdorf Weihermatt, Bahnhof → Birmensdorf ZH, Zentrum → Bonstetten-Wettswil, Bahnhof → Hedingen, Güpf → Affoltern a.A., Bahnhof → Mettmenstetten, Bahnhof → Knonau, Bahnhof → Steinhausen, Bahnhof → Steinhausen, Rigiweg → Zug, Bahnhof/Damm |
| 612301baf2537e18 | 92-A0A-W-j26-1 / 1 | 9 | 2026-04-07 / 2026-07-10 | no | Zug, Schönegg → Zugerberg, Station |
| 656f23959849c77a | 92-EV1-Z-j26-1 / 0 | 3 | 2026-08-18 / 2026-08-20 | no | Birmensdorf ZH, Bahnhof → Bonstetten-Wettswil, Bahnhof → Hedingen, Güpf → Affoltern a.A., Bahnhof → Mettmenstetten, Bahnhof → Knonau, Bahnhof → Steinhausen, Bahnhof → Steinhausen, Rigiweg → Zug, Bahnhof/Damm |
| 6597951c044a4ba5 | 92-EV1-Z-j26-1 / 0 | 2 | 2026-02-28 / 2026-03-01 | no | Zug, Bahnhof/Damm → Baar, Bahnhof → Thalwil, Bahnhof |
| 6f7e7c8d1fecb417 | 92-EV1-Z-j26-1 / 1 | 2 | 2026-02-28 / 2026-03-01 | no | Baar, Bahnhof → Zug, Bahnhof/Damm |
| 6fef56f05b2388e5 | 92-611-B-j26-1 / 1 | 1 | 2026-05-31 / 2026-05-31 | no | Zug, Metalli/Bahnhof → Zug, Landis & Gyr/Bahnhof → Zug, Aabachstrasse → Zug, Stadion → Zug, St. Johannes |
| 783564b569f2373b | 92-611-B-j26-1 / 1 | 4 | 2026-05-28 / 2026-05-31 | no | Oberwil b. Zug,Klinik Zugersee → Oberwil b. Zug, Fuchsloch → Oberwil b. Zug, Leimatt → Oberwil b. Zug, Bahnhof → Oberwil b. Zug, Stolzengraben → Zug, Salesianum → Zug, Mänibach → Zug, Theater Casino → Zug, Kolinplatz → Zug, Postplatz → Zug, Steinhof → Zug, Metalli/Bahnhof → Zug, Landis & Gyr/Bahnhof → Zug, Aabachstrasse → Zug, Stadion → Zug, St. Johannes |
| 78d67825ba21c875 | 92-611-B-j26-1 / 0 | 4 | 2026-05-28 / 2026-05-31 | no | Zug, St. Johannes → Zug, Stadion → Zug, Aabachstrasse → Zug, Landis & Gyr/Bahnhof → Zug, Metalli/Bahnhof → Zug, Bundesplatz → Zug, Postplatz → Zug, Kolinplatz → Zug, Theater Casino → Zug, Mänibach → Zug, Salesianum → Oberwil b. Zug, Kreuz → Oberwil b. Zug, Widenstrasse → Oberwil b. Zug, Mülimatt → Oberwil b. Zug, Leimatt → Oberwil b. Zug, Fuchsloch → Oberwil b. Zug,Klinik Zugersee |
| 807234afea2de18e | 92-610-A-j26-1 / 1 | 50 | 2025-12-20 / 2026-12-12 | yes | Alosen, Raten → Alosen, Hundtal → Alosen, Giregg → Alosen, Dorf → Alosen, Schmidte → Oberägeri, Maienmatt → Oberägeri, Pfrundhaus → Oberägeri, Station |
| 86b0f7da28ae72c8 | 92-A04-R-j26-1 / 0 | 3 | 2026-01-26 / 2026-02-09 | no | Wohlen AG, Bahnhof → Boswil-Bünzen, Bahnhof → Muri AG, Bahnhof → Benzenschwil, Bahnhof → Mühlau, Dorf → Sins, Bahnhof → Oberrüti, Dorf → Rotkreuz, Bahnhof Nord |
| 8d59b33478e6cb8d | 92-EV1-Z-j26-1 / 1 | 7 | 2026-02-28 / 2026-09-06 | no | Thalwil, Bahnhof → Baar, Bahnhof → Zug, Bahnhof/Damm |
| 92c719e5ad8928fd | 96-352-3-j26-1 / 0 | 2 | 2026-02-12 / 2026-02-17 | no | Luzern, Luzernerhof → Luzern, Brüelstrasse → Luzern, Schlösslihalde → Luzern, Schädrütihalde → Luzern, Hochhüsliweid → Adligenswil, Luegisland → Adligenswil, Rigiblick → Adligenswil, Dorf → Adligenswil, Blatte → Adligenswil, Sagi → Adligenswil, Chliäbnet → Udligenswil, Götzentalstrasse → Udligenswil, Neuheim → Udligenswil, Frohsinn → Udligenswil, alte Post → Udligenswil, Schützenmatt → Udligenswil, Dreiangel → Meierskappel, Robmatt → Meierskappel, Feissenacher → Meierskappel, Käppelihof → Meierskappel, Dorfplatz → Rotkreuz, Breitfeld → Rotkreuz, Ibikon → Rotkreuz, Weidstrasse → Rotkreuz, Schulanlagen → Rotkreuz, Bahnhof Süd |
| 95af0e39e78941c7 | 92-EV1-Z-j26-1 / 0 | 4 | 2026-03-22 / 2026-03-25 | no | Schlieren, Zentrum/Bahnhof → Schlieren, Spital Limmattal → Birmensdorf ZH, Bahnhof → Bonstetten-Wettswil, Bahnhof → Hedingen, Güpf → Affoltern a.A., Bahnhof → Mettmenstetten, Bahnhof → Knonau, Bahnhof → Steinhausen, Bahnhof → Steinhausen, Rigiweg → Zug, Bahnhof/Damm |
| a49133748ee1894e | 92-614-j26-1 / 1 | 40 | 2026-07-06 / 2026-08-14 | no | Inwil bei Baar, Rigistrasse → Inwil bei Baar, Zuwebe → Inwil bei Baar, Kirche → Inwil bei Baar, Ebel → Zug, Göbli → Zug, Bleichi → Zug, Metalli/Bahnhof → Zug, Bundesplatz → Zug, Postplatz → Zug, Kolinplatz → Zug, Frauensteinmatt → Zug, Athene → Zug, Roost → Zug, Freudenberg → Zug, Meisenberg → Zug, Hasenbüel → Zug, Gimenen |
| b95668c2580a4d72 | 92-604-B-j26-1 / 1 | 2 | 2026-06-04 / 2026-12-08 | no | Inwil bei Baar, Rigistrasse → Zug, Oberallmend → Zug, Grienbach → Zug, V-Zug → Zug, Göbli → Zug, Bleichi → Zug, Metalli/Bahnhof → Zug, Bundesplatz → Zug, Bahnhofplatz |
| b9c349849d2f385d | 92-EV1-Z-j26-1 / 0 | 7 | 2026-04-17 / 2026-05-02 | no | Zug, Dammstrasse/Bahnhof → Steinhausen, Rigiweg → Steinhausen, Bahnhof → Knonau, Bahnhof → Mettmenstetten, Bahnhof → Affoltern a.A., Bahnhof |
| b9f110b16b2631b4 | 92-EV1-Z-j26-1 / 0 | 1 | 2026-08-17 / 2026-08-17 | no | Birmensdorf ZH, Bahnhof → Bonstetten-Wettswil, Bahnhof → Hedingen, Güpf → Affoltern a.A., Bahnhof → Mettmenstetten, Bahnhof → Knonau, Bahnhof → Steinhausen, Bahnhof → Steinhausen, Rigiweg → Zug, Bahnhof/Damm |
| bc2cbd636bea54dd | 92-604-B-j26-1 / 1 | 13 | 2025-12-16 / 2026-03-07 | no | Blickensdorf, Dorf → Blickensdorf, H. Waldmann-Str → Baar, Waldmannhalle → Baar, Früebergstrasse → Baar, Bahnmatt → Baar, Bahnhof → Baar, Rathaus → Baar, Kreuzplatz → Baar, Büelplatz → Baar, Grund → Inwil bei Baar, Rigistrasse → Zug, Oberallmend → Zug, Grienbach → Zug, V-Zug → Zug, Göbli → Zug, Bleichi → Zug, Metalli/Bahnhof → Zug, Bundesplatz → Zug, Stadion |
| c3a09a88a5ae1c82 | 92-A04-R-j26-1 / 0 | 5 | 2026-01-19 / 2026-04-27 | no | Wohlen AG, Bahnhof → Boswil-Bünzen, Bahnhof → Muri AG, Bahnhof → Benzenschwil, Bahnhof → Mühlau, Dorf → Sins, Bahnhof → Oberrüti, Bahnhof → Rotkreuz, Bahnhof Nord |
| c6c9de72d6d7457d | 96-352-3-j26-1 / 1 | 1 | 2026-02-17 / 2026-02-17 | no | Rotkreuz, Bahnhof Süd → Rotkreuz, Schulanlagen → Rotkreuz, Weidstrasse → Rotkreuz, Ibikon → Rotkreuz, Breitfeld → Meierskappel, Dorfplatz → Meierskappel, Käppelihof → Meierskappel, Feissenacher → Meierskappel, Robmatt → Udligenswil, Dreiangel → Udligenswil, Schützenmatt → Udligenswil, alte Post → Udligenswil, Frohsinn → Udligenswil, Neuheim → Udligenswil, Götzentalstrasse → Adligenswil, Chliäbnet → Adligenswil, Sagi → Adligenswil, Blatte → Adligenswil, Dorf → Adligenswil, Rigiblick → Adligenswil, Luegisland → Luzern, Hochhüsliweid → Luzern, Schädrütihalde → Luzern, Schlösslihalde → Luzern, Brüelstrasse → Luzern, Haldensteig → Luzern, Luzernerhof |
| d103990dd7f40430 | 92-EV1-Z-j26-1 / 1 | 35 | 2026-03-29 / 2026-09-17 | no | Zug, Bahnhof/Damm → Steinhausen, Rigiweg → Steinhausen, Bahnhof → Knonau, Bahnhof → Mettmenstetten, Bahnhof → Affoltern a.A., Bahnhof |
| db171f007ccb9414 | 92-632-j26-1 / 1 | 50 | 2025-12-20 / 2026-12-12 | yes | Menzingen, Moosstrasse → Menzingen, Weid → Menzingen, Dorf → Menzingen,Institut/Bernardapl. → Edlibach, Sonnhalde → Edlibach, Oberedlibach → Edlibach, Dorf → Neuheim, Falken → Neuheim, Felderhus → Neuheim, Dorf → Neuheim, Felderhus → Neuheim, Hinterburg → Neuheim, Baarburgrank → Baar, Paradies → Baar, Oberdorf → Baar, Bahnhof |
| db9bf096b614fd85 | 92-A0A-N-j26-1 / 1 | 2 | 2026-10-05 / 2026-10-12 | no | Muri AG, Bahnhof → Benzenschwil, Bahnhof → Mühlau, Dorf → Sins, Bahnhof → Oberrüti, Dorf → Oberrüti, Bahnhof → Rotkreuz, Bahnhof Nord |
| dd0da2feee1a6859 | 92-614-j26-1 / 1 | 40 | 2026-07-06 / 2026-08-14 | no | Inwil bei Baar, Rigistrasse → Inwil bei Baar, Zuwebe → Inwil bei Baar, Kirche → Inwil bei Baar, Ebel → Zug, Göbli → Zug, Bleichi → Zug, Metalli/Bahnhof |
| de89141434af7025 | 96-352-3-j26-1 / 0 | 2 | 2026-02-12 / 2026-02-16 | no | Luzern, Wey → Luzern, Brüelstrasse → Luzern, Schlösslihalde → Luzern, Schädrütihalde → Luzern, Hochhüsliweid → Adligenswil, Luegisland → Adligenswil, Rigiblick → Adligenswil, Dorf → Adligenswil, Blatte → Adligenswil, Sagi → Adligenswil, Chliäbnet → Udligenswil, Götzentalstrasse → Udligenswil, Neuheim → Udligenswil, Frohsinn → Udligenswil, alte Post → Udligenswil, Schützenmatt → Udligenswil, Dreiangel → Meierskappel, Robmatt → Meierskappel, Feissenacher → Meierskappel, Käppelihof → Meierskappel, Dorfplatz → Rotkreuz, Breitfeld → Rotkreuz, Ibikon → Rotkreuz, Weidstrasse → Rotkreuz, Schulanlagen → Rotkreuz, Bahnhof Süd |
| e67b8a5086141423 | 92-A04-R-j26-1 / 0 | 1 | 2026-10-18 / 2026-10-18 | no | Sins, Bahnhof → Oberrüti, Bahnhof → Rotkreuz, Bahnhof Nord |
| ea4d03e594457b35 | 92-A04-R-j26-1 / 0 | 1 | 2026-10-18 / 2026-10-18 | no | Muri AG, Bahnhof → Benzenschwil, Bahnhof → Mühlau, Dorf → Sins, Bahnhof → Oberrüti, Bahnhof → Rotkreuz, Bahnhof Nord |
| f0b53953078821ab | 92-A04-R-j26-1 / 1 | 1 | 2026-10-18 / 2026-10-18 | no | Rotkreuz, Bahnhof Nord → Oberrüti, Bahnhof → Sins, Bahnhof → Mühlau, Dorf → Benzenschwil, Bahnhof → Muri AG, Bahnhof |
| f1245aec8e22d436 | 96-352-3-j26-1 / 1 | 9 | 2026-05-18 / 2026-05-29 | yes | Rotkreuz, Bahnhof Süd → Rotkreuz, Schulanlagen → Rotkreuz, Weidstrasse → Rotkreuz, Ibikon → Rotkreuz, Breitfeld → Meierskappel, Dorfplatz → Meierskappel, Käppelihof → Meierskappel, Feissenacher → Meierskappel, Robmatt → Udligenswil, Dreiangel → Udligenswil, Schützenmatt → Udligenswil, alte Post → Udligenswil, Frohsinn → Udligenswil, Neuheim → Udligenswil, Götzentalstrasse → Adligenswil, Chliäbnet → Adligenswil, Sagi → Adligenswil, Blatte → Adligenswil, Dorf → Adligenswil, Rigiblick → Adligenswil, Luegisland → Luzern, Hochhüsliweid → Luzern, Schädrütihalde → Luzern, Schlösslihalde → Luzern, Brüelstrasse → Luzern, Haldensteig → Luzern, Schwanenplatz → Luzern, Bahnhof |
| f2e3275df71e00c8 | 92-611-B-j26-1 / 1 | 4 | 2026-05-28 / 2026-05-31 | no | Oberwil b. Zug,Klinik Zugersee → Oberwil b. Zug, Fuchsloch → Oberwil b. Zug, Leimatt → Oberwil b. Zug, Widenstrasse → Oberwil b. Zug, Kreuz → Zug, Salesianum → Zug, Mänibach → Zug, Theater Casino → Zug, Kolinplatz → Zug, Postplatz → Zug, Steinhof → Zug, Metalli/Bahnhof → Zug, Landis & Gyr/Bahnhof → Zug, Aabachstrasse → Zug, Stadion → Zug, St. Johannes |
| fab6a3749edc06a0 | 92-A0A-W-j26-1 / 0 | 9 | 2026-04-07 / 2026-07-10 | no | Zugerberg, Station → Zug, Schönegg |

## Preserved sources, dates and attribution

- [Annual source catalogue](../data/zug-annual-sources/sources.json): SHA-256 **54971b978ef4b0316bb73bfe22d93e5107a11ca796f08cfbaf2a4b7b9d3b8fb2**. CSV values are retained without changes; serialization and gzip encoding are deterministic. Each file records its retained and national row count, original ZIP entry size/CRC and retained-file SHA-256.
- [Annual machine audit](../data/zug-annual-audit.json.gz): every complete platform pattern, source trip/service membership, active dates, date counts, parent-station comparison, fixture admission results and proposed date assignments.
- [National GTFS archive](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip): release **20260902**, archive SHA-256 **d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e**. This is the same pinned archive used by the regional feed. It was reused from a verified local cache; preparation on September 9 is not a newer timetable release.
- [Official Zug boundary](../data/zug-sources/boundary.json): SHA-256 **6e0aaab028069c0843c8094e6d232f5a913d5324643a3307c59f3a09ebccedc2**. All national stop records are retained so the entire multipolygon census can be replayed offline; all 945 contained records and 620 annually called records agree with the original census.
- Credit: **SBB / opentransportdata.swiss**; [timetable reuse terms](https://opentransportdata.swiss/en/terms-of-use/). Polygon credit: **Quelle: GIS Kanton Zug**. The derived inventory is authored by Gleislicht. No new geometry is taken from these timetable files.

The extractor scans all **34'499'152 national stop-time rows**, without a route/operator whitelist, and then retains all **303'937 calls** belonging to the selected 22'676 annual trips. The second pass preserves full cross-canton and foreign journeys and makes no assumption about contiguous trip rows. The checker verifies every route's annual trip count and canton-stop membership against the original inventory, validates original call order/times, and reconstructs both complete civil fixtures.

## Reproduction and limits

Run from the repository root:

```sh
python3 scripts/prepare-zug-annual.py /path/to/gtfs_fp2026_20260902.zip data/zug-annual-sources
node scripts/review-zug-annual.mjs
node scripts/review-zug-annual.mjs --check
node scripts/write-zug-annual-audit.mjs
```

The first command requires the exact hash-pinned national ZIP; the remaining commands run entirely from retained local evidence. The existing regional checker remains the authority for the two emitted feeds. This annual inventory does not expand their geometry certification, authorize broader platform matching, establish current temporary stops or imply that every service operated as declared.
