# Motion Studies workspace seam

Shared code lives in four private npm workspaces: `core`, `three`, `web` and Node-only `data`. The widget lab is a separate consumer application. Switzerland, London, New York and Paris remain edition entry points in this repository while the independently installed package workflow is verified.

## Ownership

| Surface | Owns | Must not own |
| --- | --- | --- |
| `@motionstudies/core` | Transport, timetable, spatial-layout and progressive-day contracts; interpolation; indexes; search/navigation primitives | React, browser/Node APIs, place names, source URLs, copy or page metadata |
| `@motionstudies/three` | Reusable maps, vehicles, labels, cameras, trails, hub scenes and selection rendering | Edition catalogues, data filenames or fetching |
| `@motionstudies/web` | Theme application, mounting, reusable controls, scoped shell styles and browser data lifecycle | Complete edition shells, edition layouts, deployment asset roots or fonts |
| `@motionstudies/data` | GTFS/archive primitives, network chunking/merging and station ranking | Source-specific routes, publication decisions, authored provenance or browser runtime dependencies |
| `lab` | Synthetic package specimens and their consumer browser tests | Edition applications, styles, datasets or source aliases |
| Editions | Local catalogue, applications, studies, translations, themes, source adapters, compilation commands, assets and deployment | Another edition's application or stylesheet |

`three` and `web` depend on `core`; they do not depend on one another. Node tooling uses core type contracts without entering browser dependency graphs. Generic GTFS helpers no longer come from the Swiss ingestion command. The London composite-timetable wrapper supplies its own provenance to the shared merge function.

## Enforced boundaries

`npm run check:architecture` parses package imports and follows the runtime edition import graph, including stylesheet ownership. It rejects relative package escapes, undeclared/reverse dependencies, unsupported export paths and app build globals. `npm run check:packages` independently checks the three TypeScript runtime packages without app ambient types. Both run in Pages CI.

Public subpaths are explicit and extensionless. For example, editions import `@motionstudies/core/domain/network`, `@motionstudies/three/NationalNetworkScene` and `@motionstudies/web/components/MobilePicker`. Private renderer helpers and the internal chunk lifecycle are not public exports.

`web/shell.css` is opt-in and scoped to `.motion-study`; `mountMotionStudy` applies that class. Each edition owns its font imports and layout stylesheet. Standalone widgets need only `tokens.css` and their component CSS.

## Packed consumer

`npm run build:packages` emits compiled ESM, declarations and CSS plus distribution manifests into `.package-dist/`. Workspace manifests keep source imports for cheap local iteration. Both manifests use the same export keys.

`npm run check:packed` packs all four distributions, installs them into a temporary consumer outside the repository, verifies public and hidden imports, typechecks Node-tooling declarations and the lab, builds the lab, and runs its Chromium/WebKit specimens. There are no workspace links or source aliases in that consumer. Pages CI runs this before the edition browser matrix.

See [the readiness review](./PACKAGE-READINESS.md) for the evidence, lab coverage and remaining operational steps. Packages are still private release candidates, not published registry dependencies.

## Repository split

1. Move the shared packages, lab and package build/verification scripts to the Motion Studies repository while preserving history.
2. Deliberately configure release versions, licensing and registry publication. Publish the compiled distribution output rather than source-workspace directories.
3. Move All Change first, consuming exact prerelease versions and retaining its local data pipeline, styles, assets, workers and regression/payload gates.
4. Validate its independent Pages build, then migrate the remaining editions.
