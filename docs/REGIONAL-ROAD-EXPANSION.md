# Geneva, Luzern and Aargau road counts

Checked **8 September 2026**. Actual public responses, exports and two sample reports were acquired for this follow-up to the [regional source survey](REGIONAL-ROAD-SOURCE-SURVEY.md). All three can add statistical road information. **No dated hourly observation feed was verified for these three sources**, so these products cannot populate the existing 4/6 September hourly recordings or support moving vehicles without further evidence.

## What is usable

| Source | Verified product | Useful next integration | Missing for dated playback |
| --- | --- | --- | --- |
| Geneva | 694 directional counter points with annual daily means, peak summaries, reference years and availability | Counter map and annual summaries | Underlying dated observations; road-graph/direction review; speed evidence |
| Luzern | 149 MIV points, 70 signal locations, linked reports; a separate city annual-history table | Annual summaries and explicitly labelled typical weekday profiles | Actual dated hourly values; report-period/metadata reconciliation; geometry review |
| Aargau | 10,222 CSV survey records, 935 distinct station IDs (911 MIV), periods, direction and class statistics | A survey-period explorer, starting with the structured CSV | Actual hourly observations and report-level quality extraction; direction/geometry review |

These totals describe different things and must not be added together as coverage. Inventories include other owners and historical or inactive stations. Nothing from this survey has been added to public playback.

**9 September implementation:** the [Aargau statistical importer](AARGAU-ROAD-STATISTICS.md) now retains all 10,093 MIV records, separates annual/period metrics, preserves missing dates, flags three invalid periods and attaches the reviewed holiday substitution. Public display remains unadmitted.

## Geneva

