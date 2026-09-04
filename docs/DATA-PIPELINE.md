# GTFS data pipeline

Gleislicht treats the national GTFS archive as source material, not a web asset. The current archive is roughly 232 MB compressed and expands to several gigabytes, so it is streamed from the ZIP during preprocessing. Only the compact visual snapshot is committed and shipped.

## Generate the visual snapshots

Download the latest archive from the [Swiss timetable dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), then run:

```bash
npm run data:gtfs -- \
  --archive /path/to/GTFS_FP2026_YYYYMMDD.zip \
  --date 2026-09-04 \
  --window-start 06:45 \
  --window-end 08:45 \
  --focus 07:45
```

The command writes two complementary artifacts: the compact two-hour national network and a 24-hour call sequence for Zürich HB, Bern, Basel SBB and Genève. The script:

1. resolves the active services from `calendar.txt` and `calendar_dates.txt`;
2. selects standard and extended GTFS rail route types;
3. streams the very large `trips.txt` and `stop_times.txt` members without extracting them;
4. derives the scheduled rail graph from consecutive stops; and
5. emits only national trips overlapping the requested time window; and
6. emits all calls during the civil day at the four hub-study stations.

The national 24-hour study is generated separately from the same feed release:

```bash
npm run data:day -- \
  --archive /path/to/GTFS_FP2026_YYYYMMDD.zip \
  --date 2026-09-04 \
  --focus 07:45
```

This writes a compact `public/data/swiss-rail-day-manifest.json` containing the shared topology and eight three-hour movement files under `public/data/swiss-rail-day-chunks/`. The browser requests none of them during the initial morning view. Selecting **24H** loads the manifest and the current three-hour block first, then prefetches the neighbouring blocks for seamless playback. Trips crossing a boundary are present in both adjoining blocks. The renderer also uses a coarse time index so each animation frame considers only services near the current time.

The national GTFS does not include `shapes.txt`, so join both timetable artifacts to the Federal Office of Transport rail network after generation:

```bash
npm run data:rail:shapes -- \
  --source /path/to/schienennetz_2056_de.xtf \
  --tolerance 160

npm run data:rail:shapes -- \
  --source /path/to/schienennetz_2056_de.xtf \
  --snapshot public/data/swiss-rail-day-manifest.json \
  --tolerance 160
```

The join resolves timetable stops through their Swiss stop identifier where available, then by normalized name and proximity. It finds the shortest credible route through the official graph, deduplicates bidirectional stop pairs into shared paths and stores compact path references on trains and weighted edges. The committed morning artifact matches about 87% of segment occurrences and 3,246 of 3,670 timetable stops. A 160-metre simplification tolerance preserves meaningful railway curvature while keeping the compressed opening payload below 0.8 MiB. Cross-border and unresolved segments remain visibly schedule-derived fallbacks.

### Reviewed national refreshes

The `Refresh national timetable data` GitHub Actions workflow checks the official current-resource permalink twice weekly and can also be run manually for a chosen service date. It regenerates the morning, full-day and hub studies together in an isolated runner, downloads and joins the official rail geometry, then runs `npm run data:validate`, the unit tests, typecheck, production build and transfer budget before force-updating the dedicated `automation/refresh-national-data` review branch. The run summary links either to its open pull request or to GitHub's pre-filled comparison page for the first review. Keeping first-time PR creation manual avoids granting every repository workflow permission to approve pull requests. Publishing therefore changes the national artifact set only through a reviewed, validated commit; the automation never overwrites the independently shape-enriched regional studies.

Run the same structural checks locally after any manual regeneration:

```bash
npm run data:validate
```

The validator requires a shared feed version and service date, credible minimum train/stop/edge/call counts, all four hub collections, and a complete set of manifest-matched day chunks. These are deliberately conservative integrity checks rather than a claim that unchanged counts prove timetable correctness.

The same streaming ingester can create a separate multimodal regional artifact. The committed Zürich city study is regenerated from the same national archive with:

