# Basel local network: timetable and geometry audit

Started **8 September 2026**, following the [regional source survey](REGIONAL-NETWORK-SURVEY.md). The candidate now combines a reproducible BVB/BLT timetable, both Basel-Stadt line layers, FOT tram 19 infrastructure, a per-pattern OSM bus fallback, and narrowly scoped September tram diversions. It is not yet an application study or a complete TNW network.

The timetable foundation works, including foreign stops. **All four operator/mode groups now pass the 95% geometry gate on both dates**, with payloads inside the existing budgets. This is a technical candidate, not a release approval: individual routes still have gaps, running tracks and one-way choices need review, and regional rail plus app integration remain outstanding.

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
| BVB tram | 2,316 | 97.32% | 1,536 | 97.70% |
| BVB bus | 2,915 | 99.54% | 1,897 | 99.54% |
| BLT tram | 829 | 99.57% | 514 | 100.00% |
| BLT bus | 2,106 | 98.84% | 1,422 | 99.04% |
| **Total timetable trips** | **8,166** | — | **5,369** | — |

The Tuesday candidate has **1,223 platform records**, **50 active source route records**, and **2,027 unique directed route/platform pairs**. Of those pairs, **1,819 (89.74%)** have every occurrence matched, producing **1,663 shared paths**. Unique-pair coverage is lower than movement-weighted coverage because frequently used city paths are better represented. These are automated matches, not reviewed directions or operator-certified paths.

The initial BS-only baseline was 79.32% / 78.90% for BVB tram and 83.26% / 82.15% for BLT tram, Tuesday / Sunday respectively. The earlier tram-19/line-projection milestone raised those figures to 89.00% / 89.08% and 97.98% / 100.00%. The new bus and diversion fallbacks preserve every timetable trip and every previously accepted path.

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

This resolves all **54 Tuesday / 50 Sunday** rejected detours, covering **5,877 / 3,969** scheduled movements. The largest additional gap used is **3.303 m**. Reports list every accepted alternative under `geometry.projectionAlternatives`, including the original failure and extra snap distance. That list now also contains the separately labelled diversion choices; filtering out `diversionRule` reproduces these original counts. For example, Allschwil Kirche → Ziegelei changes from a rejected 2,597 m return around the line to a 447 m path, with only 1.10 m additional snap. This remains an undirected inference; it does not establish the correct running track.

These thresholds are project audit rules, not an official source accuracy claim. Accepted paths retain short platform connectors and source vertices. The largest accepted official-geometry Tuesday snap is **109.1 m**; the imported bus caches report maxima of **112.3 m (BLT)** and **78.3 m (BVB)** across both dates. Opposite tracks, one-way streets and temporary routes still need directional and date review.

