# Gornergrat: dated map and summit ascents

Choose **Zermatt → Gornergrat** in **Explore studies**, select **GGR** in the phone study picker, or open `?study=gornergrat`. The optional map contains the complete retained Gornergratbahn service day, including both directions and shorter journeys. **Follow Zermatt to Gornergrat** offers the 26 source-reconciled public summit ascents. Selecting a departure pauses at its start; station buttons seek to the actual call, arrival pauses playback, and replay returns to the same departure. Manual station, service or route selection exits the ascent. Controls and model notes are available in EN / DE / FR / IT.

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

This increment is explicitly **2D**. Train movement interpolates between the dated calls on mapped railway paths. Measured terrain, tunnel depth, track elevation and an engineered vehicle model are not supplied. A terrain increment must independently match actual rail elevations and structures, as in the Jungfrau evidence workflow, before adding an outdoor follow camera.

The ascent selector checks date, feed version, archive hash, exact route/agency/type, source stop identities, every arrival/departure, chronological calls, public endpoint boarding/alighting and complete finite paths. Duplicate trip identities suppress the selector. Changed or incomplete evidence removes affected ascents. The whole-day map keeps the shorter trains discoverable through search and station services.

## Reproduction and validation

```sh
node scripts/build-gornergrat-study.mjs \
  --archive /path/GTFS_FP2026_20260902.zip \
  --rail-source /path/schienennetz_2056_de.xtf \
  --date 2026-09-04
node scripts/build-study-summaries.mjs
npx vitest run scripts/gornergrat.test.ts scripts/gornergrat-geometry.test.mjs
npx playwright test e2e/gornergrat.spec.ts --workers=1
```

Artifacts:

- `public/data/gornergrat-day.json`: optional full-day map, approximately **4.3 kB / 4.2 KiB gzip**, with a **40 KiB** ceiling.
- `data/gornergrat-ascent-source.json`: reconciled source calls, pickup/drop-off flags and archive identity, imported only by the optional ascent component.
- `data/gornergrat-study-audit.json`: source hashes, per-pair endpoint checks and occurrence counts.

The builder writes an audit before rejecting a geometry or size failure; it does not replace delivery data when those gates fail. `--output`, `--source-output` and `--audit-output` support separate candidates. Browser checks cover deferred loading, discovery, direct dated links, request retry, exact ascent calls, arrival pause, replay, alternate departures and phone layout. Physical-device review and publication remain separate.

Next: audit the railway's actual XYZ alignment, tunnels and covered structures for measured outdoor terrain. Descending authored journeys and independently audited operating dates can follow separately.
