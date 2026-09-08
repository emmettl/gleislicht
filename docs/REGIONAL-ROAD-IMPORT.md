# Basel, Thurgau and Zürich city hourly-count imports

Started **8 September 2026**, following the [regional road source survey](REGIONAL-ROAD-SOURCE-SURVEY.md). The first implementation acquires and normalizes complete requested day slices, audits measurement quality and gaps, and prepares counter inventories for geometry review. It does **not** add these sources to AUTO playback or the live DATEX recorder.

The [geometry and class-coverage follow-up](REGIONAL-ROAD-GEOMETRY.md) now matches these counts against official axes in all three regions, checks the Zürich station inventory, and adds Thurgau's separate 60-station class family. The figures below remain the reproducible baseline for the first count import.

## Pinned first comparison

Friday **4 September 2026** and Sunday **6 September 2026** are Swiss civil dates. All six exports reconcile against separate publisher count queries. The snapshot contains **23,832 original observations**, **252 station identities** and **500 source-specific directional/lane or measurement-site series**. Station identities are namespaced; these are not 252 independently verified physical locations.

| Source | Stations in date union | Series in date union | Friday rows | Sunday rows | Friday / Sunday complete measured series |
| --- | ---: | ---: | ---: | ---: | ---: |
| Basel-Stadt | 30 | 63 | 1,512 | 1,488 | 62 / 62 |
| Thurgau | 109 | 220 | 5,280 | 5,136 | 220 / 214 |
| Zürich city | 113 | 217 | 5,208 | 5,208 | 210 / 210 |

“Complete measured” requires a valid count, measured status, no adapter issues, and every expected hour. It does not mean publisher-approved, road-matched or admitted to playback. The denominator is the union of series observed on these two dates, not a census of every active counter in each jurisdiction. An entirely absent counter on both dates cannot be identified from these slices.

The committed [audit](../data/regional-road-count-audit.json) contains per-series dates, UTC gap lists, quality statuses, road-scope flags, inventory attributes and nearby existing-counter candidates. The [normalized observations](../data/regional-road-counts.json.gz) retain counts and source row references; the [snapshot manifest](../data/regional-road-sources/2026-09-08/manifest.json) identifies original response bytes, URLs, acquisition times and SHA-256 hashes. Original responses are stored as deterministic gzip files alongside the manifest. About 1.4 MB covers the source snapshot, normalized counts and readable audit; none is a browser download.

## Source findings

### Basel-Stadt

