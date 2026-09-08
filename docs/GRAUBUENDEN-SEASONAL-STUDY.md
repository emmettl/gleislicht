# Graubünden: twelve-date seasonal timetable inventory

This is an **audit-only** expansion of the same pinned 20260902 national timetable and complete Graubünden canton polygon. It preserves all **380 annual route records**, **67 agency identities** and **79,029 annual source trip records**. The application still offers only **4 and 6 September 2026**. No additional seasonal geometry has been admitted.

[Seasonal summary and all route counts](../data/graubuenden-audit/seasonal-summary.json) · [Complete pattern audit, gzip](../data/graubuenden-audit/seasonal-patterns.json.gz) · [Source validation](../data/graubuenden-audit/seasonal-validation.json) · [Original study and reuse terms](GRAUBUENDEN-STUDY.md)

The sample covers winter Friday/Sunday, Good Friday/Easter Sunday, summer Friday/Sunday, Swiss National Day, the two released September dates, late October Friday/Sunday and the last Friday before the annual timetable change. These are twelve samples, not daily validation of the whole timetable year. **58** of the 87 route records inactive on both September fixtures become active on at least one other sample; **29** remain inactive on all twelve. No claim of permanent closure or absent service follows from inactivity.

## Full candidate counts

“Reviewed match” means exact route, direction, ordered platform and pickup/drop-off-rule identity with an admitted September pattern. It is a candidate for reusing that geometry after seasonal review, not an admission. “Known exclusion” matches a rejected September pattern, including unsupported modes. “New pattern” has no September pattern identity and needs review. All categories retain headway representatives and preceding-service-day carry-ins in their totals.

| Date | Journeys | Patterns | Reviewed match | Known exclusion | New pattern | Headway representatives | Carry-ins |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-01-16 | 42'656 | 1'644 | 5'663 | 27'644 | 9'349 | 24'063 | 128 |
| 2026-01-18 | 41'337 | 1'382 | 4'181 | 27'702 | 9'454 | 24'123 | 264 |
| 2026-04-03 | 26'815 | 1'279 | 4'463 | 14'323 | 8'029 | 20'007 | 213 |
| 2026-04-05 | 26'850 | 1'292 | 4'503 | 14'326 | 8'021 | 20'007 | 263 |
| 2026-07-17 | 39'744 | 1'450 | 6'462 | 33'068 | 214 | 18'440 | 79 |
| 2026-07-19 | 38'852 | 1'279 | 5'405 | 33'320 | 127 | 18'620 | 235 |
| 2026-08-01 | 39'272 | 1'302 | 5'421 | 33'693 | 158 | 18'636 | 225 |
| 2026-09-04 | 39'402 | 1'567 | 6'696 | 32'706 | 0 | 18'078 | 86 |
| 2026-09-06 | 38'425 | 1'292 | 5'471 | 32'954 | 0 | 18'258 | 242 |
| 2026-10-23 | 15'118 | 1'318 | 6'017 | 8'777 | 324 | 8'856 | 88 |
| 2026-10-25 | 13'981 | 1'125 | 4'842 | 8'843 | 296 | 8'910 | 235 |
| 2026-12-11 | 11'766 | 1'351 | 6'006 | 5'426 | 334 | 5'458 | 83 |

There are no prior-arrangement-call instances in these twelve samples; the explicit status and exclusion rule remain in the audit. Headway instances with exact_times=0 describe interval-grid representatives, not exact departures. Large differences between dates include frequency-based mountain services and seasonal calendars; candidate movement counts must not be interpreted as observed vehicle counts.

## Completeness and limits

An independent validation rereads the pinned national ZIP, checks its SHA-256, streams all **34'499'152 stop-time rows**, and verifies **374'218** emitted complete journey instances against **45'228** distinct original trip records. It checks calendar additions/removals, original route/direction, every ordered call and sequence, every original time and call rule, carry-in offsets and interval-anchored frequency grids. September snapshots must exactly equal the original source snapshots, and annual route identities and polygon stop sets must remain identical. The validation certifies the emitted records against source evidence; twelve samples cannot establish daily annual coverage.

The cache uses service-day seconds and the established fixed civil-day carry-in offsets. **25 October 2026 is the daylight-saving fall-back date**: the repeated local hour is not disambiguated into elapsed-time instants. That fixture is a timetable-pattern inventory only; neither a 25-hour animation nor observed chronological motion is claimed. All extra dates remain audit-only. Winter road closures, ski shuttle operation, pass access, temporary diversions, current rail alignment and physical direction require separate dated evidence before geometry reuse.

## Routes newly active outside the released fixtures

Every route remains in the machine-readable 380-route inventory, including all zero counts. This table identifies all 58 newly observed active records; maximum counts are from the twelve samples and do not imply daily service.

