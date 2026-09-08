# Cantonal coverage and junction review — 8 September 2026

**Horgen has recurring source gaps; Wallisellen–Bassersdorf is the next viable recorded corridor.** The latter now has a compiled, direction-reviewed 104-minute draft. It is not yet enabled in AUTO. The existing public Horgen pilot remains unchanged.

## Archive findings

The exported Cloudflare archive contains all **245 scheduled measurement minutes from 13:23 through 17:27 CEST** on 8 September 2026. There are no missing archive minutes in this interval. The separate 13:21 manual sample is outside the audit window. Raw snapshots remain in the ignored recording directory; the committed [coverage audit](../data/zurich-cantonal-road-coverage-audit.json) contains aggregate availability, detector failure counts, input hashes and the 245-file source manifest.

| Counter / pair | Complete minutes | Longest complete run |
| --- | ---: | --- |
| Horgen 4290 | 245 / 245 (100%) | 245 minutes |
| Horgen 4590 | 166 / 245 (67.76%) | 28 minutes, 14:53–15:20 |
| Both Horgen counters | 166 / 245 (67.76%) | 28 minutes, 14:53–15:20 |
| Wallisellen 0088 + Bassersdorf 2092 | 233 / 245 (95.10%) | **104 minutes, 14:14–15:57** |
| Bassersdorf 2092 + Lindau 0908 | 245 / 245 (100%) | 245 minutes; direction still unresolved |

Horgen 4590 reports its two detector identities but lacks usable light **and** heavy flow values on both lanes for the same 79 minutes, spread across 11 gaps. Counter 4290 is complete throughout. The longest gap is 25 minutes, 17:02–17:26. This distinguishes recurring source incompleteness from a missed recorder invocation; it does not diagnose the physical counter or upstream supplier software. A complete Horgen hour cannot be produced from this export without filling missing observations.

The 28-minute Horgen run compiles successfully as a local draft. The published 40-minute segmented pilot is retained: its dates, gaps and aggregate values rebuild identically after the stricter validation described below.

## Junction evidence

![Official road-axis geometry around the two counter corridors](assets/cantonal-counter-review.svg)

