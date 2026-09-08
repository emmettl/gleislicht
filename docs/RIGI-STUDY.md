# Lake Lucerne–Rigi: first full-day map

Implemented locally on 8 September 2026. Select **RIGI** in the desktop study strip or the phone study picker. The view combines Lake Lucerne boats, both Rigi cogwheel approaches and the Weggis–Rigi Kaltbad cableway on one 24-hour clock. Search destinations, source line numbers or operators, select a service, and use the mode filters to isolate boats, cogwheel trains or the cableway. Controls and model disclosures are available in EN / DE / FR / IT.

The first fixture uses Swiss GTFS **20260902**, service date **4 September 2026**. It contains **190 movements and 54 source stops**: 50 cogwheel services, 89 boat services and 51 cableway services. Ten source routes belong to Rigi Bahnen (agency `137`, type `116`), Vierwaldstättersee (`185`, type `1000`) and Weggis–Rigi Kaltbad (`13700`, type `1300`). Replacement buses and other Rigi-area cableways are outside this composition. Calendar exceptions are applied; the source IDs, operator and route type survive preprocessing. All services in this fixture have exact scheduled departures. After-midnight arrivals remain on their original service day.

The complete dataset is about **13.1 KiB gzip**, with a tested **25 KiB study-data budget**, so it loads as one optional artifact rather than eight tiny movement chunks. Nothing from this study's data is requested for the initial national view. The default study time is noon; the full day remains searchable, including quiet hours. A failed request is disclosed and other studies remain accessible.

## Geometry evidence

| Mode | Current evidence | Limits |
| --- | --- | --- |
| Cogwheel | All **374 segment occurrences** resolve against the official FOT rail network, simplified at 10 metres. | An infrastructure graph join is not proof of an exact track allocation or measured vertical profile. |
| Cableway | Exact FOT installation **71.105**, Weggis–Rigi Kaltbad, feature 741. Source alignment endpoints are about **9.1 m** and **5.1 m** from the GTFS stop coordinates. | The returned source is 2D and supplies no vertical profile. Support-point coordinates do not establish cable sag, cabin count or circulation. |
| Boats | **54 unique stop pairs** resolve inside the committed FOEN Lake Lucerne polygon, including boundary and island constraints. Largest dock-to-water adjustment: **47.4 m** (150 m maximum allowed). | These are shortest cartographic water paths, not observed tracks, shipping lanes, navigability validation or recommended routes. The simplified Vector25 reference geometry can place a path at a mapped shoreline. |

Boat routing splits candidate segments at every polygon-boundary intersection and tests each resulting interval. This avoids the narrow-island omissions that fixed-distance sampling can cause. A visibility graph then finds a connected path within the water polygon; unresolved endpoints fail generation rather than silently crossing land. Pier positions just outside the cartographic boundary are moved to nearby water endpoints and their offsets are recorded. Supplied explicit paths prevent the renderer from applying a land-transport shoreline detour to boats.

The operator's [Rigi timetable page](https://www.rigi.ch/en/inform/timetables) establishes the two railway approaches and the Weggis cableway as the intended network. The [FOT rail layer](https://map.geo.admin.ch/?layers=ch.bav.schienennetz) and [federally licensed cableway layer](https://map.geo.admin.ch/?layers=ch.bav.seilbahnen-bundeskonzession) supply the mapped alignments. The existing lake artifact retains its [FOEN hydrography source](https://www.bafu.admin.ch/en/the-swiss-hydrographic-network) and attribution. Operator pages do not replace the dated machine-readable timetable.

## Reproduction and audit

```sh
npm run data:rigi -- --archive /path/GTFS_FP2026_20260902.zip --rail-source /path/schienennetz_2056_de.xtf --date 2026-09-04
```

Outputs:

- `public/data/rigi-day.json`: full-day topology, paths and movements.
- `data/rigi-geometry-audit.json`: source hashes, route-level trip counts, water-path lengths and dock offsets, cableway endpoint offsets and source feature identity.
- `data/rigi-cableway-source.json`: retained source response subset for installation 71.105, with exact query URL and retrieval date. Pass `--cable-source` to use a separately retrieved source.

`--water-source`, `--output` and `--audit-output` allow independent rebuilds. A different service date must be regenerated and reviewed; this is not a claim of year-round coverage. The builder rejects incomplete rail or water geometry, a mismatched cableway alignment and an unexpected headway-based source change requiring further disclosure review. Source hashing makes the inputs reproducible. The optional study remains on its explicit fixture date when national publication refreshes the rail timetable.

## Verification and remaining work

Tests cover source selection, cableway identity and reverse direction, rejected endpoints, full-day trip identities and path references, headlands, narrow islands and the actual emitted boat paths. Desktop Chromium and emulated iPhone WebKit checks cover lazy loading, study selection, full-day controls, operator search, mode labels and failure recovery. Physical-device review and publication remain separate steps.

The **2D map** now links to both [measured Rigi terrain ascents from Vitznau and Arth-Goldau](RIGI-TERRAIN.md). Ground elevations beneath the railway are available. The first authored boat–interchange–railway sequence is described below; surveyed track heights, tunnels, vertical cable behaviour and pedestrian geometry remain open. The alternate Weggis cableway sequence is described below. Vitznau boat and railway share source stop `ch:1:sloid:8464`; Weggis pier and cableway retain distinct locations. A shared timetable stop does not mean there is no walk. Seasonal and weekend selection, validated shipping routes and the other Rigi-area cableways are later increments.


## First lake-to-summit sequence