| Route | Agency | Mode / line | Active samples | Maximum journeys in a sample |
| --- | --- | --- | ---: | ---: |
| 91-1-L-j26-1 | 72 / Rhätische Bahn | rail / 1 | 1 | 1 |
| 91-46-B-j26-1 | 48 / Matterhorn Gotthard Bahn (fo) | rail / R46 | 4 | 26 |
| 91-EV-Y-j26-1 | 82 / Schweizerische Südostbahn (sob) | rail / EXT | 1 | 1 |
| 92-305-E-j26-1 | 740 / Verkehrsbetrieb der Landschaft Davos | bus / 305 | 2 | 36 |
| 92-39-B-j26-1 | 766 / Bus und Service AG (Chur) | bus / 39 | 1 | 7 |
| 92-43-j26-1 | 3042 / Sesselbahn Fatschel - Triemel | bus / 43 | 2 | 7 |
| 92-570-j26-1 | 72 / Rhätische Bahn | bus / 570 | 2 | 1 |
| 92-614-A-j26-1 | 9028 / Gemeinde Celerina/Schlarigna | bus / 614 | 4 | 15 |
| 92-615-B-j26-1 | 9028 / Gemeinde Celerina/Schlarigna | bus / 615 | 4 | 20 |
| 92-621-A-j26-1 | 3183 / Schiffahrtsunternehmung Silsersee | bus / 621 | 4 | 27 |
| 92-EV-H-j26-1 | 232 / Rhäzüns-Feldis/Veulden | bus / EV | 2 | 16 |
| 92-EV1-0-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV10 | 1 | 34 |
| 92-WEF-A-j26-1 | 740 / Verkehrsbetrieb der Landschaft Davos | bus / WEF-Rot | 1 | 129 |
| 92-WEF-B-j26-1 | 740 / Verkehrsbetrieb der Landschaft Davos | bus / WEF-Gelb | 1 | 100 |
| 93-287-0-j26-1 | 224 / Sportbahnen Pischa | mountain / 2870 | 2 | 61 |
| 93-290-8-j26-1 | 251 / Andermatt-Sedrun Sport AG | mountain / 2908 | 4 | 900 |
| 93-56-Y-j26-1 | 3152 / Bergbahnen Piz Mundaun AG | mountain / SL | 4 | 900 |
| 93-57-Y-j26-1 | 230 / Savognin-Bergbahnen AG | mountain / GB | 4 | 900 |
| 93-58-Y-j26-1 | 3148 / Bergbahnen Piz Mundaun AG | mountain / SL | 4 | 900 |
| 93-5C-Y-j26-1 | 3146 / Bergbahnen Obersaxen AG | mountain / SL | 4 | 870 |
| 93-5J-Y-j26-1 | 3148 / Bergbahnen Piz Mundaun AG | mountain / SL | 4 | 840 |
| 93-5K-Y-j26-1 | 336 / Bergün Filisur Tourismus AG | mountain / SL | 2 | 840 |
| 93-5L-Y-j26-1 | 3152 / Bergbahnen Piz Mundaun AG | mountain / SL | 4 | 840 |
| 93-6F-Y-j26-1 | 247 / Curtinatsch-Piz Lagalb | mountain / PB | 4 | 96 |
| 93-6X-Y-j26-1 | 207 / Davos Klosters Bergbahnen (bbbj) | mountain / PB | 4 | 65 |
| 93-6Z-Y-j26-1 | 147 / Bergbahnen Engadin St. Moritz AG | mountain / FUN | 4 | 76 |
| 93-70-Y-j26-1 | 207 / Davos Klosters Bergbahnen (bbbj) | mountain / PB | 4 | 64 |
| 93-76-Y-j26-1 | 147 / Bergbahnen Engadin St. Moritz AG | mountain / FUN | 4 | 72 |
| 93-8F-Y-j26-1 | 109 / Davos Klosters Bergbahnen (dpb) | mountain / PB | 4 | 58 |
| 93-8T-Y-j26-1 | 329 / Bergbahnen Disentis | mountain / PB | 4 | 31 |
| 93-8U-Y-j26-1 | 329 / Bergbahnen Disentis | mountain / PB | 4 | 33 |
| 96-263-4-j26-1 | 801 / PostAuto AG | bus / 570 | 1 | 2 |
| 96-264-4-j26-1 | 801 / PostAuto AG | bus / 113 | 4 | 27 |
| 96-264-5-j26-1 | 801 / PostAuto AG | bus / 112 | 4 | 21 |
| 96-264-6-j26-1 | 801 / PostAuto AG | bus / 114 | 4 | 41 |
| 96-264-7-j26-1 | 801 / PostAuto AG | bus / 115 | 4 | 12 |
| 96-264-8-j26-1 | 801 / PostAuto AG | bus / 116 | 4 | 8 |
| 96-264-9-j26-1 | 801 / PostAuto AG | bus / 117 | 4 | 20 |
| 96-265-0-j26-1 | 801 / PostAuto AG | bus / 131 | 4 | 35 |
| 96-265-1-j26-1 | 801 / PostAuto AG | bus / 124 | 4 | 10 |
| 96-265-3-j26-1 | 801 / PostAuto AG | bus / 122 | 4 | 12 |
| 96-265-5-j26-1 | 801 / PostAuto AG | bus / 582 | 4 | 27 |
| 96-269-5-j26-1 | 801 / PostAuto AG | bus / 237 | 4 | 14 |
| 96-269-9-j26-1 | 801 / PostAuto AG | bus / 235 | 4 | 71 |
| 96-276-F-j26-1 | 801 / PostAuto AG | bus / 411 | 3 | 2 |
| 96-280-A-j26-1 | 801 / PostAuto AG | bus / 401 | 3 | 24 |
| 96-281-0-j26-1 | 801 / PostAuto AG | bus / 452 | 4 | 27 |
| 96-281-3-j26-1 | 801 / PostAuto AG | bus / 427 | 4 | 2 |
| 96-281-7-j26-1 | 801 / PostAuto AG | bus / 542 | 3 | 36 |
| 96-281-8-j26-1 | 801 / PostAuto AG | bus / 462 | 2 | 23 |
| 96-291-A-j26-1 | 801 / PostAuto AG | bus / 631 | 2 | 2 |
| 96-292-A-j26-1 | 801 / PostAuto AG | bus / 702 | 2 | 5 |
| 96-300-A-j26-1 | 801 / PostAuto AG | bus / 922 | 2 | 18 |
| 96-305-2-j26-1 | 801 / PostAuto AG | bus / 952 | 5 | 85 |
| 96-305-5-j26-1 | 801 / PostAuto AG | bus / 901 | 4 | 32 |
| 96-305-6-j26-1 | 801 / PostAuto AG | bus / 902 | 4 | 25 |
| 96-306-6-j26-1 | 801 / PostAuto AG | bus / 831 | 2 | 2 |
| 96-500-1-j26-1 | 801 / PostAuto AG | bus / 232 | 2 | 54 |

