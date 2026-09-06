# Chicago — title to find

**An unnumbered Chicago motion study**

**Catalogue status:** feasibility investigation complete; technically strong, publication and vertical-classification gates remain.

## Thesis under test

Chicago is the grid made three-dimensional by the `L`: the Loop bends above streets, turns around blocks and passes close enough to buildings that railway and architecture form one machine. The local sentence is **railway visibly threaded through the street canyon**, not simply an urban network over a rectilinear map.

The signature camera should occupy the space between track, road and facade. That makes above/at/below-ground classification and building height as important as timetable data.

## Feasibility verdict — 6 September 2026

| Scope | Status | Defensible interpretation |
| --- | --- | --- |
| Scheduled CTA motion | **Green** | CTA publishes a current static GTFS with ten tables and service calendars, generally refreshed every week or two. It is sufficient for scheduled train and bus interpolation. |
| Live rail arrivals | **Amber** | Train Tracker provides station-centric arrival estimates with an API key. CTA's documentation does not provide a durable historical trajectory archive or public train-position endpoint. Arrival estimates should pulse stations, not become invented train tracks. |
| `L` geometry and city grid | **Green / amber precision** | CTA/City publishes rail-line and station geodata, and Chicago publishes building footprints. The railway line layer is suitable for overview geometry but must be checked against GTFS shapes and engineering context before a close camera. |
| Railway–architecture section | **Amber** | Public footprints plus USGS elevation are strong. Building heights and exact structure/deck elevations are not complete in the audited sources; elevated, embankment and subway segments require an authored source-backed classification. |
| Public artifact rights | **Amber** | CTA permits derivatives only for assisting riders or furthering public transport, under a revocable agreement with branding and other conditions. Confirm that a permanent artwork/exhibition falls within that purpose. |

Chicago has a clean technical proof but should not be admitted until CTA confirms the intended publication purpose and the Loop's vertical model survives a close-range accuracy test.

## CTA transport sources

The [CTA GTFS page](https://www.transitchicago.com/developers/gtfs/) describes a ZIP containing ten GTFS tables plus a copy of the developer agreement. Only one package is posted at a time and it normally covers the present through the next couple of months. CTA says it generally refreshes the feed every one or two weeks, with additional updates for planned changes.

That means the acquisition process must retain every used ZIP immediately, hash it, preserve its embedded terms and reject a study date outside its calendars. Feed IDs should not be assumed stable across service updates; identity is namespaced by CTA release and the public line/station identity is maintained separately.

[Train Tracker](https://www.transitchicago.com/developers/traintracker/) supplies current arrival estimates at `L` stations and requires a key. It is useful for live operations display, but it does not make static GTFS observed. A recorded arrival prediction is evidence of what CTA predicted at that time, not proof that a train occupied an interpolated position between stations.

Bus Tracker includes vehicle locations, but buses would weaken the opening's architectural focus. Add them only if a later street-level scene has its own purpose and rights review.

## Rights and publication gate

CTA's [Developer License Agreement and Terms of Use](https://www.transitchicago.com/developers/terms/) covers GTFS, scheduled service, Train Tracker, Bus Tracker and alerts. It grants a limited, revocable right to use, reproduce, distribute, display, process and create derivatives for the sole purpose of assisting transit riders or furthering/promoting public transportation. The agreement also contains attribution, branding, update, disclaimer and termination conditions.

The proposed artwork plausibly promotes public transport, but that is an interpretation rather than a durable permission. Ask CTA in writing whether:

1. a non-trip-planning interactive artwork and exhibition recording fit the stated purpose;
2. a compact, transformed timetable/geometry artifact may be hosted indefinitely after the source feed changes;
3. a pinned historical ZIP may be retained privately and replayed publicly;
4. route colours, station names and the letters `CTA`/`L` may be used without operator marks; and
5. the required credit and update language may live in the methodology rather than permanently over the canvas.

The City data portal's terms govern City-hosted footprints and GIS layers separately. USGS 3DEP elevation is public domain, but its capture/quality metadata should still be cited.

## Architecture and vertical model

The City of Chicago publishes [CTA `L` rail lines](https://data.cityofchicago.org/Transportation/CTA-L-Rail-Lines-Shapefile/53r7-y88m), station/ridership tables and [current building footprints](https://data.cityofchicago.org/Buildings/Building-Footprints-current-/hz9b-7nh8). [USGS 3DEP](https://www.usgs.gov/the-national-map-data-delivery/gis-data-download) supplies public-domain lidar and bare-earth elevation.

Footprints do not supply facade shape or reliable height by themselves. A useful downtown massing layer therefore needs either an official height/3D source or a deliberately flat/extruded treatment whose limitations are visible. Do not infer building height from storeys, zoning maxima or shadows without documenting that reconstruction separately.

Compile rail structure state as explicit segments: elevated steel, surface/embankment, subway and bridge. GTFS `shapes.txt` and the City centreline do not encode deck height. A camera passing between buildings must stay far enough away that source precision remains honest.

## Evidence boundaries

| Visual claim | Required evidence | Present feasibility |
| --- | --- | --- |
| A train is scheduled around the Loop | Pinned GTFS trip, calendar, stop times and matched shape | **Yes.** |
| A train is live at a point | Vehicle/track-circuit position with identity | **Not from Train Tracker arrivals.** |
| Track is elevated beside these buildings | Structure classification plus rail/building geometry at compatible precision | **Possible after authored audit.** |
| A building has the displayed height | Official 3D/height source or declared reconstruction | **Not established from footprints alone.** |
| The grid and Loop form one machine | Source-backed geometry and authored camera | **Strongly feasible.** |

## Recommended proof

Compile a weekday **07:00–09:00 downtown Loop study**, limited to the elevated circuit and the approaches needed to show services entering and leaving it. Use scheduled GTFS motion, a source-backed elevated-segment model, simplified City building footprints and USGS ground elevation. Keep live arrivals and buses out of the first proof.

### Source gate

- [ ] Download and hash one current CTA GTFS with its embedded agreement.
- [ ] Receive CTA clarification for historical, transformed artwork publication.
- [ ] Validate GTFS shapes against the City rail-line layer in the Loop.
- [ ] Build and cite elevated/subway/surface segment classification and deck-height assumptions.
- [ ] Establish a rights-clean building height treatment or deliberately flatten the massing.
- [ ] Test close camera clearances and precision on phone/desktop.

**Exit:** Chicago advances when the Loop can be viewed in architectural section without inventing vertical precision and the CTA purpose clause is resolved.
