# Graubünden: complete bus-pattern recovery

This review adds **145 Friday and 119 Sunday complete journeys** to the initial study. Bus admission is now **5,691 / 5,762** and **4,484 / 4,561**. After the subsequent [Bern/Basel rail review](GRAUBUENDEN-RAIL-COMPLETION.md), rail admits 854 / 856 and 840 / 842; the application has **6,545** and **5,324** complete journeys. The whole-canton denominators remain 39,402 and 38,425, including unsupported mountain, boat and tram candidates. These are numerical geometry checks, not operator certification.

[Machine-readable before/after review](../data/graubuenden-audit/access-road-review.json) · [Explicit admission policy](../data/graubuenden-access-roads/policy.json) · [Source pins](../data/graubuenden-access-roads/sources.json) · [Every annual route](GRAUBUENDEN-ROUTE-INVENTORY.md)

## Scope and admission

Every one of the **24 route records with a previously excluded bus journey** was investigated, using all **187 complete fixture patterns** on those routes. The pfaedle run produces 155 entirely matched trial patterns. **35** newly recovering road-pattern identities are explicitly admitted. Existing complete primary patterns keep their exact paths and provenance, even if an alternative run also succeeds. All 5,546 previously admitted Friday buses and 4,365 Sunday buses are identical. A successful subset of a failed pattern is never spliced into another run; every newly admitted journey uses one complete pattern from the supplemental run. Full GTFS calls, times, sequence, call rules and external termini remain unchanged.

The route-level table below accounts for all 24 trials, including routes with no gain. The machine-readable audit assigns a disposition to every one of the 187 patterns and retains every remaining primary failure and trial failure.

| Route / agency / line | Trial patterns | Friday gained / still excluded | Sunday gained / still excluded |
| --- | ---: | ---: | ---: |
| 92-420-C-j26-1 / 865 / 420 | 8 | 13 / 0 | 13 / 0 |
| 92-557-A-j26-1 / 7081 / 557 | 2 | 0 / 4 | 0 / 4 |
| 92-593-A-j26-1 / 3257 / 593 | 2 | 8 / 0 | 8 / 0 |
| 92-701-C-j26-1 / 865 / 701 | 6 | 0 / 3 | 0 / 3 |
| 92-702-B-j26-1 / 865 / 702 | 3 | 0 / 8 | 0 / 8 |
| 92-705-C-j26-1 / 712 / 705 | 4 | 0 / 12 | 0 / 12 |
| 92-707-A-j26-1 / 712 / 707 | 1 | 0 / 2 | 0 / 2 |
| 92-707-j26-1 / 712 / 707 | 1 | 0 / 2 | 0 / 2 |
| 92-815-A-j26-1 / 712 / 815 | 2 | 0 / 16 | 0 / 16 |
| 92-N34-A-j26-1 / 740 / N34 | 14 | 14 / 0 | 14 / 0 |
| 96-260-2-j26-1 / 801 / 41 | 19 | 14 / 0 | 6 / 0 |
| 96-260-7-j26-1 / 801 / 25 | 8 | 2 / 0 | 0 / 0 |
| 96-262-1-j26-1 / 801 / 581 | 22 | 7 / 0 | 0 / 0 |
| 96-263-3-j26-1 / 801 / 572 | 14 | 30 / 0 | 28 / 0 |
| 96-264-2-j26-1 / 801 / 111 | 2 | 0 / 12 | 0 / 12 |
| 96-266-0-j26-1 / 801 / 183 | 8 | 0 / 0 | 0 / 1 |
| 96-269-7-j26-1 / 801 / 218 | 11 | 0 / 4 | 0 / 0 |
| 96-273-4-j26-1 / 801 / 14 | 4 | 0 / 0 | 0 / 6 |
| 96-276-0-j26-1 / 801 / 411 | 18 | 32 / 0 | 30 / 0 |
| 96-281-1-j26-1 / 801 / 491 | 2 | 7 / 0 | 7 / 0 |
| 96-292-1-j26-1 / 801 / 702 | 24 | 0 / 0 | 0 / 3 |
| 96-292-2-j26-1 / 801 / 712 | 7 | 5 / 0 | 0 / 0 |
| 96-292-D-j26-1 / 801 / 713 | 2 | 0 / 8 | 0 / 8 |
| 96-305-0-j26-1 / 801 / 900 | 3 | 13 / 0 | 13 / 0 |

## OSM graph and failed reuse experiment

