# gleislicht: Switzerland in motion

A cinematic browser visualisation of Switzerland's railway network, built from open timetable data and real topography. The long-term idea is to move between a national network view and intimate, camera-led journeys through a luminous low-poly landscape.

The current motion study opens on a national morning view derived from the official Swiss GTFS timetable, with 764 scheduled rail services moving inside Switzerland at 07:45. A lazily loaded Zürich city study reveals the same morning at street scale across trains, trams, buses and funiculars. A hub-scale Takt pulse makes scheduled calls at Zürich HB, Bern, Basel SBB and Genève contract toward the station and radiate out again. A follow-camera study uses a synthetic Zürich–Chur journey and procedural terrain. All interpolation models are labelled clearly.

The complete interface is available in English, German, French and Italian. It follows the visitor's supported browser language, falls back to English, and remembers changes made with the **EN / DE / FR / IT** switch.

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
```

Keyboard controls: `Space` pauses or resumes; `C` returns to or switches from the national view.

Search the national view by station, service, train number, origin, or destination. The result list supports arrow-key navigation, Home/End, Enter to select, and Escape to close. Selecting a train isolates its scheduled path and carries the camera down to follow it. Selecting a station centres the map, marks the station, and illuminates the complete scheduled paths of every service calling there in the morning study. Train lights are colour-coded by service class from international and InterCity through S-Bahn and regional services.

Use the **CH / ZH** switch in the search bar to move between Switzerland's rail atlas and the separate Zürich city artifact. Both studies share the national coordinate system: selecting ZH physically flies and zooms the camera into Zürich while a dim national rail layer preserves geographic context, changes the masthead to the localized equivalent of “Zürich in motion”, and CH reverses the journey. Reset always returns to the active study's home view. The city view keeps tram, bus, rail and funicular movements distinct without adding their data to the national page load. See [docs/REGIONAL-STUDIES.md](./docs/REGIONAL-STUDIES.md) for the ZVV, Genève/TPG and rural PostBus direction.

Click a service category in the colour legend to highlight that fleet and dim the other trains; click the active category again to clear the filter. The same focus carries into the Takt hub view.

The national and Zürich maps support mouse-wheel or pinch zoom, pointer or touch drag to pan, and on-screen zoom/reset controls. Their extended close range adds several local zoom steps while a soft limit keeps the camera above the map. A glowing national outline is derived from swisstopo's official swissBOUNDARIES3D geometry and remains visible, at lower intensity, during focused studies. In both studies, station names reveal progressively relative to the view's home scale, prioritising busy interchanges and suppressing overlapping labels; at close range, every station in the visible area becomes eligible rather than only a fixed shortlist. Label textures are pinned by their cyan marker directly to the station surface, avoiding perspective drift at close zoom. Station vertices use circular glow sprites whose world size follows camera distance, so close regional views do not expose WebGL's square point primitive. During a selected-train follow, its own calling points take priority. The follow camera temporarily takes control; releasing it returns to the previous map position.

Rail sections are weighted by the number of scheduled vehicle traversals in the active study window. A logarithmic scale keeps quieter branches legible while increasingly frequent corridors move from violet to cyan; only the busiest band breathes slowly, distinguishing network intensity from the faster motion of individual vehicles. Parallel platform-level edges are aggregated by their named station pair before weighting.

Active trains and regional vehicles leave a short three-band trail reconstructed directly from their recent timetable positions. The 135-second scheduled history fades with age, carries the service-category colour, and follows train, station and category filters without accumulating stale paths after timeline seeks.

The **trains · auto/on/off** map control manages moving train labels. Auto begins with long-distance services, reveals more categories with zoom, and follows active station or service-category filters. On raises the density while retaining collision suppression; Off keeps the moving lights unlabelled.

Open **Takt hubs** to move between Zürich HB, Bern, Basel SBB and Genève across a continuous 24-hour schedule. Switch between **Pulse**, the abstract clock-face composition, and **Tracks**, a schematic station plan driven by the feed's real platform assignments. Four tempo settings run from 1× to 64×, turning the day into a slow study or a rapid station flow. See [docs/HUB-STUDY.md](./docs/HUB-STUDY.md) for the visual model and the deliberately careful wording around Zürich's “busiest” status.

Sound is optional and off by default. Turning on the adaptive score lazily loads the Driftbox synthesis engine and plays one of three Gleislicht arrangements: **Night Grid** for the national map, **Taktwerk** for station pulses, and **Valley Signal** for corridor or train-follow views. Mode changes crossfade between two live transports. See [docs/SOUNDTRACK.md](./docs/SOUNDTRACK.md) for the musical and technical design.

The committed GTFS and boundary snapshots are regenerated with `npm run data:gtfs`, `npm run data:zurich` and `npm run data:boundary`; see [docs/DATA-PIPELINE.md](./docs/DATA-PIPELINE.md).
The eventual public deployment is GitHub Pages; see [docs/PUBLISHING.md](./docs/PUBLISHING.md).

## Technical shape

- Vite + React + strict TypeScript
- Three.js through React Three Fiber
- Driftbox's Web Audio engine for a fully synthesised, adaptive soundtrack
- oxlint, Vitest, and a small domain layer kept separate from rendering
- static deployment for the visual client; preprocessing jobs will turn large GTFS/topography sources into compact, versioned web assets

See [ROADMAP.md](./ROADMAP.md) for delivery stages and [docs/VISION.md](./docs/VISION.md) for the product and art direction.
