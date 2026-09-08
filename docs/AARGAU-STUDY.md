# Aargau regional transit: canton inventory and geometry audit

Completed **8 September 2026** from the [national source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#ag). This delivers a reproducible **canton-wide timetable inventory**, an AGIS line adapter, and Friday/Sunday regional audit feeds. It is an offline data deliverable; application study selection, live refresh and deployment are separate work.

**All 5,142 national route records and 34,499,152 stop-time rows were inspected.** The archived timetable contains **289 Aargau-calling route records across 23 agency identities**. Of these, **232 operate in at least one selected civil-day fixture** and **57 are inactive on both**. The other **4,853 national route records** have no Aargau call in the archive. These are GTFS records, not counts of unique public line numbers or legal companies.

The final feed retains **11,193 Friday journeys and 7,767 Sunday journeys**, with complete source stop chains. Accepted geometry covers **92.15% / 88.76%** of all retained segment occurrences, and **96.24% / 92.80%** of occurrences with at least one stop inside Aargau. **Geometry remains incomplete**, particularly for night routes, railway replacements, some operator/line identities and continuations outside the source's extent.

## Deliverables

| Artifact | Contents |
| --- | --- |
| [Full route inventory](../data/aargau/inventory.json) | All 5,142 routes with membership/admission reasons, source identities, archived Aargau calls and daily eligibility; complete national agency lookup |
| [Friday audit](../fixtures/aargau/2026-09-04/audit.json) / [Sunday audit](../fixtures/aargau/2026-09-06/audit.json) | Every directed pattern and pair, accepted/failed occurrences, source feature/part/orientation, snap distances, monotone progress, source dates, geometry exclusions and all 366 GIS records |
| [Friday regional feed](../fixtures/aargau/2026-09-04/aargau-region-day-manifest.json) / [Sunday regional feed](../fixtures/aargau/2026-09-06/aargau-region-day-manifest.json) | Manifest with stops, shared paths and twelve hashed two-hour movement chunks per date |
| [Friday morning](../fixtures/aargau/2026-09-04/aargau-region-morning.json) / [Sunday morning](../fixtures/aargau/2026-09-06/aargau-region-morning.json) | Self-contained 06:45–08:45 extracts, focus 07:45 |
| [Source catalogue](../data/aargau-sources/sources.json) | Raw archive, supplied terms/metadata, decoded geometry, unsimplified canton boundary and hashes |
| [Explicit crosswalk](../data/aargau-line-crosswalk.json) | Six narrowly scoped operator/line mappings with source/GTFS evidence |
| [Independent source verification](../data/aargau/source-verification.json) | Separate Python CSV/zip scan: exact expected journey sets, source coordinates, calls, rules and shifted times |
| [Friday extracted timetable](../data/aargau/2026-09-04-timetable.json.gz) / [Sunday extracted timetable](../data/aargau/2026-09-06-timetable.json.gz) | Hash-bound compressed source fixtures for rebuilding geometry without rereading the large national archive |

The feed uses the existing network snapshot/chunk format. Every train has its exact GTFS route, source trip/date, direction ID, ordered calls and per-segment path references. **A null path is an unresolved geometry segment**; a consumer may display straight stop interpolation, but must not describe it as an admitted alignment. No missing-geometry journey is removed. Static shared edges get a path only when all occurrences agree on one geometry; train paths preserve direction and pattern identity.

## Canton and border scope

Membership uses the full **swissBOUNDARIES3D 2026-01 Aargau polygon, canton number 19**, including holes and separate parts. No rectangle or operator whitelist defines membership. There are **4,793 GTFS stop records** inside the polygon, including parent/platform records; only actual stop-time calls establish route membership. Every archived trip is inspected, regardless of its operating season.

A daily journey is admitted when it intersects the selected civil day and itself calls inside the canton. Its **entire stop chain** is retained, including domestic/foreign termini and intermediate calls outside Aargau. A route having one Aargau trip does not admit all that route's unrelated trips. Long SBB journeys can therefore extend well beyond the source geometry. Non-stopping through traffic and services absent from this national GTFS are outside the timetable denominator; the separate complete AGIS record inventory exposes additional source-only leads. No claim is made to census private, unscheduled or unrepresented flexible transport.

All seven requested review areas have active anchor calls on both dates. These checks verify geographical presence, not comprehensive subregional geometry or exact tariff boundaries.

| Review area | Anchor | Friday journeys calling | Sunday journeys calling |
| --- | --- | ---: | ---: |
| Aarau | Aarau | 1,803 | 1,577 |
| Baden/Wettingen | Baden | 2,249 | 1,862 |
| Brugg | Brugg AG | 1,293 | 938 |
| Lenzburg | Lenzburg | 1,005 | 774 |
| Freiamt | Muri AG | 330 | 216 |
| Fricktal | Frick | 511 | 340 |
| Zurzibiet | Koblenz | 175 | 120 |

Cross-canton bus continuations, Kaiserstuhl services, the Rheinfelden DE/CH bus and Hallwilersee services remain in scope. AAGL 72 is retained by actual Aargau calls even though much of its itinerary is outside AG. Other AGIS records with no matching Aargau-calling GTFS identity remain in the source exclusion inventory.

## Dates and calendar semantics

Both fixtures use pinned **GTFS 20260902**, valid **14 December 2025–12 December 2026**. Friday is **4 September 2026**; Sunday is **6 September 2026**. Calendar exceptions are applied independently for the selected and preceding service dates: **3–6 September** in total.

The selection window is **civil [00:00, 24:00)**. Entire intersecting journeys are preserved, including calls before midnight and after 24:00. Friday contains **290** preceding-service-day journeys; Sunday contains **518**. Source dates qualify journey IDs to prevent duplicate source-trip identities across calendars. GTFS times above 24:00 are not discarded. Coverage counts *all adjacent calls in the retained complete journeys*, including portions outside the civil window; it is not a count of positions or segment movements clipped to midnight.

The independent verifier recounted **184,299 Friday calls** and **129,240 Sunday calls**, and checked that no expected journey was omitted and no extra journey was introduced. Source names, full platform precision, arrival/departure times, headsigns, direction and boarding restrictions are preserved. There are **no frequency templates** in these real regional fixtures. The importer nevertheless expands interval-anchored frequencies, retains `exact_times`, and labels headway instances; the synthetic calendar test exercises this behaviour. Invalid/missing fixed stop times are enumerated as exclusions rather than invented; neither fixture contains such exclusions.

Sunday contains **171 night journeys, 40 route records and 101 directed patterns**, brought in from Saturday's calendar. Their **3,508 segment occurrences have zero admitted AGIS geometry** under exact night-line identity. They remain visible in the timetable, failed-pattern inventory and coverage denominator. Daytime line geometry is not automatically relabelled as a night line. There are no N/SN or type-705 night journeys in the Friday civil-day fixture. Two September dates do not establish winter, summer-only, holiday or year-round completeness; the 57 inactive archived route records are retained for further dated validation.

## Measured coverage

A directed pattern is **route ID + GTFS direction ID + complete ordered platform-ID chain**. Loops retain repeated platform visits. A directed pair is **route ID + from-platform + to-platform**; it is counted as fully matched only if every occurrence across all patterns matches.

| Measure | Friday | Sunday |
| --- | ---: | ---: |
| Retained journeys | 11,193 | 7,767 |
| Active GTFS route records | 178 | 191 |
| Active agency identities | 21 | 20 |
| Platforms | 3,881 | 3,885 |
| Directed complete stop patterns | 1,477 | 1,080 |
| Patterns with every segment matched | 1,076 | 702 |
| Distinct directed route/platform pairs | 6,932 | 7,456 |
| Pairs matched on every occurrence | 5,893 | 5,175 |
| Scheduled segment occurrences | 173,106 | 121,473 |
| Accepted geometry occurrences | 159,523 | 107,815 |
| Full-journey occurrence coverage | 92.15% | 88.76% |
| Occurrence coverage touching an Aargau stop | 96.24% | 92.80% |

The operator table inventories all 23 agency identities that call in Aargau somewhere in the archive. Coverage is measured over complete retained journeys, including outside-canton portions. A dash means no eligible journey on that date, not that the operator lacks geometry year-round.

| Source operator / agency ID | Mode | Archived canton routes | Friday trips | Sunday trips | Friday geometry | Sunday geometry |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Aargau Verkehr AG (`723`) | bus | 14 | 718 | 556 | 96.14% | 89.10% |
| Busbetrieb Olten-Gösgen-Gäu (`793`) | bus | 1 | 147 | 143 | 54.72% | 55.61% |
| PostAuto AG (`801`) | bus | 105 | 4,793 | 2,555 | 93.23% | 90.34% |
| Autobus AG Liestal (`811`) | bus | 2 | 174 | 146 | 69.74% | 68.58% |
| Auto AG Rothenburg (`812`) | bus | 2 | 39 | 41 | 100.00% | 94.79% |
| Zugerland Verkehrsbetriebe (`839`) | bus | 4 | 96 | 55 | 99.07% | 73.82% |
| Busbetrieb Aarau (`840`) | bus | 11 | 947 | 846 | 99.05% | 94.34% |
| Verkehrsbetriebe Zürich (`849`) | bus | 2 | 84 | 71 | 92.54% | 100.00% |
| Regionalbus Lenzburg (`873`) | bus | 15 | 555 | 327 | 93.26% | 86.26% |
| Regionale Verkehrsbetriebe Baden-Wettingen (`886`) | bus | 18 | 1,475 | 1,069 | 97.98% | 94.68% |
| Aargau Verkehr AG (`899`) | bus | 5 | 137 | 82 | 71.92% | 88.17% |
| SBB Infrastruktur AG Bahnersatz (`7231`) | bus | 21 | 5 | 22 | 0.00% | 0.00% |
| Aargau Verkehr AG Ersatzverkehr (`7244`) | bus | 4 | 5 | 0 | 0.00% | — |
| Südbadenbus (`sbg034`) | bus | 1 | 52 | 20 | 43.06% | 41.67% |
| Hallwilersee (`181`) | ferry | 3 | 10 | 17 | 66.04% | 38.46% |
| Basler Personenschifffahrt AG (`191`) | ferry | 1 | 0 | 0 | — | — |
| Schweizerische Bundesbahnen SBB (`11`) | rail | 69 | 1,281 | 1,270 | 76.77% | 77.63% |
| Aargau Verkehr AG (`31`) | rail | 1 | 163 | 121 | 100.00% | 100.00% |
| THURBO (`65`) | rail | 2 | 37 | 36 | 0.00% | 0.00% |
| Oensingen-Balsthal-Bahn (`68`) | rail | 2 | 0 | 0 | — | — |
| Schweizerische Südostbahn (sob) (`82`) | rail | 4 | 2 | 1 | 0.00% | 0.00% |
| Aargau Verkehr AG (`96`) | rail | 1 | 313 | 229 | 100.00% | 100.00% |
| Aargau Verkehr AG (`41`) | tram | 1 | 160 | 160 | 100.00% | 100.00% |

AVA **S14 (96), S17 (31)** and **tram 20 (41)** have all retained segment occurrences matched on both dates. This is automated ordered-path coverage, not certification of particular running tracks. SBB coverage is lower over complete long-distance journeys than near Aargau stops. The separate **THURBO 65** and **SOB 82** identities are retained with unresolved geometry; the source's SBB-labelled line alone is not treated as blanket permission to join another operator.

## Adapter and admission rules

[`prepare-aargau-sources.py`](../scripts/prepare-aargau-sources.py) decodes the Shapefile/DBF with Python's standard library. It verifies format, record length/count, LV95 coordinate range and line identity, preserves multipart boundaries and every DBF property, and transforms LV95 to longitude/latitude using the metre-level swisstopo approximate polynomial. Coordinates are rounded to seven decimal places; source geometry and the membership boundary are unsimplified. The raw archive and original canton GeoPackage geometry are preserved for inspection. The canton is extracted by its official number, not by a hand-drawn boundary.

[`aargau-line-geometry.mjs`](../scripts/aargau-line-geometry.mjs) indexes **GO_NR + mode + exact line label**. Direct identity is the default. The explicit crosswalk handles AVA S17's source code 96 versus timetable agency 31; three ZVV-publisher records for PostAuto 205/215/245; and Südbadenbus 7312a/b versus agency `sbg034`, line 7312. Source itinerary, actual agency and matching ordered stops constrain each mapping. No operator-wide alias is introduced.

Each complete directed GTFS pattern selects **one AGIS feature part and one coordinate orientation**. The adapter never stitches disconnected parts, combines opposite-direction records or routes through an unrestricted road graph. Source `RICHTUNG` is preserved. It denotes direction in timetable fields and is **not assumed to equal GTFS `direction_id` or polyline coordinate order**.

- Project stops to local distance minima along the source part, at most **120 m** away. Full-chain dynamic programming chooses a consistent nondecreasing progress sequence, maximizing valid adjacent movements and then minimizing projection gaps.
- A missing or incompatible projection stays explicit. Progress is retained across an unmatched stop; the matcher never invents a direct movement across it. Only its genuinely adjacent, individually valid pairs can receive paths. This preserves usable sections of partial source alignments without claiming the whole pattern passes.
- Exactly closed source parts can start at an arbitrary digitising vertex. They are unrolled once and limited to **one lap**, so a rotated complete loop can match while extra circuits cannot be invented.
- Accept a segment only when source length is at least **1 m**, is not collapsed relative to the direct stop distance, and is at most **max(1,200 m, 4.5 × direct distance)**. Report every accepted endpoint gap and source length.
- Slice the source polyline between projected calls, retain exact GTFS endpoints, and simplify the interior by at most **5 m** for the exported feed. Endpoint connector sections remain explicit. Coverage checks use the original unsimplified source length.

`pattern-order-gap`, `endpoint-gap`, `collapsed-path`, `implausible-detour` and `missing-operator-mode-line` remain machine-readable rejection reasons. Each pattern records its feature, part, orientation and stop progress. These checks validate directed **stop order** and a bounded inferred alignment; they do not independently certify lanes, one-way permissions, bridges, stacked tracks or temporary diversions. Those reviews remain a release prerequisite.

## Source admission and exclusions

All **366 GIS records** are accounted for: **313 bus, 46 rail, 2 tram and 5 boat**. Records are not unique line counts; some repeat directions, branches or parts.

| Source-record result | Friday | Sunday |
| --- | ---: | ---: |
| `excluded-no-canton-route-for-source-identity` | 15 | 15 |
| `excluded-no-exact-identity-crosswalk` | 5 | 5 |
| `geometry-admitted` | 259 | 201 |
| `unused-inactive-or-pattern-mismatch` | 87 | 145 |

`excluded-no-canton-route-for-source-identity` means the exact identity lacks an archived Aargau-calling route; it does **not** prove the geometry lies outside the canton. In particular, AGIS labels 444/445 as PostAuto while the regional GTFS uses AVA agency 899. Those mismatches are explicitly deferred, with full timetable journeys retained. The five records without an exact crosswalk include boat labels **3651.1/6551.1**, DB **IRE3**, and SBB **S18**. The full record table preserves itinerary, timetable field, GO name/code and source direction for review.

Other material gaps include **PostAuto 510/515 into Kaiserstuhl**, AGIS-unmatched night identities, rail-replacement agencies **7231/7244**, Hallwilersee line labels beyond the exact 3651 join, and local/full-route branches extending beyond the selected source part. Paths are not borrowed from another operator merely because roads or tracks overlap. Normal-line failures may also reflect dated stop or diversion differences; a source timestamp alone does not resolve them.

## Source dates, hashes and attribution

**Timetable:** [official 2026 GTFS dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020), [pinned 20260902 archive](https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip). SHA-256 `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`. Credit **opentransportdata.swiss**; retain its [terms](https://opentransportdata.swiss/en/terms-of-use/), raw-data refresh obligations and distinction between publisher data and Gleislicht's processed audit. No realtime observation is included.

**Lines:** [AGIS.avk_oevlinien download](https://api.geo.ag.ch/v1/data/downloads/AGIS.avk_oevlinien/download/Shapefile/kanton_aargau), [official metadata](https://www.ag.ch/geoportal/geodatenshop/Datendokumentation.aspx?Datensatzelement=6224). The pinned archive SHA-256 is `152ba4bf1848962257d26ca1567f72d014f7fbd17677994eb9b308221354215d`. The actual geometry date in the filename and supplied metadata is **23 April 2026**; retrieval and metadata-document generation are **8 September 2026**. The September HTTP date is not a new geometry vintage. Metadata describes **normal timetable alignments and excludes temporary diversions**. The supplied PDFs and separately probed PDFs are both retained with their distinct hashes.

Required line credit: **Daten des Kantons Aargau**. Supplied terms are dated **August 2024**; they describe generally free use with source credit, not CC0. Preserve the [supplied terms](../data/aargau-sources/supplied-terms.pdf) and [metadata](../data/aargau-sources/supplied-metadata.pdf) with derived distributions. The source API limit is **20 requests/minute**, WMS **10/minute**. Rebuilding from the pinned bytes makes no AGIS requests.

**Membership boundary:** [swissBOUNDARIES3D January 2026 archive](https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip), credit **© swisstopo**. The source catalogue retains the full GeoPackage hash, extracted canton record UUID/modification date, raw geometry hash and transformed boundary hash. The full national GeoPackage and large GTFS ZIP are not duplicated in Git; the pinned regional source extracts and AGIS ZIP are stored here.

## Verification and reproduction

Twelve focused tests pass, covering operator/mode isolation, exact mappings, both coordinate orientations, repeated stops, arbitrary-start closed loops, one-lap limits, multipart separation, missing-stop progress, detours, exact endpoints, polygon holes/exclaves, full border chains, prior-day carry-in, calendar exceptions and illustrative frequency expansion. Offline checks independently reconcile every delivered pattern/pair/route count, monotone progress, source identity, chunk hash, trip set and path endpoint. A separate Python scan of the original archive validates the extracted timetable, using different CSV and calendar code.

Both dates fit the existing regional payload budgets after 5 m interior simplification:

| Gzip payload | Friday | Sunday | Existing budget |
| --- | ---: | ---: | ---: |
| Manifest | 343.0 KiB | 318.7 KiB | 650 KiB |
| Morning extract | 540.8 KiB | 430.7 KiB | 1,600 KiB |
| Largest two-hour chunk | 196.7 KiB | 125.9 KiB | 450 KiB |

Run from the repository root with Node 24+ (measured here on **26.8.1**), Python 3 and `unzip`; the synthetic integration test also uses `zip`. There are no new runtime dependencies or live-service credentials.

```sh
# Offline checks of the shipped sources, input fixtures, audits and feeds.
node scripts/check-aargau-study.mjs
npx vitest run scripts/aargau-line-geometry.test.mjs scripts/inventory-aargau.test.mjs

# Rebuild either date from the preserved extracted timetable and AGIS bytes.
node scripts/build-aargau-study.mjs \
  --sources data/aargau-sources --inventory data/aargau \
  --crosswalk data/aargau-line-crosswalk.json \
  --date 2026-09-04 --output /tmp/aargau-friday
# Repeat with --date 2026-09-06 and --output /tmp/aargau-sunday.

# Recreate the canton membership and source fixtures from the full pinned archive.
node --max-old-space-size=8192 scripts/inventory-aargau.mjs \
  --archive /path/GTFS_FP2026_20260902.zip --sources data/aargau-sources \
  --dates 2026-09-04,2026-09-06 --output /tmp/aargau-input
python3 scripts/verify-aargau-source.py /path/GTFS_FP2026_20260902.zip /tmp/aargau-input
# Pass --inventory /tmp/aargau-input to the geometry builder after verification.

# Re-decode the source archive and official canton geometry if necessary.
python3 scripts/prepare-aargau-sources.py \
  --lines data/aargau-sources/agis-lines-20260423.zip \
  --boundary-gpkg /path/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg \
  --output data/aargau-sources
```

The source preparer deliberately rejects an AGIS archive differing from the survey's pinned hash. A refresh requires a newly reviewed catalogue/vintage and regeneration of dependent inventory/audit hashes; a mutable download URL must not silently replace this evidence. `publicationReady` remains false because the audit documents unresolved geometry and directional/seasonal review, despite complete timetable preservation and passing consistency/payload checks.
