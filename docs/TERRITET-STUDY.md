# Territet–Glion: dated funicular journeys

The optional study retains **140 MVR funicular services on 4 September 2026**, with **70 departures each way**, **three stops** and all **280 scheduled segment occurrences** mapped. The service window runs from **05:04 to 23:46**. The map loads approximately **4.6 KiB gzip** only when selected.

## Timetable and motion

The exact selector is route `93-TG-j26-1`, agency `131`, route type `1400`. This retains the GTFS funicular identity and excludes the same operator’s R37 cogwheel railway. Source: Swiss GTFS `20260902`, archive SHA-256 `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`. All **420 original calls**, stop IDs, arrival/departure times and boarding/alighting flags are retained and reconciled. All flags are ordinary `0/0`; no frequency templates occur in this fixture. Preceding-day spillover and other service dates are outside this increment.

Every departure calls at Territet (funi), Collonge (funi) and Glion (funi), in its own direction. The authored opening starts at **12:04**. Default ascent **257** (`.ojp-93-TG.1.TA.16.j26`) calls at Collonge at **12:05** and reaches Glion at **12:10**. Default descent **258** (`.ojp-93-TG.1.TA.108.j26`) departs Glion at **12:04**, calls at Collonge at **12:07** and reaches Territet at **12:10**.

The 70 departure times coincide in the two directions, but their published intermediate times differ. Each vehicle follows its own timetable interpolation. This is **not a cable-mechanics simulation**, and it does not claim a physical vehicle position or passing-loop track assignment.

The journey selector offers all 70 services per direction. Departure changes pause at the source departure; station seeking follows the actual calls; arrival pauses and replay returns to the selected departure. Compact phone controls, retry, dated station links and EN/DE/FR/IT copy are included.

## Official geometry

The Federal Office of Transport layer `ch.bav.seilbahnen-bundeskonzession` identifies installation **61.046**, operator **MVR**, type **Standseilbahn**. Feature **670** supplies a **four-vertex 2D centreline**. Terminal features **3280** and **3748** identify operating points **8530673** and **8530031**. A separate bridge feature is retained in the bounded response but is not mistaken for the installation centreline.

The source response was retrieved on 8 September 2026. It provides no individual alignment date; retrieval is not a validity-date claim. The complete parsed response is pinned by SHA-256 `ff1bc767718eb91c59645473e429f8f345042344cba42e45feb09d8a9cd78e1a`. A changed response requires renewed review.

Original GTFS calls are projected onto this centreline, producing two reusable paths. Source stop coordinates and IDs remain unchanged. Attachment offsets are **2.09 m at Territet**, **3.43 m at Collonge** and **0.25 m at Glion**, each below the **15 m** gate. No station connector is invented. Changed route identities, stops, call order, collapsed paths and excessive attachments reject the build. All 280 scheduled occurrences pass the independent endpoint audit.

The published installation height difference and inclined length do not supply a railway XYZ profile. Measured terrain, passing-loop geometry and physical cable motion remain separate work.

## Operator context and connections

The [operator’s funicular page](https://www.mob.ch/en/stories/territet-glion-funicular) identifies the railway. The [2026 operator timetable](https://assets.contenthub.dev/h24dbpy2mqzk/75a4c44f69d16cd96d6a20a43e5c5c00/WEB_Horaire_2026.pdf), table **2054**, is retained as context; the exact imported calls establish this study’s date.

Glion (funi), `ch:1:sloid:30031`, and the Rochers railway’s Glion, `ch:1:sloid:1370`, remain distinct source places. The [Glion interchange audit](GLION-INTERCHANGE.md) establishes an explicit 60-second GTFS minimum in each direction and qualifying funicular connections for all 20 dated summit services. Walking geometry and a waiting guarantee are not established. Combined playback is the next implementation step.

## Reproduction and artifacts

```sh
node scripts/build-territet-study.mjs \
  --archive /path/GTFS_FP2026_20260902.zip \
  --rail-source data/territet-funicular-source.json
node scripts/build-study-summaries.mjs
npx vitest run scripts/territet.test.ts src/editions/edition.test.ts src/studies/explore.test.ts
npx playwright test e2e/territet.spec.ts --workers=1
```

Artifacts:

- `public/data/territet-day.json`: optional dated map.
- `data/territet-journey-source.json`: original dated calls and boarding flags.
- `data/territet-study-audit.json`: counts, centreline projections and all segment checks.
- `data/territet-funicular-source.json`: retained official geometry response.
- `data/territet-operator-context.json`: source URL, raw response hash and scoped operator context.

The builder supports `--output`, `--source-output` and `--audit-output`; its publication ceiling is 40 KiB gzip, with a tighter 10 KiB regression check for this compact fixture. Timetable: opentransportdata.swiss. Geometry: © Federal Office of Transport.


## Validation

Twenty focused tests pass for dated calls, paired departure times, source route identity, geometry reproduction/rejection, payload size, edition registration and discovery. Desktop Chromium and iPhone WebKit pass four Territet journey/retry checks and four Rochers terrain regressions. Final production screenshots were reviewed after adjusting the opening framing and phone card width.

The production opening remains below its limits at **357.4 KiB JavaScript**, **9.8 KiB CSS** and **764.0 KiB total gzip**. Build/type checks, targeted lint, edition-boundary validation and diff whitespace checks pass. Physical-device and published-site review remain separate.