## Records inactive on all twelve samples

| Route | Agency | Mode / line |
| --- | --- | --- |
| 91-1-J-j26-1 | 72 / Rhätische Bahn | rail / RE1 |
| 91-15-M-j26-1 | 72 / Rhätische Bahn | rail / 15 |
| 91-1B-Y-j26-1 | 11 / Schweizerische Bundesbahnen SBB | rail / IC |
| 91-1H-Y-j26-1 | 65 / THURBO | rail / RE |
| 91-3-P-j26-1 | 11 / Schweizerische Bundesbahnen SBB | rail / 3 |
| 91-35-C-j26-1 | 82 / Schweizerische Südostbahn (sob) | rail / RE35 |
| 91-3O-Y-j26-1 | 72 / Rhätische Bahn | rail / EXT |
| 91-47-Y-j26-1 | 65 / THURBO | rail / S |
| 91-6-U-j26-1 | 72 / Rhätische Bahn | rail / R6 |
| 91-8J-Y-j26-1 | 11 / Schweizerische Bundesbahnen SBB | rail / EXT |
| 91-9B-Y-j26-1 | 11 / Schweizerische Bundesbahnen SBB | rail / EXT |
| 92-A00-D-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV15 |
| 92-A00-E-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV13 |
| 92-A00-V-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV4 |
| 92-A01-5-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV11 |
| 92-A03-2-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV13 |
| 92-A04-T-j26-1 | 7231 / SBB Infrastruktur AG Bahnersatz | bus / EV2 |
| 92-EV1-6-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV16 |
| 92-EV1-X-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV1 |
| 92-EV2-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV2 |
| 92-EV3-X-j26-1 | 7231 / SBB Infrastruktur AG Bahnersatz | bus / EV3 |
| 92-EV5-U-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV5 |
| 92-EV5-W-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV5 |
| 92-EV6-P-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV6 |
| 92-EV7-Q-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV7 |
| 92-EV7-U-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV7 |
| 92-EV8-L-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV8 |
| 92-EV9-G-j26-1 | 7250 / Rhätische Bahn Ersatzverkehr | bus / EV9 |
| 96-278-6-j26-1 | 801 / PostAuto AG | bus / 434 |

## Reproduction and attribution

Timetable: **SBB / opentransportdata.swiss**, under the [platform terms](https://opentransportdata.swiss/en/terms-of-use/); boundary: **© swisstopo**, under its [open geodata terms](https://www.swisstopo.admin.ch/de/nutzungsbedingungen-kostenlose-geodaten-und-geodienste). This is a deliberately dated research archive, not a current journey planner. The pattern comparison references the separately attributed FOT/OSM September study; it adds no new seasonal geometry database.

```sh
node --max-old-space-size=8192 scripts/prepare-graubuenden-seasonal.mjs /private/tmp/GTFS_FP2026_20260902.zip
node --max-old-space-size=8192 scripts/graubuenden-seasonal.mjs
node --max-old-space-size=8192 scripts/check-graubuenden-seasonal.mjs /private/tmp/GTFS_FP2026_20260902.zip
node scripts/document-graubuenden-expansion.mjs
```
