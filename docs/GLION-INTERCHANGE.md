# Glion: dated funicular–summit interchange audit

The Swiss GTFS feed explicitly supports transfers between **Glion (funi)** and **Glion railway** with a **60-second minimum in each direction**. On **4 September 2026**, all **ten summit ascents and ten summit descents** have a qualifying Territet funicular connection. These checked pairs now support optional combined **Territet–Glion–Rochers-de-Naye playback in both directions**, available through “Continue to Rochers-de-Naye” in the Territet study.

## Source identity and transfer meaning

The pinned Swiss GTFS `20260902` archive has SHA-256 `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`. The extractor verifies the whole archive and scans all **104,322 stops** and **903,512 transfer rows**. It traverses both Glion parent/child families, retaining four stop rows and all eight transfer rows touching either family. The two direct interchange rules have no route, trip or service restriction.

| Place | Original stop ID | Parent station | DiDok |
| --- | --- | --- | --- |
| Glion (funi) | `ch:1:sloid:30031` | `Parentch:1:sloid:30031` | 8530031 |
| Glion railway | `ch:1:sloid:1370` | `Parentch:1:sloid:1370` | 8501370 |

Both direct rules have `transfer_type=2` and `min_transfer_time=60`. Under the [GTFS specification](https://gtfs.org/documentation/schedule/reference/#transferstxt), type 2 supplies a minimum scheduled interval. It is not type 1, which describes a vehicle expected to wait. Therefore the audit records **scheduled connections, without a waiting guarantee**.

The archive contains **no `pathways.txt`**. The station coordinates remain separate; their proximity is not used to invent a walking route or estimate walking speed. No transfer polyline, stair count, platform access route or wheelchair-accessible connection is established. [MOB's access information](https://support.mob.ch/hc/en-ch/articles/15555078258845-Access-information-for-our-funiculars), checked 8 September 2026, states that Territet–Glion is not accessible to wheelchair or walker users. That operator guidance is distinct from the dated timetable fixture.

## Connection selection

For each summit ascent, choose the latest Territet arrival at Glion (funi) meeting the minimum before the railway's Glion departure. For each summit descent, choose the earliest funicular departure meeting the minimum after the railway's Glion arrival. Require ordinary public pickup and drop-off at the journey endpoints and interchange. No maximum waiting time is invented, and no times are rounded.

Nine ascents have a **four-minute** interchange interval, leaving **three minutes beyond the feed minimum**. The first ascent has **thirteen minutes**, leaving twelve beyond the minimum. All ten descents have **nine minutes**, leaving eight beyond the minimum. These are the closest qualifying pairs per summit service, not an inventory of every possible earlier/later funicular pairing.

Examples from the retained source calls:

| Direction | First leg | Glion interchange | Second leg |
| --- | --- | --- | --- |
| Uphill | Territet 11:34 → Glion (funi) 11:40 | 4 minutes; minimum 1 minute | Glion railway 11:44 → Rochers-de-Naye 12:22 |
| Downhill | Rochers-de-Naye 12:27 → Glion railway 13:10 | 9 minutes; minimum 1 minute | Glion (funi) 13:19 → Territet 13:25 |

The downhill railway departs Glion at 13:11, but the traveller can alight at its **13:10 arrival**. Using departure instead would incorrectly subtract the train's dwell from the interchange interval. The audit retains both original arrival and departure values. Railway legs are sliced at Glion, excluding the Montreux section from the combined itinerary; all intermediate calls and original trip IDs remain intact. Seventeen shorter R37 workings are outside this summit audit.

## Reproduction and validation

```sh
python3 scripts/prepare-glion-transfer-source.py --archive /path/GTFS_FP2026_20260902.zip
node scripts/audit-glion-interchange.mjs
npx vitest run scripts/glion-interchange.test.mjs scripts/territet.test.ts
```

`data/glion-transfer-source.json` retains raw stop/transfer rows, whole-member hashes, archive identity and hashes of the previously reconciled Territet/Rochers journey sources. `data/glion-interchange-audit.json` retains all 20 selected pairs with exact source calls, minimum time, actual interval and spare time. Neither file is added to the initial browser payload.

Six focused interchange tests cover reproduction, uphill/downhill counts and intervals, distinct stop identities, downhill dwell, the exact 60-second boundary, restricted boarding/alighting, selection of the next qualifying departure, and rejection of changed dates, transfer precedence, minimum times, station families or pathway availability. The three Territet source/geometry regressions also pass. A changed archive must receive renewed review; the script does not silently apply this audit to another date.

## Combined playback

Each choice binds two original vehicle IDs to their checked calls and geometry. The railway portion starts or ends at Glion, excluding Montreux. A bound pair contains **15 distinct stop entries and 13 mapped vehicle segments**, with **no edge between the two Glion places**. Original boarding/alighting evidence, source date, feed hash, route identity and geometry are checked before admission. Malformed data or changed calls cannot silently become a through journey.

The shared clock moves through first vehicle, interchange and second vehicle phases. The interchange begins at the first vehicle's actual arrival and ends at the second vehicle's actual departure. A countdown and the source minimum explain the scheduled interval; the two original Glion calls remain separately seekable. Both route alignments remain visible, with no invented walking animation. Direction/departure changes pause at the chosen start; actual intermediate dwells, station seeks, arrival pause and replay are preserved. The default ascent is 11:34–12:22; the default descent is 12:27–13:25.

The combined component, source evidence and Rochers map load only when requested. A failed or mismatched map can be retried, while the separate funicular study remains available. Station inspection closes the guide and keeps the selected pair's map context; clearing the selection or exiting restores the funicular map. Shared Territet/Rochers admission modules and the existing **5.8 KiB Rochers map** load as needed. Measured terrain remains a separate opt-in. The current production view remains within budget at **359.0 KiB JavaScript, 10.0 KiB CSS and 765.6 KiB total gzip**.

Sharing records the selected railway trip ID in a scoped `glion` query parameter alongside the dated clock. For example, `?study=territet&date=2026-09-04&time=47400&glion=.ojp-91-37-F.1.TA.89.j26` opens the downhill Glion interchange at 13:10. The checked pair determines direction; an unknown matching-format trip is unavailable rather than replaced by a different departure. Unsupported dates retain the existing date-mismatch notice. Browser coordinates are excluded from shared links.

Controls, source explanations and operator access context are available in English, German, French and Italian. The phone card has compact stop navigation and expandable details. The complete terrain extension passes **26 focused tests** and **18 desktop Chromium / iPhone WebKit browser cases**, including combined map/terrain journeys and standalone funicular terrain regressions. Screenshots were reviewed for both terrain legs in both directions. Build/type checks, targeted lint, edition boundaries and bundle checks pass. Physical-device and published-site review remain separate.

## Optional measured terrain across both vehicle legs

“Follow in measured terrain” reuses the existing **94.0 KiB Territet terrain** and **69.2 KiB Rochers terrain** for all **20** checked pairs. Both requests start only after opting in; each result is cached independently within the guide. The active vehicle's own binding is passed to the existing renderer. No raster merge, coordinate transform, height adjustment or new geographical source is introduced.

The complete original funicular train must pass its dated call and explicit directional geometry checks before it can become a combined leg. The binding is identical to standalone playback: three original calls, measured XYZ, both passing-loop branches as context, conservative loop and rail/ground-discrepancy masks, a **5 m swissALTI3D grid** and the closer funicular camera. Neither loop branch receives an animated vehicle.

The complete original railway train independently passes the Rochers dated call and directional terrain checks. The binding then retains the **12 Glion–summit calls** and clips outdoor windows to their actual departure/arrival bounds. Original progress, XYZ, masks and the approximately **42 m swissALTIRegio grid** remain unchanged. The complete railway axis supplies context while the Montreux portion is excluded from the combined animation.

Only the actual active vehicle leg can publish terrain. At the first vehicle's arrival, the scene clears and the Glion interchange stays on the map until the second vehicle's departure. In the downhill itinerary, the railway's **13:10 Glion arrival**, not its 13:11 departure, starts the nine-minute interchange; the funicular terrain becomes eligible at its **13:19 departure**. The two grids are never combined or displayed as a walking connection. Both use equal horizontal and vertical scale, with their original enlarged vehicle markers and camera framing.

The shared clock continues through outdoor terrain, the funicular loop/height-discrepancy fallbacks, railway tunnels/galleries and the interchange. The active leg selects the correct elevation, grid explanation, product name, source year and methodology link in all four languages. The compact card retains the interchange countdown.

A failed or rejected terrain file affects only its own leg. The other validated terrain binding remains usable. “Retry terrain” reloads the current failed leg without refetching the successful asset or changing the clock. No terrain error replaces the interchange countdown, and the retry button is absent during the interchange. Toggling off, direction/departure changes, station seeking, replay and source-linked initial times retain their existing behaviour. Exiting or station inspection removes either scene while preserving the combined map context for inspection.

```sh
npx vitest run scripts/glion-terrain.test.ts scripts/territet-terrain.test.ts \
  scripts/glion-playback.test.ts scripts/glion-interchange.test.mjs \
  scripts/rochers-terrain.test.ts scripts/territet.test.ts --exclude '**/.claude/**'
npx playwright test e2e/glion-terrain.spec.ts e2e/glion.spec.ts \
  e2e/territet-terrain.spec.ts --workers=1
```

**26 focused tests** verify both original bindings for every pair, separate grids and camera scales, unchanged progress/heights and masks, all exact calls, no terrain during the interchange, directional authorisation and rejection of mismatched source pairs or crossed terrain artifacts. Browser validation covers both directions, live terrain-to-interchange transitions, partial failures on either leg, retry without clock movement or successful-asset refetch, malformed branches, source attribution, seeking, replay, departure selection and guide cleanup.

See [Territet terrain evidence](TERRITET-TERRAIN.md) and [Rochers terrain evidence](ROCHERS-STUDY.md) for their independent source audits. Other dates, real-time connection reliability, fares and physical access geometry remain separate work.
