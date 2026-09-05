# gleislicht: Switzerland in motion

A cinematic browser visualisation of Switzerland's railway network, built from open timetable data and real topography. The long-term idea is to move between a national network view and intimate, camera-led journeys through a luminous low-poly landscape.

Public study: <https://emmettl.github.io/gleislicht/>

The current motion study opens on a national morning view derived from the official Swiss GTFS timetable, with 764 scheduled rail services moving inside Switzerland at 07:45. A separate **24H** study expands the national clock to a complete service day; it loads the current three-hour block on demand and prefetches adjacent blocks, keeping both the opening view and full-day transition light. A lazily loaded Zürich city study reveals the same morning at street scale across trains, trams, buses and funiculars. A hub-scale Takt pulse makes scheduled calls at Zürich HB, Bern, Basel SBB and Genève contract toward the station and radiate out again. Follow-camera journeys cover Zürich–Chur in measured swissALTIRegio terrain and PostBus 220 through a higher-resolution swissALTI3D Kiental crop with road-following geometry. All interpolation models are labelled clearly.

The mobile first view has an enforced 790 KiB compressed transfer ceiling covering application JavaScript, CSS, the national morning timetable with rail geometry, boundary and lakes. Hub data, soundtrack code, station visualisations and the measured corridor artifact load only when selected. Run `npm run build && npm run check:bundle` to verify the same budget locally; the Pages workflow rejects regressions automatically.

The complete interface is available in English, German, French and Italian. It follows the visitor's supported browser language, falls back to English, and remembers changes made with the **EN / DE / FR / IT** switch.

The national card also carries a compact **PLAN / DEMO / LIVE** operations switch. The bundled demo applies representative delays, a cancellation and a skipped stop to the exactly matching static feed so the interaction remains reviewable without a credential or invented GPS positions. A separate Cloudflare Worker adapter is ready to decode the official GTFS-RT Trip Updates feed at the edge; it falls back to the schedule on feed-version mismatch, stale data or failure. Production LIVE activation intentionally remains off until a feed key and a current matching static service day are configured. See [docs/REALTIME.md](./docs/REALTIME.md).

The national atlas also offers **LUFT**, a deliberately optional historical ADS-B study. Selecting it lazy-loads one matching hour of observed aircraft positions and draws dim magenta needles with three-minute ephemeral trails above the brighter railway lattice. Altitude is real but visually compressed; aircraft can be found by callsign or ICAO address, and selecting one reveals its callsign, altitude, groundspeed and heading in a tilted follow view. See [docs/LUFTRAUM.md](./docs/LUFTRAUM.md).

