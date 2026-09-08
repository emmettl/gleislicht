# Gornergrat: dated map, ascents, descents and measured terrain

Choose **Zermatt → Gornergrat** in **Explore studies**, select **GGR** in the phone study picker, or open `?study=gornergrat`. The optional map contains the complete retained Gornergratbahn service day, including both directions and shorter journeys. **Follow Zermatt to Gornergrat** opens the journey card with 26 source-reconciled public summit ascents. Its **Direction** selector also offers **26 complete descents**, Gornergrat → Zermatt. Each direction retains its own actual calls; changing direction pauses at the selected direction’s departure nearest noon and preserves the terrain preference. Selecting a departure pauses at its start; station buttons seek to the actual call, arrival pauses playback, and replay returns to the same departure. Manual station, service or route selection exits the ascent. Controls and model notes are available in EN / DE / FR / IT.

## Timetable scope

The source is Swiss GTFS **20260902**, service date **4 September 2026**, with archive SHA-256 `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`. Scope requires exact route **93-48-j26-1**, agency **121**, type **116**, operator **Gornergratbahn**. The unrelated Wildhorn cableway with a similar route number is excluded by identity and type.

| Journey endpoints | Dated services |
| --- | ---: |
| Zermatt GGB → Gornergrat | 26 |
| Gornergrat → Zermatt GGB | 26 |
| Zermatt GGB → Riffelalp | 1 |
| Riffelalp → Zermatt GGB | 1 |

There are **54 services, seven source stops and seven mapped paths**, spanning 07:00–23:15 in this fixture. No selected service uses a frequency template. The usual summit calls are Zermatt GGB, Findelbach, Riffelalp, Riffelberg, Rotenboden and Gornergrat. Some services additionally call at **Zermatt Ferienhaus legendär**; the exact source call pattern is retained. Every retained call currently has ordinary public pickup and drop-off flags. No seventh call is added to trains that omit it, and the short Riffelalp workings are not extended to the summit.

The default ascent is service **237**, with these actual source calls:

| Station | Arrival / departure |
| --- | --- |
| Zermatt GGB | 12:00 |
| Findelbach | 12:06 |
| Riffelalp | 12:15 |
| Riffelberg | 12:23 |
| Rotenboden | 12:28 |
| Gornergrat | 12:33 |