Source provenance credits **Geodaten Kanton Basel-Stadt**. The [March 2026 cantonal notice](https://www.bs.ch/news/2026-anpassung-der-kgeoiv) changes general attribution requirements for public geodata and allows dataset-specific exceptions. Preserve the source credit and capture the selected dataset's applicable terms when publishing. The bus fallback adds separately attributed OSM-derived paths, described below.

## Tram 19 infrastructure

[`basel-rail-geometry.mjs`](../scripts/basel-rail-geometry.mjs) isolates the FOT component anchored by operating points **8500087 (Waldenburg)** and **8519350 (Liestal [Gleis 4])**. The current export contains a separate chain of **13 nodes and 12 segments**. The adapter requires that exact endpoint identity, a simple connected chain and connected source coordinates; a changed branch or synthetic join is rejected. Nearby SBB infrastructure at Liestal is excluded by topology before geographic matching.

The existing XTF reader simplifies the LV95 source by **2 m** before conversion to WGS84. The Basel matcher then applies the same 120 m endpoint and 4.5× / 1,200 m detour limits. Tram 19 accepts **1,529/1,529 Tuesday movements (139 trips)** and **1,309/1,309 Sunday movements (119 trips)**. This adds geometry to an already admitted tram service; it adds no SBB journeys or other operators.

The [FOT STAC record](https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz) advertises the [XTF asset](https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf); its published checksum matches the retained file. The asset update is **18 January 2025**, while the item datetime is **6 July 2021**. Neither establishes service-date validity for September 2026. Reports retain the file SHA-256, all selected segment/node IDs, source URL, simplification and explicit `validOn: null` separately from BS provenance.

## Bus and dated diversion fallbacks

The [geometry pipeline](BASEL-GEOMETRY-PIPELINE.md) documents reproducible preparation, matching, provenance and cache application. The [committed bus cache](../data/basel-road-cache.json) contains **226 complete route/platform patterns**, split by BVB and BLT. It fills only failed bus segments and adds **27,272 Tuesday / 17,075 Sunday** scheduled movement paths. Exact source route IDs, full ordered platform chains and coordinates control cache reuse; matching an A→B pair in one pattern never fills a different pattern automatically. Every original accepted path is retained.

The OSM-derived cache uses the existing pfaedle road pipeline with **120 m** snapping, **6× / 1,500 m** detour limits and **5 m** simplification. Candidate metadata credits **OpenStreetMap contributors / ODbL 1.0** separately from BS and FOT. Raw match coverage and application coverage differ because successful official paths have priority. Both EV3 and EV8 now have complete geometry on both dates.

The [dated policy](../data/basel-tram-diversions.json) admits only listed directed pairs for tram **3, 6, 8 and 17**, on **8 and 13 September 2026**. It combines the broad corridors in [BVB's construction notices](https://www.bvb.ch/de/aktuelle-informationen/baustelleninformationen/) with intermediate GTFS calls. Other dates, operators, buses and unlisted pairs are excluded. Line 6's asymmetric Markthalle calls are explicit. The adapter uses existing BS tram infrastructure, compares source parts within the same 5 m additional snap allowance, and applies a tighter urban detour ceiling of **2× direct distance or 600 m**. It adds **4,372 Tuesday / 2,726 Sunday** accepted movements across **42 / 30** unique pairs. Long returns caused by missing source joins remain rejected.

## Remaining failures and source feasibility

Tuesday still has **208 unique directed route/platform pairs** with at least one unmatched occurrence; Sunday has **132**. The main issue inventory retains each pair's original official-line reason (Tuesday: 205 endpoint gaps, two missing-line joins, one collapsed movement) and any attempted diversion result. The final road-specific causes and per-date occurrence counts are in `geometry.roadFallback.issues`.

- **BVB bus:** 218 Tuesday / 132 Sunday unmatched movements. The temporary General Guisan-Strasse platform on line 33 lies **125.27 m** from the inferred road match; it remains outside the 120 m guard. Tuesday also retains 32 zero-interval movements between distinct Otto Wenk-Platz platforms on line 34.
- **BLT bus:** 344 Tuesday / 186 Sunday unmatched movements, at the replacement-service Schaulager platform (**123.75 m** snap). Its two adjacent segments remain rejected. Wider BLT routes now have inferred roads even where no BS line graph exists.
- **Trams:** remaining gaps include special/depot patterns outside the listed corridors and insufficient source connectivity near Dreirosenbrücke/Novartis Campus, Burgfelderplatz/Hegenheimerstrasse, Heuwaage/Zoo Bachletten, and Bahnhof SBB/Aeschenplatz. Neither short endpoint gaps nor an announced diversion proves that the current source graph contains the correct directed connection.

Passing each operator/mode group is not a per-route guarantee. Tuesday's **BLT EV (93.84%)**, **BVB tram 3 (94.52%)** and **BVB bus 33 (94.91%)** remain below 95% individually. They stay visible in the candidate and in the per-route report.

Basel-Landschaft's [TNW line-network product](https://www.baselland.ch/politik-und-behorden/direktionen/volkswirtschafts-und-gesundheitsdirektion/amt-fur-geoinformation/geoportal/geodaten/verkehr) remains the official acquisition target for wider bus coverage. Its [dataset documentation](https://www.geocat.ch/geonetwork/srv/api/records/add1f3ed-0310-40ce-9d78-ffd1163b54c9/formatters/bl_datadoku_html?language=ger) identifies dataset **41-BL**, update **8 August 2024**, and **EPSG:2056 shapefile** delivery. The description promises TNW coverage, while the perimeter field says canton BL: inspect the actual export before asserting cross-border completeness.

The public [GeoShop product](https://www.geo.bl.ch/geoshop/client5/index.html?menu=order&password=public&product=VE_OEV_SHP&user=public&view=bl_wms&x1=2593175&x2=2641825&y1=1237200&y2=1277800) uses product **VE_OEV_SHP**, free polygon/box selection, and an order interface whose configured delivery field is email. No order was submitted and no shapefile was acquired. The [GeoView client](https://geoview.bl.ch/) advertises `oev_verkehrslinien` and a WFS proxy, but both GetCapabilities and a single-feature GetFeature probe returned **HTTP 403** on 8 September. These results establish a limit of the tested automated access path, not that the dataset is private or unavailable through GeoShop. Preserve the official export schema, dates and operator fields before adding an adapter.

The [supplemental source probes](../data/basel-supplemental-source-probes.json) record these access findings and FOT catalogue verification. The OSM/pfaedle fallback now covers the wider buses and most replacement-service movements; the official export remains unacquired and its schema, date validity and boundary coverage unverified.

## Payload and implementation boundary

| Artifact, gzip | Tuesday | Sunday | Existing ceiling |
| --- | ---: | ---: | ---: |
| Day manifest | 270.2 KiB | 243.9 KiB | 650 KiB |
| Morning snapshot | 397.6 KiB | 300.8 KiB | 1,600 KiB |
| Largest two-hour movement chunk | 132.3 KiB | 85.1 KiB | 450 KiB |

Each day has twelve two-hour chunks. These measurements cover data only. Candidate artifacts are generated outside `public/`; no study selector, daily refresh, browser fetch or new runtime dependency is installed. The initial gate requires **95% in each of the four groups**, together with the existing gzip limits. Both dates now pass with `--check` exiting zero. A failing run still retains its report and candidate. Passing the technical gate leaves directional review, calendar semantics and UI validation to complete.

## Reproduce and continue

Use the project's Node 24 environment. Keep the matching GTFS archive and the downloaded geometry directory: current WFS requests may return changed geometry in a later run. The reports identify the inspected bytes, but do not bundle full source exports.

```sh
node scripts/download-basel-sources.mjs /tmp/basel-sources

node scripts/audit-basel-study.mjs \
  --archive /path/GTFS_FP2026_20260905.zip \
  --rail-geometry /path/schienennetz_2056_de.xtf \
  --bus-cache data/basel-road-cache.json \
  --tram-diversions data/basel-tram-diversions.json \
  --sources /tmp/basel-sources --date 2026-09-08 \
  --output-directory /tmp/basel-audit --check
```

Repeat with `--date 2026-09-13` and a separate output directory for Sunday. Omit all three optional geometry inputs to measure the BS-only case with the corrected matcher. The diversion policy rejects other service dates until reviewed. See the [geometry pipeline](BASEL-GEOMETRY-PIPELINE.md) for rebuilding the two-operator bus cache and isolating each improvement. An optional `--snapshot /path/raw.json` avoids repeated ingestion; the archive identity, source calls and coordinates are still verified. The follow-up Sunday run reassembled the previously audited chunks after checking their hashes and duplicate trip identity, then reverified all calls against GTFS. Output includes `basel-audit.json`, `basel-local-morning.json`, `basel-local-day-manifest.json` and `basel-local-day-chunks/`.

Focused checks:

```sh
npx vitest run scripts/basel-line-geometry.test.mjs \
  scripts/basel-road-geometry.test.mjs scripts/basel-tram-diversions.test.mjs
```

Twenty-six focused tests cover line projection, alternate source parts, isolated FOT topology, full bus-pattern and agency identity, stale/moved platforms, chunk integrity, multi-date preparation, directed diversion admission, conservative rejection and per-group gates. Both real fixtures pass complete source-journey verification and the technical gate. Independent checks compare every trip and previously accepted path with the earlier milestone, recount coverage and verify chunk hashes and exact path endpoints. Plots of representative EV3, EV8, BLT EV/60/110 and tram 3/6/8/17 patterns informed the tighter urban diversion bound; they do not certify running tracks.

Continue with the remaining provisional-platform and tram-join failures; review both directions and border branches; add a bounded rail backbone; then integrate lazy study selection, labels/translations, sharing, source refresh/recovery and desktop/phone checks. Broader official BL geometry remains a useful alternative source to compare with the OSM bus inferences. Keep the first release labelled by its actual admitted network rather than promising complete TNW.
