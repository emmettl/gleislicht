# Zürcher Oberland road-candidate review — 8 September 2026

**None of these 14 counter pairs is ready for publication.** They have long complete recording windows, but resolving Pfäffikon, Wetzikon and Gossau names does not resolve all direction and geometry failures. The six published recordings remain unchanged.

## Complete settlement evidence

The official 2026 SwissNames archive was scanned across all three CSV members for every `TLM_SIEDLUNGSNAME` row named Pfäffikon, Wetzikon or Gossau, including canton-qualified names. The [inventory](../data/oberland-road-settlement-inventory.json) contains exactly six settlements: Pfäffikon ZH/SZ, Wetzikon ZH/TG and Gossau ZH/SG. Its archive hash, member hashes, row totals and selected source rows make the extraction reproducible. There are no unqualified settlement rows for these three names in that archive.

The [pinned exact API responses](../data/oberland-road-review-sources.json) must account for all six inventory rows through a one-to-one name and bounding-box crosswalk. Missing alternatives, saturated responses, stale hashes and ambiguous crosswalks fail the audit. Both canton-qualified alternatives are retained for each name; none is selected merely because it is nearest.

## What the diagnostic means

The [audit](../data/oberland-road-candidate-audit.json) examines the archived candidate pairs with at least 60 consecutive complete minutes and at least one endpoint using these destination labels. This produces **14 pairs and 21 distinct stations**. Observation counts and windows come from the pinned 245-minute afternoon coverage audit.

Each station retains its original automatic result and separate results for both qualified settlement alternatives. A deliberately optimistic diagnostic asks whether using the Zürich-qualified destination would be sufficient. **This is not an approved destination mapping.** It does not publish a topology, change the pilot catalog, or generate playback data.

Even under that assumption, every pair has a further blocker. The audit also checks whether the existing opposing-normal-lane review could handle an extent conflict. It never treats that applicability check as an approved review. At Uster 0188 and Gossau 1388, the method could apply after a destination review, but a neighbouring counter still blocks the pair. Hittnau 2992 passes the Zürich-qualified diagnostic; its neighbour 3091 does not.

## Candidate queue

| Counter pair | Approx. length | Longest complete run | Remaining evidence required |
| --- | ---: | ---: | --- |
| Uster 2188–0188 | 0.876 km | 245 min | Independent direction reference at 2188; its Uster destination is only 1,138 m away. 0188 also needs explicit destination/extent review. |
| Uster–Seegräben 0188–2988 | 2.304 km | 245 min | **Rejected by the [Seegräben follow-up](SEEGRAEBEN-ROAD-REVIEW.md):** 2988 measures a municipal branch, not ZH 340. |
| Uster–Pfäffikon 0205–4586 | 2.658 km | 229 min | 0205 has short-distance and bearing failures. Both 4586 directions have extent conflicts, leaving no validated anchor. |
| Pfäffikon 4586–0295 | 1.542 km | 192 min | Independent direction evidence at both counters. 0295's Pfäffikon destination is only 647.49 m away; 4586 lacks a validated anchor. |
| Fehraltorf–Pfäffikon 2291–5086 | 3.571 km | 148 min | Winterthur is off-axis at 2291; Pfäffikon is too close at 5086. |
| Wetzikon–Bäretswil 2091–2793 | 3.256 km | 142 min | Bearing conflicts at both counters, plus an extent conflict at 2091. |
| Gossau 1388–2888 | 3.783 km | 142 min | Independent directions at 2888, where destination distance or along-axis separation fails. 1388 needs explicit destination/extent review. |
| Uster 4286–2188 | 4.719 km | 141 min | Zürich is off-axis at 4286 and Uster is too close at 2188. |
| Bäretswil–Bauma 2793–1493 | 3.178 km | 141 min | Wetzikon bearing conflict at 2793 and a short-distance Bauma reference at 1493. |
| Gossau–Wetzikon 1691–1020 | 1.882 km | 141 min | Bearing, off-axis and short-distance failures at the two counters. |
| Pfäffikon–Wetzikon 5086–0190 | 4.609 km | 104 min | Short-distance Pfäffikon reference at 5086; Wetzikon bearing and Hinwil extent failures at 0190. |
| Hittnau 2992–3091 | 2.479 km | 104 min | Independent direction evidence at 3091: Saland is 1,401.93 m away, below the unchanged 1,500 m gate. 2992 still requires approval of the qualified destination mapping. |
| Wetzikon–Hinwil 0190–0989 | 2.041 km | 104 min | Bearing/extent failures at 0190 and a short-distance Hinwil reference at 0989. |
| Hinwil 0989–0213 | 1.469 km | 104 min | Short-distance references at both counters and an extent conflict at 0213. |

The short-destination status can mean either less than **1,500 m** direct distance or less than **750 m** projected separation along the axis. A centre or local tangent pointing roughly the expected way does not remove these failures. No distance, projection, extent or bearing gate was weakened.

## Next implementation work

The [Hittnau source follow-up](HITTNAU-ROAD-REVIEW.md) confirms 3091's public collector labels and precise station point, but obtains no station-specific direction plan. The canton handbook identifies the needed plan contents; its example belongs to another station. Hittnau remains excluded pending that independent directional reference, followed by the homonym review and section/junction audit. Do not infer 3091's direction from complete observations or from 2992 alone.

The [Seegräben geometry investigation](SEEGRAEBEN-ROAD-REVIEW.md) establishes that 2988 and nearby 0392 lie on municipality-owned branch axes. Their ZH 340 candidate associations are rejected in the follow-up review. The original 14-pair audit remains the pinned historical diagnostic; 0188–2988 is now retired from that queue. The subsequent [Wetzikon review](WETZIKON-ROAD-REVIEW.md) also excludes 2788 as a municipal-branch counter, rejecting the apparent 0188–2788 follow-up pair and closing this eastward extension for the current catalog/path.

## Reproduce

The complete [official 2026 CSV archive](https://data.geo.admin.ch/ch.swisstopo.swissnames3d/swissnames3d_2026/swissnames3d_2026_2056.csv.zip) is needed only to independently reproduce the settlement extraction. The audit itself runs from committed evidence:

```sh
python3 scripts/prepare-oberland-road-inventory.py --archive=/tmp/swissnames3d_2026_2056.csv.zip
node scripts/audit-oberland-road-candidates.mjs
```

The [audit scope](../data/oberland-road-audit-scope.json) pins geometry, catalog, original direction results, observation coverage, source responses and the full-settlement inventory. Changed inputs require a new review. Raw traffic snapshots remain private.

Validation: 24 targeted tests across five files and lint pass. The candidate audit and full-archive settlement extraction reproduce byte-for-byte. Checks confirm that the automatic direction gates, recording catalog and all six public playback artifacts are unchanged.
