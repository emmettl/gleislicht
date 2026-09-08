# Basel local network: first timetable and geometry audit

Started **8 September 2026**, following the [regional source survey](REGIONAL-NETWORK-SURVEY.md). The first milestone is a reproducible BVB/BLT timetable candidate, a complete download of the two Basel-Stadt line layers, and a measured geometry failure inventory. It is not yet an application study or a complete TNW network.

The timetable foundation works, including foreign stops. **The official BS layers alone do not yet support a credible complete BVB/BLT animation.** All four operator/mode groups fail the initial 95% geometry gate. Payloads are comfortably within the existing regional budgets. The next work is broader geometry acquisition and line-graph correction, followed by scoped regional rail.

## Scope and source integrity

- Admit GTFS agencies **823 (BVB)** and **37 (BLT)** in bus/tram modes. Restore tram route IDs by exact source trip identity. BLT line **19** is classified as tram in this feed and remains in the audit.
- Preserve every admitted journey's entire ordered stop chain, including foreign termini and after-midnight calls. The audit compares all platform IDs, arrival/departure times, trip bounds, line names, categories and platform coordinates/names with the source archive. Missing or altered chains fail rather than silently shrinking coverage.
- Use one **service day**: trips beginning before 24:00 on that day's calendar. One trip beginning exactly at 24:00 is removed from each raw fixture. Previous-day carry-in is not imported, so this is not a continuous civil-midnight operational record. The Tuesday artifact has no movements in its first two chunks under these semantics.
- Rebuild stops and edges from retained trips, removing unused topology. No canton or national boundary clips local journeys. The observed Tuesday extent is approximately **7.4595–7.8750°E, 47.3860–47.5994°N**.
- Exclude national/regional rail and other operators such as AAGL, SWEG and distribus from this first milestone. Their presence in the GIS source does not admit their timetable services. A later TNW label needs a broader membership audit.
- There are no active frequency templates in these BVB/BLT fixtures. This audit currently fails if one is introduced: the app's existing frequency importer can expand it, but the new completeness audit would need to validate those generated instances before accepting them.

## Measured weekday and Sunday

Both fixtures use Swiss GTFS **20260905** and Node **24.20.0**, with the same official BS geometry retrieved on 8 September 2026. Tuesday is **2026-09-08**; Sunday is **2026-09-13**. Geometry percentages count accepted scheduled stop-to-stop occurrences, not distinct lines.

| Operator / mode | Tuesday trips | Tuesday geometry | Sunday trips | Sunday geometry |
| --- | ---: | ---: | ---: | ---: |
| BVB tram | 2,316 | 79.32% | 1,536 | 78.90% |
| BVB bus | 2,915 | 91.35% | 1,897 | 91.11% |
| BLT tram | 829 | 83.26% | 514 | 82.15% |
| BLT bus | 2,106 | 19.76% | 1,422 | 23.28% |
| **Total timetable trips** | **8,166** | — | **5,369** | — |

The Tuesday candidate has **1,223 platform records**, **50 active source route records**, and **2,027 unique directed route/platform pairs**. Of those pairs, **1,127 (55.60%)** match the initial graph rules, producing **1,043 shared paths**. Unique-pair coverage is lower than movement-weighted coverage because frequently used city paths are better represented. These are automated matches, not reviewed directions or operator-certified paths.

The committed reports contain exact archive/source hashes, every failed directed pair, per-route counts, worst accepted endpoint snaps, boundary controls and chunk sizes:

- [Tuesday audit](../data/basel-study-audit.json)
- [Sunday audit](../data/basel-study-sunday-audit.json)

## Cross-border controls

Source-stop names are retained verbatim. The following controls are present and their immediately adjacent movements pass the initial geometric checks in both fixtures. This does not establish correct geometry along the whole route.

| Control stop | Tuesday trips calling | Sunday trips calling | Accepted adjacent movements, Tuesday / Sunday |
| --- | ---: | ---: | ---: |
| St-Louis, Gare de Saint-Louis | 139 | 94 | 139 / 94 |
| Weil am Rhein, Bahnhof/Zentrum | 190 | 118 | 190 / 118 |
| Leymen, Station (F) | 124 | 80 | 248 / 160 |

BVB's [official network page](https://www.bvb.ch/de/fahrplan/liniennetz/) identifies the French/German extensions and a temporary network valid **7 September–23 October 2026**. This reinforces the need to compare dated timetable patterns with geometry; download time alone cannot establish validity for those diversions.

## Geometry acquisition and matching

