# Witikonerstrasse — 8 September 2026

**The city axis at counter 1101 connects to ZH 742, but the reviewed route has no second counter to support a recording.** The [reproducible report](../data/witikon-road-review.json) records the connection, the complete named-road search and the observation limits.

## City-to-canton connection

The unchanged precise point for **1101 Zürich: Witikonerstrasse** lies on detailed city-owned road **30051**, feature **7870**. This 87.54 m feature ends at exactly the same published coordinate as detailed cantonal feature **2697**, road **742**. The station is **71.85 m** along the city axis from that connection.

A fresh [classified-road response](../data/witikon-road-review-sources.json) contains one local ZH 742 feature, starting at the same endpoint, and no 30051 city axis. Rebuilding the original station match reproduces **off-network** exactly: the classified axis remains 71.85 m away, above the unchanged 25 m matching limit. This establishes a source connection without moving the station or approving a city-road extension for playback.

## Counter search and observations

Filtering all **7,427** detailed source features to roads **30051 and 742** yields **42 features**. Following endpoint connections within 0.01 m from feature 7870 reaches **38** of them. Only counter 1101 lies within 25 m of that component among the catalog counters with precise station points.

| Counter | Named-road component | Complete archived minutes | Longest complete run |
| --- | --- | ---: | ---: |
| 1101 Zürich: Witikonerstrasse | Within the reviewed component | 245 | 245 min |
| 0889 Maur: Zürichstrasse | On one of the other four selected features | 0 | 0 min |

These observations cover the archived afternoon of **8 September 2026**. Both Maur detectors lack valid light and heavy flow observations throughout its 245 audited minutes. Its existing direction audit also remains unresolved. Neither station coverage nor geographic proximity establishes a simultaneous, reviewed counter pair.

The connectivity claim is limited to the publisher's features for these two road numbers. Other roads may connect the separate components in the wider network. The search creates no links across geometry gaps, line crossings or other road numbers, and vertex order is not treated as travel direction. The 25 m counter search is a candidate search, not a binding approval.

## Reproduction and remaining evidence

```sh
node scripts/audit-witikon-road.mjs --output=/tmp/witikon-road-review.json
cmp data/witikon-road-review.json /tmp/witikon-road-review.json
npx vitest run scripts/audit-witikon-road.test.mjs scripts/audit-cantonal-unmatched-roads.test.mjs scripts/ingest-cantonal-road-topology.test.mjs
```

The [scope](../data/witikon-road-review-scope.json) pins the complete-source batch scope and the fresh classified response. Tests check report reproduction, unchanged inputs, endpoint traversal under reordered/reversed geometry, interior crossings, gaps, duplicate identities, incomplete responses and changed evidence.

To resume this candidate, establish a second counter with simultaneous complete observations on an independently reviewed connecting route, then review city-road inclusion, directions and junctions. No recording, approved topology or public playback artifact is added by this audit.
