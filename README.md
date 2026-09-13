# Motion Studies 005 — Gleislicht

**[Open Gleislicht](https://motionstudies.app/gleislicht/)** · [Motion Studies catalogue](https://emmettl.github.io/motionstudies/)

[Study brief](https://github.com/emmettl/motionstudies/blob/main/docs/GLEISLICHT.md) · [Project goals](https://github.com/emmettl/motionstudies/blob/main/docs/VISION.md) · [Roadmap](https://github.com/emmettl/motionstudies/blob/main/ROADMAP.md)

A cinematic browser visualisation of Switzerland's transport networks, built from open timetable data, recorded aircraft and road observations, and real topography. Move between the national atlas, regional networks, camera-led terrain journeys and an orbital view of public transport above the Swiss Alps.

**Gleislicht** is Motion Studies 005: the Swiss edition. Shared runtime and Node tooling come from exact `@motionstudies/*` npm releases at `0.1.0-alpha.15`; their source, tests and widget lab live in [Motion Studies](https://github.com/emmettl/motionstudies).

Other editions have independent repositories: [All Change](https://github.com/emmettl/allchange) and [Correspondances](https://github.com/emmettl/correspondances). This repository builds only Switzerland.

Public studies: [Gleislicht](https://motionstudies.app/gleislicht/) · [All Change](https://emmettl.github.io/allchange/) · [Correspondances](https://emmettl.github.io/correspondances/).

The study opens on a national morning view derived from the official Swiss GTFS timetable. Production selects the prepared Swiss service date; the number of scheduled services varies with that day's timetable. A separate **24H** study expands the national clock to a complete service day; it loads the current three-hour block on demand and prefetches adjacent blocks, keeping both the opening view and full-day transition light. A lazily loaded Zürich city study reveals the same morning at street scale across trains, trams, buses and funiculars. A hub-scale Takt pulse makes scheduled calls at Zürich HB, Bern, Basel SBB and Genève contract toward the station and radiate out again. Follow-camera journeys cover Zürich–Chur in measured swissALTIRegio terrain and PostBus 220 through a higher-resolution swissALTI3D Kiental crop with road-following geometry. All interpolation models are labelled clearly.

The mobile first view has an enforced 792 KiB compressed transfer ceiling covering application JavaScript, CSS, the national morning timetable with rail geometry, boundary and lakes. Hub data, soundtrack code, station visualisations and the measured corridor artifact load only when selected. Run `npm run build && npm run check:bundle` to check the pinned production release locally; this fetches its opening data from R2. The offline fixture check is described below. The Pages workflow enforces both fixture and production budgets.

The complete interface is available in English, German, French and Italian. It follows the visitor's supported browser language, falls back to English, and remembers changes made with the **EN / DE / FR / IT** switch.

The national card also carries a compact **PLAN / DEMO / LIVE** operations switch. The bundled demo applies representative delays, a cancellation and a skipped stop to the exactly matching static feed so the interaction remains reviewable without a credential or invented GPS positions. The deployed Cloudflare Worker polls the official GTFS-RT Trip Updates feed once per minute and pairs updates with today's published timetable calendar, verifying trip and ordered source-stop identities. Calendar builds configure the LIVE endpoint before publication; the browser applies corrections only when the feed version and service date match and the source is no more than 150 seconds old. Stale, incompatible or failed responses fall back to scheduled playback; the labelled demo remains available. LIVE corrects timetable interpolation, not GPS positions, and the current feed is not a historical delay archive. See [docs/REALTIME.md](./docs/REALTIME.md).

The national atlas also offers **LUFT**, a deliberately optional historical ADS-B study. The opening view lazy-loads observed aircraft positions across the complete 06:45–08:45 morning window; **CH · 24H** switches to a searchable day manifest and progressively streams one-hour aircraft blocks. Dim magenta needles leave three-minute ephemeral trails above the brighter railway lattice. Altitude is real but visually compressed; aircraft can be found across the day by callsign or ICAO address, and selecting one moves the clock to its observation and reveals altitude, groundspeed and heading in a tilted follow view. See [docs/LUFTRAUM.md](./docs/LUFTRAUM.md).

**AUTO** completes the first transport-data triad with recorded ASTRA conditions across Switzerland's national-road network. Warm-white light traffic and larger amber heavy vehicles are synthetic particles reconstructed from observed directional flow and mean speed (`density = flow / speed`), not tracked automobiles. **CH · 24H** now includes all 1,440 minute observations from 00:00 through 23:59 CEST on 8 September 2026 across 718 accepted directional sites and 609 counter-to-counter sections. Hourly chunks load on demand, with at least 84.1% of accepted sites usable in every minute. A clearly disclosed representative A1 Zürich morning calibration remains the fallback when the recorded artifact is unavailable. See [docs/AUTO.md](./docs/AUTO.md).

## Delivery status — 13 September 2026

The Swiss study is implemented across the national atlas, regional and city networks, terrain journeys, orbital public transport, soundtrack, four interface languages, aircraft and recorded road traffic. Physical-device review is complete: the owner accepts iPhone 17 Pro and Fairphone 6 performance, reports smooth operation on both Macs, and accepts the remaining Windows laptop limitations. Substantial further Windows optimisation is deferred. See [performance acceptance](docs/ORBITAL-PERFORMANCE.md).

National AUTO already includes all 1,440 recorded minutes of 8 September. Further cantonal studies and unresolved geometry are optional coverage work; Aargau and St Gallen remain subject to their documented release gates. Service-alert presentation is a separate next increment after Trip Updates. See [regional release decisions](docs/REGIONAL-FEED-INTEGRATION.md), [realtime operations](docs/REALTIME.md) and [daily road archives](docs/ROAD-HISTORY.md).

The production app pins immutable public data releases on R2 at `data.motionstudies.app`. App builds omit the datasets; see [data hosting and release procedures](docs/data-hosting.md). The timetable calendar and realtime Worker rollout completed on 13 September: releases prepare today and tomorrow together, and hourly public checks detect stale or incomplete publication. See [regular refreshes](docs/REGULAR-REFRESHES.md).

## Run it

Use Node 24 LTS (`nvm use`) and npm 11.19.0.

The Pages workflow refreshes national and regional timetables at 03:37 and 18:37 UTC, preparing both today and tomorrow in Europe/Zurich. Recovery after an upstream download failure verifies the published artifacts' dates, feed versions, chunk coverage and checksums. Calendar assembly rejects older-date fallbacks for daily studies, so a failed refresh leaves the existing release available without relabelling old data. Reviewed regional archives, aircraft observations and road recordings retain their own dates.

```bash
nvm use
npm ci
npm run dev
```

Development uses the committed fixtures. `npm run build` produces the application and its pinned R2 release pointer without regenerating or bundling datasets. To prepare an offline build, run:

```bash
npm run data:prepare
npm run build:fixtures
npm run check:bundle
```

`data:prepare` regenerates tracked app catalogues and ignored orbital blocks. Keep those generated catalogue changes aligned with the intended data release before returning to a production build.

Quality checks:

```bash
npm run lint
npm run typecheck
npm run check:architecture
npm test
npm run build
npm run worker:check
npm run worker:build
npx tsc -p road-daily-worker/tsconfig.json
npx wrangler deploy --config wrangler.road-daily.jsonc --dry-run --outdir .worker-dist/road-daily
npm run check:bundle
```

CI checks the fixture build and payload budget first, then runs two Chromium shards, one iPhone WebKit runner and four timetable jobs: national and regional generation for each of today and tomorrow. Each browser runner uses one worker; deployment waits for every browser shard, the live publication gates, and Chromium/iPhone WebKit checks against the final R2-backed production build. Reports include wall time and the ten slowest tests. See [CI timings and local shard commands](docs/CI.md).

Atlas keyboard controls: `Space` or `P` pauses or resumes; `C` returns to or switches from the national view. In Orbital, `Space` pauses or resumes, `F` toggles Focus view, and `Escape` restores the controls.

Search the national view by station, service, train number, origin, or destination. The result list supports arrow-key navigation, Home/End, Enter to select, and Escape to close. Selecting a train isolates its scheduled path and carries the camera down to follow it. Selecting a station centres the map, marks the station, and illuminates the complete scheduled paths of every service calling there in the morning study. Train lights are colour-coded by service class from international and InterCity through S-Bahn and regional services.

For a measured rail journey, search for a Zürich–Chur service such as **2355**, select it, then choose **Descend into real terrain**. The camera follows that train over the matched 116 km corridor while the timetable card and scrubber remain usable. A persistent journey selector switches directly between that IR35 run and the complete scheduled 19-stop PostBus 220 journey over its 13.9 km Kiental–Griesalp road trace. Zürich–Chur identifies seven published railway tunnels, marks their portals and changes camera, light and optional sound as the train enters them.

Use **Explore studies** or the desktop/mobile study selectors to move between Switzerland's rail atlas, its full day, the synchronized city–valley contrast, regional networks and mountain journeys. All single-map studies share the national coordinate system: selecting a regional or city study physically flies and zooms the camera into the chosen area while a dim national rail layer preserves geographic context, and CH reverses the journey. Reset always returns to the active study's home view. The regional and city artifacts remain separate on-demand downloads, so they do not enlarge the national first load. National trains follow matched Federal Office of Transport infrastructure geometry, Zürich tram and bus motion follows official ZVV geometry, and Genève tram, trolleybus and bus motion follows official TPG/SITG line geometry. Unmatched services retain honest straight stop interpolation.

The ZVV and Genève overviews deliberately open with a rail-led hierarchy: weighted local corridors remain visible, individual trams reveal after the first zoom descent, and buses appear closer in. Selecting any local category, line, station or vehicle immediately overrides that aggregation so search and comparison remain direct. Genève keeps TPG's French stop names and the real cross-border branches to Annemasse, Saint-Julien, Ferney and the wider French Genevois visible beyond the luminous Swiss outline.

Selectable regional studies include Zürich city, ZVV, Genève, Lausanne, Basel, Bern, Solothurn, Nyon, Riviera, Ticino, Valais, Graubünden, Luzern, Zug, Thurgau and Fribourg. Luzern, Zug, Thurgau and Fribourg use reviewed Friday/Sunday archives with full-day playback, search and shared links. See [existing-feed integration](docs/REGIONAL-FEED-INTEGRATION.md) for coverage, source attribution, reproducible packaging and feeds still awaiting release.

The [regional network survey](docs/REGIONAL-NETWORK-SURVEY.md) preserves the initial source-discovery work. Many candidates are now selectable; use [current regional integration decisions](docs/REGIONAL-FEED-INTEGRATION.md) and [the eleven-canton review](docs/UNSTUDIED-CANTONS.md) for remaining coverage work.

The **PA** study expands PostBus to its nationwide scheduled network. Production refreshes it for today and tomorrow; the committed 8 September 2026 fixture contains 32,390 daily trips across 821 active source routes. A separate topology and three-hour movement chunks load only when selected. Buses remain visible from the national overview, and destination-aware route search separates repeated line numbers across regions. Postgelb markers follow inferred OpenStreetMap road paths, covering 99.79% of scheduled stop-to-stop movements in that fixture; unresolved segments retain the stop-based fallback. See [docs/POSTBUS-NATIONAL.md](./docs/POSTBUS-NATIONAL.md) for coverage, payload budgets and measured rendering performance.

The **↔** study sets Zürich's shape-aware tram pulse beside PostBus route 220 from Reichenbach im Kandertal to Griesalp on one synchronized 24-hour clock. Both maps remain independently pannable and zoomable; the current three-hour movement blocks load first and adjacent blocks prefetch as the clock advances. The rural study's 20 PostBus trips, compact 33-stop bus-and-rail footprint and officially documented 28% final climb make it a strong foil for the city's 5,329 tram trips and a practical first real-terrain crop. See [docs/POSTBUS-CORRIDOR.md](./docs/POSTBUS-CORRIDOR.md) for the shortlist and decision.

Click a service category in the colour legend to highlight that fleet and dim the other trains; click the active category again to clear the filter. The selected control takes on its category colour while unrelated vehicles, trails and the weighted network recede decisively. Train and station result cards use the same stronger foreground/background hierarchy. The same focus carries into the Takt hub view.

Choose **Cogwheel** in the national service legend or phone map-tools picker to isolate source-classified cogwheel railways. It works in the morning and **24H** views, loads its catalogue on demand, and adds operator search such as **Rigi Bahnen** or **Gornergratbahn**. The catalogue is regenerated alongside the national timetable and joins eligible full-day services to their exact source identities; other Alpine railways remain in the regular rail view. See [docs/MOUNTAIN-TRANSPORT.md](./docs/MOUNTAIN-TRANSPORT.md) for the audit, regeneration command and coverage limits.

The national and Zürich maps support mouse-wheel or pinch zoom, pointer or touch drag to pan, and on-screen zoom/reset controls. Regional studies have a deeper close range than the national atlas, and portrait city views descend furthest so street-scale networks remain inspectable on phones; soft limits still keep the camera above the map. A glowing national outline is derived from swisstopo's official swissBOUNDARIES3D geometry and remains visible, at lower intensity, during focused studies. Named federal lake polygons add ink-dark water and restrained cyan shorelines across every map scale, including the complete shared border lakes. The national timetable is joined offline to the official FOT rail network, so matched trains, highlights and trails follow infrastructure rather than station-to-station chords. Where no match is available, a fallback segment that crosses a substantial distance through a lake follows the shorter shoreline; small crossings are preserved for real bridges. In both studies, station names reveal progressively relative to the view's home scale, prioritising busy interchanges and suppressing overlapping labels; at close range, every station in the visible area becomes eligible rather than only a fixed shortlist. Label textures are pinned by their cyan marker directly to the station surface, avoiding perspective drift at close zoom. Station vertices use circular glow sprites whose world size follows camera distance, so close regional views do not expose WebGL's square point primitive. During a selected-train follow, its own calling points take priority. The follow camera temporarily takes control; releasing it returns to the previous map position.

Rail sections are weighted by the number of scheduled vehicle traversals in the active study window. A logarithmic scale keeps quieter branches legible while increasingly frequent corridors move from violet to cyan; only the busiest band breathes slowly, distinguishing network intensity from the faster motion of individual vehicles. Parallel platform-level edges are aggregated by their named station pair before weighting.

Active trains and regional vehicles leave a short three-band trail reconstructed directly from their recent timetable positions. The 135-second scheduled history fades with age, carries the service-category colour, and follows train, station and category filters without accumulating stale paths after timeline seeks.

The **vehicle labels · auto/on/off** map control manages moving train and aircraft labels. Auto begins with long-distance trains and a very sparse set of aircraft callsigns, then reveals more with zoom. On raises both densities while retaining collision suppression and stable label choices; Off keeps the moving lights unlabelled. Aircraft always remain quieter than trains, and a selected vehicle takes priority. When LUFT is enabled it also joins the service-category controls: selecting it isolates aircraft against a subdued railway, while selecting IC or another rail category quiets the air layer.

Open **Takt hubs** to move between Zürich HB, Bern, Basel SBB and Genève across a continuous 24-hour schedule. Switch between **Pulse**, the abstract clock-face composition, and **Tracks**, a schematic station plan driven by the feed's real platform assignments. Four tempo settings run from 1× to 64×, turning the day into a slow study or a rapid station flow. See [docs/HUB-STUDY.md](./docs/HUB-STUDY.md) for the visual model and the deliberately careful wording around Zürich's “busiest” status.

Sound is optional and off by default. Turning on the adaptive score lazily loads the Driftbox synthesis engine and plays one of three Gleislicht arrangements: **Night Grid** for the national map, **Taktwerk** for station pulses, and **Valley Signal** for corridor or train-follow views. Mode changes crossfade between two live transports. Inside a journey, speed, terrain openness and tunnel state continuously shape a restrained spatial filter without changing the timeline or musical tempo. See [docs/SOUNDTRACK.md](./docs/SOUNDTRACK.md) for the musical and technical design.

The committed GTFS and geography snapshots are regenerated with `npm run data:gtfs`, `npm run data:day`, `npm run data:rail:shapes`, `npm run data:zvv`, `npm run data:zvv:shapes`, `npm run data:geneva`, `npm run data:geneva:shapes`, `npm run data:postbus:kiental`, `npm run data:corridor:kiental`, `npm run data:zurich`, `npm run data:zurich:shapes`, `npm run data:zurich:day`, `npm run data:zurich:day:shapes`, `npm run data:boundary`, `npm run data:lakes`, `npm run data:corridor`, `npm run data:air` and `npm run data:road`. The national AUTO topology accepts 379 federal sites into 609 directed sections, with the final interchange ambiguity resolved from official FEDRO TMC road references; `npm run data:road:compile:national` compiles saved observations into progressively loaded minute chunks. The deployed daily archive Worker separately compiles private daily summaries; see [daily road archives](docs/ROAD-HISTORY.md). `npm run data:validate` checks the shared national artifact set, the Alpine corridor, historical air snapshots and the disclosed road calibration, and a manual-only workflow prepares validated national test-fixture refreshes on a dedicated review branch; see [docs/DATA-PIPELINE.md](./docs/DATA-PIPELINE.md).

The public home is [motionstudies.app/gleislicht](https://motionstudies.app/gleislicht/). Canonical, Open Graph and Twitter metadata use this domain. [GitHub Pages](https://emmettl.github.io/gleislicht/) remains available as a mirror and supplies the validated release artifact that is subsequently published to Cloudflare. Authenticated realtime polling and unattended ASTRA recording run as separate Cloudflare Workers backed by a private R2 bucket; see [docs/PUBLISHING.md](./docs/PUBLISHING.md) and [docs/CLOUDFLARE.md](./docs/CLOUDFLARE.md).

## Technical shape

- Vite + React + strict TypeScript
- Three.js through React Three Fiber
- Driftbox's Web Audio engine for a fully synthesised, adaptive soundtrack
- published `@motionstudies/core`, `@motionstudies/three` and `@motionstudies/web` runtime packages plus Node-only `@motionstudies/data` tooling, with exact version pins and installed-package boundary checks
- oxlint and Vitest, with domain, rendering and browser concerns kept in one-way dependency order
- static deployment for the visual client; preprocessing jobs turn large GTFS/topography sources into compact, versioned web assets

See [the central roadmap](https://github.com/emmettl/motionstudies/blob/main/ROADMAP.md) for Swiss delivery stages and the wider programme and [docs/EXTRACTION.md](./docs/EXTRACTION.md) for repository ownership. The widget lab and package release gates run in Motion Studies; edition browser, payload and worker checks run here.

## Standard selection labels

The shared `@motionstudies/three` renderer gives the selected station first label priority, then the selected route’s terminals (including branch endpoints), then intermediate stops. Selecting a service uses its own endpoints. Clearing selection restores normal station ranking. The rule applies to map clicks and search/picker selection in both geographic and diagram layouts. See the [Motion Studies edition contract](https://github.com/emmettl/motionstudies/blob/main/docs/EDITIONS.md#selection-and-station-labels).

### Airport movement boards

Airport selections use the shared `AirportHeroCard` from `@motionstudies/web`. Departures/arrivals follow the study clock, looking 10 minutes behind and 60 minutes ahead within the active study window. Loading and empty messages use the split-flap columns; new rows settle in 675 ms with staggered characters.

The 4 September 2026 air fixtures include optional origin/destination evidence from cached global ADSB.lol heatmaps and the public-domain [OurAirports reference](https://ourairports.com/data/). These are inferred observed movements, not schedules or confirmed flight plans. Unknown routes remain blank. Full-day manifest entries and playback chunks carry the same evidence; metadata records the input hashes, reference source, and local UTC offset (2 hours for this service date).

After ingesting the base air study, regenerate the enrichment with `npm run data:air:routes -- /path/to/cached-heatmaps /path/to/airports.csv`. Supply heatmaps covering the same local service day and a saved OurAirports `airports.csv`; the command performs no network calls. Raw source files remain outside the repository.

### Now, full-day regions and study links

National rail, hubs, cogwheel services, national PostBus, Zürich city, ZVV, Genève and Lausanne participate in the daily calendar. Basel, Bern, Solothurn, Nyon and Riviera retain their reviewed-date refresh policies; other regional and mountain archives remain dated. See [regular refreshes](docs/REGULAR-REFRESHES.md) for coverage and publication checks.

**Explore studies** opens a visual browser with named places, descriptions, previews and study dates. Selecting Zürich city, ZVV or Genève from this browser loads its complete multimodal day in twelve verified two-hour chunks. The existing direct study switches retain their lightweight morning views; **Full day** toggles the selected region's time coverage. Full-day local paths use official ZVV or TPG geometry and rail paths use matched FOT infrastructure.

**Now** moves eligible scheduled studies to the current Swiss local clock at realtime pace. From a morning view it loads the full day first. It uses today's timetable or a clearly labelled representative timetable within 31 days, matching weekday, Saturday or Sunday; it does not turn historical aircraft or road recordings into live observations. For studies in the daily calendar, an active Now session rolls over to the next prepared Swiss day at midnight; paused and historical playback keep their selected date. Pausing, seeking, changing speed, selecting a moving train or leaving the study releases the wall clock. **Near me** requests browser location only after a click and shows an approximate glowing marker when inside the study bounds. Coordinates stay in memory and are excluded from links.

**Share study** creates a link containing the study, available service date, playback time and supported train or station selection. Opening it restores paused playback; unavailable dates or selections are disclosed. The copyable URL remains available if clipboard permission is denied. See [EXPLORATION.md](docs/EXPLORATION.md) for generation, coverage and validation.

### Orbital view

Choose **Orbital view** beneath the title or in **Explore studies** to combine available public transport over measured Swiss terrain. Rail, buses, trams, metro, cableways, funiculars and boats share a full-day clock, with category filters, adjustable trails and camera orbit, pan and zoom. Optional mountain detail, simulated snow, sunlight and satellite-derived clouds shape the scene; **Focus view** hides the controls while playback continues. Returning to the atlas restores its previous study and camera.

Orbital combines reviewed weekday timetables from multiple source dates and removes duplicate journey representations. Its disclosure identifies this composite; it is not a single-date census or a live vehicle count. Data and terrain load only when the view opens. See [Orbital](docs/ORBITAL.md), [clouds](docs/ORBITAL-CLOUDS.md) and [performance acceptance](docs/ORBITAL-PERFORMANCE.md).

### Valais / Wallis initial regional study

The **VS** study integrates 5,102 Friday and 3,445 Sunday complete journeys from the pinned September 2026 timetable, reviewed FOT rail and attributed OSM bus matching. Its whole-canton inventory includes 385 annual route records, 78 agencies and all 13 districts. [Study, source investigation and reuse terms](docs/VALAIS-STUDY.md) · [all routes and exclusions](docs/VALAIS-ROUTE-INVENTORY.md). Rebuild with `npm run data:valais`, verify with `npm run data:valais:check`. The two dated fixtures are archival and deliberately partial; they are not part of automatic latest-timetable refresh.
