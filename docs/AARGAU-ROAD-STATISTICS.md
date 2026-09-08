# Aargau road survey statistics

Implemented **9 September 2026**, using the [8 September pinned source survey](REGIONAL-ROAD-EXPANSION.md). This is an internal statistical import; no public display or road playback is admitted.

The importer retains **10,093 motor-traffic records across 911 station IDs**, including historical and other-owner records. It explicitly excludes the 129 cycle rows. The source ZIP, extraction date, CSV member and hash are recorded in the output metadata. CSV row numbers include the header, and content hashes identify individual records without depending on export order. IDs identify source records, not persistent survey entities across revisions.

## Preserved meaning

- `DTV` remains an annualized daily estimate; `DTV24` is the survey-period daily mean. Weekday, daytime, nighttime and peak-hour averages have separate definitions. None becomes a dated hourly observation.
- Survey boundaries remain local civil timestamps in Europe/Zurich, with the end exclusive. **5,222 records have no boundaries**, so they retain a reference year without an invented January–December period. Another **three ZH1390 records have identical start/end times**; these remain flagged as invalid periods. The remaining 4,868 records have ordered boundaries.
- Both-direction totals and each directional component remain separate records. They must never be added together. Different surveys at a station are also independent records, not measurements to sum. `latestPlausible` is the publisher's flag, not a freshness or raw-observation guarantee.
- Counter and measurement positions remain distinct LV95 coordinate pairs. Destination labels are retained, but no bearing or connecting road geometry has been approved.
- All original fields survive, including missing values and equipment/class schemes. Seven core metrics are normalized numerically; class statistics remain source fields pending a review of their definitions and comparability. Empty values stay missing, while zero and fractional means are preserved.

## Report quality

The [report review file](../data/aargau-road-statistics-reviews.json) binds the Fislisbach holiday substitution to the pinned PDF hash, station and exact survey period. All three matching records—both directions, direction 1 and direction 2—carry `holiday-data-substitution`. The report replaces **1 May 2026** with **8 May 2026** data. This prevents the CSV's absence of an explicit substitution flag from hiding known report evidence.

The other **10,090 records remain report-unreviewed**. That does not imply they are faulty; it means CSV values alone do not establish whether report-level substitutions or other qualifications apply. No typical-hour profile has been extracted, and no measured speed is inferred.

## Reproduce and verify

```sh
python3 scripts/aargau_road_statistics.py
python3 -m unittest discover -s scripts -p 'test_aargau_road_statistics.py'
```

The [compressed records](../data/aargau-road-statistics.json.gz) and [audit](../data/aargau-road-statistics-audit.json) are deterministic. Validation checks source/report hashes, complete row accounting, reproducibility, missing and fractional values, distinct metrics and coordinates, invalid periods, identity, code/schema failures and report qualifications across directions.

Next: build a statistical explorer with station, reference-year and survey-period selection, showing report-review status and distinct metric labels. Resolve invalid periods and cross-source counter overlap before combining coverage. Keep class comparisons and profile extraction out of admission until their source definitions and report notes have been reviewed. Geneva and Luzern remain at the [source-survey stage](REGIONAL-ROAD-EXPANSION.md).
