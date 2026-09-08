# St. Gallen canton: source adapter and regional-feed audit

Audit date: **8 September 2026**. Starting point: [Swiss source inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md#sg). The complete annual pinned-timetable census contains **343 route records across 38 agency identities**. Geometry admission is partial: all admitted complete directed patterns pass numerical validation; this is not complete cantonal motion coverage or certification of road travel directions.

[Regional feed index](../data/st-gallen-region/index.json) · [Readable full route/source inventory](ST-GALLEN-ROUTE-INVENTORY.md) · [Audit summary](../data/st-gallen-audit/summary.json) · [Every annual route and exclusion](../data/st-gallen-audit/routes.json) · [Every source feature and mapping](../data/st-gallen-audit/source-lines.json). Full ordered-pattern and directed-pair evidence: [2026-09-04](../data/st-gallen-audit/2026-09-04.json) · [2026-09-06](../data/st-gallen-audit/2026-09-06.json).

## Scope and entire-canton denominator

The census streams **34'499'152 annual national stop-time rows** and selects **89'396 trip records** with at least one source call in the complete swisstopo SG MultiPolygon. All polygon components and holes are preserved; bounding-box filtering is only a preliminary speedup. There are **4'551 GTFS stop records** inside the polygon, of which **3'038** are called in the annual source. Parent/platform records are not presented as unique physical stops.

No agency allowlist defines canton membership. Every selected trip retains its full ordered calls outside SG, including neighbouring cantons and foreign endpoints. Nonstopping through traffic and services absent from national GTFS are outside this measured census; no straight-line crossing approximation is used. This is the whole SG canton, not the city alone and not the six-canton OSTWIND tariff area.

The geographical review includes St. Gallen/Rorschach and the Appenzell interfaces; Fürstenland/Wil; Toggenburg; Rheintal; Werdenberg; Sarganserland; and See-Gaster/Rapperswil-Jona. These names are review groupings, not hand-drawn inclusion boundaries. The operator/mode table below exposes all resulting feed identities, including national operators, replacement services, foreign operators, local municipal services and mountain/lake operators. Rail journeys towards Zürich/Luzern, Lake Constance/Lindau, and the Liechtenstein/Austria corridors are retained whole and fail admission if their external calls lack geometry.

The fixture dates are Friday **4 September 2026** and Sunday **6 September 2026**, each 00:00–24:00 Europe/Zurich with preceding-service-day spillover. Calendar exceptions apply. Trips continue beyond the civil window in their source calls but are displayed only in intersecting windows. Frequencies are expanded on the source-anchored interval grid; exact_times=0 instances are explicitly representative headway movements, not scheduled departures. Prior-arrangement pickup/drop-off rules exclude complete patterns from unconditional animation. 67 annual route records are inactive on both civil-day fixtures and remain in the inventory. Two September dates do not establish winter, summer-pass, holiday or annual geometry completeness.

## Acquisition, dates and attribution

The obsolete share/download endpoint was replaced by the current [public AL_OEV archive download](https://data.geo.sg.ch/public.php/dav/files/RMgBWPofwkaCawf/Geodaten/3%20-%20Bev%C3%B6lkerung%20und%20Wirtschaft/P%20-%20Verkehr/AbgeltungsberechtigteLinien/AbgeltungsberechtigteLinien_AL_OEV_shp.zip), verified against the filenames in the official share. All **226 features in five layers** were acquired, including records marked not subsidised; the subsidy flag is not an admission filter.

| Source layer | Features | Mapped to annual SG routes | Candidate graph for admitted trips |
| --- | --- | --- | --- |
| rail | 45 | 45 | 41 |
| bus | 145 | 143 | 135 |
| city | 34 | 34 | 33 |
| mountain | 1 | 1 | 1 |
| boat | 1 | 1 | 1 |

The archive directory, component timestamps and supplied data-description PDF are dated **24 March 2026**. This is the export/documentation date of the 2026 timetable alignment; no per-feature survey date is supplied. The live description PDF was dated 3 September 2026 when inspected, which does not update the geometry in the March archive. Retrieval timestamps are recorded separately in [the source catalogue](../data/st-gallen-sources/sources.json). The SG metadata web page was modified 10 March 2026. The boundary API does not expose a dataset-edition date in this response; no 2026 boundary vintage is invented.

The national timetable is release **20260902**, valid 20251214–20261212, from the [official GTFS dataset](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020). It has no shapes.txt. Pinned hashes:

- GTFS ZIP: `d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e`.
- AL_OEV ZIP: `fa6ad762d43c7792bf664f12fbf33b7e27f9fdbb826cdd75a9d0561b888e3260`.
- Full SG boundary response: `9fcbdc0a501919e7d8722827e0868784010be046dccffc02df0833f9de21f86a`.

Attribution: **SBB / opentransportdata.swiss** for timetable data; **© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG** for AL_OEV; **© swisstopo** for the boundary and underlying swissTNE Base alignment. Timetable reuse follows the [platform terms](https://opentransportdata.swiss/en/terms-of-use/), including attribution and refreshing raw data. This is a pinned reproducible study, not a continuously refreshed service.

The source archive includes Datennutzungsbestimmungen.pdf (1 June 2019). The [current SG terms](https://www.sg.ch/bauen/geoinformation/datenbezug/agb.html), whose page says last modified 12 January 2022, retain the distinction between permitted application display and redistribution/own geoservices requiring express permission (current clause 18; supplied clause 20). No dataset-specific open licence or additional redistribution grant was supplied. **The generated regional feed and raw/decoded vectors remain local, outside public assets and ignored by Git.** The tracked index, adapter and audit make the result reviewable and reproducible. A future publication needs the publisher's permission question resolved; this report does not claim an open-data licence. Permitted display must carry attribution, data currency, lack of legal effect and the publisher's accuracy/completeness/liability disclaimer.

## Adapter and directed-pattern validation

The source is EPSG:2056 LV95 PolyLine plus UTF-8 DBF. The adapter checks complete component/record counts and coordinate ranges, preserves multipart segments and attributes, then uses the existing swisstopo approximate LV95→WGS84 polynomial (metre-level accuracy), rounding to seven decimal places without simplification. Source bytes and each decoded collection are hashed. Archive identity is pinned in [the review policy](../data/st-gallen-policy.json).

Operator codes, passenger-facing designations and modes jointly select a graph. KURSBUCHNR and numeric LINIENNR are not assumed to be GTFS line numbers: rail S21/S22, bus B24/N30 and night services retain their prefixes. Explicit record-name-checked exceptions bridge BOS Swiss sections to LIEmobil, LIEmobil's 12 Eilkurs to 12E, AB N21 to feed B21, Walensee table 3901 to feed BAT, BOS source lines 403/164 to their Buchserberg/Vorarlberg publishers, and individually reviewed N-prefixed or N-suffixed source night lines to numeric GTFS designations. The sole ZVV label maps specifically to VZO 885; BBO 624 maps to the municipal St. Gallenkappel feed identity. Every source feature retains raw operator, offer period, subsidy flag, source name, mapping rationale and resulting route IDs in the source inventory. Multiple same-line source parts can form one graph; counts of graph-candidate features do not mean every trip traverses every feature.

Graphs connect **only exact shared vertices** on the same reviewed operator/line. Geometric crossings are not automatically junctions. One reviewed **7.37 m** source-edge repair connects the two disconnected components of BOS line 321 at Balgach. It copies exactly two existing line-301 edges, independently present in line 322 and N31/N32; both ends are existing target vertices. The policy stores pinned record/part/vertex references rather than redistributing coordinates. Validation requires matching source names/operators, identical corroborating slices, disconnected target components and a 15 m cap. No proximity joins, invented gap bridges or national road/rail fallbacks are applied. Three other small gaps (LIEmobil 37, PostAuto 190 and night 741) have no corroborated short source path and remain excluded. [Repair regression](../data/st-gallen-topology-review.json) records the before/after results and unchanged existing journeys. The nearest projection of each ordered stop pair must be within **120 m**; routing uses source edges and permits another disconnected source part's projection only within **5 m** of the nearest snap. Paths exceeding max(1,200 m, 4.5 × direct stop distance), collapsed paths, disconnected components and missing lines are rejected. Short endpoint connectors are explicitly inferred, not measured alignments.

Pattern identity includes route, direction_id, every ordered stop ID and pickup/drop-off rules. Every pair is evaluated in its actual direction, including loops and return paths; if any pair fails, the **entire trip pattern** is excluded. Source direction_id alone is never treated as proof of legal direction. AL_OEV expressly does not encode travel direction: successful patterns are inferred alignments, with no one-way street, lane, track, temporary-diversion or water-navigability certification. Sparse boat/cableway linework is retained at its source resolution. Every excluded route, pattern and pair keeps a specific failure reason; nothing is silently cropped to improve coverage.

One [documented shared corridor](ST-GALLEN-SHARED-CORRIDOR-REVIEW.md) restores PostAuto line 210 between St. Gallen Bahnhof and Tübach Schulstrasse using the official line-211 record. PostAuto's network map, valid from 14 December 2025 and retrieved 8 September 2026, confirms the common corridor through Mörschwil. This is restricted to 64 individually reviewed directed route/platform pairs, adjacent names in the approved stop sequence, pinned output geometry hashes and the unchanged numerical limits. It applies only after a primary endpoint-gap failure; every passing primary path is preserved. The donor's Horn branch is outside the approved pairs. Shared-corridor source, operator, name, coordinate or path changes fail validation. No general operator-wide fallback is enabled. The [incremental regression](../data/st-gallen-shared-corridor-review.json) confirms all 10,500 Friday and 7,264 Sunday previously admitted journeys remain identical, including the line-321 repair.

## Measured results


One [reviewed stop rendering anchor](ST-GALLEN-STOP-ANCHOR-REVIEW.md) resolves the coordinate discrepancy at Dornbirn Treffpunkt a.d.Ach for line 164. It uses the exact published Vorarlberg platform coordinate as a representative stop-level anchor, with the opposite platform within 9 m. The original Swiss coordinate remains in the policy/audit and the source timetable file is untouched. The adapter pins both source bytes and schedule evidence, restricts use to line 164 on the two reviewed dates, and rejects new route usage or changed source coordinates. Every original call, ID, time and existing admitted path is preserved. The [incremental anchor regression](../data/st-gallen-stop-anchor-review.json), against commit 2e0c599, adds exactly 58 Friday / 26 Sunday trips and two directed patterns per date. AL_OEV linework, the 120 m snap limit and detour limits remain unchanged. This is a representative rendering anchor, not a direction-specific platform assignment or an authoritative correction to the Swiss feed.

| Metric | 2026-09-04 | 2026-09-06 |
| --- | --- | --- |
| Civil-day movement instances | 24'782 | 22'859 |
| Admitted movement instances | 10'624 (42.9%) | 7'325 (32.0%) |
| Excluded movement instances | 14'158 | 15'534 |
| Complete directed patterns admitted / evaluated | 1'002 / 1'441 | 773 / 1'182 |
| Directed route-stop pairs matched / evaluated | 7'182 / 8'427 (85.2%) | 7'176 / 8'589 (83.5%) |
| All segment occurrences matched / evaluated | 177'688 / 202'330 (87.8%) | 116'433 / 142'563 (81.7%) |
| Scheduled segment occurrences matched / evaluated | 175'224 / 189'688 (92.4%) | 113'969 / 128'365 (88.8%) |
| Representative headway movements admitted / evaluated | 1'239 / 11'417 | 1'239 / 12'973 |
| Admitted movements using reviewed source repair | 74 | 67 |
| Admitted movements using reviewed shared corridor | 66 | 35 |
| Directed pairs using reviewed shared corridor | 48 | 64 |
| Admitted movements using reviewed stop anchor | 58 | 26 |
| Directed pairs using reviewed stop anchor | 4 | 4 |
| Preceding-day carry-ins admitted / evaluated | 162 / 221 | 371 / 663 |

Pair and occurrence coverage includes matches inside excluded patterns, so it is distinct from emitted complete-trip coverage. All excluded modes remain in the denominators; frequent mountain headway instances must not be mistaken for scheduled departures.

| Mode | Annual route records | 2026-09-04 admitted/all movements; pair-occurrence coverage | 2026-09-06 admitted/all movements; pair-occurrence coverage |
| --- | --- | --- | --- |
| boat | 5 | 22/69; 26.6% | 22/81; 24.2% |
| bus | 222 | 8'216/9'020; 97.3% | 5'071/5'663; 95.2% |
| mountain | 19 | 1'239/13'697; 16.5% | 1'239/15'401; 14.8% |
| rail | 97 | 1'147/1'996; 71.5% | 993/1'714; 71.0% |

### Every agency identity

| GTFS ID | Raw feed agency name | Modes | Annual routes | 2026-09-04 admitted/all movements | 2026-09-06 admitted/all movements |
| --- | --- | --- | --- | --- | --- |
| 11 | Schweizerische Bundesbahnen SBB | rail | 43 | 39 / 559 | 39 / 515 |
| 22 | Appenzeller Bahnen (ab) | rail | 9 | 380 / 384 | 311 / 311 |
| 65 | THURBO | rail | 23 | 475 / 638 | 394 / 516 |
| 81_VVV | Verkehrsverbund Vorarlberg | bus | 1 | 58 / 58 | 26 / 26 |
| 82 | Schweizerische Südostbahn (sob) | rail | 18 | 253 / 338 | 249 / 334 |
| 113 | Toggenburg Bergbahnen Unterwasser | mountain | 3 | 0 / 1'088 | 0 / 1'088 |
| 138 | Bus Ostschweiz | bus | 63 | 2'124 / 2'619 | 1'226 / 1'522 |
| 194 | Zürichsee-Schifffahrtsgesellschaft AG (ZSG) | boat | 3 | 0 / 21 | 0 / 31 |
| 195 | Schweizerische Bodensee-Schifffahrt AG | boat | 1 | 0 / 16 | 0 / 16 |
| 197 | Schiffsbetrieb Walensee | boat | 1 | 22 / 32 | 22 / 34 |
| 214 | Luftseilbahn Unterterzen-Flumserberg AG | mountain | 1 | 1'239 / 1'239 | 1'239 / 1'239 |
| 257 | Bergbahnen Wildhaus AG | mountain | 1 | 0 / 1'896 | 0 / 2'044 |
| 265 | Bergbahnen Flumserberg AG | mountain | 2 | 0 / 1'830 | 0 / 1'830 |
| 287 | Pizolbahnen AG | mountain | 5 | 0 / 3'690 | 0 / 3'690 |
| 288 | Bergbahnen Flumserberg AG | mountain | 2 | 0 / 1'860 | 0 / 2'006 |
| 301 | Schutt Atzmännig | mountain | 1 | 0 / 780 | 0 / 1'020 |
| 697 | Bus Buchserberg | bus | 1 | 0 / 0 | 12 / 12 |
| 709 | Mühleggbahn AG | mountain | 1 | 0 / 384 | 0 / 384 |
| 744 | Automobildienst Appenzeller Bahnen | bus | 2 | 4 / 4 | 10 / 10 |
| 766 | Bus und Service AG (Chur) | bus | 1 | 0 / 0 | 1 / 1 |
| 772 | Busbetrieb Rapperswil-Eschenbach-Rüti ZH | bus | 5 | 257 / 304 | 108 / 146 |
| 801 | PostAuto AG | bus | 78 | 2'612 / 2'732 | 1'708 / 1'797 |
| 805 | Verkehrsbetrieb LIECHTENSTEINmobil | bus | 9 | 257 / 312 | 154 / 156 |
| 810 | Busbetrieb Lichtensteig-Wattwil-Ebnat-Kappel | bus | 2 | 107 / 107 | 81 / 81 |
| 832 | Autobetrieb Weesen-Amden | bus | 1 | 70 / 70 | 65 / 65 |
| 838 | Verkehrsbetriebe Zürichsee und Oberland | bus | 7 | 416 / 418 | 267 / 270 |
| 885 | Verkehrsbetriebe der Stadt St.Gallen | bus | 12 | 1'734 / 1'734 | 1'154 / 1'154 |
| 896 | Regiobus Gossau SG | bus | 10 | 557 / 618 | 259 / 264 |
| 908 | Dampfbahn-Verein Zürcher Oberland | bus | 1 | 0 / 0 | 0 / 12 |
| 3000 | Publikation nur Kursbuch/Plakat | bus | 2 | 0 / 15 | 0 / 4 |
| 3128 | Sesselbahn Krümmenschwil-Rietbach | mountain | 1 | 0 / 0 | 0 / 1'020 |
| 3130 | Sportbahnen Amden | mountain | 1 | 0 / 840 | 0 / 990 |
| 3131 | Berggasthaus Staubern AG | mountain | 1 | 0 / 90 | 0 / 90 |
| 7017 | Gemeinde St. Gallenkappel | bus | 1 | 20 / 20 | 0 / 0 |
| 7231 | SBB Infrastruktur AG Bahnersatz | bus | 16 | 0 / 1 | 0 / 135 |
| 7232 | Schweizerische Südostbahn AG Ersatzverkehr | bus | 5 | 0 / 0 | 0 / 0 |
| 7252 | Appenzeller Bahnen Ersatzverkehr | bus | 5 | 0 / 8 | 0 / 8 |
| 817000 | NeTS Planung ÖBB | rail | 4 | 0 / 77 | 0 / 38 |

### Exclusions

| Failure reason | 2026-09-04 affected trips | 2026-09-06 affected trips |
| --- | --- | --- |
| disconnected-line | 40 | 3 |
| endpoint-gap | 821 | 512 |
| implausible-detour | 128 | 59 |
| missing-line | 13169 | 14960 |

Reasons overlap when a pattern has multiple failures. Missing-line includes outside-source modes, long-distance/national rail, replacement buses, unbridged operator/designation identities and tourist services beyond the subsidised-line scope; this does not assert that no other geometry exists. Full reason sets and inactive dates are attached to every annual route in routes.json. Every source feature without an annual match or admitted fixture is also retained in source-lines.json.

The [bus detour review](ST-GALLEN-DETOUR-REVIEW.md) replays all seven remaining bus pairs rejected for implausible detours, affecting 128 Friday and 59 Sunday trips. It compares every nearby edge projection and the operator's combined regional bus linework. The 352/353 and 432 failures persist. Line 400 has a shorter candidate using a 33.30 m edge from line 429/430, but it lacks the evidence required for admission. Operator notices retrieved on 8 September document construction overlapping both fixture dates. All these patterns remain excluded; the [machine-readable review](../data/st-gallen-detour-review.json) pins the evidence snapshots, diagnostic results and affected patterns without redistributing geometry.

The [bus endpoint review](ST-GALLEN-ENDPOINT-REVIEW.md) replays every remaining bus endpoint-gap pair and checks other individual regional/city records mapped to the same agency. It covers 105 distinct directed pairs, affecting 331 Friday / 100 Sunday complete trips. Operator evidence for lines 323 and 705 does not establish an admissible replacement alignment. The official Vorarlberg July sample contains line-164 shapes but no line 323; those external shapes are inventoried only. Candidate paths do not authorize a route fallback. All reviewed endpoint failures remain excluded with the unchanged 120 m limit. The [machine-readable review](../data/st-gallen-endpoint-review.json) pins every pair, candidate hash, evidence date and affected-pattern total.

### Admitted route records

Each value is admitted/all civil-day movement instances. Partial routes still exclude every failed full pattern. The complete inventory includes excluded and inactive routes as well.

| Agency | GTFS route ID | Line | 2026-09-04 | 2026-09-06 |
| --- | --- | --- | --- | --- |
| 65 | 91-1-C-j26-1 | S1 | 8/88 | 7/87 |
| 65 | 91-1-P-j26-1 | RE1 | 38/38 | 38/38 |
| 65 | 91-10-C-j26-1 | S10 | 73/73 | 42/42 |
| 65 | 91-12-A-j26-1 | S12 | 76/76 | 72/72 |
| 11 | 91-12-j26-1 | S12 | 1/34 | 0/0 |
| 65 | 91-13-F-j26-1 | RE13 | 9/9 | 9/9 |
| 22 | 91-15-I-j26-1 | S15 | 98/98 | 82/82 |
| 11 | 91-16-A-j26-1 | S16 | 2/5 | 2/5 |
| 82 | 91-17-M-j26-1 | S17 | 39/39 | 39/39 |
| 65 | 91-2-E-j26-1 | S2 | 42/42 | 42/42 |
| 65 | 91-21-F-j26-1 | SN21 | 0/0 | 8/8 |
| 22 | 91-21-j26-1 | S21 | 78/78 | 74/74 |
| 22 | 91-22-A-j26-1 | S22 | 36/36 | 0/0 |
| 65 | 91-22-B-j26-1 | SN22 | 0/0 | 6/6 |
| 22 | 91-23-A-j26-1 | S23 | 60/60 | 59/59 |
| 22 | 91-24-A-j26-1 | S24 | 26/26 | 24/24 |
| 22 | 91-25-A-j26-1 | S25 | 32/32 | 30/30 |
| 11 | 91-25-j26-1 | S25 | 34/34 | 34/34 |
| 22 | 91-26-B-j26-1 | S26 | 50/50 | 42/42 |
| 65 | 91-35-j26-1 | S35 | 47/47 | 81/81 |
| 82 | 91-4-j26-1 | S4 | 50/50 | 49/49 |
| 82 | 91-40-j26-1 | S40 | 74/74 | 73/73 |
| 65 | 91-5-B-j26-1 | S5 | 1/80 | 0/42 |
| 11 | 91-5-C-j26-1 | S5 | 1/81 | 0/80 |
| 11 | 91-5-G-j26-1 | SN5 | 0/0 | 3/10 |
| 82 | 91-6-G-j26-1 | S6 | 42/42 | 41/41 |
| 65 | 91-7-B-j26-1 | S7 | 82/82 | 82/82 |
| 65 | 91-72-B-j26-1 | SN72 | 0/0 | 7/7 |
| 11 | 91-8-C-j26-1 | S8 | 1/9 | 0/8 |
| 82 | 91-81-C-j26-1 | S81 | 33/33 | 32/32 |
| 65 | 91-82-j26-1 | S82 | 20/22 | 0/0 |
| 65 | 91-9-E-j26-1 | S9 | 79/79 | 0/0 |
| 82 | 91-VAE-j26-1 | VAE | 15/41 | 15/41 |
| 885 | 92-1-D-j26-1 | 1 | 191/191 | 143/143 |
| 885 | 92-10-C-j26-1 | 10 | 107/107 | 97/97 |
| 885 | 92-11-C-j26-1 | 11 | 73/73 | 65/65 |
| 805 | 92-11-F-j26-1 | 11 | 79/79 | 78/78 |
| 805 | 92-12-C-j26-1 | 12 | 131/131 | 76/76 |
| 885 | 92-12-F-j26-1 | 12 | 52/52 | 0/0 |
| 805 | 92-12E-j26-1 | 12E | 39/39 | 0/0 |
| 805 | 92-13-B-j26-1 | 13 | 8/8 | 0/0 |
| 896 | 92-150-A-j26-1 | 150 | 2/58 | 0/0 |
| 896 | 92-151-j26-1 | 151 | 203/204 | 67/67 |
| 896 | 92-152-j26-1 | 152 | 69/69 | 37/37 |
| 896 | 92-155-j26-1 | 155 | 57/57 | 45/45 |
| 896 | 92-158-j26-1 | 158 | 67/67 | 32/32 |
| 896 | 92-159-j26-1 | 159 | 67/67 | 36/36 |
| 81_VVV | 92-164-C-j26-1 | 164 | 58/58 | 26/26 |
| 885 | 92-2-B-j26-1 | 2 | 192/192 | 148/148 |
| 896 | 92-23-D-j26-1 | 23 | 0/0 | 6/6 |
| 138 | 92-251-B-j26-1 | 251 | 66/66 | 34/34 |
| 138 | 92-252-C-j26-1 | 252 | 59/59 | 22/22 |
| 138 | 92-253-C-j26-1 | 253 | 19/38 | 42/42 |
| 885 | 92-3-G-j26-1 | 3 | 146/146 | 87/87 |
| 138 | 92-300-j26-1 | 300 | 74/74 | 59/59 |
| 138 | 92-301-A-j26-1 | 301 | 78/78 | 73/73 |
| 138 | 92-302-A-j26-1 | 302 | 70/70 | 63/63 |
| 138 | 92-304-A-j26-1 | 304 | 71/71 | 37/37 |
| 138 | 92-305-j26-1 | 305 | 37/37 | 26/26 |
| 138 | 92-321-j26-1 | 321 | 74/74 | 68/68 |
| 138 | 92-322-j26-1 | 322 | 24/24 | 0/0 |
| 138 | 92-323-j26-1 | 323 | 11/76 | 69/69 |
| 138 | 92-331-j26-1 | 331 | 34/34 | 29/29 |
| 138 | 92-332-A-j26-1 | 332 | 53/53 | 24/24 |
| 138 | 92-333-j26-1 | 333 | 5/5 | 6/6 |
| 138 | 92-335-j26-1 | 335 | 62/62 | 30/30 |
| 885 | 92-4-E-j26-1 | 4 | 147/147 | 89/89 |
| 138 | 92-400-A-j26-1 | 400 | 0/0 | 1/1 |
| 138 | 92-400-j26-1 | 400 | 26/74 | 65/65 |
| 138 | 92-401-A-j26-1 | 401 | 56/56 | 0/0 |
| 697 | 92-403-D-j26-1 | 403 | 0/0 | 12/12 |
| 138 | 92-411-A-j26-1 | 411 | 38/38 | 35/35 |
| 138 | 92-412-j26-1 | 412 | 19/19 | 14/14 |
| 138 | 92-415-A-j26-1 | 415 | 24/24 | 0/0 |
| 138 | 92-420-j26-1 | 420 | 20/27 | 12/12 |
| 138 | 92-429-j26-1 | 429 | 33/33 | 17/17 |
| 138 | 92-430-j26-1 | 430 | 33/33 | 16/16 |
| 138 | 92-431-A-j26-1 | 431 | 29/29 | 0/0 |
| 138 | 92-432-j26-1 | 432 | 14/57 | 0/28 |
| 138 | 92-433-j26-1 | 433 | 64/64 | 31/31 |
| 138 | 92-442-j26-1 | 442 | 29/29 | 12/12 |
| 138 | 92-443-j26-1 | 443 | 24/24 | 18/18 |
| 138 | 92-444-j26-1 | 444 | 53/53 | 38/38 |
| 138 | 92-445-j26-1 | 445 | 42/42 | 30/30 |
| 885 | 92-5-B-j26-1 | 5 | 210/210 | 125/125 |
| 885 | 92-6-A-j26-1 | 6 | 210/210 | 120/120 |
| 772 | 92-622-j26-1 | 622 | 146/146 | 72/72 |
| 7017 | 92-624-j26-1 | 624 | 20/20 | 0/0 |
| 772 | 92-631-j26-1 | 631 | 49/95 | 36/69 |
| 832 | 92-650-j26-1 | 650 | 70/70 | 65/65 |
| 885 | 92-7-C-j26-1 | 7 | 121/121 | 83/83 |
| 138 | 92-701-E-j26-1 | 701 | 116/116 | 24/24 |
| 138 | 92-702-D-j26-1 | 702 | 118/118 | 24/24 |
| 138 | 92-703-C-j26-1 | 703 | 118/118 | 24/24 |
| 138 | 92-704-C-j26-1 | 704 | 114/114 | 0/0 |
| 138 | 92-706-C-j26-1 | 706 | 65/66 | 36/36 |
| 896 | 92-72-E-j26-1 | 72 | 0/0 | 5/5 |
| 138 | 92-722-A-j26-1 | 722 | 25/25 | 26/26 |
| 896 | 92-729-j26-1 | 729 | 34/38 | 31/36 |
| 896 | 92-731-j26-1 | 731 | 58/58 | 0/0 |
| 138 | 92-732-M-j26-1 | 732 | 99/99 | 60/60 |
| 138 | 92-732-N-j26-1 | 732 | 0/0 | 5/5 |
| 138 | 92-733-I-j26-1 | 733 | 69/69 | 40/40 |
| 138 | 92-734-K-j26-1 | 734 | 44/44 | 28/28 |
| 138 | 92-735-C-j26-1 | 735 | 53/53 | 39/39 |
| 138 | 92-761-B-j26-1 | 761 | 32/32 | 0/0 |
| 810 | 92-770-A-j26-1 | 770 | 0/0 | 8/8 |
| 810 | 92-770-j26-1 | 770 | 107/107 | 73/73 |
| 885 | 92-8-B-j26-1 | 8 | 119/119 | 81/81 |
| 838 | 92-885-j26-1 | 885 | 69/69 | 71/71 |
| 885 | 92-9-A-j26-1 | 9 | 166/166 | 116/116 |
| 138 | 92-942-A-j26-1 | 942 | 30/30 | 28/28 |
| 838 | 92-991-j26-1 | 991 | 74/74 | 74/74 |
| 838 | 92-992-j26-1 | 992 | 66/66 | 0/0 |
| 838 | 92-993-j26-1 | 993 | 80/80 | 60/60 |
| 838 | 92-994-j26-1 | 994 | 105/105 | 62/62 |
| 772 | 92-995-A-j26-1 | 995 | 62/62 | 0/0 |
| 838 | 92-996-j26-1 | 996 | 22/22 | 0/0 |
| 744 | 92-B21-A-j26-1 | B21 | 0/0 | 6/6 |
| 744 | 92-B24-j26-1 | B24 | 4/4 | 4/4 |
| 766 | 92-N30-j26-1 | N30 | 0/0 | 1/1 |
| 138 | 92-N31-A-j26-1 | N31 | 0/0 | 5/5 |
| 138 | 92-N32-B-j26-1 | N32 | 0/0 | 5/5 |
| 138 | 92-N50-A-j26-1 | N50 | 0/0 | 5/5 |
| 138 | 92-N90-B-j26-1 | N90 | 0/0 | 6/6 |
| 214 | 93-279-0-j26-1 | 2790 | 1239/1239 | 1239/1239 |
| 197 | 94-R-Y-j26-1 | BAT | 22/32 | 22/34 |
| 801 | 96-202-0-j26-1 | 722 | 14/14 | 0/0 |
| 801 | 96-220-1-j26-1 | 180 | 39/39 | 41/41 |
| 801 | 96-220-3-j26-1 | 182 | 52/52 | 27/27 |
| 801 | 96-220-4-j26-1 | 185 | 14/14 | 8/8 |
| 801 | 96-220-5-j26-1 | 200 | 79/79 | 76/76 |
| 801 | 96-220-6-j26-1 | 207 | 12/12 | 0/0 |
| 801 | 96-220-7-j26-1 | 254 | 76/76 | 34/34 |
| 801 | 96-220-8-j26-1 | 211 | 68/68 | 37/37 |
| 801 | 96-220-A-j26-1 | 200 | 0/0 | 6/6 |
| 801 | 96-220-B-j26-1 | 211 | 0/0 | 5/5 |
| 801 | 96-220-C-j26-1 | N24 | 0/0 | 5/5 |
| 801 | 96-221-0-j26-1 | 242 | 76/76 | 43/43 |
| 801 | 96-221-1-j26-1 | 154 | 53/53 | 39/39 |
| 801 | 96-221-2-j26-1 | 132 | 21/21 | 0/0 |
| 801 | 96-221-4-j26-1 | 205 | 20/20 | 0/0 |
| 801 | 96-222-3-j26-1 | 183 | 8/8 | 10/10 |
| 801 | 96-222-4-j26-1 | 186 | 3/3 | 3/3 |
| 801 | 96-222-A-j26-1 | N6 | 0/0 | 5/5 |
| 801 | 96-224-1-j26-1 | 120 | 82/102 | 68/78 |
| 801 | 96-224-2-j26-1 | 121 | 71/71 | 39/39 |
| 801 | 96-224-3-j26-1 | 222 | 30/30 | 18/18 |
| 801 | 96-224-4-j26-1 | 224 | 10/10 | 0/0 |
| 801 | 96-224-5-j26-1 | 223 | 9/9 | 6/6 |
| 801 | 96-224-6-j26-1 | 226 | 30/30 | 28/28 |
| 801 | 96-224-7-j26-1 | 227 | 12/12 | 8/8 |
| 801 | 96-224-A-j26-1 | 120 | 0/0 | 3/6 |
| 801 | 96-224-B-j26-1 | 121 | 0/0 | 2/5 |
| 801 | 96-227-8-j26-1 | 724 | 38/38 | 0/0 |
| 801 | 96-227-9-j26-1 | 728 | 44/44 | 39/39 |
| 801 | 96-228-1-j26-1 | 725 | 67/67 | 36/36 |
| 801 | 96-228-2-j26-1 | 730 | 70/70 | 40/40 |
| 801 | 96-228-3-j26-1 | 740 | 41/41 | 36/36 |
| 801 | 96-228-4-j26-1 | 726 | 71/71 | 71/71 |
| 801 | 96-228-5-j26-1 | 741 | 68/68 | 39/39 |
| 801 | 96-228-8-j26-1 | 727 | 72/72 | 42/42 |
| 801 | 96-228-9-j26-1 | 767 | 12/12 | 0/0 |
| 801 | 96-228-A-j26-1 | 725 | 0/0 | 5/5 |
| 801 | 96-228-B-j26-1 | 740 | 0/0 | 5/5 |
| 801 | 96-228-C-j26-1 | 741 | 0/0 | 2/5 |
| 801 | 96-229-0-j26-1 | 765 | 30/30 | 16/16 |
| 801 | 96-229-1-j26-1 | 766 | 59/59 | 23/23 |
| 801 | 96-229-2-j26-1 | 768 | 95/95 | 39/39 |
| 801 | 96-229-3-j26-1 | 772 | 24/24 | 16/16 |
| 801 | 96-229-4-j26-1 | 771 | 34/34 | 17/17 |
| 801 | 96-229-5-j26-1 | 751 | 49/49 | 36/36 |
| 801 | 96-229-6-j26-1 | 184 | 20/20 | 9/9 |
| 801 | 96-229-8-j26-1 | 750 | 58/58 | 0/0 |
| 801 | 96-232-1-j26-1 | 780 | 32/32 | 18/18 |
| 801 | 96-233-0-j26-1 | 790 | 70/70 | 66/66 |
| 801 | 96-233-1-j26-1 | 797 | 74/74 | 74/74 |
| 801 | 96-234-0-j26-1 | 792 | 23/23 | 18/18 |
| 801 | 96-240-3-j26-1 | 521 | 72/72 | 38/38 |
| 801 | 96-240-4-j26-1 | 630 | 71/71 | 61/61 |
| 801 | 96-240-5-j26-1 | 635 | 52/52 | 34/34 |
| 801 | 96-240-6-j26-1 | 632 | 49/49 | 35/35 |
| 801 | 96-240-7-j26-1 | 633 | 41/41 | 34/34 |
| 801 | 96-241-4-j26-1 | 636 | 68/68 | 66/66 |
| 801 | 96-245-5-j26-1 | 513 | 67/67 | 63/63 |
| 801 | 96-248-3-j26-1 | 440 | 6/6 | 0/0 |
| 801 | 96-248-4-j26-1 | 441 | 44/44 | 34/34 |
| 801 | 96-249-1-j26-1 | 451 | 43/50 | 25/32 |
| 801 | 96-249-3-j26-1 | 453 | 12/12 | 12/12 |
| 801 | 96-249-4-j26-1 | 454 | 22/22 | 12/12 |
| 801 | 96-249-5-j26-1 | 456 | 27/27 | 26/26 |
| 801 | 96-250-8-j26-1 | 210 | 66/66 | 35/35 |
| 801 | 96-250-A-j26-1 | 201 | 72/72 | 0/0 |
| 801 | 96-254-4-j26-1 | 225 | 8/8 | 0/0 |
| 801 | 96-272-5-j26-1 | 22 | 62/62 | 75/75 |

## Regional feed and reproducibility

The local feed contains date-specific full-day manifests, twelve two-hour chunks and 06:45–08:45 morning snapshots (focus 07:45), using the existing compact network schema. Paths, stops, timing, source stop sequences, call rules, route/operator IDs, source-service-day and frequency metadata are preserved. Each chunk has its byte length and SHA-256 in the manifest; the regional index pins both manifest and morning snapshot. Empty chunks are valid. There is no UI-selection change, realtime integration or deployment in this data deliverable.

Run from the repository root with Node 24+, Python 3, curl, unzip and the installed project dependencies. The source decoder adds no Python packages. A refreshed archive may require explicit policy review; do not update hashes merely to silence a failure.

```sh
# Acquire full sources; archive and vectors are kept in the ignored local cache.
python3 scripts/prepare-st-gallen-sources.py
# Or re-decode the exact saved snapshot without changing dates:
# python3 scripts/prepare-st-gallen-sources.py --inspect-cache

# Supply the pinned national ZIP; inspect docs/DATA-PIPELINE.md for acquisition.
node --max-old-space-size=8192 scripts/st-gallen-timetable.mjs \
  /private/tmp/GTFS_FP2026_20260902.zip \
  data/st-gallen-sources/local/boundary.json \
  data/st-gallen-sources/local/timetable.json

node --max-old-space-size=8192 scripts/build-st-gallen-region.mjs
node scripts/check-st-gallen-region.mjs
node scripts/document-st-gallen-study.mjs
node scripts/check-st-gallen-region.mjs --audit-only
npx vitest run scripts/st-gallen-region.test.mjs scripts/st-gallen-shared-corridors.test.mjs scripts/st-gallen-vmobil.test.mjs scripts/st-gallen-stop-anchors.test.mjs
```

The saved detour review is bound to the exact source hashes and day audits. To replay its geometry diagnostics with the original cached operator pages, run `node scripts/review-st-gallen-detours.mjs --check`. On a fresh cache, `node scripts/review-st-gallen-detours.mjs --fetch-evidence` acquires the current public pages and regenerates the review; it cannot recreate historical webpage bytes. Inspect changed notices, dates and hashes before regenerating the study. These pages support stop order and operating context, not replacement route geometry.

The endpoint review has the same source/day binding. Run `node scripts/review-st-gallen-endpoints.mjs --check` with the original evidence cache, or `--fetch-evidence` to acquire and inspect current snapshots. Its audit-only validation rejects missing pairs, foreign-agency candidates, incorrect affected totals and stale day bindings, even if the report's outer file hash is updated.

The [Vorarlberg line-164 review](ST-GALLEN-VMOBIL-REVIEW.md) additionally compares active calendars, every ordered call and time, and directed shape-distance slices against the Swiss fixtures. Both sources have 58 Friday / 26 Sunday trips with identical call times, but Treffpunkt a.d.Ach differs by 673–679 m and Messekreuzung toward Dornbirn by 143 m. External geometry does not resolve these source-coordinate discrepancies. The separately reviewed [Treffpunkt rendering anchor](ST-GALLEN-STOP-ANCHOR-REVIEW.md) now admits all 58 / 26 trips on unchanged AL_OEV geometry, preserving the original Swiss coordinate in the audit. No external shapes are admitted. Run `node scripts/review-st-gallen-vmobil.mjs --check` to replay the pinned July ZIP; shape clipping, calendar exceptions and name normalization have dedicated tests in `scripts/st-gallen-vmobil.test.mjs`.

The full checker verifies source hashes, annual-route reconciliation, every admitted and excluded source pattern, unchanged source calls/times/sequences, frequency and carry-in metadata, directed path endpoints, per-pair path hashes, shared-corridor source replay and provenance, chunk overlap consistency, morning-window membership and operator/mode/route/pair-occurrence totals. The audit-only check works from tracked files without the large source cache. The geometry regression compares against the feed and policy from commit 2351822: every previously admitted movement, call and path and every previously matched pair must be unchanged, and only the reviewed line-321, line-210 and line-164 patterns may be added. Run `node scripts/check-st-gallen-topology-regression.mjs BASELINE_FEED_DIRECTORY BASELINE_AUDIT_JSON` after building both versions with the exported `buildStGallenRegion` function and their respective policies. For the incremental line-210 regression, add `--shared` and supply the baseline from commit 7926448; only line-210 (66 Friday / 35 Sunday) and subsequently reviewed line-164 (58 / 26) trips may be added. The saved reports record the pinned baselines and result hashes. The supporting map is acquired by the source-preparation command; use `python3 scripts/prepare-st-gallen-sources.py --shared-evidence-only` to acquire it without refreshing the original source catalogue.

Regression tests cover operator isolation, misleading timetable-book numbers, prefix handling, changed overrides, polygon holes/components, preceding-day service, conditional calls, disconnected source geometry reversed artifact paths, and rejection of changed donor geometry, already-connected targets, unreviewed lengths and cross-operator repairs.

Shared-corridor tests additionally reject unapproved routes, platforms, directions and stop names, changed geometry hashes, duplicate approvals and source-operator/name changes; they verify that passing primary geometry is never replaced.

Pending scope is explicit: unresolved geometry exclusions; seasonal and holiday validation; road/track/boat direction and plausibility review; publication rights; future refresh/realtime/UI work. Passing numerical checks establishes the stated admitted feed, not complete or observed cantonal transport movement.