Select **Follow lake to summit** in the RIGI overview. Ten daytime boat departures from Luzern Bahnhofquai pair with the first eligible full Vitznau–Rigi Kulm cogwheel ascent. The default is boat **17**, Luzern **12:12** → Vitznau **13:09**, followed by train **1133**, **13:15** → Rigi Kulm **13:47**. All ten pairs have a **six-minute scheduled interchange**. The composition excludes gaps above 30 minutes: an editorial limit, not a source transfer rule. This excludes the evening boat's 116-minute wait.

The sequence starts paused. The shared map clock, normal playback controls, full-day scrubber and clickable stages determine the phase. The camera follows the selected boat only until its Vitznau arrival, holds the Vitznau station during the interchange, then follows the uphill railway to Rigi Kulm. Scrubbing backward reverses the handoff deterministically. The boat continues toward Flüelen in the timetable, but the visitor's sequence has alighted. Choosing another service or leaving the sequence restores ordinary exploration. Measured Vitznau terrain remains a separate scenic playback, accessible in the sequence's details.

Evidence retained in `data/rigi-interchange-source.json`:

- The fixture's exact source archive hash, feed version and service date.
- The sole applicable `transfers.txt` row for Vitznau and its parent: source stop `ch:1:sloid:8464` to itself, `transfer_type=2`, `min_transfer_time=60`, with no route, trip or service restriction.
- The operator's [Vitznau arrival guide](https://www.rigi.ch/en/inform/arrival/arrival-parking-vitznau), retrieved 8 September 2026, describes a **50 m walk** from the dock to the valley station. No pedestrian polyline, accessibility assessment or observed walking time is supplied.

Reproduce the transfer audit with `node scripts/audit-rigi-interchange.mjs /path/GTFS_FP2026_20260902.zip`. It hashes the archive against the study and rejects changed or more specific transfer rules for review. The optional sequence module derives pairs directly from the loaded fixture; mismatched dates, feed hashes, modes, operators, partial ascents, headway services and missing path geometry do not become sequences. It uses the boat's intermediate arrival, the railway's first departure and its terminal arrival, retaining both source trip IDs. The minimum is a timetable rule, **not a guaranteed connection** or a claim about suitable boarding margins.

Focused tests cover pairing, exact transfer eligibility, source mismatches, stage boundaries and reverse scrubbing. Browser checks exercise automatic boat/rail handoffs, replay, departure choice, dismissal and manual selection on desktop Chromium and emulated iPhone WebKit. Sequence code, copy, styling and evidence load only on entry; the initial bundle budgets remain unchanged.


## Alternate ascent via Weggis and the cableway

The sequence now offers **Choose an approach → Via Weggis · cableway + cogwheel** alongside Vitznau. Ten daytime boats from Luzern connect to the first eligible uphill cableway and then the first eligible cogwheel train from **Rigi Kaltbad-First** to Rigi Kulm. The railway is boarded at its intermediate Kaltbad departure; its earlier Vitznau departure does not trigger the handoff.

For the default boat **17**, the actual chain is:

| Stage | Scheduled time |
| --- | --- |
| Boat: Luzern → Weggis | 12:12–12:53 |
| Weggis walk and wait | 47 minutes |
| Cableway 10025: Weggis → Rigi Kaltbad | 13:40–13:50 |
| Kaltbad interchange | 45 minutes |
| Cogwheel 1139: Rigi Kaltbad-First → Rigi Kulm | 14:35–14:47 |

This is a slower alternative, not a recommended or guaranteed connection. The two long intervals remain on the same clock; clickable stages allow a viewer to skip ahead. The alternate composition admits interchange intervals up to 60 minutes, separately from Vitznau's 30-minute editorial limit. The 06:20 boat's 71-minute Weggis interval remains outside this composition. Neither limit is a timetable transfer rule.

The retained source in `data/rigi-weggis-interchange-source.json` contains the exact seven stop records, their parent relationships, ten directional transfer rows and the archive hash. Both source Weggis pier IDs have a **1,200-second uphill** rule to `ch:1:sloid:30388`; the reverse direction is **900 seconds**. The 12:53 boat cannot therefore be paired with the 13:10 cableway. From cableway summit stop `ch:1:sloid:30687`, the rule to each of the three source Kaltbad railway stop IDs is **300 seconds**. More specific or changed source rules require review; neither a similar stop name nor proximity substitutes for the exact source identity.

The operator's [Rigi Kulm arrival guide](https://www.rigi.ch/en/inform/plan-your-trip/rigi-kulm/arrival), retrieved 8 September 2026, describes a **15-minute walk** uphill from the Weggis pier and **200 metres** between the cableway and railway stations at Kaltbad. The operator's walking description and the feed's directional transfer allowance are separate evidence. The map holds at the alighting station during each interval; it does not invent a pedestrian path or imply zero walking distance. The cableway uses the existing mapped 2D alignment, without fabricated sag, vertical cabin motion or observed cabin positions. The terrain view remains a separate scenic playback.

Reproduce with `node scripts/audit-rigi-weggis.mjs /path/GTFS_FP2026_20260902.zip`. The extractor checks the archive against the fixture, includes parent-level rule scope and rejects missing, additional or more specific rules for these interchange directions. Unit tests cover the 20-minute uphill versus 15-minute reverse rule, exact five-minute Kaltbad eligibility, intermediate railway boarding, all five stage boundaries, backwards scrubbing and unsupported sources. Desktop and emulated-phone checks cover both approaches, automatic cableway handoffs and return to the Vitznau sequence. All new sequence data, code and styling remain optional.
