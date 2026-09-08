# Geneva and Luzern road statistics

Implemented **9 September 2026** from the [pinned 8 September sources](REGIONAL-ROAD-EXPANSION.md). Open **AUTO → Road recordings → Geneva & Luzern road statistics**. The view supports all four interface languages and keeps statistical summaries separate from dated recordings. Neither source is admitted to vehicle playback.

## Geneva annual summaries

All **694 measurement points** are selectable. Identity uses `NO_POINT_MESURE`, which is unique in this snapshot. There are only **586 distinct SIREDO numbers**; fractional values such as 2068.2 are retained, and SIREDO is not used to merge stations.

Daily and working-day means retain their own reference years. **170 points have no daily mean**; the interface shows absence explicitly. Reported zero peaks remain zero. Morning/evening peaks have no verified reference period, so they are shown as source summaries without a dated-hour interpretation. Availability categories are translated while their original values remain in the public data.

The public product intentionally omits edit timestamps and symbol angles: neither establishes when the traffic was measured or a reviewed travel direction. Source geometry remains in the pinned original response for future road matching. The footer credits **Données SITG**, links to the catalogue and gives the extraction date. The transformation is field selection and normalization, with no interpolation or estimation of missing values.

## Luzern typical weekday profile

This release contains **one reviewed report**, counter **266, Wolhusen Bahnhof**, for **1 August–31 December 2025 inclusive**. It does not represent all 149 points in the regional inventory. The [source report](https://www.geo.lu.ch/doc/verkehrszaehler/MIV_266_Wolhusen_Bahnhof_2025.pdf) was extracted as text and its complete first page rendered and visually checked. The [review record](../data/luzern-road-profile-review.json) binds the transcription to the PDF SHA-256 and page.

The profile is an **average weekday**, with 24 hourly values for both directions, from Wolhusen and towards Wolhusen. Users can switch directions, see the profile and expand its numeric table. No observation date or travel speed is inferred.

The report's combined-direction daily mean is **15,207**; the catalogue lists **15,546** without a reference year. The interface shows this unresolved discrepancy. The daily mean is distinct from the weekday hourly profile: summing the latter does not reconstruct that all-day mean.

At hours **04–05, 12–13, 15–16, 18–19 and 21–22**, separately rounded directional values differ from the printed combined value by one. All three printed series are retained; the compiler neither replaces combined values with direction sums nor rescales them to the daily mean. The source footer credits the canton/vif and links directly to the reviewed report.

## Reproduction and checks

```sh
python3 scripts/compile_geneva_luzern_statistics.py
python3 -m unittest discover -s scripts -p 'test_geneva_luzern_statistics.py'
npx vitest run scripts/geneva-luzern-statistics-ui.test.tsx scripts/aargau-road-statistics-ui.test.tsx scripts/regional-road-volumes-ui.test.tsx
```

[The audit](../data/geneva-luzern-statistics-audit.json) records completeness, missing values, distinct identities, rounding differences and public-file hashes. [Public assets](../public/data/geneva-luzern-statistics/index.json) are deterministic and fetched only on opening the view, with region/schema and byte/SHA-256 checks before display. Tests cover reproduction, source integrity, missing versus zero, independent reference years, direction rounding, limited profile scope, localization and failed requests.

Further Luzern reports need their own period, direction and qualification reviews. Geneva's underlying dated observations and road-graph joins remain unverified. These changes add public statistical assets and interface code; deployment remains a separate step.