## Run it

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run worker:check
npm run worker:build
```

Keyboard controls: `Space` pauses or resumes; `C` returns to or switches from the national view.

Search the national view by station, service, train number, origin, or destination. The result list supports arrow-key navigation, Home/End, Enter to select, and Escape to close. Selecting a train isolates its scheduled path and carries the camera down to follow it. Selecting a station centres the map, marks the station, and illuminates the complete scheduled paths of every service calling there in the morning study. Train lights are colour-coded by service class from international and InterCity through S-Bahn and regional services.

For a measured rail journey, search for a Zürich–Chur service such as **2355**, select it, then choose **Descend into real terrain**. The camera follows that train over the matched 116 km corridor while the timetable card and scrubber remain usable. A persistent journey selector switches directly between that IR35 run and the complete scheduled 19-stop PostBus 220 journey over its 13.9 km Kiental–Griesalp road trace. Zürich–Chur identifies seven published railway tunnels, marks their portals and changes camera, light and optional sound as the train enters them.

Use the **CH / 24H / ↔ / ZVV / GE / ZH** switch in the search bar to move between Switzerland's rail atlas, its full day, the synchronized city–valley contrast, the ZVV region, the Genève/TPG region and Zürich city. All single-map studies share the national coordinate system: selecting a regional or city study physically flies and zooms the camera into the chosen area while a dim national rail layer preserves geographic context, and CH reverses the journey. Reset always returns to the active study's home view. The regional and city artifacts remain separate on-demand downloads, so they do not enlarge the national first load. National trains follow matched Federal Office of Transport infrastructure geometry, Zürich tram and bus motion follows official ZVV geometry, and Genève tram, trolleybus and bus motion follows official TPG/SITG line geometry. Unmatched services retain honest straight stop interpolation.

The ZVV and Genève overviews deliberately open with a rail-led hierarchy: weighted local corridors remain visible, individual trams reveal after the first zoom descent, and buses appear closer in. Selecting any local category, line, station or vehicle immediately overrides that aggregation so search and comparison remain direct. Genève keeps TPG's French stop names and the real cross-border branches to Annemasse, Saint-Julien, Ferney and the wider French Genevois visible beyond the luminous Swiss outline.

The **↔** study sets Zürich's shape-aware tram pulse beside PostBus route 220 from Reichenbach im Kandertal to Griesalp on one synchronized 24-hour clock. Both maps remain independently pannable and zoomable; the current three-hour movement blocks load first and adjacent blocks prefetch as the clock advances. The rural study's 20 PostBus trips, compact 33-stop bus-and-rail footprint and officially documented 28% final climb make it a strong foil for the city's 5,329 tram trips and a practical first real-terrain crop. See [docs/POSTBUS-CORRIDOR.md](./docs/POSTBUS-CORRIDOR.md) for the shortlist and decision.

Click a service category in the colour legend to highlight that fleet and dim the other trains; click the active category again to clear the filter. The selected control takes on its category colour while unrelated vehicles, trails and the weighted network recede decisively. Train and station result cards use the same stronger foreground/background hierarchy. The same focus carries into the Takt hub view.

The national and Zürich maps support mouse-wheel or pinch zoom, pointer or touch drag to pan, and on-screen zoom/reset controls. Regional studies have a deeper close range than the national atlas, and portrait city views descend furthest so street-scale networks remain inspectable on phones; soft limits still keep the camera above the map. A glowing national outline is derived from swisstopo's official swissBOUNDARIES3D geometry and remains visible, at lower intensity, during focused studies. Named federal lake polygons add ink-dark water and restrained cyan shorelines across every map scale, including the complete shared border lakes. The national timetable is joined offline to the official FOT rail network, so matched trains, highlights and trails follow infrastructure rather than station-to-station chords. Where no match is available, a fallback segment that crosses a substantial distance through a lake follows the shorter shoreline; small crossings are preserved for real bridges. In both studies, station names reveal progressively relative to the view's home scale, prioritising busy interchanges and suppressing overlapping labels; at close range, every station in the visible area becomes eligible rather than only a fixed shortlist. Label textures are pinned by their cyan marker directly to the station surface, avoiding perspective drift at close zoom. Station vertices use circular glow sprites whose world size follows camera distance, so close regional views do not expose WebGL's square point primitive. During a selected-train follow, its own calling points take priority. The follow camera temporarily takes control; releasing it returns to the previous map position.

Rail sections are weighted by the number of scheduled vehicle traversals in the active study window. A logarithmic scale keeps quieter branches legible while increasingly frequent corridors move from violet to cyan; only the busiest band breathes slowly, distinguishing network intensity from the faster motion of individual vehicles. Parallel platform-level edges are aggregated by their named station pair before weighting.

Active trains and regional vehicles leave a short three-band trail reconstructed directly from their recent timetable positions. The 135-second scheduled history fades with age, carries the service-category colour, and follows train, station and category filters without accumulating stale paths after timeline seeks.

The **vehicle labels · auto/on/off** map control manages moving train and aircraft labels. Auto begins with long-distance trains and a very sparse set of aircraft callsigns, then reveals more with zoom. On raises both densities while retaining collision suppression and stable label choices; Off keeps the moving lights unlabelled. Aircraft always remain quieter than trains, and a selected vehicle takes priority.

Open **Takt hubs** to move between Zürich HB, Bern, Basel SBB and Genève across a continuous 24-hour schedule. Switch between **Pulse**, the abstract clock-face composition, and **Tracks**, a schematic station plan driven by the feed's real platform assignments. Four tempo settings run from 1× to 64×, turning the day into a slow study or a rapid station flow. See [docs/HUB-STUDY.md](./docs/HUB-STUDY.md) for the visual model and the deliberately careful wording around Zürich's “busiest” status.

Sound is optional and off by default. Turning on the adaptive score lazily loads the Driftbox synthesis engine and plays one of three Gleislicht arrangements: **Night Grid** for the national map, **Taktwerk** for station pulses, and **Valley Signal** for corridor or train-follow views. Mode changes crossfade between two live transports. Inside a journey, speed, terrain openness and tunnel state continuously shape a restrained spatial filter without changing the timeline or musical tempo. See [docs/SOUNDTRACK.md](./docs/SOUNDTRACK.md) for the musical and technical design.

The committed GTFS and geography snapshots are regenerated with `npm run data:gtfs`, `npm run data:day`, `npm run data:rail:shapes`, `npm run data:zvv`, `npm run data:zvv:shapes`, `npm run data:geneva`, `npm run data:geneva:shapes`, `npm run data:postbus:kiental`, `npm run data:corridor:kiental`, `npm run data:zurich`, `npm run data:zurich:shapes`, `npm run data:zurich:day`, `npm run data:zurich:day:shapes`, `npm run data:boundary`, `npm run data:lakes`, `npm run data:corridor` and `npm run data:air`. `npm run data:validate` checks the shared national artifact set, the Alpine corridor and the historical air snapshot, and a twice-weekly workflow publishes validated national refreshes to a dedicated review branch; see [docs/DATA-PIPELINE.md](./docs/DATA-PIPELINE.md).
The eventual public deployment is GitHub Pages; see [docs/PUBLISHING.md](./docs/PUBLISHING.md).

## Technical shape

- Vite + React + strict TypeScript
- Three.js through React Three Fiber
- Driftbox's Web Audio engine for a fully synthesised, adaptive soundtrack
- oxlint, Vitest, and a small domain layer kept separate from rendering
- static deployment for the visual client; preprocessing jobs turn large GTFS/topography sources into compact, versioned web assets

See [ROADMAP.md](./ROADMAP.md) for delivery stages and [docs/VISION.md](./docs/VISION.md) for the product and art direction.
