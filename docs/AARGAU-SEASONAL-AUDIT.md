# Aargau seasonal compatibility and release audit

Checked **8 September 2026**, following the [Aargau canton inventory and source adapter](AARGAU-STUDY.md). The twelve-date sample independently verifies **110,050 complete journeys and 1,821,846 calls** against pinned GTFS 20260902. It finds **1,146 directed patterns absent from the two September fixtures**, **12 newly active route records**, and **45 archived canton-calling routes still inactive on the sampled dates**.

**Application release checks have not passed.** The additional bus cache fills **16,364 previously unresolved seasonal occurrences**, preserving every earlier path and complete journey. A separate finite policy fills **583 further occurrences**, leaving only the two Brig–Domodossola legs unresolved. The archived September feeds replay exactly. A separate [Friday review candidate](../fixtures/aargau-reviewed/2026-09-04/aargau-region-day-manifest.json) corrects one evidenced line 136 branch error; 223 distinct bus pairs still need alignment review. No original feed, publication input hash, general distance guard, September platform/border policy or application selection changed. These results measure compatibility with pinned geometry; they do not establish that an alignment applied historically or will apply on a future service date.

## Dates and complete-journey coverage

The sample covers winter weekdays/Sundays, Good Friday/Easter Sunday, summer weekdays/Sundays, National Day, autumn weekdays/Sundays and the final Friday of the timetable year. Every date includes intersecting preceding-service-day journeys. Full calls outside the canton and outside midnight are retained. All source calendar exceptions, identities, platform coordinates, boarding rules and shifted times passed the independent Python CSV/zip verifier. No frequency templates occur in these samples.

| Date | Journeys | Compatible segments | All segments | Coverage | New directed patterns | Unresolved occurrences |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-01-16 | 11,131 | 173,467 | 173,467 | 100.000% | 150 | 0 |
| 2026-01-18 | 7,634 | 120,454 | 120,454 | 100.000% | 196 | 0 |
| 2026-04-03 | 7,615 | 121,248 | 121,249 | 99.999% | 211 | 1 |
| 2026-04-05 | 7,631 | 121,416 | 121,416 | 100.000% | 166 | 0 |
| 2026-07-17 | 11,393 | 171,645 | 171,645 | 100.000% | 228 | 0 |
| 2026-07-19 | 7,847 | 119,376 | 119,376 | 100.000% | 247 | 0 |
| 2026-08-01 | 7,764 | 121,266 | 121,267 | 99.999% | 296 | 1 |
| 2026-09-04 | 11,193 | 173,106 | 173,106 | 100.000% | 0 | 0 |
| 2026-09-06 | 7,767 | 121,473 | 121,473 | 100.000% | 0 | 0 |
| 2026-10-23 | 11,193 | 173,323 | 173,323 | 100.000% | 123 | 0 |
| 2026-10-25 | 7,662 | 120,593 | 120,593 | 100.000% | 166 | 0 |
| 2026-12-11 | 11,220 | 174,427 | 174,427 | 100.000% | 121 | 0 |

Counts are adjacent calls over all complete retained journeys. New-pattern counts per day can overlap; the distinct union is 1,146. Compatibility uses one AGIS part/orientation per full pattern, the preserved OSM route/platform/coordinate caches plus a new twelve-date cache for missing bus patterns, the existing FOT route/operating-point policy, and 63 separately pinned seasonal gap rules. Additional dates are diagnostic inputs only: the publication builder's September fixture hashes are unchanged. The original Brugg, Bern and Waldshut exceptions retain their September-only scope. The separate seasonal policy admits only the reviewed exact date/full-coordinate patterns and preserves every previously matched path.

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
| rail:no-exact-operating-point | 2 |

| Route record | Agency / line | Missing sampled occurrences |
| --- | --- | --- |
| 91-29-Y-j26-1 | 11 / IC | 2 |

## AGIS and OSM alignment comparison