The [operator's timetable page](https://www.gornergrat.ch/en/pages/timetable-gornergrat-bahn), checked on 8 September 2026, establishes seasonal scope and provides travel guidance. Its seasonal summary does not replace individual GTFS calls or establish a fixed frequency for the whole day. This composition uses the original source service day, without preceding-day spillover or independently audited seasonal comparisons. It does not guarantee passenger connections or future availability.

## Mapped geometry and runtime checks

The FOT railway network supplies all **281 scheduled segment occurrences**, simplified at **10 m**. Each segment is checked in both possible path orientations against its two source stops, with a maximum allowed endpoint distance of **100 m**. The largest retained difference is **67.1 m** at Zermatt GGB. Published source stop coordinates are retained; the endpoint threshold is a matching check, not an engineering precision claim. Missing, non-finite or distant paths fail generation.

The default study is a **2D** map. Train movement interpolates between the dated calls on mapped railway paths. **Follow in measured terrain** adds the audited outdoor view described below. The train marker is enlarged for legibility; an engineered vehicle model is not supplied.

The ascent selector checks date, feed version, archive hash, exact route/agency/type, source stop identities, every arrival/departure, chronological calls, public endpoint boarding/alighting and complete finite paths. Duplicate trip identities suppress the selector. Changed or incomplete evidence removes affected ascents. The whole-day map keeps the shorter trains discoverable through search and station services.

## Measured outdoor terrain

All **26 ascents and 26 complete descents** support optional terrain on the same clock. The terrain, station positions and viewer are shared with the Jungfrau rendering machinery, while each study retains its own source and journey validation. Selecting terrain preserves the current time and playing/paused state. Tunnel and gallery intervals automatically continue on the map; outdoor playback resumes afterwards. Station seeks, the additional Ferienhaus call, departure changes, arrival pause, replay and exiting the ascent remain available. Compact controls expose the itinerary through **Journey details**. Request or validation failures keep the map and offer **Retry terrain**.

The landscape is a bounded window of **swissALTIRegio**, release **28 May 2026**, with native 10 m samples in LV95 / LN02. The delivered **193 × 222** grid has approximately **44 m** spacing across 8.5 × 9.8 km, shown at equal horizontal and vertical scale. Terrain is a simplified measured landscape, not photographic scenery. Its **78.1 KiB gzip** artifact is fetched only when terrain is selected, with a **120 KiB** ceiling.

Railway heights come separately from the actual **swissTLM3D 2026-02 PolyLineZ** railway axes. The extraction retains 155 local source features from pinned national SHP/DBF members; matching requires active narrow-gauge, cogwheel railway, excluding funicular and operating-yard features. Nearest-axis interpolation supplies heights to the existing FOT plan alignment, densified at most every 15 m. All 26 ascent paths are compared against the seven-call canonical route and must produce identical rail samples with matching stop progress. Six-call trains omit Ferienhaus from their timetable binding, without introducing a stop or dwell there.

The resulting **654 rail samples** describe **9,341.8 m** of three-dimensional path. The maximum horizontal axis offset is **14.43 m**. Source rail elevations at Zermatt and Gornergrat are **1,604.3 m** and **3,087.5 m LN02** respectively; these are interpolated source values at mapped path endpoints, not advertised station altitudes or engineering precision claims. The audit retains all 50 selected source feature identities, their source years, native ground comparisons at stations, extraction/member/raster hashes and the checked trip patterns.

The shared source gates reject missing/non-finite railway heights and offsets above 60 m. Offsets above 25 m and all structures except ordinary outdoor track or bridges are masked. Masks extend 30 m around adjacent samples and merge across gaps up to 60 m, providing conservative display boundaries rather than surveyed portal locations. Gornergrat has **four masked ranges**: three tunnel areas (one also includes a gallery), plus the longer gallery between Riffelalp and Riffelberg. Together they cover **18.87%** of the mapped 3D distance, including margins. These sections remain on the 2D map; underground track is never lifted onto the landscape. Railway motion follows polyline distance between actual timetable calls, with no spline overshoot.

The descent audit independently compares all 26 downhill FOT paths against the canonical source railway. All 654 XYZ samples match in reverse with **zero coordinate difference**, including source feature identity and structure class; source stop positions agree with reversed progress. The artifact records the audited downhill trip IDs. Runtime reverses points, stop order/progress and structure masks only for one of those source-reconciled complete descents. Older ascent-only artifacts leave the descent on the map with explicit retry. The landscape is reused without another download.

The default descent is train **234**, leaving Gornergrat at **11:55** and reaching Zermatt GGB at **12:39**, via Rotenboden 12:00, Riffelberg 12:10, Riffelalp 12:20 and Findelbach 12:30. Other departures retain the additional Ferienhaus call where published. No uphill timings are reversed or copied into downhill journeys.

This work does not add further operating dates. The complete retained day, both directions and short workings remain available on the map. Physical-device review and publication verification remain separate.

## Reproduction and validation

```sh
node scripts/build-gornergrat-study.mjs \
  --archive /path/GTFS_FP2026_20260902.zip \
  --rail-source /path/schienennetz_2056_de.xtf \
  --date 2026-09-04
node scripts/build-study-summaries.mjs
python3 scripts/prepare-jungfrau-terrain-source.py \
  --bounds 2622500 1091000 2628500 1098000 \
  --output data/gornergrat-terrain-source.json
node scripts/ingest-gornergrat-terrain.mjs
npx vitest run scripts/gornergrat*.test.* scripts/jungfrau-terrain*.test.*
npx playwright test e2e/gornergrat.spec.ts e2e/gornergrat-terrain.spec.ts e2e/gornergrat-descent.spec.ts e2e/jungfrau-terrain.spec.ts --workers=1
```

Artifacts:

- `public/data/gornergrat-day.json`: optional full-day map, approximately **4.3 kB / 4.2 KiB gzip**, with a **40 KiB** ceiling.
- `data/gornergrat-ascent-source.json`: reconciled source calls, pickup/drop-off flags and archive identity, imported only by the optional ascent component.
- `data/gornergrat-study-audit.json`: source hashes, per-pair endpoint checks and occurrence counts.
- `data/gornergrat-terrain-source.json`: bounded federal railway XYZ features and pinned source/member hashes.
- `data/gornergrat-terrain-audit.json`: terrain/raster identity, all ascent/descent pattern checks, selected rail features, offsets, station elevations and structure masks.
- `public/data/gornergrat-ascent-terrain.json`: optional 78.1 KiB terrain and railway artifact.

The builder writes an audit before rejecting a geometry or size failure; it does not replace delivery data when those gates fail. `--output`, `--source-output` and `--audit-output` support separate candidates. Browser checks cover deferred loading, discovery, direct dated links, request retry, exact ascent calls, arrival pause, replay, alternate departures and phone layout. Physical-device review and publication remain separate.

Next: audit the railway's actual XYZ alignment, tunnels and covered structures for measured outdoor terrain. Descending authored journeys and independently audited operating dates can follow separately.

Terrain verification also covers all 26 bindings, source-axis rejection, changed path variants, conservative mask windows, six/seven-call station progress, malformed data and request retry. On 8 September 2026, 32 targeted Gornergrat/Jungfrau/Rigi tests passed; all 16 Gornergrat map/terrain and Jungfrau terrain browser cases passed across desktop Chromium and iPhone WebKit after correcting test setup. Shared-worktree typechecking passed. A separate production build of this increment passed the opening transfer budget (358.9 KiB JavaScript, 9.8 KiB CSS, 396.7 KiB data; 765.4 KiB total), avoiding incomplete concurrent regional edits. The shared ingestion refactor reproduced the existing Jungfrau terrain artifact byte for byte.

The descent increment adds source checks for 26 independent downhill call sequences and reverse-geometry authorisation, plus browser coverage for both directions, gallery/tunnel transitions, seven-call departures and ascent-only artifact retry. Its 22 targeted source/terrain tests and 14 Gornergrat browser cases passed across desktop Chromium and iPhone WebKit. Production build, typechecking, lint and architecture checks passed. The isolated descent build retains the 358.9 KiB opening JavaScript budget; the concurrently edited shared build measured 360.1 KiB against the 360 KiB limit.
