# Bern canton: source adapter, regional feed and admission audit

Study by **Gleislicht**, using the pinned national timetable and the canton’s OEVTP source. Validation dates: **Friday 4 September and Sunday 6 September 2026**, each a Europe/Zurich civil day including the preceding service day’s after-midnight journeys. This is a reproducible historical regional feed, not a live service or a claim of year-round completeness.

The full-source census identifies **705 GTFS route records from 101 agency identities**, covering **all ten districts** of Bern. All **518 OEVTP line records and 5,321 OEVTP stop records** are retained in the source snapshot. The regional feed admits complete directed stop patterns only: **33,086 Friday and 29,015 Sunday journey instances**. Failed patterns remain in the audit; no unsourced straight-line segments are emitted as admitted journeys.

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

Admitted journeys retain 677 Friday and 695 Sunday out-of-canton stop records. Full cross-canton journeys fail admission if the official source does not cover their complete chain. Rail and bus replacement services remain separate GTFS identities.

## Directed-pattern and geometry results

| Measure | Friday | Sunday |
| --- | --- | --- |
| Candidate journey instances | 43,653 | 38,587 |
| Scheduled journey instances | 28,696 | 22,462 |
| Representative headway instances (exact_times=0) | 14,957 | 16,125 |
| Admitted scheduled instances | 19,059 | 13,820 |
| Admitted representative headway instances | 14,027 | 15,195 |
| Admitted total instances | 33,086 | 29,015 |
| Directed stop patterns: complete / candidate | 1,719 / 2,582 | 1,336 / 2,108 |
| Route-specific directed stop pairs: matched / candidate | 10,514 / 12,321 | 11,230 / 13,244 |
| All modeled segment occurrences: matched / candidate | 289,288 / 314,668 | 207,439 / 229,859 |
| All modeled segment occurrence coverage | 91.93% | 90.25% |
| Scheduled-only segment occurrence coverage | 91.72% | 89.74% |
| Carry-in journeys: admitted / candidate | 202 / 334 | 483 / 816 |
| Night-route journeys: admitted / candidate | 0 / 14 | 158 / 307 |
| Patterns revisiting a platform: admitted / candidate | 41 / 65 | 38 / 59 |

Coverage percentages use **all candidates**, not only the admitted feed. Every admitted journey has 100% matched segments by construction; that must not be advertised as 100% cantonal service coverage. Headway grids are deterministic representative motion, not exact scheduled departures or GPS. Their counts can be large on continuously operating lifts; scheduled-only counts and coverage are therefore reported separately. Calendar exceptions, Saturday-night carry-in, interval end exclusivity and the source frequency anchor are preserved. A journey with conditional pickup/drop-off is excluded from fixed-motion admission, rather than asserting an on-demand departure; booking conditions absent from GTFS remain an upstream limitation.

There are **1,317 shared**, **1,265 Friday-only** and **791 Sunday-only** patterns. Pattern identity is the GTFS route, direction_id and full ordered platform sequence; reversed trips and repeated loop calls cannot collapse into a set. Each report contains a stop-by-stop match mask. Route-specific directed pairs retain source stop IDs, endpoint snap distances, failure reasons and occurrence counts.

| Mode | Friday admitted / candidate; segment coverage | Sunday admitted / candidate; segment coverage |
| --- | --- | --- |
| bus | 11,708 / 15,623; 94.12% | 7,324 / 10,453; 92.42% |
| tram | 1,340 / 1,588; 98.20% | 1,064 / 1,252; 98.14% |
| rail | 2,855 / 4,150; 82.84% | 2,434 / 3,698; 82.57% |
| ferry | 36 / 40; 93.63% | 34 / 38; 93.55% |
| funicular | 2,753 / 2,753; 100.00% | 2,605 / 2,605; 100.00% |
| cableway | 14,394 / 19,499; 79.50% | 15,554 / 20,541; 80.75% |

### Adapter and admission policy

