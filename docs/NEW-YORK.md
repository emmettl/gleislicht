# 007 — Local / Express

**A New York motion study**

*The same city, stopping differently.*

## Thesis

New York's defining tension is not merely geographic versus schematic space. It is the operational argument happening inside the lines: local and express services share a corridor, separate, overtake and meet again. Manhattan is violently compressed against four much larger outer boroughs, while bridges and tunnels turn water crossings into a second hidden structure.

Its map-history tension sits between Massimo Vignelli's severe diagram and Michael Hertz's more geographic map. The edition should make that disagreement animateable, while authoring its own geometry rather than tracing either work.

The edition should therefore preserve three simultaneous truths:

- **geographic New York**, with coastlines, unequal distances, bridge approaches and tunnel crossings;
- **diagram New York**, a locally authored topological composition informed by the city's map history without copying current or historic operator artwork;
- **operational New York**, where stopping pattern, track role and relative motion matter as much as line identity.

The title names the central interaction, the passenger decision and the visual grammar. A slash should remain part of the mark: **LOCAL / EXPRESS**.

## Signature study: the overtake

Begin with one corridor where a local and express service can be reconstructed credibly from a shared service day. Keep both vehicles represented by canonical route progress while the underlying geography transforms. Station spacing collapses, curves align and the borough relationship changes, but the express still passes the local at a real operationally defensible point.

The overtake must not be faked merely because it looks good. The compiler should identify comparable trips, their stopping patterns and a time interval in which their relative order changes. If public data cannot establish track assignment, the scene may describe a **service-pattern overtake** without asserting a specific physical track.

## Visual grammar

- local trains form a steady, closely spaced cadence; express trains make longer, brighter strokes;
- skipped local stops flicker beneath an express passage without implying a call;
- the East and Harlem rivers, Upper Bay and major crossings anchor geographic mode;
- tunnelled segments submerge visually instead of drawing unexplained chords through water;
- the layout transition exaggerates Manhattan compression and releases the outer boroughs;
- local/express identity sits above agency colour, while selected route identity remains unambiguous;
- commuter rail, buses, ferries, roads and air remain later optional studies, not opening-scene obligations.

## Delivery plan

## Source audit and first fixture

The first source gate now uses MTA New York City Transit's regular static Subway GTFS. MTA distinguishes that feed from its hourly supplemented feed: the regular archive describes the normal schedule and is updated a few times a year, while the supplement incorporates most—but not all—changes in a seven-day horizon. Deterministic studies should therefore retain the regular archive bytes, SHA-256, feed version, service date and retrieval time; a later operational study may record the supplement separately but must not silently replace the authored baseline.

The GTFS supplies route, trip, service-calendar, directional stop, stop-time and shape identity. MTA's current station inventory adds GTFS Stop ID, station and complex master-reference numbers, operational line, borough and structure class. It can support “subway / elevated / open cut” station context, but neither source establishes a train's physical track assignment. MTA's subway realtime feed includes Trip Updates and a VehiclePosition entity whose documented positional value is the timestamp of last detected movement, not a geographic GPS coordinate. A future realtime layer must therefore remain schedule/stop interpolation corrected by observations, never GPS theatre.

MTA's feed terms permit downloading, hosting on a non-MTA server and using a subset, while prohibiting proxying directly from MTA, implying endorsement, claiming accuracy/completeness/timeliness, or using MTA maps, logos and symbols without the applicable licence. The terms also say not to modify or delete feed data. The current committed fixture is a derived application artifact rather than a redistributed feed, but that clause and MTA's separate application-licensing test must receive a publication review before 007 is released. No MTA map artwork or marks enter the repository.

`npm run data:new-york:proof -- --archive /path/to/gtfs_subway.zip --service-date 2026-09-04 --retrieved-at …` now compiles the first bounded evidence artifact. It contains routes 4 and 5 express and route 6 local from Brooklyn Bridge–City Hall to 125 St, 07:00–09:00 on an ordinary Friday: 160 scheduled trips, 40 directional stops and 48 shape-backed segments. The compiler preserves `local` / `express` as an edition-neutral service-pattern field.

It also finds 207 **scheduled pass events** where an express is later than a local at one shared station and earlier at the next. This proves that the timetable can support the signature comparison. It does not claim the exact passing time, physical track, dispatching decision or observed operation. The 145.3 KiB artifact compresses to 17.5 KiB; `npm run check:new-york` enforces publisher, service window, route/pattern coverage, shape coverage, pass-event semantics and a 28 KiB compressed ceiling.

The first interactive foundation is available at `/new-york.html`. It draws the real MTA shape geometry against NYC Planning's water-excluded Manhattan shoreline, with two derived water bands making the Hudson and East/Harlem river context explicit. A separately loaded original diagram equalises station spacing and separates direction into two visual spines; this is a compositional device, not a physical-track claim. Search, station tapping, local/express isolation, shared-clock morphing and limited chrome all reuse the common engine. **Next overtake** jumps to the next compiler-proven order reversal, pauses the clock, frames the downstream shared station and isolates the exact local/express pair with layered route light, compact labels and distinct trails.

