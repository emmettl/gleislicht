# Regional detector directions and corridor review

Implemented **8 September 2026**, following the [geometry and class-count import](REGIONAL-ROAD-GEOMETRY.md). The [direction audit](../data/regional-road-direction-audit.json) resolves **31 of 620 series** from source descriptions, official plans and geometry. All 31 have complete measured hourly records on both 4 and 6 September. This is local orientation evidence for a directional volume display; it does not establish speed, turn splits or vehicle trajectories.

| Region | Resolved series | Evidence |
| --- | ---: | --- |
| Basel-Stadt | 2 | Counter 419, explicit `von/nach Feldbergstrasse`, connected official Riehenring geometry |
| Thurgau | 23 | Exact `von/nach` settlement labels, swissNAMES3D settlement bounds and cantonal axis projection |
| Zürich city | 6 | Z001, Z040 and Z069, with detector-loop identities checked against three official plans |

All other series retain a specific unresolved status. No nearest-place fallback, automatic interpretation of unqualified place labels, or relaxation of the previous geometry gates is introduced. `positive` follows stored source vertices; it is not a publisher's direction code. `validated` means the documented local orientation check passed, not that the source's raw counts are officially approved. Basel's unapproved and Thurgau's current-year raw measurement status remain in the count artifacts.

## Reviewed Zürich plans

Three original one-page PDFs are retained in the [direction source snapshot](../data/regional-road-direction-sources/2026-09-08/manifest.json). They were visually inspected as complete rendered pages. The manifest records each PDF's hash and archive member, plus the URL, size and hash of the original municipal archive; the entire 169 MB archive is not duplicated in the repository. Municipal catalogue CCZero attribution is retained.

| Plan | Source loops | Reviewed local travel |
| --- | --- | --- |
| [Z001 / K789, Badanstalt Wollishofen](../data/regional-road-direction-sources/2026-09-08/ZS001-K789-Detektorplan.pdf), printed 22 May 2024 | M001: loop 2; M002: loop 1 | M001 southeast / outward; M002 northwest / inward |
| [Z040 / K003, Kalkbreite-/Seebahnstrasse](../data/regional-road-direction-sources/2026-09-08/ZS040-K003-Detektorplan.pdf), printed 13 August 2026 | M001: loops 11 and 12; M002: loop 20 | M001 southeast toward junction; M002 northwest toward junction |
| [Z069 / K035, Seebahn-/Stauffacherstrasse](../data/regional-road-direction-sources/2026-09-08/ZS069-K035-Detektorplan.pdf), printed 13 August 2026 | M001: loop 19; M002: loop 20 | M001 southwest toward junction; M002 northeast toward junction |

At Z040 and Z069, **`Hohlstrasse` identifies the approach**, rather than the destination of the lane arrows. Treating every direction label as a destination would reverse these flows. The corresponding opposing labels likewise name approaches. Plans show turning traffic at these junctions, so these aggregate detector counts cannot be carried unchanged through them.

Z001 uses the north arrow, lane placement and the published `auswärts/einwärts` labels. There is no motor-vehicle arrow at the reviewed loops, and its review explicitly records that additional inference. Plan print dates are not asserted to prove the configuration on every historical observation day.

The [eight explicit reviews](../data/regional-road-direction-reviews.json) pin the count audit, geometry audit/artifact, source manifest and Basel road response. Zürich reviews additionally pin exact MSID, signal ID, loop array, detector count, path ID, source label, PDF hash and page. The compiler checks the inferred travel bearing against the local axis with a 20-degree tolerance and fails on changed mappings or reversed bearings.

## Basel named-junction review

Counter **419, Riehenring 120**, distinguishes `von Feldbergstrasse` from `nach Feldbergstrasse`. Official Riehenring features **5093 → 5094** form a continuous chain north from the counter to the shared endpoint of Feldbergstrasse features **3936 and 3937**. Thus `nach` follows positive source vertex order and `von` follows negative order.

This is a bounded named-junction review. It checks the exact connected chain, street names, shared coordinates and source bytes. It does not weaken settlement-distance gates to accommodate short urban fragments or infer other Basel lanes automatically. Basel geometry credit: Amt für Mobilität, CC BY 4.0; catalogue attribution is carried into the audit.

## Thurgau destination checks

Sixteen exact settlement searches are preserved as original compressed responses from swisstopo's swissNAMES3D service. Only exact settlement names and valid LV95 bounds are admitted; homonyms remain alternatives. Unacquired names remain explicitly unresolved. This is a bounded initial place set, not a completed destination inventory.

The compiler reuses the existing cantonal direction checks: at least 1,500 m to the destination, at least 750 m separation along the same path, at most 1,500 m destination-to-axis distance, local bearing agreement of at least 0.75, and consistent direction across the settlement bounding box. `von` reverses the accepted destination direction. Bare labels and roundabout names are not inferred. The result is 23 accepted orientations; close settlements, off-axis destinations, conflicting bearings and unresolved extents retain their individual failure reasons.

## Corridor continuity remains a separate gate

The audit records **196 adjacent station pairs on shared source paths**, including unresolved counters with candidate matches. These are diagnostic pairs, not 196 approved corridors. They include uncertain nearby-path associations. Geometry continuity is established only within the same original polyline; this increment does not build connections across separate features.

Every pair remains held pending junction and turning-movement review. Additional reasons can overlap: 194 pairs have unresolved endpoints or axes, 194 lack complete opposing directions, 145 are less than 100 m apart, 11 exceed 5 km, 30 mix measurement bases, and 7 have incomplete measured days. The audit retains the intervening unresolved stations rather than connecting accepted counters across them.

On H13, the class-count stations **61103 → 61101** are about **147 m** apart and have both directions resolved. Their common axis still does not prove an uninterrupted traffic section. The next pair, **61101 → 40802**, spans about **3.78 km** and additionally mixes published class sums with separately reported totals. These endpoints are not summed, substituted for each other or promoted to playback. Local-road junctions can be absent from a cantonal-axis dataset; absence from that geometry is not evidence of no junction.

Each direction record exposes `directionalVolumeCandidate` separately from `playbackEligible`. The former is true for the 31 resolved series with complete hours; the latter remains false everywhere. A future counter volume view can use these orientations without claiming motion between counters. Source hours, quality and class sums remain in the existing observation artifacts and are not rewritten by this audit.

## Reproduction

```sh
# Offline: verify all pinned inputs and regenerate the review audit.
node scripts/audit-regional-road-directions.mjs

# Regression checks, including the previous 26 Python ingestion/geometry cases.
npx vitest run scripts/regional-road-directions.test.mjs scripts/regional-road-counts.test.mjs

# Refresh evidence into a NEW directory after retrieving the official archive.
curl --fail --location --output /tmp/regional-road-plans.zip \
  https://data.stadt-zuerich.ch/dataset/sid_dav_verkehrszaehlung_miv_od2031/download/Zaehlstellen_Detail.zip
python3 -B scripts/download-regional-road-direction-sources.py \
  --plans-archive /tmp/regional-road-plans.zip \
  --output /tmp/regional-road-direction-refresh
```

The 12 direction/corridor regression cases cover exact artifact reproduction, `von` reversal, homonyms, short-distance rejection, approach labels, changed loop mappings, wrong bearings, disconnected named-road geometry, changed labels/axis gates, incomplete hours, corrupted source bytes, unresolved intervening counters, mixed measurement bases and junction holds. Refreshing sources requires reviewing the changed evidence and pins; fresh bytes are never silently substituted under the existing reviews.
