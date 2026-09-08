# Exploring Gleislicht

Implemented in the edition against exact shared package release `0.1.0-alpha.6`.

## Now

The Now button follows `Europe/Zurich` civil time at realtime pace, with a steady camera. Morning national and regional studies move to their full-day datasets before starting. Scheduled PostBus and Rigi can also qualify. Historical air and road overlays do not offer Now. A current fixture is labelled as today's timetable; a recent representative fixture is labelled explicitly. The representative rule accepts at most 31 days of difference and distinguishes weekdays, Saturdays and Sundays. This is an impression of transport at this hour, not a holiday-aware current journey planner. No date is rewritten in the source data.

Swiss clock conversion handles both daylight-saving changes and local midnight. Outside a source window or the representative-date rule, Now stops with a visible message rather than wrapping a partial recording. Pause, scrub, speed changes, director mode, moving-train selection and study changes return control to playback. `1:1` in the speed picker means one second per second; the existing accelerated tempo presets retain their previous speeds.

Near me makes a single browser location request on activation. It shows accuracy in metres, reports denial, timeouts and unsupported or out-of-study locations, and preserves the camera for an out-of-study position. Clear location discards it; study changes clear it too. It is neither persisted nor included in share URLs.

## Full-day regional data

All three fixtures use national GTFS `20260902` on **4 September 2026**:

| Study | Scheduled/representative services | Local geometry coverage |
| --- | ---: | ---: |
| Zürich city | 18,398 | 98.6% |
| ZVV region | 34,612 | 98.4% |
| Genève / TPG | 10,805 | 96.7% |

Local geometry percentages count tram/bus segment occurrences. ZVV local services are constrained by its source stop catalogue; Genève retains agency 881 for local bus/tram service. Rail uses a separate official FOT graph join. Local and rail paths occupy distinct indices; rail enrichment never substitutes railway geometry for an unmatched bus movement. Frequency-based services retain their disclosed source intervals and illustrative status.

The morning artifacts remain separate. Each full day uses twelve two-hour movement chunks with SHA-256 and byte-length verification. The manifest is limited to 650 KiB gzip and each movement chunk to 450 KiB; only the current block and its neighbours load. National opening data does not request these files. Failed or corrupt chunks show unavailable status and can be retried, with missing vehicle counts represented by a dash.

Rebuild all three using retained official input files:

```sh
npm run data:regional:days -- \
  --archive /path/GTFS_FP2026_20260902.zip \
  --zvv /path/zvv.zip \
  --tpg /path/tpg-lines.geojson \
  --rail /path/schienennetz_2056_de.xtf \
  --date 2026-09-04
```

An optional `--study zurich-city`, `zvv-region` or `geneva-tpg` rebuilds one region. The command performs no network requests and records input hashes, source metadata, coverage and the service date. Temporary full-day snapshots remain outside the repository. A new service date needs the matching source calendar. `npm run build` regenerates the browser summaries directly from the final artifact metadata.

## Discovery and links

Explore studies is an accessible modal with geographic/movement sketches, translated names and descriptions, dates and full-day coverage. It lazy-loads its own code and styles. The previews are symbolic compositions, not miniature maps or data plots.

Links contain `study`, `range`, `date` and seconds after midnight in `time`, plus a supported `station` name or `train` identifier. They restore paused playback against the available artifact. Unknown studies fall back to the national morning view; invalid times are ignored and valid out-of-window times are bounded to the available window. A date or selection that cannot be restored is disclosed. A shared link does not create or promise an archive for a missing date.

Unit and data checks cover clock transitions, representative eligibility, URL validation, exclusion of location coordinates, complete chunk coverage, integrity and geometry indices. Browser checks cover lazy loading, Now and location, partial-to-full-day entry, seeks, shared-view restoration, unavailable dates and chunk recovery in Chromium and emulated iPhone WebKit. These do not establish performance on physical phones or Windows hardware.

## Automatic publication

The existing daily Pages run (03:37 UTC), pushes to `main`, and manual runs now refresh Zürich city, ZVV and Genève alongside national rail and PostBus. A single Swiss civil date feeds both parallel data jobs. The annual source year changes on the second Sunday of December. The committed examples remain deterministic; fresh data are assembled in the publication runner.

`node scripts/download-regional-sources.mjs /path/sources YYYY-MM-DD` downloads national GTFS, the matching ZVV archive, FOT rail geometry and all TPG line features. TPG retrieval first enumerates IDs, then checks every bounded batch to reject truncated responses. The builder accepts `--source-catalogue /path/sources/sources.json` to retain the exact source URLs and `--output-directory /path/output` for isolated builds. It generates all three full days and derives their 06:45–08:45 morning windows from the same source and geometry. Morning geometry coverage labels refer to the full-day join. Every requested study validates before any output is replaced; intermediate files are removed afterwards.

Each pair must have matching service dates and feed versions. Checks cover twelve contiguous two-hour chunks, bytes/SHA-256, unique day trip counts, finite coordinates and valid stop/path indices, source hashes, local/rail coverage and transfer ceilings (650 KiB manifest, 450 KiB chunk, 1,600 KiB morning, gzip). Run them with `node scripts/regional-artifacts.mjs /path/output` using the project's Node version.

If a download fails, `node scripts/restore-published-regional-data.mjs /path/output` retrieves and validates the complete published set before writing anything. It retains the original dates, so the existing Now disclosure distinguishes today's timetable from a representative one. Failed generation, invalid fallback data or exceeded budgets stop deployment and leave the current site available. No aircraft, road-recording, Rigi, or contrast fixture is silently advanced to today's date.

The final build regenerates `study-summaries.json` from the actual national, PostBus, regional, Rigi and contrast artifacts. This also updates dates after national recovery or review-branch generation; a summary cannot claim a requested date that its source does not contain.
