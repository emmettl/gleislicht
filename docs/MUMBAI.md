# Mumbai — title to find

**An unnumbered Mumbai motion study**

**Catalogue status:** feasibility investigation complete; defining motion evidence blocked.

## Thesis under test

Mumbai suburban rail behaves like a daily tide: immense directional pressure runs south toward employment centres in the morning and reverses later in the day. The local sentence is **capacity experienced as direction**. A credible work would make passenger volume, not merely train frequency, change the apparent weight of the Western, Central and Harbour corridors.

That distinction is the feasibility test. A timetable can animate trains, but it cannot prove the surge inside them or on platforms. Drawing frequent services as crowded ones would manufacture the defining claim.

## Feasibility verdict — 6 September 2026

| Scope | Status | Defensible interpretation |
| --- | --- | --- |
| Current suburban train trajectories | **Red** | This audit found no maintained, downloadable official GTFS, equivalent static timetable or licensed historical movement archive for Mumbai suburban rail. Rider-facing Indian Railways systems are not documented open-data feeds. |
| Directional passenger tide | **Red** | No authoritative station-by-time-band OD or load dataset covering the suburban system was found. Train frequency and scheduled capacity cannot stand in for observed passenger flow. |
| Metro 2A/7 and Monorail aggregates | **Amber** | MMRDA publishes aggregate ridership data and current timetable announcements. These can support contextual totals, not the suburban-rail tide or individual motion. |
| Terrain, coast and network structure | **Green technically** | A bounded coastal base and official project alignments are feasible. Geography does not solve the missing timetable and demand evidence. |

Mumbai does not currently pass the source-path admission test. The correct outcome is a documented stop, not a synthetic demo that visually overclaims weak data.

## Sources found — and what they do not prove

The Government of India's [Indian Railways Train Time Table catalogue](https://www.data.gov.in/catalog/indian-railways-train-time-table) is published under the Government Open Data License India, but the catalogue record dates from the 2015–2018 period. It is neither a current Mumbai-suburban feed nor a durable basis for the proposed tide study.

The [MMRDA Metro DPR and alignment library](https://mmrda.maharashtra.gov.in/en/divisions/transport-communications/metro-dprs) provides authoritative planning and alignment documents. MMRDA also publishes [ridership data for Metro Line 2A, Line 7 and Monorail](https://www.data.gov.in/catalog/ridership-data-metro-line-2a-7-monorail) through the national open-data portal. Its aggregate series is useful for scale and validation, but it does not describe the three defining suburban systems, time-of-day OD or a rider's path.

MMRDA's [current timetable announcement](https://mmrda.maharashtra.gov.in/en/news-and-announcements/mumbai-metro-introduces-simplified-passenger-friendly-timetables-april-8-new) and operator/railway passenger tools are rider-facing publications. They may establish an individual service rule but do not offer a versioned, machine-readable, redistributable regional schedule.

The Maharashtra open-data catalogue includes [annual passenger water-transport statistics](https://www.data.gov.in/catalog/statistics-annual-passenger-water-transport-maharashtra). Those aggregates may later help describe Mumbai's wider mobility, but they do not locate ferries in time or repair the suburban evidence gap.

Community-produced GTFS files exist for some Mumbai bus services. They were not accepted as authority in this audit: a community conversion can be an engineering aid, but cannot become the evidentiary spine of a permanent Motion Study without operator confirmation, source lineage and redistribution rights.

## What would make the study feasible

The minimum useful source package is:

1. a static, versioned suburban timetable for Western Railway, Central Railway and Harbour/Trans-Harbour services, including service calendars, stopping patterns and stable station identity;
2. authoritative route geometry or a documented join to railway infrastructure alignment;
3. station-entry, exit, OD or train-load measurements in sufficiently small time bands to distinguish direction; and
4. terms permitting transformed public artifacts and private retention of the exact source release.

Automatic fare-collection totals would be most useful if aggregated by station, direction and 15- or 30-minute band. Privacy-preserving aggregates are sufficient; individual smart-card histories are neither necessary nor appropriate. Platform CCTV analytics, handset traces or inferred crowd data should not be acquired merely to make the image possible.

## Rights and publication

India's national open-data publications can carry the [Government Open Data License – India](https://data.gov.in/government-open-data-license-india), but operator websites, timetable documents and apps may have separate terms. Every resource must retain its licence rather than inheriting the portal licence by association.

Any future passenger dataset also needs a methodological disclosure covering aggregation, suppression and the difference between entries, exits, transfers and on-train load. A visual tide should never expose or imply individual commuting histories.

## Evidence boundaries

| Intended claim | Evidence required | Current position |
| --- | --- | --- |
| Trains depart and stop as drawn | Current versioned timetable and authoritative station order | **Blocked.** |
| Morning movement is predominantly southbound | Time-banded directional counts or OD | **Blocked.** Widely understood behaviour is not a substitute for retained measurement. |
| A line is more crowded than another | Comparable load, gate or survey measurement | **Blocked.** Aggregate annual ridership is insufficient. |
| Metro expansion changes the regional field | Dated alignment/status and current service timetable | **Possible as a separate planning layer**, not the core suburban claim. |
| The coast constrains the network | Rights-clean coastline/terrain plus infrastructure alignment | **Possible.** |

## Recommended next action

Do not compile a public or internal visual proof. Prepare a one-page data request for Central Railway, Western Railway, CRIS and the Mumbai Railway Vikas Corporation asking for static timetable, infrastructure geometry and privacy-safe time-band passenger counts. A bounded CSMT–Dadar–Thane or Churchgate–Dadar–Borivali corridor can become the first proof only after at least schedule and directional volume are authoritative.

### Source gate

- [ ] Obtain a current official suburban timetable export with a retained version.
- [ ] Obtain source-backed railway geometry and service-pattern identifiers.
- [ ] Obtain time-banded directional counts or OD with clear aggregation semantics.
- [ ] Confirm transformed-publication and archival rights for every input.
- [ ] Validate a corridor whose visual tide comes from demand evidence, not headway.

**Exit:** Mumbai remains paused until both trains and the directional passenger surge can be represented from authoritative, retainable data.
