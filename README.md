# gleislicht: Switzerland in motion

A cinematic browser visualisation of Switzerland's railway network, built from open timetable data and real topography. The long-term idea is to move between a national network view and intimate, camera-led journeys through a luminous low-poly landscape.

The current motion study opens on a national morning view derived from the official Swiss GTFS timetable, with 764 scheduled rail services moving inside Switzerland at 07:45. A hub-scale Takt pulse makes scheduled calls at Zürich HB, Bern, Basel SBB and Genève contract toward the station and radiate out again. A third follow-camera study uses a synthetic Zürich–Chur journey and procedural terrain. All interpolation models are labelled clearly.

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

Search the national view by station, service, train number, origin, or destination. Selecting a train isolates its scheduled path and carries the camera down to follow it. Selecting a station centres the map, marks the station, and illuminates the complete scheduled paths of every service calling there in the morning study. Train lights are colour-coded by service class from international and InterCity through S-Bahn and regional services.

Click a service category in the colour legend to highlight that fleet and dim the other trains; click the active category again to clear the filter. The same focus carries into the Takt hub view.

The national map supports mouse-wheel or pinch zoom, pointer or touch drag to pan, and on-screen zoom/reset controls. Station names reveal progressively as the camera approaches, prioritising busy interchanges and suppressing overlapping labels. During a selected-train follow, its own calling points take priority. The follow camera temporarily takes control; releasing it returns to the previous map position.

The **trains · auto/on/off** map control manages moving train labels. Auto begins with long-distance services, reveals more categories with zoom, and follows active station or service-category filters. On raises the density while retaining collision suppression; Off keeps the moving lights unlabelled.

Open **Takt hubs** to move between Zürich HB, Bern, Basel SBB and Genève across a continuous 24-hour schedule. Four tempo settings run from 1× to 64×, turning the clock-face timetable into a slow study or a rapid daily pulse. See [docs/HUB-STUDY.md](./docs/HUB-STUDY.md) for the visual model and the deliberately careful wording around Zürich's “busiest” status.

Sound is optional and off by default. Turning on the adaptive score lazily loads the Driftbox synthesis engine and plays one of three Gleislicht arrangements: **Night Grid** for the national map, **Taktwerk** for station pulses, and **Valley Signal** for corridor or train-follow views. Mode changes crossfade between two live transports. See [docs/SOUNDTRACK.md](./docs/SOUNDTRACK.md) for the musical and technical design.

The committed GTFS snapshot is regenerated with `npm run data:gtfs`; see [docs/DATA-PIPELINE.md](./docs/DATA-PIPELINE.md).
The eventual public deployment is GitHub Pages; see [docs/PUBLISHING.md](./docs/PUBLISHING.md).

## Technical shape

- Vite + React + strict TypeScript
- Three.js through React Three Fiber
- Driftbox's Web Audio engine for a fully synthesised, adaptive soundtrack
- oxlint, Vitest, and a small domain layer kept separate from rendering
- static deployment for the visual client; preprocessing jobs will turn large GTFS/topography sources into compact, versioned web assets

See [ROADMAP.md](./ROADMAP.md) for delivery stages and [docs/VISION.md](./docs/VISION.md) for the product and art direction.
