# Jungfrau: full-day map and measured outdoor ascent

Select **JUNG** in the desktop study strip or the phone study picker, or choose **Jungfrau · valleys to summit** in Explore studies. The first separately loaded **2D** study covers Interlaken Ost’s two valley branches, both Wengernalp approaches through Lauterbrunnen/Wengen and Grindelwald, Jungfraubahn to Jungfraujoch, and Eiger Express. Search stations, operators and services, isolate regional rail, cogwheel or cableway, follow a selected timetable record, or use **Explore the approaches** for six station entry points. Controls and disclosures are available in EN / DE / FR / IT. Source place names remain unchanged.

The Wengen ascent also offers optional measured outdoor terrain, described below. Tunnel and covered sections retain the 2D map. Cable sag, pedestrian geometry and guaranteed interchange sequences are not implied. Physical-device review and publication remain separate steps.

## Dated scope and operating semantics

Swiss GTFS **20260902**, service date **2026-09-04**. All services are selected using exact agency, route-type and route-ID joins; replacement buses and neighbouring cableways are excluded.

| Source operator | Agency | Source routes | Type | Timetable records |
| --- | --- | --- | --- | ---: |
| Berner Oberland-Bahnen | 35 | R61 / R62 (`91-61-j26-1`, `91-62-j26-1`) | 106 | 130 |
| Wengernalpbahn | 157 | 63 / 64 (`93-63-j26-1`, `93-64-j26-1`) | 116 | 123 |
| Jungfraubahn | 124 | 65 (`93-65-j26-1`) | 116 | 73 |
| Wengernalpbahn Grindelwald Grund – Eigergletscher | 200 | 2444 (`93-244-4-j26-1`) | 1300 | 1,237 |

The fixture contains **1,563 unique timetable records, 46 source platform/stop rows and 22 mapped paths**. The cableway’s display route is **Eiger Express**, established by the operator and matching FOT installation; `sourceRouteShortName: "2444"`, source operator, trip ID, route ID, agency and type are retained.

