# San Francisco — title to find

**An unnumbered San Francisco motion study**

**Catalogue status:** second-wave source investigation; title and signature study not yet admitted.

## Thesis under test

San Francisco is not a flat network laid over a picturesque city. Movement negotiates a three-dimensional obstacle: cable cars grip a moving cable to climb the northern hills, streetcars hold the waterfront and Market Street, Muni Metro alternates between street and subway, BART forms a deeper regional spine, and ferries leave the street grid altogether. Terrain and water do not decorate the transport system; they decide what kind of transport can exist.

The strongest opening image is a compact vertical slice from the Bay and Ferry Building through Market Street to Nob Hill and Russian Hill. It can place ferries on open water, BART beneath Market, Muni on and below the street, and all three cable-car lines climbing a measured relief surface without pretending that each mode shares the same kind of position evidence.

This is a promising local sentence, not yet a finished work. **Grip**, **The Slot** and **Outbound** are useful vocabulary to research, but none is assigned as the title. The source audit should precede the name rather than make a cable-car metaphor carry a study that may prove to be about vertical interchange more broadly.

## Feasibility verdict — 6 September 2026

San Francisco is technically one of the strongest second-wave candidates. It has a maintained regional GTFS system, monthly historical schedules, a stop-level observation archive, official terrain and shoreline data, and a physically bounded opening composition. Permanent publication is still amber because the relevant transport licences are contractual and partly overlapping.

| Scope | Status | What is defensible now |
| --- | --- | --- |
| Scheduled Muni and cable-car proof | **Green technically / amber for publication** | SFMTA publishes current static GTFS directly, and Muni is included in 511's current and historical regional GTFS. Official route pages confirm three cable-car services and expose detailed schedules and stop identities. The direct SFMTA licence permits use, reproduction and redistribution but is revocable, prohibits sublicensing and contains language reserving alteration of the data to SFMTA while also prescribing a notice for derivative versions. Clarify the compiled-browser-artifact path before release. |
| BART spine | **Green / amber** | BART publishes static GTFS, GTFS-RT trip updates and alerts without registration, plus station, entrance and rail-line KML. Its short developer agreement permits use, reproduction and redistribution but remains limited and revocable. BART explicitly withholds realtime for the Oakland Airport Connector and documents a static/realtime trip-ID mismatch on the Antioch extension. |
| Multi-operator Bay study | **Green technically / amber for publication** | 511 combines 30-plus operators into active and monthly historical regional feeds, including BART, Muni, Caltrain, Golden Gate Ferry and San Francisco Bay Ferry. The 2026 agreement expressly allows storage, distribution and derivative works, but requires source acknowledgement, reasonable currency for public products, launch documentation and written acceptance by sublicensees. A compact browser artifact and pinned historical artwork need written treatment. |
| Historical observed study | **Green at stops / amber between stops** | Monthly regional feeds are available from January 2020; optional `stop_observations.txt` archives begin in March 2022 and record observed arrival times. Those can drive an honest event-level replay. They are not archived GPS tracks, so motion between calls remains an interpolation unless a separately retained vehicle-position source proves otherwise. |
| Terrain and city context | **Green** | DataSF publishes five-foot elevation contours, shoreline/islands and simplified Muni route geometry under the Open Data Commons Public Domain Dedication and License. The terrain is unusually usable for a local proof, although the contour release is historical and its San Francisco elevation datum must be transformed and documented correctly. |

The source path therefore passes the **technical feasibility** test and is better archived than Tokyo's current cross-operator path. It does not yet pass the **public artifact licence** test. No 511 token or live endpoint should enter the browser, and no current operator map, logo, route badge or livery artwork is required for the visual thesis.

## Authoritative transport sources

### 511 SF Bay regional feeds

