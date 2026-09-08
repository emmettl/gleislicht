# Bern canton: source adapter, regional feed and admission audit

Study by **Gleislicht**, using the pinned national timetable and the canton’s OEVTP source. Validation dates: **Friday 4 September and Sunday 6 September 2026**, each a Europe/Zurich civil day including the preceding service day’s after-midnight journeys. This is a reproducible historical regional feed, not a live service or a claim of year-round completeness.

The full-source census identifies **705 GTFS route records from 101 agency identities**, covering **all ten districts** of Bern. All **518 OEVTP line records and 5,321 OEVTP stop records** are retained in the source snapshot. The regional feed admits complete directed stop patterns only: **36,633 Friday and 31,855 Sunday journey instances**. Failed patterns remain in the audit; no unsourced straight-line segments are emitted as admitted journeys.

## Deliverables

- [Feed index](../public/data/bern-region/index.json), [Friday manifest](../public/data/bern-region/2026-09-04/bern-region-day-manifest.json), [Sunday manifest](../public/data/bern-region/2026-09-06/bern-region-day-manifest.json). Each date has twelve two-hour chunks and a 06:45–08:45 morning extract. These use the existing network snapshot/chunk schema. The selectable application study uses a separately validated display release; the full-detail archives remain unchanged.
- [Complete route and operator inventory](BERN-ROUTE-INVENTORY.md): every route, its exact GTFS identity, source line codes, status and weekday/Sunday admitted versus candidate counts. [Machine-readable routes](../data/bern-audit/routes.json) include per-date exclusions, directed pairs, patterns and geometry counts.
- [Audit summary](../data/bern-audit/summary.json), [Friday pattern/pair evidence](../data/bern-audit/2026-09-04.json), [Sunday pattern/pair evidence](../data/bern-audit/2026-09-06.json), [all source-line records](../data/bern-audit/source-lines.json), [cantonal GTFS stop records](../data/bern-audit/stops.json).
- [Explicit operator and exceptional line crosswalk](../data/bern-operator-crosswalk.json), [source adapter](../scripts/bern-line-geometry.mjs), [canton timetable census](../scripts/bern-timetable.mjs), [builder](../scripts/build-bern-region.mjs), [independent artifact checker](../scripts/check-bern-region.mjs).
- [Preserved original OEVTP archive](../data/bern-sources/oevtp.gpkg.zip), [source manifest](../data/bern-sources/sources.json), [lossless boundary-row snapshot](../data/bern-sources/boundary-rows.json.gz). The decoded source includes every line and stop, not a BERNMOBIL sample.

## Geographic denominator

The importer scans all **2,143,227 trip records and 34,499,152 stop-time rows**, without an agency whitelist. A trip belongs to the canton census when at least one **original GTFS call coordinate** lies inside the unsimplified Bern polygon from swissBOUNDARIES3D 2026-01. Parent stations alone do not select journeys. All-year route membership includes records inactive on the two validation dates; it does not assert daily operation.

For each selected dated journey, **every original call is retained**, including out-of-canton endpoints, intermediate calls and repeated platform visits. Neither a rectangle nor Libero zones define membership. Through-journeys without any stop in Bern are outside this explicitly stop-based scope. Services absent from both the GTFS and OEVTP sources, and separate GTFS-Flex service areas, are not proven covered by this inventory.

| District | All-year route records touching district | Called GTFS stop records inside district |
| --- | --- | --- |
| Seeland | 64 | 431 |
| Biel/Bienne | 91 | 537 |
| Bern-Mittelland | 244 | 2,238 |
| Emmental | 76 | 499 |
| Thun | 94 | 1,011 |
| Jura bernois | 70 | 346 |
| Oberaargau | 49 | 324 |
| Obersimmental-Saanen | 47 | 327 |
| Interlaken-Oberhasli | 141 | 962 |
| Frutigen-Niedersimmental | 96 | 514 |

District route counts overlap. They cover Bern-Mittelland; Biel/Seeland; Oberaargau; Emmental; Thun; all three Oberland districts; and **Jura bernois**, which a Bern-city or Libero-only scope would miss. The 2026 polygon excludes **Moutier**; a regression test fixes that boundary behaviour. Three source stop records within ten metres of the border, including two records for Brienzer Rothorn cable station on the outside, are listed in the audit’s `census.nearBoundary`. Approximate coordinate transformation uncertainty is not resolved by silently enlarging the polygon.

Admitted journeys retain 769 Friday and 771 Sunday out-of-canton stop records. Full cross-canton journeys fail admission if the official source does not cover their complete chain. Rail and bus replacement services remain separate GTFS identities.

## Directed-pattern and geometry results

| Measure | Friday | Sunday |
| --- | --- | --- |
| Candidate journey instances | 43,653 | 38,587 |
| Scheduled journey instances | 28,696 | 22,462 |
| Representative headway instances (exact_times=0) | 14,957 | 16,125 |
| Admitted scheduled instances | 21,676 | 15,730 |
| Admitted representative headway instances | 14,957 | 16,125 |
| Admitted total instances | 36,633 | 31,855 |
| Directed stop patterns: complete / candidate | 1,935 / 2,582 | 1,505 / 2,108 |
| Route-specific directed stop pairs: matched / candidate | 10,755 / 12,321 | 11,411 / 13,244 |
| All modeled segment occurrences: matched / candidate | 294,883 / 314,668 | 211,598 / 229,859 |
| All modeled segment occurrence coverage | 93.71% | 92.06% |
| Scheduled-only segment occurrence coverage | 93.30% | 91.28% |
| Carry-in journeys: admitted / candidate | 248 / 334 | 553 / 816 |
| Night-route journeys: admitted / candidate | 0 / 14 | 158 / 307 |
| Patterns revisiting a platform: admitted / candidate | 46 / 65 | 41 / 59 |

