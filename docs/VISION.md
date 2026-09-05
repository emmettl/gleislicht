# Vision

## The idea

**Gleislicht: Switzerland in motion** makes the Swiss railway system feel alive rather than diagrammatic. It is a data visualisation, but its emotional register is a late-night window seat: dark valleys, bright infrastructure, distant signals and trains leaving traces through the landscape.

The experience should work at four scales:

1. **The network breathes.** A national view reveals the timetable as a living system—departures gathering around cities, intercity pulses crossing the plateau, and thinner regional threads reaching into valleys.
2. **A single journey becomes cinema.** Choose a train and the camera descends to follow a luminous, lightly abstracted vehicle through real terrain. The landscape is recognisably Swiss but deliberately low-poly and atmospheric rather than photoreal.
3. **Regional networks reveal exchange.** ZVV, TPG and later regional studies show rail, tram, bus, boat and funicular services feeding one another without crowding the national view.
4. **Cities become electric.** A full-detail city study embraces the hectic texture of Zürich trams and buses, while a synchronized rural study makes the spacious pulse of PostBus services equally tangible.
5. **The sky remains a visitor.** The optional LUFTRAUM study places sparse observed aircraft above the railway without granting them a permanent network or equal visual weight.

## Product principles

- **Motion before controls.** Opening the project should immediately show the system moving. Explanatory UI stays quiet until it is useful.
- **Truthful abstraction.** Position, time, route and terrain come from real data; light, scale, colour and camera motion are interpretive.
- **Legible provenance.** Planned, estimated and genuinely observed information must never be visually conflated. Synthetic or missing data is labelled.
- **From atlas to window seat.** Transitions between network, corridor and train views are continuous enough to preserve a sense of place.
- **A visual instrument.** Time, camera and layers can be played. The interface should feel closer to a synthesiser display than a transport planner.
- **A score, not background music.** Each scale has its own composed electronic cue; transitions between map, hub and journey are musical continuations of the same world. Sound remains opt-in.
- **Runs beautifully on an ordinary laptop.** Progressive detail, compact preprocessed data and measured GPU budgets matter more than maximal fidelity.
- **Load only the chosen scale.** National, regional, city and corridor artifacts remain separate so local detail never bloats the opening national study.
- **Swiss by default.** The complete interface speaks English, German, French and Italian, follows the visitor's language when possible, and keeps station and service names authentic.

## Visual thesis

_Night geography drawn by infrastructure._

The base world is deep indigo-black. Terrain is a sparse violet wire mesh with just enough filled surface to hold fog and depth. Rail lines sit above it as cool cyan filaments. Active vehicles carry a warmer magenta core, becoming bright punctuation rather than map pins. Typography is restrained, technical and monospaced where it reports state; the title remains human and quiet.

The reference screenshot suggests the core spectacle: hundreds of journeys reveal the national network simply by moving. Gleislicht adds a more authored camera language and swaps satellite-map realism for low-poly topographic atmosphere.

## First audience

People fascinated by trains, Switzerland, maps, motion graphics or generative art. The first release is exploratory rather than a journey-planning tool: it should reward watching, scrubbing time and following a service.

## Data stance

Swiss GTFS Static is the source of scheduled services, stops, trips and shapes. GTFS Realtime enriches those schedules with trip updates and service alerts, but the official national feed currently does **not** publish vehicle positions. Consequently, most on-track positions will be an honest interpolation between timed stops and shapes, adjusted by realtime trip updates where available—not a claim of GPS tracking.

Terrain should be derived from swisstopo's swissALTIRegio or swissALTI3D elevation models and shipped as simplified corridor artifacts with the required attribution. Full source rasters should be processed offline, never downloaded or parsed in the browser.

## What this is not—yet

- A passenger information or route-planning product
- A safety-critical realtime display
- A photoreal train simulator
- A generic 3D globe with train markers

## Success signals for the first public study

- The national view is recognisably Switzerland from motion alone.
- A viewer can select a service and reach a follow-camera view in one action.
- A typical laptop holds a smooth frame rate with the representative service count.
- Data age, source and interpolation status are understandable without breaking the atmosphere.
- A one-minute screen recording is interesting even with no narration.
