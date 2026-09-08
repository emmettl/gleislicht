# Basel local network: timetable and geometry audit

Started **8 September 2026**, following the [regional source survey](REGIONAL-NETWORK-SURVEY.md). The candidate now combines a reproducible BVB/BLT timetable, both Basel-Stadt line layers, a bounded correction for opposite source polylines, and FOT infrastructure for tram 19. It is not yet an application study or a complete TNW network.

The timetable foundation works, including foreign stops. **BLT tram now passes the 95% geometry gate on both dates; BVB tram and both bus groups still fail.** Payloads remain within the existing regional budgets. Wider BLT bus coverage and dated replacement/diversion paths are the next geometry priorities, followed by scoped regional rail.

## Scope and source integrity

- Admit GTFS agencies **823 (BVB)** and **37 (BLT)** in bus/tram modes. Restore tram route IDs by exact source trip identity. BLT line **19** is classified as tram in this feed and remains in the audit.
- Preserve every admitted journey's entire ordered stop chain, including foreign termini and after-midnight calls. The audit compares all platform IDs, arrival/departure times, trip bounds, line names, categories and platform coordinates/names with the source archive. Missing or altered chains fail rather than silently shrinking coverage.
- Use one **service day**: trips beginning before 24:00 on that day's calendar. One trip beginning exactly at 24:00 is removed from each raw fixture. Previous-day carry-in is not imported, so this is not a continuous civil-midnight operational record. The Tuesday artifact has no movements in its first two chunks under these semantics.
- Rebuild stops and edges from retained trips, removing unused topology. No canton or national boundary clips local journeys. The observed Tuesday extent is approximately **7.4595–7.8750°E, 47.3860–47.5994°N**.
- Exclude national/regional rail and other operators such as AAGL, SWEG and distribus from this first milestone. Their presence in the GIS source does not admit their timetable services. A later TNW label needs a broader membership audit.
- There are no active frequency templates in these BVB/BLT fixtures. This audit currently fails if one is introduced: the app's existing frequency importer can expand it, but the new completeness audit would need to validate those generated instances before accepting them.

## Measured weekday and Sunday

Both fixtures use Swiss GTFS **20260905** and Node **24.20.0**, with the same official BS geometry retrieved on 8 September 2026 and a hash-verified FOT export. Tuesday is **2026-09-08**; Sunday is **2026-09-13**. Geometry percentages count accepted scheduled stop-to-stop occurrences, not distinct lines.

| Operator / mode | Tuesday trips | Tuesday geometry | Sunday trips | Sunday geometry |
| --- | ---: | ---: | ---: | ---: |
| BVB tram | 2,316 | 89.00% | 1,536 | 89.08% |
| BVB bus | 2,915 | 91.35% | 1,897 | 91.11% |
| BLT tram | 829 | 97.98% | 514 | 100.00% |
| BLT bus | 2,106 | 19.76% | 1,422 | 23.28% |
| **Total timetable trips** | **8,166** | — | **5,369** | — |

The Tuesday candidate has **1,223 platform records**, **50 active source route records**, and **2,027 unique directed route/platform pairs**. Of those pairs, **1,207 (59.55%)** match the graph rules, producing **1,123 shared paths**. Unique-pair coverage is lower than movement-weighted coverage because frequently used city paths are better represented. These are automated matches, not reviewed directions or operator-certified paths.

The initial BS-only baseline was 79.32% / 78.90% for BVB tram and 83.26% / 82.15% for BLT tram, Tuesday / Sunday respectively. The follow-up preserves every timetable trip and previously accepted path. Bus coverage is unchanged.

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

If the closest pair produces a disconnected path or an excessive detour, the matcher may retry the nearest projections on other source parts. Each alternative must be **within 5 m of the nearest gap** at that endpoint and still pass all original limits. Successful nearest matches, endpoint-gap failures and collapsed movements remain unchanged. Alternatives are ranked by summed endpoint gap, then path length; no extra graph edges connect separate tracks or parts.

