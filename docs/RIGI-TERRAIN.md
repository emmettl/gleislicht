# Vitznau → Rigi Kulm: first measured ascent

Select **RIGI**, then **Climb Vitznau → Rigi Kulm**, or enter from a complete uphill cogwheel service. The measured-journey selector also includes the ascent. A compact, stylised cogwheel train follows the mapped railway above Lake Lucerne. Ground elevation and rise from Vitznau replace the generic speed and estimated-next-stop metrics; the elevation profile follows the scrubber. Controls and disclosures are available in EN / DE / FR / IT.

## Evidence and interpretation

The route is **6,829 m** along the retained FOT railway alignment, with **362 ground-profile samples** at no more than 20 m spacing. Its representative source run is Rigi Bahnen service **82 / 1127**, **12:15–12:47**, with nine stops on **4 September 2026** from GTFS **20260902**. Selecting another complete uphill run preserves that run's scheduled stop times. Partial and downhill runs do not offer this ascent. Entry starts near Vitznau; the animation is a scenic traversal, independent of the map clock and timetable dwell times.

The [swisstopo swissALTIRegio product](https://www.swisstopo.admin.ch/en/height-model-swissaltiregio), release **28 May 2026**, supplies the native **10 m** ground raster in **LV95 / LN02**. Bilinear samples use raster pixel centres. A bounded COG read avoids downloading the full national file. The artifact retains the source URL, STAC asset checksum, cropped raster hash, timetable and lake hashes, crop bounds and sampling parameters.

Ground beneath the route rises from **436.4 m** at Vitznau to **1,748.0 m** at the Rigi Kulm station alignment: approximately **1,312 m net rise**. These are model samples, not surveyed platform or rail-head elevations, and the terminal station is not the mountain's highest point. Surface terrain cannot establish tunnel depth; no tunnels or cable sag are invented. Sampling every 20 m does not imply 20 m positional accuracy or a track engineering survey.

The **4.6 × 7.9 km** terrain crop uses a **193 × 331** grid, about 24 m spacing, with a coarser phone mesh. Rigi uses equal horizontal and vertical scales, without vertical exaggeration. Route clearance above the ground, train size, glow, camera movement and playback speed are artistic. The profile and station positions use distance along the mapped alignment; the display smooths the route between samples.

Lake context comes from the existing [FOEN hydrography artifact](../public/data/swiss-lakes.json), clipped to the same crop. Its surface is rendered at **434 m**, the median terrain sample within that clipped polygon. This is a cartographic surface, not a measured water-level observation. Boat navigation and the Weggis cableway retain the separate [map study's evidence limits](RIGI-STUDY.md).

## Reproduction

```sh
npm run data:rigi:terrain -- --source-cache /tmp/rigi-ground-cache.json
```

The default network is `public/data/rigi-day.json` and the default output is `public/data/vitznau-rigi-corridor.json`. `--network`, `--lakes` and `--output` support alternate files. Retain the STAC response from the [metadata endpoint](https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissaltiregio/items/swissaltiregio) and supply it with `--stac /path/swissaltiregio-stac.json` to pin its asset identity. With that response and the native crop cache, a rebuild is offline and deterministic. A cache with different bounds or an asset checksum mismatch is rejected. Retained hashes identify the exact inputs; future upstream releases require a fresh review.

The terrain artifact is **81.8 KiB gzip**, below its tested **100 KiB** optional budget. Its data, profile UI and profile CSS load on entry. Loading and failure show an explicit status rather than a procedural replacement landscape. Select RIGI again to retry, or choose another journey.

## Verification and next steps

Automated checks cover raster pixel centres and invalid cells, source run selection, reversed path geometry, missing/disconnected paths, lake clipping, finite terrain, provenance hashes and payload size. Desktop Chromium and emulated iPhone WebKit cover lazy loading, the ground profile endpoints, selected-trip entry, switching journeys and retry after failure. Phone layout and screenshots are reviewed; physical-device testing remains open.

This delivers the first measured cogwheel ascent. The Arth-Goldau approach, surveyed vertical railway/tunnel detail, cable motion and a clock-linked boat–rail–cable sequence with sourced walking/interchange intervals remain later increments.
