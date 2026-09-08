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

The composition is explicitly **2D**. It interpolates motion between dated source calls on the mapped railway. This increment does not establish rail XYZ heights, tunnel/covered-section masks, measured landscape or a physical cogwheel vehicle model. Those must be independently audited before adding terrain following.

Runtime requires the matching date, feed and archive identity, exact operator/route/type, reconciled stop IDs and arrival/departure times, chronological calls, public endpoint pickup/drop-off, complete finite paths and unique train identities. Changed or incomplete evidence removes affected journey choices. Failed map requests expose retry; dated station links and unavailable-date messaging use the normal study controls.

## Reproduction

```sh
node scripts/build-pilatus-study.mjs \
  --archive /path/GTFS_FP2026_20260902.zip \
  --rail-source /path/schienennetz_2056_de.xtf \
  --date 2026-09-04
node scripts/build-study-summaries.mjs
npx vitest run scripts/pilatus.test.ts scripts/pilatus-geometry.test.mjs
npx playwright test e2e/pilatus.spec.ts --workers=1
```

Artifacts:

- `public/data/pilatus-day.json`: optional whole-day map, **2.1 KiB gzip**, with a 40 KiB ceiling.
- `data/pilatus-journey-source.json`: original GTFS calls and boarding/alighting flags, loaded with the optional journey component.
- `data/pilatus-study-audit.json`: source hashes, counts and directed-pair geometry checks.
- `data/pilatus-operator-context.json`: dated operator context and the distinction between GTFS flags and the request-stop qualification.

The builder writes the audit before rejecting a geometry or payload failure and supports separate candidate outputs. Desktop Chromium and iPhone WebKit checks cover deferred loading, discovery, both directions, station seeks, request-stop wording, arrival pause, replay, search, request retry and dated links. Physical-device and published-site checks remain separate.

Validation on 8 September 2026: all 30 focused Pilatus, catalogue and Gornergrat unit checks passed. Pilatus and Gornergrat descent browser checks passed on desktop Chromium and iPhone WebKit. The isolated Pilatus production build passes type checking and the opening-transfer budget (359.3 KiB JavaScript against 360 KiB); unrelated edits in the shared working tree are excluded from that budget result. Lint and the public-package architecture check also pass.
