# Amsterdam — title to find

**An unnumbered Amsterdam motion study**

**Catalogue status:** feasibility investigation complete; viable as measured aggregate reconstruction, not individual bicycle tracking.

## Thesis under test

Amsterdam should make bicycles first-class moving entities and reveal a transport hierarchy fundamentally unlike a rail-led city. The local sentence is **the network is made by innumerable small movements**, with trams and metros appearing as another layer inside the bicycle field rather than its organising spine.

The source problem is identity. Public bicycle counters observe directional volume, not named riders or complete trajectories. A responsible study can reconstruct count-conserving flows over the cycling graph; it cannot replay individual bicycles that were measured moving from origin to destination.

## Feasibility verdict — 6 September 2026

| Scope | Status | Defensible interpretation |
| --- | --- | --- |
| Bicycle network geometry | **Green** | Amsterdam publishes a topologically consistent walking/cycling network with bridge, tunnel and relative-height fields through unauthenticated REST, WFS and vector-tile endpoints. |
| Bicycle motion | **Green as aggregate reconstruction / red as trajectories** | NDW publishes directional bicycle counts and an hourly aggregate Bicycle API. Counts can seed synthetic flow with explicit uncertainty; they do not identify individual routes. |
| Current public transport | **Green technically / amber on feed terms** | Dutch national public-transport data is distributed through NDOV Loket, including current GTFS. The exact operator release, retention terms and GVB coverage must be pinned before compilation. |
| Modal hierarchy claim | **Amber** | A bounded area with adequate bicycle counter coverage can compare reconstructed bicycle volume with scheduled transit. Citywide gaps must not be filled with plausible-looking traffic. |

Amsterdam passes with a narrower evidence contract than the thesis's natural visual temptation. Every bicycle should read as one particle of an aggregate model, not one observed person.

## Bicycle geometry

The City of Amsterdam's [Loopfietsnetwerk API](https://api.data.amsterdam.nl/v1/docs/datasets/loopfietsnetwerk%40v1.html) describes a public, unauthenticated, topologically consistent graph available as REST, WFS, MVT and full exports. Relevant edge fields include:

- whether an edge supports walking/cycling;
- relative height (`hoogteniveau`);
- bridge and tunnel indicators;
- street class/name; and
- curve geometry, with EPSG:28992 as the source CRS.

Some classifications and names derive from OpenStreetMap, IMGeo and Amsterdam-specific sources. The compiler must retain field-level lineage and any database attribution that follows from those inputs rather than treating “publisher: Amsterdam” as the whole provenance story.

This graph can constrain synthetic bicycles to real links and keep bridge/tunnel state explicit. It says nothing about how many riders used an edge at a particular time.

## Bicycle counts and reconstruction

[NDW Open Data](https://opendata.ndw.nu/) exposes current and historical bicycle-count access through Dexter and links the [Bicycle API documentation](https://docs.ndw.nu/data-uitwisseling/interface-beschrijvingen/fiets-api/). The API supplies measurement-site geography and hourly aggregate bicycle measurements; account/service credentials may be required for direct API use. Dexter exports provide directional intensity, interval and quality/completeness fields rather than tracks.

The opening compiler should implement a transparent flow model:

1. select a compact subgraph and all NDW counters within or immediately across its boundary;
2. retain measured interval, direction, completeness and exclusion flags;
3. create deterministic particles proportional to observed counts at each detector;
4. route particles only through plausible graph continuations while conserving boundary counts; and
5. render unobserved branches with lower confidence or not at all.

Particles must not keep persistent identities across counters. Matching two count sites does not prove that the same rider travelled between them. Model seed, routing weights and uncertainty should be visible in methodology.

## Public transport

[NDOV Loket's data directory](https://data.ndovloket.nl/) distributes national public-transport data and a current `gtfs` collection. Before using it, identify the feed producer and release that contains GVB, inspect `agency`, `routes`, `trips`, `shapes`, calendars and attribution, and retain its applicable terms.

Scheduled trams, buses and metro can share the clock with aggregate bicycle flow, but the event classes must remain separate. Public-transport vehicles are scheduled trip interpolation unless a matched realtime archive is added; bicycles are synthetic particles generated from counts. Colour and trail language should make that distinction legible without opening prose.

## Rights and privacy

The Amsterdam API marks the cycling graph as public, but “public” is not a complete redistribution licence statement. Retain the City's applicable terms and the attribution obligations of incorporated source fields. Confirm NDW's reuse terms, credential conditions and historic-export retention before shipping transformed count artifacts.

Only aggregate counter values are needed. Do not use camera footage, device identifiers, Bluetooth/Wi-Fi detections or person-level trip records. Low counts may need coarser time bands even when the source is formally open, particularly if a location and period could make a person's movement unusually identifiable.

## Evidence boundaries

| Intended claim | Evidence required | Present feasibility |
| --- | --- | --- |
| This edge is cyclable and crosses a bridge/tunnel | Amsterdam graph field and geometry | **Yes.** |
| N bicycles passed a detector in one direction | NDW measurement, interval and quality flags | **Yes after coverage/access validation.** |
| A bicycle travelled from A to B | Individual trajectory or defensible OD | **No.** Synthetic paths cannot be described as observed trips. |
| Bicycles dominate the local transport field | Comparable spatial/time scope across bicycle counts and transit | **Possible in a bounded proof**, not yet demonstrated citywide. |
| A tram occupied an exact location | Matched realtime vehicle position | **Not from static GTFS.** Scheduled interpolation only. |

## Recommended proof

Choose a **07:00–09:00 bridge-and-canal cell** only after plotting NDW counter coverage—likely a small central/eastern set of crossings rather than all Amsterdam. Render measured boundary pulses and deterministic, count-conserving bicycle flow over the Loopfietsnetwerk. Add scheduled GVB motion as a visibly different stratum. The proof fails if too few counters constrain the interior or if inferred particles dominate the image.

### Source gate

- [ ] Export current Amsterdam cycle edges and retain source/terms metadata.
- [ ] Map NDW bicycle counter coverage, directions and completeness for candidate mornings.
- [ ] Retain NDW reuse and credential terms; choose an archiveable measurement slice.
- [ ] Pin and inspect the GVB-containing GTFS release from NDOV Loket.
- [ ] Define quantitative uncertainty and suppression rules for reconstructed flow.
- [ ] Pass a visual test in which aggregate reconstruction cannot be mistaken for rider tracking.

**Exit:** Amsterdam advances when one bounded morning is constrained by enough measured counts to make bicycles genuinely primary without inventing individual journeys.
