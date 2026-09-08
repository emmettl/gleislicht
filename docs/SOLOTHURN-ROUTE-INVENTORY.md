# Solothurn route admission and exclusion inventory

All 193 original GTFS route identities with at least one annual call in the canton. Labels can repeat across operators and route IDs. Each cell gives admitted / total civil-day instances, including separately labelled representative headway instances. See the [study](SOLOTHURN-STUDY.md) for geometry inference, supplementary night admission and calendar scope. Inactive records remain in the denominator. “Admitted-all-dated-trips” applies only to the two tested dates.

## Agency census

| GTFS agency | Source name | Annual routes | Routes contributing feed | Friday admitted / total | Sunday admitted / total |
| --- | --- | --- | --- | --- | --- |
| 11 | Schweizerische Bundesbahnen SBB | 71 | 40 | 941 / 950 | 893 / 903 |
| 33 | BLS AG (bls) | 9 | 7 | 158 / 158 | 161 / 161 |
| 37 | Baselland Transport | 4 | 3 | 266 / 360 | 247 / 350 |
| 68 | Oensingen-Balsthal-Bahn | 1 | 0 | 0 / 0 | 0 / 0 |
| 81 | Aare Seeland mobil (snb) | 1 | 1 | 150 / 150 | 95 / 95 |
| 82 | Schweizerische Südostbahn (sob) | 4 | 3 | 43 / 43 | 41 / 41 |
| 88 | Regionalverkehr Bern-Solothurn | 2 | 2 | 130 / 130 | 77 / 77 |
| 182 | Bielersee-Schifffahrts-Gesellschaft AG | 1 | 1 | 4 / 4 | 4 / 4 |
| 202 | Seilbahn Weissenstein AG | 1 | 1 | 1078 / 1078 | 1108 / 1108 |
| 723 | Aargau Verkehr AG | 1 | 1 | 0 / 0 | 4 / 4 |
| 793 | Busbetrieb Olten-Gösgen-Gäu | 16 | 16 | 926 / 955 | 620 / 620 |
| 801 | PostAuto AG | 30 | 30 | 1394 / 1394 | 956 / 961 |
| 840 | Busbetrieb Aarau | 3 | 3 | 388 / 388 | 300 / 300 |
| 850 | Autobusbetrieb RBS | 5 | 5 | 205 / 205 | 141 / 141 |
| 883 | Busbetrieb Solothurn und Umgebung | 17 | 16 | 787 / 787 | 422 / 424 |
| 894 | Busbetrieb Grenchen und Umgebung | 9 | 9 | 554 / 554 | 282 / 282 |
| 7136 | Aare Seeland mobil Ersatzverkehr | 1 | 0 | 0 / 0 | 0 / 0 |
| 7230 | BLS Netz AG Ersatzverkehr | 1 | 0 | 0 / 0 | 0 / 0 |
| 7231 | SBB Infrastruktur AG Bahnersatz | 16 | 10 | 0 / 0 | 327 / 348 |

## Every route record