[`download-basel-sources.mjs`](../scripts/download-basel-sources.mjs) fetches the full official [Basel WFS](https://wfs.geo.bs.ch/?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities) layers:

| Layer | Features downloaded | Interpretation |
| --- | ---: | --- |
| `ms:LN_Tramlinie` | 46 | Tram polylines, branches and loops; BVB and BLT |
| `ms:LN_Buslinie` | 86 | Bus polylines including operators outside this candidate |

The downloader requests WGS84 GeoJSON, checks `numberMatched` before and after each whole-layer download, rejects truncated results and duplicate complete features, and writes the source catalogue only after both layers validate. The service omits feature IDs, so feature fingerprints supplement the count checks. Counts are GIS objects, not distinct service lines. The catalogue preserves source URLs, retrieval time, byte sizes and SHA-256 values; `validOn` remains explicitly unknown.

The [official model](https://models.geo.bs.ch/Modellbeschreibungen/LN_LiniennetzOeV_KGDM_V1_0.pdf) documents the line fields. The adapter groups by **source operator + mode + exact line label**. Joint `BVB / Südbadenbus` geometry may support a BVB trip, but matching line numbers alone never admit another operator. LineString and MultiLineString are handled; separate parts receive no artificial connecting edge.

Stops project onto source segments rather than snapping to distant vertices. The candidate matcher treats the line geometry as an **undirected graph**, finds a shortest path, and accepts it only when:

- Both pre-connector endpoint gaps are at most **120 m**.
- Network length is at most the larger of **1,200 m** or **4.5×** direct stop distance.
- The movement does not collapse to one graph location or consist mainly of off-network endpoint connectors.

These thresholds are project audit rules, not an official source accuracy claim. Accepted paths retain short platform connectors and source vertices. The largest accepted Tuesday snap is **109.1 m**. Graph topology, opposite tracks, one-way streets and temporary routes remain unreviewed; a match is not proof of correct routing.

Source provenance credits **Geodaten Kanton Basel-Stadt**. The [March 2026 cantonal notice](https://www.bs.ch/news/2026-anpassung-der-kgeoiv) changes general attribution requirements for public geodata and allows dataset-specific exceptions. Preserve the source credit and capture the selected dataset's applicable terms when publishing. No OSM-derived paths are added by this milestone.

## What the failures reveal

Tuesday has **900 unmatched unique directed pairs**:

| Failure | Unique pairs | Next investigation |
| --- | ---: | --- |
| No matching operator/mode/line graph | 569 | Broader BL geometry, tram 19 infrastructure, temporary bus patterns |
| Endpoint farther than 120 m from the line | 273 | Dated diversions, route branches and platform/source alignment |
| Implausible network detour | 54 | Disconnected or insufficiently connected source polylines, nearest projection choice and loops |
| Collapsed or mostly off-network movement | 4 | Platform placement, repeated-stop loops and line alignment |

Missing graphs include BLT buses **49, 56, 58, 59, 60, 62–66, 92, 93, 105–110**, BLT replacement line **EV**, tram **19**, and BVB **EV3/EV8**. These are exact source-line join failures, not a finding that the services lack all possible geometry.

The layers also need routing interpretation. For example, adjacent Allschwil stops on tram 6 project close to source geometry yet yield rejected multi-kilometre paths. Do not label those failures missing data or cure them by loosening the detour threshold. Inspect the source's separate directional polylines and their connectivity. Tram 8's temporary stop sequence around Brombacherstrasse/Musical Theater produces several large endpoint gaps; compare it with the dated diversion before changing line admission.

Basel-Landschaft's [TNW line-network product](https://www.baselland.ch/politik-und-behorden/direktionen/volkswirtschafts-und-gesundheitsdirektion/amt-fur-geoinformation/geoportal/geodaten/verkehr) is the next official acquisition target for the wider bus coverage. For tram 19, examine the existing FOT rail infrastructure independently of the bus matcher. Replacement-bus patterns may require dated official alignments or a separately attributed OSM/pfaedle pass.

## Payload and implementation boundary

| Artifact, gzip | Tuesday | Sunday | Existing ceiling |
| --- | ---: | ---: | ---: |
| Day manifest | 235.1 KiB | 204.2 KiB | 650 KiB |
| Morning snapshot | 360.7 KiB | 256.3 KiB | 1,600 KiB |
| Largest two-hour movement chunk | 130.7 KiB | 80.9 KiB | 450 KiB |

Each day has twelve two-hour chunks. These measurements cover data only. Candidate artifacts are generated outside `public/`; no study selector, daily refresh, browser fetch or new runtime dependency is installed. The initial gate requires **95% in each of the four groups**, together with the existing gzip limits. Both dates fail geometry. `--check` deliberately exits nonzero while retaining the report and candidate for inspection. Passing this technical gate later would still leave directional review, calendar semantics and UI validation to complete.

## Reproduce and continue

Use the project's Node 24 environment. Keep the matching GTFS archive and the downloaded geometry directory: current WFS requests may return changed geometry in a later run. The reports identify the inspected bytes, but do not bundle full source exports.

```sh
node scripts/download-basel-sources.mjs /tmp/basel-sources

node scripts/audit-basel-study.mjs \
  --archive /path/GTFS_FP2026_20260905.zip \
  --sources /tmp/basel-sources --date 2026-09-08 \
  --output-directory /tmp/basel-audit --check
```

Repeat with `--date 2026-09-13` and a separate output directory for Sunday. An optional `--snapshot /path/raw.json` avoids repeated ingestion; the archive identity, source calls and coordinates are still verified. Output includes `basel-audit.json`, `basel-local-morning.json`, `basel-local-day-manifest.json` and `basel-local-day-chunks/`.

Focused checks:

```sh
npx vitest run scripts/basel-line-geometry.test.mjs
```

Ten tests cover endpoint projection, reverse paths, connected/disconnected geometry, mixed operators, multi-part lines, rejection limits, movement/unique-pair accounting, preserved foreign terminals, source-download completeness and per-group payload/coverage gates. Both real fixtures additionally pass complete source-journey verification; their geometric acceptance gate fails as documented.

Continue in this order: acquire broader BL geometry and tram 19 infrastructure; resolve graph connectivity and dated diversions; review both directions and border branches; add a bounded rail backbone; then integrate lazy study selection, labels/translations, sharing, source refresh/recovery and desktop/phone checks. Keep the first release labelled by its actual admitted network rather than promising complete TNW.
