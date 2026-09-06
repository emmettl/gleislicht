# 008 — Correspondances

**A Paris motion study**

*Le centre respire; la région répond.*

## Thesis

Paris is an illuminated nervous system at two scales. Inside the périphérique, Métro circulation is dense, repetitive and almost cellular. RER services pass through that core and erupt into the banlieues, making the regional city suddenly enormous. The defining act is not another map morph for its own sake, but a continuous change of scale in which interchange binds centre and periphery.

**Correspondances** means transfers, but also correspondences between systems, maps and perceived cities. The work should use French first in its authored voice while retaining the Motion Studies fallback-language contract.

## Signature study: interchange waves

A selected central interchange should emit timed transfer waves rather than a generic radial pulse. Incoming Métro and RER movements contract into the complex; plausible transfer intervals delay the outgoing wave; branches then expand at radically different spatial scales. The visualization may model scheduled opportunity, but must not claim individual passenger movement without passenger-flow evidence.

The companion composition is a breathing scale transition: the Métro core remains active as the camera withdraws and the RER network unfolds across Île-de-France. Density is not solved by hiding the centre; it changes representation from individual movement to pulse and corridor intensity.

## Visual grammar

- Métro motion is fine-grained, bright and dense inside a restrained périphérique ring;
- RER movement uses longer strokes that remain legible far beyond the centre;
- the Seine provides geographic continuity across scales without becoming a decorative basemap;
- interchange halos encode scheduled connections or measured flow only when the source supports them;
- stations aggregate progressively by complex, line and regional node as scale changes;
- line/operator colour is locally authored and source-aware, never a casual copy of operator branding;
- typography should feel unmistakably Parisian while remaining readable over luminous density.

## Delivery plan

## Source audit

Île-de-France Mobilités' PRIM portal is the authoritative first source. Its GTFS Datahub export describes the next 30 days across Métro, RER, train, tram, bus and coach services from 75 operators and is regenerated three times daily. It includes routes, stops, trips, calendars and stop times, plus `stop_extensions.txt` for stop / stop-area / interchange-zone identity, `pathways.txt` for walking links inside stations and `transfers.txt` for walking correspondence times. That is unusually well aligned with this edition's thesis: scheduled connection opportunity can be modelled without pretending to observe passenger movement.

The timetable export is governed by the **Licence Mobilité**. PRIM presents catalogue export as an authenticated operation, while the canonical archive URL currently resolves directly; the compiler therefore accepts an explicit local archive and never depends on ambient browser authentication. PRIM describes the licence as ODbL-derived, allowing reuse while adding user-identification, derived-database sharing and public-interest mobility conditions. Reference datasets such as lines, stops and rail alignments may instead use Licence Ouverte or ODbL; PRIM maps and plans use separate, more restrictive terms and must not become source artwork. Every compiled Paris artifact records the exact licence, source URL, retrieval time and archive digest.

The first technical proof is the complete published Métro 1 / RER A pattern active from 07:00–09:00 on Friday 4 September 2026. It puts dense central circulation and RER regional branches on one clock without loading the full network. The pinned archive (`sha256:c29fa6124744…`) compiles to 283 journeys, 96 source stops and 99 source-shaped segments; its 251.6 KiB JSON is 67.9 KiB gzip. RER mission codes remain searchable while displayed destinations come from the final scheduled stop.

The same artifact carries the relevant `transfers.txt` evidence for five shared complexes: La Défense, Charles de Gaulle–Étoile, Châtelet–Les Halles, Gare de Lyon and Nation. Each directional link retains its published minimum transfer time. The first correspondence director finds a feasible pair of scheduled calls after the current clock, pauses on the inbound arrival, isolates both movements and reveals the complex. It describes scheduled opportunity only; it does not infer that a passenger actually transferred.

The opening scene now carries a separately sourced geographic context: the official commune 75056 contour from the French government's API Découpage administratif, 60 Seine/canal polygons from the City of Paris Plan de voirie and the nine-part Boulevard Périphérique axis from the City's Filaire de voies. Their source hashes and publishers remain separate in the compiled 6.4 KiB-gzip artifact; both City layers retain their ODbL attribution. The outline is context, not an assertion that Paris ends at the visible central boundary while the RER continues into the region.

The same two-line source proof is available across the complete Friday service day: 1,461 journeys split into twelve lazy two-hour chunks. The manifest is 19.5 KiB gzip and the largest rush-hour chunk is 52.3 KiB gzip, so the default 07:00–09:00 view remains fast and the 24-hour clock incurs only the current and adjacent chunks.

