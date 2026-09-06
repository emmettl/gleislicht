# MANIFEST

**World trade in motion**

**Catalogue status:** unnumbered global-motion investigation.

## Thesis

The world economy is usually described as totals, prices and arrows between countries. **MANIFEST** should make it physical: hulls leaving the manufacturing ports of China, tanker streams converging on the Strait of Hormuz, container services threading Malacca and Suez, and the same ships arriving days or weeks later at another coast. Sea lanes should emerge from repeated movement rather than being drawn as a static network.

The work is not a live ship-finder and should not pretend that AIS is a cargo manifest. Its subject is the relationship between observed vessel motion and the trade system that motion implies. The strongest version combines a wide, slow field of real trajectories with a few source-bounded voyage stories and honest aggregate trade context.

## Feasibility verdict — 6 September 2026

The visual study is technically feasible. A rights-clean, reproducible **global vessel-track** publication path is not yet established, and exact commodity attribution is not available from AIS alone.

| Claim or scope | Status | What is defensible now |
| --- | --- | --- |
| Global shipping intensity by broad vessel class | **Green for an eligible free, non-commercial work** | [Global Fishing Watch's AIS Vessel Presence](https://globalfishingwatch.org/platform-update/global-ais-vessel-presence-dataset/) supplies global, hourly, griddable presence from 2012 to about 96 hours ago, filterable by vessel type. It is suitable for density and pulse experiments under CC BY-NC 4.0, subject to account eligibility, attribution and API limits; its aggregated output does not prove direction or an individual track. |
| A bounded live reception proof | **Amber** | [AISStream](https://aisstream.io/documentation) offers a simple authenticated WebSocket with position and static/voyage messages. It has no durable replay or SLA, requires a server-side connection, and publishes no clear feed-use or redistribution licence on the documentation/legal pages reviewed. Record only an ephemeral local sample until written publication terms exist. |
| Reproducible global individual tracks | **Amber / commercial** | Satellite-plus-terrestrial archives from Spire and Kpler/MarineTraffic are technically suitable and extend into open ocean, but require a commercial agreement that explicitly permits a public derived artifact, retention and exhibition capture. Cost is quote-based for the required bulk scope. |
| Public regional individual tracks | **Green, but not global** | NOAA publishes detailed annual AIS downloads for US waters; Norway publishes open live and historical AIS under NLOD. These can prove the compiler and visual grammar, but they cannot support China–Europe or Gulf–Asia/Europe continuity. |
| “Cargo vessels from China” | **Amber as an inference** | AIS can identify a cargo-class vessel and a departure from a Chinese port. That supports “cargo vessel observed leaving [port]”, not the origin, ownership or contents of its boxes. Bilateral trade statistics can supply aggregate context but do not join goods to a hull. |
| “Oil from the Gulf” | **Amber to red by wording** | AIS ship type can distinguish tanker from cargo and a port call can associate a voyage with an oil terminal. AIS does not normally disclose product and quantity. Say “tanker departing a Gulf oil terminal” unless a licensed cargo/fixture source proves crude, product and volume for that voyage. |
| Permanent live public work | **Red for the first release** | A live feed introduces secrets, uptime, unpredictable load, changing coverage and provider redistribution questions without improving the authored argument. Begin with a pinned historical interval; consider live only after the study succeeds. |

**Recommendation:** commission a historical satellite-AIS sample with publication rights, while using Global Fishing Watch presence data to prototype the world-scale field. Do not build the public work on AISStream or scrape consumer ship-tracking sites. If the commercial sample is unaffordable or its derived-data terms are restrictive, publish an aggregate, non-commercial presence study rather than fabricate continuous tracks.

## What AIS actually says

AIS is a maritime safety broadcast, not a logistics database. Under IMO carriage rules it is fitted to passenger ships and to many larger commercial ships, but not every vessel at sea. The [IMO requirements](https://www.imo.org/en/ourwork/safety/navigation/ais.aspx) cover ships of 300 gross tonnage and above on international voyages, cargo ships of 500 gross tonnage and above on non-international voyages, and passenger ships irrespective of size; smaller and exempt vessels can therefore be absent.

| Evidence level | Typical fields | Treatment in MANIFEST |
| --- | --- | --- |
| **Observed / sensor-fed** | MMSI, received timestamp, latitude, longitude, speed over ground, course over ground and often heading/navigation status | May drive a position or trail after validation. Preserve reception gaps; never bridge an ocean-scale absence with an unlabelled straight line. |
| **Self-reported** | Ship name, IMO number, ship/cargo-type code, draught, destination and ETA | Display as reported and time-stamped. Destination, ETA and draught are manually maintained fields under the [IMO operational guidance](https://wwwcdn.imo.org/localresources/en/OurWork/Safety/Documents/AIS/Resolution%20A.1106%2829%29.pdf), so stale spelling, typos and omissions are evidence quality—not renderer bugs. |
| **Derived voyage** | Port-call arrival/departure, origin/destination port pair, route segment, laden/ballast signal | Compute offline with explicit thresholds and confidence. A port call requires a geofenced dwell/low-speed event, not one nearby ping; draught change is supporting evidence, not a cargo measurement. |
| **Enriched identity** | Vessel dimensions, subtype, deadweight/capacity, owner/operator, build and flag history | Requires a dated registry or licensed characteristics source. Keep IMO and MMSI separate: MMSI can change or be reused; IMO is the preferred durable hull identity when present. |
| **Trade context** | Commodity, value or mass by reporter, partner, period and sometimes transport mode | Present as a statistical annotation beside observed motion. Never allocate a national monthly total across visible ships as though it were a manifest. |

The [USCG AIS message reference](https://navcen.uscg.gov/ais-class-a-reports) shows that the public two-digit ship/cargo code identifies broad classes—`7x` cargo and `8x` tanker—with the second digit primarily describing hazardous-goods categories. It does not distinguish electronics from garments inside a container ship, or reliably distinguish crude oil from refined product, chemicals or gas inside the tanker family.

Reception is also not transmission. Terrestrial AIS is VHF and line-of-sight; satellite receivers extend the picture offshore but can miss colliding messages in dense waters. Global Fishing Watch's [AIS caveats](https://api-doc.globalfishingwatch.org/our-apis/documentation/docs/v3/general-api-doc/data-caveats) explicitly warn that satellite passes, coastal receiver coverage and signal interference create gaps. Silence must render as absence or uncertainty, never as proof that a vessel stopped or disabled AIS.

Exact live publication also has a safety dimension beyond licensing. The IMO's AIS page records its Maritime Safety Committee's warning that unrestricted web publication can harm ship and port security. MANIFEST should therefore prefer a delayed, bounded historical study, minimize searchable identity at the world scale, and review any selected named voyage before release. This is an authored account of trade movement, not an operational surveillance tool.

## Feed and archive audit

### Global and near-global candidates

| Source | Availability and interface | Rights / operational finding | Decision |
| --- | --- | --- | --- |
| [Global Fishing Watch 4Wings API](https://globalfishingwatch.org/our-apis/documentation/docs/v3/4wings) | Token-authenticated reports, tiles and statistics. `public-global-presence:latest` takes one AIS position per vessel per hour, covers all vessel types from 2012 to about 96 hours ago, and can filter cargo/tanker classes. It is presence/grid data, not a continuous per-vessel track export. | [CC BY-NC 4.0 and API limits](https://globalfishingwatch.org/our-apis/documentation/docs/license-rate-limits): 50,000 requests/day and 1.5 million/month across a user's tokens. Registration represents an eligible organization/entity and can be rejected; commercial reuse is outside the published terms. Required credit is “Powered by Global Fishing Watch” or the specified dataset/version/date citation. Dataset metadata may add third-party restrictions. | **Prototype the aggregate global field after account approval.** Best open route to a truthful impression of trade-lane intensity, but insufficient for direction, named end-to-end voyages or a commercial edition. |
| [AISStream WebSocket](https://aisstream.io/documentation) | API key, required bounding boxes, optional message-type and up-to-200-MMSI filters; 3 connections per account/IP. Binary UTF-8 JSON, compression, reconnect logic and a server-side proxy are required. It offers no historical query, durable replay or SLA and can drop events if the client falls behind. | The reviewed site exposes a privacy policy but no explicit licence covering feed retention, transformation, public display or redistribution. The docs advise focused boxes; they do not promise that a whole-world subscription is supported or complete. | **Local live spike only after asking for terms.** Do not commit or publish a recording yet. Test bounded choke points, message volume and static-message arrival. |
| [Spire Maritime](https://spire.com/maritime/) | Combined satellite, terrestrial and enhanced AIS; live APIs/feeds, vessel/port enrichment, and historical data back to 2011. The historical API supports track/point delivery and bulk requests. | Commercial, contract and quote based. Public documentation establishes technical capability, not permission to redistribute browser-ready derived tracks. | **Preferred source to quote alongside Kpler.** Ask for a small licensed evaluation before architecture depends on it. |
| [Kpler / MarineTraffic API](https://servicedocs.marinetraffic.com/) | Live vessel positions, port calls and [single-vessel historical tracks](https://servicedocs.marinetraffic.com/tag/Vessel-Historical-Track/) back to 2015, with downsampled hourly/daily options. | Proprietary API; call rate and successful-call allowance are contract-specific. A single-vessel endpoint is not an economical proof of a world snapshot without a bulk licence. | **Obtain a derived-publication quote.** Useful comparison for coverage, history and port-call enrichment. |
| [VesselFinder API](https://www.vesselfinder.com/vessel-positions-api) | Latest terrestrial or satellite positions, voyage fields, port calls and master data. Published credit packs begin at €330/10,000 credits; each terrestrial record costs 1 credit and satellite record 10 credits. | Public per-record pricing makes exploratory lookup possible but a global animation potentially expensive. Subscription and historical/bulk/publication rights require a specific agreement. | **Fallback for a small vessel cohort, not the world field.** Request a trial only if the two bulk providers do not fit. |
| [AISHub](https://www.aishub.net/join-us) | Worldwide contributor aggregate and API, free to qualifying contributors. | Access requires an operational AIS receiver feed averaging at least 10 vessels, 90% uptime, at most 60-second downsampling and at most 10-second delay. Scraped or republished public feeds are prohibited contributions. | **Not presently available.** Do not install a receiver merely to avoid licensing a global source. |

No consumer map should be scraped. Map tiles, undocumented endpoints and browser responses from ship-tracking sites are not an alternative data licence and would make the study irreproducible.

### Public regional sources and aggregate fallbacks

| Source | Useful scope | Limit |
| --- | --- | --- |
| [NOAA Marine Cadastre 2025 AIS](https://catalog.data.gov/dataset/nationwide-automatic-identification-system-2025) | Downloadable US vessel positions by day and zone, plus annual transit products. Strong no-credential compiler fixture for busy ports and approaches. | US coastal and inland coverage only; no transoceanic continuity or China/Gulf origin evidence. Inspect the chosen annual release's metadata and notices in the source manifest. |
| [Norwegian Coastal Administration](https://www.kystverket.no/sjotransport-og-havn/ais/tilgang-pa-ais-data/) | Free open real-time and historical AIS for Norwegian waters, including the EEZ, under NLOD with Kystverket credit. Open data excludes fishing vessels under 15 m and leisure vessels under 45 m. | Excellent rights-clean satellite/terrestrial regional proof, but geographically peripheral to the defining flows. |
| [EMODnet vessel and route density](https://emodnet.ec.europa.eu/geoviewer/) | Monthly/annual European density by cargo, tanker and other classes; raster/web-service products reveal durable lanes at low payload. | Aggregated European density, not individual motion or global continuity. Raw AIS is not distributed. Useful as a visual baseline or European context only. |

Regional open sources prove decoding, cleaning and rendering but cannot be mosaicked into a “global” feed. Their different receivers, omissions, licences and dates would make seams look like changes in maritime activity.

## Trade and port context

AIS-derived motion and trade statistics should meet only at clearly labelled aggregate layers:

- [UN Comtrade](https://uncomtrade.org/docs/un-comtrade-api/) supplies annual and monthly bilateral goods data by commodity. Preview access is limited; a free key expands API access and premium access covers bulk delivery. It can support statements such as China's reported exports of a product group to a partner, but reporting lags, mirror asymmetries and optional transport-mode fields mean it does not prove a visible maritime voyage.
- [UNCTADstat seaborne trade](https://unctadstat.unctad.org/datacentre/reportInfo/US.SeaborneTrade) provides annual tonnes loaded and discharged by economy and broad cargo class, including crude-oil tanker, other tanker and dry cargo. It is the cleanest source for the scale of the world composition, not for a ship identity.
- The discontinued UN Comtrade/MarineTraffic [AIS-based seaborne-trade estimates](https://uncomtrade.org/docs/content-of-data/) are methodology precedent only: the series ended in December 2024 and must not be presented as current.
- Port geography needs a separately licensed source. Prefer a compact, versioned public port index plus authored terminal geofences; OpenStreetMap port/terminal details can supplement it under ODbL if the resulting database obligations are acceptable. A country polygon is not a port call and a port call is not necessarily the cargo's economic origin.

For the two signature claims, use bounded language:

| Visual phrase | Minimum evidence |
| --- | --- |
| **Goods from China** | Observed cargo-class vessel + confident departure from a named Chinese container/general-cargo port + dated aggregate China export context. Label as a cargo voyage from the port, not as proof of contents or manufacturing origin. |
| **Oil from the Gulf** | Observed tanker + confident departure from a named oil terminal + tanker subtype/terminal evidence from a licensed source + aggregate crude/other-tanker context. Without product evidence, label only as a tanker voyage. |
| **China → Europe corridor** | Many independently observed cargo voyages or an aggregate directional presence product across a common historical period. Do not infer a whole route from two distant pings. |
| **Gulf → Asia/Europe corridor** | Many tanker departures and continuous-enough tracks through Hormuz and downstream choke points, with coverage quality visible. Destination strings alone do not establish the route. |

## Proposed composition

The opening should compress **30 consecutive historical UTC days** into approximately three minutes. A single day is enough to show density but too short to let an ocean-crossing voyage explain distance. The camera begins with the whole ocean system and then performs three authored descents:

1. **Factory tide** — cargo-class departures pulse from the Pearl River Delta, Yangtze delta and Bohai approaches; repeated wakes converge toward Malacca. The narration speaks about observed cargo-vessel departures and aggregate exports, not box contents.
2. **Black current** — tanker departures gather around the Gulf, squeeze through Hormuz and divide toward the Indian Ocean. Crude and other tanker trade remain distinct wherever the contextual source supports that distinction.
3. **Needle eyes** — Malacca, Bab el-Mandeb/Suez and Gibraltar demonstrate how geography concentrates an otherwise planetary field. Panama can become a later counterpoint rather than a fourth opening claim.

At global scale, render downsampled moving marks and short trails rather than every raw report. Persistent route density should be accumulated from the observed window and decay behind the clock; there is no authored route network. At voyage scale, selecting one of a small prequalified ships reveals the exact received samples, gaps, reported fields, inferred port calls and confidence separately.

Vessel colour should encode broad movement system, not nation or assumed contents: cool white for cargo, restrained amber for tankers, dim neutral for passenger/service/other. Brightness and wake duration can express frequency or recency. Flag is metadata, not origin. Land should remain nearly black; ports and choke points appear only when the camera needs them.

## Data and rendering architecture

Keep provider credentials and raw licensed data outside the repository. The public artifact should be a provider-approved, irreversible compilation with a source manifest and enough information to audit every visual claim.

```text
licensed/open AIS archive
        + vessel identity snapshot
        + port and terminal geofences
        + aggregate trade tables
                    │
                    ▼
offline normalizer → quality/gap audit → port-call & voyage inference
                    │
                    ▼
30-day study manifest + spatial/time chunks + contextual summaries
                    │
                    ▼
static client: global field → authored descents → selected voyage evidence
```

The compiler should:

- validate MMSI, coordinates, impossible speed jumps, duplicate receivers and out-of-order timestamps;
- namespace provider records and retain reception source/quality where licensed;
- join static messages by time range, not treat the newest identity as historically eternal;
- split a track on identity conflicts, long gaps, impossible movement and dateline-safe geometry;
- preserve actual samples and mark interpolation explicitly; use a conservative maximum gap measured during the source evaluation;
- detect candidate port calls from terminal/port geofences, low speed and dwell, then record method and confidence;
- downsample by visual error and time, retaining turns and choke-point detail rather than a uniform interval;
- aggregate the far view into spatial/time bins so the browser never loads every ship position;
- emit content hashes, provider release/query, capture interval, licence, transformations, omissions and known coverage holes.

Suggested client budget for the proof: a 150–250 KiB compressed manifest and context; no more than 1.5 MiB compressed for the initial world field; lazy regional/month chunks capped near 1 MiB each; at most a few thousand simultaneous GPU marks on phone. These are design gates to test, not claims about source volume. Raw AIS can reach millions of messages quickly and must never be sent directly to the browser.

The first experiment should remain fully static and replayable. A later live mode would require a durable recorder, bounded subscriptions, server-side secret, reconnection/back-pressure metrics, late static-message handling, coverage-health display and a fallback to the last complete historical study.

## Source evaluation and procurement gate

Before ingesting a global archive, obtain the same evaluation slice from at least Spire and Kpler/MarineTraffic: 72 hours around the Yangtze/Pearl River approaches, Malacca, Hormuz and Suez/Bab el-Mandeb, plus a quote for one global 30-day historical window. The slice must include dynamic positions, message/receive time, source type, MMSI and time-aligned static/voyage messages; quote port calls and characteristics separately so their value is measurable.

Written terms must answer:

1. May Motion Studies publish a downsampled, non-reconstructable browser artifact derived from the supplied AIS positions?
2. May that artifact, screenshots and video remain available indefinitely after the data subscription or evaluation ends?
3. What fields, temporal/spatial precision or minimum aggregation are required to prevent source reconstruction?
4. Is public display allowed for free and paid exhibitions, editorial films and a potentially commercial site?
5. May a source-pinned historical study remain reproducible, or must derived artifacts be refreshed/deleted?
6. Are vessel names, MMSI/IMO, port calls, characteristics and terminal-derived voyage classifications covered by the same rights?
7. What attribution, provider logo, downstream terms and takedown procedure are required?
8. What measured coverage, latency and duplicate-receiver behavior should be expected in the four evaluation regions?
9. Is China coastal and open-ocean satellite coverage contractually included, and are there territorial display/export restrictions?
10. What is the fixed cost for the evaluation, the 30-day global historical delivery and any later refresh—without per-view API calls?

For AISStream, additionally request an explicit data licence, permitted bounding-box extent, source/coverage description, retention rules, publication/redistribution rights, commercial status and notice period for API changes. Absence of an invoice is not permission to redistribute the feed.

## Admission and next decision

MANIFEST earns a catalogue number only when it has:

- a written publication path for the derived global movement artifact;
- one pinned 30-day capture with measured coverage across China, the Gulf and the connecting choke points;
- a vocabulary that keeps observed, reported, inferred and statistical claims visibly distinct;
- a phone-budget world field plus one selected voyage with honest gaps;
- a signature composition in which lanes emerge from movement rather than a generic animated world map.

Until then it is a strong global-motion investigation, not a promised edition. The immediate proof is deliberately small: compile one rights-clean regional open dataset to validate the pipeline, prototype the global density field through Global Fishing Watch, and compare identical commercial evaluation slices before choosing whether individual world tracks are worth their rights and cost.
