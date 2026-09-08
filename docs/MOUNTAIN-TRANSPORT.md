# Mountain transport: first discovery increment

Implemented locally on 8 September 2026; publication and physical-device review are separate steps. This begins phase A of the [Swiss expansion roadmap](https://github.com/emmettl/motionstudies/blob/main/ROADMAP.md#8a--gleislicht-regional-depth-lakes-and-mountain-railways).

## Explore the existing cogwheel services

Choose **Cogwheel** in the national map's service legend, or in the phone's map-tools service picker. The filter works in both the morning and **24H** views. Switch to 24H and move to daytime to explore services that are absent from the morning window. Search by destination, line, train number or operator—for example **Rigi Bahnen** or **Gornergratbahn**. Selected trains and lines show their source operator; the interface calls these services Cogwheel / Zahnrad / Crémaillère / Cremagliera.

The filter uses exact trip identities joined from Swiss GTFS `route_type=116`, not destination-name heuristics or reused display line numbers. It preserves source route IDs, operator IDs and names, transport codes and descriptions in a separate catalogue. Existing shared rail categories remain intact. This is a cogwheel selection, not an assertion that every Alpine railway is a cogwheel railway. Rochers-de-Naye and other mountain routes classified differently in the feed remain in the normal rail view and need the broader mountain discovery work.

The catalogue loads only on request and is about 2 KiB compressed. Its feed version and service date must match the active national timetable. Unavailable, malformed or mismatched data produces an explicit unavailable state; clearing the filter restores the national network. Filtering removes unrelated vehicles, edges and station lights, remaps stop indices together, and preserves matched infrastructure paths. Operator search covers the currently loaded timetable window, including the active three-hour block in 24H mode; it is not yet a whole-day operator search index.

## Reproduce the audit

Use the official archive matching the committed national day manifest:

```sh
npm run data:mountains -- --archive /path/GTFS_FP2026_20260902.zip
```

The command streams the source archive, applies service calendars and exceptions, and writes:

- `public/data/swiss-cogwheel-catalogue.json`: compact source route records and the exact national cogwheel trip-to-route join.
- `data/mountain-transport-audit.json`: all source cogwheel, cableway/lift, funicular and ferry route records, including inactive routes; scheduled trip counts and operating spans; frequency-template counts; national rail inclusion and geometry occurrence counts.

The report records the archive SHA-256 and national manifest SHA-256. Chunk boundary overlaps are deduplicated by exact trip identity; differing copies are rejected. Current manifests' chunk lengths and hashes are verified when supplied; the legacy committed manifest has no chunk integrity fields. Frequency templates are counted separately, never as one precise scheduled departure. Records entirely beyond the selected civil day are excluded from its scheduled count. Cableway totals include the feed's lift/elevator subtype, retained in each route's source description.

Pages builds and the national refresh workflow regenerate the catalogue after rail geometry enrichment. Published-timetable recovery also attempts to recover a matching catalogue, while retaining compatibility with older publications that do not contain one. If no compatible catalogue is available, the optional filter remains unavailable and normal rail exploration continues.

## Evidence: service date 4 September 2026, feed 20260902

| Source family | Feed routes | Routes with active trip records | Scheduled trips in the civil day | Active frequency templates |
| --- | ---: | ---: | ---: | ---: |
| Cogwheel (`116`) | 13 | 12 | 403 | 0 |
| Cableway / lift | 298 | 226 | 28,136 | 486 |
| Funicular | 53 | 49 | 4,523 | 71 |
| Ferry / boat | 102 | 78 | 1,140 | 22 |

All 403 source cogwheel departures in scope are present in the national day artifact. They include Rigi, Wengernalp, Jungfrau, Gornergrat, Pilatus, Brienz Rothorn, Monte Generoso, Furka and a source-classified Berner Oberland route. An inactive route record is not evidence of a missing service on this date. Non-rail services are intentionally absent from the national rail artifact; this report does not audit their inclusion in regional studies.

The existing FOT geometry join covers all cogwheel segment occurrences except 14 of Monte Generoso's 42 occurrences. Those retain the existing explicit interpolation fallback. A matched segment means an inferred infrastructure path was found; the audit does not establish a correct physical alignment, vertical profile or tunnel model.

## Remaining phase-A work

Frequency-based movement semantics are now implemented locally, including exact versus illustrative headways, calendar exceptions and after-midnight service. The first regional fixture adds 29 representative Horgen–Meilen ferry runs to ZVV; see [frequency services and their limits](FREQUENCY-SERVICES.md).

- Audit actual geometry and vertical behaviour for mountain systems, including Monte Generoso's unresolved segments.
- Broaden discovery beyond source-type 116 without inventing classifications from line names.
- Extend coverage checks to regional artifacts, additional operating dates and seasonal patterns.
- Review the filter on physical phones, then proceed to the Lake Lucerne–Rigi composition with boats and cableway connections.
