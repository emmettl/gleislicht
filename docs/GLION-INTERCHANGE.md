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

The combined component, source evidence and Rochers map load only when requested. A failed or mismatched map can be retried, while the separate funicular study remains available. Station inspection closes the guide and keeps the selected pair's map context; clearing the selection or exiting restores the funicular map. Shared Territet/Rochers admission modules and the existing **5.8 KiB Rochers map** load as needed. Measured terrain remains a separate opt-in. The current production view remains within budget at **359.8 KiB JavaScript, 10.0 KiB CSS and 766.5 KiB total gzip**.

Sharing records the selected railway trip ID in a scoped `glion` query parameter alongside the dated clock. For example, `?study=territet&date=2026-09-04&time=47400&glion=.ojp-91-37-F.1.TA.89.j26` opens the downhill Glion interchange at 13:10. The checked pair determines direction; an unknown matching-format trip is unavailable rather than replaced by a different departure. Unsupported dates retain the existing date-mismatch notice. Browser coordinates are excluded from shared links.

Controls, source explanations and operator access context are available in English, German, French and Italian. The phone card has compact stop navigation and expandable details. The terrain extension passes **20 focused tests** covering source reconciliation, connection and terrain binding, route slicing, boundary timing, rejection and shared links. **Twelve combined browser cases** cover desktop Chromium and iPhone WebKit map/terrain playback, retry, shared links, language changes and station inspection; the four existing Territet browser cases passed during map delivery. Build/type checks, targeted lint, edition boundaries and bundle checks pass. Physical-device and published-site review remain separate.

## Optional measured terrain on the railway leg

“Follow in measured terrain” reuses the existing **69.2 KiB Rochers terrain artifact** for all ten ascents and ten descents. It first validates the complete original R37 train through the existing Rochers admission and terrain checks, including explicit forward/reverse trip lists. It then keeps only the **12 actual railway calls between Glion and the summit**, clipping outdoor playback windows to that leg's departure and arrival.

The original railway progress values, XYZ points, terrain grid and conservative tunnel/gallery masks remain unchanged. Progress is not renormalised to the shorter journey; this preserves exactly the standalone railway heights and mask timing. The complete surveyed axis remains available as geographic context, but the train never follows the Montreux section in a combined journey. The approximately 42 m swissALTIRegio landscape uses equal horizontal and vertical scale; railway elevation is reported in LN02 with the retained swisstopo attribution.

The funicular and Glion interchange have no terrain positions or outdoor windows. Uphill, terrain can start only after the Glion railway departure and outside a masked structure. Downhill, it stops by Glion's **13:10 arrival** for the default pair, even though the railway's original departure remains 13:11. The nine-minute interchange and 13:19 funicular departure continue on the map. Masked railway sections also return to the map while the shared clock keeps running.

Terrain can be enabled during any valid journey phase. Toggle-off, retries and data rejection retain the current clock; direction/departure changes, seeks and replay retain their existing behaviour. A successful download is reused across both directions within the guide. Unknown downhill authorisation, invalid terrain metadata or a broken grid retain map playback. Exiting the guide or inspecting a station removes the terrain scene. The compact card retains terrain evidence and the interchange countdown without covering the vehicle.

```sh
npx vitest run scripts/glion-terrain.test.ts scripts/glion-playback.test.ts scripts/glion-interchange.test.mjs scripts/rochers-terrain.test.ts scripts/territet.test.ts
npx playwright test e2e/glion-terrain.spec.ts e2e/glion.spec.ts --workers=1
```

No new geographical source or terrain geometry is introduced by this extension. See [Rochers terrain evidence](ROCHERS-STUDY.md) for the original source audit. Measured funicular terrain, other dates, real-time connection reliability, fares and physical access geometry remain separate work.
