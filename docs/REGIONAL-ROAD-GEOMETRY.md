# Regional road geometry and Thurgau class coverage

Implemented **8 September 2026** after the [hourly-count import](REGIONAL-ROAD-IMPORT.md), committed in `c5a8802`. This second increment acquires official axes for all three regions, joins municipal station identities, screens road matches and brings in Thurgau's separate class-count family. The result is a reproducible candidate geometry artifact and review audit, not a published AUTO feed.

## Coverage

The [geometry audit](../data/regional-road-geometry-audit.json) covers **620 directional/lane or municipal measurement-site series**. It identifies **363 axis candidates**, of which **355 have complete measured data on both 4 and 6 September**. None has yet been admitted to directional playback. Counts, lane totals and class sums are not interchangeable network-wide traffic totals.

| Source | Series reviewed | Axis candidates | Candidates complete on both days | Ambiguous axis | Other review/exclusion |
| --- | ---: | ---: | ---: | ---: | ---: |
| Basel-Stadt | 63 | 31 | 30 | 21 | 11 |
| Thurgau, both products | 340 | 244 | 240 | 22 | 74 |
| Zürich city | 217 | 88 | 85 | 101 | 28 |

Other statuses are explicit in the audit: distance beyond the threshold, no nearby axis, road-name/number conflict, excluded motorway/access/path scope, and municipal inventory disagreement. A candidate is a local axis association only; it does not establish a through-road corridor, permitted turning movement or which way vehicles travel along stored coordinates.

## Official geometry acquired

The [source manifest](../data/regional-road-geometry-sources/2026-09-08/manifest.json) pins URLs, original response hashes, byte sizes and acquisition timestamps. Compressed original responses are retained alongside it. WFS feature counts are checked with separate `resultType=hits` requests; Basel's export is checked against its API count. All are verified again offline. Catalogue modification dates are preserved as catalogue dates, not asserted to be survey dates or the historical configuration on each observation day.

