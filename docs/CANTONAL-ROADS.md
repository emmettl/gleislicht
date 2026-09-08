# Cantonal roads — Zürich pilot

AUTO now records Zürich cantonal counters and includes **246 cantonal road axes** in its map and search. The geometry builder matches 298 counter stations to these roads. Horgen’s Seestrasse has an optional **1.3 km recorded afternoon pilot**, with both travel directions and explicit coverage gaps. Wallisellen–Bassersdorf adds a **3.46 km pilot with 104 continuous complete minute samples** on ZH 1. Seven recordings across six reviewed corridors are now available, including a separate 61-minute Horgen evening recording. Other cantonal cards remain geometry-only; national-road observations retain their existing topology and coverage.

## Verified sources

For expansion beyond the Zürich pilot, see the [regional road source survey](REGIONAL-ROAD-SOURCE-SURVEY.md). It checks Basel-Stadt, Thurgau, Zürich city and Winterthur count archives, with additional leads for Aargau, Luzern and Genève, and separates hourly counts from the existing flow-and-speed feed.

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

The exporter fetches adjacent UTC partitions around the requested Swiss civil day. Cantonal snapshots are intentionally rejected by the national compiler's scope filter; exporting them alone does not produce playback; use the cantonal compiler or segmented pilot builder below.

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

The optional artifact is about 669 kB uncompressed / 128 kB gzip. It is fetched only on entering AUTO; missing, invalid or stalled downloads fall back to national geometry. It adds roads and paths, while federal sites, sections and coverage metadata remain unchanged. Cantonal cards show mapped length, a geometry-only notice and source attribution on desktop and mobile. They do not show invented vehicle counts. The separate Horgen playback artifact is fetched only when its pilot button is selected.

Geometry validation: **176 tests across 47 files passed**, plus all **8 desktop Chromium / iPhone WebKit road checks**, the production build, lint, artifact validation, architecture and transfer-budget checks. A second build from the pinned source files produced an identical artifact. The browser checks cover lazy loading, source failure, road selection, attribution and existing motorway traffic history. These checks cover the geometry stage; the later playback integration is described below.

## Direction audit and first compiled draft

The follow-up `data/zurich-cantonal-road-directions.json` is a **build-time draft**, separate from the public geometry artifact. It embeds the direction evidence and pinned place results and can be rebuilt without network access:

```sh
node scripts/validate-cantonal-road-directions.mjs \
  --places=data/zurich-cantonal-road-directions.json \
  --output=/tmp/zurich-directions.json

# Refresh the exact place-name source queries when needed:
node scripts/validate-cantonal-road-directions.mjs --download=/tmp/zh-destinations
node scripts/validate-cantonal-road-directions.mjs --input=/tmp/zh-destinations
```