Coverage percentages use **all candidates**, not only the admitted feed. Every admitted journey has 100% matched segments by construction; that must not be advertised as 100% cantonal service coverage. Headway grids are deterministic representative motion, not exact scheduled departures or GPS. Their counts can be large on continuously operating lifts; scheduled-only counts and coverage are therefore reported separately. Calendar exceptions, Saturday-night carry-in, interval end exclusivity and the source frequency anchor are preserved. A journey with conditional pickup/drop-off is excluded from fixed-motion admission, rather than asserting an on-demand departure; booking conditions absent from GTFS remain an upstream limitation.

There are **1,317 shared**, **1,265 Friday-only** and **791 Sunday-only** patterns. Pattern identity is the GTFS route, direction_id and full ordered platform sequence; reversed trips and repeated loop calls cannot collapse into a set. Each report contains a stop-by-stop match mask. Route-specific directed pairs retain source stop IDs, endpoint snap distances, failure reasons and occurrence counts.

| Mode | Friday admitted / candidate; segment coverage | Sunday admitted / candidate; segment coverage |
| --- | --- | --- |
| bus | 13,570 / 15,623; 95.28% | 8,458 / 10,453; 93.47% |
| tram | 1,550 / 1,588; 99.30% | 1,220 / 1,252; 99.20% |
| rail | 3,256 / 4,150; 87.25% | 2,908 / 3,698; 86.76% |
| ferry | 36 / 40; 93.63% | 34 / 38; 93.55% |
| funicular | 2,753 / 2,753; 100.00% | 2,605 / 2,605; 100.00% |
| cableway | 15,468 / 19,499; 83.81% | 16,630 / 20,541; 84.91% |

### Adapter and admission policy

OEVTP’s `tucode` is an operator abbreviation, not a GTFS agency ID. Mapping checks the pinned agency name as well as its ID, compatible mode, and complete passenger line number. Moonliner uses the full `tuname` because it spans multiple operators. Rack railways have explicit R-prefix handling. Cable and boat records with blank display numbers use their timetable field; exceptional identifiers are enumerated in the crosswalk. The Grindelwald bus source maps to STI identities 859/605, BOB/WAB replacement records have explicit line overrides, and BLS boat cruise IDs are tested against their lake-specific source lines. Rail shapes are never reused for a bus merely because its number resembles a rail line. The S8 extension has a separate, dated shared-corridor exception supported by official timetable field 308, with a pinned evidence hash.

435 of 518 source line records have a reviewed crosswalk candidate among the canton-serving GTFS routes. The remaining 83 remain individually listed, including unresolved operators, source lines beyond the canton, missing timetable entries and changed identifiers. A crosswalk candidate is not geometry admission.

The decoder checks GeoPackage/WKB headers, EPSG:2056, geometry types, byte exhaustion and coordinate ranges; it preserves disconnected parts and polygon holes. Derived geometry uses original XY vertices without simplification, the swisstopo approximate CH1903+/WGS84 formula and seven-decimal output. Exact shared vertices alone create graph connections; line crossings do not automatically join and disconnected pieces are not bridged. Projected endpoint paths use these limits:

| Mode | Maximum platform snap | Maximum path length |
| --- | --- | --- |
| Bus, tram, cableway, funicular | 80 m | max(1,200 m, 4.5 × straight distance) |
| Rail | 120 m | max(3,000 m, 4.5 × straight distance) |
| Ferry | 150 m | max(1,200 m, 4.5 × straight distance) |

Within cantonal graphs, alternative source-part projections may be at most 5 m farther from each endpoint than its nearest projection, and must still satisfy the snap limit. Collapsed paths fail. Every segment is oriented from its actual preceding call to its next call; the final artifact checker verifies endpoint orientation after all stop/path reindexing. A pattern is admitted only if **every segment** passes. Boats use official water-line geometry and mountain transport its own mode-compatible line. Missing pairs on five explicitly selected Biel/Thun bus routes and seventeen separately reviewed regional routes may use retained OSM road matches. Every complete input-pattern context must agree on the identical valid path; 80 m endpoint and existing detour limits still apply. Tram 6 has two separately identified station-loop pairs from OEVTP line 30_003. Wiriehorn uses the reviewed federal axis 73.213. Missing pairs on the separately reviewed S36/S4 and nine-route regional/intercity batches may use only their explicitly bound federal segments described below, with exact operating-point identifiers and full-pattern context agreement. These supplements keep distinct provenance and never manufacture OEVTP line codes. No unsourced straight-line fallback is inserted.

**Physical limits:** these are official centrelines and identified road/cableway supplements with directions inferred from GTFS calls. They do not certify one-way road legality, a particular running track, tunnel level, boat navigation safety or current diversions. They are suitable as dated schematic movement candidates, not operational navigation. No authenticated realtime feed was exercised. The dated BERNMOBIL notice authorizes only the reviewed tram 6 station approach; the replacement-bus conflict below remains excluded. Seven additional winter/holiday fixtures are audited separately and do not establish every calendar day or seasonal alignment.

## Exclusions and review evidence

Across both dates: **318 routes admit all dated journeys**, **82 admit some**, **122 admit none**, and **183 are inactive on both dates**. The complete route appendix distinguishes these states; inactive annual records are not silently erased or described as failed geometry.

| Unmatched geometry reason | Friday directed pairs / occurrences | Sunday directed pairs / occurrences |
| --- | --- | --- |
| collapsed-path | 2 / 15 | 0 / 0 |
| disconnected-line | 53 / 643 | 67 / 367 |
| endpoint-gap | 549 / 5,533 | 589 / 5,605 |
| implausible-detour | 12 / 109 | 12 / 72 |
| missing-line | 950 / 13,485 | 1,165 / 12,217 |

