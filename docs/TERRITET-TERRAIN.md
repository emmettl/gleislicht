# Territet–Glion measured geometry audit

The pinned swissTLM3D source supports **two complete measured XYZ routes** through the Territet–Glion funicular. They share the track below and above a passing loop. Both alternatives are retained; neither is assigned to an uphill or downhill vehicle. The geometry audit is now followed by optional standalone terrain playback for all **140** dated services; the original source audit remains reproducible.

## Sources and identity

The [swissTLM3D landscape model](https://www.swisstopo.admin.ch/en/landscape-model-swisstlm3d) supplies LV95 / LN02 XYZ coordinates. The retained **2026-02** Shapefile release has archive SHA-256 `75086b5aa7e721f5ad2ea080e14e9e3f42d5e0afdee31c2e3c162f412fab4114`. The existing extractor verifies the individual SHP, SHX, DBF and PRJ hashes before reading the bounded records.

Bounds `[2560250, 1141780, 2560550, 1142450]` retain **28** railway records. **12** explicitly identify `STANDSEILB=Wahr`; the other **16** remain in the source extract as excluded railway context. Each selected record is active narrow-gauge railway, with `ZAHNRADBAH=Falsch`, `BETRIEBSBA=Falsch` and `ACHSE_DKM=Falsch`. The cogwheel matcher deliberately excludes these records and is not reused to select a funicular route.

The complete bounded feature list is pinned by parsed JSON SHA-256 `3594a4be7a7d712258157da5477ab24596e81c207347a1de4f81b1a2e41ebe25`. Geometry, structure or branch changes require renewed review. Each record's modification, origin and revision dates are retained. Eleven selected records have 2021 modification dates; the upper common track was modified on **23 October 2024**. The product release does not establish an observation date for every vertex.

The independent [FOT installation audit](TERRITET-STUDY.md) identifies **61.046**, MVR, Standseilbahn. All retained XYZ vertices are within **4.20 m** of that installation's 2D centreline, using the existing approximate WGS84-to-LV95 conversion. This is a corridor consistency check, not a claim about survey accuracy or a railway identifier supplied by TLM.

## Topology and station attachments

Exact XYZ endpoints form **12 graph vertices and 12 edges**, with two degree-one terminals and two degree-three junctions. Enumerating simple terminal-to-terminal paths yields exactly **two alternatives**, each containing **25 original XYZ vertices**. Together they account for every selected funicular feature. No endpoint snapping, inferred connector, averaged centreline or branch switching is introduced.

Six source features are common to both alternatives. Each loop branch contains three distinct features. Four features are classified as bridges: two on common track and one on each branch. No selected feature is classified as a tunnel or gallery.

| Retained source extent | Alternative 1 | Alternative 2 |
| --- | ---: | ---: |
| Planar length | 561.69 m | 561.62 m |
| XYZ polyline length | 638.37 m | 638.28 m |
| Endpoint rise | 302.018 m | 302.018 m |
| Passing-loop planar extent | 75.40 m | 75.33 m |

The full source extent runs from **386.794 m to 688.812 m LN02**. These endpoints describe the dataset extent; they are not passenger platform elevations and should not be substituted for the operator's published installation dimensions.

Both alternatives attach the original three GTFS stop coordinates to the same XYZ positions:

| Stop | Horizontal attachment offset | Interpolated rail height, LN02 |
| --- | ---: | ---: |
| Territet (funi) | 3.38 m | 386.79 m |
| Collonge (funi) | 2.27 m | 459.19 m |
| Glion (funi) | 0.51 m | 686.19 m |

All pass the existing **15 m** attachment gate. The lower stop projects onto the first retained endpoint; no geometry is extended toward the source stop. Glion projects roughly four planar metres before the upper endpoint. Original stop coordinates, IDs and timetable calls remain unchanged.

## Playback decision

Terrain playback can use measured common track below and above the loop, with both branches visible as context. While the selected vehicle traverses the unresolved loop interval, it should return to the existing map and retain timetable continuity. Assigning a branch to a vehicle or deriving mechanically synchronized motion needs separate evidence.

The initial geometry audit calculates the loop interval independently for both geometric hypotheses and retains their union for each of the **140** dated services. Interpolation uses each service's own departures, arrivals and original Collonge time. That preliminary audit uses horizontal distance within the affected Glion–Collonge segment. These are proposed fallback intervals, not observed vehicle positions or runtime trip authorisations. The implemented measured-terrain model below uses XYZ polyline distance, matching the shared terrain engine; it recalculates both hypotheses instead of reusing the preliminary horizontal timings.

For the default 12:04 pair, the proposed uphill fallback is approximately **12:06:06–12:07:03**, while the downhill interval is **12:05:46–12:06:20**. Their difference preserves the feed's distinct intermediate timing. It does not simulate two vehicles coupled by a cable.

All 20 checked [combined Glion journeys](GLION-INTERCHANGE.md) now reuse this funicular terrain alongside the original Rochers terrain. Each leg keeps its own source grid, scale, contextual geometry and masks. The interchange remains on the map; an unavailable terrain asset affects only its own leg. Other operating dates remain separate.

## Optional standalone terrain playback

The optional artifact is **94.0 KiB gzip**. It combines a **193 × 321**, **5 m** landscape grid with the original measured railway, cropped to the three station attachments. The primary timing polyline contains **26 vertices**, including the inserted Collonge anchor and clipped upper endpoint. XYZ coordinates retain millimetre precision; rail heights are never moved to the ground surface. The landscape and railway use equal horizontal and vertical scale, with a closer camera for the short funicular and an enlarged vehicle marker.

The landscape comes from two official [swissALTI3D](https://www.swisstopo.admin.ch/en/height-model-swissalti3d) **2 m** tiles, `swissalti3d_2021_2560-1141` and `swissalti3d_2021_2560-1142`. Their STAC metadata is retained in `data/territet-elevation-source.json`; full TIFF bytes must match SHA-256 `c014f0d3fe982c2edf7e024dda5b8cf3d410dd75f108b6dec7728f569816920a` and `82d4835622108b1e190073335c563d9936720c288d89a0273b4d0b623c344f62`. The item year is **2021**, distinct from the 2026-02 railway product release and 2026 timetable. Native origins, CRS, dimensions, resolution and no-data values are checked. Pixel-centre bilinear sampling spans the tile seam as one mosaic; sampled heights are rounded to 0.1 m. This bare-earth surface does not model buildings or vegetation.

Both loop branches remain visible as context, independently of the animated track. Each hypothesis's loop bounds are recalculated by XYZ distance within the Collonge–Glion timed segment. Their union, expanded by one rail metre at each end, returns playback to the map. No animated vehicle is placed on either loop branch. The default ascent's implemented loop fallback is approximately **12:06:05–12:07:03**.

Rail/ground comparisons also run at one-metre intervals against both the native elevation mosaic and the exact triangles rendered by the 5 m grid. Where ground is more than **2.5 m above** the source rail, a three-metre margin produces a map fallback. Two short intervals qualify: the lower station approach and another section below the passing loop. The default ascent uses the map for roughly its first three seconds and **12:05:21–12:05:31**. Their retained evidence explains the discrepancy; neither source height is altered. Bridge records remain measured track context, without invented bridge structures.

Every original trip is explicitly authorised in its source direction. Runtime binding checks the complete reviewed route, masks, contextual branches, grid dimensions, provenance and camera setting before accepting the optional data; malformed elevations or changed dated calls return to the map. Downhill coordinates, call progress and masks reverse together. The original **12:05 uphill / 12:07 downhill Collonge calls** remain unchanged.

Opt-in loading, cached toggles, retry, elevation and source controls, direction/departure selection, station seeking, arrival pause and replay use the shared timetable clock. Exiting the guide or inspecting a station removes the terrain scene. Controls and the passing-loop/height-discrepancy explanations are available in English, German, French and Italian.

## Reproduction and validation

```sh
python3 scripts/prepare-jungfrau-terrain-source.py \
  --cache /path/to/pinned-railway-cache \
  --bounds 2560250 1141780 2560550 1142450 \
  --output data/territet-terrain-source.json
node scripts/audit-territet-terrain.mjs
node scripts/ingest-territet-terrain.mjs /path/to/elevation-cache
npx vitest run scripts/territet-terrain-geometry.test.mjs \
  scripts/territet-terrain.test.ts scripts/territet.test.ts \
  scripts/glion-terrain.test.ts scripts/rochers-terrain.test.ts \
  scripts/jungfrau-terrain.test.ts scripts/gornergrat-terrain.test.ts \
  scripts/pilatus-terrain.test.ts --exclude '**/.claude/**'
npx oxlint scripts/audit-territet-terrain.mjs \
  scripts/territet-terrain-geometry.test.mjs
```

The source audit and terrain artifact reproduce from hash-verified caches. **34 tests across eight suites** cover the source topology, trimmed XYZ, both contextual branches, spatial loop hypotheses for every trip, all 140 directional bindings, exact calls, reversed heights, clearance masks, payload size and rejection of changed or malformed source data. Existing measured-railway binding regressions pass. Build/type checks, targeted lint and edition-boundary checks pass. All **16 desktop Chromium / iPhone WebKit browser cases** pass across standalone terrain, standalone map journeys, combined Glion terrain and Rochers terrain. They cover opt-in loading, retry, rejected branches, both directions, all station seeks, live transitions to map fallbacks, clock-preserving toggles, arrival pause, replay, departure changes and station-inspection cleanup. Production screenshots were reviewed at Collonge, on the upper line and downhill. The opening remains within budget at **358.9 KiB JavaScript**, **10.0 KiB CSS** and **765.6 KiB total gzip**; the optional 94.0 KiB terrain loads only when requested. Physical-device review remains separate.

Artifacts: `data/territet-terrain-source.json`, `data/territet-terrain-audit.json`, `data/territet-elevation-source.json`, `data/territet-terrain-binding.json`, `data/territet-terrain-playback-audit.json`, `public/data/territet-ascent-terrain.json`. Geometry: © swisstopo. Installation context: Federal Office of Transport. Timetable: opentransportdata.swiss.
