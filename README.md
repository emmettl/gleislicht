# gleislicht: Switzerland in motion

A cinematic browser visualisation of Switzerland's railway network, built from open timetable data and real topography. The long-term idea is to move between a national network view and intimate, camera-led journeys through a luminous low-poly landscape.

The first slice is intentionally an art-direction and motion prototype. It uses a synthetic Zürich–Chur journey and procedural terrain while the data pipeline is still being designed; the interface labels that clearly.

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

## Technical shape

- Vite + React + strict TypeScript
- Three.js through React Three Fiber
- oxlint, Vitest, and a small domain layer kept separate from rendering
- static deployment for the visual client; preprocessing jobs will turn large GTFS/topography sources into compact, versioned web assets

See [ROADMAP.md](./ROADMAP.md) for delivery stages and [docs/VISION.md](./docs/VISION.md) for the product and art direction.