Concrete cases preserved for follow-up:

- **BERNMOBIL 7A/8A buses:** the dated operator map conflicts with the temporary Luisenstrasse GTFS coordinates. Both platform IDs share a point on closed lower Thunstrasse; the operator specifies inbound Marienstrasse and outbound Kirchenfeldstrasse. Candidate road matching follows the wrong corridor. Both routes remain excluded without relocating source stops. Tram 6’s Bahnhof J approaches are resolved, while its remaining depot/Guisanplatz patterns stay excluded.
- **RBS S8 — resolved in the follow-up:** the OEVTP S8 record ends at Jegenstorf, but [official 2026 timetable field 308](../data/bern-sources/rbs-corridor-308-2026.pdf), dated 3 September 2025, establishes the shared S8/RE5 corridor through Bätterkinden to Solothurn. The explicit agency-88 rail-only crosswalk now permits the preserved 308_RE centreline for S8. All 148 Friday and 118 Sunday S8 journeys pass every directed segment with unchanged limits, admitting 76 additional Friday and 75 additional Sunday journeys. This does not grant other RBS lines or buses access to that corridor. The evidence file hash and attribution accompany the feed.
- **Eiger Express 2444:** its two directed endpoint pairs have a maximum snap of **215.3 m**, exceeding the cable limit. **Grindelwald–Männlichen GGM** has **93.4 m** terminal mismatch. Matching the installation’s identity does not authorize moving its source stops or raising the threshold.
- **Schilthorn:** the Gimmelwald–Mürren split record 24602 is now resolved by field 2460 and the existing 2460_1 geometry. The upper 24603/24604 records are now separately bound to their original 2460_2 source parts and admit 39 journeys each on both dates. Earlier prose incorrectly called them inactive; the dated census always recorded these 78 daily candidates. See the section audit below.
- **Matte lift 2352:** a vertical passenger lift with no acquired transport axis suitable for the 2D model; no short horizontal segment is invented. **Wiriehorn 2365 is resolved** by federal installation 73.213, with a 0.47 m maximum station gap. **SBB/BLS/SOB and MOB long-distance or changed labels**, replacement buses, and complete journeys beyond the source extent remain explicitly excluded or partial. No whole operator is claimed complete from its admitted subset.
- **Biel/Seeland, Oberaargau, Emmental and regional bus terminal/platform gaps:** many routes have high segment coverage yet fail whole-pattern admission. The route and directed-pair files identify each failure; high occurrence coverage does not excuse a missing terminal movement.

## Reviewed corridor aliases: IR65, R71 and Gimmelwald–Mürren

The [corridor follow-up audit](../data/bern-audit/corridor-followup.json) compares against committed release 21ea85e. It admits **190 additional Friday and 188 additional Sunday scheduled journeys**, with no new headway instances. Every one of the previous **33,086 / 29,015 journeys** retains exactly the same source identity, call sequence, arrival/departure times, original stops and full-detail path coordinates. All unrelated directed-pair decisions are identical. The GTFS, canton boundary, original geometry and distance limits are unchanged.

| Exact route / operator | Official evidence and source geometry | Friday added | Sunday added |
| --- | --- | ---: | ---: |
| IR65 / BLS (33) | [Field 303](../data/bern-sources/corridor-303-2026.pdf), 1 October 2025, identifies IR65 and S3 on Biel/Bienne–Lyss–Bern. Preserved 303_S_a includes the Bern station approach. | 68 | 70 |
| R71 / Zentralbahn (86) | [Field 474](../data/bern-sources/corridor-474-2026.pdf), 20 October 2025, identifies R71 on the Meiringen–Innertkirchen corridor labelled R in OEVTP record 474. | 56 | 50 |
| 24602 / Schilthornbahn (256) | [Field 2460](../data/bern-sources/corridor-2460-2026.pdf), 28 August 2025; the 28 March–12 December table includes Gimmelwald–Mürren. Preserved 2460_1 contains that section alongside the direct Stechelberg–Mürren branch. | 66 | 68 |

Every directed pattern on these three route records now passes, including the preceding-day IR65 and Gimmelwald–Mürren movements. IR65 validates nine Friday/six Sunday platform patterns; R71 validates two Friday/four Sunday patterns; 24602 validates two on each date. All three records include both directions. Crosswalk tests reject other operators, buses, neighbouring rail labels and upper Schilthorn identifiers on the lower 2460_1 feature. The PDFs are retained with acquisition timestamps, source dates, hashes and attribution in the crosswalk and distributed alongside the feeds.

The generic IR-labelled 303_RE geometry alone leaves Bern platform offsets of up to 426 m, so relabelling that record alone is insufficient. The shared S3 alignment resolves the dated IR65 platform calls within the original 120 m rail limit; no platform substitution, clipping or threshold increase is used. This is a dated schematic corridor match, not certification of a particular running track.

## Application display release

Bern is selectable as **Bern · canton and Alpine connections**, with full-day loading by default, morning playback, stop/route search, links that restore the date and selection, and retry after failed loads. English, German, French and Italian labels identify partial coverage and representative motion. The default application timetable is **4 September 2026**. An unavailable linked date is explicitly reported; it is never silently stamped onto older journeys. A Sunday display release can be built from the separately audited 6 September fixture. The seven additional winter/holiday dates below have separate pattern audits; publication as an application feed still requires a reviewed release for each date.

The [display-release audit](../data/bern-audit/display-release.json) records both dates, original manifest and admission-audit hashes, movement counts, geometry error and payloads. Display geometry uses Douglas–Peucker with a **5 m maximum distance to each retained chord in approximate LV95**. A separate verifier checks every original subchain, retained vertex order and exact segment endpoints. This bounds display position, not arc-length distortion or survey accuracy. All original source calls, journey identities, schedules, frequency semantics, directed segment indices and chunk bytes remain unchanged. Admission still uses the unsimplified geometry.

