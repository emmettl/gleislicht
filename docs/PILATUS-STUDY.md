# Pilatus: dated cogwheel journeys

Choose **Alpnachstad → Pilatus Kulm** in **Explore studies**, select **PIL** on the phone, or open `?study=pilatus`. **Follow the Pilatus railway** offers both directions. Direction and departure changes pause at the selected departure; station buttons seek to actual calls, arrival pauses, and replay returns to the same train. Manual selection exits the journey. Controls and source notes are available in English, German, French and Italian. New views open at midday unless the link specifies a time. During a selected journey, the map retains its close overview and displays the chosen train on the complete railway; it does not use the national-distance follow camera.

## Timetable and scope

The fixture retains the complete original service day of **4 September 2026**, from Swiss GTFS **20260902**, archive SHA-256 `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`. It requires exact route **93-R83-j26-1**, agency **136**, cogwheel type **116**, operator **Pilatusbahnen**. It contains **34 trains**, **17 in each direction**, **three stops** and **two mapped paths**, spanning **08:10–18:37**. There are no frequency templates. The existing national timetable already contained these trains; this increment adds dedicated discovery, framing, source reconciliation and playable journeys.

| Default journey | Departure | Intermediate call | Arrival |
| --- | --- | --- | --- |
| Train 19, Alpnachstad PB → Pilatus Kulm | 12:15 | Aemsigen 12:25 | 12:42 |
| Train 18, Pilatus Kulm → Alpnachstad PB | 12:14 | Aemsigen 12:25 | 12:47 |