Every AGIS bus segment in the September audit was checked for an accepted comparator from the exact full-pattern road cache. The road cache was originally prepared for fallback patterns, so most AGIS-only contexts have no comparator. This absence is not an alignment failure. Symmetric vertex-to-polyline separation in approximate LV95 metres flags a disagreement over 30 m. It is direction-insensitive, can be zero for a reversed path, and cannot certify one-way legality, lanes, operating tracks or temporary diversions. Neither source wins automatically.

| Date | Within 30 m: contexts / occurrences | Over 30 m: contexts / occurrences | No comparator: contexts / occurrences |
| --- | --- | --- | --- |
| 2026-09-04 | 2,035 / 21,705 | 305 / 3,130 | 10,502 / 112,339 |
| 2026-09-06 | 1,375 / 17,485 | 211 / 2,256 | 6,217 / 67,896 |

There were **224 distinct directed route/platform pairs** flagged across both archived dates; a reviewed correction is available for one and **223 remain pending**; individual patterns and dates remain separate in the detailed reports. The largest separations are:

| Agency / line | Directed stops | Maximum separation |
| --- | --- | --- |
| 801 / 344 | Muri AG, Industriegebiet → Beinwil (Freiamt), Unterdorf | 1,448 m |
| 801 / 344 | Benzenschwil, Bahnhof → Beinwil (Freiamt), Unterdorf | 1,446 m |
| 801 / 358 | Baldingen, Unterdorf → Rekingen AG, Dorf | 832 m |
| 801 / 344 | Muri AG, Industriegebiet → Wallenschwil, Weiler | 507 m |
| 801 / 344 | Wallenschwil, Weiler → Muri AG, Industriegebiet | 502 m |
| 801 / 135 | Aarau, Bahnhof → Rombach, Rombacherhof | 461 m |
| 801 / 2 | Bad Zurzach, Uf Raine → Bad Zurzach, Thermalbad | 447 m |
| 801 / 368 | Schinznach Bad, Aquarena → Brugg AG, Wildischachen | 441 m |
| 840 / 4 | Aarau, Kettenbrücke → Aarau, Amthaus | 438 m |
| 840 / 6 | Aarau, Kettenbrücke → Aarau, Amthaus | 438 m |

The [comparison summary](../data/aargau-seasonal/alignment-review.json) binds both compressed per-context files to SHA-256 hashes. The ranked release review links each flag to its date and full directed pattern ID, so branch/short-working differences can be examined without replacing accepted geometry.

## Reviewed line 136 correction

The [correction policy](../data/aargau-alignment-policy.json) selects one exact Friday full pattern and its Gipf-Oberfrick, Rösslibrücke → Wölflinswil, Unterdorf segment. AGIS feature 43 follows the unserved Wittnau branch for **6,926.9 m**; pinned GTFS allows three minutes, implying **138.5 km/h**. The official timetable field 50.136 (3 December 2025, page 2, course 36051) and operator network map show the separate direct working. The timetable PDF is an earlier version: it has 11:48–11:51 where September GTFS has 11:50–11:53. Both allocate three minutes; no GTFS call time is changed.

The replacement uses the already accepted full-pattern OSM bypass, **3,586.8 m** and an implied **71.7 km/h**. It remains an infrastructure inference. The policy pins exact agency, route, direction, full platform IDs/coordinates, date, segment index and both old/new path hashes. It cannot apply to another date or a changed source path. The [candidate regression](../data/aargau-seasonal/alignment-correction-regression.json) verifies all 11,193 original journeys, 173,105 unchanged segment occurrences and exactly one corrected occurrence. The archived Friday fixture and seasonal September replay are preserved; the corrected candidate is separate pending the remaining release reviews.

The two largest line 344 disagreements were also examined against field 50.344 (7 November 2025, page 1) and the Freiamt map. Those sources distinguish early direct, Benzenschwil spur and school workings, but do not by themselves settle the exact road used on every sparse-stop variant. They are retained as unresolved leads, not automatically replaced.

## Seasonal road-cache evidence