| Source | Acquired coverage | Reuse declaration |
| --- | --- | --- |
| [Basel `100250`, street types and paths](https://data.bs.ch/explore/dataset/100250/) | 7,553 LineStrings; hierarchy, street identity/name and posted speed fields | CC BY 4.0, publisher credit preserved from catalogue |
| [Thurgau cantonal axes](https://data.tg.ch/explore/dataset/kantonsstrassenachsen/) | 159 features from the advertised WFS, including multipart geometry; road number, owner and axis-position codes | CC BY 4.0 |
| [Zürich city VAS](https://data.stadt-zuerich.ch/dataset/geo_verkehrsachsensystem_stadt_zuerich) | 9,972 axes, 8,068 motor-traffic events and 1,690 one-way events | CCZero, Stadt Zürich |
| [Zürich municipal counter map](https://data.stadt-zuerich.ch/dataset/geo_standorte_der_verkehrszaehlungen_miv) | 114 station points: 113 marked active and one marked historical | CCZero, Stadt Zürich |

The Thurgau ODS road catalogue has **zero inline records** but advertises a functioning WFS. Its absence of table rows must not be interpreted as an absence of road geometry. The downloader uses the advertised `ms:kantonsstrassenachsen` layer in explicit LV95 coordinates.

Basel retains all road classes in matching competition, including motorway ramps and paths. Excluding those features before searching would risk snapping a motorway or path-adjacent counter to a nearby eligible road. Only HVS, HSS, QSS and ES classes are candidates for this urban stage. Thurgau requires cantonal owner, recognised main/secondary axis class and undivided `pos_code='='`. The two separate `+`/`-` axis features remain competitors, not automatically admitted carriageways.

## Matching rules

- Original LV95 geometry is retained. Basel WGS84 axes and Basel/Thurgau count coordinates use the same swisstopo polynomial approximation as the existing road pipeline. Multipart axes remain separate parts; no artificial line joins are inserted.
- Search within **100 m**. The closest axis must be within **35 m** and agree with the source road label/number. Basel uses an explicit street-name substring in the count/inventory name; Thurgau uses exact road number; Zürich uses the municipal `Achse` name. No fuzzy nearest-name substitution is used.
- Competing local alignments within **10 m of the best distance** require review. Parallel alignments of the same road and distant bends of the same path remain competitors. Only near-adjacent edges, or same-road pieces meeting at a common endpoint with a continuous tangent, are treated as one local alignment. Junction branches are not merged away.
- Zürich requires an applicable VAS event with `miv_vorhanden='ja'`. Missing or conflicting modes do not imply motor access. Chainage is checked against geometric length before joining the local event.
- Zürich one-way events are retained by street name and chainage as **review evidence**. They do not directly identify an MSID's orientation. `FT`/`TF` and `einwärts`/`auswärts` are not silently equated. Two of the 88 municipal axis candidates have nearby applicable one-way event records; all detector directions remain unresolved.
- Counter points are not moved to road centerlines in the original observations. Projected coordinates, offsets, source path IDs and competing candidates are separate audit fields. Posted speed attributes are not used as measured traffic speed.

The [derived geometry artifact](../data/regional-road-geometry.json.gz) includes original unsimplified candidate paths in LV95 and Thurgau class observations. Each audited best/candidate path ID resolves within it. It has no drivable graph or moving-vehicle reconstruction. Source attribution and catalogue references travel with its metadata.

## Zürich station-coordinate reconciliation

All 113 sampled ZSID identities occur in the current station inventory. The WFS point geometry is authoritative for its declared CRS; the `ekoord` and `nkoord` attributes are reversed in the inspected records and are not used for positioning.

The hourly data's **measurement-site** LV95 coordinates are compared to the inventory's **station** point. **193 MSIDs are within 50 m; 24 exceed 50 m**, across 16 ZSIDs. This can reflect a station marker positioned away from its individual detectors, different placement conventions or changed data. The audit calls these coordinate conflicts for review, not demonstrated measurement errors. For example, the first compared **Z102 Badenerstrasse (Farbhof)** site is about **296 m** from its station-map point.

Eleven otherwise plausible road matches are held at `station-inventory-review`; other mismatches retain their more immediate axis-review status. The matcher continues using the measurement-site coordinates and does not replace them with a common station centroid. Any inventory entry not marked active is separately held for review. Detector plans are still needed to resolve these locations and directions.

## Thurgau class product is additional coverage

The [dbu-tba-1 class dataset](https://data.tg.ch/explore/dataset/dbu-tba-1/) contains **5,760 hourly records**, comprising **60 stations / 120 directional series**, for the same two dates. Its station-code set is disjoint from the total-product snapshot's 109 station codes. Accordingly, **none** of these class records is joined to a total-product observation. This is a snapshot finding, not a guarantee that the products never overlap.

The new family has `thurgau-classes:` series IDs while preserving the publisher's station IDs, lane and direction labels. All ten published class keys remain explicit. `classSum` is labelled `sum-of-published-classes`; it is not fabricated as a separately measured `total`. All class values are valid in these two slices, and all 120 series have 48 complete hours. **98 of these new series** have axis candidates with complete data on both days, in addition to the total-product candidates.

The matcher can reconcile a class row to a total row only when station code, lane, exact direction label and UTC hour agree. A discrepancy is reported, and totals are never added to their constituent classes. An absent total-product counterpart is expected standalone coverage, not a missing measurement. Invalid classes or unresolved local time are held out of complete-hour counts. Current-year raw validation status remains pinned to acquisition year. The class catalogue declares **CC0 1.0**, separately from the road-geometry licence.

The initial 23,832 total-product/municipal/Basel records are unchanged. Together with this new family, the two increments now preserve **29,592 hourly source rows**. Annual history acquisition remains future work beyond this bounded weekday/Sunday comparison.

## Reproduction and validation

From the repository root, with Python 3.9+, IANA time zones and `curl`:

```sh
# Offline source verification, geometry matching and class normalization.
python3 -B scripts/regional_road_geometry.py \
  --snapshot data/regional-road-geometry-sources/2026-09-08 \
  --output data/regional-road-geometry.json.gz \
  --audit data/regional-road-geometry-audit.json

# Refresh into a NEW directory. --resume verifies and reuses an incomplete snapshot.
python3 -B scripts/download-regional-road-geometry.py \
  --output /tmp/gleislicht-regional-road-geometry-refresh \
  --dates 2026-09-04,2026-09-06

python3 -B -m unittest discover -s scripts -p 'test_regional_road_*.py'
```

The 26 Python checks are included in normal Vitest execution. They verify pinned artifact reproduction, hourly semantics, source completeness/integrity, parallel roads, same-road hairpins, junction branches, excluded-road competition, scope/distance/name gates, motor-mode conflicts, class-total discrepancies and separation of one-way evidence from detector direction.

The next concrete step is a small set of documented detector-direction reviews, followed by corridor continuity and junction checks. Zürich detector plans, Basel's lane descriptions and inventory, and Thurgau's road-number/destination labels provide source evidence to inspect. Counter-to-axis candidates alone do not justify directional motion; an hourly volume presentation remains the appropriate alternative when direction or speed is unresolved.
