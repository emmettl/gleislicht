# Aargau seasonal compatibility and release audit

Checked **8 September 2026**, following the [Aargau canton inventory and source adapter](AARGAU-STUDY.md). The twelve-date sample independently verifies **110,050 complete journeys and 1,821,846 calls** against pinned GTFS 20260902. It finds **1,146 directed patterns absent from the two September fixtures**, **12 newly active route records**, and **45 archived canton-calling routes still inactive on the sampled dates**.

**Application release checks have not passed.** September geometry and journeys replay exactly, but other sampled dates contain unresolved geometry and the bus comparison exposes source disagreements requiring itinerary review. No production feed, input hash, distance guard, date-scoped exception or application selection changed. These results measure compatibility with pinned geometry; they do not establish that an alignment applied historically or will apply on a future service date.

## Dates and complete-journey coverage

The sample covers winter weekdays/Sundays, Good Friday/Easter Sunday, summer weekdays/Sundays, National Day, autumn weekdays/Sundays and the final Friday of the timetable year. Every date includes intersecting preceding-service-day journeys. Full calls outside the canton and outside midnight are retained. All source calendar exceptions, identities, platform coordinates, boarding rules and shifted times passed the independent Python CSV/zip verifier. No frequency templates occur in these samples.

| Date | Journeys | Compatible segments | All segments | Coverage | New directed patterns | Unresolved occurrences |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-01-16 | 11,131 | 171,220 | 173,467 | 98.705% | 150 | 2,247 |
| 2026-01-18 | 7,634 | 117,954 | 120,454 | 97.925% | 196 | 2,500 |
| 2026-04-03 | 7,615 | 119,645 | 121,249 | 98.677% | 211 | 1,604 |
| 2026-04-05 | 7,631 | 119,996 | 121,416 | 98.830% | 166 | 1,420 |
| 2026-07-17 | 11,393 | 167,497 | 171,645 | 97.583% | 228 | 4,148 |
| 2026-07-19 | 7,847 | 116,745 | 119,376 | 97.796% | 247 | 2,631 |
| 2026-08-01 | 7,764 | 119,335 | 121,267 | 98.407% | 296 | 1,932 |
| 2026-09-04 | 11,193 | 173,106 | 173,106 | 100.000% | 0 | 0 |
| 2026-09-06 | 7,767 | 121,473 | 121,473 | 100.000% | 0 | 0 |
| 2026-10-23 | 11,193 | 173,185 | 173,323 | 99.920% | 123 | 138 |
| 2026-10-25 | 7,662 | 120,426 | 120,593 | 99.862% | 166 | 167 |
| 2026-12-11 | 11,220 | 174,265 | 174,427 | 99.907% | 121 | 162 |

Counts are adjacent calls over all complete retained journeys. New-pattern counts per day can overlap; the distinct union is 1,146. Compatibility uses one AGIS part/orientation per full pattern, the exact existing OSM route/platform/coordinate cache, and the existing FOT route/operating-point policy. Additional dates are diagnostic inputs only: the publication builder's September fixture hashes are unchanged. Brugg, Bern and Waldshut exceptions remain unavailable on other dates. A failure caused by that limited evidence is not proof that the physical line is absent.

**25 October is a wall-clock source-order test only.** The repeated local hour at the DST fallback is not disambiguated; that date is not delivered as an elapsed-time day feed. A September 2026 archive replayed on earlier dates is the publisher's archived schedule, not evidence of actual historical operation.

## Newly active archived routes