This resolves all **54 Tuesday / 50 Sunday** rejected detours, covering **5,877 / 3,969** scheduled movements. The largest additional gap used is **3.303 m**. Reports list every accepted alternative under `geometry.projectionAlternatives`, including the original failure and extra snap distance. For example, Allschwil Kirche → Ziegelei changes from a rejected 2,597 m return around the line to a 447 m path, with only 1.10 m additional snap. This remains an undirected inference; it does not establish the correct running track.

These thresholds are project audit rules, not an official source accuracy claim. Accepted paths retain short platform connectors and source vertices. The largest accepted Tuesday snap is **109.1 m**. Opposite tracks, one-way streets and temporary routes still need directional and date review.

Source provenance credits **Geodaten Kanton Basel-Stadt**. The [March 2026 cantonal notice](https://www.bs.ch/news/2026-anpassung-der-kgeoiv) changes general attribution requirements for public geodata and allows dataset-specific exceptions. Preserve the source credit and capture the selected dataset's applicable terms when publishing. No OSM-derived paths are added by this milestone.

## Tram 19 infrastructure

[`basel-rail-geometry.mjs`](../scripts/basel-rail-geometry.mjs) isolates the FOT component anchored by operating points **8500087 (Waldenburg)** and **8519350 (Liestal [Gleis 4])**. The current export contains a separate chain of **13 nodes and 12 segments**. The adapter requires that exact endpoint identity, a simple connected chain and connected source coordinates; a changed branch or synthetic join is rejected. Nearby SBB infrastructure at Liestal is excluded by topology before geographic matching.

The existing XTF reader simplifies the LV95 source by **2 m** before conversion to WGS84. The Basel matcher then applies the same 120 m endpoint and 4.5× / 1,200 m detour limits. Tram 19 accepts **1,529/1,529 Tuesday movements (139 trips)** and **1,309/1,309 Sunday movements (119 trips)**. This adds geometry to an already admitted tram service; it adds no SBB journeys or other operators.

The [FOT STAC record](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz) advertises the [XTF asset](https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf); its published checksum matches the retained file. The asset update is **18 January 2025**, while the item datetime is **6 July 2021**. Neither establishes service-date validity for September 2026. Reports retain the file SHA-256, all selected segment/node IDs, source URL, simplification and explicit `validOn: null` separately from BS provenance.

## Remaining failures and source feasibility

Tuesday now has **820 unmatched unique directed pairs** (down from 900); Sunday has **603**:

| Failure | Unique pairs | Next investigation |
| --- | ---: | --- |
| No matching operator/mode/line graph | 543 | Broader BL geometry and temporary bus patterns |
| Endpoint farther than 120 m from the line | 273 | Dated diversions, route branches and platform/source alignment |
| Implausible network detour | 0 | Resolved by bounded alternative projections; directions still require review |
| Collapsed or mostly off-network movement | 4 | Platform placement, repeated-stop loops and line alignment |

Missing graphs include BLT buses **49, 56, 58, 59, 60, 62–66, 92, 93, 105–110**, BLT replacement line **EV**, and BVB **EV3/EV8**. These are exact source-line join failures, not a finding that the services lack all possible geometry.

Tram 8's temporary stop sequence around Brombacherstrasse/Musical Theater still produces several large endpoint gaps; compare it with the dated diversion before changing line admission. The Allschwil correction does not address these missing alignments.

Basel-Landschaft's [TNW line-network product](https://www.baselland.ch/politik-und-behorden/direktionen/volkswirtschafts-und-gesundheitsdirektion/amt-fur-geoinformation/geoportal/geodaten/verkehr) remains the official acquisition target for wider bus coverage. Its [dataset documentation](https://www.geocat.ch/geonetwork/srv/api/records/add1f3ed-0310-40ce-9d78-ffd1163b54c9/formatters/bl_datadoku_html?language=ger) identifies dataset **41-BL**, update **8 August 2024**, and **EPSG:2056 shapefile** delivery. The description promises TNW coverage, while the perimeter field says canton BL: inspect the actual export before asserting cross-border completeness.

The public [GeoShop product](https://www.geo.bl.ch/geoshop/client5/index.html?menu=order&password=public&product=VE_OEV_SHP&user=public&view=bl_wms&x1=2593175&x2=2641825&y1=1237200&y2=1277800) uses product **VE_OEV_SHP**, free polygon/box selection, and an order interface whose configured delivery field is email. No order was submitted and no shapefile was acquired. The [GeoView client](https://geoview.bl.ch/) advertises `oev_verkehrslinien` and a WFS proxy, but both GetCapabilities and a single-feature GetFeature probe returned **HTTP 403** on 8 September. These results establish a limit of the tested automated access path, not that the dataset is private or unavailable through GeoShop. Preserve the official export schema, dates and operator fields before adding an adapter.

The [supplemental source probes](../data/basel-supplemental-source-probes.json) record these access findings and FOT catalogue verification. Replacement-bus patterns may require dated official alignments or a separately attributed OSM/pfaedle pass; that fallback has not been added.

## Payload and implementation boundary

| Artifact, gzip | Tuesday | Sunday | Existing ceiling |
| --- | ---: | ---: | ---: |
| Day manifest | 245.5 KiB | 222.2 KiB | 650 KiB |
| Morning snapshot | 371.5 KiB | 277.3 KiB | 1,600 KiB |
| Largest two-hour movement chunk | 130.9 KiB | 83.1 KiB | 450 KiB |

Each day has twelve two-hour chunks. These measurements cover data only. Candidate artifacts are generated outside `public/`; no study selector, daily refresh, browser fetch or new runtime dependency is installed. The initial gate requires **95% in each of the four groups**, together with the existing gzip limits. Both dates fail geometry. `--check` deliberately exits nonzero while retaining the report and candidate for inspection. Passing this technical gate later would still leave directional review, calendar semantics and UI validation to complete.

## Reproduce and continue

Use the project's Node 24 environment. Keep the matching GTFS archive and the downloaded geometry directory: current WFS requests may return changed geometry in a later run. The reports identify the inspected bytes, but do not bundle full source exports.

```sh
node scripts/download-basel-sources.mjs /tmp/basel-sources

node scripts/audit-basel-study.mjs \
  --archive /path/GTFS_FP2026_20260905.zip \
  --rail-geometry /path/schienennetz_2056_de.xtf \
  --sources /tmp/basel-sources --date 2026-09-08 \
  --output-directory /tmp/basel-audit --check
```

Repeat with `--date 2026-09-13` and a separate output directory for Sunday. Omit `--rail-geometry` to measure the BS-only case with the corrected matcher. An optional `--snapshot /path/raw.json` avoids repeated ingestion; the archive identity, source calls and coordinates are still verified. The follow-up Sunday run reassembled the previously audited chunks after checking their hashes and duplicate trip identity, then reverified all calls against GTFS. Output includes `basel-audit.json`, `basel-local-morning.json`, `basel-local-day-manifest.json` and `basel-local-day-chunks/`.

Focused checks:

```sh
npx vitest run scripts/basel-line-geometry.test.mjs
```

Fifteen tests cover endpoint projection, reverse paths, connected/disconnected geometry, bounded alternate parts and detour recovery, mixed operators, rejection limits, movement accounting, foreign terminals, source-download completeness, payload/coverage gates and isolated FOT corridor selection. Both real fixtures additionally pass complete source-journey verification; three of four operator/mode groups still fail geometric acceptance.

Continue in this order: acquire broader BL bus geometry; resolve dated diversions and replacement buses; review both directions and border branches; add a bounded rail backbone; then integrate lazy study selection, labels/translations, sharing, source refresh/recovery and desktop/phone checks. Keep the first release labelled by its actual admitted network rather than promising complete TNW.
