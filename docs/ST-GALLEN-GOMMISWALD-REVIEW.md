# St. Gallen: Gommiswald line-628 follow-up

Retain the **12 Friday trips in four directed patterns** excluded on line 628 (`96-240-8-j26-1`). There is no Sunday line-628 service in the fixture. Three directed platform pairs between Gommiswald Gauenhof and Dorf exceed the existing source snap limit, with a maximum gap of about **211.2 m**.

The [PostAuto Gaster network map](https://www3.postauto.ch/-/media/postauto/fahrplan-und-netz/liniennetz/dokumente/ostschweiz/liniennetzplan-gaster.pdf?vs=7), visually reviewed on 8 September 2026, shows line 628 from Gauenhof towards **Schulhaus**, while lines 632/633 serve **Dorf**. It does not establish that the excluded line-628 trips use the Dorf corridor. The original Swiss GTFS calls remain intact; the map is not grounds to rename Dorf or substitute Schulhaus.

The [endpoint review](../data/st-gallen-endpoint-review.json) identifies numerically passing candidate geometry on PostAuto records `bus:91` (632) and `bus:128` (633), but numerical proximity and shared operator identity alone do not establish the missing branch. No fallback is enabled. A route-specific alignment or diversion record is still needed to corroborate these exact directed pairs.

The map states validity from **14 December 2025**; PDF metadata records modification on **20 January 2026**. Cached file: `data/st-gallen-sources/local/postauto-gaster.pdf`, 1796712 bytes. Retrieved UTC: 2026-09-08T19:46:50.982354+00:00. SHA-256: `2513b18aae69265542a545818d1655b88496a506f7eb89eaa0f83fc2e65db6b4`. The map is excluded from Git; this review does not change the original source catalogue or feed.

Attribution: **PostAuto AG / OSTWIND** for the schematic; **© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG**, underlying **swissTNE Base / © swisstopo**, for candidate alignment geometry; **SBB / opentransportdata.swiss** for the preserved timetable calls. See the [canton study](ST-GALLEN-STUDY.md) for source scope and reuse restrictions.
