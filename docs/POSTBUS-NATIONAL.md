# Nationwide PostBus

Select **PA** to explore the national PostBus timetable on a 24-hour clock. Buses remain visible from the national overview, with weighted connections and moving trails. Markers, trails and selection accents use Swiss Post’s digital Postgelb (`#FFCC00`), as specified in its [RGB colour guidance](https://microsites.post.ch/-/media/post-maxisites/microsites/documents/Post-RGB-Barrierefreiheit-160922.pdf). Zoom, stop selection, journey selection and line search use the existing map controls. The opening rail view does not fetch PostBus data.

## Coverage

The committed study uses Swiss GTFS release **20260902** for **8 September 2026**. It includes all bus trips under PostAuto agency `801` active on that service date and intersecting the 00:00–24:00 window. There is no route shortlist or geographic clipping, including on cross-border branches.

| Measure | Count |
| --- | ---: |
| Daily trips | 32,390 |
| Distinct source route IDs | 821 |
| Platform-level stops | 21,274 |
| Distinct stop names | 10,033 |
| Network edges | 24,789 |
| Buses at 07:45 | 1,055 |
| Peak simultaneous buses | 1,148 at 07:38 |

Coverage is the selected service day's scheduled network, not every seasonal line on every date. Previous service-day trips continuing after midnight are not added to this snapshot. Empty overnight chunks are valid. The UI displays the study date and identifies the movement as scheduled interpolation; it does not claim live GPS positions.

The national timetable feed supplies no road shapes. An offline pfaedle bus match against OpenStreetMap now supplies **24,472 shared road paths** with **285,938 vertices**. These cover **485,872 of 486,882 scheduled stop-to-stop movements (99.79%)**, across all 821 routes. The remaining 1,010 movements retain the shared stop-based/lake-avoidance fallback. The interface displays the matched percentage and credits OpenStreetMap contributors under ODbL. Paths are inferred from roads and timetable stops, not verified operator trajectories or GPS observations. [POSTBUS-ROAD-GEOMETRY.md](./POSTBUS-ROAD-GEOMETRY.md) describes the pilot, remaining gaps and regeneration.

PostBus repeats display numbers across regions: the snapshot contains five unrelated lines numbered 220. The importer retains each bus's source `routeId`; the Swiss route index groups directions by that identity, and search results include destinations. A selected line isolates that source route in the scene so the shared display-number-based label logic cannot highlight unrelated routes.

## Loading and measured performance

The road-enriched topology compresses to **2.09 MiB**, up from 542 KiB. Eight three-hour movement chunks remain below **741 KiB compressed**. Entering at 07:45 requests about **2.8 MiB compressed** for topology and current movement data before adjacent-block prefetching. Only the active block enters the renderer. Loaded blocks are cached for revisiting; the renderer already batches bus points and uses a time index for moving vehicles. Road geometry uses the existing distance-indexed polyline interpolation. No fleet thinning or overview suppression was needed; the opening rail view remains within its original 790 KiB total transfer budget.

For scale, the local All Change bus artifact contains 103,117 daily trips and 19,756 stops, compared with PostBus's 32,390 trips and 21,274 stops. London uses a different compact movement format, so raw chunk sizes are not directly comparable.

Local development measurements on an **Apple M4 Max**, 1280×720, Chromium with ANGLE Metal:

| View | Mean frame rate | 95th-percentile frame interval | Approx. JS heap |
| --- | ---: | ---: | ---: |
| Existing rail morning, same measurement session | 58 FPS | 16.8 ms | 90 MB |
| National PostBus before road geometry | 56.3 FPS | 16.8 ms | 91 MB |
| National PostBus with road geometry | 55.9 FPS | 16.8 ms | 115 MB |

Local hardware Chromium transition time was 212 ms before and 269 ms after adding roads. These are single-run local comparisons, not a latency guarantee. WebKit with the iPhone 13 viewport/device profile on this Mac measured about 60 FPS and a 0.8-second local PostBus transition with roads. This is mobile browser emulation, not a physical iPhone or a cellular-network benchmark. Software-only Chromium is substantially slower and is unsuitable as a device-performance proxy; see the road-geometry report. Cold internet transfer, lower-end GPUs and extended all-day heap usage remain practical limits to assess on real devices.

## Regeneration and checks

```sh
npm run data:postbus:national -- --archive /path/to/swiss-gtfs.zip --date YYYY-MM-DD
npm run data:postbus:roads
node scripts/audit-postbus.mjs
npm run dev -- --host 127.0.0.1 --port 4180
# In another terminal; --metal is for macOS with a supported GPU:
node scripts/benchmark-postbus.mjs --metal
```

The audit validates operator/mode scope, source route identities, every movement chunk's length and SHA-256, day continuity, stop references, boundary-trip consistency, path references and endpoint alignment, at least 95% road coverage, fewer than 500,000 vertices, and compressed budgets of 3 MiB for topology and 1 MiB per movement chunk. `data:validate` includes this audit. Desktop and mobile browser checks cover lazy entry, search, time jumps, empty hours, road coverage/attribution and missing/corrupt data.

Both daily Pages regeneration and the national refresh review branch now regenerate PostBus from the same downloaded official archive. If the Pages source download fails, the committed PostBus snapshot remains available under its original displayed date, independently of the existing rail recovery mechanism.