The preserved Geofabrik Switzerland PBF from 2 September 2026 has SHA-256 `39257b1c92a45da38ca94ddb745bdcf53551d0e66b02d89f3de3e7c064c3a29f`. A fresh graph was filtered using the complete Graubünden trial feed and the reviewed service-road configuration. Unlike the primary Swiss-plus-border graph, this supplemental graph has only the geographical coverage available in the Swiss extract. Foreign coverage is not assumed. The filtered graph hash is `06e1be74a400233fa0bfbda8a37e7802b3e5a40b6d6e8a37f941edec275edf5c`. Its 1'198'817 nodes span 8.4844029, 45.9584746, 10.5055891, 47.3170319 (west, south, east, north); 421'988 are inside the diagnostic [9, 46.2, 10.5, 47.1] box. That box is an overlap diagnostic, not canton membership.

The first experiment reused the preserved Luzern access graph. Despite its national-source wording, that filtered artifact spans only [7.3402929, 46.6281758, 8.5914958, 47.4548652] and has zero nodes in the Graubünden diagnostic box. All 187 trial patterns failed. The underlying pfaedle filtering uses input-dependent bounding boxes as well as tag filters: a national parent PBF does not make each filtered output national. The failed cache, matcher outputs and original source receipt remain in [rejected-reuse](../data/graubuenden-access-roads/rejected-reuse/sources.json), with an explicit [extent correction](../data/graubuenden-access-roads/rejected-reuse/extent-review.json). Only its pinned configurations and executable identity were reused for the corrected run. No rejected trial enters the application.

The filter retains highway=service; the routing configuration uses 20 m stop-candidate and edge-snap limits. It does not remove OSM access or turn restrictions. The importer retains the primary 120 m endpoint snap, max(1,500 m, 6 × direct distance) detour and 5 m simplification limits. Maximum measured trial snap is 26.76 m. Full matcher warnings, original shapes and shape distances are archived; explicit fallback hops are rejected. The run matches 16,045 / 16,295 segment occurrences, rejecting 43 pattern-segment occurrences. Pair success is not whole-journey admission. Tightening candidate distance and retaining service roads does not prove physical vehicle direction, seasonal access or every legal restriction.

## Official local evidence and reuse

PostAuto’s [Chur–Flims–Laax–Ilanz network diagram](https://www1.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/graubuenden/chur-flims-laax-ilanz.pdf?vs=9) and [Chur–Mittelbünden diagram](https://www.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/graubuenden/chur-mittelbuenden.pdf?vs=6), both valid from 14 December 2025 and checked on 8 September 2026, support line/stop identity around Laax and Alvaneu. They are schematic network diagrams; no coordinates or road alignments are traced from them. They do not certify every platform-specific fixture pattern or replacement service. GeoGR’s [help page](https://geogr.ch/hilfe) explains access to public geodata but supplies no dataset-specific operational bus-vector permission. The earlier cantonal endpoint and metadata findings remain documented in the [initial study](GRAUBUENDEN-STUDY.md). A verified local operational line export and its own terms are still outstanding.

Bus geometry remains **© OpenStreetMap contributors**, [ODbL 1.0](https://www.openstreetmap.org/copyright). The complete supplemental [derived path database](../public/data/graubuenden-region/access-road-paths.json) includes pattern mapping and attribution, alongside the primary database. Preserve ODbL attribution and share-alike database obligations. The executable has separate GPL licensing, preserved in pfaedle-LICENSE. Timetable and FOT attribution/terms remain as documented in the initial study. Official diagrams are linked as evidence; no right to redistribute or derive routable geometry from those diagrams is claimed.

## Reproduction

Offline validation uses the committed, hashed graph and complete matcher outputs. Fresh acquisition or matching changes receipts and requires an explicit policy review; the build does not update trust pins automatically. Preparation computes rejected routes with the supplemental review disabled so it remains reproducible after the gain.

```sh
node scripts/prepare-graubuenden-access-roads.mjs
node scripts/match-postbus-roads.mjs \
  --pfaedle /private/tmp/gleislicht-pfaedle/build/pfaedle \
  --osm /private/tmp/graubuenden-access-network.osm \
  --config data/graubuenden-access-roads/routing.cfg \
  --feed /private/tmp/graubuenden-access-feed \
  --output /private/tmp/graubuenden-access-matched
node scripts/import-graubuenden-access-roads.mjs
# Explicitly review source and policy hashes before rebuilding.
node scripts/build-graubuenden-region.mjs
node scripts/check-graubuenden-region.mjs
node scripts/review-graubuenden-access-roads.mjs
node scripts/review-graubuenden-rail.mjs
```