```bash
npm run data:zurich -- --archive /path/to/GTFS_FP2026_YYYYMMDD.zip
```

This preset selects a tight city bounding box and all supported Swiss GTFS route types—rail, tram, metro, bus, ferry, cableway and funicular—while skipping the unrelated hub artifact. The resulting JSON is fetched only after the city scale is selected.

Enrich that base artifact with the matching annual ZVV/VBZ GTFS archive:

```bash
npm run data:zurich:shapes -- \
  --archive /path/to/2026_google_transit.zip \
  --feed-version 2026_google_transit
```

The enrichment keeps the national timetable as the source of service truth. It joins ZVV geometry by service category, published line name and directed Swiss `sloid` stop pair, normalising platform suffixes where one feed uses the parent stop. The build refuses to write if fewer than 80% of tram and bus segment occurrences align. The current artifact aligns 36,065 of 36,578 occurrences (98.6%), deduplicates the result into 1,843 paths, and records both sources and the measured coverage in its metadata.

The Zürich side of the rural–urban contrast uses a separate tram-only civil day:

```bash
npm run data:zurich:day -- \
  --archive /path/to/GTFS_FP2026_YYYYMMDD.zip \
  --date 2026-09-04

npm run data:zurich:day:shapes -- \
  --archive /path/to/2026_google_transit.zip \
  --feed-version 2026_google_transit
```

This writes a 24-hour topology manifest and eight three-hour movement chunks. The shape enrichment deduplicates trips that overlap chunk boundaries, resolves the official ZVV path once per directed stop pair, stores those shared paths in the manifest, then adds only compact path references to each chunk. The committed study contains 5,329 tram trips, 628 stops and 735 weighted edges. It aligns 95,814 of 97,900 segment occurrences (97.9%); two lines not present under the same designation in the annual ZVV feed retain honest straight stop interpolation. The manifest is about 42 KB compressed and the busiest movement block about 112 KB compressed.

The wider ZVV study uses the regional feed's 5,880-stop footprint as its measured extent and as an admission set for local services. This prevents a rectangular crop from accidentally importing neighbouring non-ZVV bus networks while retaining national rail as the regional spine:

```bash
npm run data:zvv -- \
  --archive /path/to/GTFS_FP2026_YYYYMMDD.zip \
  --local-stop-archive /path/to/2026_google_transit.zip

npm run data:zvv:shapes -- \
  --archive /path/to/2026_google_transit.zip \
  --feed-version 2026_google_transit
```

The resulting `zvv-region-morning.json` contains 5,204 trips and is fetched only when ZVV is selected. Its 65,025 matched tram/bus segment occurrences give 98.4% shape coverage. The 4.6 MB JSON compresses to about 1.0 MB over HTTP, so it does not require time chunking for this two-hour study.

The Genève study is cut from the same national timetable but admits local tram and bus routes only when they belong to TPG's published agency ID. That keeps the regional study operator-specific without clipping TPG services at the border:

```bash
npm run data:geneva -- \
  --archive /path/to/GTFS_FP2026_YYYYMMDD.zip \
  --date 2026-09-04
```

