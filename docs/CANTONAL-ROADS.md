# Cantonal roads — Zürich pilot

AUTO now records Zürich cantonal counters and includes **246 cantonal road axes** in its map and search. The geometry builder matches 298 counter stations to these roads. Their cards disclose that traffic playback is unavailable until travel directions and sections have been validated; national-road observations retain their existing topology and coverage.

## Verified sources

- [Traffic counters — static data](https://data.opentransportdata.swiss/en/dataset/trafficcounters): the shared DATEX II Measurement Site Table. The actual Zürich supplier identifier is **`ZH.CH`**, despite the cookbook's illustrative `ZH:` example. Always derive filters from the table rather than guessing the prefix.
- [Traffic counters — realtime cookbook](https://opentransportdata.swiss/en/cookbook/road-traffic-cookbook/rt-road-traffic-counters/): the same SOAP API already used for federal observations supplies one-minute light/heavy flow and mean speed. Each new minute replaces the previous publication; there is no historical backfill.
- [Zürich cantonal traffic counts](https://opendata.swiss/de/dataset/verkehrszahldaten-motorisierter-individualverkehr-miv-im-kanton-zurich): the canton's separate API also offers aggregate and individual-vehicle data. This pilot uses the shared aggregate feed; it does not ingest individual-vehicle records.
- [Zürich road classification](https://geolion.zh.ch/geodatensatz/3177): official road-axis geometry and main/secondary-road classes, retrieved through the canton's WFS in LV95. This replaces the initially planned swissTLM3D extract for this pilot because it carries the canton's own road identities and classification.
- [Zürich traffic measurement sites](https://geolion.zh.ch/geodatensatz/1243): precise station points, joined to the shared counter catalog by station number. This avoids snapping the often rounded shared-feed coordinates directly to dense streets.
- [Zürich public API](https://vdp.zh.ch/openapi/api-docs): `readCollectorsCfg` supplies station names and detector destination descriptions without authentication. These descriptions are retained as direction-review inputs; they do not establish polyline orientation automatically.

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

The supplementary scope was deployed at **13:23:54 CEST** as Worker version `b013bd36-d449-4042-ac8c-8140fec8ff9f`. R2 verification at **13:47 CEST** found **23 consecutive cantonal minute objects**, covering measurement times **13:23–13:45**, with no missing minute keys. The first and latest objects each reported 323 stations, 690 detectors and 672 complete detector records. The corresponding latest federal object reported all 379 requested stations and 1,595 detectors. Supplier IDs were checked in the sampled objects to confirm archive separation. Collection continued while the development Mac was interrupted.

Validation after deployment: **157 tests across 44 files passed**, along with the application production build, Worker type checks, lint and whitespace checks. Focused tests cover supplier identity, namespace handling, incomplete geography, stale/absent suppliers, catalog drift, compressed archive separation and preservation of existing minute objects.

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

## Geometry build and audit

The pinned sources were retrieved on **8 September 2026**. Each source URL, retrieval timestamp and SHA-256 is recorded in `public/data/zurich-cantonal-road-topology.json`; rebuilding verifies the original source files against the download manifest. The builder rejects incomplete WFS responses, unexpected coordinate systems, duplicate identities and invalid geometry.

```sh
npm run data:road:topology:cantonal -- --download=/tmp/zh-road-sources
npm run data:road:topology:cantonal -- --input=/tmp/zh-road-sources
```

The road source contains 816 features. Classification selects 312 paths across 246 road axes: signed main roads in categories A/B, other signed cantonal main roads, and cantonal secondary roads. Abandoned roads and motorway classes are excluded. `ZH 17` is a cantonal administrative axis label, not a claim that the road has a national route shield or a UK A-road classification.

The station WFS contains 428 points, of which 321 join exactly to the 331-station recording catalog. A match must be within 25 metres, with at least 15 metres of separation from the next competing axis. Excluded classes remain competitors, preventing motorway counters from snapping to adjacent minor roads. Large disagreements with the original coordinates also require review. Source polylines are simplified by 5 metres for display; matching uses full precision and never bridges disconnected paths.

| Station result | Count |
| --- | ---: |
| Matched road geometry; direction unresolved | 298 |
| Ambiguous competing roads | 4 |
| On excluded road classes | 11 |
| No precise station-ID join | 10 |
| Outside the accepted road-match distance | 8 |

All 331 stations remain in the audit, with original IDs, precise coordinates where available, candidate distances and explicit status. The public API supplies names for 330 stations; a duplicate normalized collector ID is retained as ambiguous metadata. None of these issues removes a station from recording. Road geometry coverage and reporting coverage are separate measures.

The optional artifact is about 669 kB uncompressed / 128 kB gzip. It is fetched only on entering AUTO; missing, invalid or stalled downloads fall back to national geometry. It adds roads and paths, while federal sites, sections and coverage metadata remain unchanged. Cantonal cards show mapped length, a geometry-only notice and source attribution on desktop and mobile. They do not show invented vehicle counts. No cantonal playback sections are published yet.

Geometry validation: **176 tests across 47 files passed**, plus all **8 desktop Chromium / iPhone WebKit road checks**, the production build, lint, artifact validation, architecture and transfer-budget checks. A second build from the pinned source files produced an identical artifact. The browser checks cover lazy loading, source failure, road selection, attribution and existing motorway traffic history. This stage is implemented and verified locally; only the recording Worker has been deployed so far.

## Playback work remaining

1. Validate detector travel orientation using authoritative destination/location references. Alert-C `positive`/`negative` is relative to its location table, not arbitrary WFS vertex order. The retained lane descriptions provide review evidence; ambiguous descriptions remain unresolved.
2. Build connected, directed counter-to-counter sections only where geometry and orientation are accepted. Preserve gaps, intersections and unresolved matches explicitly.
3. Compile recorded minutes against those sections with continuity and coverage gates, then load cantonal playback separately in AUTO. Disclose synthetic vehicle reconstruction as for the national layer.

The existing 130 unmatched federal directional groups are a separate follow-up: some may become usable with broader road geometry, but they are not automatically classified as cantonal roads or included in this Zürich supplier scope.
