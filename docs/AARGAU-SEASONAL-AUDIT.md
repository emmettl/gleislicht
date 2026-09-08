# Aargau seasonal compatibility and release audit

Checked **8 September 2026**, following the [Aargau canton inventory and source adapter](AARGAU-STUDY.md). The twelve-date sample independently verifies **110,050 complete journeys and 1,821,846 calls** against pinned GTFS 20260902. It finds **1,146 directed patterns absent from the two September fixtures**, **12 newly active route records**, and **45 archived canton-calling routes still inactive on the sampled dates**.

**Application release checks have not passed.** The additional bus cache fills **16,364 previously unresolved seasonal occurrences**, preserving every earlier path and complete journey. A separate finite policy fills **583 further occurrences**, and a separately scoped Simplon fallback fills the final **2 Brig–Domodossola occurrences**. Every adjacent-call occurrence now has geometry on all twelve sampled dates. The archived September feeds replay exactly. A separate [Friday review candidate](../fixtures/aargau-reviewed/2026-09-04/aargau-region-day-manifest.json) corrects four occurrences on two evidenced direct variants of lines 136 and 358; 222 distinct bus pairs still need alignment review. No original feed, publication input hash, general distance guard, September platform/border policy or application selection changed. These results measure compatibility with pinned geometry; they do not establish that an alignment applied historically or will apply on a future service date.

## Dates and complete-journey coverage

The sample covers winter weekdays/Sundays, Good Friday/Easter Sunday, summer weekdays/Sundays, National Day, autumn weekdays/Sundays and the final Friday of the timetable year. Every date includes intersecting preceding-service-day journeys. Full calls outside the canton and outside midnight are retained. All source calendar exceptions, identities, platform coordinates, boarding rules and shifted times passed the independent Python CSV/zip verifier. No frequency templates occur in these samples.

| Date | Journeys | Compatible segments | All segments | Coverage | New directed patterns | Unresolved occurrences |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-01-16 | 11,131 | 173,467 | 173,467 | 100.000% | 150 | 0 |
| 2026-01-18 | 7,634 | 120,454 | 120,454 | 100.000% | 196 | 0 |
| 2026-04-03 | 7,615 | 121,249 | 121,249 | 100.000% | 211 | 0 |
| 2026-04-05 | 7,631 | 121,416 | 121,416 | 100.000% | 166 | 0 |
| 2026-07-17 | 11,393 | 171,645 | 171,645 | 100.000% | 228 | 0 |
| 2026-07-19 | 7,847 | 119,376 | 119,376 | 100.000% | 247 | 0 |
| 2026-08-01 | 7,764 | 121,267 | 121,267 | 100.000% | 296 | 0 |
| 2026-09-04 | 11,193 | 173,106 | 173,106 | 100.000% | 0 | 0 |
| 2026-09-06 | 7,767 | 121,473 | 121,473 | 100.000% | 0 | 0 |
| 2026-10-23 | 11,193 | 173,323 | 173,323 | 100.000% | 123 | 0 |
| 2026-10-25 | 7,662 | 120,593 | 120,593 | 100.000% | 166 | 0 |
| 2026-12-11 | 11,220 | 174,427 | 174,427 | 100.000% | 121 | 0 |

Counts are adjacent calls over all complete retained journeys. New-pattern counts per day can overlap; the distinct union is 1,146. Compatibility uses one AGIS part/orientation per full pattern, the preserved OSM route/platform/coordinate caches plus a new twelve-date cache for missing bus patterns, the existing FOT route/operating-point policy, 63 separately pinned seasonal gap rules, and two exact Simplon journey rules. Additional dates are diagnostic inputs only: the publication builder's September fixture hashes are unchanged. The original Brugg, Bern and Waldshut exceptions retain their September-only scope. The separate seasonal policy admits only the reviewed exact date/full-coordinate patterns and preserves every previously matched path.

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