The [new source bundle](../data/aargau-seasonal-roads/source.json) contains 460 complete routing patterns across 14 agencies, with all original matcher outputs and warnings compressed for offline replay. It uses the same pinned OSM extract, pfaedle binary and configuration as the earlier cache; no threshold changes were made. The three PostAuto rejected hops and 76 cross-border matcher rejections remain null in this cache; preserved earlier caches or date-scoped evidence handle already resolved contexts. All 16,364 newly covered occurrences were prior gaps, including all 3,801 AVA EV1 summer replacement-bus occurrences missing from the old cache. This supplies geometric compatibility, not proof of the actual 2026 replacement-bus diversion.

## Scoped seasonal border, platform and rail review

The [seasonal gap policy](../data/aargau-seasonal-gap-policy.json) pins **63 exact date/full-pattern rules** and 583 additional occurrences: **364 Koblenz–Waldshut, 144 Brugg service-loop, seven Bern platform 49 and 68 on four additional SBB route records**. It binds the complete platform coordinates, route/agency/direction, segment indices, path hashes, source evidence and input hashes. It runs only in this compatibility audit after all earlier sources fail. The regression replays all prior geometry before applying these rules and verifies every earlier path remains identical.

The official [field 50.368](https://widgets.oev-info.ch/publikation/jahresfpl/50.368.pdf), dated **7 November 2025**, was archived and visually checked on page 1. It distinguishes the Wildischachen–Aare AG–Aquarena workings from the shorter variant. All four additional weekday coordinate chains equal the original reviewed Brugg pattern; the same ordered OSM relation and unchanged projection guards apply. This is dated itinerary evidence, not a date for the OSM geometry.

All seven selected Bern arrivals have the identical Baden–Brugg–Aarau–Olten–Bern tail. Zürich departure platforms 15, 17 and 18 are separately pinned. The [SBB station description](https://www.sbb.ch/en/travel-information/stations/find-station/bern-station/bern-station-description.html) corroborates the western platform extension; the exact FOT terminal segment still supplies the short 33.9 m projection. The undated description was rechecked on 8 September and does not certify historical track use.

[Thurbo's May 2026 notice](https://www.thurbo.ch/erkunden/ausblick/thurboleben/ki-baustellen/) was rechecked: the announced S36 crossing closure is **14 September–2 October**. All ten additional selected dates lie outside that interval. The entire ordered pattern must match one AGIS feature 364 part before either exact border pair is sliced. The closure interval is explicitly blocked as well as unselected dates; this is not a blanket date-range extension.

The four SBB identities are **91-26-E-j26-1 (RE26 Basel–Luzern), 91-5F-Y-j26-1 (IC Olten–Lugano via Freiamt), 91-2H-Y-j26-1 (IC Zürich–Lausanne/Genève-Aéroport) and 91-AP-Y-j26-1 (EXT Mühlau–Luzern in both directions)**. Nine complete patterns pass the same exact unique operating points, ordered source topology, 350 m station attachment, 120 m topology attachment and detour guards. These paths remain infrastructure inferences; admitting an exact source route ID does not certify its running tracks.

The **two remaining occurrences**, on 3 April and 1 August, are Brig platform 6 → Domodossola (I), route 91-29-Y-j26-1. The pinned FOT network has no operating point **8301003** or Domodossola node. Both complete journeys remain in the audit with their final path null. A nearby Swiss boundary point cannot stand in for the Italian destination; foreign geometry and exact identity evidence are still required.

## Sources, reproduction and release

Source bytes, dates and attribution remain those in the [main source audit](AARGAU-STUDY.md): GTFS 20260902 (opentransportdata.swiss), AGIS 23 April 2026 (**Daten des Kantons Aargau**), swissBOUNDARIES3D 2026-01 (© swisstopo), OSM base/supplement extracts dated 2/8 September 2026 (© OpenStreetMap contributors, ODbL-1.0), and FOT infrastructure with catalogue date 6 July 2021 and asset update 18 January 2025. FOT current validity is unconfirmed. The original Brugg and SBB Bern evidence and dated scopes remain in the platform policy. The separate seasonal policy adds the archived annual line 368 timetable and the explicitly bounded review above; original AGIS, OSM and FOT vintages and attributions remain unchanged. No new source vintage is inferred from this audit's execution date.

All twelve compressed extracted timetables, the complete inventory and independent verification are retained under [input](../data/aargau-seasonal/input). Each compressed pattern report contains every full ordered platform chain, source feature/orientation, segment decision and distinct directed pair. September paths are compared byte-for-byte as arrays with the committed regional manifests. Other dates receive only their separately reviewed seasonal rules; September-only policies remain unchanged. Source hashes, every recomputed path decision, occurrence totals and the diagnostic comparison are checked offline.

```sh
# Recreate the input from the original pinned 232 MB archive.
node --max-old-space-size=8192 scripts/inventory-aargau.mjs \
  --archive /path/GTFS_FP2026_20260902.zip --sources data/aargau-sources \
  --dates 2026-01-16,2026-01-18,2026-04-03,2026-04-05,2026-07-17,2026-07-19,2026-08-01,2026-09-04,2026-09-06,2026-10-23,2026-10-25,2026-12-11 \
  --output /tmp/aargau-seasonal-input
python3 scripts/verify-aargau-source.py /path/GTFS_FP2026_20260902.zip /tmp/aargau-seasonal-input

# Prepare the twelve-date bus union and run the pinned matcher for each agency.
node scripts/prepare-aargau-roads.mjs --input data/aargau-seasonal/input --sources data/aargau-sources --crosswalk data/aargau-line-crosswalk.json --output /tmp/aargau-seasonal-road-feeds
for agency in 723 7231 7244 793 801 811 812 839 840 849 873 886 899 sbg034; do
  node scripts/match-postbus-roads.mjs --pfaedle /path/pfaedle --config /path/pfaedle.cfg --osm /path/pinned-postbus-roads.osm.pbf --feed /tmp/aargau-seasonal-road-feeds/$agency --output /tmp/aargau-seasonal-road-matched/$agency
done
node scripts/aargau-seasonal-roads.mjs /tmp/aargau-seasonal-road-feeds /tmp/aargau-seasonal-road-matched

# Rebuild the correction policy from the archived evidence and the review candidate.
node scripts/prepare-aargau-alignment-policy.mjs
node scripts/build-aargau-study.mjs --sources data/aargau-sources --inventory data/aargau --crosswalk data/aargau-line-crosswalk.json --road-cache data/aargau-road-cache.json --road-supplement data/aargau-rheinfelden-road-cache.json --rail-sources data/aargau-rail-sources --rail-policy data/aargau-rail-policy.json --platform-fixes --alignment-policy data/aargau-alignment-policy.json --date 2026-09-04 --output fixtures/aargau-reviewed/2026-09-04
node scripts/check-aargau-reviewed.mjs --write

# Rebuild or replay the shipped audit; no network access is required.
node scripts/prepare-aargau-seasonal-gaps.mjs --check
node scripts/audit-aargau-seasonal.mjs
node scripts/check-aargau-seasonal.mjs
node scripts/aargau-seasonal-roads.mjs --check
node scripts/check-aargau-reviewed.mjs
node scripts/review-aargau-alignments.mjs --check
node scripts/document-aargau-seasonal.mjs --check
node scripts/check-aargau-study.mjs
npx vitest run scripts/aargau-seasonal.test.mjs scripts/aargau-platform-geometry.test.mjs scripts/aargau-alignment-corrections.test.mjs
```

Next work, recorded in the release review:

1. Review AGIS/OSM bus disagreements against dated operator itineraries and legal direction evidence; the 30 m diagnostic alone cannot choose the correct source.
2. Acquire exact cross-border geometry and operating-point evidence for the two remaining Brig–Domodossola occurrences. All 16,364 seasonal bus-cache gaps and 583 scoped border/platform/new-route gaps are now filled without replacing prior paths.
3. Find active witness dates for the 45 archived routes absent from all twelve samples; do not label them discontinued.
4. Disambiguate the repeated local hour before promoting 25 October as an elapsed-time feed.
5. Integrate reviewed fixtures into application study selection, date loading and attribution, then run browser release checks.