The [official Zürich road-network dataset](https://geolion.zh.ch/geodatensatz/804.html) covers national and cantonal roads plus municipal roads important to the traffic model. It is not an inventory of every municipal street or private entrance. The [pinned WFS extracts](../data/zurich-cantonal-road-junction-sources.json) contain 24 features around Horgen and 131 around Wallisellen–Bassersdorf, with retrieval time, request URLs and hashes. The source features carry the road-model date 6 August 2026.

The [junction audit](../data/zurich-cantonal-road-junction-audit.json) projects other road-axis endpoints onto each counter section. It accepts candidate approaches within 15 m, groups approaches within 30 m along the section, and excludes the first/last 25 m at the counters. These are geometric junction candidates, not proof of grade, permitted turns or measured turn volumes.

Horgen has three clear junction areas between the counters, measured from counter 4590:

| Approximate position | Connected axis | Source description |
| --- | --- | --- |
| 315 m | ZH 702 | Hirsacher–Horgen/Meilen ferry access |
| 705 m | ZH 341 / K-003 | Hanegg–Horgen approach and roundabout geometry |
| 1,162 m | ZH 686 | Rietwiesstrasse / Seegüetli approach |

The canton's [Rietwiesstrasse project decision](https://www.zh.ch/de/politik-staat/gesetze-beschluesse/beschluesse-des-regierungsrates/rrb/regierungsratsbeschluss-41-2021.html) independently identifies road 686 and its connection to Seestrasse. Together with the road geometry, this makes the unmeasured turning-flow limitation material. Ferry access may introduce bursts, but this review does not attribute any particular observation to ferry traffic.

Across Horgen's 166 simultaneously complete minutes, the positive-direction endpoint totals are 609 and 819 vehicles; negative-direction totals are 610 and 462. These sum reported hourly rates divided by 60 over common samples. They are **not travel-time-aligned vehicle matches**, and the differences are **not estimates of junction turns**. Storage within the section, travel time, omitted periods, counter behaviour and intervening junctions can all affect the comparison.

The second corridor has five geometric junction areas, including municipal approaches and the 10530/15301 interchange approaches. It therefore uses the same counter-based reconstruction caveat. This review does not establish vehicle conservation between its counters.

## Second corridor: Wallisellen–Bassersdorf

The selected section is **3.457 km of ZH 1**, from counter `ZH.CH:0088` on Neue Winterthurerstrasse in Wallisellen to `ZH.CH:2092` in Bassersdorf. The source path is continuous and has no unresolved intervening counter. All four directional detector sites have complete light/heavy observations throughout **14:14–15:57 CEST**, giving 104 samples.

Bassersdorf already passes the automatic destination checks. At Wallisellen, the Winterthur direction passes; the Zürich direction passes destination distance, projection and local bearing (-0.92) but fails the conservative settlement-extent check because Zürich's large bounds cross the station.

The [explicit station review](../data/zurich-cantonal-road-direction-reviews.json) resolves only this pinned case using the independently validated Winterthur lane, exactly two opposing main-carriageway normal lanes in the catalog, the source's Zürich/Winterthur labels, and the local ZH 1 geometry. Winterthur follows positive stored path order, so the opposing Zürich lane follows negative order. This is a documented source-evidence inference, not a surveyed vehicle trajectory. The general settlement-extent gate is unchanged; the original failed status is preserved alongside the review.

The review fails closed if the catalog, base geometry, detector audit, anchor direction or supporting WFS extract changes. It does not apply to extra lanes, slip roads, ambiguous names or bearing conflicts. In particular, Lindau 0908 remains unresolved despite its excellent recording coverage. The Bülach motorway counter near Höri also remains excluded from cantonal playback.

Applying the review yields eight accepted stations, 16 directional sites and four directed sections across two roads. This is a separate optional build from the original seven-station baseline, preserving the reproducibility of the public Horgen pilot.

The [compiled-draft audit](../data/wallisellen-bassersdorf-draft-audit.json) records 104 complete samples, four sites, two sections, 100% site coverage and the direction-review hashes. The existing playback reader was checked at every recorded minute: reconstructed counts range from **37 to 98 vehicles**. The full draft and chunks remain under the ignored `recordings/astra-zurich-cantonal/wallisellen-bassersdorf-draft/` directory.

## Reproduce

Export the recording day using the credentials documented in [Cloudflare operations](CLOUDFLARE.md), then run:

```sh
node scripts/audit-cantonal-road-coverage.mjs \
  --date=2026-09-08 --from=13:23 --to=17:27
node scripts/audit-cantonal-road-junctions.mjs

node scripts/validate-cantonal-road-directions.mjs \
  --places=data/zurich-cantonal-road-directions.json \
  --reviews=data/zurich-cantonal-road-direction-reviews.json \
  --output=/tmp/zurich-directions-reviewed.json

node scripts/compile-cantonal-road-study.mjs \
  --topology=/tmp/zurich-directions-reviewed.json --road=ZH:1 \
  --date=2026-09-08 --from=14:14 --to=15:57 --minimum-samples=104 \
  --output=recordings/astra-zurich-cantonal/wallisellen-bassersdorf-draft

node scripts/compile-cantonal-road-study.mjs \
  --date=2026-09-08 --from=14:53 --to=15:20 --minimum-samples=28 \
  --output=recordings/astra-zurich-cantonal/horgen-longer-draft
```

The audit defaults to the original automatic direction topology, so its candidate statuses intentionally describe the baseline before the explicit Wallisellen review. `--from`/`--to` keep the archived evidence window fixed as later files arrive. `--input` and `--output` allow alternate archive and report paths.

## Validation and next implementation

The review exposed a compiler edge case: aggregation could accept a direction when all detector IDs were present but one lane lacked a vehicle class, because another complete lane supplied the aggregate. Cantonal compilation now checks **every lane and both classes before aggregation**. Positive flow requires a positive speed; zero flow may omit speed. Federal compilation behaviour is unchanged.

Validation: **244 tests across 63 files passed**, including changed evidence, invalid anchors/carriageways, incomplete multi-lane observations, missing archive minutes, source failures, duplicate conflicts and partial WFS responses. Lint passes for the changed scripts. The existing Horgen public artifact rebuilds byte-for-byte identically.

The next product step is to generalize the optional cantonal playback control to select the reviewed **ZH 1 corridor and its 104-minute window**, with its own recording identity and junction disclosure. No additional roads are animated by this review alone.
