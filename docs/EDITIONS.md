# Motion Studies

Motion Studies is a catalogue of authored transport works made with one visual instrument. Gleislicht is the Swiss work in that catalogue, not the public name of the engine and not a title future places inherit.

| No. | Work | Place | Status |
| --- | --- | --- | --- |
| 005 | **Gleislicht** | Switzerland | Released |
| 006 | **All Change** | London | Planned |

Each work receives a locally meaningful title and descriptor. The shared series identity appears as a quiet catalogue mark; the work title remains dominant.

## Architecture

The codebase is divided into four layers:

1. **Engine** — timetable models, interpolation, search, playback, selection and recording.
2. **Visual language** — the luminous palette, service-category colours, typography and reusable interface tokens.
3. **Edition** — series number, local title, place identity, timezone, initial clock and the complete catalogue of lazy data assets.
4. **Adapters** — offline source-specific ingestion that compiles large public datasets into the compact browser contracts consumed by the engine.

`src/editions/edition.ts` is the boundary between reusable runtime code and an authored place. `src/editions/switzerland.ts` is the first concrete catalogue. `src/theme/visual-language.ts` and `src/styles/tokens.css` hold the visual grammar independently of Swiss transport data.

An edition must provide:

- a stable ID plus a Motion Studies identity: unique catalogue number, local title, place name and descriptor;
- a timezone and initial clock;
- a national or city-scale opening network plus optional progressive day manifest;
- boundary and water geometry appropriate to its scale;
- zero or more regional, contrast, hub, air, road and terrain-corridor studies;
- explicit source metadata inside every compiled artifact; and
- a visual theme that preserves the Motion Studies family resemblance without erasing local character.

The engine deliberately does not fetch GTFS, proprietary APIs or GIS services at runtime. Each adapter resolves licensing, identifiers, geometry and service-day semantics offline, then emits the existing edition-neutral snapshot contracts.

## Creating an edition

1. Add a typed catalogue in `src/editions/`.
2. Compile one coherent two-hour opening study and the matching geographic context.
3. Render it through `App` from a dedicated entry point.
4. Add progressive 24-hour chunks only after the opening payload remains within budget.
5. Add local modes and authored studies where they reveal something distinctive about the place.

This is configuration-driven reuse, not a generic map skin. Every work should have a reason to exist, a name rooted in its place, and at least one visual study that could only belong there.
