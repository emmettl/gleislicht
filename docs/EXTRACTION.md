# Motion Studies extraction seam

The repository now contains two real public entries, not one application with a place-name flag. That is the proof needed before moving shared code into packages. No workspace or npm organisation is required yet; the code can continue to evolve here while the boundary is cheap to change.

## Intended ownership

| Future surface | Owns | Must not own |
| --- | --- | --- |
| `@motionstudies/core` | Network, timetable, spatial-layout and progressive-day contracts; interpolation; indexes; search/navigation primitives | Place names, source URLs, authored copy, page metadata |
| `@motionstudies/three` | Shared map, vehicle, label, camera, trail and selection rendering | Swiss or London catalogues and data filenames |
| `@motionstudies/web` | Theme application, browser bootstrap and reusable compact controls | A complete edition shell |
| `gleislicht` | Swiss catalogue, translations, Takt hubs, LUFT/AUTO/corridor studies, source adapters and assets | London data or titles |
| `allchange` | London catalogue, local chrome, geography/diagram compilers, future hub studies and assets | Swiss data or titles |
| `localexpress` | New York catalogue, local/express semantics, borough geography, map-layout authorship, source adapters and assets | London diagram assumptions or Swiss service categories |
| `correspondances` | Paris catalogue, centre–periphery behavior, interchange studies, French authored voice, source adapters and assets | New York stopping-pattern assumptions or operator branding in shared packages |

The package names are targets, not a commitment to publish three packages. They describe dependency direction. The first extraction may combine the small web layer with core if that produces a more useful API.

## Boundary already enforced

- `src/domain`, `src/scene`, `src/theme`, `src/components` and `src/entries` cannot import a concrete edition or edition shell.
- Production files in those shared directories cannot contain Swiss or London place identity.
- The Swiss and London entry modules cannot cross-import one another.
- Place-specific hub definitions live in the Swiss edition; the shared hub engine accepts any string identity.
- Map framing is supplied as edition-owned behaviour—home scale, close limits, local-detail policy and optional label-prefix treatment—rather than a union of hard-coded place names.
- The terrain corridor scene and Zürich–Chur/PostBus journey matching live in the Swiss study layer rather than the shared scene/domain layer.
- Alternate spatial layouts match stops by source identity and paths by stable index, so an edition can add a second geometry without forking its journeys.
- Each entry has an independent runtime request graph and transfer budget.

`npm run check:architecture` enforces the import direction in development and Pages CI.

## Mechanical extraction order

Before step one, compile a bounded New York local/express proof against the current local modules. That third implementation is the extraction test: anything genuinely shared by Switzerland, London and New York has earned a package boundary; merely anticipated reuse has not.

1. Move the domain contracts and pure tests without changing imports or behaviour.
2. Move the scene layer against those exported contracts.
3. Move browser mounting and theme-token application.
4. Replace local imports in both entry points with workspace package imports.
5. Run both complete browser matrices and compare the generated request graphs.
6. Only then create the npm organisation and split repositories, preserving Git history with subtree filtering if useful.

An extraction is complete when every implemented page renders byte-for-byte-equivalent data artifacts, preserves its independent metadata and passes the same interaction and transfer gates. Package publication is an operational consequence, not the architectural milestone. Paris should consume the extracted seam as a client, not become the experiment used to discover it.
