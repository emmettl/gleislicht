# Motion Studies workspace seam

The shared runtime now lives in three private npm workspaces inside this repository. Switzerland, London, New York and Paris remain independent entry points and edition shells; package publication and repository splitting are deliberately separate operational steps. This lets the API continue to evolve cheaply while every edition exercises the same real package boundary.

## Intended ownership

| Surface | Owns | Must not own |
| --- | --- | --- |
| `@motionstudies/core` | Network, timetable, spatial-layout and progressive-day contracts; interpolation; indexes; search/navigation primitives | Place names, source URLs, authored copy, page metadata |
| `@motionstudies/three` | Shared map, vehicle, label, camera, trail and selection rendering | Swiss or London catalogues and data filenames |
| `@motionstudies/web` | Theme application, browser bootstrap and reusable compact controls | A complete edition shell |
| `gleislicht` | Swiss catalogue, translations, Takt hubs, LUFT/AUTO/corridor studies, source adapters and assets | London data or titles |
| `allchange` | London catalogue, local chrome, geography/diagram compilers, future hub studies and assets | Swiss data or titles |
| `localexpress` | New York catalogue, local/express semantics, borough geography, map-layout authorship, source adapters and assets | London diagram assumptions or Swiss service categories |
| `correspondances` | Paris catalogue, centre–periphery behavior, interchange studies, French authored voice, source adapters and assets | New York stopping-pattern assumptions or operator branding in shared packages |

The package names describe actual local workspace dependencies, not a commitment to publish them yet. All three packages remain `private` at version `0.0.0` until their public API and independent repository workflow are intentionally designed.

## Boundary already enforced

- `packages/core`, `packages/three` and `packages/web` cannot import a concrete edition or edition shell.
- Production files in those workspaces cannot contain place identity.
- The Swiss and London entry modules cannot cross-import one another.
- Place-specific hub definitions live in the Swiss edition; the shared hub engine accepts any string identity.
- Map framing is supplied as edition-owned behaviour—home scale, close limits, local-detail policy and optional label-prefix treatment—rather than a union of hard-coded place names.
- The terrain corridor scene and Zürich–Chur/PostBus journey matching live in the Swiss study layer rather than the shared scene/domain layer.
- Alternate spatial layouts match stops by source identity and paths by stable index, so an edition can add a second geometry without forking its journeys.
- Each entry has an independent runtime request graph and transfer budget.

`npm run check:architecture` enforces the import direction in development and Pages CI.

## Implemented dependency direction

- `@motionstudies/core` contains transport, timetable, spatial-layout, search and edition contracts with no React or Three.js dependency.
- `@motionstudies/three` depends on `core` and owns the reusable React Three Fiber scene, camera and labelling code.
- `@motionstudies/web` depends on `core` and owns React/browser bootstrap, progressive loaders, recording, compact controls and the shared CSS tokens.
- Root `src/` owns edition catalogues, applications, authored themes and copy, data adapters and Gleislicht-specific audio/corridor work.
- Root entry points consume the workspaces through `@motionstudies/*` imports; no compatibility barrels hide a dependency back into `src/`.

`npm run check:architecture` rejects place-specific identity or edition-shell imports in the workspaces and rejects a return of the old shared `src/` directories. Typecheck, unit tests, all edition payload checks and the browser matrix exercise source exports exactly as a future package consumer would.

## Later operational split

1. Stabilise the source-level workspace exports into an intentional public API.
2. Decide whether packages ship TypeScript source or compiled ESM and declarations.
3. Move the shared workspaces to the reserved Motion Studies repository while preserving history.
4. Publish prerelease packages under `@motionstudies`, then point each edition repository at exact versions.
5. Keep data compilers and authored edition assets in their edition repositories.

The local extraction is complete when every implemented page renders the same data artifacts, preserves independent metadata and passes the interaction and transfer gates. Package publication is an operational consequence, not the architectural milestone.