A source-pinned scope audit now measures the complete Métro/RER morning before any larger artifact is shipped. The same Friday feed contains 2,503 active journeys across 21 lines and 1,044 directional stop records during 07:00–09:00. Loading that whole nervous system into the opening view would swamp the existing 283-journey composition. The first independently loaded layer is therefore **Métro 4 + Métro 14 + RER B**: 372 journeys and 147 stops, chosen because its north–south crossing complements the opening east–west pair. Its 91.5 KiB-gzip artifact is absent from the first request graph and composes with the running opening network in the browser. When both N–S and 24H are active, its complete 2,100-journey day is drawn from a separate manifest and twelve progressive chunks; the largest compressed chunk remains below 82 KiB. The remaining lines stay outside the runtime until this five-line composition passes its real-phone density gate.

An authored **Cœur / Région** scale control now moves the same running scene between a close Châtelet-centred reading and the complete RER branch structure. It does not replace the network or reset the clock. The region view strengthens aggregate edge frequency; the close view lets individual vehicles and labels take over, retains the Seine and périphérique, and removes the enlarged administrative outline before it becomes visual architecture.

Sources:

- [PRIM GTFS Datahub dataset](https://prim.iledefrance-mobilites.fr/jeux-de-donnees/offre-horaires-tc-gtfs-idfm)
- [PRIM GTFS structure guide](https://prim.iledefrance-mobilites.fr/en/reutilisations/reutilisation/gtfs)
- [Licences used by PRIM](https://prim.iledefrance-mobilites.fr/en/licences)
- [Licence Mobilité text](https://www.iledefrance-mobilites.fr/medias/portail-idfm/4dc136f7-df23-449b-9670-24bc5254a706_RAA138.pdf)
- [API Découpage administratif — communes](https://geo.api.gouv.fr/decoupage-administratif/communes)
- [Ville de Paris — Plan de voirie, voies d’eau](https://opendata.paris.fr/explore/dataset/plan-de-voirie-voies-deau/)
- [Ville de Paris — Filaire de voies](https://opendata.paris.fr/explore/dataset/voie/)

### PAR 0 — Source and rights audit

- [x] Identify the authoritative PRIM timetable, service-calendar, route-geometry and interchange schema for Métro and RER.
- [x] Record the Licence Mobilité access and attribution/share conditions separately from open reference data and protected map artwork.
- [x] Confirm that GTFS interchange zones, pathways and transfer times can support scheduled connection opportunity; platform and passenger-flow claims remain out of scope until fixture evidence says otherwise.
- [x] Inspect the current canonical archive, freeze Friday 4 September 2026 by SHA-256 and validate the Métro 1 / RER A line pair before ingestion.

### PAR 1 — Centre / periphery proof

- [x] Compile Métro 1 and RER A on a shared deterministic 07:00–09:00 clock.
- [x] Add the Seine, an official Paris boundary and the published Boulevard Périphérique axis as a minimal geographic frame.
- [x] Prove that close individual motion can become aggregated pulse/corridor intensity as the same running scene moves between centre and region.
- [x] Establish phone and desktop density budgets before adding more lines (401.9 KiB gzip first view; 67.9 KiB timetable and 6.4 KiB geography).
- [x] Add an independent `paris.html` shell with route/station/mission search, touch station selection, route isolation, playback and limited chrome.

### PAR 2 — Correspondances

- [x] Model the five shared Métro 1 / RER A interchange complexes separately from their constituent stops.
- [x] Derive connection opportunities from timetable and directional transfer evidence without inventing passenger journeys.
- [x] Author three contrasting hub compositions: Châtelet–Les Halles as central Métro density, Gare de Lyon as cross-city RER interchange and La Défense as the regional threshold. Repeated correspondence direction cycles through the three without replacing the network.
- [x] Make station selection explain which routes touch the selected stop or complex at the current scale.

### PAR 3 — Full nervous system

- [x] Add the complete two-line Friday as twelve progressive two-hour chunks behind an explicit 24-hour control.
- [x] Audit the complete 21-line morning from the pinned archive and define the next independently loaded layer as Métro 4 + Métro 14 + RER B rather than adding 2,503 journeys to the opening scene at once.
- [x] Compile and ship the 372-journey central-cross layer behind an explicit lazy control and an independent 110 KiB compressed payload gate.
- [x] Carry the optional layer through the 24-hour clock with its own twelve progressive chunks rather than replacing or eagerly bundling it.
- Judge the five-line composition on real phones before admitting the remaining Métro or RER layers.
- [x] Add stable label tiers for interchange complexes, outer termini and close-scale stations. The regional view admits tiers 1–2, the centre admits tier 3, and labels wait 420 ms after camera motion before repopulating.
- Tune the zoom transition so neither central density nor the banlieue disappears into visual noise.
- Consider Transilien and tram only when they strengthen the centre–periphery argument.

### PAR 4 — Observed city

- Add realtime or historical operational variation only after static identities are stable.
- Consider road flow at the périphérique as a contrasting ring study, not as a requirement for modal completeness.
- Keep aviation, buses and other strata optional and justified by a specific composition.

## Exit criterion

The viewer should feel Paris change scale—from cellular Métro rhythm to regional RER expansion—while correspondence remains visible as a timed relationship rather than a station symbol.
