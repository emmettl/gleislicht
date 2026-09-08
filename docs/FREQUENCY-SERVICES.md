# Frequency-based services

Implemented locally on 8 September 2026 as the next increment in the Swiss regional and mountain roadmap. Publication and physical-phone review remain separate steps.

## What the map represents

The importer reads optional `frequencies.txt` records after applying the selected service date's calendar and exceptions. A frequency trip is a stop-time template, not an additional scheduled departure. Its generated instances replace that template.

- `exact_times=1` expands compressed, exact scheduled departures and retains the normal timetable labels.
- `exact_times=0`, or an empty value, creates representative motion at the published headway. The source gives an interval, not actual departure times or vehicle identities. Search results, selected services, relevant line/station cards and the study summary disclose this distinction in EN / DE / FR / IT. Approximate arrivals use `≈` and an illustrated-arrival label. The selected service also shows its published interval on phones.

These rules follow the [GTFS Schedule reference](https://gtfs.org/documentation/schedule/reference/#frequenciestxt) and the [Swiss GTFS cookbook](https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/). The source interval's start anchors the representative grid; it is not evidence that a headway service departs at that exact instant. No cabin count, circulation pattern, vehicle tracking or guaranteed interchange is inferred.

## Import and identity rules

Each interval includes its start and excludes its end. Adjacent intervals may change headway; overlapping intervals, nonpositive or fractional headways, invalid times and backwards stop sequences fail the import. Stop offsets are measured from the original first departure, preserving intermediate dwell times. Hours beyond 24 retain their service-day meaning. Trips already underway when a study window opens are retained; the existing inclusive study-window boundary remains unchanged.

Generated identities combine the encoded source trip ID with the instance's first departure in service-day seconds. They are stable across independently compiled windows and progressive chunks, distinct from the template, and checked for collisions with source IDs. Each service carries its source trip, interval, headway and `exactTimes` provenance; the template's displayed train number is cleared. Generated identities do not masquerade as individually identified realtime vehicles.

Normal schedules remain compatible when `frequencies.txt` is absent. Archive errors are not treated as an absent file. Regional shape enrichment preserves frequency provenance and the distinction in artifact metadata.

## First real fixture: ZVV morning

For service date **4 September 2026**, Swiss feed **20260902**, the bounded ZVV morning study contains **5,226 movements**, including **29 representative Horgen–Meilen ferry runs from nine active source templates**. The previous artifact contained 5,204 movements, including seven template placeholders that happened to overlap the morning window. Zürich city and Genève have no frequency-generated movements in their current bounded morning fixtures and remain unchanged.

The regional study remains lazily loaded. Its ZVV tram/bus geometry join still covers **98.4%** of applicable segment occurrences. This percentage does not measure ferry geometry.

Frequency ferries currently use direct stop-to-stop interpolation. Supplied paths take precedence; otherwise the app supplies direct segments so these services do not inherit the shared renderer's land-transport shoreline detours. **These segments are not validated shipping lanes or navigable-water routes.** Credible water geometry remains a requirement for the Lake Lucerne–Rigi composition, as do cableway alignments and vertical motion.

Reproduce with matching source archives:

```sh
npm run data:zvv -- --archive /path/GTFS_FP2026_20260902.zip --date 2026-09-04 --local-stop-archive /path/zvv-2026.zip
npm run data:zvv:shapes -- --archive /path/zvv-2026.zip --feed-version 2026_google_transit
```

The local-stop archive preserves the established ZVV tram/bus boundary when using the national feed. See [the data pipeline](DATA-PIPELINE.md) for source acquisition and the other regional commands.

## Verification and next work

Unit and importer integration tests cover midnight, dwell, exclusive interval ends, changed headways, stable window/chunk identities, malformed data, calendar additions/removals, template replacement, missing optional frequency files and ferry path precedence. Desktop Chromium and emulated iPhone WebKit tests check lazy loading, real headway ferry disclosure and exact-departure labels. Physical-device review remains open.

This supplies frequency semantics for future regional studies. It does not yet deliver a full-day mountain/water composition, seasonal coverage, source-established continuous cabin operation or validated water and vertical geometry.
