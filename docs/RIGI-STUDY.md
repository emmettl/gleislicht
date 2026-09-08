# Lake Lucerne–Rigi: first full-day map

Implemented locally on 8 September 2026. Select **RIGI** in the desktop study strip or the phone study picker. The view combines Lake Lucerne boats, both Rigi cogwheel approaches and the Weggis–Rigi Kaltbad cableway on one 24-hour clock. Search destinations, source line numbers or operators, select a service, and use the mode filters to isolate boats, cogwheel trains or the cableway. Controls and model disclosures are available in EN / DE / FR / IT.

The first fixture uses Swiss GTFS **20260902**, service date **4 September 2026**. It contains **190 movements and 54 source stops**: 50 cogwheel services, 89 boat services and 51 cableway services. Ten source routes belong to Rigi Bahnen (agency `137`, type `116`), Vierwaldstättersee (`185`, type `1000`) and Weggis–Rigi Kaltbad (`13700`, type `1300`). Replacement buses and other Rigi-area cableways are outside this composition. Calendar exceptions are applied; the source IDs, operator and route type survive preprocessing. All services in this fixture have exact scheduled departures. After-midnight arrivals remain on their original service day.

The complete dataset is about **13.1 KiB gzip**, with a tested **25 KiB study-data budget**, so it loads as one optional artifact rather than eight tiny movement chunks. Nothing from this study's data is requested for the initial national view. The default study time is noon; the full day remains searchable, including quiet hours. A failed request is disclosed and other studies remain accessible.

## Geometry evidence

| Mode | Current evidence | Limits |
| --- | --- | --- |
| Cogwheel | All **374 segment occurrences** resolve against the official FOT rail network, simplified at 10 metres. | An infrastructure graph join is not proof of an exact track allocation or measured vertical profile. |
| Cableway | Exact FOT installation **71.105**, Weggis–Rigi Kaltbad, feature 741. Source alignment endpoints are about **9.1 m** and **5.1 m** from the GTFS stop coordinates. | The returned source is 2D and supplies no vertical profile. Support-point coordinates do not establish cable sag, cabin count or circulation. |
| Boats | **54 unique stop pairs** resolve inside the committed FOEN Lake Lucerne polygon, including boundary and island constraints. Largest dock-to-water adjustment: **47.4 m** (150 m maximum allowed). | These are shortest cartographic water paths, not observed tracks, shipping lanes, navigability validation or recommended routes. The simplified Vector25 reference geometry can place a path at a mapped shoreline. |

Boat routing splits candidate segments at every polygon-boundary intersection and tests each resulting interval. This avoids the narrow-island omissions that fixed-distance sampling can cause. A visibility graph then finds a connected path within the water polygon; unresolved endpoints fail generation rather than silently crossing land. Pier positions just outside the cartographic boundary are moved to nearby water endpoints and their offsets are recorded. Supplied explicit paths prevent the renderer from applying a land-transport shoreline detour to boats.

The operator's [Rigi timetable page](https://www.rigi.ch/en/inform/timetables) establishes the two railway approaches and the Weggis cableway as the intended network. The [FOT rail layer](https://map.geo.admin.ch/?layers=ch.bav.schienennetz) and [federally licensed cableway layer](https://map.geo.admin.ch/?layers=ch.bav.seilbahnen-bundeskonzession) supply the mapped alignments. The existing lake artifact retains its [FOEN hydrography source](https://www.bafu.admin.ch/en/the-swiss-hydrographic-network) and attribution. Operator pages do not replace the dated machine-readable timetable.

## Reproduction and audit

```sh
npm run data:rigi -- --archive /path/GTFS_FP2026_20260902.zip --rail-source /path/schienennetz_2056_de.xtf --date 2026-09-04
```

Outputs:

- `public/data/rigi-day.json`: full-day topology, paths and movements.
- `data/rigi-geometry-audit.json`: source hashes, route-level trip counts, water-path lengths and dock offsets, cableway endpoint offsets and source feature identity.
- `data/rigi-cableway-source.json`: retained source response subset for installation 71.105, with exact query URL and retrieval date. Pass `--cable-source` to use a separately retrieved source.

`--water-source`, `--output` and `--audit-output` allow independent rebuilds. A different service date must be regenerated and reviewed; this is not a claim of year-round coverage. The builder rejects incomplete rail or water geometry, a mismatched cableway alignment and an unexpected headway-based source change requiring further disclosure review. Source hashing makes the inputs reproducible. The optional study remains on its explicit fixture date when national publication refreshes the rail timetable.

## Verification and remaining work

Tests cover source selection, cableway identity and reverse direction, rejected endpoints, full-day trip identities and path references, headlands, narrow islands and the actual emitted boat paths. Desktop Chromium and emulated iPhone WebKit checks cover lazy loading, study selection, full-day controls, operator search, mode labels and failure recovery. Physical-device review and publication remain separate steps.

The **2D map** now links to both [measured Rigi terrain ascents from Vitznau and Arth-Goldau](RIGI-TERRAIN.md). Ground elevations beneath the railway are available; surveyed track heights, tunnels, cable behaviour, an authored lake-to-summit sequence, pedestrian connections and source-backed interchange intervals remain open. Vitznau pier/railway and Weggis pier/cableway retain distinct source stops; no walking link or guaranteed connection is invented. Seasonal and weekend selection, validated shipping routes and the other Rigi-area cableways are later increments.
