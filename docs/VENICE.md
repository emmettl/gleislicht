# Venice — title to find

**An unnumbered Venice motion study**

**Catalogue status:** feasibility investigation complete; strongest immediately buildable second-wave candidate.

## Thesis under test

Venice is a city whose streets move. Vaporetti turn canals and lagoon channels into public-transport corridors; islands become neighbourhoods and landing stages become stations. The local sentence is **water as the network itself**, not scenery behind a generic transit map.

A first composition should follow the Grand Canal and its branching lagoon services closely enough that movement reveals the city's form before buildings do. It does not need rail, buses or tourist craft to explain itself.

## Feasibility verdict — 6 September 2026

| Scope | Status | Defensible interpretation |
| --- | --- | --- |
| Scheduled vaporetto motion | **Green** | ACTV publishes a current, downloadable navigation GTFS with exact trips, stop times and shapes. The feed inspected on 6 September 2026 covers a two-week service window and can be pinned reproducibly. |
| Historical replay | **Green / amber retention** | ACTV's official directory exposes many dated navigation ZIPs across 2025–2026. That is an unusually useful implicit archive, but continued availability is not guaranteed; chosen releases must be retained with terms and hashes. |
| Observed vessel tracks | **Red / unnecessary for opening** | No official GTFS-Realtime vehicle-position archive was established. Interpolated timetable motion is scheduled, not GPS observation. |
| Lagoon, islands and water context | **Green technically** | Regional and municipal geodata can supply water/land geometry. Navigable channels, tidal state and bathymetry are separate claims and should not be inferred from a route shape. |

Venice passes the technical admission test and has a bounded opening with a modest data model. Publication is green in principle, subject to retaining the precise ACTV/AVM licence and attribution that govern the downloaded release.

## Inspected ACTV navigation feed

The [AVM open-data catalogue](https://avm.avmspa.it/it/content/catalogo-dei-dati-metadati-e-banche-dati) identifies ACTV navigation and bus service in GTFS. The [official navigation directory](https://actv.avmspa.it/sites/default/files/attachments/opendata/navigazione/) exposes both named current archives and dated prior versions.

The current `actv__nav.zip` inspected for this audit was generated on 31 August 2026 and retrieved on 6 September 2026:

- URL: `https://actv.avmspa.it/sites/default/files/attachments/opendata/navigazione/actv__nav.zip`;
- SHA-256: `c738974b4331d2b3ccc45d9aee7d9da2330780e768f2ec45e31221116334f934`;
- eight GTFS tables: agency, calendar, calendar dates, routes, shapes, stops, stop times and trips;
- 268 route records, 156 stops, 20,476 trips, 209,868 stop-time rows and 50,722 shape points; and
- base calendars from 30 August through 13 September 2026, plus exceptions.

All inspected routes use GTFS `route_type=4` for ferry. Route IDs represent path/service variants rather than one stable public line identity: many records share the same short line number and different endpoints or stopping patterns. The compiler must group public identity separately while preserving exact route, trip and shape IDs internally.

The feed has no `feed_info.txt`, `attributions.txt`, `pathways.txt`, `levels.txt` or realtime tables. Acquisition metadata therefore belongs in the Motion Studies manifest rather than being expected from the ZIP.

## Motion semantics

Scheduled departures can be interpolated along the trip's referenced shape after validating cumulative shape distance against stop order. This produces a faithful **scheduled service trajectory**, not a measured vessel track. Dwell, early/late running, diversions, tide, traffic and docking approach will not be observed.

The renderer should:

- use landing-stage identity, not name equality alone, to join stops;
- keep each platform/pontoon record distinct where the feed distinguishes it;
- animate only services active under `Europe/Rome` calendar rules;
- state the pinned timetable date on the work; and
- draw route shapes as published service geometry without adding GPS-like wakes or accuracy claims.

## Rights and publication

ACTV's [timetable information page](https://actv.avmspa.it/en/content/app-ricerca-orari) explicitly identifies the published timetable as OpenData. The City of Venice's [open-data regulation](https://actv.avmspa.it/sites/default/files/Regolamento%20COdiVE_open_data.pdf) establishes reuse and attribution principles, while the Veneto open-data portal documents dataset-specific licensing and an [IODL 2.0 default](https://dati.veneto.it/content/note-legali).

Before shipping, retain the exact ACTV/AVM terms linked or packaged with the navigation feed and confirm the required credit line for a transformed browser artifact. Do not assume that the City regulation automatically resolves rights in operator logos, route-map artwork, timetables as designed documents or vessel imagery. The study needs none of those assets.

## Lagoon and terrain context

Use an official Regione Veneto or Comune di Venezia land/water dataset cropped to the lagoon, with source CRS, capture date and licence in the manifest. The surface can be graphically flat: this work is about topology and moving streets, not exaggerated terrain.

Bathymetry, marked channels and tidal height should remain absent unless their own authoritative datasets are acquired. A GTFS shape shows where the service is represented, not where every vessel is legally or physically constrained to navigate. Acqua alta would be a separate temporal study requiring measured tide-gauge data matched to the chosen day.

## Evidence boundaries

| Visual claim | Evidence required | Present feasibility |
| --- | --- | --- |
| A vaporetto is scheduled between two stops | Active ACTV trip, stop times and calendar | **Yes.** |
| It follows the displayed service path | Trip `shape_id`, validated stop projection and direction | **Yes as published geometry.** |
| It occupied an exact position at a moment | Observed, timestamped vehicle location | **No.** Animation is scheduled interpolation. |
| The lagoon functions like a metro diagram | Repeated scheduled services and authored layout transform | **Yes**, as an interpretive visual argument. |
| Water level or channel depth affected a trip | Tide/bathymetry and operational evidence | **Not in the GTFS.** |

## Recommended proof

Compile a weekday **06:00–08:00 Grand Canal and inner-lagoon study** from the inspected feed. Start with lines serving Piazzale Roma, Ferrovia, Rialto, San Marco and Lido, preserving all actual stopping patterns but loading only shapes used in the two-hour window. Let the physical water network continuously flatten into a locally authored lagoon diagram without changing trip progress.

### Source gate

- [x] Verify current official GTFS tables, counts, calendar span and checksum.
- [ ] Retain the governing ACTV/AVM terms and agree the credit line.
- [ ] Validate every proof-trip stop against its shape and reject large projection errors.
- [ ] Acquire and licence a simplified official lagoon land/water crop.
- [ ] Set first-view transfer and frame-time budgets on a representative phone.
- [ ] Decide the title with local linguistic review.

**Exit:** a source-pinned morning makes Venice legible as a moving water network without implying live vessel observation or navigational precision.
