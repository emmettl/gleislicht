# Hub study: the Swiss takt as a visual instrument

The national view shows reach; the hub view shows rhythm. At a major interchange, the Swiss clock-face timetable becomes visible as waves of arrivals converging before a pulse and departures spreading out immediately after it.

## Motion study 004

The first version uses the same two-hour scheduled GTFS artifact as the national map and focuses on four hubs:

- Zürich HB — Switzerland's busiest station.
- Bern — the central national interchange.
- Basel SBB — a tri-national gateway.
- Genève — the western gateway.

Every scheduled call across the full civil day becomes one light. During the 15 minutes before arrival it moves inward along the bearing of its previous stop; during the station dwell it strikes the centre; during the 15 minutes after departure it travels outward toward its next stop. Colour encodes the existing service categories. The three rings mark five-minute intervals. The day loops continuously and can run at four authored tempos from a contemplative 1× to a 64× rush.

The alternate **Tracks** view unfolds those same calls onto their GTFS `platform_code` assignments. It is a schematic station plan: the platform labels and scheduled arrival, dwell and departure times are real, while the parallel-track geometry is deliberately abstract rather than survey-accurate. Unassigned calls remain visible on a separate `Gl. ?` row instead of being silently discarded.

## A note on “Europe's busiest”

The project should avoid using that phrase without naming the metric. Zürich Tourism describes Zürich HB as Switzerland's busiest station and cites around 3,000 train services a day across 26 tracks. SBB reports 405,200 station users on an average working day in 2024. Passenger-volume rankings, however, place Paris Gare du Nord ahead of Zürich.

The defensible editorial line for Gleislicht is therefore:

> Zürich HB is Switzerland's busiest station and one of Europe's busiest railway nodes, handling around 3,000 train services a day.

Sources: [Zürich Tourism station overview](https://www.zuerich.com/en/inform-plan/useful-information-and-services/zurich-main-station), [SBB Facts and Figures 2024](https://reporting.sbb.ch/_file/1324/sbb-facts-and-figures-2024.pdf), and [Swiss federal transport overview](https://www.aboutswitzerland.eda.admin.ch/en/transport).

## Next iterations

- [x] Use GTFS platform assignments in a schematic station-flow view.
- Join a surveyed or authoritative station plan before presenting the track geometry as geographically real.
- [x] Add frequency-ranked destination labels at the outer edge without turning the piece into a departure board.
- Compare a normal pulse with a delayed or disrupted one once realtime updates are available.
- Let a selected train bridge hub mode and the future terrain-backed corridor view.
- [x] Add a repeat-overlay mode that makes recurring `:00`, `:15`, `:30`, and `:45` structures explicit without losing the continuous day.
