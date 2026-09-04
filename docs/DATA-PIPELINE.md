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

## Known geometry limitation

The current Swiss GTFS archive has no `shapes.txt`. Until rail geometry is joined from a suitable infrastructure dataset, the national study and regional rail services interpolate directly between stop coordinates. Zürich tram and bus services use the aligned ZVV geometry; Genève tram, trolleybus and bus services use TPG/SITG line geometry. Any unmatched local segment falls back to straight stop interpolation. The result remains schedule-derived rather than a claim of GPS tracking, and the snapshot metadata records that distinction.

## National boundary

The luminous country outline is generated separately from swisstopo's official `swissBOUNDARIES3D` GeoPackage. Download the current LV95 GeoPackage and run:

```bash
npm run data:boundary -- --source /path/to/swissBOUNDARIES3D.gpkg
```

The ingester selects the Swiss national-area feature, converts its EPSG:2056 coordinates to WGS84, preserves interior boundary rings, and applies a conservative metre-based simplification for WebGL. The resulting `public/data/swiss-boundary.json` is about 10 KB; it records the source edition, transformation and simplification tolerance alongside the coordinates. The UI links the required `© swisstopo` attribution directly to the product page.

## Reproducibility rules

- The source ZIP is temporary build input and must not be committed.
- The source swissBOUNDARIES3D GeoPackage is temporary build input and must not be committed.
- The output records feed version, service date, time window, publisher and model.
- Refreshes are reviewed as data changes, not mixed into unrelated visual edits.
- Realtime updates must be paired with their corresponding static feed version.