Download the current TPG line layer as GeoJSON from the official [SITG feature service](https://sitg.ge.ch/donnees/tpg-lignes), requesting WGS84 coordinates, then enrich the snapshot:

```bash
npm run data:geneva:shapes -- \
  --geometry /path/to/tpg-lines.geojson \
  --feed-version YYYY-MM-DD
```

The line layer is a route-labelled street graph rather than GTFS `shapes.txt`. The enrichment snaps timetable stops to their matching TPG line and finds the shortest valid path between each pair; it rejects implausible detours and refuses to write below 70% coverage. The current artifact contains 1,804 trips and 2,080 stops, including cross-border services, and matches 37,182 of 38,486 local segment occurrences (96.6%). Its 1.8 MB JSON compresses to about 408 KB and is fetched only when **GE** is selected.

## Rural PostBus selection and artifact

Rank active PostBus corridors by scheduled trip count, service span, stop-chain length and stop footprint:

```bash
npm run data:postbus:analyze -- \
  --archive /path/to/GTFS_FP2026_YYYYMMDD.zip \
  --date 2026-09-04
```

The committed choice is Kiental route 220, exact GTFS route ID `96-100-0-j26-1`. Route IDs—not display numbers—are used because several unrelated PostBus lines publish the number 220. Generate its full-day topology and movement chunks with:

```bash
npm run data:postbus:kiental -- \
  --archive /path/to/GTFS_FP2026_YYYYMMDD.zip \
  --date 2026-09-04
```

This produces a 4.3 KB manifest and eight three-hour chunks totalling about 19 KB. The complete study contains 20 route-220 trips plus 48 nearby rail trips, 33 stops and 34 edges. Empty overnight chunks are retained intentionally so the future Zürich–Kiental contrast uses one honest 24-hour clock. See [POSTBUS-CORRIDOR.md](./POSTBUS-CORRIDOR.md) for the selection evidence.

## Geometry model and limits

The current Swiss GTFS archive has no `shapes.txt`. National rail movements are therefore joined to the Federal Office of Transport's published `ch.bav.schienennetz` infrastructure graph. This is authoritative railway alignment, but not a trip-specific path declaration: where parallel alternatives exist, the preprocessing step chooses the shortest credible infrastructure route between matched timetable stops. Zürich tram and bus services use the aligned ZVV geometry; Genève tram, trolleybus and bus services use TPG/SITG line geometry.

At render time, an unresolved fallback segment that crosses a substantial distance through a federal lake polygon is routed around the shorter shoreline arc. Crossings below roughly 1.25 km at national scale remain direct so real bridge links such as the Seedamm are not removed. Supplied infrastructure or regional geometry always wins. The same derived path is used by network lines, selected routes, vehicle interpolation, trails, labels and the follow camera. Movement remains scheduled interpolation rather than a claim of GPS tracking, and the snapshot metadata records both provenance and measured coverage.

## National boundary

The luminous country outline is generated separately from swisstopo's official `swissBOUNDARIES3D` GeoPackage. Download the current LV95 GeoPackage and run:

```bash
npm run data:boundary -- --source /path/to/swissBOUNDARIES3D.gpkg
```

The ingester selects the Swiss national-area feature, converts its EPSG:2056 coordinates to WGS84, preserves interior boundary rings, and applies a conservative metre-based simplification for WebGL. The resulting `public/data/swiss-boundary.json` is about 10 KB; it records the source edition, transformation and simplification tolerance alongside the coordinates. The UI links the required `© swisstopo` attribution directly to the product page.

## Lakes

Lake surfaces come from the federal Vector25 lake layer exposed by the GeoAdmin API. The source covers natural and artificial water bodies, includes the complete shared border lakes and remains the federal reference hydrographic network. Regenerate the web artifact directly from the API with:

```bash
npm run data:lakes
```

For a repeatable offline build, save the GeoAdmin `identify` response and pass it with `--source`. The ingester selects named water bodies of at least 0.1 km², preserves multipart polygons and islands, then simplifies shorelines to 60 metres. The committed artifact contains 160 lake features and 5,357 shoreline points in 114 KB of JSON, or about 38 KB compressed. It is loaded independently from GTFS and rendered below every national and regional transport layer. The UI links `© FOEN, swisstopo` attribution to the [Swiss hydrographic network](https://www.bafu.admin.ch/en/the-swiss-hydrographic-network).

## Reproducibility rules

- The source ZIP is temporary build input and must not be committed.
- The source Federal Office of Transport XTF is temporary build input and must not be committed.
- The source swissBOUNDARIES3D GeoPackage is temporary build input and must not be committed.
- A saved GeoAdmin lake response is temporary build input and must not be committed.
- The output records feed version, service date, time window, publisher and model.
- Refreshes are reviewed as data changes, not mixed into unrelated visual edits.
- Realtime updates must be paired with their corresponding static feed version.