The [complete seasonal inventory](../data/aargau-seasonal/input/inventory.json) retains all 5,142 national routes, their archived canton membership and all twelve daily statuses. The [summary](../data/aargau-seasonal/summary.json) lists all 289 canton-calling route records, their geometry counts and the 45 still-inactive records. Inactivity in this sample is not discontinuation or an exclusion from the archived canton census. The [annual witness audit](AARGAU-ANNUAL-WITNESSES.md) now finds active canton-calling journeys for all 45 routes, covered by 19 selected civil dates. It independently verifies 2,019 archived trip templates and 13,007 complete calls across all 364 feed dates. Those templates introduce 280 directed patterns; none has complete geometry under the existing reviewed policies, with 10,976 of 10,988 template segment occurrences unresolved. These are separate audit counts, not additional complete regional feeds.

## Geometry review priorities

The [release review](../data/aargau-seasonal/release-review.json) enumerates every unresolved date/pattern/adjacent-platform context, with original AGIS and fallback rejection reasons. Occurrence totals below sum sampled dates; they are not annual volumes.

No sampled geometry gaps remain. All complete journeys are retained; the bus alignment reviews below remain separate from automatic geometry coverage.

## AGIS and OSM alignment comparison

Every AGIS bus segment in the September audit was checked for an accepted comparator from the exact full-pattern road cache. The road cache was originally prepared for fallback patterns, so most AGIS-only contexts have no comparator. This absence is not an alignment failure. Symmetric vertex-to-polyline separation in approximate LV95 metres flags a disagreement over 30 m. It is direction-insensitive, can be zero for a reversed path, and cannot certify one-way legality, lanes, operating tracks or temporary diversions. Neither source wins automatically.

| Date | Within 30 m: contexts / occurrences | Over 30 m: contexts / occurrences | No comparator: contexts / occurrences |
| --- | --- | --- | --- |
| 2026-09-04 | 2,035 / 21,705 | 305 / 3,130 | 10,502 / 112,339 |
| 2026-09-06 | 1,375 / 17,485 | 211 / 2,256 | 6,217 / 67,896 |

There were **224 distinct directed route/platform pairs** flagged across both archived dates; reviewed corrections are available for 2 and **222 remain pending**; individual patterns and dates remain separate in the detailed reports. The largest separations are:

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

The replacement uses the already accepted full-pattern OSM bypass, **3,586.8 m** and an implied **71.7 km/h**. It remains an infrastructure inference. The policy pins exact agency, route, direction, full platform IDs/coordinates, date, segment index and both old/new path hashes. It cannot apply to another date or a changed source path. This corrects one occurrence. The [candidate regression](../data/aargau-seasonal/alignment-correction-regression.json) verifies all 11,193 original journeys, 173,102 unchanged segment occurrences and exactly 4 corrected occurrences across both reviewed variants. It also compares the archived prior policy and regression to prove this earlier line 136 correction remains identical. The archived Friday fixture and seasonal September replay are preserved; the corrected candidate is separate pending the remaining release reviews.

## Reviewed line 358 direct variant