OEVTP’s `tucode` is an operator abbreviation, not a GTFS agency ID. Mapping checks the pinned agency name as well as its ID, compatible mode, and complete passenger line number. Moonliner uses the full `tuname` because it spans multiple operators. Rack railways have explicit R-prefix handling. Cable and boat records with blank display numbers use their timetable field; exceptional identifiers are enumerated in the crosswalk. The Grindelwald bus source maps to STI identities 859/605, BOB/WAB replacement records have explicit line overrides, and BLS boat cruise IDs are tested against their lake-specific source lines. Rail shapes are never reused for a bus merely because its number resembles a rail line. The S8 extension has a separate, dated shared-corridor exception supported by official timetable field 308, with a pinned evidence hash.

435 of 518 source line records have a reviewed crosswalk candidate among the canton-serving GTFS routes. The remaining 83 remain individually listed, including unresolved operators, source lines beyond the canton, missing timetable entries and changed identifiers. A crosswalk candidate is not geometry admission.

The decoder checks GeoPackage/WKB headers, EPSG:2056, geometry types, byte exhaustion and coordinate ranges; it preserves disconnected parts and polygon holes. Derived geometry uses original XY vertices without simplification, the swisstopo approximate CH1903+/WGS84 formula and seven-decimal output. Exact shared vertices alone create graph connections; line crossings do not automatically join and disconnected pieces are not bridged. Projected endpoint paths use these limits:

| Mode | Maximum platform snap | Maximum path length |
| --- | --- | --- |
| Bus, tram, cableway, funicular | 80 m | max(1,200 m, 4.5 × straight distance) |
| Rail | 120 m | max(3,000 m, 4.5 × straight distance) |
| Ferry | 150 m | max(1,200 m, 4.5 × straight distance) |

Alternative source-part projections may be at most 5 m farther from each endpoint than its nearest projection, and must still satisfy the snap limit. Collapsed paths fail. Every segment is oriented from its actual preceding call to its next call; the final artifact checker verifies endpoint orientation after all stop/path reindexing. A pattern is admitted only if **every segment** passes. Boats use official water-line geometry and mountain transport its own mode-compatible line. No road-routing, generic rail-infrastructure or straight-line fallback is inserted.

**Physical limits:** these are undirected official centrelines with directions inferred from GTFS calls. They do not certify one-way road legality, a particular running track, tunnel level, boat navigation safety or current diversions. They are suitable as dated schematic movement candidates, not operational navigation. No authenticated realtime feed or temporary-diversion layer was exercised. Two September days do not establish winter pass, holiday or year-round service coverage.

## Exclusions and review evidence

Across both dates: **281 routes admit all dated journeys**, **101 admit some**, **140 admit none**, and **183 are inactive on both dates**. The complete route appendix distinguishes these states; inactive annual records are not silently erased or described as failed geometry.

| Unmatched geometry reason | Friday directed pairs / occurrences | Sunday directed pairs / occurrences |
| --- | --- | --- |
| collapsed-path | 2 / 15 | 0 / 0 |
| disconnected-line | 102 / 2,530 | 111 / 1,600 |
| endpoint-gap | 708 / 7,637 | 690 / 7,014 |
| implausible-detour | 13 / 167 | 13 / 87 |
| missing-line | 982 / 15,031 | 1,200 / 13,719 |

Concrete cases preserved for follow-up:

