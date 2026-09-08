# Solothurn route admission and exclusion inventory

All 193 original GTFS route identities with at least one annual call in the canton. Labels can repeat across operators and route IDs. Each cell gives admitted / total civil-day instances, including separately labelled representative headway instances. See the [study](SOLOTHURN-STUDY.md) for geometry inference, night exclusions and calendar scope. Inactive records remain in the denominator. “Admitted-all-dated-trips” applies only to the two tested dates.

## Agency census

| GTFS agency | Source name | Annual routes | Routes contributing feed | Friday admitted / total | Sunday admitted / total |
| --- | --- | --- | --- | --- | --- |
| 11 | Schweizerische Bundesbahnen SBB | 71 | 6 | 100 / 950 | 129 / 903 |
| 33 | BLS AG (bls) | 9 | 2 | 0 / 158 | 42 / 161 |
| 37 | Baselland Transport | 4 | 0 | 0 / 360 | 0 / 350 |
| 68 | Oensingen-Balsthal-Bahn | 1 | 0 | 0 / 0 | 0 / 0 |
| 81 | Aare Seeland mobil (snb) | 1 | 0 | 0 / 150 | 0 / 95 |
| 82 | Schweizerische Südostbahn (sob) | 4 | 0 | 0 / 43 | 0 / 41 |
| 88 | Regionalverkehr Bern-Solothurn | 2 | 2 | 130 / 130 | 77 / 77 |
| 182 | Bielersee-Schifffahrts-Gesellschaft AG | 1 | 0 | 0 / 4 | 0 / 4 |
| 202 | Seilbahn Weissenstein AG | 1 | 1 | 1078 / 1078 | 1108 / 1108 |
| 723 | Aargau Verkehr AG | 1 | 0 | 0 / 0 | 0 / 4 |
| 793 | Busbetrieb Olten-Gösgen-Gäu | 16 | 7 | 315 / 955 | 286 / 620 |
| 801 | PostAuto AG | 30 | 17 | 580 / 1394 | 378 / 961 |
| 840 | Busbetrieb Aarau | 3 | 1 | 58 / 388 | 56 / 300 |
| 850 | Autobusbetrieb RBS | 5 | 3 | 32 / 205 | 26 / 141 |
| 883 | Busbetrieb Solothurn und Umgebung | 17 | 8 | 368 / 787 | 222 / 424 |
| 894 | Busbetrieb Grenchen und Umgebung | 9 | 8 | 481 / 554 | 250 / 282 |
| 7136 | Aare Seeland mobil Ersatzverkehr | 1 | 0 | 0 / 0 | 0 / 0 |
| 7230 | BLS Netz AG Ersatzverkehr | 1 | 0 | 0 / 0 | 0 / 0 |
| 7231 | SBB Infrastruktur AG Bahnersatz | 16 | 0 | 0 / 0 | 0 / 348 |

## Every route record

