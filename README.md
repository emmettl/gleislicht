# gleislicht: Switzerland in motion

A cinematic browser visualisation of Switzerland's railway network, built from open timetable data and real topography. The long-term idea is to move between a national network view and intimate, camera-led journeys through a luminous low-poly landscape.

The current motion study opens on a national morning view derived from the official Swiss GTFS timetable, with 764 scheduled rail services moving inside Switzerland at 07:45. A second follow-camera study uses a synthetic Zürich–Chur journey and procedural terrain. Both interpolation models are labelled clearly.

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

Keyboard controls: `Space` pauses or resumes; `C` switches between follow and network cameras.

The committed GTFS snapshot is regenerated with `npm run data:gtfs`; see [docs/DATA-PIPELINE.md](./docs/DATA-PIPELINE.md).

## Technical shape

- Vite + React + strict TypeScript
- Three.js through React Three Fiber
- oxlint, Vitest, and a small domain layer kept separate from rendering
- static deployment for the visual client; preprocessing jobs will turn large GTFS/topography sources into compact, versioned web assets

See [ROADMAP.md](./ROADMAP.md) for delivery stages and [docs/VISION.md](./docs/VISION.md) for the product and art direction.
