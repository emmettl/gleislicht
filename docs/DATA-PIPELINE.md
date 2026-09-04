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

The same streaming ingester can create a separate multimodal regional artifact. The committed Zürich city study is regenerated from the same national archive with:

```bash
npm run data:zurich -- --archive /path/to/GTFS_FP2026_YYYYMMDD.zip
```

This preset selects a tight city bounding box and all supported Swiss GTFS route types—rail, tram, metro, bus, ferry, cableway and funicular—while skipping the unrelated hub artifact. The resulting JSON is fetched only after the city scale is selected. The source archive's lack of `shapes.txt` still applies; the dedicated ZVV/VBZ feed is the planned source for shape-aware tram and bus geometry.

## Known geometry limitation

The current Swiss GTFS archive has no `shapes.txt`. Until rail geometry is joined from a suitable infrastructure dataset, the national study interpolates directly between stop coordinates. The result is schedule-derived and geographically honest at stations, but straight between them. The interface and snapshot metadata say so explicitly.

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
