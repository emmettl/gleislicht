# Territet–Glion measured geometry audit

The pinned swissTLM3D source supports **two complete measured XYZ routes** through the Territet–Glion funicular. They share the track below and above a passing loop. Both alternatives are retained; neither is assigned to an uphill or downhill vehicle. This audit is preparation for terrain playback and introduces no runtime artifact or terrain raster.

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

The audit calculates the loop interval independently for both geometric hypotheses and retains their union for each of the **140** dated services. Interpolation uses each service's own departures, arrivals and original Collonge time. The model uses horizontal distance within the affected Glion–Collonge segment, consistently with existing measured railway playback. The results are proposed fallback intervals, not observed vehicle positions or runtime trip authorisations.

For the default 12:04 pair, the proposed uphill fallback is approximately **12:06:06–12:07:03**, while the downhill interval is **12:05:46–12:06:20**. Their difference preserves the feed's distinct intermediate timing. It does not simulate two vehicles coupled by a cable.

Next implementation: obtain and validate a suitably detailed terrain grid for this short route; retain both loop branches as context; implement the conservative map fallback, bridge handling and LN02 evidence; validate standalone and combined Glion journeys in both directions. Other operating dates remain separate.

## Reproduction and validation

```sh
python3 scripts/prepare-jungfrau-terrain-source.py \
  --cache /path/to/pinned-railway-cache \
  --bounds 2560250 1141780 2560550 1142450 \
  --output data/territet-terrain-source.json
node scripts/audit-territet-terrain.mjs
npx vitest run scripts/territet-terrain-geometry.test.mjs \
  scripts/territet.test.ts scripts/glion-terrain.test.ts --exclude '**/.claude/**'
npx oxlint scripts/audit-territet-terrain.mjs \
  scripts/territet-terrain-geometry.test.mjs
```

The source and audit reproduce from the hash-verified cache. **11 tests across three suites** pass, including the five new audit tests. They check complete source topology, original XYZ vertices and joins, both branch alternatives, all 140 fallback intervals, exact original calls, and rejection of changed coordinates, dates, route identity, boarding flags, structures, missing branches and source provenance. Targeted lint and diff whitespace checks pass. Browser tests are unnecessary for this data-only audit; terrain playback and physical-device review remain pending.

Artifacts: `data/territet-terrain-source.json`, `data/territet-terrain-audit.json`. Geometry: © swisstopo. Installation context: Federal Office of Transport. Timetable: opentransportdata.swiss.