| Payload (gzip bytes) | Friday | Sunday | Budget |
| --- | ---: | ---: | ---: |
| Manifest | 643,716 | 657,463 | 665,600 |
| Morning | 965,875 | 837,958 | 1,638,400 |
| Largest two-hour chunk | 400,766 | 332,366 | 460,800 |

The delivered [application manifest](../public/data/bern-region-day-manifest.json) and [morning snapshot](../public/data/bern-region-morning.json) use the shared regional loading and integrity checks. A refresh only builds explicitly reviewed dates. Other requested dates, failed builds or acquisition failures retain a verified published study; a missing first-deployment manifest may use the complete checked-in release. Missing chunks never trigger a mixture of published and local files. Geometry uses the cantonal source for every mode; the release does not claim BAV rail or OSM road provenance.

The integration checks reproduced both dates byte-for-byte at the movement level and exercised tampered geometry/counts/credit, excessive simplification, changed dates, first publication and damaged recovery. Desktop Chromium and iPhone WebKit checks cover lazy selection, S8 and Solothurn search, sharing, afternoon seeking, midnight retry, morning retry and all four languages. The production build and original cantonal audit checks pass.

A follow-up inspection of the separately retained [BAV Eiger Express source](../data/jungfrau-cableway-source.json) and its [endpoint audit](../data/jungfrau-study-audit.json) found approximately 213.3 m / 135.9 m offsets at the shared timetable stops. This does not resolve the 80 m Bern endpoint gate. It remains excluded here; the Jungfrau study's installation-specific display policy must not silently weaken the canton adapter. The federal XML review below independently confirms the Eiger endpoint conflict and documents Männlichen, Wiriehorn and Matte.

## Urban and mountain supplement review

The [supplement audit](../data/bern-audit/supplement-followup.json) compares against committed release 0c12980. **All 33,276 Friday and 29,203 Sunday previously admitted journeys keep identical calls, times, identities and full-detail paths.** Source archives, original platform coordinates and distance limits are unchanged. The additions are **1,850 Friday / 1,608 Sunday**: 920 / 678 scheduled urban journeys and 930 / 930 representative Wiriehorn headway instances.

| Exact route | Friday added: scheduled / headway | Sunday added: scheduled / headway |
| --- | --- | --- |
| 92-2-D-j26-1 | 210 / 0 | 147 / 0 |
| 92-3-F-j26-1 | 143 / 0 | 115 / 0 |
| 92-6-F-j26-1 | 146 / 0 | 118 / 0 |
| 92-1-H-j26-1 | 207 / 0 | 142 / 0 |
| 92-2-F-j26-1 | 4 / 0 | 0 / 0 |
| 91-6-A-j26-1 | 210 / 0 | 156 / 0 |
| 93-236-5-j26-1 | 0 / 930 | 0 / 930 |

Biel buses 2/3/6 and Thun 1 now admit every dated journey. Thun 2 retains 9 / 214 Friday journeys and 0 / 140 Sunday journeys: road candidates at Mattenstrasse miss by 108.6–111.3 m, above the 80 m gate. Matcher failures and differing full-pattern contexts cannot be hidden by choosing another successful occurrence. The [road cache](../data/bern-urban-cache.json) and compressed raw evidence cover all 39 complete patterns on seven investigated routes, including rejected 7A/8A candidates.

Tram 6 gains the two directed Bahnhof J / Hirschengraben pairs using the original official 30_003 station loop, with maximum gaps 0.47 m / 4.21 m. [BERNMOBIL’s notice](../data/bern-sources/bernmobil-thunstrasse-notice-20260811.html), [diversion map](../data/bern-sources/bernmobil-thunstrasse-diversion-2026.jpg) and [platform plan](../data/bern-sources/bernmobil-bahnhof-platforms-20260318.pdf) support the dated use. The 7A/8A Luisenstrasse point is approximately 149 m from Marienstrasse and 227 m from Kirchenfeldstrasse; it cannot satisfy the source-coordinate rule. Source tram 7/8 geometry is never relabelled as bus geometry.