The enforced first-view ceiling is 390 KiB gzip. The current foundation is 353.3 KiB: 313.4 KiB JavaScript, 12.1 KiB CSS and 27.8 KiB for timetable plus geographic context. The diagram and complete day remain lazy. Desktop Chromium and iPhone WebKit exercise independent loading, search, pattern selection, the overtake director, layout continuity, progressive day loading and viewport containment.

The same pinned archive now also produces a bounded 24-hour corridor study: 1,063 journeys and 1,255 scheduled order reversals split into twelve two-hour chunks. The 28.2 KiB gzip manifest loads only after selecting **24H**; the current chunk is at most 10.6 KiB gzip and adjacent chunks are prefetched after it becomes usable. All twelve chunks total 87.9 KiB gzip. The 875 KiB unchunked compiler intermediate is ignored and never staged for the browser.

Publication remains deliberately separate from technical readiness. The [internal publication review](./NEW-YORK-PUBLICATION.md) found an unresolved conflict between the feed agreement's permission to host and subset data and its prohibition on modification, plus a separate licensing question around station names and route indicators. CI therefore tests the complete local study, then withholds the New York page and derived data from the Pages artifact pending written MTA clarification or an appropriate licence.

Sources:

- [MTA developer resources](https://www.mta.info/developers)
- [MTA data-feed terms and conditions](https://www.mta.info/developers/terms-and-conditions)
- [MTA GTFS implementation documentation](https://github.com/nymta/gtfs-documentation)
- [MTA Subway Stations dataset](https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f)
- [MTA Subway GTFS-Realtime reference](https://api.mta.info/GTFS.pdf)
- [NYC Planning Borough Boundaries](https://data.cityofnewyork.us/City-Government/Borough-Boundaries/gthc-hcne)

### NYC 0 — Source and rights audit

- [x] Identify authoritative static timetable, realtime, station-structure and geometry sources and record their terms and redistribution constraints.
- [x] Prove stable stop, trip, route, direction and service-pattern identities across one ordinary weekday.
- [x] Determine which source claims support local/express status, structure and actual versus scheduled positions—and record that track assignment remains unsupported.
- [x] Select the Lexington Avenue 4/5 express and 6 local corridor after the evidence supports an honest scheduled-pass study.
- [x] Complete an internal publication review of the MTA feed-derivation and separate application-licensing clauses.
- [ ] Obtain written MTA clarification or an appropriate licence before releasing 007; until then the Pages artifact explicitly withholds the page and derived data.

### NYC 1 — Corridor proof

- [x] Compile one deterministic two-hour Lexington Avenue study through the shared network contract.
- [x] Preserve individual stopping patterns, skipped local stops and scheduled order-reversal events.
- [x] Add water and borough-boundary context sufficient for the selected corridor; crossing/tunnel semantics remain a later refinement.
- [x] Validate search, station selection, route emphasis, scrubbing and mobile framing before whole-network ingestion.
- [x] Keep the data proof below 28 KiB compressed and enforce a measured 390 KiB full first-view ceiling.

### NYC 2 — Two map traditions

- [x] Compile independent geographic and topological coordinates against stable stop and path identities.
- [x] Author the bounded corridor's station rhythm, directional gaps, bends and schematic river context in a separate integrity-checked override layer.
- [ ] Extend that layer to interchange label anchors and borough compression when the study grows beyond the Lexington Avenue corridor.
- [x] Keep every moving vehicle, selection and clock position continuous through the transformation.
- [x] Use original composition rules; do not reproduce the protected artwork of either historic or current maps.

### NYC 3 — Local / Express

- [x] Detect and catalogue defensible overtake or service-pattern comparison moments.
- [x] Make local, express and selected-service emphasis readable without filling the screen with badges.
- [x] Add the first corridor-director action: jump to and frame the next scheduled order reversal.
- [x] Test keyboard/search accessibility and a reduced-motion map change that preserves the operational comparison.

### NYC 4 — Complete day and wider city

- [x] Expand the bounded Lexington corridor to a progressively loaded, integrity-checked 24-hour rail day without changing the opening payload.
- [ ] Expand beyond the corridor only after publication clearance and a whole-network payload study.
- Tune label hierarchy separately for Manhattan and the outer boroughs.
- Consider commuter rail and ferries where they clarify regional scale; keep surface traffic independently lazy.
- Add realtime only after static and historical studies have a trustworthy identity join.

## Exit criterion

A viewer should understand local versus express behavior by watching, not by reading a legend, and should feel the conception of New York change without any journey losing its identity.
