# Mexico City — title to find

**An unnumbered Mexico City motion study**

**Catalogue status:** feasibility investigation complete; historical formal-network proof viable, current/informal thesis not yet sourced.

## Thesis under test

Mexico City combines immense scale and altitude with dense formal transit and movement that is less legible in standard datasets. The local sentence is **a mapped system surrounded and crossed by mobility the map does not fully know**.

That absence must appear as a limit of evidence, not as empty streets or lesser importance. The formal network alone can make a strong historical study, but it does not yet prove the interaction at the centre of the thesis.

## Feasibility verdict — 6 September 2026

| Scope | Status | Defensible interpretation |
| --- | --- | --- |
| 31 October 2022 formal network | **Green** | SEMOVI publishes an eight-table GTFS with Metro, Metrobus, trolleybus, RTP, light rail, Cablebus, suburban rail, Pumabus and concession corridors under CC BY 4.0. It includes frequencies and shapes. |
| Current formal network | **Red / amber by operator** | The catalogue calls the 31 October 2022 feed its latest version. Dataset metadata changed later, but that does not make service content current. Operator-by-operator current sources may exist, but no current unified feed was established. |
| Informal or weakly documented movement | **Red** | No authoritative, comprehensive, archiveable source for individual pesero/colectivo trajectories or time-banded flow was found. Some concession corridors in GTFS must not be mistaken for complete informal coverage. |
| Altitude and terrain | **Green** | INEGI publishes national and local digital elevation products, including five-metre terrain coverage for Mexico City. |
| Passenger scale/interaction | **Amber / red** | Aggregate operator demand may be obtainable, but a unified time-and-space-aligned OD/load source was not verified. Timetable frequency is not rider volume. |

Mexico City can produce a rights-clean, explicitly historical study of the formal network. The proposed formal/informal interaction remains blocked and should not be implied by atmospheric particles or unlabelled background motion.

## Inspected catalogue contract

The SEMOVI [static GTFS dataset](https://datos.cdmx.gob.mx/dataset/75538d96-3ade-4bc5-ae7d-d85595e4522d) states that its latest service version is **31 October 2022**. It identifies eight tables:

- `agency.txt`, `routes.txt`, `trips.txt` and `calendar.txt`;
- `frequencies.txt` for average arrival intervals and service spans;
- `shapes.txt` for route traces;
- `stops.txt`; and
- `stop_times.txt` for estimated inter-stop timing.

The listed modes are concession corridors, Metro, Metrobus, trolleybus, RTP, light rail, suburban rail, Cablebus and Pumabus. The package is licensed [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

The portal resource metadata was updated in December 2024, but the descriptive text still names the 2022 service version. The compiler must use the service-content date, not the catalogue edit date, and display the work as historical. Its `frequencies.txt` semantics require deterministic generated departures labelled as headway reconstruction; apparent stop times in a frequency template are not automatically exact vehicle departures.

Before use, download the ZIP outside the portal timeout path, hash every table, inspect calendars and quantify coverage by agency. The portal warns that historical information may be changed retroactively, so the exact acquired artifact must be retained.

## Current and less-formal movement

A current edition would require a replacement or verified operator-specific sources with compatible dates and identities. Metro, Metrobus, Cablebus and other operators may publish maps, timetables and statistics, but stitching current pages into a unified schedule needs a separate source audit and a stable archive for each service.

The study must be precise about “informal.” Concessioned services may be legally formal while remaining difficult to map; other colectivos may have permits or regulated corridors without open digital schedules. The project should document operator/governance categories supplied by local sources instead of imposing a binary formal/informal label.

No synthetic traffic layer should fill the gap. A route inferred from street observations, crowdsourced maps or a trip planner can be used as a research lead, not portrayed as a complete authoritative system. Partnership with SEMOVI, local transport researchers and operator organisations is the appropriate next step.

## Terrain and scale

INEGI's [Digital Elevation Models programme](https://www.inegi.org.mx/programas/mde/) publishes terrain/surface models at several resolutions. The [five-metre Mexico City terrain product](https://www.inegi.org.mx/app/biblioteca/ficha.html?upc=889463793601) is a strong source for a metropolitan crop, with its edition, UTM reference, horizontal/vertical datum and accuracy metadata retained.

Terrain can establish basin and altitude; it cannot explain service inequality on its own. Boundaries, population and built context should come from version-matched INEGI/City sources. Avoid turning altitude into visual exaggeration so extreme that route gradients become false.

## Rights and representation

The historical GTFS has a clear CC BY 4.0 publication path. INEGI resources carry their own use and citation conditions, which must be retained with each product. Operator pages, maps, logos and route-brand artwork are not absorbed into the GTFS licence.

The missing-data language is part of the work:

- mapped does not mean complete;
- absent from the source does not mean absent from the city;
- a frequency is a service model, not a measured crowd; and
- administrative transport status is not a judgement about legitimacy or value.

## Evidence boundaries

| Intended claim | Evidence required | Present feasibility |
| --- | --- | --- |
| Formal services operated as drawn in 2022 | Pinned GTFS, calendars, frequency rules and shapes | **Yes after archive validation.** |
| The same system operates now | Current authoritative releases for every included operator | **No.** |
| A corridor carries a measured number of people | Time-banded count/load/OD data | **Not established.** |
| Less formally mapped movement follows a path | Locally authoritative route evidence with date/status | **Blocked at comprehensive scale.** |
| Altitude shapes the metropolitan field | INEGI terrain plus carefully framed network relation | **Yes for geography, interpretive for causality.** |

## Recommended proof

If a historical work is acceptable, compile a **31 October 2022 two-hour formal-network section** that contrasts Metro/Metrobus with Cablebus over INEGI terrain and marks uncovered mobility as **unknown to this source**, not zero. Do not title or admit it as the final Mexico City work. In parallel, seek a present-day corridor partnership capable of describing concessioned/colectivo routes and privacy-safe counts.

### Source gate

- [ ] Acquire the official GTFS ZIP reliably and record hashes/table counts.
- [ ] Validate frequency, calendar and agency coverage for one explicit 2022 service day.
- [ ] Retain CC BY attribution and INEGI use metadata.
- [ ] Audit current operator sources without mixing release dates silently.
- [ ] Define locally reviewed terminology for formal, concessioned and informal movement.
- [ ] Obtain an authoritative bounded source for currently under-mapped services before claiming interaction.

**Exit:** Mexico City advances as a final thesis only when the visible formal network and the acknowledged, locally understood limits around it can coexist without fabricated movement.