- **BERNMOBIL 7A/8A buses:** no reviewed mode-compatible line crosswalk. The source tram 7/8 paths are not treated as bus geometry. Some tram 6 patterns also fail endpoint matching.
- **RBS S8 — resolved in the follow-up:** the OEVTP S8 record ends at Jegenstorf, but [official 2026 timetable field 308](../data/bern-sources/rbs-corridor-308-2026.pdf), dated 3 September 2025, establishes the shared S8/RE5 corridor through Bätterkinden to Solothurn. The explicit agency-88 rail-only crosswalk now permits the preserved 308_RE centreline for S8. All 148 Friday and 118 Sunday S8 journeys pass every directed segment with unchanged limits, admitting 76 additional Friday and 75 additional Sunday journeys. This does not grant other RBS lines or buses access to that corridor. The evidence file hash and attribution accompany the feed.
- **Eiger Express 2444:** its two directed endpoint pairs have a maximum snap of **215.3 m**, exceeding the cable limit. **Grindelwald–Männlichen GGM** has **93.4 m** terminal mismatch. Matching the installation’s identity does not authorize moving its source stops or raising the threshold.
- **Schilthorn variants 24602/24603/24604:** changed installation identifiers lack reviewed source-line assignments. The matched 2460 patterns do not imply all variants are covered.
- **Matte lift 2352 and Wiriehorn 2365:** no matching acquired OEVTP line. **SBB/BLS/SOB and MOB long-distance or changed labels**, replacement buses, and complete journeys beyond the source extent remain explicitly excluded or partial. No whole operator is claimed complete from its admitted subset.
- **Biel/Seeland, Oberaargau, Emmental and regional bus terminal/platform gaps:** many routes have high segment coverage yet fail whole-pattern admission. The route and directed-pair files identify each failure; high occurrence coverage does not excuse a missing terminal movement.

## Application display release

Bern is selectable as **Bern · canton and Alpine connections**, with full-day loading by default, morning playback, stop/route search, links that restore the date and selection, and retry after failed loads. English, German, French and Italian labels identify partial coverage and representative motion. The default application timetable is **4 September 2026**. An unavailable linked date is explicitly reported; it is never silently stamped onto older journeys. A Sunday display release can be built from the separately audited 6 September fixture. Winter, holidays and other dates still require a new admission audit.

The [display-release audit](../data/bern-audit/display-release.json) records both dates, original manifest and admission-audit hashes, movement counts, geometry error and payloads. Display geometry uses Douglas–Peucker with a **5 m maximum distance to each retained chord in approximate LV95**. A separate verifier checks every original subchain, retained vertex order and exact segment endpoints. This bounds display position, not arc-length distortion or survey accuracy. All original source calls, journey identities, schedules, frequency semantics, directed segment indices and chunk bytes remain unchanged. Admission still uses the unsimplified geometry.

| Payload (gzip bytes) | Friday | Sunday | Budget |
| --- | ---: | ---: | ---: |
| Manifest | 574,296 | 583,856 | 665,600 |
| Morning | 849,856 | 737,289 | 1,638,400 |
| Largest two-hour chunk | 352,190 | 294,078 | 460,800 |

The delivered [application manifest](../public/data/bern-region-day-manifest.json) and [morning snapshot](../public/data/bern-region-morning.json) use the shared regional loading and integrity checks. A refresh only builds explicitly reviewed dates. Other requested dates, failed builds or acquisition failures retain a verified published study; a missing first-deployment manifest may use the complete checked-in release. Missing chunks never trigger a mixture of published and local files. Geometry uses the cantonal source for every mode; the release does not claim BAV rail or OSM road provenance.

The integration checks reproduced both dates byte-for-byte at the movement level and exercised tampered geometry/counts/credit, excessive simplification, changed dates, first publication and damaged recovery. Desktop Chromium and iPhone WebKit checks cover lazy selection, S8 and Solothurn search, sharing, afternoon seeking, midnight retry, morning retry and all four languages. The production build and original cantonal audit checks pass.

A follow-up inspection of the separately retained [BAV Eiger Express source](../data/jungfrau-cableway-source.json) and its [endpoint audit](../data/jungfrau-study-audit.json) found approximately 213.3 m / 135.9 m offsets at the shared timetable stops. This does not resolve the 80 m Bern endpoint gate. It remains excluded here; the Jungfrau study's installation-specific display policy must not silently weaken the canton adapter. The other route-specific and seasonal exclusions above remain open research work.

## Source dates, attribution and reuse