[PostAuto’s 2026 service-change notice](https://fahrplanwechsel.postauto.ch/de/mittelland/aargau), effective **14 December 2025**, explicitly identifies the Monday–Friday **14:45, 15:45 and 16:45** departures from Baldingen as direct **Bad Zurzach, Seesteg → Bahnhof** workings for the S27 connection. The page is undated and was checked on **8 September 2026**; its previously archived bytes remain pinned. Official field **50.358**, dated **7 November 2025**, pages 1–2, confirms courses **35836, 35840 and 35846**, with Seesteg departures at **14:53, 15:53 and 16:53** and station arrivals three minutes later. These call times agree exactly with the pinned September GTFS. The courses omit Oberflecken, Höfli and Thermalbad; the explicit operator notice establishes the direct itinerary.

AGIS feature **193**, part **1**, retains a **1,950.2 m** local-loop path. The review candidate replaces its final segment with the accepted full-pattern OSM direct path of **931.4 m** for exactly **three Friday occurrences**, all on route **96-167-7-j26-1**, direction **1**, pattern **ba67a6b897cd1bf0b14f**. The policy pins the complete platform coordinates, source trip IDs, service date, course numbers, full calls and old/new path hashes. Every journey is checked before shared-pattern geometry is reused. No Sunday occurrence is admitted by this rule. The Baden-Nord operator map, valid from **14 December 2025**, is schematic context; the OSM path remains an infrastructure inference, with OpenStreetMap contributor attribution and ODbL provenance retained.

The earlier **Baldingen, Unterdorf → Rekingen AG, Dorf** segment remains unchanged, including these same three courses and course 35810. Its sparse calls and short interval do not establish an exact road itinerary. The other line 358 branch disagreements also remain pending. The original September fixtures and all twelve seasonal compatibility results are unchanged.

## Remaining line 344 review

The two largest line 344 disagreements were also examined against field 50.344 (7 November 2025, page 1) and the Freiamt map. Those sources distinguish early direct, Benzenschwil spur and school workings, but do not by themselves settle the exact road used on every sparse-stop variant. The [course-level follow-up](../data/aargau-seasonal/344-alignment-followup.json) pins courses 34403/34405 and 34409 with matching PDF call times. For Muri Industriegebiet → Beinwil Unterdorf, AGIS is 6,974.8 m (83.7 km/h over five minutes) versus OSM 3,730.9 m (44.8 km/h). For Benzenschwil → Beinwil Unterdorf, the alternatives are 4,583.0 m (68.7 km/h over four minutes) and 2,502.3 m (37.5 km/h). Those differences warrant a dated operator road itinerary; they do not by themselves establish the exact road. All three occurrences retain their original geometry and both pairs remain in the 222 pending reviews.

## Seasonal road-cache evidence

The [new source bundle](../data/aargau-seasonal-roads/source.json) contains 460 complete routing patterns across 14 agencies, with all original matcher outputs and warnings compressed for offline replay. It uses the same pinned OSM extract, pfaedle binary and configuration as the earlier cache; no threshold changes were made. The three PostAuto rejected hops and 76 cross-border matcher rejections remain null in this cache; preserved earlier caches or date-scoped evidence handle already resolved contexts. All 16,364 newly covered occurrences were prior gaps, including all 3,801 AVA EV1 summer replacement-bus occurrences missing from the old cache. This supplies geometric compatibility, not proof of the actual 2026 replacement-bus diversion.

## Scoped seasonal border, platform and rail review

The [seasonal gap policy](../data/aargau-seasonal-gap-policy.json) pins **63 exact date/full-pattern rules** and 583 additional occurrences: **364 Koblenz–Waldshut, 144 Brugg service-loop, seven Bern platform 49 and 68 on four additional SBB route records**. It binds the complete platform coordinates, route/agency/direction, segment indices, path hashes, source evidence and input hashes. It runs only in this compatibility audit after all earlier sources fail. The regression replays all prior geometry before applying these rules and verifies every earlier path remains identical.

The official [field 50.368](https://widgets.oev-info.ch/publikation/jahresfpl/50.368.pdf), dated **7 November 2025**, was archived and visually checked on page 1. It distinguishes the Wildischachen–Aare AG–Aquarena workings from the shorter variant. All four additional weekday coordinate chains equal the original reviewed Brugg pattern; the same ordered OSM relation and unchanged projection guards apply. This is dated itinerary evidence, not a date for the OSM geometry.

All seven selected Bern arrivals have the identical Baden–Brugg–Aarau–Olten–Bern tail. Zürich departure platforms 15, 17 and 18 are separately pinned. The [SBB station description](https://www.sbb.ch/en/travel-information/stations/find-station/bern-station/bern-station-description.html) corroborates the western platform extension; the exact FOT terminal segment still supplies the short 33.9 m projection. The undated description was rechecked on 8 September and does not certify historical track use.

[Thurbo's May 2026 notice](https://www.thurbo.ch/erkunden/ausblick/thurboleben/ki-baustellen/) was rechecked: the announced S36 crossing closure is **14 September–2 October**. All ten additional selected dates lie outside that interval. The entire ordered pattern must match one AGIS feature 364 part before either exact border pair is sliced. The closure interval is explicitly blocked as well as unselected dates; this is not a blanket date-range extension.

The four SBB identities are **91-26-E-j26-1 (RE26 Basel–Luzern), 91-5F-Y-j26-1 (IC Olten–Lugano via Freiamt), 91-2H-Y-j26-1 (IC Zürich–Lausanne/Genève-Aéroport) and 91-AP-Y-j26-1 (EXT Mühlau–Luzern in both directions)**. Nine complete patterns pass the same exact unique operating points, ordered source topology, 350 m station attachment, 120 m topology attachment and detour guards. These paths remain infrastructure inferences; admitting an exact source route ID does not certify its running tracks.

## Reviewed Simplon cross-border fallback

The [Simplon policy](../data/aargau-simplon-policy.json) now resolves the final two occurrences: **IC 1303, Brig platform 6 → Domodossola (I), on 3 April and 1 August**, route 91-29-Y-j26-1. The original FOT network still has no Domodossola node; its failure remains recorded. The fallback is OSM rail infrastructure, separately counted as rail geometry with source **osm-rail**, never attributed to FOT or a bus road cache.

The [official service-point record](https://data.sbb.ch/explore/dataset/dienststellen-gemass-opentransportdataswiss/) supplies the exact identity association: record **8501607**, Domodossola, explicitly states that its timetable is under **8301003**. That record was edited on **19 September 2024**, with validity from **15 December 2024**. The archived dataset metadata says data processed **29 July 2026**; neither date is presented as a track-geometry update. The [SBB border factsheet](https://company.sbb.ch/content/dam/internet/corporate/downloads/en/sbb-als-geschaeftspartner/flotte-unterhalt/onestopshop/Factsheet_Domodossola.pdf.sbbdownload.pdf), revised **6 August 2024**, page 3, independently distinguishes Domodossola FS **83-01003-3** from the FM and II operating points. No name-only or nearest-station alias is used, and the GTFS code stays unchanged.

The OSM snapshot is pinned to **8 September 2026, 00:00 UTC**, including versioned rail ways and all referenced nodes. The **40,781.8 m** inferred path follows connected 1435 mm main tracks and the individually reviewed Simplon passenger crossover **643956810**. Track attachments are **1.68 m at Brig / 33.98 m at Domodossola**, within the 120 m guard; station identity distances are **67.32 / 19.24 m**, within 350 m. The graph admits no yard, siding or spur, no coordinate-based joining of tracks and no reversal sharper than 90 degrees. The other tunnel crossover remains excluded. Removing the reviewed crossover leaves the selected station tracks disconnected and correctly fails the test.

The [official timetable field 145](https://widgets.oev-info.ch/publikation/jahresfpl/145.pdf), dated **26 May 2026**, page 1, corroborates SBB IC 1303 from Zürich and the non-stop Brig–Domodossola leg. That PDF panel covers 14 December–28 May and lists arrivals of 10:07/10:09; the pinned source calls remain **09:39–10:09 on 3 April and 09:39–10:16 on 1 August**. The [BLS construction page](https://www.bls.ch/de/unternehmen/projekte-und-hintergruende/bauprojekte/simplontunnel) is archived as operating context, not a general permission for all dates. Each rule pins date, exact source trip ID, train number, direction, full platform coordinates, every original call/time and the output path hash. It can fill only the original missing final segment. All previously accepted paths and the archived September feeds are regression-preserved; this is infrastructure compatibility, not certification of actual running tracks or historical operation.

Source bytes, query, dataset metadata, operator evidence and attribution are archived under [Simplon sources](../data/aargau-simplon-sources). Rail geometry attribution: **© OpenStreetMap contributors, ODbL-1.0**. Station identities: **SBB Infrastruktur / opentransportdata.swiss / FOT**.

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
node scripts/prepare-aargau-simplon.mjs --check
node scripts/review-aargau-344.mjs --check
node scripts/audit-aargau-seasonal.mjs
node scripts/check-aargau-seasonal.mjs
node scripts/aargau-seasonal-roads.mjs --check
node scripts/prepare-aargau-alignment-policy.mjs --check
node scripts/check-aargau-reviewed.mjs
node scripts/review-aargau-alignments.mjs --check
node scripts/document-aargau-seasonal.mjs --check
node scripts/check-aargau-study.mjs
npx vitest run scripts/aargau-seasonal.test.mjs scripts/aargau-platform-geometry.test.mjs scripts/aargau-alignment-corrections.test.mjs
```

Next work, recorded in the release review:

1. Review AGIS/OSM bus disagreements against dated operator itineraries and legal direction evidence; the 30 m diagnostic alone cannot choose the correct source.
2. Review geometry for all 280 directed patterns of the 45 newly witnessed routes, then extract and independently validate full civil days before extending the release scope.
3. Disambiguate the repeated local hour before promoting 25 October as an elapsed-time feed.
4. Integrate reviewed fixtures into application study selection, date loading and attribution, then run browser release checks.
