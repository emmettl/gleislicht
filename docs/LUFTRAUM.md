# GLEISLICHT — LUFTRAUM

LUFTRAUM is an optional atmospheric study above Gleislicht's national railway atlas. The railway remains the subject: trains are bright, dense and attached to enduring infrastructure. Aircraft are dimmer magenta visitors whose tracks exist only as brief afterimages.

## Historical studies

The opening study replays observed ADS-B positions over and around Switzerland from **06:45–08:45 CEST on 4 September 2026**, exactly matching the default national railway window. It contains 668 aircraft tracks and 49,655 position samples at an effective ten-second cadence. The browser fetches the 1.86 MB JSON only when **LUFT** is selected; it compresses to about 680 KiB over HTTP and does not count toward the national first-view transfer budget.

The **CH · 24H** study now covers the complete local calendar day. A 746 KB manifest (about 141 KB compressed) indexes 6,708 observed flight segments and 524,907 source samples, while 24 overlapping one-hour files carry the motion. Reused airframes are separated on callsign changes or long observation gaps, so selecting a result never invents continuity between distinct flights. The current hour loads first and its neighbours prefetch only afterwards. Individual files range from roughly 54 KB overnight to 1.4 MB at the daytime peak before HTTP compression; the browser never downloads or parses the complete 20 MB day at once. A three-minute leading overlap and 45-second look-ahead preserve trails and interpolation as the clock crosses each hour.

This is historical observation, not a schedule and not a live feed. Latitude, longitude, barometric altitude and groundspeed are decoded from the historical receiver aggregate. Heading and vertical rate are derived between adjacent samples. The client interpolates only across gaps of 45 seconds or less; longer gaps remain visibly absent rather than being bridged with invented motion.

## Visual grammar

- Aircraft are small magenta needles; trains retain their brighter category colours and structural prominence.
- Altitude is genuine but vertically compressed into the scene so climbing, descending and overflying layers are legible without dwarfing the country.
- Each aircraft leaves only its previous three minutes as a fading curve. There is no permanent air-route layer.
- Aircraft callsigns inherit the map's **vehicle labels · auto/on/off** policy. Auto is deliberately sparse, zoom reveals more, stable retention limits flashing, and collision suppression keeps labels from piling up. A selected aircraft takes priority while the whole air label layer remains dimmer and smaller than rail.
- Enabling LUFT adds it to the same service-category control as IC, IR and S-Bahn. Selecting LUFT suppresses rail labels and trails and strongly dims the infrastructure and trains; choosing a rail category applies the reciprocal treatment to aircraft.
- While LUFT is active, the shared Find box matches both the displayed callsign and the aircraft's six-character ICAO address. Search results remain keyboard navigable; selecting a track moves the clock into its observed interval and enters the same follow view as selecting its needle.
- Selecting a needle tilts and eases the camera into a follow view and shows callsign, ICAO address, altitude, groundspeed and heading.
- Releasing the selection returns control to the national map. Regional studies intentionally omit the air layer in this first experiment.

## Source, licence and filtering

The source is the [ADSB.lol historical dataset](https://www.adsb.lol/docs/open-data/historical/), release `v2026.09.04-planes-readsb-prod-0`, distributed under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The preprocessing step reads the source's compact heatmap slices; the web client never downloads the multi-gigabyte daily archive.

The first pass keeps tracks inside a generous Swiss bounding box with at least four observations. It removes ground traffic and obviously slow, low-level movement. Tracks without an airline-like callsign face a stricter speed and altitude threshold, reducing private/light-aircraft noise without claiming a perfect aircraft-type classification. Callsigns are observational identifiers and do not reliably imply origin, destination or a complete flight identity.

Regenerate the compact morning artifact from one or more extracted `heatmap/*.bin.ttf` slices:

```bash
npm run data:air -- \
  --input /path/to/09.bin.ttf \
  --input /path/to/10.bin.ttf \
  --input /path/to/11.bin.ttf \
  --input /path/to/12.bin.ttf \
  --input /path/to/13.bin.ttf \
  --service-date 2026-09-04 \
  --utc-offset 2 \
  --window-start 06:45 \
  --window-end 08:45 \
  --output public/data/swiss-air-morning.json
```

The output embeds the date, time bounds, filter description, source release, licence and sample cadence. `npm run data:validate` checks these invariants with the rest of the published data set.

For a complete local day, collect the four 30-minute slices from 22:00–24:00 UTC on the previous date and the first 44 slices from the service date in one temporary directory, then run:

```bash
npm run data:air -- \
  --input-directory /path/to/dated-heatmap-slices \
  --service-date 2026-09-04 \
  --utc-offset 2 \
  --window-start 00:00 \
  --window-end 24:00 \
  --chunk-hours 1 \
  --output public/data/swiss-air-day-manifest.json
```

The date-relative conversion deliberately handles the UTC/local-day boundary; sorting filenames chronologically is therefore required. Raw slices remain temporary build inputs and are never committed.

## Next decision gate

The remaining artistic question is whether the full-day sky remains legible during prolonged playback on real iPhones. Live observation should follow only if the historical layer continues to deepen the composition rather than obscure the railway story.
