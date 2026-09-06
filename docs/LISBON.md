# Lisbon — title to find

**An unnumbered Lisbon motion study**

**Catalogue status:** feasibility investigation complete; terrain-led Carris proof passes, full ferry thesis remains incomplete.

## Thesis under test

Lisbon's trams, funiculars and ferries negotiate a city apparently designed to defeat wheels. The local sentence is **traction made visible by gradient**: ordinary routes bend around slopes, trams climb them, funiculars confront them directly and ferries escape onto the flat Tagus.

The opening can succeed without pretending every mode has equal data. Carris supplies a strong current surface source; the missing current open ferry feed means the river should remain structural until that gap is resolved.

## Feasibility verdict — 6 September 2026

| Scope | Status | Defensible interpretation |
| --- | --- | --- |
| Current Carris tram/funicular motion | **Green** | Carris publishes a current direct GTFS with exact trips, stop times and shapes. The inspected feed includes tram and funicular/elevator route numbers. |
| Mode identity | **Amber but solvable** | Every Carris route in the inspected GTFS uses `route_type=3`, including trams and funiculars. Mode must be assigned from an explicit, versioned operator-route taxonomy rather than GTFS type. |
| Metro and metropolitan buses | **Green/amber by release** | Lisbon Metro and Carris Metropolitana/TML publish open GTFS/API resources, but release dates and compatibility need inspection. They are not required for the opening. |
| Current Tagus ferry motion | **Red/amber** | Historic Transporlis catalogues list Transtejo/Soflusa feeds, but no current maintained official GTFS or machine feed was established in this audit. Rider timetable pages are not equivalent. |
| Terrain | **Green technically / source selection pending** | Portuguese/municipal geodata can provide a rights-clean DTM. Its date, resolution, vertical datum and publication terms must be chosen before gradient claims. |

Lisbon passes as a bounded tram/funicular work. It does not yet pass as the complete three-mode thesis named in the pipeline.

## Inspected Carris feed

Carris exposes a direct official GTFS endpoint:

`https://gateway.carris.pt/gateway/gtfs/api/v2.11/GTFS`

The ZIP retrieved on 6 September 2026 was generated on 4 September 2026:

- SHA-256: `395980ff1688b70e37d59869b78e97bedad8ab555327e893314dc6a8c0b22573`;
- eight tables: agency, calendar, calendar dates, routes, shapes, stops, stop times and trips;
- 176 route records, 2,347 stops, 87,836 trips, 2,433,824 stop-time rows and 142,373 shape points; and
- base calendars running from 6 June through 31 December 2026, with date exceptions.

The routes include tram services `12E`, `15E`, `18E`, `24E`, `25E` and `28E`; `51E` Gloria, `53E` Ascensor da Bica, `54E` Elevador de Santa Justa and `55E` Funicular da Graca also appear. All are encoded as GTFS bus type 3. Public line number and a retained Carris mode lookup must therefore override `route_type` for rendering, while the original value remains in provenance.

The endpoint version appears in the URL but the ZIP has no `feed_info.txt` or `attributions.txt`. Save acquisition URL, API version, generation timestamps, checksum and applicable Carris terms externally. Do not rely on the endpoint retaining this exact release.

## Other transport sources

The Portuguese open-data catalogue describes a [Lisbon Metro GTFS dataset](https://dados.gov.pt/pt/datasets/informacao-sobre-transportes-publicos-da-cidade-de-lisboa-metropolitano-de-lisboa/) under CC0. Its harvested resource history must be inspected before it is called current.

TML publishes [Carris Metropolitana open-data documentation](https://go.tmlmobilidade.pt/reference/open-data), including an active unified GTFS path, and an official [OGC API](https://geoportal.tmlmobilidade.pt/ogc-api/collections/gtfs_stops?f=html) for stops. These can extend the study into the metropolitan region later.

Historic Transporlis/dados.gov.pt records identify Transtejo and Soflusa GTFS resources, but stale catalogue history is not evidence of a current ferry timetable. Until a maintained operator feed and reuse terms are found, current ferry departures may be compiled from retained official timetables only as a separate manual source—or omitted.

## Rights and terrain

The Portuguese open-data catalogue marks Carris/Metro resources with open licences such as CC0, but the direct Carris endpoint does not embed licence or attribution metadata. Retain the current Carris API/site terms and obtain written confirmation if the licence chain remains unclear. TML and terrain products retain their own licences.

Use an official DGT, Lisbon municipality or other Portuguese public DTM cropped to the hills, with resolution and vertical datum documented. Stop coordinates plus ground height can approximate surface route elevation; bridges, tunnels and funicular track require explicit structure handling. Do not force every stop to bare-earth height when the route sits on a structure.

## Evidence boundaries

| Intended claim | Evidence required | Present feasibility |
| --- | --- | --- |
| A Carris trip is scheduled | Pinned trip, stop times, calendar and shape | **Yes.** |
| A vehicle is a tram/funicular | Explicit Carris route taxonomy | **Yes after a small authored mapping; not from `route_type`.** |
| It climbs the rendered gradient | DTM plus route/structure elevation validation | **Promising.** |
| A ferry moves across the Tagus now | Maintained timetable/GTFS and service geometry | **Not established as an open machine source.** |
| A vehicle occupied an exact point | Retained realtime position | **No.** The opening is scheduled interpolation. |

## Recommended proof

Compile a weekday **07:00–09:00 Baixa–Alfama–Graca terrain section** using `12E`, `28E` and the steepest relevant funicular/elevator services from the pinned Carris feed. Crop the DTM tightly and expose actual vertical exaggeration. Keep the Tagus visible but ferries structural/off until a maintained current source is secured.

### Source gate

- [x] Verify current Carris GTFS tables, counts, calendars, checksum and tram/funicular records.
- [ ] Retain governing Carris terms and confirm the direct feed's open-licence chain.
- [ ] Create a cited route-number-to-mode taxonomy and test it across the release.
- [ ] Acquire a rights-clean Lisbon DTM and validate surface/structure elevation joins.
- [ ] Resolve current Transtejo/Soflusa machine data or explicitly scope ferries out.
- [ ] Set a phone-first terrain/shape payload and close-camera precision gate.

**Exit:** Lisbon advances first as a measured slope-and-traction study; the river layer joins only when current ferry motion is reproducible and licensed.
