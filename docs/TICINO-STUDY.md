# Ticino — initial regional rail and bus study

Built from the pinned national timetable, reviewed FOT infrastructure and attributed OSM bus matching on **8 September 2026**. The application exposes **Ticino · rail and valley buses**, with Friday and Sunday full days, morning extracts, dated share links, search, and an explicitly partial scope. All eight districts have admitted services. The opening camera frames Ticino; full journey bounds, out-of-canton stops and paths remain in the data.

## Scope and measured coverage

The complete national scan found **209 Ticino-calling route records across 32 GTFS agency identities**, from 5'142 routes and 34'499'152 stop times. 28 canton routes are inactive on both fixtures. See the [complete route and area inventory](TICINO-ROUTE-INVENTORY.md).

| Civil date | Candidate journeys | Admitted journeys | Excluded journeys | Matched candidate occurrences | Occurrences retained in app |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-09-04 | 9'287 | 6'660 | 2'627 | 96.78% | 91.76% |
| 2026-09-06 | 7'166 | 4'669 | 2'497 | 95.95% | 90.73% |

“Matched candidate occurrences” counts accepted segments even in journeys whose other segments fail. “Retained in app” counts only segments of whole admitted journeys, against **all candidate occurrences**, including mountains, boats, foreign calls and failures. Every admitted journey has **100% accepted segment geometry**, which is not a claim of 100% canton coverage. The audit also reports canton-adjacent occurrences, exact directed route/platform pairs, complete patterns, operator/mode groups and overlapping district totals.

Friday has 992 directed patterns and 7065 directed route/platform pairs; Sunday has 704 and 6870. The app retains 146 / 135 route identities. It includes SBB, SOB, FLP, domestic FART rail patterns, TPL, AMSA, ARL, FART buses, Autolinee Bleniesi, PostAuto and smaller calling operators where whole journeys pass admission.

## Journey preservation and admission

The census uses the **complete, unsimplified Ticino MultiPolygon**, including holes, and all eight district polygons from January 2026 swissBOUNDARIES3D. No rectangular operator shortlist determines membership. Every route is checked against every archived trip, including inactive routes. Only journeys that themselves call in Ticino enter each dated candidate set. Non-stopping through traffic and services absent from the pinned archive are outside this denominator.

Each civil day includes active services from that date and the preceding date, with whole journeys that intersect [00:00,24:00). Original calls before midnight and after 24:00, arrival/departure times, repeated stops, boarding rules and source identities are preserved. The feeds retain 128 / 170 carry-in journeys and 312 / 275 journeys with out-of-canton calls. No partial journey is fabricated by clipping at the canton, Italy or a geometry gap.

The app admits a whole rail or bus journey only when every segment has accepted geometry, no pickup/drop-off rule requires reservation or coordination, and no positive-duration bus segment implies more than **110 km/h**. The latter is a conservative review gate: it holds questionable timing/geometry combinations for investigation, not a statement of actual road speed. It excludes 32 / 28 journeys involving Sorte–Lostallo, Maggia–Lodano or Nufenen–Medels. The original source journeys remain available in the extracted timetables.

Coincident minute-resolution calls remain unchanged: 14'194 / 11'908 admitted occurrences have zero scheduled travel duration. These have no finite implied speed; no artificial seconds are inserted. Exact versus representative frequency semantics are preserved in the source extraction. The 1905 / 1893 headway movements in the candidate scope are presently excluded with their unsupported mountain/funicular geometry; none is presented as an exact departure.

## Geometry, exclusions and reuse

