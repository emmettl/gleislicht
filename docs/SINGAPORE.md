# Singapore — title to find

**An unnumbered Singapore motion study**

**Catalogue status:** feasibility investigation complete; current rail proof viable, future-network layer requires separate planning semantics.

## Thesis under test

Singapore's transport is deliberate state choreography: operating lines serve the city while new lines, stations and neighbourhoods are planned into its future form. The local sentence is **a network extending ahead of the city**.

That sentence depends on time states. Existing services may move; lines under construction may glow structurally; proposals and study corridors must remain visibly conditional. Future trains must never run merely because a planning map contains a line.

## Feasibility verdict — 6 September 2026

| Scope | Status | Defensible interpretation |
| --- | --- | --- |
| Current rail schedule | **Green with registration** | LTA DataMall added GTFS Schedule (Train) in August 2026. An Account Key is required, but the API is expressly available for reuse under DataMall terms and the Singapore Open Data Licence. |
| Current rail operations | **Green / amber archive** | DataMall also publishes GTFS-Realtime trip updates and service alerts. Reproducible historic replay requires a recorder and confirmed retention; no public historical archive was established. |
| Current demand/crowding | **Green as aggregate** | Monthly station passenger volumes/OD and train crowd-density products can support station fields. Their different time resolutions and forecast/observed semantics must remain separate. |
| Future rail network | **Green structurally / red as motion** | LTA publishes current project stages, target years and planning schematics. They support dated future infrastructure states, not trips. |
| Planned city growth | **Amber** | URA planning datasets can provide land-use/development context, but version alignment, licence and the distinction between statutory plan and realised city require their own audit. |

Singapore passes the technical source-path test for current rail and has an unusually authoritative planning narrative. The first proof should be built only after DataMall account access confirms actual GTFS contents and a future-project geometry source is retained.

## LTA DataMall transport sources

The official [DataMall dynamic-data catalogue](https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html) lists:

- GTFS Schedule (Train);
- GTFS-Realtime Trip Updates and Service Alerts;
- train-station passenger volumes and origin–destination aggregates;
- realtime and forecast train crowd density;
- planned bus routes, current bus routes/stops and bus arrivals; and
- additional traffic and transport measurements.

Access uses an Account Key. The static schedule should be the canonical trip/calendar identity; realtime updates must match it by the documented trip relationship and service date. Record endpoint version, retrieval timestamp in `Asia/Singapore`, response headers/schema and checksums. If trip IDs change between static releases, do not splice recorded updates across them.

The [DataMall API Terms of Service](https://datamall.lta.gov.sg/content/datamall/en/api-terms-of-service.html) places datasets under the Singapore Open Data Licence and allows commercial and non-commercial API use subject to the service conditions and rate limit. Retain both licence and API-terms versions with each acquisition. Confirm that privately recorded realtime responses may be retained and transformed into a permanent public replay.

DataMall's [on-request datasets](https://datamall.lta.gov.sg/content/datamall/en/on-request_datasets.html) include more detailed sources such as frequent bus locations and farecard transactions under application/data-sharing conditions. They are unnecessary for the opening and must not be treated as open merely because their descriptions are public.

## Planning evidence

LTA's [Upcoming Projects](https://www.lta.gov.sg/content/ltagov/en/upcoming_projects.html) and project pages provide authoritative status and target years. The [March 2026 rail-development factsheet](https://www.lta.gov.sg/content/ltagov/en/newsroom/2026/3/news-releases/next-phase-of-rail-development.html) distinguishes lines opening in 2026, Jurong Region Line stages, Cross Island Line phases and corridors still at engineering-study stage. The [Land Transport Master Plan 2040](https://www.lta.gov.sg/content/dam/ltagov/who_we_are/our_work/land_transport_master_plan_2040/pdf/LTA%20LTMP%202040%20eReport.pdf) provides the longer planning frame.

Each planned segment needs a state enum, not a boolean:

- operating on the study date;
- testing or completed but not in passenger service;
- under construction;
- committed with announced alignment/stations;
- under feasibility/engineering study; or
- illustrative master-plan corridor.

Dates and state come from the latest retained source as of the work's planning snapshot. A schematic PDF is not surveyed geometry. Use it at diagram scale or source an official GIS alignment before geographic display.

URA/data.gov.sg master-plan layers can place future transport beside planned land use, but plan year, gazette/status and later amendments must be pinned. The renderer should never imply that planned land use is already built.

## Rights and representation

The Singapore Open Data Licence gives a comparatively clear reuse baseline, but API access, attribution and no-endorsement conditions still apply. LTA/URA maps, symbols and brand assets are separate from underlying facts and data.

Aggregate station OD can express state choreography without exposing riders. Suppress or coarsen small cells as the source requires, and distinguish entries/exits from on-train load. Crowd-density forecasts are predictions; monthly OD is historical aggregate; neither is a vehicle position.

## Evidence boundaries

| Intended claim | Evidence required | Present feasibility |
| --- | --- | --- |
| A current train is scheduled to move | Pinned DataMall GTFS trip/calendar/shape | **Likely yes; inspect after account activation.** |
| Operations differed from schedule | Matched retained GTFS-RT update or alert | **Yes live; historical replay requires recording rights.** |
| A future line is committed or under study | Dated LTA project source and explicit state | **Yes.** |
| A train moves on that future line | Open passenger service and a current timetable | **No until it operates.** |
| Transport precedes urban development | Version-matched LTA and URA planning evidence | **Promising, not yet joined.** |

## Recommended proof

Build a **current-versus-coming western corridor** after inspecting the feed: current trains move on existing lines while the Jurong Region Line and associated future stations appear as dated, inactive infrastructure states. Join only one clearly versioned planned-development layer around Tengah/Jurong if its status and rights are unambiguous. The transformation should move through planning time while the service clock continues only on operating infrastructure.

### Source gate

- [ ] Register DataMall access and inspect GTFS tables, coverage, calendars, shapes and identifiers.
- [ ] Retain Singapore Open Data Licence and API Terms versions.
- [ ] Confirm GTFS-RT recording, retention and derived-publication rights.
- [ ] Acquire official geographic geometry for the chosen future segments or keep them diagrammatic.
- [ ] Pin LTA project states and URA plan version to one planning snapshot.
- [ ] Prevent all non-operating infrastructure from accepting trip events in the compiler schema.

**Exit:** Singapore advances when one scene can show operating, under-construction and planned states without letting the visual grammar collapse them into a single present.