The operator’s [arrival guide](https://www.jungfrau.ch/en-gb/arriving/) describes the Wengernalp approaches through Kleine Scheidegg and the Eiger Express approach through Eigergletscher. Its [Eiger Express page](https://www.jungfrau.ch/en-gb/eiger-express/) identifies the tricable system. These pages were checked on 8 September 2026; they establish intended scope rather than substituting for the dated source timetable.

The selected GTFS trips have **no `frequencies.txt` entries**. Eiger Express is represented by individual published timetable records; these are not a physical cabin roster or observed positions. The overview therefore counts **timetable movements** and states **not tracked cabins**; selected cableway records retain that disclosure on phone and desktop. No cabin spacing, cabin count, exact-frequency template or looping animation is invented. The builder stops if a future source introduces frequency semantics requiring review.

The 24-hour clock represents the selected service day. After-midnight trips belong to their original source day; preceding-day spillover is not included. A quiet interval is not proof of an operating closure. This fixture does not establish seasonal, weekend, live availability or reservation rules. The operator page’s advertised travel time does not override the dated GTFS calls.

## Geometry and corrections

**All 2,564 scheduled segment occurrences** have explicit paths: 1,327 rail and 1,237 Eiger Express. The geometry audit counts occurrences by source route so the cableway volume cannot conceal a missing railway branch. Every rail segment passes a 150 m endpoint check; the largest actual rail endpoint difference is **85.6 m**. This technical check is not a surveyed track-position guarantee.

The national FOT graph needed three local corrections, isolated to this builder:

- **Matten b. Interlaken:** project the source stop onto exact FOT segment `ch14uvag00068371`, Interlaken Ost [Gleis 1-2] → Wilderswil, and split that segment. Offset **3.4 m**.
- **Grindelwald Terminal:** project onto exact segment `ch14uvag00067777`, Schwendi bei Grindelwald → Grindelwald. Offset **5.7 m**.
- **Interlaken Ost platform 2 / 2A / 2B:** resolve rail geometry to existing FOT node `ch14uvag00066282` (number `8519310`, Gleis 1-2). The generic shared station node is not connected to the BOB graph. Published GTFS coordinates and stop IDs remain unchanged; only the builder’s geometry lookup uses the infrastructure number.

Projection requires the exact segment identity and endpoint names, an interior point and an offset below 30 m. The platform correction rejects unaudited platform labels. These corrections do not alter the generic national matcher or other studies.

### Eiger Express: shared stops, distinct alignment endpoints

The retained [FOT cableway query](https://api3.geo.admin.ch/rest/services/ech/MapServer/find?layer=ch.bav.seilbahnen-bundeskonzession&searchText=Eigergletscher&searchField=anlagename&contains=true&returnGeometry=true&sr=4326) resolves exact installation **75.014**, feature **1297**, operator **WAB**, vehicle type **Kabine**. Its nine-point alignment is retained in `data/jungfrau-cableway-source.json`. The response also contains a different chairlift installation; it is not used.

The timetable reuses stop roots `ch:1:sloid:5226` at Grindelwald Terminal and `ch:1:sloid:7361` at Eigergletscher. Their coordinates differ from the cable alignment endpoints by **213.3 m** and **135.9 m**, respectively. The builder preserves those source coordinates and the mapped cable alignment. It does not snap the railway station to the cableway or draw a walking connector. The reviewed endpoint limits for these exact identities are 225 m and 150 m; other endpoint identities or larger differences fail generation. This is a disclosed source-location difference, not evidence of a zero-distance interchange.

The map follows the **2D** mapped rail and cableway geometry. Rail segments through the mountain are not raised to surface terrain. The optional Wengen terrain view uses separately audited railway elevations and masks underground or covered sections; cabin height and sag remain outside the model.

## Payload, reproduction and checks

The complete optional artifact is approximately **48.4 KiB gzip**, below its **100 KiB** study-data ceiling. It is not requested by the initial national view. It loads as one artifact, retains the full-day search index and supports dated station/service share links. Failed requests expose an explicit retry without substituting another network.

```sh
npm run data:jungfrau -- \
  --archive /path/GTFS_FP2026_20260902.zip \
  --rail-source /path/schienennetz_2056_de.xtf \
  --date 2026-09-04
```

Outputs:

- `public/data/jungfrau-day.json`: compact full-day stops, source-labelled trips and explicit paths.
- `data/jungfrau-study-audit.json`: archive/source hashes, per-route counts and endpoint checks, directed platform-pair evidence and the three correction records.

Use `--output`, `--audit-output` and `--cable-source` for an independent candidate. Failed geometry or payload gates write the audit but do not overwrite the delivery artifact. FOT rail is simplified at 10 m. All retained geometry remains attributed to the Federal Office of Transport; the wider lake context retains FOEN attribution.

Unit checks cover source scope, exact record counts, path completeness, missing-geometry rejection, original stop identities, guarded projections and platform resolution, exact cableway identity, reverse traversal and the disclosed endpoint gaps. Browser checks cover deferred loading, both valley branches, operator/Eiger Express search, cogwheel filtering, phone disclosures, direct dated links and request retry. The national opening budget remains unchanged.

## Approach guide and dated ascent

**Three approaches to Jungfraujoch** now opens an optional guide for the routes through Lauterbrunnen/Wengen, Grindelwald/Kleine Scheidegg and Eiger Express. Each displayed connection requires a forward call pair on its exact source route, agency and mode. Station buttons open the map’s services while preserving its clock. The guide is a schematic; the distinct cableway/railway endpoints at Terminal and Eigergletscher do not imply a walking path.

**Follow the ascent via Wengen** offers **17 dated compositions**, each using three public, source-reconciled train journeys. The default is:

| Stage | Source service | Dated times |
| --- | --- | --- |
| Interlaken Ost → Lauterbrunnen | BOB R62, 159 | 12:04–12:26 |
| Wait at Lauterbrunnen | 34 minutes | 12:26–13:00 |
| Lauterbrunnen → Kleine Scheidegg | WAB 63, 361 | 13:00–13:38 |
| Wait at Kleine Scheidegg | 20 minutes | 13:38–13:58 |
| Kleine Scheidegg → Jungfraujoch | JB 65, 81561 | 13:58–14:41 |

The source contains **no internal Lauterbrunnen transfer row** for the BOB/WAB change. The composition uses an explicitly editorial minimum of ten minutes there; this is not presented as a published transfer rule. At Kleine Scheidegg, exact platform pair `ch:1:sloid:7374:0:564901` → `ch:1:sloid:7374:0:533952` has a **180-second** GTFS minimum. The [operator’s arrival and boarding guidance](https://www.jungfrau.ch/en-gb/arriving/), checked on 8 September 2026, asks passengers to pass the turnstiles at least ten minutes before departure. The composition conservatively adds that lead to the transfer minimum, requiring at least **13 minutes** at Kleine Scheidegg. It retains the resulting actual timetable wait. Each wait is capped at one hour as an editorial composition limit. The display does not establish availability, reservations or a guaranteed passenger connection; it links to the operator’s current rules.

The shared clock drives train following, stationary interchange focus, backward scrubbing and replay. Selecting a different departure pauses at its start. Playback pauses on reaching Jungfraujoch; selecting a station, route or service manually leaves the ascent. All controls and notes are translated into EN / DE / FR / IT. The guide, ascent and their evidence load only on demand.

`data/jungfrau-ascent-source.json` retains **69 upward source trips**, all calls including pickup/drop-off restrictions, and **13 internal transfer records** at the two change locations. Its generator verifies the archive hash, active service day, source trip/route/agency/mode joins and every delivered call. Runtime composition requires matching date, feed and hash, exact call identities and times, public boarding/alighting, chronological calls and complete finite path geometry. Changed or incomplete evidence suppresses the affected choices.

```sh
node scripts/audit-jungfrau-ascent.mjs --archive /path/GTFS_FP2026_20260902.zip
```

The same authored journey now supports measured outdoor terrain. Eiger Express ascent playback and independently audited operating dates remain future increments.

## Measured outdoor terrain and tunnel semantics

Within **Follow the ascent via Wengen**, select **Follow in measured terrain**. The choice preserves the selected departure, clock, playback rate and pause state. The train stays at its mapped station position during a dwell. Interchange waits remain on the map. Terrain automatically returns on audited outdoor sections; tunnels, galleries, underpasses, station buildings and uncertain alignments continue in 2D without pausing the timetable. **Return to map** preserves the clock. Journey details can be expanded while the terrain preference is retained.

The landscape uses [swissALTIRegio](https://www.swisstopo.admin.ch/en/height-model-swissaltiregio), release **2026-05-28**, EPSG:2056 / LN02. A bounded native **10 m** raster is sampled into a **193 × 251** display grid covering **16.3 × 21.2 km**, about **85 m** between displayed samples. It is a generalised landscape, not track-bed geometry. The camera clears the sampled landscape. Horizontal and vertical scales are equal. An enlarged train marker and route overlay remain legible over the simplified mesh; neither is a surveyed vehicle envelope or a claim of exact clearance.

Railway heights come from **PolylineZ** axes in [swissTLM3D 2026-02](https://www.swisstopo.admin.ch/en/landscape-model-swisstlm3d), not from the ground raster. The bounded retained source contains **669 railway features**, including the mapped underground Jungfraubahn. The extractor pins the federal archive identity and all four railway member hashes, downloads only the relevant ZIP members through bounded range requests, validates ZIP CRCs, and retains the original attributes and XYZ coordinates. A 2D display API response is not used to infer altitude. The object catalogue's `STUFE` relative ordering is not treated as height.

The matcher samples the oriented FOT plan alignment at intervals no larger than **15 m**, then interpolates height on the nearest active narrow-gauge swissTLM3D segment. Both upper legs additionally require the source cogwheel flag. Samples beyond **60 m** from a compatible axis fail generation. Outdoor playback requires source structure class `Keine` or `Bruecke` and offset at most **25 m**. All other structure classes and larger offsets are masked. Masks extend by 30 m around neighbouring samples and merge across gaps up to 60 m to avoid brief flashes between nearby covered structures. These are conservative editorial visibility margins, not surveyed portal positions.

| Leg | Source points | Maximum axis offset | Mapped endpoint elevations (LN02) |
| --- | ---: | ---: | --- |
| Interlaken Ost → Lauterbrunnen | 862 | 40.8 m; offsets over 25 m masked | 566.8 → 795.8 m |
| Lauterbrunnen → Kleine Scheidegg | 730 | 11.7 m | 795.8 → 2,061.0 m |
| Kleine Scheidegg → Jungfraujoch | 645 | 26.4 m; offsets over 25 m masked | 2,061.0 → 3,453.5 m |

The summit railway endpoint is **3,453.5 m**, while the native ground sample there is **3,476.6 m**. The source classifies this final alignment as tunnel; it stays on the map. No train is draped across the mountain surface and no tunnel interior is invented. Progress between calls follows cumulative three-dimensional rail distance with linear interpolation, without spline overshoot. Only unmasked rail segments are drawn in terrain. Source uncertainty and the generalised terrain remain visible in the four-language evidence notes.

`public/data/jungfrau-ascent-terrain.json` is **108.7 KiB gzip**, requested only when terrain is enabled, below an independent **220 KiB** ceiling. The UI validates the source date, feed, timetable hash, route and stop identities, finite geometry, grid bounds and mask ordering before binding it to any of the 17 compositions. Request or validation failures retain the ascent map and expose a retry. `data/jungfrau-terrain-audit.json` records source hashes, native raster hash, source feature IDs/years, alignment offsets, masks and station rail/ground comparisons.

```sh
python3 scripts/prepare-jungfrau-terrain-source.py
node scripts/ingest-jungfrau-terrain.mjs
npx vitest run scripts/jungfrau-terrain.test.ts scripts/jungfrau-ascent.test.ts
npx playwright test e2e/jungfrau-terrain.spec.ts e2e/jungfrau-ascent.spec.ts --workers=1
```

The first command's cache is pinned to the retained source edition. The second command reuses a local bounded raster cache only when its bounds and source checksum match. Source and render simplification do not establish future service availability or exact engineering clearance. All data retain FOT and swisstopo attribution.

## Next Jungfrau increments

1. Extend the completed approach guide and Wengen ascent with independently audited Grindelwald and Eiger Express compositions, retaining transfer and boarding constraints.
2. Assess further mountain railways using the outdoor-terrain and explicit tunnel fallback established here; independently audit each alignment and timetable.
3. Audit Eiger Express vertical geometry and operating semantics before introducing an illustrative continuous cabin system.
4. Compare independently generated operating dates and quiet periods. Audit Mürren, First, Männlichen and other branches separately before expanding this composition.