The audit uses [GeoAdmin's exact feature queries](https://docs.geo.admin.ch/access-data/find-features.html) against swissNAMES3D for 190 plain detector destinations. It retains settlement features only, rejects saturated results, and preserves distinct same-name settlement extents as alternatives. Identical bounds are deduplicated. Every query has a URL, retrieval timestamp and response hash. Settlement bounds are treated as uncertainty; a bounding-box midpoint alone is not sufficient evidence.

Both destination position along the road and the local road bearing must agree. The destination must be at least 1.5 km away, project within 1.5 km of the same road path, and differ by at least 750 m along the path. The centre bearing must agree by at least 0.75 cosine; all extent corners must remain on the same side with at least 0.5 cosine and 750 m of offset separation. All non-emergency detector lanes must resolve into complete opposing groups. Compound junction labels, unrecognised names and ambiguous destinations remain unresolved.

**7 stations / 14 directional groups** pass these conservative automated checks. The section builder finds one connected pilot: **1.298 km of Horgen's Seestrasse (ZH 3)** between stations `ZH.CH:4590` and `ZH.CH:4290`, in both directions. It rejects gaps over 5 km, colocated counters, unresolved intervening counters and disconnected paths. The other five validated stations do not form accepted sections. These are inferred orientations supported by source evidence, not manually surveyed turn movements.

Here, `positive` means increasing vertex order in the stored cantonal path; it does **not** reuse Alert-C polarity. For example, the Horgen detectors towards Zürich are Alert-C positive but follow the stored path in the negative direction. Original codes remain in the audit.

The cantonal compiler reuses the recorded-minute/chunk implementation while keeping supplier scopes separate. It includes only sites referenced by accepted sections, requires every lane at every connected site in each accepted minute, checks catalog versions, rejects conflicting duplicate observations, and preserves the Swiss observation date/time. National compilation still rejects cantonal snapshots. Junction turning flows remain unmeasured; reconstructed vehicles interpolate conditions between counters.

A full-period attempt failed correctly: station 4590 was incomplete at 13:37–13:43 and 14:02–14:13 CEST. The longest complete window in the initial export was **18 minutes, 13:44–14:01 CEST on 8 September 2026**. This smaller window was explicitly compiled for a local draft:

```sh
node scripts/compile-cantonal-road-study.mjs \
  --date=2026-09-08 --from=13:44 --to=14:01 --minimum-samples=18
```

The output stays in the ignored `recordings/astra-zurich-cantonal/compiled/` directory, with `publicationStatus: draft`, the direction-artifact hash and the requested sample gate. It contains four connected directional sites, two sections, 18 complete minute samples and 100% site coverage. The existing playback reader consumed it successfully; reconstructed vehicles ranged from 6 to 21. This is a reconstruction, not vehicle tracking. The default minimum remains 60 samples; no observations were filled into the missing periods.

The follow-up passes **187 tests across 49 files**, production build and lint in an isolated copy of the committed road work. The pinned direction artifact rebuilds identically without network access.

## Horgen afternoon playback

In AUTO, search **Horgen**, select **ZH 3**, then choose **Play Horgen recording**. Playback opens paused at 13:44, focuses the 1.3 km section, and switches the timeline to **8 September 2026, 13:23–14:21 CEST**. It displays reconstructed light/heavy vehicles in both directions using the existing road renderer. Rail and air are hidden during this separate observation window. **Return to morning roads** restores the morning timeline; leaving the pilot’s road/study also clears the pilot. Choose **Share study** to copy a link that restores this recording, date and current time, paused. A link into an observation gap preserves the gap and keeps traffic hidden.

The on-demand `public/data/zurich-cantonal-road-pilot.json` contains four directional sites, two sections and **40 complete minute samples**:

| Recorded window (CEST) | Complete minutes |
| --- | ---: |
| 13:23–13:36 | 14 |
| 13:44–14:01 | 18 |
| 14:14–14:21 | 8 |

**13:37–13:43 and 14:02–14:13 are explicitly missing.** Seeking or playing beyond the final sample in a complete window hides vehicles until the next complete window begins. The count displays a dash and the card explains the missing observations; missing data is never displayed as measured zero traffic. Window and gap buttons provide direct access, including on mobile.

Rebuild the pinned pilot after exporting the raw archive:

```sh
node scripts/build-cantonal-road-pilot.mjs
# Optional paths: --input=recordings/astra-zurich-cantonal --output=/tmp/horgen-pilot.json
```

The pilot catalog in `data/cantonal-road-pilots.json` pins each recording identity, date, interval and counter pair. The builder defaults to Horgen. It passes each minute through the strict cantonal compiler, divides accepted samples into contiguous runs, and requires at least two complete samples per run. This explicitly segmented pilot does not lower the ordinary compiler’s default 60-sample requirement or its per-minute lane-completeness gate. Catalog drift and conflicting duplicates still fail the build. Source snapshots stay private; the public artifact contains aggregate playback values and the direction-topology SHA-256. Browser validation checks site/section mappings, complete minute arrays and exact accounting of recorded and missing minutes before changing the timeline. Failed downloads leave the morning view intact and allow retry.

This is a **counter-based reconstruction**, not vehicle tracking. Turning flows at intermediate junctions are unmeasured, and the whole 32 km ZH 3 axis does not have playback coverage.

Playback validation: **205 unit tests across 55 files**, **12 desktop Chromium / iPhone WebKit road checks**, production build, architecture checks and lint (warnings only). The initial transfer is **758.4 KiB gzip**, within the 790 KiB budget; the pilot data is downloaded only on request. Rebuilding the public pilot from the archived observations produces an identical artifact.

## Wallisellen–Bassersdorf playback

In AUTO, search **Wallisellen** or **Bassersdorf**, select **ZH 1**, then choose **Play Wallisellen–Bassersdorf recording**. Playback opens paused at **14:14 CEST on 8 September 2026** and ends at **15:57**. The 3.457 km section contains four directional sites and 104 complete samples in one window, with no observation gaps. The card discloses five mapped junction areas and that turning flows are unmeasured. Only the reviewed counter section has traffic animation; the whole ZH 1 axis does not.

The public `wallisellen-bassersdorf-road-pilot.json` artifact is approximately **12.9 kB / 3.6 kB gzip** and is fetched only on choosing the pilot. The Horgen data remains a separate download. Each response must match the selected recording ID, road, date, bounds, counter pair and expected sample count before replacing the morning view. Selecting another road aborts an unfinished download and clears the active pilot. Wrong-corridor responses and failed downloads leave the morning timeline intact and allow retry.

The shared controls derive dates, lengths and window labels from the selected recording, support all four UI languages, and disclose gaps only where they exist. The pilot place names supplement search without changing the official road description. Horgen retains its existing 40 samples and two gaps; its artifact now additionally carries the explicit recording ID `horgen-2026-09-08`. The new recording ID is `wallisellen-bassersdorf-2026-09-08`. Both recording identities are supported by **Share study**. Links reopen the matching corridor with road-only playback, focus its recorded section and preserve the requested time, including the last observation.

Rebuild the second public pilot from the archived observations and pinned review:

```sh
node scripts/validate-cantonal-road-directions.mjs \
  --places=data/zurich-cantonal-road-directions.json \
  --reviews=data/zurich-cantonal-road-direction-reviews.json \
  --output=/tmp/zurich-directions-reviewed.json
node scripts/build-cantonal-road-pilot.mjs \
  --pilot=wallisellen-bassersdorf-2026-09-08 \
  --topology=/tmp/zurich-directions-reviewed.json
```

The reviewed topology is an explicit build input; the original automatic topology cannot silently enable this corridor. The publisher rejects a changed expected sample count and uses the strict per-lane compiler before publishing each contiguous window. Source archive snapshots remain private.

Second-pilot validation: **257 tests across 65 files**, **16 desktop Chromium / iPhone WebKit road checks**, production build, artifact validation, architecture checks and lint for changed modules pass. First-view transfer is **759.7 KiB gzip / 790 KiB budget**. Both pilot assets rebuild identically; Horgen’s observations differ from the previous artifact only by the added recording identity.

## Further coverage work

The [coverage and junction review](CANTONAL-COVERAGE-REVIEW.md) audits the first 245 scheduled minutes: Horgen's longest complete run is 28 minutes, while a pinned direction review yields a **104-minute Wallisellen–Bassersdorf draft**. It also identifies the three Horgen junction areas and documents the strengthened per-lane compiler gate. The second corridor is now available in AUTO as described above.

1. Expand accepted direction coverage using more precise destination references and reviewed junction geometry. Nearby destinations and settlement extents crossing a station account for many exclusions; weakening checks alone is not a solution.
2. Review section assumptions at intersections and find longer complete observation windows before broadening the pilot. Recording, geometry and usable playback coverage remain separate measures.
3. Extend the recording catalog only after each new corridor passes direction, topology and minute-completeness review; its catalog identity then supports the same share-link format.

The existing 130 unmatched federal directional groups are a separate follow-up: some may become usable with broader road geometry, but they are not automatically classified as cantonal roads or included in this Zürich supplier scope.


### Shared pilot links

The `recording` query parameter selects a bundled catalog identity, never a filename or arbitrary URL. For example, `?recording=horgen-2026-09-08&date=2026-09-08&time=49020` opens the 13:37 observation gap; `?recording=wallisellen-bassersdorf-2026-09-08&date=2026-09-08&time=57420` opens the final 15:57 observation. Times are seconds since midnight in the recording's Swiss civil day. Omitting date or time uses the catalog date and initial time. Generated links include both explicitly and omit browser coordinates, transient query parameters and rail focus.

Unknown recordings, conflicting dates and out-of-window or non-finite times produce an explained morning fallback. A failed recording fetch stays in the morning view and can be retried from the corridor card at the linked time. Missing road geometry also produces an explained fallback with a page-reload retry. Navigating away or changing transport layers cancels a pending recording request. Existing railway links retain their previous behavior. Recording JSON remains lazy: normal visits do not fetch pilots; a valid recording link requests its selected artifact after road geometry is available.

### Recording picker and Lindau review

**Road recordings** in the main network view opens a catalog of the published pilots, without fetching their recording JSON. Each entry displays its recording date, Swiss time window, complete-minute count and whether it contains observation gaps. Selecting an entry follows its canonical recording link and opens paused. The current recording is marked, and closing the picker returns focus to the opening button without changing playback. Labels and disclosures support all four UI languages.

The picker now lists Horgen, Wallisellen–Bassersdorf, Kilchberg–Thalwil, Meilen–Stäfa, Meilen, and Bauma–Wila. The [Bassersdorf–Lindau follow-up](CANTONAL-COVERAGE-REVIEW.md#bassersdorflindau-follow-up) confirms 245 complete minutes but leaves both Lindau detector directions unresolved after checking detailed official geometry. It is not listed as a playable recording. A detector-specific directional reference is needed before that corridor can pass review.

### Kilchberg–Thalwil playback

The third published recording follows **4.803 km of ZH 3 / Seestrasse** between Kilchberg counter `ZH.CH:0109` and Thalwil counter `ZH.CH:4190`. It contains **142 consecutive complete minutes on 8 September 2026, 14:14–16:35 CEST**, with both light/heavy vehicle classes in both directions and no gaps. Open **Road recordings → Kilchberg–Thalwil**, or use `?recording=kilchberg-thalwil-2026-09-08`. The recording opens paused at 14:14 and supports sharing through the final 16:35 observation.

Horgen and Kilchberg–Thalwil share the same road identifier. Playback and validation now resolve their recording identities independently; the corridor card offers a recording selector where a road has multiple recordings. Search includes every published pilot's place names. Horgen remains the default ZH 3 recording for ordinary road selection, and its published observations are unchanged.

The [pinned direction review](../data/kilchberg-thalwil-direction-reviews.json) uses the existing opposing-normal-lane method. At each counter the Horgen lane independently validates positive path order. The Zürich lane passes distance, projection and local bearing (−0.79 / −0.95); only Zürich's broad settlement extent fails. The reviewed lane therefore follows negative path order. Alert-C signs are not treated as path directions, and the general validation gates are unchanged.

The [official source extracts](../data/lakeside-road-review-sources.json) and [junction audit](../data/lakeside-road-junction-audit.json) identify three geometric junction areas, around 1.512 km (municipal approach), 2.385 km (axis 680) and 4.745 km (axis 682) from Kilchberg. These are not measured turns or a complete inventory of private access. The recording remains a reconstruction between counters, not tracked vehicles or a claim of flow conservation through junctions.

Rebuild from the private archived observations:

```sh
node scripts/validate-cantonal-road-directions.mjs \
  --places=data/zurich-cantonal-road-directions.json \
  --reviews=data/kilchberg-thalwil-direction-reviews.json \
  --junction-sources=data/lakeside-road-review-sources.json \
  --output=/tmp/kilchberg-thalwil-directions.json
node scripts/audit-cantonal-road-junctions.mjs \
  --sources=data/lakeside-road-review-sources.json \
  --output=data/lakeside-road-junction-audit.json
node scripts/build-cantonal-road-pilot.mjs \
  --pilot=kilchberg-thalwil-2026-09-08 \
  --topology=/tmp/kilchberg-thalwil-directions.json
```

### Meilen–Stäfa playback and official road continuation

The fourth recording follows **4.097 km of ZH 17 / Seestrasse**, from `ZH.CH:0591` in Meilen to `ZH.CH:1091` in Stäfa. It contains **245 consecutive complete minutes on 8 September 2026, 13:23–17:27 CEST**, covering both vehicle classes in both directions without gaps. Choose **Road recordings → Meilen–Stäfa**, or open `?recording=meilen-staefa-2026-09-08`. Playback starts paused at 13:23 and shared links preserve times through the final 17:27 observation.

The previous destination failure was caused by the available Zürich road axis ending before Rapperswil. The [official St. Gallen Kantonsstrassenplan](https://metadata.geo.sg.ch/produkte/98), published by TBA/AREG, supplies the continuation as **KS17, feature `Kantonsstrassen.8`**. Reversing that feature's vertex order joins the Zürich endpoint within **0.379 m**, below the explicit 5 m join tolerance. The [pinned source response](../data/meilen-staefa-axis-continuation.json) retains its URL, CRS, feature identity, input hashes and station scope.

With both exact SwissNames alternatives retained, the unchanged regional check selects **Rapperswil SG**. Its distance from the connected axis is **85.38 m**, replacing the previous 2,522.39 m. Local bearing agreements remain **0.95 / 0.96**, and destination-distance, projection, bearing and settlement-extent checks all pass. Positive path order corresponds to Rapperswil; the independently validated Zürich directions remain negative. No thresholds were relaxed.

The continuation is used **only in the two counters' direction checks**. Published road paths and the 4.097 km playback section retain the original Zürich geometry; no St. Gallen traffic is inferred. Other stations, including the neighbouring Meilen counter, keep their automatic status. The [continuation review](../data/meilen-staefa-continuation-review.json) records this scope and the resulting section identities. The prior Zürich-only audit remains available as historical evidence of the original gap.

The existing lakeside junction audit identifies two geometric junction areas, around **1.177 km (axis 718)** and **2.749 km (axis 720)**. These are not measured turning flows or a complete inventory of private access. Vehicles remain reconstructed between the two counters.

Rebuild using the committed source evidence and private observation archive:

```sh
node scripts/build-meilen-staefa-directions.mjs --output=/tmp/meilen-staefa-directions.json
node scripts/build-cantonal-road-pilot.mjs \
  --pilot=meilen-staefa-2026-09-08 \
  --topology=/tmp/meilen-staefa-directions.json
```

### Meilen Seestrasse playback

The fifth recording adds the neighbouring **2.902 km** section between Meilen counters `ZH.CH:0491` and `ZH.CH:0591`, with **142 uninterrupted minutes on 8 September 2026, 14:14–16:35 CEST**. Choose **Road recordings → Meilen**, or open `?recording=meilen-seestrasse-2026-09-08`. Both directions have complete light/heavy observations. The afternoon archive contains 241/245 complete minutes for this pair; publication selects the longest complete run and does not fill missing observations.

Meilen and Meilen–Stäfa have separate recording identities on ZH 17. The in-card recording selector switches between them, and shared links retain the selected counter pair and time through the final observation. Meilen–Stäfa remains the default for ordinary ZH 17 road selection; its published artifact and original direction review are unchanged.

The [new station scope](../data/meilen-seestrasse-direction-scope.json) pins counter 0491's original detector audit as well as counter 0591. Both Zürich lanes independently validate negative stored path order. Reusing the fully checked KS17 continuation and both canton-qualified Rapperswil alternatives validates the Rapperswil lanes as positive, with bearing agreements **0.96 / 0.95** and destination-to-axis distance **85.38 m**. The builder admits only this pair, retains the original Zürich playback geometry, and rejects changes to the source geometry, catalog, station evidence or continuation. The existing Meilen–Stäfa builder still admits only its original pair.

A separate [official Zürich road-axis extract](../data/meilen-seestrasse-junction-source.json) covers the entire section. The [review report](../data/meilen-seestrasse-review.json) records **three geometric junction areas** from counter 0491: a municipal approach around **711 m**, axis **703 at 877 m**, and axis **716 at 1,920 m**. These are geometric candidates, not surveyed turn permissions or a complete inventory of private access; turning flows and individual vehicle trajectories remain unmeasured. The builder rejects incomplete WFS responses and extracts that do not cover the playback section.

Rebuild from committed evidence and the private observation archive:

```sh
node scripts/build-meilen-seestrasse-directions.mjs
node scripts/build-cantonal-road-pilot.mjs \
  --pilot=meilen-seestrasse-2026-09-08 \
  --topology=/tmp/meilen-seestrasse-directions.json
```

Validation: 45 targeted tests across 10 files, eight desktop Chromium / iPhone WebKit browser checks, production build, architecture and lint checks pass. The published artifact rebuilds byte-for-byte from the archive. First-view transfer is 766.3 KiB gzip within the 790 KiB budget; recording data remains an on-demand download.

### Bauma–Wila playback and qualified Wald destination review

The sixth recording follows **4.822 km of ZH 15 / Tösstalstrasse**, from Bauma counter `ZH.CH:3588` to Wila counter `ZH.CH:1623`. It has **104 uninterrupted minutes on 8 September 2026, 14:14–15:57 CEST**, with complete light/heavy observations in both directions. The full afternoon archive has 225/245 complete minutes for this pair; publication selects the longest complete run. Open **Road recordings → Bauma–Wila**, or `?recording=bauma-wila-2026-09-08`. Shared links preserve time through the final observation, including after retrying a failed download.

The original exact lookup of “Wald” exceeded the conservative 200-result gate, so the automatic builder discarded its candidates. A fresh query returns 359 representations, including smaller settlements. Looking only at Wald ZH and Wald AR would omit these alternatives. The review therefore uses the **complete downloadable 2026 SwissNames dataset**, scanning all three CSV members for every settlement named “Wald” or beginning with “Wald ”. The [inventory](../data/bauma-wald-settlement-inventory.json) contains **25 distinct settlements**: 23 unqualified Wald entries, Wald ZH and Wald AR. It records the archive/member hashes, row totals and source rows. The qualified Wald BE query adds no settlement candidate.

All 25 inventory rows must map one-to-one to the named settlement bounds in the [pinned API responses](../data/bauma-wila-review-sources.json). This independently checks completeness of the saturated response without changing the general result-limit gate. An omitted settlement or ambiguous crosswalk fails the build. The regional result still remains ambiguous at both counters.

The [explicit station review](../data/bauma-wila-direction-scope.json) evaluates every alternative against the official road path named “Rüti - Wald - Turbenthal - Winterthur …”. **Wald ZH is 210.79 m from it**, passes every destination/extent/bearing gate, and follows negative path order at both counters (bearing **−0.98 / −1.00**). **Wald AR is 42,524.22 m off the axis**. Other settlements fail the regional or geometric checks, with one exception at Bauma: a small unqualified Wald settlement passes in the **positive** direction, the same direction as the independently validated Winterthur lane. The catalog confirms exactly two opposing normal main-carriageway lanes there, allowing that same-direction alternative to be excluded. At Wila the small settlement fails bearing; Wald ZH is the sole fully passing alternative. The [review report](../data/bauma-wila-review.json) preserves all 25 results per station and the explicit same-direction exclusion.

This is a documented road-and-lane destination inference, not a surveyed detector bearing. Alert-C signs confirm lane opposition where required; they are not mapped directly to path directions. The builder admits only these two pinned counters and requires exactly one fully passing candidate opposite the Winterthur anchor. It rejects changed geometry, catalog, station evidence, source responses, missing settlements, a second passing candidate in the opposing direction, or missing catalog support for a same-direction exclusion. The general automatic homonym, result-limit and geometric gates remain unchanged.

The earlier Bauma Stegstrasse counter `ZH.CH:2891` remains excluded. Even with Wald ZH explicitly selected, it fails local bearing (**−0.74**, against the required 0.75 magnitude). Its 4.231 km section to counter 3588 is not published. No bearing threshold has been relaxed.

The full-section official road-axis extract identifies **two geometric junction areas**, around **1,917 m (axis 806)** and **2,600 m (axis 337)** from counter 3588. The builder verifies extract coverage and rejects incomplete WFS responses. These are not surveyed turn permissions, measured turn flows or a complete inventory of private access. Playback remains a reconstruction between counters.

Rebuild using committed evidence and the private observation archive:

```sh
node scripts/build-bauma-wila-directions.mjs
node scripts/build-cantonal-road-pilot.mjs \
  --pilot=bauma-wila-2026-09-08 \
  --topology=/tmp/bauma-wila-directions.json
```

Rebuild the complete settlement inventory from the official [2026 CSV archive](https://data.geo.admin.ch/ch.swisstopo.swissnames3d/swissnames3d_2026/swissnames3d_2026_2056.csv.zip) before the direction build when independently reproducing the source extraction:

```sh
python3 scripts/prepare-bauma-wald-inventory.py --archive=/tmp/swissnames3d_2026_2056.csv.zip
```

Validation: 50 targeted tests across 11 files, ten desktop Chromium / iPhone WebKit browser checks, production build, architecture and lint checks pass. The complete settlement inventory and public recording rebuild identically. The expanded homonym review leaves every playback observation and section unchanged. First-view transfer is 766.4 KiB gzip within the 790 KiB budget; recording JSON is downloaded only when selected.

### Further Oberland candidates

The [Oberland candidate audit](OBERLAND-ROAD-CANDIDATES.md) reviews 14 additional counter pairs using a complete six-settlement inventory for Pfäffikon, Wetzikon and Gossau. Every pair still has a direction or geometry blocker despite complete recording runs of 104–245 minutes. Its Zürich-qualified results are explicitly diagnostic and cannot enable playback. The six published recordings remain unchanged; the document records the specific missing evidence and reproduction commands.


### Horgen evening playback

A separate **61-minute recording from 21:10 through 22:10 CEST on 8 September 2026** now provides Horgen's first published uninterrupted hour. Open **Road recordings** and choose the Horgen entry with that window, or select it from the ZH 3 recording menu. The menu includes dates and windows to distinguish recordings of the same corridor. Playback buttons now say “recording” in all four languages so evening observations are labelled accurately.

The new identity is `horgen-evening-2026-09-08`, with on-demand artifact `public/data/horgen-evening-road-pilot.json`. Both counters and all four directional detectors pass the existing per-lane flow/speed checks for all 61 minute samples. It reuses the exact original 1.298 km Horgen topology and direction-source hash. The three mapped junction areas and unmeasured turning-flow limitation still apply. The afternoon identity, its 40 complete samples and two gaps are preserved.

The [evening coverage audit](../data/zurich-cantonal-evening-coverage-audit.json) pins all 637 archive files from 13:23 through 23:59. Every scheduled minute exists; Horgen has 489 simultaneously complete minutes, with 21:10–22:10 its only continuous run of at least an hour. This is a completed civil-day audit from the recorder's deployment time, not a claim of observations before 13:23.

Reproduce after exporting the private archive:

```sh
node scripts/audit-cantonal-road-coverage.mjs \
  --date=2026-09-08 --from=13:23 --to=23:59 \
  --output=data/zurich-cantonal-evening-coverage-audit.json
node scripts/build-cantonal-road-pilot.mjs \
  --pilot=horgen-evening-2026-09-08
```

The audit uses the original automatic direction topology, so other candidate direction statuses describe that baseline. The separate published corridor reviews remain necessary when compiling their later observations. Complete observation coverage alone grants no direction approval.
