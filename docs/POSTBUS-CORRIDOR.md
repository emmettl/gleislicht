# Rural PostBus corridor selection

The first rural–urban contrast will use **PostBus route 220, Reichenbach im Kandertal–Griesalp**. This is a measured choice for the 2026-09-04 study date, not a generic scenic placeholder.

## Why Kiental

The national GTFS snapshot gives the corridor a useful visual rhythm:

| Measure | Kiental route 220 |
| --- | ---: |
| Active trips | 20 |
| Service span | 06:13–18:42 |
| Longest scheduled run | 45 minutes |
| Stop-chain distance | 11.0 km |
| Stops on the longest run | 19 |
| Median combined departure gap | 44 minutes |
| Data footprint | 33 stops / 68 bus-and-rail trips |

The 20 bus trips are sparse enough to read against Zürich's dense tram field, while the roughly hourly cadence still gives the rural side recurring pulses across the day. The exact annual GTFS route ID is `96-100-0-j26-1`; selecting by that ID avoids accidentally including the other Swiss services which also publish the number 220.

The terrain case is unusually strong for such a small asset. PostBus describes the final climb as reaching a 28% gradient, its steepest route, while the timetable footprint fits within roughly 6 × 10 km. That makes a high-resolution swissALTI3D crop and an authored valley camera materially cheaper than a long Alpine pass crossing. The selected date is inside the published 23 May–18 October 2026 operating season.

## Shortlist

| Corridor | Trips | Span | Stop-chain distance | Decision |
| --- | ---: | --- | ---: | --- |
| Kiental 220, Reichenbach–Griesalp | 20 | 06:13–18:42 | 11.0 km | Selected: compact, steep, legible rural cadence |
| Diemtigtal 250, Oey–Grimmialp | 14 | 06:45–19:05 | 14.5 km | Strong fallback, but less distinctive terrain |
| Grimsel 161, Oberwald–Meiringen | 12 | 07:58–18:34 | 29.2 km | Spectacular, but broad and very seasonal |
| Chur–Bellinzona 171 | 29 | 05:40–22:28 | 92.8 km | Excellent long-distance pulse, too broad for the first terrain crop |

Distances are sums of straight distances between scheduled stops, so they are selection metrics rather than claims about driven road distance. Service counts and times come from the same Swiss GTFS release as the visual study.

## Data and interaction contract

- The rural artifact remains separate from the national and Zürich payloads.
- A manifest holds the 33-stop rail-and-bus topology; eight three-hour movement chunks keep the 24-hour clock progressive.
- Only route 220 is admitted as local bus traffic. Nearby BLS rail remains visible as the transfer spine at Reichenbach.
- Both sides of the future contrast share one clock, speed and play state. Empty rural hours stay empty; they are part of the comparison.
- The first renderer may use honest stop interpolation. Road alignment and swissALTI3D terrain arrive together so the hairpins are never presented as precise before the geometry supports them.
- The PostBus side keeps the existing orange service colour, with a warmer yellow terrain response reserved for the authored corridor view.

Regenerate the measurements with `npm run data:postbus:analyze` and the selected progressive artifact with `npm run data:postbus:kiental`; details are in [DATA-PIPELINE.md](./DATA-PIPELINE.md).
