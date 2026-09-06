# NORIKAE

**A Tokyo motion study**

**Catalogue status:** preferred third-city investigation; unnumbered.

## Thesis

Tokyo does not need neon applied as decoration. Its railway already reads as circuitry: overlapping operator territories, lines passing above and below one another, rapid and suburban services pouring through colossal stations, and a loop pulsing around the centre. At night the physical city could almost disappear beneath the transport system.

**NORIKAE** names the passenger act at the centre of the work. The edition should reveal Tokyo through changes of line, level, service pattern and operator rather than present the network as one frictionless corporate diagram. A journey may continue through an operator boundary, require a transfer inside a station complex, or exchange a rapid outer rhythm for a dense inner cadence. Those are different claims and the data must keep them different.

## Feasibility verdict — 6 September 2026

The edition is feasible in stages, but its most distinctive form does not yet have a durable publication path.

| Scope | Status | What is defensible now |
| --- | --- | --- |
| Toei technical proof | **Green** | Toei publishes GTFS/GTFS-JP for its four subway lines, the Tokyo Sakura Tram and Nippori–Toneri Liner under CC BY 4.0. Its separate train-location data covers the subway and tram, with stated omissions. A scheduled, reproducible Oedo-loop-and-crossings study can begin without relying on protected operator artwork. |
| Tokyo Metro + Toei central study | **Amber** | Both have permanent machine-readable timetable paths, but Tokyo Metro uses the Public Transportation Open Data Basic License. Publication of compact browser JSON and retention of a pinned historical schedule need written clarification against the licence's reusable-derivative and update requirements. |
| Yamanote + major private-railway edition | **Red for permanent publication** | JR East and several major private operators are currently available through Challenge 2026 data. That licence is for challenge entries, terminates on 12 March 2027, and requires use to cease and the data to be deleted. It cannot support a permanent Motion Studies artifact without a new permission or later durable licence. |
| Geographic and city context | **Green / amber by layer** | MLIT publishes current railway geometry and station identities as open national spatial data; station totals and PLATEAU 3D city models are also available. Administrative/coastline data and any survey-derived layer still require their individual attribution and surveying-law notes to be checked before publication. |

This means Tokyo passes the **technical source-path** test for a bounded study, but not yet the **defining source-path** test for the full thesis. The Yamanote loop may appear as contextual infrastructure from open geometry; it must not pulse with invented frequency or reconstructed unofficial timetables.

## Authoritative transport sources

### Durable operator feeds