| Route ID | Agency | Line / mode | Districts | Status | Friday admitted / total | Sunday admitted / total | Exclusions / explanation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 91-10-j26-1 | 37 | 10 / tram | Dorneck | partially-admitted | 107 / 201 | 115 / 218 | incomplete-directed-pattern |
| 91-11-E-j26-1 | 11 | SN11 / rail | Olten | admitted-all-dated-trips | 0 / 0 | 4 / 4 | All dated journeys pass |
| 91-11-M-j26-1 | 81 | S11 / rail | Gäu, Lebern, Solothurn | admitted-all-dated-trips | 150 / 150 | 95 / 95 | All dated journeys pass |
| 91-12-K-j26-1 | 11 | RE12 / rail | Olten | admitted-all-dated-trips | 40 / 40 | 40 / 40 | All dated journeys pass |
| 91-16-B-j26-1 | 11 | IR16 / rail | Olten | admitted-all-dated-trips | 36 / 36 | 36 / 36 | All dated journeys pass |
| 91-17-B-j26-1 | 33 | IR17 / rail | Olten | admitted-all-dated-trips | 38 / 38 | 39 / 39 | All dated journeys pass |
| 91-17-C-j26-1 | 82 | IR17 / rail | Olten | admitted-all-dated-trips | 2 / 2 | 1 / 1 | All dated journeys pass |
| 91-17-F-j26-1 | 11 | IR17 / rail | Olten | admitted-all-dated-trips | 1 / 1 | 2 / 2 | All dated journeys pass |
| 91-19-C-j26-1 | 11 | S19 / rail | Lebern, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-1B-Y-j26-1 | 11 | IC / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-1-D-j26-1 | 11 | IC1 / rail | Olten | admitted-all-dated-trips | 8 / 8 | 9 / 9 | All dated journeys pass |
| 91-1G-Y-j26-1 | 11 | RE / rail | Olten | admitted-all-dated-trips | 1 / 1 | 0 / 0 | All dated journeys pass |
| 91-1-H-j26-1 | 11 | SN1 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-1-I-j26-1 | 11 | SN1 / rail | Olten | admitted-all-dated-trips | 0 / 0 | 4 / 4 | All dated journeys pass |
| 91-1I-Y-j26-1 | 33 | EXT / rail | Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-1W-Y-j26-1 | 11 | EXT / rail | Olten | admitted-all-dated-trips | 0 / 0 | 2 / 2 | All dated journeys pass |
| 91-20-A-j26-1 | 11 | S20 / rail | Gäu, Lebern, Olten, Solothurn, Wasseramt | admitted-all-dated-trips | 120 / 120 | 80 / 80 | All dated journeys pass |
| 91-21-C-j26-1 | 11 | S21 / rail | Lebern, Solothurn | admitted-all-dated-trips | 38 / 38 | 36 / 36 | All dated journeys pass |
| 91-21-D-j26-1 | 11 | IC21 / rail | Olten | admitted-all-dated-trips | 18 / 18 | 18 / 18 | All dated journeys pass |
| 91-21-Y-j26-1 | 82 | IR / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-22-G-j26-1 | 68 | S22 / rail | Gäu, Thal | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-22-j26-1 | 11 | S22 / rail | Gäu, Thal | admitted-all-dated-trips | 58 / 58 | 58 / 58 | All dated journeys pass |
| 91-23-j26-1 | 11 | S23 / rail | Olten | admitted-all-dated-trips | 78 / 78 | 78 / 78 | All dated journeys pass |
| 91-24-F-j26-1 | 11 | RE24 / rail | Olten | admitted-all-dated-trips | 40 / 40 | 40 / 40 | All dated journeys pass |
| 91-26-C-j26-1 | 82 | IR26 / rail | Olten | admitted-all-dated-trips | 21 / 21 | 20 / 20 | All dated journeys pass |
| 91-26-D-j26-1 | 11 | IR26 / rail | Olten | admitted-all-dated-trips | 1 / 1 | 1 / 1 | All dated journeys pass |
| 91-26-E-j26-1 | 11 | RE26 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-26-j26-1 | 11 | S26 / rail | Olten | admitted-all-dated-trips | 41 / 41 | 39 / 39 | All dated journeys pass |
| 91-27-A-j26-1 | 11 | IR27 / rail | Olten | admitted-all-dated-trips | 37 / 37 | 32 / 32 | All dated journeys pass |
| 91-28-j26-1 | 11 | S28 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-29-j26-1 | 11 | S29 / rail | Olten | admitted-all-dated-trips | 86 / 86 | 86 / 86 | All dated journeys pass |
| 91-29-Y-j26-1 | 11 | IC / rail | Olten | admitted-all-dated-trips | 0 / 0 | 1 / 1 | All dated journeys pass |
| 91-2F-Y-j26-1 | 33 | S / rail | Solothurn, Wasseramt | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-2H-Y-j26-1 | 11 | IC / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-2J-Y-j26-1 | 11 | IC / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-2W-Y-j26-1 | 11 | EC / rail | Olten | excluded | 0 / 6 | 0 / 8 | incomplete-directed-pattern |
| 91-35-A-j26-1 | 82 | IR35 / rail | Olten | admitted-all-dated-trips | 20 / 20 | 20 / 20 | All dated journeys pass |
| 91-35-B-j26-1 | 11 | IR35 / rail | Olten | admitted-all-dated-trips | 16 / 16 | 16 / 16 | All dated journeys pass |
| 91-35-D-j26-1 | 33 | IR35 / rail | Olten | admitted-all-dated-trips | 1 / 1 | 1 / 1 | All dated journeys pass |
| 91-37-E-j26-1 | 11 | RE37 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-37-j26-1 | 11 | IR37 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-3A-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-3-B-j26-1 | 11 | S3 / rail | Olten | admitted-all-dated-trips | 86 / 86 | 87 / 87 | All dated journeys pass |
| 91-3L-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-3M-Y-j26-1 | 11 | IR / rail | Olten | admitted-all-dated-trips | 0 / 0 | 1 / 1 | All dated journeys pass |
| 91-3R-Y-j26-1 | 11 | EC / rail | Olten | excluded | 0 / 2 | 0 / 2 | incomplete-directed-pattern |
| 91-3U-Y-j26-1 | 11 | IR / rail | Olten | admitted-all-dated-trips | 1 / 1 | 1 / 1 | All dated journeys pass |
| 91-3W-Y-j26-1 | 11 | IC / rail | Olten | admitted-all-dated-trips | 0 / 0 | 1 / 1 | All dated journeys pass |
| 91-3-Y-j26-1 | 11 | ICE / rail | Olten | admitted-all-dated-trips | 12 / 12 | 12 / 12 | All dated journeys pass |
| 91-40-Y-j26-1 | 11 | EXT / rail | Gäu, Lebern, Olten, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-41-F-j26-1 | 33 | S41 / rail | Solothurn, Wasseramt | admitted-all-dated-trips | 42 / 42 | 40 / 40 | All dated journeys pass |
| 91-44-j26-1 | 33 | S44 / rail | Solothurn, Wasseramt | admitted-all-dated-trips | 40 / 40 | 39 / 39 | All dated journeys pass |
| 91-46-D-j26-1 | 33 | S46 / rail | Solothurn, Wasseramt | admitted-all-dated-trips | 1 / 1 | 0 / 0 | All dated journeys pass |
| 91-4T-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-4U-Y-j26-1 | 11 | IR / rail | Olten | admitted-all-dated-trips | 2 / 2 | 1 / 1 | All dated journeys pass |
| 91-50-Y-j26-1 | 11 | S / rail | Gäu, Lebern, Olten, Solothurn, Wasseramt | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-51-B-j26-1 | 11 | IC51 / rail | Lebern | admitted-all-dated-trips | 37 / 37 | 16 / 16 | All dated journeys pass |
| 91-51-E-j26-1 | 33 | IC51 / rail | Lebern | admitted-all-dated-trips | 1 / 1 | 22 / 22 | All dated journeys pass |
| 91-52-Y-j26-1 | 11 | S / rail | Lebern, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-54-Y-j26-1 | 11 | RE / rail | Lebern | partially-admitted | 0 / 1 | 1 / 1 | incomplete-directed-pattern |
| 91-55-C-j26-1 | 11 | IR55 / rail | Gäu, Lebern, Olten, Solothurn | admitted-all-dated-trips | 36 / 36 | 36 / 36 | All dated journeys pass |
| 91-55-E-j26-1 | 11 | RE55 / rail | Gäu, Lebern, Olten, Solothurn | admitted-all-dated-trips | 0 / 0 | 1 / 1 | All dated journeys pass |
| 91-56-B-j26-1 | 11 | RE56 / rail | Lebern | admitted-all-dated-trips | 2 / 2 | 0 / 0 | All dated journeys pass |
| 91-56-C-j26-1 | 11 | IR56 / rail | Lebern | admitted-all-dated-trips | 0 / 0 | 16 / 16 | All dated journeys pass |
| 91-56-j26-1 | 33 | IR56 / rail | Lebern | admitted-all-dated-trips | 35 / 35 | 20 / 20 | All dated journeys pass |
| 91-5-A-j26-1 | 11 | IC5 / rail | Gäu, Lebern, Olten, Solothurn | admitted-all-dated-trips | 41 / 41 | 39 / 39 | All dated journeys pass |
| 91-5F-Y-j26-1 | 11 | IC / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-5-O-j26-1 | 88 | RE5 / rail | Solothurn, Wasseramt | admitted-all-dated-trips | 126 / 126 | 74 / 74 | All dated journeys pass |
| 91-5R-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-61-A-j26-1 | 11 | IC61 / rail | Olten | admitted-all-dated-trips | 27 / 27 | 30 / 30 | All dated journeys pass |
| 91-6-H-j26-1 | 11 | IC6 / rail | Olten | admitted-all-dated-trips | 27 / 27 | 21 / 21 | All dated journeys pass |
| 91-6-W-j26-1 | 11 | RE6 / rail | Olten | admitted-all-dated-trips | 0 / 0 | 3 / 3 | All dated journeys pass |
| 91-75-Y-j26-1 | 11 | S / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-81-A-j26-1 | 11 | IC81 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-8-B-j26-1 | 88 | S8 / rail | Solothurn, Wasseramt | admitted-all-dated-trips | 4 / 4 | 3 / 3 | All dated journeys pass |
| 91-8-E-j26-1 | 11 | IC8 / rail | Olten | admitted-all-dated-trips | 10 / 10 | 12 / 12 | All dated journeys pass |
| 91-8F-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-92-Y-j26-1 | 11 | EXT / rail | Lebern, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-98-Y-j26-1 | 11 | RE / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-9-F-j26-1 | 11 | S9 / rail | Gösgen, Olten | admitted-all-dated-trips | 39 / 39 | 28 / 28 | All dated journeys pass |
| 91-9N-Y-j26-1 | 11 | IC / rail | Olten, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-9Z-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-BK-Y-j26-1 | 11 | EXT / rail | Gösgen, Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-BL-Y-j26-1 | 11 | EXT / rail | Lebern | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-BO-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-D3-Y-j26-1 | 11 | EXT / rail | Gäu, Lebern, Olten, Solothurn, Wasseramt | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-FN-Y-j26-1 | 11 | RE / rail | Gäu, Lebern, Olten, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-K-Y-j26-1 | 11 | IC / rail | Olten | admitted-all-dated-trips | 2 / 2 | 3 / 3 | All dated journeys pass |
| 91-N1-A-j26-1 | 11 | N1 / rail | Olten | admitted-all-dated-trips | 0 / 0 | 2 / 2 | All dated journeys pass |
| 92-10-G-j26-1 | 883 | 10 / bus | Solothurn, Wasseramt | admitted-all-dated-trips | 30 / 30 | 0 / 0 | All dated journeys pass |
| 92-10-O-j26-1 | 37 | 10 / bus | Dorneck | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-15-B-j26-1 | 883 | 15 / bus | Wasseramt | admitted-all-dated-trips | 33 / 33 | 0 / 0 | All dated journeys pass |
| 92-16-D-j26-1 | 883 | 16 / bus | Solothurn, Wasseramt | admitted-all-dated-trips | 33 / 33 | 0 / 0 | All dated journeys pass |
| 92-1-L-j26-1 | 883 | 1 / bus | Lebern, Solothurn, Wasseramt | admitted-all-dated-trips | 156 / 156 | 74 / 74 | All dated journeys pass |
| 92-20-E-j26-1 | 894 | 20 / bus | Lebern | admitted-all-dated-trips | 61 / 61 | 0 / 0 | All dated journeys pass |
| 92-21-D-j26-1 | 894 | 21 / bus | Lebern | admitted-all-dated-trips | 139 / 139 | 70 / 70 | All dated journeys pass |
| 92-22-E-j26-1 | 894 | 22 / bus | Lebern | admitted-all-dated-trips | 84 / 84 | 71 / 71 | All dated journeys pass |
| 92-23-C-j26-1 | 894 | 23 / bus | Lebern | admitted-all-dated-trips | 45 / 45 | 32 / 32 | All dated journeys pass |
| 92-24-B-j26-1 | 894 | 24 / bus | Lebern | admitted-all-dated-trips | 77 / 77 | 69 / 69 | All dated journeys pass |
| 92-25-C-j26-1 | 894 | 25 / bus | Lebern | admitted-all-dated-trips | 63 / 63 | 0 / 0 | All dated journeys pass |
| 92-26-A-j26-1 | 894 | 26 / bus | Lebern | admitted-all-dated-trips | 59 / 59 | 22 / 22 | All dated journeys pass |
| 92-27-B-j26-1 | 894 | 27 / bus | Lebern | admitted-all-dated-trips | 18 / 18 | 0 / 0 | All dated journeys pass |
| 92-28-C-j26-1 | 894 | 28 / bus | Lebern | admitted-all-dated-trips | 8 / 8 | 18 / 18 | All dated journeys pass |
| 92-2-E-j26-1 | 840 | 2 / bus | Gösgen | admitted-all-dated-trips | 254 / 254 | 214 / 214 | All dated journeys pass |
| 92-2-K-j26-1 | 883 | 2 / bus | Lebern, Solothurn, Wasseramt | admitted-all-dated-trips | 106 / 106 | 54 / 54 | All dated journeys pass |
| 92-362-j26-1 | 850 | 362 / bus | Bucheggberg | admitted-all-dated-trips | 30 / 30 | 26 / 26 | All dated journeys pass |
| 92-363-j26-1 | 850 | 363 / bus | Bucheggberg | admitted-all-dated-trips | 16 / 16 | 0 / 0 | All dated journeys pass |
| 92-3-J-j26-1 | 840 | 3 / bus | Olten | admitted-all-dated-trips | 134 / 134 | 78 / 78 | All dated journeys pass |
| 92-3-M-j26-1 | 883 | 3 / bus | Lebern, Solothurn, Wasseramt | admitted-all-dated-trips | 73 / 73 | 54 / 54 | All dated journeys pass |
| 92-4-N-j26-1 | 883 | 4 / bus | Lebern, Solothurn, Wasseramt | admitted-all-dated-trips | 76 / 76 | 72 / 72 | All dated journeys pass |
| 92-501-A-j26-1 | 793 | 501 / bus | Gäu, Gösgen, Olten | partially-admitted | 59 / 88 | 36 / 36 | incomplete-directed-pattern |
| 92-502-j26-1 | 793 | 502 / bus | Gösgen, Olten | admitted-all-dated-trips | 138 / 138 | 76 / 76 | All dated journeys pass |
| 92-503-A-j26-1 | 793 | 503 / bus | Olten | admitted-all-dated-trips | 67 / 67 | 38 / 38 | All dated journeys pass |
| 92-505-j26-1 | 793 | 505 / bus | Gäu, Olten | admitted-all-dated-trips | 85 / 85 | 81 / 81 | All dated journeys pass |
| 92-506-j26-1 | 793 | 506 / bus | Gösgen, Olten | admitted-all-dated-trips | 26 / 26 | 24 / 24 | All dated journeys pass |
| 92-507-j26-1 | 793 | 507 / bus | Gäu, Gösgen, Olten | admitted-all-dated-trips | 139 / 139 | 77 / 77 | All dated journeys pass |
| 92-508-j26-1 | 793 | 508 / bus | Olten | admitted-all-dated-trips | 147 / 147 | 143 / 143 | All dated journeys pass |
| 92-509-j26-1 | 793 | 509 / bus | Olten | admitted-all-dated-trips | 64 / 64 | 35 / 35 | All dated journeys pass |
| 92-513-j26-1 | 793 | 513 / bus | Gäu, Olten | admitted-all-dated-trips | 58 / 58 | 0 / 0 | All dated journeys pass |
| 92-517-j26-1 | 793 | 517 / bus | Gösgen, Olten | admitted-all-dated-trips | 46 / 46 | 0 / 0 | All dated journeys pass |
| 92-519-j26-1 | 793 | 519 / bus | Gösgen, Olten | admitted-all-dated-trips | 71 / 71 | 74 / 74 | All dated journeys pass |
| 92-555-j26-1 | 793 | 555 / bus | Olten | admitted-all-dated-trips | 26 / 26 | 12 / 12 | All dated journeys pass |
| 92-56-j26-1 | 37 | 56 / bus | Dorneck | admitted-all-dated-trips | 92 / 92 | 76 / 76 | All dated journeys pass |
| 92-5-J-j26-1 | 883 | 5 / bus | Solothurn, Wasseramt | admitted-all-dated-trips | 101 / 101 | 38 / 38 | All dated journeys pass |
| 92-66-D-j26-1 | 37 | 66 / bus | Dorneck | admitted-all-dated-trips | 67 / 67 | 56 / 56 | All dated journeys pass |
| 92-6-M-j26-1 | 883 | 6 / bus | Solothurn, Wasseramt | admitted-all-dated-trips | 78 / 78 | 71 / 71 | All dated journeys pass |
| 92-7-J-j26-1 | 883 | 7 / bus | Solothurn, Wasseramt | admitted-all-dated-trips | 43 / 43 | 42 / 42 | All dated journeys pass |
| 92-871-j26-1 | 850 | 871 / bus | Bucheggberg | admitted-all-dated-trips | 49 / 49 | 37 / 37 | All dated journeys pass |
| 92-898-j26-1 | 850 | 898 / bus | Bucheggberg | admitted-all-dated-trips | 52 / 52 | 40 / 40 | All dated journeys pass |
| 92-8-F-j26-1 | 850 | 8 / bus | Bucheggberg, Solothurn, Wasseramt | admitted-all-dated-trips | 58 / 58 | 38 / 38 | All dated journeys pass |
| 92-9-I-j26-1 | 883 | 9 / bus | Solothurn, Wasseramt | admitted-all-dated-trips | 58 / 58 | 0 / 0 | All dated journeys pass |
| 92-A01-T-j26-1 | 7231 | EV1 / bus | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-A02-4-j26-1 | 7231 | EV1 / bus | Gäu, Lebern, Olten, Solothurn, Wasseramt | admitted-all-dated-trips | 0 / 0 | 28 / 28 | All dated journeys pass |
| 92-A05-E-j26-1 | 7231 | EV2 / bus | Gäu, Lebern, Solothurn, Wasseramt | admitted-all-dated-trips | 0 / 0 | 38 / 38 | All dated journeys pass |
| 92-A05-F-j26-1 | 7231 | EV1 / bus | Lebern | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-A05-M-j26-1 | 7231 | EV2 / bus | Gäu, Olten, Thal | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-A06-G-j26-1 | 7230 | EV2 / bus | Lebern, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-A08-2-j26-1 | 7231 | EV2 / bus | Lebern | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-A0C-9-j26-1 | 7136 | EV2 / bus | Gäu, Lebern, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-EV3-J-j26-1 | 7231 | EV3 / bus | Lebern | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-EV3-U-j26-1 | 7231 | EV3 / bus | Lebern, Solothurn | admitted-all-dated-trips | 0 / 0 | 76 / 76 | All dated journeys pass |
| 92-EV4-M-j26-1 | 7231 | EV4 / bus | Lebern, Solothurn | partially-admitted | 0 / 0 | 21 / 42 | incomplete-directed-pattern |
| 92-EV5-N-j26-1 | 7231 | EV5 / bus | Solothurn | admitted-all-dated-trips | 0 / 0 | 74 / 74 | All dated journeys pass |
| 92-EV6-R-j26-1 | 7231 | EV6 / bus | Lebern, Solothurn | admitted-all-dated-trips | 0 / 0 | 79 / 79 | All dated journeys pass |
| 92-EV7-j26-1 | 7231 | EV7 / bus | Lebern, Solothurn, Wasseramt | admitted-all-dated-trips | 0 / 0 | 4 / 4 | All dated journeys pass |
| 92-EV8-M-j26-1 | 7231 | EV8 / bus | Gäu, Lebern, Olten, Solothurn, Wasseramt | admitted-all-dated-trips | 0 / 0 | 1 / 1 | All dated journeys pass |
| 92-EV9-D-j26-1 | 7231 | EV9 / bus | Gösgen, Olten | admitted-all-dated-trips | 0 / 0 | 4 / 4 | All dated journeys pass |
| 92-EV9-L-j26-1 | 7231 | EV9 / bus | Lebern, Solothurn | admitted-all-dated-trips | 0 / 0 | 2 / 2 | All dated journeys pass |
| 92-EV-Q-j26-1 | 7231 | EV / bus | Solothurn, Wasseramt | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-M11-j26-1 | 883 | M11 / bus | Solothurn, Wasseramt | admitted-all-dated-trips | 0 / 0 | 6 / 6 | All dated journeys pass |
| 92-M30-j26-1 | 883 | M30 / bus | Lebern, Solothurn | admitted-all-dated-trips | 0 / 0 | 4 / 4 | All dated journeys pass |
| 92-M51-j26-1 | 883 | M51 / bus | Bucheggberg, Lebern, Solothurn, Wasseramt | admitted-all-dated-trips | 0 / 0 | 2 / 2 | All dated journeys pass |
| 92-M52-j26-1 | 883 | M52 / bus | Gäu, Solothurn, Wasseramt | admitted-all-dated-trips | 0 / 0 | 4 / 4 | All dated journeys pass |
| 92-M53-j26-1 | 883 | M53 / bus | Solothurn, Wasseramt | excluded | 0 / 0 | 0 / 2 | night-network-excluded-by-source |
| 92-M54-j26-1 | 883 | M54 / bus | Bucheggberg, Solothurn, Wasseramt | admitted-all-dated-trips | 0 / 0 | 1 / 1 | All dated journeys pass |
| 92-N22-j26-1 | 840 | N22 / bus | Gösgen | admitted-all-dated-trips | 0 / 0 | 8 / 8 | All dated journeys pass |
| 92-N23-j26-1 | 793 | N23 / bus | Olten | admitted-all-dated-trips | 0 / 0 | 4 / 4 | All dated journeys pass |
| 92-N51-j26-1 | 793 | N51 / bus | Gäu, Olten | admitted-all-dated-trips | 0 / 0 | 7 / 7 | All dated journeys pass |
| 92-N55-j26-1 | 793 | N55 / bus | Gäu, Olten | admitted-all-dated-trips | 0 / 0 | 6 / 6 | All dated journeys pass |
| 92-N57-j26-1 | 793 | N57 / bus | Gösgen, Olten | admitted-all-dated-trips | 0 / 0 | 7 / 7 | All dated journeys pass |
| 92-N60-A-j26-1 | 723 | N60 / bus | Olten | admitted-all-dated-trips | 0 / 0 | 4 / 4 | All dated journeys pass |
| 93-202-6-j26-1 | 202 | 2026 / cableway | Lebern | admitted-all-dated-trips | 1078 / 1078 | 1108 / 1108 | All dated journeys pass |
| 94-321-6-j26-1 | 182 | 3216 / ferry | Lebern, Solothurn | admitted-all-dated-trips | 4 / 4 | 4 / 4 | All dated journeys pass |
| 96-131-1-j26-1 | 801 | 111 / bus | Dorneck, Thierstein | admitted-all-dated-trips | 80 / 80 | 84 / 84 | All dated journeys pass |
| 96-131-2-j26-1 | 801 | 112 / bus | Thierstein | admitted-all-dated-trips | 72 / 72 | 71 / 71 | All dated journeys pass |
| 96-131-3-j26-1 | 801 | 113 / bus | Thierstein | admitted-all-dated-trips | 35 / 35 | 0 / 0 | All dated journeys pass |
| 96-131-4-j26-1 | 801 | 114 / bus | Thierstein | admitted-all-dated-trips | 51 / 51 | 40 / 40 | All dated journeys pass |
| 96-131-5-j26-1 | 801 | 115 / bus | Thierstein | admitted-all-dated-trips | 80 / 80 | 86 / 86 | All dated journeys pass |
| 96-131-6-j26-1 | 801 | 116 / bus | Thierstein | admitted-all-dated-trips | 36 / 36 | 34 / 34 | All dated journeys pass |
| 96-131-7-j26-1 | 801 | 117 / bus | Thierstein | admitted-all-dated-trips | 54 / 54 | 43 / 43 | All dated journeys pass |
| 96-131-8-j26-1 | 801 | 118 / bus | Thierstein | partially-admitted | 2 / 2 | 2 / 7 | incomplete-directed-pattern |
| 96-136-7-j26-1 | 801 | 67 / bus | Dorneck | admitted-all-dated-trips | 73 / 73 | 70 / 70 | All dated journeys pass |
| 96-136-8-j26-1 | 801 | 68 / bus | Dorneck | admitted-all-dated-trips | 69 / 69 | 39 / 39 | All dated journeys pass |
| 96-136-9-j26-1 | 801 | 69 / bus | Dorneck | admitted-all-dated-trips | 80 / 80 | 43 / 43 | All dated journeys pass |
| 96-137-3-j26-1 | 801 | 73 / bus | Dorneck | admitted-all-dated-trips | 18 / 18 | 0 / 0 | All dated journeys pass |
| 96-137-7-j26-1 | 801 | 77 / bus | Dorneck | admitted-all-dated-trips | 70 / 70 | 61 / 61 | All dated journeys pass |
| 96-140-2-j26-1 | 801 | 102 / bus | Gösgen | admitted-all-dated-trips | 72 / 72 | 47 / 47 | All dated journeys pass |
| 96-144-1-j26-1 | 801 | 580 / bus | Olten | admitted-all-dated-trips | 16 / 16 | 0 / 0 | All dated journeys pass |
| 96-144-2-j26-1 | 801 | 581 / bus | Olten | admitted-all-dated-trips | 14 / 14 | 0 / 0 | All dated journeys pass |
| 96-144-4-j26-1 | 801 | 94 / bus | Thal | admitted-all-dated-trips | 68 / 68 | 45 / 45 | All dated journeys pass |
| 96-144-6-j26-1 | 801 | N56 / bus | Gäu, Olten | admitted-all-dated-trips | 0 / 0 | 5 / 5 | All dated journeys pass |
| 96-144-7-j26-1 | 801 | 127 / bus | Gäu, Olten | admitted-all-dated-trips | 61 / 61 | 37 / 37 | All dated journeys pass |
| 96-144-9-j26-1 | 801 | 129 / bus | Gäu, Thal | admitted-all-dated-trips | 112 / 112 | 59 / 59 | All dated journeys pass |
| 96-144-B-j26-1 | 801 | M55 / bus | Lebern, Solothurn | admitted-all-dated-trips | 0 / 0 | 2 / 2 | All dated journeys pass |
| 96-145-0-j26-1 | 801 | 130 / bus | Thal, Thierstein | admitted-all-dated-trips | 69 / 69 | 43 / 43 | All dated journeys pass |
| 96-145-1-j26-1 | 801 | 125 / bus | Gäu | admitted-all-dated-trips | 29 / 29 | 0 / 0 | All dated journeys pass |
| 96-145-2-j26-1 | 801 | 126 / bus | Gäu | admitted-all-dated-trips | 71 / 71 | 35 / 35 | All dated journeys pass |
| 96-145-4-j26-1 | 801 | 124 / bus | Gäu | admitted-all-dated-trips | 0 / 0 | 14 / 14 | All dated journeys pass |
| 96-145-6-j26-1 | 801 | 131 / bus | Thal | admitted-all-dated-trips | 0 / 0 | 12 / 12 | All dated journeys pass |
| 96-145-9-j26-1 | 801 | 12 / bus | Lebern, Solothurn | admitted-all-dated-trips | 50 / 50 | 28 / 28 | All dated journeys pass |
| 96-148-2-j26-1 | 801 | 882 / bus | Bucheggberg | admitted-all-dated-trips | 38 / 38 | 20 / 20 | All dated journeys pass |
| 96-148-5-j26-1 | 801 | 885 / bus | Bucheggberg, Wasseramt | admitted-all-dated-trips | 39 / 39 | 18 / 18 | All dated journeys pass |
| 96-148-6-j26-1 | 801 | 886 / bus | Bucheggberg, Wasseramt | admitted-all-dated-trips | 35 / 35 | 18 / 18 | All dated journeys pass |

Machine detail: [routes](../data/solothurn-audit/routes.json), [Friday patterns and directed pairs](../data/solothurn-audit/2026-09-04.json), [Sunday patterns and directed pairs](../data/solothurn-audit/2026-09-06.json). Every failed pair retains a reason, and every excluded pattern retains its complete original stop chain.