| Route ID | Agency | Line / mode | Districts | Status | Friday admitted / total | Sunday admitted / total | Exclusions / explanation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 91-10-j26-1 | 37 | 10 / tram | Dorneck | excluded | 0 / 201 | 0 / 218 | no-compatible-source-mode |
| 91-11-E-j26-1 | 11 | SN11 / rail | Olten | excluded | 0 / 0 | 0 / 4 | night-network-excluded-by-source |
| 91-11-M-j26-1 | 81 | S11 / rail | Gäu, Lebern, Solothurn | excluded | 0 / 150 | 0 / 95 | incomplete-directed-pattern |
| 91-12-K-j26-1 | 11 | RE12 / rail | Olten | excluded | 0 / 40 | 0 / 40 | incomplete-directed-pattern |
| 91-16-B-j26-1 | 11 | IR16 / rail | Olten | excluded | 0 / 36 | 0 / 36 | incomplete-directed-pattern |
| 91-17-B-j26-1 | 33 | IR17 / rail | Olten | excluded | 0 / 38 | 0 / 39 | incomplete-directed-pattern |
| 91-17-C-j26-1 | 82 | IR17 / rail | Olten | excluded | 0 / 2 | 0 / 1 | incomplete-directed-pattern |
| 91-17-F-j26-1 | 11 | IR17 / rail | Olten | excluded | 0 / 1 | 0 / 2 | incomplete-directed-pattern |
| 91-19-C-j26-1 | 11 | S19 / rail | Lebern, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-1B-Y-j26-1 | 11 | IC / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-1-D-j26-1 | 11 | IC1 / rail | Olten | excluded | 0 / 8 | 0 / 9 | incomplete-directed-pattern |
| 91-1G-Y-j26-1 | 11 | RE / rail | Olten | excluded | 0 / 1 | 0 / 0 | incomplete-directed-pattern |
| 91-1-H-j26-1 | 11 | SN1 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-1-I-j26-1 | 11 | SN1 / rail | Olten | excluded | 0 / 0 | 0 / 4 | night-network-excluded-by-source |
| 91-1I-Y-j26-1 | 33 | EXT / rail | Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-1W-Y-j26-1 | 11 | EXT / rail | Olten | excluded | 0 / 0 | 0 / 2 | incomplete-directed-pattern |
| 91-20-A-j26-1 | 11 | S20 / rail | Gäu, Lebern, Olten, Solothurn, Wasseramt | excluded | 0 / 120 | 0 / 80 | incomplete-directed-pattern |
| 91-21-C-j26-1 | 11 | S21 / rail | Lebern, Solothurn | admitted-all-dated-trips | 38 / 38 | 36 / 36 | All dated journeys pass |
| 91-21-D-j26-1 | 11 | IC21 / rail | Olten | excluded | 0 / 18 | 0 / 18 | incomplete-directed-pattern |
| 91-21-Y-j26-1 | 82 | IR / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-22-G-j26-1 | 68 | S22 / rail | Gäu, Thal | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-22-j26-1 | 11 | S22 / rail | Gäu, Thal | admitted-all-dated-trips | 58 / 58 | 58 / 58 | All dated journeys pass |
| 91-23-j26-1 | 11 | S23 / rail | Olten | excluded | 0 / 78 | 0 / 78 | incomplete-directed-pattern |
| 91-24-F-j26-1 | 11 | RE24 / rail | Olten | excluded | 0 / 40 | 0 / 40 | incomplete-directed-pattern |
| 91-26-C-j26-1 | 82 | IR26 / rail | Olten | excluded | 0 / 21 | 0 / 20 | incomplete-directed-pattern |
| 91-26-D-j26-1 | 11 | IR26 / rail | Olten | excluded | 0 / 1 | 0 / 1 | incomplete-directed-pattern |
| 91-26-E-j26-1 | 11 | RE26 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-26-j26-1 | 11 | S26 / rail | Olten | excluded | 0 / 41 | 0 / 39 | incomplete-directed-pattern |
| 91-27-A-j26-1 | 11 | IR27 / rail | Olten | excluded | 0 / 37 | 0 / 32 | incomplete-directed-pattern |
| 91-28-j26-1 | 11 | S28 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-29-j26-1 | 11 | S29 / rail | Olten | partially-admitted | 3 / 86 | 3 / 86 | incomplete-directed-pattern |
| 91-29-Y-j26-1 | 11 | IC / rail | Olten | excluded | 0 / 0 | 0 / 1 | incomplete-directed-pattern |
| 91-2F-Y-j26-1 | 33 | S / rail | Solothurn, Wasseramt | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-2H-Y-j26-1 | 11 | IC / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-2J-Y-j26-1 | 11 | IC / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-2W-Y-j26-1 | 11 | EC / rail | Olten | excluded | 0 / 6 | 0 / 8 | incomplete-directed-pattern |
| 91-35-A-j26-1 | 82 | IR35 / rail | Olten | excluded | 0 / 20 | 0 / 20 | incomplete-directed-pattern |
| 91-35-B-j26-1 | 11 | IR35 / rail | Olten | excluded | 0 / 16 | 0 / 16 | incomplete-directed-pattern |
| 91-35-D-j26-1 | 33 | IR35 / rail | Olten | excluded | 0 / 1 | 0 / 1 | incomplete-directed-pattern |
| 91-37-E-j26-1 | 11 | RE37 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-37-j26-1 | 11 | IR37 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-3A-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-3-B-j26-1 | 11 | S3 / rail | Olten | excluded | 0 / 86 | 0 / 87 | incomplete-directed-pattern |
| 91-3L-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-3M-Y-j26-1 | 11 | IR / rail | Olten | excluded | 0 / 0 | 0 / 1 | incomplete-directed-pattern |
| 91-3R-Y-j26-1 | 11 | EC / rail | Olten | excluded | 0 / 2 | 0 / 2 | incomplete-directed-pattern |
| 91-3U-Y-j26-1 | 11 | IR / rail | Olten | excluded | 0 / 1 | 0 / 1 | incomplete-directed-pattern |
| 91-3W-Y-j26-1 | 11 | IC / rail | Olten | excluded | 0 / 0 | 0 / 1 | incomplete-directed-pattern |
| 91-3-Y-j26-1 | 11 | ICE / rail | Olten | excluded | 0 / 12 | 0 / 12 | incomplete-directed-pattern |
| 91-40-Y-j26-1 | 11 | EXT / rail | Gäu, Lebern, Olten, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-41-F-j26-1 | 33 | S41 / rail | Solothurn, Wasseramt | excluded | 0 / 42 | 0 / 40 | incomplete-directed-pattern |
| 91-44-j26-1 | 33 | S44 / rail | Solothurn, Wasseramt | excluded | 0 / 40 | 0 / 39 | incomplete-directed-pattern |
| 91-46-D-j26-1 | 33 | S46 / rail | Solothurn, Wasseramt | excluded | 0 / 1 | 0 / 0 | incomplete-directed-pattern |
| 91-4T-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-4U-Y-j26-1 | 11 | IR / rail | Olten | excluded | 0 / 2 | 0 / 1 | incomplete-directed-pattern |
| 91-50-Y-j26-1 | 11 | S / rail | Gäu, Lebern, Olten, Solothurn, Wasseramt | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-51-B-j26-1 | 11 | IC51 / rail | Lebern | partially-admitted | 0 / 37 | 16 / 16 | incomplete-directed-pattern |
| 91-51-E-j26-1 | 33 | IC51 / rail | Lebern | partially-admitted | 0 / 1 | 22 / 22 | incomplete-directed-pattern |
| 91-52-Y-j26-1 | 11 | S / rail | Lebern, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-54-Y-j26-1 | 11 | RE / rail | Lebern | excluded | 0 / 1 | 0 / 1 | incomplete-directed-pattern |
| 91-55-C-j26-1 | 11 | IR55 / rail | Gäu, Lebern, Olten, Solothurn | excluded | 0 / 36 | 0 / 36 | incomplete-directed-pattern |
| 91-55-E-j26-1 | 11 | RE55 / rail | Gäu, Lebern, Olten, Solothurn | excluded | 0 / 0 | 0 / 1 | incomplete-directed-pattern |
| 91-56-B-j26-1 | 11 | RE56 / rail | Lebern | excluded | 0 / 2 | 0 / 0 | incomplete-directed-pattern |
| 91-56-C-j26-1 | 11 | IR56 / rail | Lebern | admitted-all-dated-trips | 0 / 0 | 16 / 16 | All dated journeys pass |
| 91-56-j26-1 | 33 | IR56 / rail | Lebern | partially-admitted | 0 / 35 | 20 / 20 | incomplete-directed-pattern |
| 91-5-A-j26-1 | 11 | IC5 / rail | Gäu, Lebern, Olten, Solothurn | excluded | 0 / 41 | 0 / 39 | incomplete-directed-pattern |
| 91-5F-Y-j26-1 | 11 | IC / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-5-O-j26-1 | 88 | RE5 / rail | Solothurn, Wasseramt | admitted-all-dated-trips | 126 / 126 | 74 / 74 | All dated journeys pass |
| 91-5R-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-61-A-j26-1 | 11 | IC61 / rail | Olten | excluded | 0 / 27 | 0 / 30 | incomplete-directed-pattern |
| 91-6-H-j26-1 | 11 | IC6 / rail | Olten | excluded | 0 / 27 | 0 / 21 | incomplete-directed-pattern |
| 91-6-W-j26-1 | 11 | RE6 / rail | Olten | excluded | 0 / 0 | 0 / 3 | incomplete-directed-pattern |
| 91-75-Y-j26-1 | 11 | S / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-81-A-j26-1 | 11 | IC81 / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-8-B-j26-1 | 88 | S8 / rail | Solothurn, Wasseramt | admitted-all-dated-trips | 4 / 4 | 3 / 3 | All dated journeys pass |
| 91-8-E-j26-1 | 11 | IC8 / rail | Olten | excluded | 0 / 10 | 0 / 12 | incomplete-directed-pattern |
| 91-8F-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-92-Y-j26-1 | 11 | EXT / rail | Lebern, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-98-Y-j26-1 | 11 | RE / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-9-F-j26-1 | 11 | S9 / rail | Gösgen, Olten | partially-admitted | 1 / 39 | 0 / 28 | incomplete-directed-pattern |
| 91-9N-Y-j26-1 | 11 | IC / rail | Olten, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-9Z-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-BK-Y-j26-1 | 11 | EXT / rail | Gösgen, Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-BL-Y-j26-1 | 11 | EXT / rail | Lebern | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-BO-Y-j26-1 | 11 | EXT / rail | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-D3-Y-j26-1 | 11 | EXT / rail | Gäu, Lebern, Olten, Solothurn, Wasseramt | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-FN-Y-j26-1 | 11 | RE / rail | Gäu, Lebern, Olten, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 91-K-Y-j26-1 | 11 | IC / rail | Olten | excluded | 0 / 2 | 0 / 3 | incomplete-directed-pattern |
| 91-N1-A-j26-1 | 11 | N1 / rail | Olten | excluded | 0 / 0 | 0 / 2 | night-network-excluded-by-source |
| 92-10-G-j26-1 | 883 | 10 / bus | Solothurn, Wasseramt | excluded | 0 / 30 | 0 / 0 | incomplete-directed-pattern |
| 92-10-O-j26-1 | 37 | 10 / bus | Dorneck | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-15-B-j26-1 | 883 | 15 / bus | Wasseramt | excluded | 0 / 33 | 0 / 0 | incomplete-directed-pattern |
| 92-16-D-j26-1 | 883 | 16 / bus | Solothurn, Wasseramt | excluded | 0 / 33 | 0 / 0 | incomplete-directed-pattern |
| 92-1-L-j26-1 | 883 | 1 / bus | Lebern, Solothurn, Wasseramt | partially-admitted | 152 / 156 | 70 / 74 | incomplete-directed-pattern |
| 92-20-E-j26-1 | 894 | 20 / bus | Lebern | admitted-all-dated-trips | 61 / 61 | 0 / 0 | All dated journeys pass |
| 92-21-D-j26-1 | 894 | 21 / bus | Lebern | admitted-all-dated-trips | 139 / 139 | 70 / 70 | All dated journeys pass |
| 92-22-E-j26-1 | 894 | 22 / bus | Lebern | partially-admitted | 83 / 84 | 71 / 71 | incomplete-directed-pattern |
| 92-23-C-j26-1 | 894 | 23 / bus | Lebern | excluded | 0 / 45 | 0 / 32 | incomplete-directed-pattern |
| 92-24-B-j26-1 | 894 | 24 / bus | Lebern | admitted-all-dated-trips | 77 / 77 | 69 / 69 | All dated journeys pass |
| 92-25-C-j26-1 | 894 | 25 / bus | Lebern | admitted-all-dated-trips | 63 / 63 | 0 / 0 | All dated journeys pass |
| 92-26-A-j26-1 | 894 | 26 / bus | Lebern | partially-admitted | 32 / 59 | 22 / 22 | incomplete-directed-pattern |
| 92-27-B-j26-1 | 894 | 27 / bus | Lebern | admitted-all-dated-trips | 18 / 18 | 0 / 0 | All dated journeys pass |
| 92-28-C-j26-1 | 894 | 28 / bus | Lebern | admitted-all-dated-trips | 8 / 8 | 18 / 18 | All dated journeys pass |
| 92-2-E-j26-1 | 840 | 2 / bus | Gösgen | partially-admitted | 58 / 254 | 56 / 214 | incomplete-directed-pattern |
| 92-2-K-j26-1 | 883 | 2 / bus | Lebern, Solothurn, Wasseramt | partially-admitted | 64 / 106 | 54 / 54 | incomplete-directed-pattern |
| 92-362-j26-1 | 850 | 362 / bus | Bucheggberg | admitted-all-dated-trips | 30 / 30 | 26 / 26 | All dated journeys pass |
| 92-363-j26-1 | 850 | 363 / bus | Bucheggberg | partially-admitted | 1 / 16 | 0 / 0 | incomplete-directed-pattern |
| 92-3-J-j26-1 | 840 | 3 / bus | Olten | excluded | 0 / 134 | 0 / 78 | incomplete-directed-pattern |
| 92-3-M-j26-1 | 883 | 3 / bus | Lebern, Solothurn, Wasseramt | partially-admitted | 5 / 73 | 19 / 54 | incomplete-directed-pattern |
| 92-4-N-j26-1 | 883 | 4 / bus | Lebern, Solothurn, Wasseramt | admitted-all-dated-trips | 76 / 76 | 72 / 72 | All dated journeys pass |
| 92-501-A-j26-1 | 793 | 501 / bus | Gäu, Gösgen, Olten | partially-admitted | 10 / 88 | 36 / 36 | incomplete-directed-pattern |
| 92-502-j26-1 | 793 | 502 / bus | Gösgen, Olten | admitted-all-dated-trips | 138 / 138 | 76 / 76 | All dated journeys pass |
| 92-503-A-j26-1 | 793 | 503 / bus | Olten | excluded | 0 / 67 | 0 / 38 | incomplete-directed-pattern |
| 92-505-j26-1 | 793 | 505 / bus | Gäu, Olten | partially-admitted | 2 / 85 | 0 / 81 | incomplete-directed-pattern |
| 92-506-j26-1 | 793 | 506 / bus | Gösgen, Olten | admitted-all-dated-trips | 26 / 26 | 24 / 24 | All dated journeys pass |
| 92-507-j26-1 | 793 | 507 / bus | Gäu, Gösgen, Olten | partially-admitted | 76 / 139 | 77 / 77 | incomplete-directed-pattern |
| 92-508-j26-1 | 793 | 508 / bus | Olten | excluded | 0 / 147 | 0 / 143 | incomplete-directed-pattern |
| 92-509-j26-1 | 793 | 509 / bus | Olten | excluded | 0 / 64 | 0 / 35 | incomplete-directed-pattern |
| 92-513-j26-1 | 793 | 513 / bus | Gäu, Olten | admitted-all-dated-trips | 58 / 58 | 0 / 0 | All dated journeys pass |
| 92-517-j26-1 | 793 | 517 / bus | Gösgen, Olten | excluded | 0 / 46 | 0 / 0 | incomplete-directed-pattern |
| 92-519-j26-1 | 793 | 519 / bus | Gösgen, Olten | partially-admitted | 5 / 71 | 73 / 74 | incomplete-directed-pattern |
| 92-555-j26-1 | 793 | 555 / bus | Olten | excluded | 0 / 26 | 0 / 12 | incomplete-directed-pattern |
| 92-56-j26-1 | 37 | 56 / bus | Dorneck | excluded | 0 / 92 | 0 / 76 | incomplete-directed-pattern |
| 92-5-J-j26-1 | 883 | 5 / bus | Solothurn, Wasseramt | partially-admitted | 6 / 101 | 0 / 38 | incomplete-directed-pattern |
| 92-66-D-j26-1 | 37 | 66 / bus | Dorneck | excluded | 0 / 67 | 0 / 56 | incomplete-directed-pattern |
| 92-6-M-j26-1 | 883 | 6 / bus | Solothurn, Wasseramt | partially-admitted | 2 / 78 | 2 / 71 | incomplete-directed-pattern |
| 92-7-J-j26-1 | 883 | 7 / bus | Solothurn, Wasseramt | partially-admitted | 5 / 43 | 5 / 42 | incomplete-directed-pattern |
| 92-871-j26-1 | 850 | 871 / bus | Bucheggberg | excluded | 0 / 49 | 0 / 37 | incomplete-directed-pattern |
| 92-898-j26-1 | 850 | 898 / bus | Bucheggberg | excluded | 0 / 52 | 0 / 40 | incomplete-directed-pattern |
| 92-8-F-j26-1 | 850 | 8 / bus | Bucheggberg, Solothurn, Wasseramt | partially-admitted | 1 / 58 | 0 / 38 | incomplete-directed-pattern |
| 92-9-I-j26-1 | 883 | 9 / bus | Solothurn, Wasseramt | admitted-all-dated-trips | 58 / 58 | 0 / 0 | All dated journeys pass |
| 92-A01-T-j26-1 | 7231 | EV1 / bus | Olten | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-A02-4-j26-1 | 7231 | EV1 / bus | Gäu, Lebern, Olten, Solothurn, Wasseramt | excluded | 0 / 0 | 0 / 28 | incomplete-directed-pattern |
| 92-A05-E-j26-1 | 7231 | EV2 / bus | Gäu, Lebern, Solothurn, Wasseramt | excluded | 0 / 0 | 0 / 38 | incomplete-directed-pattern |
| 92-A05-F-j26-1 | 7231 | EV1 / bus | Lebern | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-A05-M-j26-1 | 7231 | EV2 / bus | Gäu, Olten, Thal | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-A06-G-j26-1 | 7230 | EV2 / bus | Lebern, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-A08-2-j26-1 | 7231 | EV2 / bus | Lebern | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-A0C-9-j26-1 | 7136 | EV2 / bus | Gäu, Lebern, Solothurn | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-EV3-J-j26-1 | 7231 | EV3 / bus | Lebern | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-EV3-U-j26-1 | 7231 | EV3 / bus | Lebern, Solothurn | excluded | 0 / 0 | 0 / 76 | incomplete-directed-pattern |
| 92-EV4-M-j26-1 | 7231 | EV4 / bus | Lebern, Solothurn | excluded | 0 / 0 | 0 / 42 | incomplete-directed-pattern |
| 92-EV5-N-j26-1 | 7231 | EV5 / bus | Solothurn | excluded | 0 / 0 | 0 / 74 | incomplete-directed-pattern |
| 92-EV6-R-j26-1 | 7231 | EV6 / bus | Lebern, Solothurn | excluded | 0 / 0 | 0 / 79 | incomplete-directed-pattern |
| 92-EV7-j26-1 | 7231 | EV7 / bus | Lebern, Solothurn, Wasseramt | excluded | 0 / 0 | 0 / 4 | incomplete-directed-pattern |
| 92-EV8-M-j26-1 | 7231 | EV8 / bus | Gäu, Lebern, Olten, Solothurn, Wasseramt | excluded | 0 / 0 | 0 / 1 | incomplete-directed-pattern |
| 92-EV9-D-j26-1 | 7231 | EV9 / bus | Gösgen, Olten | excluded | 0 / 0 | 0 / 4 | incomplete-directed-pattern |
| 92-EV9-L-j26-1 | 7231 | EV9 / bus | Lebern, Solothurn | excluded | 0 / 0 | 0 / 2 | incomplete-directed-pattern |
| 92-EV-Q-j26-1 | 7231 | EV / bus | Solothurn, Wasseramt | inactive-on-validation-dates | 0 / 0 | 0 / 0 | No civil-day instance on either date |
| 92-M11-j26-1 | 883 | M11 / bus | Solothurn, Wasseramt | excluded | 0 / 0 | 0 / 6 | night-network-excluded-by-source |
| 92-M30-j26-1 | 883 | M30 / bus | Lebern, Solothurn | excluded | 0 / 0 | 0 / 4 | night-network-excluded-by-source |
| 92-M51-j26-1 | 883 | M51 / bus | Bucheggberg, Lebern, Solothurn, Wasseramt | excluded | 0 / 0 | 0 / 2 | night-network-excluded-by-source |
| 92-M52-j26-1 | 883 | M52 / bus | Gäu, Solothurn, Wasseramt | excluded | 0 / 0 | 0 / 4 | night-network-excluded-by-source |
| 92-M53-j26-1 | 883 | M53 / bus | Solothurn, Wasseramt | excluded | 0 / 0 | 0 / 2 | night-network-excluded-by-source |
| 92-M54-j26-1 | 883 | M54 / bus | Bucheggberg, Solothurn, Wasseramt | excluded | 0 / 0 | 0 / 1 | night-network-excluded-by-source |
| 92-N22-j26-1 | 840 | N22 / bus | Gösgen | excluded | 0 / 0 | 0 / 8 | night-network-excluded-by-source |
| 92-N23-j26-1 | 793 | N23 / bus | Olten | excluded | 0 / 0 | 0 / 4 | night-network-excluded-by-source |
| 92-N51-j26-1 | 793 | N51 / bus | Gäu, Olten | excluded | 0 / 0 | 0 / 7 | night-network-excluded-by-source |
| 92-N55-j26-1 | 793 | N55 / bus | Gäu, Olten | excluded | 0 / 0 | 0 / 6 | night-network-excluded-by-source |
| 92-N57-j26-1 | 793 | N57 / bus | Gösgen, Olten | excluded | 0 / 0 | 0 / 7 | night-network-excluded-by-source |
| 92-N60-A-j26-1 | 723 | N60 / bus | Olten | excluded | 0 / 0 | 0 / 4 | night-network-excluded-by-source |
| 93-202-6-j26-1 | 202 | 2026 / cableway | Lebern | admitted-all-dated-trips | 1078 / 1078 | 1108 / 1108 | All dated journeys pass |
| 94-321-6-j26-1 | 182 | 3216 / ferry | Lebern, Solothurn | excluded | 0 / 4 | 0 / 4 | no-compatible-source-mode |
| 96-131-1-j26-1 | 801 | 111 / bus | Dorneck, Thierstein | partially-admitted | 0 / 80 | 1 / 84 | incomplete-directed-pattern |
| 96-131-2-j26-1 | 801 | 112 / bus | Thierstein | partially-admitted | 37 / 72 | 34 / 71 | incomplete-directed-pattern |
| 96-131-3-j26-1 | 801 | 113 / bus | Thierstein | partially-admitted | 13 / 35 | 0 / 0 | incomplete-directed-pattern |
| 96-131-4-j26-1 | 801 | 114 / bus | Thierstein | excluded | 0 / 51 | 0 / 40 | incomplete-directed-pattern |
| 96-131-5-j26-1 | 801 | 115 / bus | Thierstein | partially-admitted | 79 / 80 | 86 / 86 | incomplete-directed-pattern |
| 96-131-6-j26-1 | 801 | 116 / bus | Thierstein | admitted-all-dated-trips | 36 / 36 | 34 / 34 | All dated journeys pass |
| 96-131-7-j26-1 | 801 | 117 / bus | Thierstein | admitted-all-dated-trips | 54 / 54 | 43 / 43 | All dated journeys pass |
| 96-131-8-j26-1 | 801 | 118 / bus | Thierstein | excluded | 0 / 2 | 0 / 7 | incomplete-directed-pattern |
| 96-136-7-j26-1 | 801 | 67 / bus | Dorneck | partially-admitted | 3 / 73 | 2 / 70 | incomplete-directed-pattern |
| 96-136-8-j26-1 | 801 | 68 / bus | Dorneck | partially-admitted | 2 / 69 | 0 / 39 | incomplete-directed-pattern |
| 96-136-9-j26-1 | 801 | 69 / bus | Dorneck | excluded | 0 / 80 | 0 / 43 | incomplete-directed-pattern |
| 96-137-3-j26-1 | 801 | 73 / bus | Dorneck | excluded | 0 / 18 | 0 / 0 | incomplete-directed-pattern |
| 96-137-7-j26-1 | 801 | 77 / bus | Dorneck | excluded | 0 / 70 | 0 / 61 | incomplete-directed-pattern |
| 96-140-2-j26-1 | 801 | 102 / bus | Gösgen | excluded | 0 / 72 | 0 / 47 | incomplete-directed-pattern |
| 96-144-1-j26-1 | 801 | 580 / bus | Olten | admitted-all-dated-trips | 16 / 16 | 0 / 0 | All dated journeys pass |
| 96-144-2-j26-1 | 801 | 581 / bus | Olten | excluded | 0 / 14 | 0 / 0 | incomplete-directed-pattern |
| 96-144-4-j26-1 | 801 | 94 / bus | Thal | admitted-all-dated-trips | 68 / 68 | 45 / 45 | All dated journeys pass |
| 96-144-6-j26-1 | 801 | N56 / bus | Gäu, Olten | excluded | 0 / 0 | 0 / 5 | night-network-excluded-by-source |
| 96-144-7-j26-1 | 801 | 127 / bus | Gäu, Olten | excluded | 0 / 61 | 0 / 37 | incomplete-directed-pattern |
| 96-144-9-j26-1 | 801 | 129 / bus | Gäu, Thal | admitted-all-dated-trips | 112 / 112 | 59 / 59 | All dated journeys pass |
| 96-144-B-j26-1 | 801 | M55 / bus | Lebern, Solothurn | excluded | 0 / 0 | 0 / 2 | night-network-excluded-by-source |
| 96-145-0-j26-1 | 801 | 130 / bus | Thal, Thierstein | partially-admitted | 61 / 69 | 25 / 43 | incomplete-directed-pattern |
| 96-145-1-j26-1 | 801 | 125 / bus | Gäu | excluded | 0 / 29 | 0 / 0 | incomplete-directed-pattern |
| 96-145-2-j26-1 | 801 | 126 / bus | Gäu | excluded | 0 / 71 | 0 / 35 | incomplete-directed-pattern |
| 96-145-4-j26-1 | 801 | 124 / bus | Gäu | excluded | 0 / 0 | 0 / 14 | incomplete-directed-pattern |
| 96-145-6-j26-1 | 801 | 131 / bus | Thal | partially-admitted | 0 / 0 | 3 / 12 | incomplete-directed-pattern |
| 96-145-9-j26-1 | 801 | 12 / bus | Lebern, Solothurn | admitted-all-dated-trips | 50 / 50 | 28 / 28 | All dated journeys pass |
| 96-148-2-j26-1 | 801 | 882 / bus | Bucheggberg | partially-admitted | 10 / 38 | 0 / 20 | incomplete-directed-pattern |
| 96-148-5-j26-1 | 801 | 885 / bus | Bucheggberg, Wasseramt | partially-admitted | 4 / 39 | 0 / 18 | incomplete-directed-pattern |
| 96-148-6-j26-1 | 801 | 886 / bus | Bucheggberg, Wasseramt | admitted-all-dated-trips | 35 / 35 | 18 / 18 | All dated journeys pass |

Machine detail: [routes](../data/solothurn-audit/routes.json), [Friday patterns and directed pairs](../data/solothurn-audit/2026-09-04.json), [Sunday patterns and directed pairs](../data/solothurn-audit/2026-09-06.json). Every failed pair retains a reason, and every excluded pattern retains its complete original stop chain.