| GTFS route record | Operator / line | Sampled activity |
| --- | --- | --- |
| 91-26-E-j26-1 | Schweizerische Bundesbahnen SBB / RE26 | 2026-07-17: 1; 2026-07-19: 1 |
| 91-2H-Y-j26-1 | Schweizerische Bundesbahnen SBB / IC | 2026-10-25: 5 |
| 91-5F-Y-j26-1 | Schweizerische Bundesbahnen SBB / IC | 2026-04-03: 2 |
| 91-AP-Y-j26-1 | Schweizerische Bundesbahnen SBB / EXT | 2026-07-19: 2 |
| 92-A03-Z-j26-1 | Aargau Verkehr AG Ersatzverkehr / EV1 | 2026-07-19: 2 |
| 92-A04-O-j26-1 | SBB Infrastruktur AG Bahnersatz / EV1 | 2026-10-23: 6 |
| 92-A04-U-j26-1 | SBB Infrastruktur AG Bahnersatz / EV2 | 2026-10-23: 1 |
| 92-A09-0-j26-1 | Aargau Verkehr AG Ersatzverkehr / EV1 | 2026-07-17: 180; 2026-07-19: 119 |
| 92-A0A-N-j26-1 | SBB Infrastruktur AG Bahnersatz / EV2 | 2026-07-17: 46; 2026-07-19: 1 |
| 92-EV2-Z-j26-1 | SBB Infrastruktur AG Bahnersatz / EV2 | 2026-07-19: 8 |
| 92-EV3-B-j26-1 | SBB Infrastruktur AG Bahnersatz / EV3 | 2026-12-11: 32 |
| 94-370-0-j26-1 | Basler Personenschifffahrt AG / 3700 | 2026-08-01: 2 |

The [complete seasonal inventory](../data/aargau-seasonal/input/inventory.json) retains all 5,142 national routes, their archived canton membership and all twelve daily statuses. The [summary](../data/aargau-seasonal/summary.json) lists all 289 canton-calling route records, their geometry counts and the 45 still-inactive records. Inactivity in this sample is not discontinuation or an exclusion from the archived canton census.

## Geometry review priorities

The [release review](../data/aargau-seasonal/release-review.json) enumerates every unresolved date/pattern/adjacent-platform context, with original AGIS and fallback rejection reasons. Occurrence totals below sum sampled dates; they are not annual volumes.

| Review category | Missing sampled occurrences |
| --- | --- |
| bus-pattern-not-in-reviewed-road-cache | 16,364 |
| border-evidence-limited-to-september | 364 |
| platform-evidence-limited-to-september | 148 |
| rail-route-outside-reviewed-policy | 68 |
| rail:station-attachment-too-far | 3 |
| rail:no-exact-operating-point | 2 |

| Route record | Agency / line | Missing sampled occurrences |
| --- | --- | --- |
| 92-A09-0-j26-1 | 7244 / EV1 | 3,801 |
| 92-508-j26-1 | 793 / 508 | 3,443 |
| 92-72-j26-1 | 811 / 72 | 1,807 |
| 96-182-3-j26-1 | 801 / 215 | 1,287 |
| 92-A04-R-j26-1 | 7231 / EV1 | 766 |
| 96-165-4-j26-1 | 801 / 350 | 708 |
| 92-N90-j26-1 | 873 / N90 | 534 |
| 96-167-3-j26-1 | 801 / 357 | 530 |
| 92-83-j26-1 | 811 / 83 | 528 |
| 96-173-2-j26-1 | 801 / 245 | 448 |
| 92-N94-j26-1 | 873 / N94 | 430 |
| 91-36-j26-1 | 65 / S36 | 364 |

## AGIS and OSM alignment comparison

Every AGIS bus segment in the September audit was checked for an accepted comparator from the exact full-pattern road cache. The road cache was originally prepared for fallback patterns, so most AGIS-only contexts have no comparator. This absence is not an alignment failure. Symmetric vertex-to-polyline separation in approximate LV95 metres flags a disagreement over 30 m. It is direction-insensitive, can be zero for a reversed path, and cannot certify one-way legality, lanes, operating tracks or temporary diversions. Neither source wins automatically.

| Date | Within 30 m: contexts / occurrences | Over 30 m: contexts / occurrences | No comparator: contexts / occurrences |
| --- | --- | --- | --- |
| 2026-09-04 | 2,035 / 21,705 | 305 / 3,130 | 10,502 / 112,339 |
| 2026-09-06 | 1,375 / 17,485 | 211 / 2,256 | 6,217 / 67,896 |

There are **224 distinct directed route/platform pairs** flagged across both dates; individual patterns and dates remain separate in the detailed reports. The largest separations are:

| Agency / line | Directed stops | Maximum separation |
| --- | --- | --- |
| 801 / 136 | Gipf-Oberfrick, Rösslibrücke → Wölflinswil, Unterdorf | 1,556 m |
| 801 / 344 | Muri AG, Industriegebiet → Beinwil (Freiamt), Unterdorf | 1,448 m |
| 801 / 344 | Benzenschwil, Bahnhof → Beinwil (Freiamt), Unterdorf | 1,446 m |
| 801 / 358 | Baldingen, Unterdorf → Rekingen AG, Dorf | 832 m |
| 801 / 344 | Muri AG, Industriegebiet → Wallenschwil, Weiler | 507 m |
| 801 / 344 | Wallenschwil, Weiler → Muri AG, Industriegebiet | 502 m |
| 801 / 135 | Aarau, Bahnhof → Rombach, Rombacherhof | 461 m |
| 801 / 2 | Bad Zurzach, Uf Raine → Bad Zurzach, Thermalbad | 447 m |
| 801 / 368 | Schinznach Bad, Aquarena → Brugg AG, Wildischachen | 441 m |
| 840 / 4 | Aarau, Kettenbrücke → Aarau, Amthaus | 438 m |

The [comparison summary](../data/aargau-seasonal/alignment-review.json) binds both compressed per-context files to SHA-256 hashes. The ranked release review links each flag to its date and full directed pattern ID, so branch/short-working differences can be examined without replacing accepted geometry.

## Sources, reproduction and release

Source bytes, dates and attribution remain those in the [main source audit](AARGAU-STUDY.md): GTFS 20260902 (opentransportdata.swiss), AGIS 23 April 2026 (**Daten des Kantons Aargau**), swissBOUNDARIES3D 2026-01 (© swisstopo), OSM base/supplement extracts dated 2/8 September 2026 (© OpenStreetMap contributors, ODbL-1.0), and FOT infrastructure with catalogue date 6 July 2021 and asset update 18 January 2025. FOT current validity is unconfirmed. The Brugg and SBB Bern evidence and their exact dated scopes are preserved in the platform policy. No new source vintage is inferred from this audit's execution date.

All twelve compressed extracted timetables, the complete inventory and independent verification are retained under [input](../data/aargau-seasonal/input). Each compressed pattern report contains every full ordered platform chain, source feature/orientation, segment decision and distinct directed pair. September paths are compared byte-for-byte as arrays with the committed regional manifests. Other dates never receive September-only gap or platform exceptions. Source hashes, every recomputed path decision, occurrence totals and the diagnostic comparison are checked offline.

```sh
# Recreate the input from the original pinned 232 MB archive.
node --max-old-space-size=8192 scripts/inventory-aargau.mjs \
  --archive /path/GTFS_FP2026_20260902.zip --sources data/aargau-sources \
  --dates 2026-01-16,2026-01-18,2026-04-03,2026-04-05,2026-07-17,2026-07-19,2026-08-01,2026-09-04,2026-09-06,2026-10-23,2026-10-25,2026-12-11 \
  --output /tmp/aargau-seasonal-input
python3 scripts/verify-aargau-source.py /path/GTFS_FP2026_20260902.zip /tmp/aargau-seasonal-input

# Rebuild or replay the shipped audit; no network access is required.
node scripts/audit-aargau-seasonal.mjs
node scripts/check-aargau-seasonal.mjs
node scripts/review-aargau-alignments.mjs --check
node scripts/document-aargau-seasonal.mjs --check
node scripts/check-aargau-study.mjs
npx vitest run scripts/aargau-seasonal.test.mjs scripts/aargau-platform-geometry.test.mjs
```

Next work, recorded in the release review:

1. Review AGIS/OSM bus disagreements against dated operator itineraries and legal direction evidence; the 30 m diagnostic alone cannot choose the correct source.
2. Prepare and review exact missing seasonal bus patterns and rail route identities; retain all source calls and existing distance limits.
3. Review Brugg, Bern and Waldshut evidence separately before extending their September-only scope.
4. Find active witness dates for the 45 archived routes absent from all twelve samples; do not label them discontinued.
5. Disambiguate the repeated local hour before promoting 25 October as an elapsed-time feed.
6. Integrate reviewed fixtures into application study selection, date loading and attribution, then run browser release checks.