The [100006 API](https://data.bs.ch/explore/dataset/100006/) returns a mixture of class layouts. Null class fields remain null, and observed class keys are retained without mapping them to ASTRA light/heavy classes. Some lanes have a name but no numeric lane code; their identity explicitly uses the name. Numeric lane identities and named lane identities remain distinct.

All 30 sampled station identities join the [100038 inventory](https://data.bs.ch/explore/dataset/100038/) by `zst_id` / `id_zst`. Across the 63 directional/lane series, its current detector types are **56 induction-loop, 6 video and 1 traffic-light induction-loop**. Inventory attributes describe the acquired inventory, not independently established historical configuration. Each inventory row is retained in the audit. Station **235**, the A3–A35 border site, is flagged as motorway scope, covering two series.

All 3,000 observations carry `valuesapproved=0` and `valuesedited=0`: recorded counts, **unapproved**. The `1441 / nach Steinenring / lane 2` series at **LSA 144 Arnold Böcklin Str. 1** is absent for all 24 Sunday hours. One Friday record at this series has a vehicle-class subtotal inconsistent with its total; both the source total and classes survive and the inconsistency excludes that hour from the complete-measured metric.

The acquired count and inventory catalogues declare **CC BY 4.0**. Preserve their source credit to **Kanton Basel-Stadt / Amt für Mobilität** and catalogue links. Separate FLIR/LSA historical products and measured-speed products have not been imported. The initial API family label deliberately does not infer a detector technology from its class layout.

### Thurgau

The [dbu-tba-2 API](https://data.tg.ch/explore/dataset/dbu-tba-2/) uses typed date predicates (`datum = date'2026-09-04'`). This first adapter covers its total-count product. Class definitions and annual compressed CSV history remain separate acquisition work. All observations in this snapshot are labelled **raw-current-year**, using the acquisition year pinned in the manifest, so a later offline rebuild cannot silently relabel them as validated.

The two directions at **423, FRAUENFELD Parkhaus Passage**, are flagged `parking-access-candidate` from the explicit name/address. This is a conservative text flag, not an exhaustive road-type classifier. All other sites remain unreviewed. In particular, a label such as `H14` does not by itself prove a through-road measurement.

Three Weinfelden Bankplatz station identities (**73701 Bahnhofstrasse**, **73702 Wilerstrasse**, **73703 Freiestrasse**) each lose both directional series on Sunday: **144 absent hourly records**. These missing rows are not replaced with zeros. The catalogue declares **CC0 1.0**, publisher **Tiefbauamt Kanton Thurgau**.

### Zürich city

The [municipal catalogue](https://data.stadt-zuerich.ch/dataset/sid_dav_verkehrszaehlung_miv_od2031) exposes a complete CKAN Datastore copy of the annual CSV. The downloader resolves the resource from the catalogue rather than hard-coding its ID, then pages explicit columns in `_id` order with separate count reconciliation. This avoids fetching the 357 MB 2026 CSV. The actual selected URLs and resource ID are pinned in the manifest.

The adapter keys on **MSID**, within **ZSID** station scope. A measurement site can aggregate several detector loops; `AnzDetektoren`, `D1ID`–`D4ID` and signal identity are retained as metadata and are **not** expanded into duplicate counts. The published LV95 coordinates are retained and converted to WGS84 with the same swisstopo polynomial approximation as the existing national road ingester. Direction labels such as `einwärts` and `auswärts` remain source text, not road-path orientation.

Each day has **5,040 measured and 168 explicitly missing** rows, with no imputations in these selected dates. Seven MSIDs across **Z045 Talstrasse**, **Z060 Hermetschloobrücke**, **Z062 Brunaustrasse** and **Z100 Rautistrasse** are missing all day. The adapter also handles `Imputiert` explicitly; tests cover it even though this fixture has none. Unknown quality statuses are flagged and excluded from the complete-measured metric.

The acquired catalogue declares **Creative Commons CCZero**, publisher **Stadt Zürich, Dienstabteilung Verkehr**. It also documents local daylight-saving behaviour and links the detector plans and current geographic station inventory. The large PDF-plan archive has not been acquired or reviewed in this increment.

## Shared representation and gates

- Counts remain **hourly counts**, with original source time, explicit UTC interval where resolvable, original class keys, quality/validation flags, and a pointer to the raw source row. There are no inferred speed, density, congestion or travel-time fields.
- Basel's offset-bearing timestamps resolve both autumn hours. For Thurgau and Zürich local timestamps, nonexistent spring hours and ambiguous autumn folds are quarantined, preserving their counts and raw row references. API order is not evidence for assigning the first/second autumn hour. Expected daily coverage correctly uses 23, 24 or 25 hours.
- Missing, invalid, imputed, edited, unapproved and measured values remain distinct. An explicit measured zero remains zero. Unknown status and class-total discrepancies are reported. Conflicting duplicates or changing counter metadata fail compilation; identical duplicates are counted once and reported.
- Every source file is hash-checked before compilation. Offline compilation also rechecks source/date row totals. Acquisition refuses to overwrite a snapshot directory and writes `complete: true` only when every request reconciles. Publisher queries are not transactional; these checks detect truncation and count changes, not every possible simultaneous upstream revision.
- The overlap screen uses **1,500 m** against the committed federal and Zürich-cantonal counter coordinates, which are coarse. It flags candidates near **19 Basel, 22 Thurgau and 55 municipal station identities**. This deliberately broad radius is a review aid; it does not establish duplicates, join directions or authorize merging counts. Reference file hashes are pinned in the audit.
- Every counter remains `geometryStatus: unmatched` and `playbackEligible: false`. No paths are invented between counter points and no series is summed with a successive counter or another publisher.

## Reproduce and extend

Python **3.9+** with system IANA time-zone data and `curl` is sufficient; no Python packages or credentials are needed. Run from the repository root:

```sh
# Offline: validates every original source hash before writing derived files.
python3 -B scripts/regional_road_counts.py \
  --snapshot data/regional-road-sources/2026-09-08 \
  --output data/regional-road-counts.json.gz \
  --audit data/regional-road-count-audit.json \
  --reference public/data/swiss-road-topology.json \
  --reference data/zurich-cantonal-road-counters.json

# Online: use a NEW directory; API retention limits apply, especially in Thurgau.
python3 -B scripts/download-regional-road-counts.py \
  --dates 2026-09-04,2026-09-06 \
  --output /tmp/gleislicht-regional-road-refresh

# Included in the normal Vitest suite through regional-road-counts.test.mjs.
python3 -B -m unittest discover -s scripts -p test_regional_road_counts.py
```

The pinned suite verifies offline artifact reproduction, export truncation, source-hash tampering, duplicate conflicts, date boundaries, 23/25-hour days, ambiguous/nonexistent hours, zero/missing/imputed semantics, validation flags, class differences and municipal aggregate identity.

## Follow-up status

Official axes for all three sources, the municipal station map and Thurgau class counts are now acquired and audited in the [second increment](REGIONAL-ROAD-GEOMETRY.md). Detector-direction reviews, corridor continuity, detailed counter-overlap resolution and annual history remain. The Basel LSA discrepancy and Weinfelden Sunday absences remain visible.

After those reviews, build an explicitly labelled hourly volume presentation or a separately declared motion model. Measured speed and travel conditions cannot be recovered from these counts alone. Public study registration is a later gate, following source scope, path and clock validation.