All retained calls have identical arrival/departure times and ordinary GTFS pickup/drop-off flags. The [operator timetable](https://pilatus.ch/en/railway-cableways/timetable), checked on 8 September 2026, separately describes **Ämsigen as a request stop**, with boarding dependent on space and driver instructions. The GTFS spelling **Aemsigen**, source identifiers and flags remain unchanged. The journey card explicitly labels the request stop and explains the qualification. Timetable interpolation through that call does not establish an actual stop, seat availability or a passenger booking.

The operator lists a cogwheel season of 11 May–29 November 2026. That context does not establish service on other dates in this single-day fixture. Cableways from Kriens, boat and connecting rail journeys, preceding-day spillover and guaranteed transfers require separate audits.

## Geometry and source gates

The FOT railway network supplies every one of the **68 scheduled segment occurrences**. Plan paths are simplified at **10 m**. Each directed pair is checked in both path orientations, allowing at most **100 m** between the mapped endpoints and source stop coordinates; the largest measured offset is **38.64 m** on the summit segment. This is an identity/matching gate, not an engineering accuracy claim.

The default composition is **2D** and interpolates motion between dated source calls on the mapped railway. The separately requested measured terrain view described below now supplies railway heights, conservative structure masks and an outdoor landscape. Its enlarged marker does not claim a physical cogwheel vehicle model.

Runtime requires the matching date, feed and archive identity, exact operator/route/type, reconciled stop IDs and arrival/departure times, chronological calls, public endpoint pickup/drop-off, complete finite paths and unique train identities. Changed or incomplete evidence removes affected journey choices. Failed map requests expose retry; dated station links and unavailable-date messaging use the normal study controls.

## Reproduction

```sh
node scripts/build-pilatus-study.mjs \
  --archive /path/GTFS_FP2026_20260902.zip \
  --rail-source /path/schienennetz_2056_de.xtf \
  --date 2026-09-04
node scripts/build-study-summaries.mjs
npx vitest run scripts/pilatus.test.ts scripts/pilatus-geometry.test.mjs
npx vitest run src/test/journeys.dom.test.tsx -t pilatus
npx playwright test e2e/terrain-smoke.spec.ts -g pilatus --workers=1
```

Artifacts:

- `public/data/pilatus-day.json`: optional whole-day map, **2.1 KiB gzip**, with a 40 KiB ceiling.
- `data/pilatus-journey-source.json`: original GTFS calls and boarding/alighting flags, loaded with the optional journey component.
- `data/pilatus-study-audit.json`: source hashes, counts and directed-pair geometry checks.
- `data/pilatus-operator-context.json`: dated operator context and the distinction between GTFS flags and the request-stop qualification.

The builder writes the audit before rejecting a geometry or payload failure and supports separate candidate outputs. Desktop Chromium and iPhone WebKit checks cover deferred loading, discovery, both directions, station seeks, request-stop wording, arrival pause, replay, search, request retry and dated links. Physical-device and published-site checks remain separate.

Validation on 8 September 2026: all 30 focused Pilatus, catalogue and Gornergrat unit checks passed. Pilatus and Gornergrat descent browser checks passed on desktop Chromium and iPhone WebKit. The isolated Pilatus production build passes type checking and the opening-transfer budget (359.3 KiB JavaScript against 360 KiB); unrelated edits in the shared working tree are excluded from that budget result. Lint and the public-package architecture check also pass.

## Optional measured terrain in both directions

**Follow in measured terrain** retains the chosen departure and clock. The audited outdoor railway uses the shared measured-landscape renderer; tunnels and covered sections continue on the 2D map without changing playback state. Direction changes seek to the actual new departure while retaining the terrain preference. At the summit, the descent starts in a covered station range and moves outdoors after that range. Arrival pauses, replay, source-call seeking, source-date rejection, download failure and retry remain available. A compact card leaves the landscape visible; **Journey details** reopens direction, departure and stop controls. Ämsigen’s request-stop qualification remains in those details.

The audit independently maps **all 34 source trips**, with **299 railway samples** over approximately **4,566 m** of three-dimensional line. Each downhill sample matches the reversed uphill XYZ coordinate, source feature and structure classification, with a maximum measured reverse difference of **0 m**. All three source stop positions are checked in each direction. The artifact explicitly lists all 17 forward and all 17 reverse trip IDs; unlisted trips cannot use terrain.

Rail heights come from the pinned **swissTLM3D 2026-02** railway extract, in **LV95 / LN02**. Only active narrow-gauge cogwheel axes are eligible. The matched source records have provenance years **2021 and 2024**. The 46 matched feature IDs come from a complete 94-feature bounded extract; its feature digest is pinned to `db8580ab62567223558b75ffb9032f02c4ab03eda7fe5cca85534131bed65f02`. Removing tunnel records can otherwise expose nearby outdoor axes, so altered source extracts fail before nearest-axis matching and require renewed review. FOT plan positions remain unchanged; rail heights are interpolated on the nearest eligible source axis, with maximum horizontal offset **12.51 m**. This is a mapped visualisation, not a surveyed reconstruction of train positions.

Four conservative masks cover three tunnel ranges and the covered summit station, including approach margins. Together they cover **21.31%** of the mapped 3D route length; that fraction is not a claim about physical tunnel length. Uncertain offsets above 25 m would also stay on the map. Mapped rail heights at the retained endpoints are about **439 m** and **2,060 m LN02**; these describe sampled railway coordinates, not advertised visitor or mountain-summit elevations.

The surrounding **7.0 × 7.9 km** landscape uses **swissALTIRegio 2026-05-28**, sampled from its native 10 m raster to a **193 × 218** grid (approximately **36.4 m**). Horizontal and vertical scales are equal. The optional artifact is **62.2 KiB gzip**, below its 120 KiB limit. Railway-source, network, terrain-asset and raster hashes are retained in the audit. Buildings, vegetation and photorealistic textures are not part of this view; covered structures are deliberately represented by map transitions.

Sources: [swissTLM3D](https://www.swisstopo.admin.ch/en/landscape-model-swisstlm3d), [swissALTIRegio and source attribution](https://www.swisstopo.admin.ch/en/height-model-swissaltiregio). The bounded landscape lies in Switzerland and derives from swisstopo elevation data.

```sh
python3 scripts/prepare-jungfrau-terrain-source.py \
  --cache /path/to/pinned-railway-cache \
  --bounds 2660000 1199500 2665000 1205000 \
  --output data/pilatus-terrain-source.json
node scripts/ingest-pilatus-terrain.mjs
npx vitest run scripts/pilatus-terrain.test.ts scripts/pilatus-terrain-geometry.test.mjs
npx vitest run src/test/journeys.dom.test.tsx -t pilatus
npx playwright test e2e/terrain-smoke.spec.ts -g pilatus --workers=1
```

New evidence is in `data/pilatus-terrain-source.json` and `data/pilatus-terrain-audit.json`; the requested runtime artifact is `public/data/pilatus-ascent-terrain.json` (shared by both directions). Further dates, Kriens cableways and boat connections remain separate work.

Terrain validation on 8 September 2026: 19 focused unit tests passed across Pilatus source geometry/binding and the existing Jungfrau/Gornergrat terrain bindings. Eight desktop Chromium/iPhone WebKit cases passed for Pilatus terrain and map workflows, including playback across tunnel boundaries, covered summit departure, map toggle without time loss, actual-call seeking, descent reversal, arrival pause, replay, unavailable or unaudited terrain, and retry. Screenshots were visually reviewed. The isolated production build, lint, architecture and whitespace checks pass; opening transfer remains within budget at 359.4 KiB JavaScript and 765.9 KiB total gzip. Physical devices and the published site have not been checked for this increment.