The [SITG counter catalogue](https://sitg.ge.ch/donnees/otc-comptage-trafic) exposes a queryable [ArcGIS layer](https://vector.sitg.ge.ch/arcgis/rest/services/OTC_COMPTAGE_TRAFIC/FeatureServer/0?f=pjson). A full LV95 point query returned 694 features, matching the independent count query without a transfer-limit flag.

`TJM` and `TJOM` are daily means with separate reference years; `HPM` and `HPS` are peak summaries. Of the 694 points, 302 have a 2025 `TJM_ANNEE`, while 170 have none. Availability is heterogeneous: 176 say `365 jrs/an`, 80 `3 semaines/an`, 30 once every five years, 27 suspended, nine on request and 372 `non`. These labels describe source availability, not successfully acquired time-series coverage.

Keep `NO_POINT_MESURE`, `NO_SIREDO` and road references. `NO_SIREDO` includes fractional values such as **2068.2**, so integer coercion would lose identity. `DATEDT` is an edit timestamp. `ANGLE` is a symbol angle from north, not yet a reviewed travel bearing. `ID_GM_TRONCON` offers a possible road-graph join; its integrity was not tested here.

The layer has no related observation table. Its schema mentions an extractor, but no underlying hourly endpoint was established in this pass. The generic GIS export panel is not evidence of such a feed. Published [SITG reuse conditions](https://sitg.ge.ch/ressources/conditions-utilisation-donnees) identify this as access level A and require attribution, extraction timing and disclosure of transformations where applicable; preserve the pinned terms and credit **Données SITG**.

## Luzern

The [official counting page](https://vif.lu.ch/mobilitaet/verkehrsmodelle/Verkehrszaehlung) describes 115 continuously measured locations. That figure is a different scope from the multi-owner [Geoportal product](https://daten.geo.lu.ch/download/verkzlng_col_v2). Its MIV layer returned 149 points, independently count-checked: 64 Canton Luzern, 63 City Luzern, 16 Canton Aargau, two Horw and one each Zug, Nidwalden, Schwyz and Bern. The separate signal layer returned 70 locations, also count-checked; it is infrastructure metadata, not measured flow. ASTRA motorway stations are another separate layer.

The MIV schema contains `DTV` without a reference-year field. Linked PDF dates must not silently become that value's reference period. At **266, Wolhusen Bahnhof**, the layer says DTV **15,546**, while the linked [2025 report](https://www.geo.lu.ch/doc/verkehrszaehler/MIV_266_Wolhusen_Bahnhof_2025.pdf) says **15,207** for **1 August–31 December 2025**. This discrepancy remains unresolved. Its 24-hour table is labelled **Stundenwerte (DWV)**: an average weekday profile over that period, not a particular day's measurements. Direction labels are “von Wolhusen” and “nach Wolhusen”; they still need physical road matching. Preserve separately rounded printed totals.

Following the city map also found a public [DTV_HISTORY table](https://poi.stadtluzern.ch/server/rest/services/TBA/DTV_HISTORY/FeatureServer/2?f=pjson): 951 records, fields `DTV_JAHR`, `DTV_ANZAHL` and `FEATURELINK`. A five-row sample ordered by descending year contains 2025 annual means. It is deliberately incomplete, with `exceededTransferLimit: true`; the complete history was not downloaded. This is an annual-history lead, not an hourly feed.

The cantonal download page allows commercial and noncommercial use with source attribution (`open-by`). Separate municipal service reuse terms still need checking before importing city history.

## Aargau

The [official survey page](https://www.ag.ch/de/themen/mobilitaet-verkehr/verkehrsdaten/verkehrserhebungen) leads to a public [AGIS CSV ZIP](https://api.geo.ag.ch/v1/data/downloads/AGIS.avk_vkzsmeas/download/CSV/kanton_aargau). Its `avk_vkzsmeas_20260803.csv` contains **10,093 MIV rows and 129 cycle rows**, spanning reference years 1983–2026. There are 887 distinct MIV station IDs with a latest-plausible record; “latest” does not imply recent. Records include other cantons and federal owners. Their identities require an overlap check against existing ASTRA and regional sources.

The structured fields make this the strongest next **statistical survey adapter**: retain source station ID, owner, counter and measurement coordinates, survey period, equipment/class scheme, direction, reference year, latest-plausible flag and report link. The [field documentation](https://www.ag.ch/geoportal/geodatenshop/Datendokumentation.aspx?Datensatzelement=6895) defines `BIS` as exclusive. Annualized `DTV` and survey-period `DTV24` are different measures; neither is a dated hourly row. Empty class fields must remain missing, not zero.

The [Fislisbach sample report](https://www.ag.ch/geoportal/agisviewer/zusatzdokumente/avk/vkz/dokus/20260430_I_1000.pdf) covers 30 April–14 May 2026 exclusive. It reports annualized DTV **7,473**, period daily mean **7,832**, and directional average weekday hourly profiles. **The report explicitly replaces 1 May holiday data with 8 May data.** That substitution is not exposed as a dedicated CSV quality flag, so a CSV-only adapter cannot call every underlying value observed. Report-level notes must be preserved before exposing profiles. Direction labels identify Birmenstorf and Fislisbach; neither a bearing nor a continuous corridor has been approved.

The download includes reuse conditions. The separately pinned [AGIS terms](https://www.ag.ch/geoportal/geodatenshop/Nutzungsbedingungen.aspx?Typ=NutzungsbedingungenAGIS1) require credit **Daten des Kantons Aargau** and publish API rate limits. Keep these conditions with any derived dataset. The export's August state does not establish September observation availability.

## Evidence and next work

[The acquisition manifest](../data/regional-road-expansion-sources/2026-09-08/manifest.json) pins 23 original response bodies with exact URLs, UTC retrieval times, status, byte counts and SHA-256. JSON/HTML bodies are stored with deterministic gzip compression; hashes refer to the decompressed original bytes. PDFs and the original ZIP are retained unchanged. The first page of both sampled measurement reports was rendered and visually inspected, in addition to text extraction. Other linked reports have not been audited.

Reproduce the [machine-readable audit](../data/regional-road-expansion-audit.json) offline:

```sh
python3 scripts/audit-regional-road-expansion.py > /tmp/regional-road-expansion-audit.json
diff -u data/regional-road-expansion-audit.json /tmp/regional-road-expansion-audit.json
```

Recommended order: **Aargau structured survey statistics**, then **Luzern report profiles**, with **Geneva counter/annual summaries** as a separate map layer. Each needs an explicit statistical product type and reference period. Obtaining actual historical hourly exports is a separate acquisition step for all three. Source-owner contact has not been initiated. No public UI or deployment changed in this survey.
