# Motion Studies

Motion Studies is a catalogue of authored transport works made with one visual instrument. Gleislicht is the Swiss work in that catalogue, not the public name of the engine and not a title future places inherit.

| No. | Work | Place | Status |
| --- | --- | --- | --- |
| 005 | **Gleislicht** | Switzerland | Released |
| 006 | **All Change** | London | Authored foundation |
| 007 | **Local / Express** | New York | Interactive foundation; publication gated |
| 008 | **Correspondances** | Paris | Interactive foundation |

Each work receives a locally meaningful title and descriptor. The shared series identity appears as a quiet catalogue mark; the work title remains dominant.

## Architecture

The codebase is divided into four layers:

1. **Engine** — timetable models, interpolation, search, playback, selection and recording.
2. **Visual language** — the luminous palette, service-category colours, typography and reusable interface tokens.
3. **Edition** — series number, local title, place identity, timezone, initial clock and the complete catalogue of lazy data assets.
4. **Adapters** — offline source-specific ingestion that compiles large public datasets into the compact browser contracts consumed by the engine.

`src/editions/edition.ts` is the boundary between reusable runtime code and an authored place. `src/editions/switzerland.ts` and `src/editions/london.ts` are concrete catalogues. `src/entries/mount-motion-study.tsx` provides the shared browser bootstrap, while `src/main.tsx` and `src/london-main.tsx` keep each public page and request graph explicit. `src/theme/visual-language.ts` and `src/styles/tokens.css` hold the visual grammar independently of Swiss transport data.

An edition must provide:

- a stable ID plus a Motion Studies identity: unique catalogue number, local title, place name and descriptor;
- a timezone and initial clock;
- a national or city-scale opening network plus optional progressive day manifest;
- boundary and water geometry appropriate to its scale;
- optional alternate coordinate layouts that preserve stable stop, route and selection identity while changing the work's spatial logic;
- zero or more regional, contrast, hub, air, road and terrain-corridor studies;
- explicit source metadata inside every compiled artifact; and
- a visual theme that preserves the Motion Studies family resemblance without erasing local character.

The engine deliberately does not fetch GTFS, proprietary APIs or GIS services at runtime. Each adapter resolves licensing, identifiers, geometry and service-day semantics offline, then emits the existing edition-neutral snapshot contracts.

Alternate layouts are edition data, not alternate networks. `src/domain/spatial-layout.ts` defines their stable identity contract and `src/scene/spatial-layout.ts` projects and blends them through the shared renderer. Playback owns one canonical service progress and samples each layout independently before blending positions. This lets an authored work move between geographic and topological space without duplicating journeys or losing time, search, selection and follow-camera state. Layout artifacts stay lazy and optional so editions without a meaningful second spatial language pay no transfer or runtime cost.

## Creating an edition

1. Add a typed catalogue in `src/editions/`.
2. Compile one coherent two-hour opening study and the matching geographic context.
3. Give it a dedicated HTML and TypeScript entry; reuse the engine and renderer while keeping edition-specific chrome in its own study shell.
4. Add progressive 24-hour chunks only after the opening payload remains within budget.
5. Add local modes and authored studies where they reveal something distinctive about the place.

This is configuration-driven reuse, not a generic map skin. Every work should have a reason to exist, a name rooted in its place, and at least one visual study that could only belong there.

The catalogue programme and admission criteria live in [CATALOGUE.md](./CATALOGUE.md). The next edition briefs are [NEW-YORK.md](./NEW-YORK.md) and [PARIS.md](./PARIS.md). Their numbers and theses are committed; both now have bounded, source-pinned interactive foundations, with New York publication gated pending MTA clarification and Paris carrying its Licence Mobilité provenance in the artifact.

The concrete repository/package split is recorded in [the extraction seam](./EXTRACTION.md). Its import direction is enforced in CI before any npm organisation or additional repository is created.