The [511 SF Bay Open Transit Data portal](https://511.org/open-data/transit) is the best common clock. A free API token is required and the default rate limit is 60 requests per hour. The token belongs only in the offline acquisition step and must never be committed, embedded in a generated artifact or called from the public client.

The portal supplies:

- individual-operator and consolidated regional static GTFS, with additional GTFS+ tables;
- consolidated and per-agency GTFS-RT Trip Updates, Vehicle Positions and Service Alerts endpoints;
- SIRI/NeTEx stop, line, pattern, timetable and monitoring APIs;
- monthly historical regional GTFS from January 2020; and
- optional monthly `stop_observations.txt` from March 2022, containing observed arrivals at stops.

The historical feed is especially valuable but is not byte-identical to the daily source. 511 rewrites service into `calendar_dates.txt`, namespaces global IDs and hashes trip records. Treat a monthly archive as its own release: record the historic parameter, retrieval time, service date, checksum and every transformation. Never assume an identifier persists into another month merely because the public route and stop names do.

The regional feed also publishes GTFS Pathways for selected hubs. The April 2026 list includes 4th & King, Civic Center, Embarcadero, Montgomery, Powell Street, Salesforce Transit Center and the San Francisco Ferry Terminal. Coverage is selective: a listed hub may support authored internal movement, while mere proximity elsewhere proves only adjacency.

### 511 licence gate

The [2026 Data Disseminator Agreement](https://511.org/sites/default/files/2026-04/511_Data_Agreement_Final_2026.pdf) grants a registered user a non-exclusive, royalty-free, worldwide licence to use, copy, store, distribute, sublicense and make derivatives of the provided data. It also:

- requires commercially reasonable efforts to keep information current in public services;
- prohibits selling the data as received on a standalone basis without written agreement;
- requires prospective sublicensees to accept the agreement in writing;
- requires `data provided by 511.org` or equivalent, linked and visually close to the data;
- requires product documentation and proof of attribution to be sent to MTC within 30 days of launch;
- prohibits unlicensed use of supplier marks and logos; and
- can be changed or terminated on notice.

Before any derived timetable JSON enters a public build, obtain written answers from MTC:

1. Is a compact, non-reconstructive JSON motion artifact delivered to a browser part of the registered application, or a sublicense that requires every viewer's written acceptance?
2. Does the reasonable-currency clause allow a clearly dated artwork compiled from the expressly offered historical feed to remain permanently available?
3. Does the 511 agreement fully govern Muni data acquired through 511, or must the separate SFMTA Transit Data License also be accepted and flowed through?
4. May the required 511 acknowledgement live in the persistent source panel rather than the minimal motion canvas, and is that sufficiently close to the data?
5. What exactly counts as the launch documentation due within 30 days for an open-source, non-commercial exhibition page?
6. May a derived artifact be mirrored in a static repository or CDN when it contains only the selected service day and cannot reconstruct most of the regional feed?

Until those answers are retained with the source manifest, 511 is suitable for research and an internal proof but amber for public deployment.

### Operator-specific sources

| Publisher | Available data | Terms and limits | Use in the study |
| --- | --- | --- | --- |
| [SFMTA](https://www.sfmta.com/gtfs) | Direct static Muni GTFS; official route pages with schedules, stops and live predictions | The SFMTA Transit Data License is non-exclusive, limited and revocable; requires the City disclaimer on derivatives; prohibits City marks and sublicensing; and contains an apparent tension between derivative versions and a clause reserving modification of the data to SFMTA. | Required rights clarification for the defining cable-car/Muni layer. Direct feed inspection must establish route types, shapes, calendar, frequency semantics and whether PH/PM/C public identities map to internal 59/60/61 identifiers. |
| [BART](https://www.bart.gov/about/developers) | Static GTFS, GTFS-RT Trip Updates and Alerts, legacy API, and [rail/station/entrance KML](https://www.bart.gov/schedules/developers/geo) | No registration; limited revocable developer licence; no BART marks or official system map. The Antioch extension has unmatched realtime trip IDs, and the Airport Connector has no realtime arrivals. | Cleanest independent regional rail layer. Use BART geometry, not its map artwork, and do not call trip updates geographic vehicle positions. |
| Caltrain | Static GTFS through 511 and [direct developer resources](https://www.caltrain.com/developer-resources) | Direct terms are also limited and revocable; its current realtime publication and identity quality must be inspected rather than inferred from the 511 regional endpoint. | 4th & King is useful as the southern edge of a wider proof, not necessary for the first northeast composition. |
| Golden Gate Ferry and San Francisco Bay Ferry | Static service in the 511 regional feed; current public routes call at San Francisco Ferry Terminal | Public ferry operators are present, but 511 warns that some private/tourist ferry services are absent. Agency `Monitored` flags and all three GTFS-RT entity types must be checked per operator. | Scheduled crossings can reveal the Bay as infrastructure. Do not imply complete ferry coverage or use a straight GTFS shape as evidence of an exact navigational track. |

## Geographic, structural and contextual sources

| Source | What it supports | Limits |
| --- | --- | --- |
| [DataSF elevation contours](https://data.sfgov.org/Energy-and-Environment/Elevation-Contours/rnbg-2qxw/about) | Five-foot contours for mainland San Francisco and Treasure/Yerba Islands, under PDDL | Historical-only publication with sparse provenance on the catalogue page. Interpolation can support a terrain surface and approximate route profile, not surveyed rail grade, track elevation or a vehicle's measured altitude. Preserve the source datum and transformation. |
| [DataSF simplified Muni routes](https://data.sfgov.org/Transportation/MUNI-Simple-Transit-Routes/twv9-dib2/about) | Directional full-length route polylines imported from SFMTA's Trapeze scheduling system, under PDDL; explicitly identifies internal routes 59, 60 and 61 as cable cars | Simplified cartographic layer, updated by service signup and deliberately omits short turns and nuanced patterns. Prefer matched GTFS shapes where complete; use this as an independent route check or documented fallback. |
| [DataSF shoreline and islands](https://data.sfgov.org/Geographic-Locations-and-Boundaries/SF-Shoreline-and-Islands/txuc-3kzm) | Mainland shoreline, southern county line and county islands, under PDDL | Historical 2016 geometry. Adequate for a bounded Bay edge after topology and datum inspection; not a current hydrographic or bathymetric source. |
| [BART geospatial data](https://www.bart.gov/schedules/developers/geo) | Station centroids, entrances and rail lines in KML | Subject to BART's developer terms. It is infrastructure geometry, not proof of the platform, track or instantaneous train position used on a given trip. |
| [USGS 3DEP / LidarExplorer](https://www.usgs.gov/tools/lidarexplorer) | Public-domain bare-earth DEM or lidar candidate for a later high-resolution terrain crop | Search and record the exact project, acquisition date, resolution, vertical datum, coverage and size before adoption. Do not silently combine it with the local five-foot contours. |

Buildings are not required for the first proof. If later used, they should be a separately loaded, heavily simplified crop and must not obscure the terrain/transit relationship. A dark relief mesh and shoreline can make San Francisco legible before a street or building layer appears.

## What each visual claim requires

| Intended claim | Evidence required | Present feasibility |
| --- | --- | --- |
| Scheduled motion on one regional clock | One pinned monthly historical feed, active service date, stop times and shapes | **Yes.** The 511 archive is designed for retrospective service, subject to the publication gate. |
| Three working cable-car lines | Active SFMTA/511 routes and service calendars joined to official route identity | **Yes for schedule.** Official SFMTA pages currently list California, Powell/Mason and Powell/Hyde. Inspect the archive rather than hard-code current web labels. |
| A vehicle climbing a hill | Timetable progress on authoritative route geometry sampled against a documented terrain surface | **Approximate and labelable.** This shows scheduled horizontal progress over modeled ground height, not measured car altitude or exact track gradient. |
| Cable grip and release | Infrastructure/operating evidence for cable sections and terminal/turntable behavior, separate from vehicle timetable | **Authored metaphor unless separately sourced.** The GTFS does not expose grip state or the underground cable's motion. |
| Muni changing between street and subway | Source-backed portal and segment-level above/below-ground classification | **Not yet.** Stops and shapes alone cannot place the exact transition or depth. Acquire an official infrastructure layer or author only a clearly documented segment boundary. |
| BART beneath Market and across the Bay | BART rail KML plus source-backed tunnel/tube classification | **Geometry yes; vertical semantics to source.** Do not derive depth from map appearance or station names. |
| Ferry movement | Published trip times and shapes or an observed vehicle-position trail | **Scheduled yes; exact course unknown.** Interpolate only as a schematic crossing until position coverage and retention terms are proven. |
| A real interchange | GTFS Pathways/Transfers or an explicitly limited adjacency relation | **Good at selected hubs.** 511's listed Pathways coverage provides a stronger starting set than name/proximity joins. |
| Observed historic operation | `stop_observations.txt` events joined to the same historical trip release | **Yes at stops.** Between-stop motion remains scheduled interpolation; missing observations must be visible rather than filled silently. |
| Continuous observed vehicles | Lawfully retained GTFS-RT Vehicle Positions with stable trip/vehicle joins and timestamps | **To inspect.** Regional endpoints exist, but presence, precision and consistency differ by operator and are not themselves a historical archive. |

## Identity and compiler risks

- Namespace every ID by 511 release and original agency. The historical regional compiler hashes trips and namespaces records; it does not promise cross-month identity stability.
- Preserve public route names separately from source IDs. Cable cars appear as PH/PM/C on current passenger pages while the DataSF route layer identifies 59/60/61 as cable-car routes.
- Inspect `agency`, `routes`, `trips`, `stop_times`, `calendar_dates`, `frequencies`, `shapes`, `transfers`, `pathways`, `levels`, `translations`, `attributions` and the 511 GTFS+ files before designing the schema.
- Record `America/Los_Angeles`, source validity, civil service date, retrieval time, archive parameter, licence version and SHA-256. Daylight-saving transitions create 23- and 25-hour local days; after-midnight GTFS times must remain attached to their service day.
- Keep static, observed-at-stops and live-position studies distinct. A prediction is not an observation; an observed stop event is not a GPS track; a regional endpoint's existence does not prove every operator or route is present.
- Treat ferry shapes as published display paths unless their provenance says otherwise. They do not establish currents, navigation channels or the vessel's actual course.
- Treat terrain sampling as an authored join with a measured error budget. Stops may be underground, elevated or offset from the route; ground height is not platform or vehicle height.
- Keep SFMTA, Muni, BART, 511 and operator maps, marks, badges and vehicle imagery out of the initial artwork. Use an authored palette and plain-text attribution.

## Recommended first proofs

### SF 0A — Hills-to-Bay scheduled slice

Compile an ordinary weekday 08:00–10:00 study bounded by the Ferry Building, Market Street, Van Ness and Fisherman's Wharf.

- Include the three cable-car lines, F Market & Wharves and only the Muni Metro services necessary to reveal the surface/subway edge after that edge is sourced.
- Add the BART Market Street spine as a separate depth layer; stop it at the crop rather than loading the whole region.
- Sample route geometry against the DataSF contours and report match distance, vertical interpolation method and outliers.
- Include the Ferry Building shoreline but defer ferries if their crossing geometry dominates the compact view.
- Target no more than 100 KiB gzip for timetable, paths, terrain and shoreline before JavaScript and CSS.
- Describe all vehicle motion as scheduled. This internal proof may be built after accepting source terms, but it must not enter the public artifact until the 511/SFMTA licence questions are answered.

### SF 0B — The Bay changes the scale

Add a small number of BART, Caltrain and public-ferry trips that leave the peninsula crop. The signature question is whether the same clock can make the city switch from steep and intimate to flat and regional without becoming a generic Bay Area transit map.

The composition should lazy-load the regional geometry and preserve source agency identity. Golden Gate Bridge buses, private tourist ferries, Oakland surface transit and the complete Caltrain corridor are not opening obligations.

### SF 0C — Observed arrivals, honest interpolation

Compile the same two-hour slice from one monthly archive containing `stop_observations.txt`. Show the difference between schedule and observed call time at selected stops, retain gaps, and interpolate spatial motion only between supported events. This proof tests a reusable scheduled/observed contract without claiming an archived vehicle trail.

## Source-gate checklist

### Access and rights

- [ ] Register a 511 data disseminator account; keep its token outside the repository and client.
- [ ] Save the signed/accepted 2026 agreement, source-supplier terms and exact per-feed metadata with the retrieval manifest.
- [ ] Obtain MTC's written treatment of compact browser artifacts, historical permanence, sublicensing and SFMTA supplier terms.
- [ ] Obtain SFMTA's written treatment of derived compact data, modification, sublicensing and the required derivative notice.
- [ ] Confirm BART, Caltrain and ferry terms for every layer actually admitted; do not infer one operator's licence from the regional catalogue.
- [ ] Design persistent `data provided by 511.org` attribution and the post-launch documentation step before public release.

### Feed and geography inspection

- [ ] Download one current Muni feed and one matching monthly regional archive; record byte hashes, validity and table inventories.
- [ ] Quantify route/trip/shape coverage for PH/PM/C versus 59/60/61 and verify all three current cable-car services on the chosen date.
- [ ] Inspect `frequencies.txt` versus explicit trips, short turns, block IDs and after-midnight service; never manufacture vehicles from a headway without deterministic rules.
- [ ] Inventory operator `Monitored` flags and actual Trip Update, Vehicle Position and Alert coverage for Muni, BART, Caltrain and both public ferry systems.
- [ ] Measure Pathways/Transfers coverage at the seven listed San Francisco hubs and keep unsupported station adjacency separate.
- [ ] Transform the five-foot contours into the renderer's coordinates, validate shoreline topology and measure route-to-terrain sampling error.
- [ ] Source segment-level Muni subway portals and BART tunnel/tube semantics before drawing depth as fact.

### Proof and admission

- [ ] Compile SF 0A for 08:00–10:00 with source metadata and a compressed payload report.
- [ ] Validate a steep oblique camera, phone label density, reduced motion and terrain occlusion before adding buildings.
- [ ] Compare the current static feed with its matching historical month and document all ID rewriting.
- [ ] Compile one `stop_observations.txt` slice and quantify matched, missing and inconsistent observations.
- [ ] Decide whether the local work is fundamentally about grip, vertical interchange or Bay-scale release before assigning a title.
- [ ] Admit San Francisco only when the public licence path and a transformation more specific than “multimodal transit over hills” are both proven.

## Exit criterion for the investigation

The source gate passes when a permanently publishable, pinned service day can place cable cars, Muni and BART on one clock over defensible terrain and depth semantics, with 511/SFMTA obligations implemented rather than merely linked. The edition gate passes when a viewer can feel why San Francisco changes mode as it meets hill, tunnel and water—and when that relationship has a title and signature action that could not belong to another city.