| Source | Vintage and reuse | Application treatment |
| --- | --- | --- |
| National GTFS | SBB / opentransportdata.swiss, feed 20260902, SHA-256 `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`; [terms](https://opentransportdata.swiss/en/terms-of-use/) | Attribution and Gleislicht processing label; pinned archival dates, never relabelled as a fresh timetable |
| FOT rail network | [Source bundle](../data/aargau-rail-sources/source.json), catalogue 2021-07-06, asset updated 2025-01-18, published asset checksum verified; [reuse terms](https://opendata.swiss/terms-of-use/#terms_by) | © Federal Office of Transport; exact route and operating-point identities; full ordered calls constrain source topology |
| OpenStreetMap | Geofabrik Switzerland 2026-09-02 plus border Overpass extract retrieved 2026-09-08; [ODbL and attribution](https://www.openstreetmap.org/copyright) | © OpenStreetMap contributors; derived bus path database supplied at [road-paths.json.gz](../public/data/ticino-region/road-paths.json.gz) with matching evidence and separate provenance |
| swissBOUNDARIES3D | January 2026, exact raw canton geometry and source GPKG hash retained; [terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices) | © swisstopo; approximate LV95-to-WGS84 transform, seven decimals, no simplification |
| Ticino local services | Official WFS/WMS, download catalogue, legal catalogue and terms checked 2026-09-08 | Investigated and documented; no TI-12 line vectors imported |

Rail uses the already reviewed, checksum-verified national FOT bundle and a [Ticino route policy](../data/ticino-rail-policy.json). Station attachment is capped at 350 m, source topology attachment at 120 m, route length at max(3 km, 4.5 × straight distance), and simplification at 5 m. Searches cannot pass another scheduled operating point before its call. The audit retains every directed FOT source segment and attachment distance. This is infrastructure inference: the source is dated 2021, its September 2026 currency is unknown, and it does not certify actual running tracks or temporary diversions.

The bus run covers **all 769 complete bus patterns** across both dates, retaining agency, exact national route ID, full ordered platform IDs and coordinates. The routing union is only a matching input; shifted nonnegative routing times never replace passenger times. pfaedle runs with `--no-trie -W`; every warning and rejected hop is retained. Monotone GTFS shape distances preserve loops and repeated calls. Acceptance limits are 120 m snap, max(1.5 km, 6 × straight distance) detour and 5 m simplification. The initial matcher accepted 99.82% of bus segment occurrences before complete-journey and timing admission. OSM inference is not an operator-approved alignment, lane-legality guarantee or replacement-bus diversion certificate.

Every excluded journey has an ID, complete pattern reference and reason in the compressed daily audits. Geometry exclusions include missing foreign operating points, station attachments beyond 350 m, disconnected or excessive rail paths, bus snaps, missing shapes and excessive road detours. Monte Generoso retains a disconnected segment in its candidate audit; ferry, cableway and funicular candidates have no reviewed geometry in this increment. These include Lugano lake services, Cassarate–Monte Brè, Ritom, Madonna del Sasso, Sassellina, San Salvatore, Lema, Cardada, Serpiano, Robiei, Airolo and Monte Tamaro. Verdasio–Rasa and inactive replacement routes are still inventoried. Whole cross-border rail journeys failing abroad remain excluded rather than shortened at the border.

## Official local geometry investigation

The acquired WFS advertises **314 feature types**. Its access constraint says “Richiesta formale a ccgeo@ti.ch”; its no-fee statement does not establish unrestricted service access. Neither the saved WFS, WMS nor [download catalogue](https://data.geo.ti.ch/) advertises TI-12 transport-line geometry. Related layers contain accessibility stops/areas (AC-010.1), SwissTLM rail/cable infrastructure (CH-038.1) and cable installations (TI-005.1); these are not dated bus-route alignments.

The [legal catalogue](https://www3.ti.ch/CAN/RLeggi/public/index.php/raccolta-leggi/legge/num/565) corrects the earlier national survey: **TI-12 is Rete dei trasporti pubblici; TI-11 is cantonal road axes**. TI-12 is access A with download indicated. [Official terms](https://www4.ti.ch/dt/sg/sai/ugeo/temi/geoportale-ticino/geoportale/condizioni-utilizzo) permit use, modification, redistribution and commercial use of access-A geodata with “Fonte: Amministrazione cantonale - Canton Ticino”. Distribution and vintage remain unresolved; this is not a claim that cantonal data cannot be reused.

[Full investigation and hashed evidence](../data/ticino-sources/local-geometry-review.json) records exclusions and the next acquisition request: TI-12 distribution URL, vintage, identifiers and full cross-border extent from CCgeo/UTP. No email was sent. Operator-facing sources such as [TILO](https://www.tilo.ch/de/collegamenti/RE80/), [TPL](https://www.tplsa.ch/NEW2019/) and [Arcobaleno](https://arcobaleno.ch/it/cambio-orario) are useful service-review leads; they are not substituted for acquired, licensed line geometry.

## Reproduce and validate

The [validation record](../data/ticino-audit/validation.json) records the checked source snapshot: 27 targeted tests, four desktop/iPhone browser tests, both complete-candidate audits, type checking, production build, architecture and transfer budgets passed. Lint completed with warnings. Browser checks include lazy loading, dated sharing, station search, full-day chunks, retry and attribution.

`npm run data:ticino` rebuilds from the committed extracted timetables, OSM cache/evidence and existing FOT source bundle. It checks all source hashes, source verification, exact path endpoints, full original calls, chunk identity and hashes, and payload budgets. `npm run data:ticino:check` audits both feeds against every candidate. `npm run data:ticino:docs` regenerates this report and the full route table.

To reproduce extraction from the original large sources:

`python3 scripts/prepare-ticino-sources.py --boundary-gpkg /path/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg`

`node --max-old-space-size=8192 scripts/inventory-ticino.mjs --archive /path/GTFS_FP2026_20260902.zip`

`python3 scripts/verify-aargau-source.py /path/GTFS_FP2026_20260902.zip data/ticino`

The shared Python verifier independently scans the CSV archive and reconstructs exact expected civil-day journeys, source coordinates, calls, frequency instances and shifted times. Its result is [source-verification.json](../data/ticino/source-verification.json); the retained generic verifier filename reflects its original Aargau implementation.

For OSM reproduction, use `node scripts/prepare-ticino-roads.mjs`, then `scripts/match-postbus-roads.mjs` with the recorded pfaedle binary/config, verified merged OSM extract, `--feed /tmp/ticino-road-feed --output /tmp/ticino-road-matched`, followed by `node scripts/prepare-ticino-roads.mjs --import /tmp/ticino-road-matched`. [Road source metadata](../data/ticino-sources/road-source.json) records the merged source hash and the existing border-query recipe; a new live Overpass response will not necessarily reproduce pinned bytes. Matcher inputs, outputs, warnings and run hashes are preserved in `data/ticino-road-evidence`.

The largest compressed manifest is 409 KiB; the largest two-hour chunk is 148 KiB. Artifacts load only after selection. Two September days do not establish year-round, winter, holiday or seasonal coverage. This is a validated **initial application scope**, with a complete archive-based canton inventory and explicit remaining exclusions.
