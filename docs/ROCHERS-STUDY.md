# Rochers-de-Naye: dated summit journeys

Choose **Montreux → Rochers-de-Naye** in Explore studies, **RDN** on the phone, or open `?study=rochers`. The optional day map includes **37 services** on **4 September 2026**. **Follow Montreux to Rochers-de-Naye** offers ten complete summit trains in each direction, with all 16 actual calls. Nine uphill and seven downhill Haut-de-Caux services, plus one Caux–Montreux service, remain on the day map.

The source window covers **05:28–23:59**. New views start at midday; explicit linked times take precedence. Changing direction or departure pauses at that train’s first departure. Station buttons seek to the actual call, arrival pauses, and replay returns to the chosen train. Actual dwells remain in place, including two minutes at Caux and the descent’s one-minute Glion dwell. Four languages, station search, retry and unavailable-date messaging are supported.

| Default journey | Departure | Arrival | Source train |
| --- | --- | --- | --- |
| Montreux → Rochers-de-Naye | 11:34 | 12:22 | 3363 |
| Rochers-de-Naye → Montreux | 12:27 | 13:24 | 3366 |

## Source identity and operating scope

Swiss GTFS **20260902**, archive SHA-256 `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`, supplies the timetable. Selection requires exact route **91-37-F-j26-1**, agency **131** (Montreux-Vevey-Riviera (mtgn)) and original regional-rail type **106**. The [operator describes this line as a cogwheel railway](https://www.mob.ch/en/stories/rochers-de-naye), which supports its visual presentation. The source route type stays 106. There are no frequency templates; all 489 retained calls have ordinary GTFS pickup/drop-off flags. No actual stop, seat or transfer is guaranteed by this representation.

The [operator’s 2026 timetable](https://support.mob.ch/hc/en-ch/articles/17789323039901-What-are-the-train-timetable) lists the line in table 121 (PDF pages 21–22). Operating notices take precedence over annual context: [the notice checked on 8 September](https://infotrafic.mob.ch/en/576) cancels rail service from 14 September at 00:35 through 17 October 2026 at 04:30, with replacement buses only as far as Haut-de-Caux. The line page also describes winter Monday/Tuesday summit restrictions. These periods are **not represented by the 4 September fixture**. Further dates, replacement buses, Territet–Glion funicular connections and measured terrain require their own audits.

## Railway geometry review

The initial generic FOT matching passed only **304 of 452 scheduled segment occurrences**. Montreux’s GTFS platform 8 resolved to the SBB station root instead of the separate MVR railway terminal. Around Glion, older FOT station-node positions were 103–240 m from the dated GTFS call coordinates.

The repair is scoped to R37 and the retained source identity. It uses the connected MVR railway from **FOT node ch14uvag00066932 / 8501353** to **ch14uvag00066490 / 8501369**, retaining the 10 m simplified source polyline. The 16-node component is committed for reproducibility. Each source call is projected onto that continuous railway and each scheduled segment is cut between its call positions. Train call order must advance monotonically along the railway in its direction. Neither GTFS stop IDs nor coordinates are changed.

All **452 occurrences now pass**, on **16 reusable paths**. Interior stop offsets are below **12 m**, with a 25 m admission limit; Glion-Collège is within 4 m. The Montreux platform has a separately reviewed **58.55 m** offset to the mapped MVR terminal, bounded at 75 m. It remains visible as an offset in the audit; the path is not extended with an invented station connection. The overall 100 m endpoint gate remains unchanged.

The oriented source polyline has 89 points and SHA-256 `586dc16562cc3ae1fa0b5754f4d3d768fd77868cb52a83078e3f466697ee577d`; changed source geometry requires renewed review. The original FOT XML hash is `2895811c6c338cdc3d32e946d2861ce58ca72ddde7d700fe9b73f2c393f7b828`. The repair retains curves from the mapped source, without claiming XYZ heights, measured terrain or audited tunnel masks. Runtime journey choices require exact dated evidence and complete finite mapped paths; short services never become summit journeys.

## Reproduction and artifacts

```sh
node scripts/build-rochers-study.mjs \
  --archive /path/GTFS_FP2026_20260902.zip \
  --rail-source /path/schienennetz_2056_de.xtf
node scripts/build-study-summaries.mjs
npx vitest run scripts/rochers.test.ts scripts/rochers-geometry.test.mjs
npx playwright test e2e/rochers.spec.ts --workers=1
```

- `public/data/rochers-day.json`: optional map, **5.8 KiB gzip**, below the 40 KiB ceiling.
- `data/rochers-journey-source.json`: exact original calls and boarding/alighting flags.
- `data/rochers-study-audit.json`: original failures, repaired endpoint checks, source identities and stop projections.
- `data/rochers-rail-source.json`: the bounded FOT MVR railway component, including source nodes and lines.
- `data/rochers-operator-context.json`: dated operator links and separation of this fixture from later closures and winter schedules.

The builder supports separate `--output`, `--source-output`, `--audit-output` and `--rail-evidence-output` destinations. Geometry identity, terminal, source-call order, endpoint and size failures prevent publication. Physical-device and published-site checks remain separate.


## Delivery checks

The production build passes its opening-page limits at **358.1 KiB JavaScript**, **9.8 KiB CSS** and **764.6 KiB total gzip**. The small national road catalogue now loads when search or the road layer needs it, preserving road discovery before the geometry response arrives. Rochers data, copy, styles and journey controls remain optional.

Twenty-two focused tests pass for exact timetable calls, journey admission, source-pinned geometry, edition registration and discovery. Desktop Chromium and iPhone WebKit pass both Rochers journey/retry scenarios, both Pilatus terrain regressions, both cantonal-road scenarios and deferred national-road search. Production screenshots were reviewed: the map uses a closer initial framing, desktop stops scroll within the card, and phone controls can collapse while the current stop and train remain visible. Build/type checks, targeted lint and architecture checks pass; the shared App retains existing React Compiler/memoization warnings.

Measured railway heights, tunnel/covered-section audits and outdoor terrain in both directions are the next scoped increment. Other operating dates and connecting funiculars remain separate.
