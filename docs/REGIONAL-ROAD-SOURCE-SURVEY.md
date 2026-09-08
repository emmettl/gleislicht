# Regional road traffic sources

Checked **8 September 2026**. This is a targeted follow-up to [AUTO](AUTO.md) and the [Zürich cantonal road pilot](CANTONAL-ROADS.md), separate from the [26-canton transit inventory](SWISS-TRANSIT-SOURCE-INVENTORY.md). It identifies additional road-count sources; it is not an exhaustive road-data census or a claim that the sources have been integrated.

**Recommended next sources: Basel-Stadt, Thurgau and Zürich city.** Their accessible historical count series could add urban and regional daily traffic patterns. Winterthur is another concrete candidate. Aargau, Luzern and Genève provide useful measurement or planning data, with more work needed to establish suitable time-series access.

## Existing baseline and what would be new

The project already records federal ASTRA counters and the `ZH.CH` cantonal supplier through the shared DATEX II feed. The Zürich pilot joins counters to official cantonal road axes and has separately reviewed directional playback corridors. Its current status, source hashes and coverage are documented in [CANTONAL-ROADS.md](CANTONAL-ROADS.md); the latest road implementation docs take precedence over this survey for existing coverage.

The shared feed provides one-minute aggregate flow and mean speed, replacing the previous publication without historical backfill. The additional sources below mostly provide **hourly counts or statistical summaries**. Their archives could support dates before our recorder started, but their values must retain their original time resolution and measurement status. [Official road-counter documentation](https://opentransportdata.swiss/en/cookbook/road-traffic-cookbook/rt-road-traffic-counters/).

Zürich **city** and Winterthur publish municipal datasets; they are not automatically equivalent to the cantonal `ZH.CH` recording scope. Check actual counter identities and geography for overlaps before combining them.

## Source shortlist

| Source | Available data and access | Evidence level | Main unresolved work |
| --- | --- | --- | --- |
| **Basel-Stadt** | Hourly counts by direction/lane and vehicle class, coordinates, API and historical CSV files | Actual JSON record retrieved | Separate detector families, preserve validation flags, join road directions and establish speed availability separately |
| **Thurgau** | Hourly cantonal-road counts, separate vehicle-class product, API and annual compressed CSV archives back to 2011 | Actual JSON record retrieved | Acquire class/history products, validate current-year quality, filter site types and join road directions |
| **Zürich city** | Hourly municipal counts since 2012, daily previous-day updates, CSV and detector-location plans | Official catalogue/documentation checked | Preserve measured/imputed/missing flags; inspect current CSV, terms and overlaps with existing counters |
| **Winterthur** | Hourly municipal counts by vehicle class in downloadable CSV | Official resource listing checked | Inspect schema, dates, quality flags, reuse terms, station metadata and cantonal overlaps |
| **Aargau** | Permanent and periodic counts, current/historical GIS and CSV exports, road-load map | Official publisher description checked | Establish whether detailed dated observations are available beyond representative statistics; separate measured and modelled values |
| **Luzern** | Continuous measurement at 115 locations; Geoportal station map and linked measurement sheets | Official publisher description checked | Establish machine-readable time-series distribution, interval, quality flags and reuse terms |
| **Genève** | Directional counter points, morning/evening peaks, daily averages, road-graph references; ArcGIS/WFS | Official SITG schema checked | Resolve underlying observation-series access; published layer is an annually updated inventory/summary |

### Basel-Stadt

The [motorised traffic dataset `100006`](https://data.bs.ch/explore/dataset/100006/) offers hourly observations, direction/lane identifiers, vehicle-class counts and coordinates. The catalogue declares **CC BY 4.0**. Its API exposes the current year and preceding two years; older annual CSV files are separately advertised from 2014. Inductive-loop, FLIR and traffic-light detector exports are separate families. [Station locations `100038`](https://data.bs.ch/explore/dataset/100038/) provide a complementary inventory.

The sampled row contains `valuesapproved` and `valuesedited` flags, both zero. Retain these fields without assuming that all published observations have been approved. The sample is a border motorway site, so it proves endpoint access, not the completeness of the desired urban subset. No measured-speed field was present in that row. Review the publisher's separate speed-class product before promising speed-aware reconstruction.

**Next action:** acquire a defined weekday/Sunday slice and station inventory; identify urban corridors with dependable direction metadata, then audit detector types, missing intervals and road matching. Preserve attribution and distinguish hourly observed counts from any inferred motion.

### Thurgau

The [motorised traffic dataset `dbu-tba-2`](https://data.tg.ch/explore/dataset/dbu-tba-2/) publishes hourly counts under **CC0 1.0**. Only the latest two weeks are exposed directly through the portal/API. Annual files follow the publisher's pattern `https://ogdtg.ch/verkehrsdaten/total/[JAHR]_data.csv.gz`, with history back to 2011. The separate vehicle-class product is a catalogue lead; it was not sampled in this pass.

Only completed-year data are described as validated. Current-year observations remain raw and may be incomplete. Local-time fields require explicit daylight-saving handling. The actual sample includes road label `H14`, direction, lane, coordinates and count, but describes a **parking-garage entrance in Frauenfeld**. A counter in this dataset is therefore not automatically a through-road flow observation. The unordered sample also does not establish the latest available observation.

**Next action:** download a bounded historical period and the class/station metadata; classify through-road versus access counters, resolve directions and audit completeness before selecting a corridor.

### Zürich city

The [municipal hourly count series](https://data.stadt-zuerich.ch/dataset/sid_dav_verkehrszaehlung_miv_od2031) covers observations since 2012. The city describes daily delivery of the previous day's values, available by 07:00. Annual CSV resources and a `Zaehlstellen_Detail.zip` containing detector-location plans are advertised. [2026 resource listing](https://opendata.swiss/en/dataset/daten-der-verkehrszahlung-zum-motorisierten-individualverkehr-stundenwerte-seit-2012/resource/dd0b7709-4638-4f1b-b054-de78ee2c1db9).

`AnzFahrzeugeStatus` distinguishes **Gemessen**, **Fehlend** and **Imputiert**. Some isolated gaps are filled using historical patterns; prolonged gaps remain missing. These statuses must survive ingestion. A filled value is not an observed count, and a missing value is not zero. The full CSV and dataset-specific reuse conditions were not acquired/verified in this pass.

**Next action:** inspect one annual file and the counter plans, separate observed and imputed records, and compare counter identities with the existing federal/cantonal inventory. Select municipal corridors that add actual coverage.

### Winterthur

The official [hourly vehicle-class resource listing](https://opendata.swiss/de/dataset/verkehrszahldaten-motorisierter-individualverkehr-in-winterthur/resource/aaff5f81-c78e-42a9-b26d-c835cc47e682) points to a [CSV download](https://daten.statistik.zh.ch/ogd/daten/ressourcen/KTZH_00003042_00006323.csv) and a separate data-documentation resource. This is a concrete municipal source, but its contents were not downloaded in this pass. The catalogue modification date is not evidence of the latest measurement timestamp.

**Next action:** inspect schema and documentation, establish temporal coverage and reuse conditions, and resolve municipal/cantonal duplicates before choosing a road corridor.

### Aargau

The canton's [traffic survey page](https://www.ag.ch/de/themen/mobilitaet-verkehr/verkehrsdaten/verkehrserhebungen), published 10 August 2026, describes roughly **150 permanent motor-traffic counters**, supplemented by periodic mobile surveys. Current and historical representative results are distributed through AGIS as GIS data and CSV; counts are evaluated annually.

Its road-load map combines observed counts with model estimates on unmeasured stretches and represents a fixed time state. It is useful for regional context, but is not a continuous observation feed or sufficiently detailed evidence of urban conditions. Specific raw-series access and dataset reuse terms remain to be verified.

**Next action:** inspect the actual AGIS products and fields to determine whether dated hourly observations are distributed. Keep summary traffic loads and modelled stretches separate from observed flow.

### Luzern

The official [traffic counting page](https://vif.lu.ch/mobilitaet/verkehrsmodelle/Verkehrszaehlung) describes **115 continuously measured locations**; many distinguish vehicle types. The canton has made data available through its Geoportal since autumn 2024. The map also includes federal and municipal stations and links to measurement sheets where available.

Continuous collection does not prove that a public minute/hour API exists. This pass verified the publisher description, not a machine-readable observation export or dataset-specific reuse terms.

**Next action:** inspect station-layer metadata and the linked measurement products, establish time-series acquisition, and separate cantonal stations from ASTRA/municipal overlays.

### Genève

SITG's [OTC_COMPTAGE_TRAFIC](https://sitg.ge.ch/donnees/otc-comptage-trafic) provides georeferenced directional counters. Its schema includes peak-hour values (`HPM`, `HPS`), working-day and all-day averages with reference years (`TJOM`, `TJM`), availability categories, road identifiers and an `ID_GM_TRONCON` road-graph reference. ArcGIS and WFS access are advertised; updating is annual.

The published schema is an inventory and statistical summary, not a verified continuous series. Availability varies between counters and includes on-request or periodic measurements. The road-graph reference is a promising geometry join, but neither its integrity nor the underlying observation extractor was tested here. Reuse terms remain to be verified.

**Next action:** inspect the vector layer and its underlying observation distribution; preserve reference years and availability categories rather than treating annual metadata updates as fresh traffic observations.

## Recorded API evidence

[Machine-readable probes](../data/regional-road-source-probes.json) preserve the exact request URL, UTC check time, HTTP status, response size/SHA-256 and the parsed one-record response. Both unauthenticated requests returned **HTTP 200**. Counts below describe API records at check time, not stations, complete historical coverage or usable-road totals.

| Probe | Result count | Sample observation |
| --- | ---: | --- |
| Basel, ordered newest first | 1,912,056 | Station 235, A3–A35 border, from France, lane 1; 6 September 2026 21:00–22:00 UTC; 231 vehicles |
| Thurgau, unordered | 70,704 | Counter 423, Frauenfeld parking-garage entrance; 30 August 2026 12:00–13:00 local; explicit count 0 |

These checks establish endpoint access and sample structure only. Raw HTTP-body hashes identify the retrieved bytes; the committed parsed JSON is not a byte-for-byte copy of that body. Other source findings above are based on official publisher pages and metadata, not full exports.

Small repeatable public requests:

```sh
curl --fail --silent --show-error \
  'https://data.bs.ch/api/explore/v2.1/catalog/datasets/100006/records?limit=1&order_by=datetimefrom%20DESC'

curl --fail --silent --show-error \
  'https://data.tg.ch/api/explore/v2.1/catalog/datasets/dbu-tba-2/records?limit=1'
```

The live result may change. Snapshot each chosen period and its station metadata with acquisition date, true observation dates, hashes and applicable reuse terms before implementing a compiler.

## Integration requirements

1. **Preserve measurement meaning.** Store counts, interval duration, vehicle classes, lane/direction, validation/imputation flags and source identity. Convert interval counts to rates explicitly; retain the original interval. Handle Europe/Zurich daylight-saving transitions and keep missing observations distinct from zero.
2. **Resolve physical scope.** Join station coordinates and direction metadata to reviewed road geometry. Distinguish through-roads, access roads, ramps and parking entrances. Inspect nearby parallel roads, junctions and conflicting directions. Counter points alone do not provide the path between them.
3. **Avoid double counting.** Identify overlap among federal, cantonal and municipal publishers. Parallel lanes may be aggregated once their scope is known; successive counters along a road must not be summed as independent traffic streams. Vehicle-class definitions need an explicit mapping before combining sources.
4. **Adapt the rendering model.** AUTO currently derives density from flow and measured speed (`k = q / v`). Hourly count-only records cannot be passed into that model by inventing an observed speed. Use a separately labelled volume-based presentation or an explicit inferred-speed model; counts alone do not establish congestion, queues or travel times.
5. **Measure coverage before release.** Report the admitted/excluded stations and directions, observation intervals and gaps for a weekday and Sunday. Keep historical, imputed, modelled and current observations distinguishable. Validate the resulting road geometry and time behaviour before adding a public regional feed.

## Further realtime lead

The national platform also documents an [urban traffic-light interface](https://opentransportdata.swiss/en/cookbook/road-traffic-cookbook/lichtsignalanlagen-strassenverkehr/), using JSON/REST and OCIT-derived structures for detector counts and signal states. It supports online data rather than archive queries. This could support a later junction-focused study, but this survey did **not** establish participating city coverage, acquire live readings or validate access. Protocol availability is not evidence of a complete city feed.

The next concrete work is three independent source/geometry audits for **Basel-Stadt, Thurgau and Zürich city**, followed by a shared representation of hourly observations once their actual schemas and quality differences are understood.