| Source | Data vintage / release | Preserved evidence and attribution |
| --- | --- | --- |
| National GTFS | Feed 20260902; valid 2025-12-14 to 2026-12-12 | opentransportdata.swiss; original platform IDs, calendar and frequency semantics |
| Bern OEVTP lines and stops | Updated 2026-01-01; package published 2026-07-09; acquired 2026-09-08 | Original ZIP, decoded records, metadata PDFs and terms in data/bern-sources |
| swissBOUNDARIES3D | 2026-01 edition | © swisstopo; complete Bern and ten district rows preserved with original geometry blobs |

**Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern.** The [official metadata](https://www.agi.dij.be.ch/de/start/geoportal/geodaten/detail.html?code=OEVTP&type=geoproduct) and packaged [line metadata PDF](../data/bern-sources/metadata_oevtp_linie_de.pdf) identify the data vintage. Free private/commercial use and reproduction require attribution; online applications must link the metadata and recipients must receive the terms. [German terms](../public/data/bern-region/terms_of_use_de.pdf) and [French terms](../public/data/bern-region/terms_of_use_fr.pdf), dated **20 January 2026**, accompany the feed. No generic CC licence is assigned to these cantonal data. The original acquired archive is kept because the download URL is mutable.

Timetable data: **opentransportdata.swiss**; processed feed and analysis: **Gleislicht**. The [platform terms](https://opentransportdata.swiss/en/terms-of-use/) require attribution, refresh of raw data and the data user’s authorship for processed results. This delivery is explicitly an archival two-date study; it must be rebuilt and re-audited before being presented as current service. Administrative boundaries: **© swisstopo**, under the [official OGD terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices). No OpenStreetMap geometry is used in this adapter.

SHA-256 identities:

- National GTFS ZIP: `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`.
- Original OEVTP ZIP: `4e2a4fcca08cc219c871d42c957753c09318ace2172fb3614c4fe71b20a4fe19`.
- Original boundary GeoPackage: `1f122cb7a06f2d312a84b7c0a91116348ba907054d487f0a70b9d2302984e6fc`.
- Extracted boundary-row snapshot: `b0bfb7d0d3d7357aaaec2de0335dfc1beb83274b2143d876260e86b227a41dd0`.
- Decoded source: `36146aab8e303a8bc9b6864f0974f2f726aed809cf340958f5233e5e08936956`.
- Operator/line crosswalk: `e300555440d56a0d4fa58437cdab1b746e40dc354b02c5765ef8d87231550c45`.

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
npm run data:bern:docs

# Publish the reviewed Friday display, or build the Sunday release separately.
npm run data:bern:release
npm run data:bern:release -- --date 2026-09-06 --output /private/tmp/bern-sunday-display
npx vitest run scripts/bern-release.test.mjs scripts/regional-refresh.test.mjs
npx playwright test e2e/bern.spec.ts
npx vitest run scripts/bern-region.test.mjs scripts/basel-line-geometry.test.mjs \
  scripts/civil-day.test.mjs scripts/gtfs-frequencies.test.mjs
python3 scripts/test_bern_sources.py
```

The full build creates `data/bern-audit/timetable-cache.json.gz` as an ignored local acceleration cache; subsequent geometry-only builds may pass `--timetable-cache` with that path. Cache source hashes must agree with the pinned GTFS and decoded boundary/line source. To reconstruct the original boundary snapshot, pass the original 2026-01 GeoPackage with `python3 scripts/prepare-bern-sources.py --boundary PATH`.

Validation covers all emitted stop/path references, finite and ordered call times, retained source call counts, original directed platform sequences, complete-path admission, shared-edge orientation, previous-day identity, representative frequencies, twelve contiguous chunks per date, chunk checksums/byte counts, identical repeated journeys across chunks, source/crosswalk hashes, all route/operator/district denominators, and independent reconstruction of pair occurrences from every pattern. Unit tests cover polygon holes and detached parts, Moutier’s transfer, separate operators and modes, number collisions, blank ferry labels, disconnected geometry, reversed/loop patterns, conditional-service rejection and after-midnight frequency instances.
