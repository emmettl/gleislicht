# Rigi: two measured railway ascents

Select **RIGI**, then climb from **Vitznau** or **Arth-Goldau**, or enter from a complete uphill cogwheel service. The measured-journey selector includes both approaches, labelled with source lines **82** and **81**. A compact, stylised cogwheel train follows each mapped railway. Ground elevation and rise from the selected valley station replace the generic speed and estimated-next-stop metrics; the elevation profile follows the scrubber. Controls and disclosures are available in EN / DE / FR / IT.

## Evidence and interpretation

Both routes retain FOT railway alignments and Rigi Bahnen runs on **4 September 2026** from GTFS **20260902**. Ground samples are at no more than 20 m spacing.

| Approach | Distance | Ground samples | Stops | Representative run | Scheduled interval | Ground at origin → terminal |
| --- | --- | --- | --- | --- | --- | --- |
| Vitznau | 6,829 m | 362 | 9 | 82 / 1127 | 12:15–12:47 | 436.4 → 1,748.0 m |
| Arth-Goldau RB | 8,496 m | 447 | 8 | 81 / 139 | 11:55–12:34 | 509.5 → 1,748.0 m |

The Arth-Goldau approach passes Goldau A4, Kräbel, Fruttli, Rigi Klösterli and Rigi Wölfertschen-First. Both approaches call at **Rigi Staffel** and **Rigi Kulm**. Selecting another complete uphill run preserves that run's scheduled stop times; switching approaches uses the destination approach's representative run instead of carrying across an unrelated timetable. Partial and downhill runs do not offer these ascents. Entry starts near the selected valley station; the animation is a scenic traversal, independent of the map clock and timetable dwell times. **Arth-Goldau RB** retains its source stop identity; no interchange time from the mainline station is invented.

The [swisstopo swissALTIRegio product](https://www.swisstopo.admin.ch/en/height-model-swissaltiregio), release **28 May 2026**, supplies the native **10 m** ground raster in **LV95 / LN02**. Bilinear samples use raster pixel centres. A bounded COG read avoids downloading the full national file. The artifact retains the source URL, STAC asset checksum, cropped raster hash, timetable and lake hashes, crop bounds and sampling parameters.

Ground beneath the routes rises approximately **1,312 m** from Vitznau and **1,239 m** from Arth-Goldau RB to the Rigi Kulm station alignment. These are model samples, not surveyed platform or rail-head elevations, and the terminal station is not the mountain's highest point. Surface terrain cannot establish tunnel depth; no tunnels or cable sag are invented. Sampling every 20 m does not imply 20 m positional accuracy or a track engineering survey.

The Vitznau terrain crop covers **4.6 × 7.9 km** on a **193 × 331** grid, about 24 m spacing. Arth-Goldau covers **9.4 × 5.6 km** on a **257 × 154** grid, about 37 m spacing. Both use a coarser phone mesh. Rigi uses equal horizontal and vertical scales, without vertical exaggeration. Route clearance above the ground, train size, glow, camera movement and playback speed are artistic. The profile and station positions use distance along the mapped alignment; the display smooths the route between samples.

Lake context comes from the existing [FOEN hydrography artifact](../public/data/swiss-lakes.json), clipped to each terrain crop. Vitznau shows Lake Lucerne at **434 m**; Arth-Goldau includes the southern tip of Lake Zug at **414 m**. Each level is the median ground-raster sample within its clipped water polygon. These are cartographic surfaces, not measured water-level observations. Lake Lauerz lies outside the Arth-Goldau crop. Boat navigation and the Weggis cableway retain the separate [map study's evidence limits](RIGI-STUDY.md).

## Reproduction

```sh
npm run data:rigi:terrain -- --source-cache /tmp/rigi-vitznau-ground-cache.json
npm run data:rigi:terrain -- --approach arth-goldau-rigi --source-cache /tmp/rigi-arth-ground-cache.json
```

The default network is `public/data/rigi-day.json`. The default approach is `vitznau-rigi`; `--approach arth-goldau-rigi` selects the second route. Each writes `public/data/<approach>-corridor.json`. Use a separate crop cache for each approach. `--network`, `--lakes` and `--output` support alternate files. Retain the STAC response from the [metadata endpoint](https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissaltiregio/items/swissaltiregio) and supply it with `--stac /path/swissaltiregio-stac.json` to pin its asset identity. With that response and the native crop cache, a rebuild is offline and deterministic. A cache with different bounds or an asset checksum mismatch is rejected. Retained hashes identify the exact inputs; future upstream releases require a fresh review.

The terrain artifacts are **81.8 KiB gzip** for Vitznau and **63.0 KiB** for Arth-Goldau, each below its tested **100 KiB** optional budget. Only the chosen approach loads; the profile UI and CSS also load on entry. Loading and failure show an explicit status rather than a procedural replacement landscape. Select the ascent again to retry, or choose another journey.

## Verification and next steps

Automated checks cover raster pixel centres and invalid cells, source run selection, reversed path geometry, missing/disconnected paths, lake clipping, finite terrain, provenance hashes and payload size. Desktop Chromium and emulated iPhone WebKit cover lazy loading, the ground profile endpoints, selected-trip entry, switching journeys and retry after failure. Phone layout and screenshots are reviewed; physical-device testing remains open.

Both measured cogwheel ascents are available. Surveyed vertical railway/tunnel detail, cable motion and a clock-linked boat–rail–cable sequence with sourced walking/interchange intervals remain later increments. The Vitznau artifact rebuild remains byte-for-byte unchanged after generalising the ingester.


## Following the ascent sequences

The lake-to-summit sequences can now use this terrain during their selected railway leg, on the same dated timetable clock. **Follow this train in terrain** preserves time and playback state; **Return to map** preserves them again. Progress follows matched station fractions and selected-service arrival/departure times, including dwell holds. The Weggis chain enters at Rigi Kaltbad rather than replaying Vitznau–Kaltbad. The selected summit arrival pauses the clock. Scrubbing outside the boarded rail interval restores the sequence map, with terrain following available again when that interval is re-entered.

This timed view is separate from the independent scenic ascent controls. It reuses the same measured-ground artifact and discloses the same limits on track heights, tunnels and stylised vehicle geometry. Source/date mismatches, unmatched station fractions and invalid chronology do not receive a representative-service fallback. See [the sequence clock and evidence](RIGI-STUDY.md#railway-legs-on-the-terrain-clock).