The [Public Transportation Open Data Center](https://ckan.odpt.org/en/dataset/) is the first operator-data source. Access requires a developer registration and API key; registration is reviewed and may take at least two business days. Tokens belong only in the offline compiler and must never enter the browser bundle, repository or generated artifact metadata.

| Publisher | Available data | Licence | Use in NORIKAE |
| --- | --- | --- | --- |
| [Tokyo Metro](https://ckan.odpt.org/en/dataset/train-tokyometro) | Static GTFS/GTFS-JP; separate station, route, train timetable, station timetable, ridership and status JSON; GTFS-RT Alerts | Public Transportation Open Data Basic License | Strong scheduled core after rights clarification. The currently catalogued GTFS-RT resource is Alerts, not a whole-network vehicle-position feed, so it cannot be described as observed train motion. |
| [Bureau of Transportation, Tokyo Metropolitan Government (Toei)](https://ckan.odpt.org/dataset/train-toei) | Static GTFS/GTFS-JP for the four subway lines, Sakura Tram and Nippori–Toneri Liner; separate timetable and [train-location JSON](https://ckan.odpt.org/dataset/r_train_location-toei) | CC BY 4.0 | Cleanest first proof. The published location feed omits the Mita Line between Meguro and Shirokane-takanawa and does not itself create a historical archive. |
| Metropolitan Intercity Railway, Tokyo Waterfront Area Rapid Transit and Tokyo Tama Intercity Monorail | Permanent GTFS/GTFS-JP entries in the ODPT catalogue | Public Transportation Open Data Basic License | Possible later edge layers. They broaden mode and geography but do not replace the missing central JR/private-railway lattice. Each dataset's specific terms still need inspection. |
| Yurikamome | Permanent ODPT route, station and timetable-style JSON entries | Dataset-specific ODPT terms to verify | A strong elevated bay study, but not an opening-scene requirement and not yet admitted until its complete timetable/geometry package is inspected. |

The archives themselves have not yet been obtained. Before making any schema claim, inspect and record `feed_info`, `agency`, `routes`, `trips`, `stop_times`, `calendar`, `calendar_dates`, `shapes`, `transfers`, `pathways`, `levels`, `translations`, `attributions` and any GTFS-JP extensions actually present. GTFS/GTFS-JP labelling is promising, but optional transfer, level and through-service fields must not be assumed from the catalogue page.

### Challenge-only coverage

The [Public Transportation Open Data Challenge 2026](https://challenge2026.odpt.org/en/) runs from 1 July 2026 to 12 March 2027. Its catalogue currently exposes [JR East static GTFS/GTFS-JP](https://ckan.odpt.org/en/dataset/jreast_tokyo_area), realtime and location data for a substantial part of the Kantō conventional network, with stated exclusions. The challenge also lists Keio, Keikyu, Odakyu, Seibu, Sotetsu, Tobu and Tokyu among participating railway operators; exact resources and coverage differ by operator.

These feeds are **not an internal-proof free pass**. The limited licence says their use must be for a challenge entry, public free use is required during the challenge, authorization ends on 12 March 2027, and the data must then be deleted. JR East also adds conditions against using derived work to develop or improve a competing service. Do not download, retain, commit or publish challenge data unless the project deliberately enters under those terms and has a removal plan. Even then, it cannot establish the durable source path required for a numbered work.

### ODPT publication questions

The [Public Transportation Open Data Basic License](https://developer.odpt.org/terms/data_basic_license.html) permits public and commercial deliverables, but prohibits redistribution of source or derivative data in a reusable form when all or most of the original can be restored. The accompanying [developer guideline](https://developer.odpt.org/terms/data_basic_use_guideline.html) requires a visible obtained-at time for static data, periodic refresh, an update within one week of a notified source update, ODPT provenance, a no-warranty notice and a developer contact so users do not contact operators.

Before Tokyo Metro data enters a public branch, obtain written answers from ODPT to these questions:

1. Is a compact, line-bounded JSON timetable chunk downloaded by the browser considered part of the application deliverable, or prohibited reusable derivative data, when it cannot reconstruct most of the source feed?
2. May an explicitly labelled historical motion study retain a pinned archive and service date instead of updating the displayed study whenever the current feed changes?
3. If the current feed must be refreshed, may older compiled studies remain available as dated archival works?
4. What attribution and developer-contact presentation is required for an exhibition-style page with deliberately limited chrome?
5. Is a durable licence planned or available for JR East's Yamanote timetable and the participating private railways after Challenge 2026?
6. May screenshots or recorded films made from a challenge entry remain after the limited-data authorization ends, and under what attribution?

Until those answers are retained beside the source manifest, Tokyo Metro is suitable for local research but amber for publication. The Toei CC BY feed remains the least encumbered starting point; modified artifacts must carry the provider credit and modification notice described by ODPT's CC BY FAQ.

## Geographic, structural and contextual sources

| Source | What it supports | Limits |
| --- | --- | --- |
| [MLIT National Land Numerical Information — Railway N02, 2025](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html) | Open GML, Shapefile and GeoJSON railway sections and stations with railway class, operator class, line name, operating company, station name and station/group codes | Route-level infrastructure, not a timetable, platform or physical-track assignment. It does not prove service pattern, through-running or a train's observed position. |
| [MLIT station ridership S12, 2024](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S12-2024.html) | Annual station passenger totals, operator/line attributes and a join to N02 station geometry under CC BY 4.0 | Useful for label and hub hierarchy only. MLIT warns that operator calculation methods are not uniform; totals do not describe transfers, time of day, platform load or individual movement. |
| [MLIT administrative areas N03](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2024.html) | Tokyo ward/prefecture polygons and coastline in GML, Shapefile and GeoJSON | The individual release notes warn that some secondary uses may require a Geospatial Information Authority survey-law application. Resolve that before adopting it as the edition boundary. |
| [Project PLATEAU open data](https://www.mlit.go.jp/plateau/open-data/) | Open 3D city models for Tokyo's 23 wards and individual wards; a cropped station-neighbourhood model could let the built city recede under the network | Whole-city source packages are far too large for an opening payload. Use a simplified, independently lazy crop only. The standard railway LOD1 model assigns height zero, so it cannot prove the vertical separation of stacked rail lines. |
| [MLIT indoor maps](https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/tochi_fudousan_kensetsugyo_tk17_000001_00009.html) | Layered indoor maps and walking networks for Tokyo and Shinjuku station surroundings | Valuable for a later station-close study, but coverage is local, some releases date from 2020, and public passages are not evidence of actual passenger transfers or of every operator platform. |

The minimum geographic frame should be Tokyo Bay/coastline, the Sumida and Arakawa systems, the 23-ward silhouette and railway geometry. Buildings should be absent or nearly black in the opening composition. PLATEAU belongs behind a close-scale station action, not under the first city download.

## What each visual claim requires

| Intended claim | Evidence required | Present feasibility |
| --- | --- | --- |
| Scheduled train motion | Active calendar, trip and stop times for a pinned JST service day | **Yes** for Toei; likely for Tokyo Metro after archive and rights inspection; temporary only for JR/private challenge feeds. |
| Rapid, local and suburban rhythm | Published per-trip service type or a defensible stopping-pattern derivation | **Unknown until feed inspection.** Never infer the public service label from speed alone. The richest cross-operator example currently depends on challenge-only feeds. |
| Yamanote as a luminous clock | Durable JR East timetable identity and loop-consistent geometry | **Blocked for permanent release.** Open N02 geometry supplies the loop shape, not the moving schedule. |
| Operator empires | Multiple durable agency feeds, namespaced IDs and a licence-compatible common service day | **Partial.** Metro/Toei and several smaller permanent feeds are possible; the defining JR and major private lattice is not durable yet. |
| A real norikae | Published transfer/pathway evidence or an authored statement limited to network adjacency | **To inspect.** A shared station name and proximity can identify a candidate complex, but not transfer duration or passenger behavior. |
| Through-running without a transfer | Stable cross-feed trip/block/train identity across an operator boundary | **To inspect and probably the hardest join.** Do not join trains solely because their public destination and boundary time look compatible. |
| Colossal station hierarchy | Annual S12 totals and operator-specific station data | **Yes for scale, not flow.** Keep totals labelled by year and source methodology. |
| Stacked vertical railway | Measured elevations, levels or localized indoor/3D data | **Localized only.** N02 is 2D and PLATEAU railway LOD1 height is zero. Citywide vertical motion would otherwise be authored metaphor, not measurement. |
| Observed movement | Timestamped train-location observations joined to static trip identities | **Toei only on a durable licence at present.** Tokyo Metro's catalogued GTFS-RT resource is Alerts; JR/private locations are challenge-limited. |

## Identity and compiler risks

- Namespace every source identifier by publisher and feed release. Tokyo's operator overlap makes bare route, stop and trip IDs unsafe.
- Create station complexes as a separate authored/source-backed layer. N02 groups only same-named stations within 300 metres and cannot settle every paid-area or walking relationship.
- Preserve Japanese names as canonical labels and treat English/romanized text as a source translation, never as the identity key.
- Record `Asia/Tokyo`, feed validity, service date, retrieval time, source URL, licence identifier and SHA-256 for every input. Japan has no daylight-saving transition, but trips beyond 24:00 still need the existing civil-service-day handling.
- Test circular-route closure explicitly. A loop must not duplicate its terminal, jump across midnight or lose direction when its first and last station identities coincide.
- Treat through services as continuous only when the feeds provide a stable join. Otherwise end one trip and begin another at the boundary without inventing a forced transfer.
- Keep official maps, route symbols, station-number icons, logos and train imagery out of the first proof. An authored palette can preserve operator and service-pattern identity without importing protected artwork or modifying official marks.
- Separate scheduled, realtime and recorded/historical artifacts. A current location API is not a reproducible observed day unless observations are lawfully captured, retained and timestamped.

## Recommended first proof

### TOK 0A — Rights-clean Toei proof

Compile a normal weekday 07:00–09:00 JST study around the Oedo loop and the three crossing Toei subway lines. This is a technical proof rather than the final thesis image.

- Use Toei's static CC BY GTFS/GTFS-JP as timetable truth.
- Use the feed's own shapes if present and complete; otherwise join stops and routes to MLIT N02 geometry while recording match coverage and fallbacks.
- Test circular paths, dense station labels, Japanese/English search, route isolation and a phone-first compressed payload.
- Use scheduled interpolation in the deterministic artifact. Evaluate the separate Toei location feed as an explicitly live layer only after its train identity and timestamps are understood.
- Do not call proximity between two lines a timed transfer unless `transfers`, `pathways` or another authoritative source supports it.

### TOK 0B — Central multi-operator proof

After ODPT answers the browser-artifact and historical-refresh questions, add a small number of Tokyo Metro lines crossing the Oedo composition. The acceptance test is whether operator change, transfer opportunity and continuous through-running can be represented as three distinct states.

The bounded proof should include no more than three source-backed interchange complexes and should stay within a 100 KiB-gzip timetable/geography target before JavaScript and CSS. Full-day data, PLATEAU buildings, indoor station geometry and live positions remain separately lazy.

### TOK 0C — Defining Yamanote study

Do not begin the public Yamanote/operator-empires composition until JR East has a durable source licence. If the project deliberately enters Challenge 2026, a temporary entry may measure density, loop behavior and operator joins, but the challenge source data must stay isolated from permanent artifacts and have a dated deletion plan; any derived work must stop using it when authorization ends unless written permission says otherwise. Results that do not depend on retaining the limited data—such as generic renderer performance findings—may inform later work only after the challenge terms are reviewed.

## Source-gate checklist

### Access and rights

- [ ] Register an ODPT developer account; keep the API token out of the repository and client.
- [ ] Save the terms, guideline, per-dataset licence and specific conditions effective on the retrieval date.
- [ ] Obtain written ODPT clarification for compact browser artifacts and historical pinned studies.
- [ ] Confirm whether durable JR East and private-operator licences exist beyond Challenge 2026.
- [ ] Review N03/PLATEAU/indoor-map release-specific attribution and survey-law conditions.

### Feed inspection

- [ ] Download the current Toei static archive and record URL, retrieval time, feed version, validity and SHA-256.
- [ ] Inventory every GTFS table and validate service calendars, shapes, translations, levels, pathways, transfers and after-midnight times.
- [ ] Measure Oedo loop closure, stop hierarchy, line geometry and two-hour trip/segment counts.
- [ ] Inspect Toei train-location identity, timestamp, refresh cadence and gaps against the static feed.
- [ ] After rights clarification, repeat the inventory for Tokyo Metro and test publisher-namespaced joins.
- [ ] Audit rapid/local labels and through-service continuity from source fields rather than names or inferred speed.

### Proof and admission

- [ ] Compile the Toei 07:00–09:00 proof with source metadata and a compressed payload report.
- [ ] Validate Japanese and English search without transliteration-based identity collisions.
- [ ] Author no more than three candidate interchange complexes and label the evidence behind each relationship.
- [ ] Test desktop and iPhone density, reduced motion, loop continuity and route/operator isolation.
- [ ] Admit NORIKAE to the numbered catalogue only when the durable data can support a claim more specific than a Toei subway visualizer.

## Exit criterion for the investigation

The source gate passes when a permanent, reproducible set of operator timetables can show a Tokyo-specific change of line or operator on one shared clock, with defensible geometry and a public artifact licence. The full edition gate passes only when the Yamanote pulse and overlapping railway empires can be shown without challenge-limited data, unofficial timetable reconstruction or invented vertical/transfer claims.