The [mountain policy](../data/bern-mountain-policy.json) reviews exact installation/operator/station identities against the complete federal archive (653 installations). Wiriehorn’s 73.213 axis attaches within 0.47 m and retains both original GTFS endpoints. Eiger Express 75.014 still misses by up to 213.6 m. Grindelwald–Holenstein 72.153 misses the shared Terminal by 143.0 m; its upper 72.154 section fits, but the complete GGM journey still fails. Neither case authorizes replacing timetable interchange coordinates with installation station coordinates. [Mattelift’s operator description](https://www.mattelift.ch/der-mattelift/technik/) identifies a vertical lift with 29.90 m rise; the roughly 4 m horizontal GTFS separation does not establish an axis in this 2D feed.

## Regional bus follow-up

The [regional road audit](../data/bern-audit/regional-road-followup.json) compares against release d864441. All **35,126 Friday / 30,811 Sunday** previously admitted journeys retain byte-equivalent canonical source identities, full calls, times and path coordinates. The separate [regional cache](../data/bern-regional-road-cache.json) retains **120 full directed patterns across six agencies and 17 routes**, with raw matcher output and hashes. Every newly admitted source field and call is independently compared against the pinned timetable cache; all 56 Friday / 48 Sunday used road pairs reproduce from retained evidence.

The batch adds **1,152 Friday / 612 Sunday scheduled journeys** and no representative headway instances. **Fifteen routes pass all journeys on both fixtures** (including routes inactive on Sunday); 121 and 107 remain partial. All 705 annual route records, both dated candidate denominators and all geometry limits remain unchanged. No September road context is applied to the seasonal audit.

| Agency: line / exact route | Friday added | Sunday added | Friday admitted / candidate | Sunday admitted / candidate |
| --- | --- | --- | --- | --- |
| 801: 101 / 96-701-j26-1 | 217 | 158 | 258 / 258 | 158 / 158 |
| 870: 74 / 92-74-j26-1 | 91 | 52 | 92 / 92 | 52 / 52 |
| 827: 31 / 92-31-B-j26-1 | 90 | 0 | 111 / 111 | 0 / 0 |
| 894: 24 / 92-24-B-j26-1 | 77 | 69 | 77 / 77 | 69 / 69 |
| 889: 4 / 92-4-C-j26-1 | 70 | 56 | 140 / 140 | 112 / 112 |
| 889: 9 / 92-9-D-j26-1 | 68 | 54 | 136 / 136 | 108 / 108 |
| 801: 105 / 96-925-j26-1 | 63 | 58 | 66 / 66 | 60 / 60 |
| 801: 121 / 96-881-j26-1 | 23 | 7 | 23 / 59 | 7 / 20 |
| 871: 281 / 92-281-j26-1 | 58 | 0 | 60 / 60 | 0 / 0 |
| 871: 461 / 92-461-A-j26-1 | 58 | 15 | 58 / 58 | 15 / 15 |
| 801: 107 / 96-705-j26-1 | 54 | 36 | 55 / 59 | 36 / 36 |
| 870: 64 / 92-64-B-j26-1 | 55 | 19 | 56 / 56 | 28 / 28 |
| 827: 332 / 92-332-j26-1 | 50 | 0 | 50 / 50 | 0 / 0 |
| 871: 462 / 92-462-j26-1 | 50 | 0 | 52 / 52 | 0 / 0 |
| 801: 340 / 96-706-j26-1 | 45 | 37 | 54 / 54 | 37 / 37 |
| 827: 160 / 92-160-j26-1 | 43 | 27 | 152 / 152 | 102 / 102 |
| 801: 132 / 96-738-j26-1 | 40 | 24 | 41 / 41 | 24 / 24 |

The remaining regional gaps are **Laupen BE, Bahnhof → Bösingen, Abzw. Tuftera on 121** and **a repeated Uettligen, Dorf call on 107**. Candidate road matching rejects the first and collapses the second; no timetable call is dropped to make a journey pass. Across all input contexts, seven directed-pair candidates include a rejected segment and fifteen have differing inferred paths. Those candidates cannot supply missing official geometry even when another occurrence succeeds. Original successful cantonal geometry remains authoritative for its existing pairs.

Each agency’s maximum accepted endpoint snap, every matcher rejection, all full-context pattern IDs, candidate path hashes and remaining route/date gaps are in the audit. The source is the same pinned 2 September OSM extract and matcher as the urban batch, with **© OpenStreetMap contributors / ODbL** attribution. This is inferred geometry, not operational road-direction or current-diversion certification.

## Upper Schilthorn section review

The [section audit](../data/bern-audit/schilthorn-followup.json) compares against release e9d207d. **All 36,278 Friday / 31,423 Sunday journeys keep their original calls, times, identities and full-detail paths.** The two upper sections add **78 scheduled journeys on each date**, with no additional representative headway instances or changed thresholds. Every unrelated directed-pair decision remains identical.

[Timetable field 2460](../data/bern-sources/corridor-2460-2026.pdf), published **28 August 2025** for timetable year 2026, separately lists Mürren–Birg and Birg–Schilthorn and identifies **Luftseilbahn Mürren-Schilthorn**, pinned GTFS agency **268**. The retained PDF, acquisition timestamp, checksum and **öv-info.ch / Schilthornbahn** attribution accompany the feed. Exact route ID, agency, mode and line select one original OEVTP source part by its SHA-256; changed or ambiguous source coordinates fail the build.

| GTFS route / section | Friday scheduled | Sunday scheduled | Directed patterns per date | Maximum original-stop attachment |
| --- | --- | --- | --- | --- |
| 93-246-B-j26-1 / Mürren (Schilthornbahn)–Birg (Schilthornbahn) | 39 | 39 | 2 | 5.71 m |
| 93-246-C-j26-1 / Birg (Schilthornbahn)–Schilthorn | 39 | 39 | 2 | 37.48 m |

Both sections pass in both directions. The two original Birg cable endpoints are **39.77 m apart**. Selecting the published section prevents the summit service from snapping to the lower installation. The adapter adds no connection between cable axes and retains the original shared GTFS Birg coordinate, attaching it to the selected axis within the existing 80 m limit. This is inferred source geometry, not an observed cabin trajectory.

The Schilthorn release retained **BLS S36 Dotzigen–Busswil BE** and **S4 Zollikofen–Schönbühl SBB** as disconnected cantonal graphs. Their original gaps remain in that historical audit; the separate federal rail review below now resolves both routes.

## S36 and S4 federal rail review

The [rail follow-up audit](../data/bern-audit/rail-followup.json) compares against release 326d8c3. **All 36,356 Friday / 31,501 Sunday previously admitted journeys retain their original calls, times, identities and full-detail paths.** It adds **93 Friday / 79 Sunday scheduled journeys**. Both routes now pass every complete dated pattern in both directions; all unrelated pair decisions, original source hashes and existing rail limits are unchanged.

| BLS route | Friday added / total | Sunday added / total | Friday / Sunday full directed patterns |
| --- | --- | --- | --- |
| S36 / 91-36-D-j26-1 | 50 / 50 | 38 / 38 | 3 / 5 |
| S4 / 91-4-C-j26-1 | 43 / 47 | 41 / 48 | 22 / 23 |

The [federal rail source](../data/bern-sources/fot-rail/source.json) supplies **3,210 operating-point nodes and 3,424 segments**. The adapter selects only **three standard-gauge segments on SBB infrastructure**, binding S36 to **8500220 Dotzigen → 8504415 Busswil BE** and S4 to **8504410 Zollikofen → 8508001 Schönbühl SBB**, with the reverse bindings for return journeys. S4 passes through the explicitly declared Zollikofen Nord junction. Segment IDs and directions, each attachment, every complete-pattern context and path checksum are retained in the audit.

The maximum original-stop attachment is **97.36 m** for S36 and **61.43 m** for S4. Both respect the existing **120 m** rail limit and **4.5× / 3,000 m** detour gate. Federal segment endpoints connect to their declared nodes with measured attachments below **16 m**, under a separately stated **120 m topology guard**. These declared connections do not normalize or join the disconnected cantonal vertices. Every original GTFS call stays in place, including Bern platform variants and all cross-canton calls. Successful cantonal paths remain authoritative. A missing pair is accepted only when every complete source-pattern context produces the same federal path; other called stations are blocked as interior nodes, so a shortcut cannot skip or reorder the original calls.

The retained national XTF has catalogue date **6 July 2021** and asset update **18 January 2025**. The [official catalogue](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz) was rechecked on **8 September 2026** and its published checksum still matches the retained source. This verifies the bytes, **not current alignment or running-track validity**. The selected segments have explicit validity starts and no declared end dates; their data dates remain visible in the audit. Credit: **© Federal Office of Transport (FOT)**. Original source, catalogue, collection, recheck response and terms link accompany the regional feed under [fot-rail](../public/data/bern-region/fot-rail/source.json); application credit links to the combined rail/cableway provenance.

Federal lines use the existing XTF parser at **zero-metre simplification tolerance** (collinear vertices may be removed), with six-decimal transformed coordinates and seven-decimal final GTFS attachment endpoints. The original XTF remains intact. This supplement is scoped to the two September fixtures; **the seven seasonal audit files and results are unchanged** and do not inherit these rail admissions.

## Regional and intercity rail follow-up

The [regional rail audit](../data/bern-audit/regional-rail-followup.json) compares against release 1ffe2b9. **All 36,449 Friday / 31,580 Sunday previously admitted journeys preserve their complete original calls, times, source identities and full-detail paths.** The batch adds **178 Friday / 194 Sunday scheduled journeys**, with no extra representative headway instances. Every unrelated directed-pair decision and all prior source hashes and limits remain unchanged.

| GTFS route / line | Friday added | Sunday added | Friday admitted / candidate | Sunday admitted / candidate |
| --- | --- | --- | --- | --- |
| 91-5-j26-1 / S5 | 40 | 38 | 79 / 79 | 76 / 76 |
| 91-23-j26-1 / S23 | 38 | 37 | 76 / 76 | 76 / 76 |
| 91-13-G-j26-1 / R13 | 32 | 37 | 40 / 40 | 40 / 40 |
| 91-20-A-j26-1 / S20 | 18 | 0 | 120 / 120 | 80 / 80 |
| 91-31-j26-1 / S31 | 16 | 0 | 60 / 60 | 0 / 0 |
| 91-42-C-j26-1 / S42 | 4 | 1 | 40 / 40 | 38 / 38 |
| 91-41-F-j26-1 / S41 | 2 | 1 | 45 / 45 | 43 / 43 |
| 91-15-B-j26-1 / IR15 | 27 | 42 | 29 / 44 | 43 / 43 |
| 91-5-A-j26-1 / IC5 | 1 | 38 | 1 / 42 | 38 / 38 |

**Seven regional route records now pass every dated journey:** BLS S5, S31, S41 and S42, and SBB S20, S23 and R13. S31 has no Sunday candidate in this fixture; it is not claimed to run daily. IR15 and IC5 pass all Sunday candidates but remain partial on Friday. The counts refer to exact GTFS route records, not every train carrying the same passenger label elsewhere in Switzerland.

The [separate policy](../data/bern-regional-rail-policy.json) retains **131 exact directed platform-pair bindings**, including **13 reviewed exclusions**, and selects **167 federal standard-gauge segments** on declared **SBB / BLS infrastructure**. Every admitted platform pair names the original source segment sequence and operating-point identities. Reversing a platform pair, substituting another platform at the same station, changing the agency/line or finding a different segment sequence requires an explicit binding; it is not authorized by proximity or line-name similarity. Every complete source-pattern context is checked, including contexts belonging to journeys excluded elsewhere on the route. They must agree before a missing pair can be supplied.

Remaining Friday intercity exclusions are **15 IR15 journeys** involving Morges platform 1 and **41 IC5 journeys** involving Zürich HB platform variants. Morges requires a **134.03 m** attachment; the rejected Zürich HB variants require **263.63–295.91 m**. They exceed the unchanged **120 m** rail station guard. The audit retains all thirteen directed failures, original stop IDs, source operating-point identities and full-pattern evidence. No stop is relocated or dropped to make an intercity journey pass.

The same pinned **6 July 2021** federal source is used, with **18 January 2025** asset update and **8 September 2026** checksum recheck; no new raw geometry release is claimed. Selected federal topology attachments are below **51 m**, within the separately stated 120 m topology guard. Stop attachment, detour and output precision policies remain unchanged. **© Federal Office of Transport (FOT)** attribution and the retained original XTF, catalogue, terms link and transformation details accompany the feed. Current alignment and running-track validity remain unconfirmed. September-only bindings do not alter the seven seasonal audit files or admit seasonal application feeds.

## Further cross-canton rail review

The [cross-canton rail audit](../data/bern-audit/crosscanton-rail-followup.json) compares against release 7f719f6. **All 36,627 Friday / 31,774 Sunday prior journeys preserve every source call, time and full-detail path.** It adds **6 Friday / 81 Sunday scheduled journeys**, with all previously matched pair assessments and all earlier source hashes and limits unchanged.

| GTFS route / line | Friday added | Sunday added | Friday admitted / candidate | Sunday admitted / candidate |
| --- | --- | --- | --- | --- |
| 91-20-B-j26-1 / S20 | 2 | 38 | 2 / 43 | 38 / 78 |
| 91-21-A-j26-1 / S21 | 3 | 40 | 3 / 43 | 40 / 78 |
| 91-1X-Y-j26-1 / RE | 1 | 0 | 1 / 1 | 0 / 0 |
| 91-3W-Y-j26-1 / IC | 0 | 1 | 0 / 0 | 2 / 2 |
| 91-4R-Y-j26-1 / IC | 0 | 1 | 0 / 0 | 1 / 1 |
| 91-8-L-j26-1 / RE8 | 0 | 1 | 8 / 10 | 5 / 7 |

TPF S20/S21 use their existing OEVTP 255_a/255_b crosswalks; the occasional SBB RE uses 240_RE, the two occasional IC records retain their existing IC source associations, and BLS RE8 retains 320_RE. Passenger labels alone do not authorize federal geometry. The [separate policy](../data/bern-crosscanton-rail-policy.json) pins **45 exact directed platform-pair bindings**, including **12 rejected bindings**, and **81 standard-gauge federal segments** on declared SBB/BLS infrastructure. It tests **36 Friday / 34 Sunday full patterns** on these six identities, including contexts from excluded journeys. Both source directions are tested wherever present; the single Friday RE and single Sunday IC record each have only direction 0 in the fixture, and no reverse service is invented.

Three occasional route records now pass every dated journey. **TPF S20/S21 remain partial**: the original Fribourg/Freiburg platform 4/5 coordinates (including the published 4A–D variant) require **270.82–274.08 m** attachments to the generic federal operating point, exceeding the unchanged **120 m** limit. Their nine rejected directed bindings remain visible. **RE8 remains partial**, with two excluded journeys on each date: its three distinct Interlaken Ost/West platform-pair bindings cannot form an eligible federal path under exact operating-point identity, standard gauge, detour and stop-order rules. A nearby alternative operating point is not substituted. The earlier Friday Morges and Zürich HB failures remain unchanged.

Accepted federal pairs attach original stops within **102.09 m**, and selected source topology attachments are below **51 m**. Full raw-pattern contexts must agree on the same directed source-segment sequence. All original GTFS coordinates, calls, times and permissions remain intact, including out-of-canton endpoints. Complete geometry is required before a whole journey enters the feed.

This review reuses the retained federal XTF with catalogue date **6 July 2021**, asset update **18 January 2025**, and checksum recheck **8 September 2026**. It introduces no newer geometry or broader validity claim. **© Federal Office of Transport (FOT)**, source dates, original bytes, transformation details and terms link remain in the regional feed's combined provenance. The same **4.5× / 3,000 m** detour rule, 120 m topology guard and output precision apply. Current alignment/running tracks remain unconfirmed, and the seven seasonal audits are unchanged.

## Winter and holiday fixtures

The [seasonal audit](../data/bern-audit/seasonal-summary.json) and [ordered-pattern evidence](../data/bern-audit/seasonal-patterns.json.gz) cover seven extra civil days. Every admitted pattern passes complete original call, permission, timing and directed-path checks. September road contexts and construction geometry are disabled for these dates; Wiriehorn’s dated federal installation remains independently checked. The reviewed Schilthorn sections also pass the seven extra fixtures, adding 72 scheduled journeys per fixture except 1 August, which adds 78; these remain audit-only seasonal results.

| Date | Admitted / candidate journeys | Patterns absent from both September fixtures | Admitted new patterns |
| --- | --- | --- | --- |
| 2026-01-16 | 32,781 / 43,804 | 386 | 203 |
| 2026-01-18 | 28,650 / 38,401 | 485 | 220 |
| 2026-04-03 | 23,753 / 32,854 | 419 | 180 |
| 2026-04-05 | 23,879 / 33,035 | 383 | 185 |
| 2026-08-01 | 30,356 / 39,948 | 479 | 149 |
| 2026-12-04 | 19,346 / 27,776 | 373 | 186 |
| 2026-12-06 | 21,533 / 28,592 | 473 | 214 |

Of the 183 routes inactive in September, **50 operate on at least one additional fixture** and **133 remain inactive across all nine sampled dates**. The route-by-date matrix distinguishes absence from geometry exclusion. These are sample audits, not year-round physical route certification or published seasonal application feeds. Christmas lies outside this archive’s 12 December end date and needs a later source release.

## Source dates, attribution and reuse

| Source | Data vintage / release | Preserved evidence and attribution |
| --- | --- | --- |
| National GTFS | Feed 20260902; valid 2025-12-14 to 2026-12-12 | opentransportdata.swiss; original platform IDs, calendar and frequency semantics |
| Bern OEVTP lines and stops | Updated 2026-01-01; package published 2026-07-09; acquired 2026-09-08 | Original ZIP, decoded records, metadata PDFs and terms in data/bern-sources |
| OSM road extract | Switzerland 2026-09-02; border extract retrieved 2026-09-08 | © OpenStreetMap contributors; ODbL; retained matcher output and run hashes |
| FOT federal rail | Catalogue 2021-07-06; asset updated 2025-01-18; checksum rechecked 2026-09-08; current alignment validity unconfirmed | © FOT; full XTF, catalogue, collection and exact operating-point/segment bindings |
| FOT federal cableways | Installation Stand 2025-01-01; XML 2026-01-05; asset updated 2026-01-29; retrieved 2026-09-08 | © FOT; complete archive, station/installation records, catalogue and checksum |
| BERNMOBIL diversion | Notice 2026-08-11; valid 2026-08-29–2026-10-11; platform plan 2026-03-18 | BERNMOBIL; original notice, detailed stop instructions, diversion image and station PDF |
| swissBOUNDARIES3D | 2026-01 edition | © swisstopo; complete Bern and ten district rows preserved with original geometry blobs |

**Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern.** The [official metadata](https://www.agi.dij.be.ch/de/start/geoportal/geodaten/detail.html?code=OEVTP&type=geoproduct) and packaged [line metadata PDF](../data/bern-sources/metadata_oevtp_linie_de.pdf) identify the data vintage. Free private/commercial use and reproduction require attribution; online applications must link the metadata and recipients must receive the terms. [German terms](../public/data/bern-region/terms_of_use_de.pdf) and [French terms](../public/data/bern-region/terms_of_use_fr.pdf), dated **20 January 2026**, accompany the feed. No generic CC licence is assigned to these cantonal data. The original acquired archive is kept because the download URL is mutable.

Timetable data: **opentransportdata.swiss**; processed feed and analysis: **Gleislicht**. The [platform terms](https://opentransportdata.swiss/en/terms-of-use/) require attribution, refresh of raw data and the data user’s authorship for processed results. This delivery is explicitly an archival two-date study; it must be rebuilt and re-audited before being presented as current service. Administrative boundaries: **© swisstopo**, under the [official OGD terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices). Road supplements: **© OpenStreetMap contributors**, [ODbL](https://www.openstreetmap.org/copyright), with source/matcher/input/output hashes and full-pattern evidence retained. Cableway supplement: **© Federal Office of Transport (FOT)**, with [source catalogue and attribution terms](../public/data/bern-region/fot-cableways/source.json). Operator diversion evidence: **BERNMOBIL**, retained with its publication/validity dates; it is evidence rather than a geometry licence.

SHA-256 identities:

- National GTFS ZIP: `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`.
- Original OEVTP ZIP: `4e2a4fcca08cc219c871d42c957753c09318ace2172fb3614c4fe71b20a4fe19`.
- Original boundary GeoPackage: `1f122cb7a06f2d312a84b7c0a91116348ba907054d487f0a70b9d2302984e6fc`.
- Extracted boundary-row snapshot: `b0bfb7d0d3d7357aaaec2de0335dfc1beb83274b2143d876260e86b227a41dd0`.
- Decoded source: `36146aab8e303a8bc9b6864f0974f2f726aed809cf340958f5233e5e08936956`.
- Operator/line crosswalk: `58f5ab42df0c14b4d5428f1993ab93f0aacd266d3d1dc3a240793c969a08e761`.

## Reproduction and checks

Python 3 uses only the standard library; Node uses the repository’s pinned `@motionstudies/data` package. Run from the repository root. No authenticated service is needed.

```sh
# Decode the preserved source ZIP and boundary rows; no network required.
npm run data:bern:sources

# Obtain the exact timetable fixture if not already present.
curl --fail --location \
  https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip \
  --output /private/tmp/GTFS_FP2026_20260902.zip

# Complete all-year geographic census, two civil days, geometry, feeds and audit.
npm run data:bern -- --archive /private/tmp/GTFS_FP2026_20260902.zip

# Independent offline checks of emitted bytes and all audit denominators.
npm run data:bern:check
node scripts/check-bern-corridor-followup.mjs # historical alias-only release
node scripts/check-bern-supplement-followup.mjs data/bern-audit/timetable-cache.json.gz # historical urban/mountain batch
node scripts/check-bern-regional-roads.mjs data/bern-audit/timetable-cache.json.gz # historical regional bus batch
node scripts/check-bern-schilthorn.mjs data/bern-audit/timetable-cache.json.gz # historical Schilthorn batch
node scripts/check-bern-rail-followup.mjs data/bern-audit/timetable-cache.json.gz # historical S36/S4 batch
node scripts/check-bern-regional-rail.mjs data/bern-audit/timetable-cache.json.gz
node scripts/audit-bern-seasonal.mjs --archive /private/tmp/GTFS_FP2026_20260902.zip
node scripts/check-bern-seasonal.mjs
# Publish the reviewed Friday display, or build the Sunday release separately.
npm run data:bern:release
npm run data:bern:docs
npm run data:bern:release -- --date 2026-09-06 --output /private/tmp/bern-sunday-display
npx vitest run scripts/bern-regional-rail.test.mjs scripts/bern-rail-geometry.test.mjs scripts/bern-release.test.mjs scripts/bern-supplements.test.mjs scripts/bern-regional-roads.test.mjs scripts/regional-refresh.test.mjs
npx playwright test e2e/bern.spec.ts
npx vitest run scripts/bern-region.test.mjs scripts/basel-line-geometry.test.mjs \
  scripts/civil-day.test.mjs scripts/gtfs-frequencies.test.mjs
python3 scripts/test_bern_sources.py
```

The full build creates `data/bern-audit/timetable-cache.json.gz` as an ignored local acceleration cache; subsequent geometry-only builds may pass `--timetable-cache` with that path. Cache source hashes must agree with the pinned GTFS and decoded boundary/line source. To reconstruct the original boundary snapshot, pass the original 2026-01 GeoPackage with `python3 scripts/prepare-bern-sources.py --boundary PATH`.

Validation covers all emitted stop/path references, finite and ordered call times, retained source call counts, original directed platform sequences, complete-path admission, shared-edge orientation, previous-day identity, representative frequencies, twelve contiguous chunks per date, chunk checksums/byte counts, identical repeated journeys across chunks, source/crosswalk hashes, all route/operator/district denominators, and independent reconstruction of pair occurrences from every pattern. Unit tests cover polygon holes and detached parts, Moutier’s transfer, separate operators and modes, number collisions, blank ferry labels, disconnected geometry, reversed/loop patterns, conditional-service rejection and after-midnight frequency instances.
