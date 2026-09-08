# Glion: dated funicular–summit interchange audit

The Swiss GTFS feed explicitly supports transfers between **Glion (funi)** and **Glion railway** with a **60-second minimum in each direction**. On **4 September 2026**, all **ten summit ascents and ten summit descents** have a qualifying Territet funicular connection. This audit establishes the timetable foundation for a combined Territet–Rochers-de-Naye journey; combined playback is the next implementation step.

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

## Next implementation

Add optional combined playback with separate funicular, interchange and railway phases on one dated clock. Preserve the actual arrival/departure interval at Glion and pause/replay/seek behaviour. During the interchange, show the two source places and elapsed scheduled time without animating an invented walking path. Retain the separate existing studies and expose the source minimum and operator access context where relevant to the journey. Other dates, real-time connection reliability, fares and physical access geometry require their own evidence.
