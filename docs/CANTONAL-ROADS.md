# Cantonal roads — Zürich collection pilot

AUTO's expansion beyond national roads begins with **recording Zürich cantonal counters**. Collection is implemented; cantonal road geometry, counter-to-road matching and playback are still pending. The existing public AUTO layer continues to use its audited national-road topology.

## Verified sources

- [Traffic counters — static data](https://data.opentransportdata.swiss/en/dataset/trafficcounters): the shared DATEX II Measurement Site Table. The actual Zürich supplier identifier is **`ZH.CH`**, despite the cookbook's illustrative `ZH:` example. Always derive filters from the table rather than guessing the prefix.
- [Traffic counters — realtime cookbook](https://opentransportdata.swiss/en/cookbook/road-traffic-cookbook/rt-road-traffic-counters/): the same SOAP API already used for federal observations supplies one-minute light/heavy flow and mean speed. Each new minute replaces the previous publication; there is no historical backfill.
- [Zürich cantonal traffic counts](https://opendata.swiss/de/dataset/verkehrszahldaten-motorisierter-individualverkehr-miv-im-kanton-zurich): the canton's separate API also offers aggregate and individual-vehicle data. This pilot uses the shared aggregate feed; it does not ingest individual-vehicle records.
- [swissTLM3D roads and tracks](https://opendata.swiss/en/dataset/swisstlm3d-strassen-und-wege): the planned road-geometry source. The [product](https://www.swisstopo.admin.ch/en/landscape-model-swisstlm3d) is available as GeoPackage, Shapefile, File Geodatabase and Interlis in LV95. It supplies geometry, not observed traffic or a pre-matched counter network.

## Inventory and first observation

The committed `data/zurich-cantonal-road-counters.json` is a reproducible catalog derived from Measurement Site Table **v23**, published 18 June 2026. It contains source URL and SHA-256, supplier attribution, station and detector IDs, source coordinates, direction codes and explicit issues. It is a build input, not an additional browser download.

| Measure | Count |
| --- | ---: |
| Stations in source table | 331 |
| Detector records | 712 |
| Usable directional groups before road matching | 534 |
| Detectors without coded direction | 139 |
| Detectors with missing or invalid Swiss coordinates | 97 |
| Emergency-lane detector records | 2 |

Issue categories overlap. “Usable directional group” means enough metadata to investigate a match; it does not mean the road or travel orientation has been established. Stations with incomplete geography are retained for recording.

An authenticated local request on **8 September 2026** captured the **13:21 CEST** measurement minute (`11:21Z`): **323/331 stations (97.58%)**, **690/712 detector records**, and **672 detector records with complete light/heavy conditions**. All records belonged to the requested catalog, all had the same minute and the response referenced v23. These are one-minute availability results, not a guarantee of continuous coverage. The raw XML and normalized snapshot remain in the ignored local archive.

## Rebuild and record

Download the current Measurement Site Table from the source catalog, then retain its exact download URL when rebuilding:

```sh
npm run data:road:catalog:cantonal -- \
  --measurement-sites=/path/MeasurementSiteTable.xml \
  --source-url=https://exact-published-resource-url

# ASTRA_API_KEY is provided to the process environment, never committed.
npm run data:road:record -- --scope=zurich-cantonal --raw
npm run data:road:record:watch -- --scope=zurich-cantonal
```

The catalog builder rejects absent Zürich suppliers, unsupported IDs, duplicate detector IDs and missing version/publication metadata. It accepts prefixed or default XML namespaces. National ingestion retains its federal-only default.

The recorder derives **331 explicit station filters** such as `ZH.CH:1019/#` from the catalog. It writes append-only owner-only snapshots into `recordings/astra-zurich-cantonal/`. An alternate catalog can be supplied with `--catalog=/path/catalog.json` and output with `--output=/path/archive`.

Every normalized snapshot identifies `Tiefbauamt Kanton Zürich` as publisher and records the scope, requested station/detector counts, catalog hash and table version, current-minute reporting/complete counts, older measurements and any unlisted detector IDs. A measured zero flow does not require a speed; a positive flow with missing speed remains incomplete. Catalog version changes are flagged while collection continues, so new observations are preserved for later reconciliation.

## Scheduled collection and export

The existing ASTRA Worker supports:

```json
{
  "COLLECTING_ENABLED": "true",
  "RECORDING_SCOPE": "national",
  "ADDITIONAL_RECORDING_SCOPE": "zurich-cantonal"
}
```

This combines the 379 accepted federal station filters and 331 cantonal filters into **one request per minute**, then separates the response into private R2 archives:

- `astra/national/<UTC date>/<minute>.json.gz`
- `astra/zurich-cantonal/<UTC date>/<minute>.json.gz`

Each scope is independently checked for empty or stale data before writing. Fresh federal data cannot make stale cantonal data appear current. An absent cantonal supplier still allows valid federal observations to be archived; the invocation reports the additional failure. Existing minute objects are not overwritten. Removing `ADDITIONAL_RECORDING_SCOPE` and redeploying returns to federal-only collection. `RECORDING_SCOPE=zurich-cantonal` is also supported for a dedicated recorder, but a second recorder is unnecessary here.

Export using the existing R2 object-read credentials described in [Cloudflare operations](./CLOUDFLARE.md):

```sh
npm run data:road:export -- --scope=zurich-cantonal --date=2026-09-08
```

The exporter fetches adjacent UTC partitions around the requested Swiss civil day. Cantonal snapshots are intentionally rejected by the national compiler's scope filter; exporting them does not yet produce playback.

## Geometry and playback work remaining

1. Obtain a pinned Zürich-area swissTLM3D road extract with source date/hash and road attributes. Exclude paths and inappropriate road classes explicitly; do not infer a main-road designation solely from width.
2. Reconcile counter positions using accurate cantonal station geometry or authoritative road/location references. The shared table often rounds coordinates to 0.01 degrees and sometimes omits them; nearest-road snapping alone is insufficient in dense street networks.
3. Build connected road sections with reviewed direction/orientation. Alert-C `positive`/`negative` is relative to its location table, not to arbitrary swissTLM3D vertex order. Preserve unresolved matches and avoid joining across intersections without evidence.
4. Compile recorded minute conditions against accepted sections with continuity and coverage gates, then add lazily loaded cantonal geometry and playback to AUTO. Keep recording coverage separate from geometry coverage and disclose synthetic vehicle reconstruction as for the national layer.

The existing 130 unmatched federal directional groups are a separate follow-up: some may become usable with broader road geometry, but they are not automatically classified as cantonal roads or included in this Zürich supplier scope.
