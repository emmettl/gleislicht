# Jungfrau: the first full-day map

Select **JUNG** in the desktop study strip or the phone study picker, or choose **Jungfrau · valleys to summit** in Explore studies. The first separately loaded **2D** study covers Interlaken Ost’s two valley branches, both Wengernalp approaches through Lauterbrunnen/Wengen and Grindelwald, Jungfraubahn to Jungfraujoch, and Eiger Express. Search stations, operators and services, isolate regional rail, cogwheel or cableway, follow a selected timetable record, or use **Explore the approaches** for six station entry points. Controls and disclosures are available in EN / DE / FR / IT. Source place names remain unchanged.

This is the first implemented increment, not the completed measured-terrain mountain experience. No Jungfrau terrain, tunnel heights, cable sag, pedestrian geometry or guaranteed interchange sequence is implied. Physical-device review and publication remain separate steps.

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

The map follows the **2D** mapped rail and cableway geometry. Rail segments through the mountain are not raised to surface terrain. Tunnel depth, track elevation, cabin height and sag await their own evidence before a 3D ascent is added.

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

## Next Jungfrau increments

1. Add a source-audited interchange/approach guide and authored valley-to-Jungfraujoch sequence, retaining transfer and boarding constraints.
2. Add measured terrain for open-air railway sections. Establish tunnel-aware vertical semantics before extending terrain to the Jungfraujoch section.
3. Audit Eiger Express vertical geometry and operating semantics before introducing an illustrative continuous cabin system.
4. Compare independently generated operating dates and quiet periods. Audit Mürren, First, Männlichen and other branches separately before expanding this composition.
