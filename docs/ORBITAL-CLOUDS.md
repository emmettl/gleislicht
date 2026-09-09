# Satellite clouds in orbital view

Source: MeteoSwiss. [Dataset documentation](https://opendatadocs.meteoswiss.ch/c-climate-data/c4-satellite-based-climate-data) · [Product manual](https://www.meteoswiss.admin.ch/dam/jcr:f244aad3-da48-4ae5-95b6-f8c77ce209ae/ProdDoc_CLOUDS.pdf).

The optional cloud layer uses MSG / SEVIRI Cloud Fractional Cover (CFC), product v4.2.0, from the official `ch.meteoschweiz.ogd-satellite-derived-grid` STAC collection. These are preliminary satellite-derived hourly fields, not a forecast or satellite photographs. MeteoSwiss permits reuse with attribution.

The 4 and 6 September 2026 study days are available. The 8 September item had no assets when retrieved on 9 September; it is selectable but explicitly unavailable and renders no clouds. It is never replaced with another day's weather. The transport view remains a composite weekday; selecting Sunday weather does not select a Sunday timetable. Sunlight retains its separately labelled 8 September reference date.

## Preparation

`python scripts/ingest-orbital-clouds.py` rebuilds from cached source NetCDF files; add `--download` to refresh the official daily items. Requires Python `numpy` and `netCDF4`. No browser API key or live request is needed. Daily preliminary files expire after 60 days, so source files, catalogue metadata, URLs and uncompressed SHA-256 hashes are archived in `data/orbital-cloud-sources/` and `data/orbital-cloud-audit.json`.

Each CEST day contains 25 hourly frames from 22:00 UTC the previous day through 22:00 UTC on the selected day. This preserves interpolation to midnight without an artificial crossfade back to the morning. The 241 × 103 native grid runs west to east, south to north; sample centres span 5.75–10.75° E and 45.75–47.875° N. Grid spacing is 1/48 degree, approximately 1.6 × 2.3 km at Swiss latitudes.

CFC percentages are rounded to unsigned bytes (0–100). Missing values use 255 and retain a separate validity weight during rendering. No spatial downsampling is applied. Each gzip payload is about 120–190 KB; its decoded size and SHA-256 are verified before display. Cloud loading failure is isolated from transport playback, with retry and off controls.

## Rendering limits

The shader linearly interpolates consecutive hourly observations and bilinearly samples their grid. Soft stationary procedural texture gives the cover a cloud-like edge; temporal change comes only from the observations. It does not estimate wind or reconstruct individual cloud trajectories. The translucent sheet is placed above the exaggerated terrain at an illustrative height; there are no measured cloud-top heights, vertical layers, or physical cloud shadows. Opacity is an artistic control, not a percentage readout of national coverage. Cloud playback follows the transport clock, including pause, seek and speed. The national data domain includes some surrounding territory and fades at its outer edges.
