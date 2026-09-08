# Unmatched cantonal counters — batch review, 8 September 2026

**All 33 counters without an approved geometry match have now been checked against the complete public detailed-road service.** This is a diagnostic inventory, not a set of approved road bindings. It separates missing station identities, high-speed-road exclusions, municipal branches, city-owned roads and unresolved competing axes so follow-up work can target the right evidence.

The [report](../data/cantonal-unmatched-road-audit.json) records every counter, its original geometry status, the closest five detailed features, competing-axis separation and archived station/pair coverage. Each pair also retains both endpoints' unresolved direction checks from the independently recomputed baseline. All **7,427** detailed features compete before the five closest are retained. The sources also contain all **428** public station points and **369** public collector records. All 23 previously located unmatched counters retain exactly the same precise coordinates; all 33 collector identities and detector labels agree with the existing topology.

## Findings

| Diagnostic family | Counters | Interpretation |
| --- | ---: | --- |
| Missing station | 10 | The current complete station response still has no exact ID join. Do not substitute rounded detector coordinates. |
| High-speed road | 9 | The nearby detailed axes confirm that these remain outside the cantonal main-road recording queue. |
| Municipal road | 8 | Seven have a detailed local-axis lead within 1 m and at least 15 m separation from the next feature. Uster 0288 remains close to a motorway competitor. |
| Zürich city road | 2 | Detailed ownership/network context needs review against the classified topology. |
| Classified-road ambiguity | 4 | Nearby competing roads require independent junction, carriageway or grade-separation evidence. |

The eight municipal leads are **0288 Uster**, **0315 Weiningen**, **0392 Seegräben**, **1897 Henggart**, **2004 Ottenbach**, **2587 Ottenbach**, **2788 Wetzikon** and **2988 Seegräben**. The prior [Seegräben](SEEGRAEBEN-ROAD-REVIEW.md) and [Wetzikon](WETZIKON-ROAD-REVIEW.md) reviews separately establish the three scoped ZH 340 exclusions. This batch agrees with those detailed feature identities; it does not turn the other leads into approved exclusions.

At **0288**, the municipal axis is only about 0.01 m away, but the motorway axis is about 14.50 m away. The difference remains below the unchanged **15 m** ambiguity margin. Ownership or the station's road label cannot silently override that competitor.

The ten missing IDs are **0218, 0305, 0618, 1089, 1288, 1392, 1790, 1886, 5090 and 5887**. Their collector labels and observations do not replace precise station-ID evidence.

## Focused follow-up queue

| Counter | Detailed-road finding | Archived evidence and next check |
| --- | --- | --- |
| **1921 Dietikon, Mutschellenstrasse** | Roads 618 and 618.1 are 3.99 m and 4.60 m away. | The existing 1921–0214 diagnostic pair has 245 complete minutes. Establish which carriageway/branch is measured before direction review. |
| **0197 Zürich, Allmendstrasse** | A city-owned 4.1 axis passes through the point; nearby city and high-speed-road features remain competitors. | The existing 4087–0197 diagnostic pair has 245 complete minutes. Resolve the classified-road identity and junction/carriageway relationship. |
| **1101 Zürich, Witikonerstrasse** | City-owned 30051 joins ZH 742 at an exact endpoint, 71.85 m along the axis from the station. | The [focused review](WITIKON-ROAD-REVIEW.md) finds no second counter on the connected 30051/742 component. Maur 0889 is on another selected component and has zero complete minutes. A second reviewed counter and paired observations are needed. |
| **1997 Henggart, Weinlandstrasse** | Road 15 passes through the point; the A4 axis runs alongside it, 14.54 m away. | The [focused review](HENGGART-ROAD-REVIEW.md) retains the road ambiguity and exposes failures in both directions even assuming ZH 15. The southern 104-minute candidate also needs both Neftenbach directions resolved; northern neighbour 1900 is disabled with zero complete minutes. |
| **2491 Lindau, Lindauerstrasse** | Road 766 passes through the point; a motorway feature is 14.61 m away. | Both archived neighbouring diagnostic pairs have 104 complete minutes. Resolve the road-level relationship without relaxing the margin. |
| **3387 Stallikon, Schwandenstrasse** | Road 650 passes through the point; a motorway feature is 6.50 m away. | The 3287–3387 diagnostic pair has a 149-minute complete run. Seek explicit grade-separation/road-binding evidence. |

These are coverage facts for existing diagnostic pairs, not guarantees of usable sections. In particular, the Witikonerstrasse station total must not be presented as a paired recording window. The [Dietikon follow-up](DIETIKON-ROAD-REVIEW.md) identifies two lane groups near parallel axes but obtains no detector-to-axis mapping; Oetwil 0214 independently fails its direction checks. The [Allmendstrasse follow-up](ALLMEND-ROAD-REVIEW.md) identifies a missing city axis at a ramp junction and validates 4087's extent conflict in a separate scoped review. Allmendstrasse still requires city-network and detector evidence. The table and batch report retain the original automatic baseline; subsequent approvals are explicitly linked rather than silently rewriting that evidence.

## Sources and reproduction

The [source manifest](../data/cantonal-unmatched-sources/manifest.json) records exact public URLs, retrieval times, byte counts and SHA-256 hashes. The complete response bodies are committed as deterministic gzip files; no credentials or raw traffic recordings are included. The loader verifies the decompressed response bytes before parsing. The [scope](../data/cantonal-unmatched-road-scope.json) additionally pins the parsed sources, manifest, original topology, detector catalog and archived coverage.

“Complete” here means every feature returned by the publisher's detailed-road service, checked against its declared `numberMatched`. It does not assert that this service represents every street or all road levels in the canton. Adjacent fragments and excluded/planned roads remain competitors; apparent ambiguity is not discarded by grouping them optimistically.

```sh
node scripts/audit-cantonal-unmatched-roads.mjs --output=/tmp/cantonal-unmatched-road-audit.json
cmp data/cantonal-unmatched-road-audit.json /tmp/cantonal-unmatched-road-audit.json
npx vitest run scripts/audit-cantonal-unmatched-roads.test.mjs scripts/audit-wetzikon-road.test.mjs scripts/audit-seegraeben-road.test.mjs scripts/ingest-cantonal-road-topology.test.mjs
```

The report reproduces byte-for-byte. The 28 targeted tests cover full-batch membership, retained competitors, stable source identities and coordinates, incomplete inventories, duplicate IDs, compressed-source integrity and the earlier scoped exclusions. The six published recordings, original geometry and previous audit reports remain unchanged.
