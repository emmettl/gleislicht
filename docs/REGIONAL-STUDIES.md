# Regional and urban studies

The national rail study should remain spacious. Multimodal detail belongs in separately generated, lazily loaded studies with their own camera scale, label density and visual hierarchy.

## The three scales

1. **Switzerland — rail atlas.** The existing national view keeps rail only. It shows the long-distance timetable, the national silhouette and the cadence between cities without several thousand local bus movements obscuring it.
2. **Regional network — connective tissue.** ZVV and TPG studies show the relationship between S-Bahn or regional rail and the tram, bus, boat and funicular services that feed it. At the widest zoom, frequent urban services are aggregated into luminous corridors; individual vehicles and stops reveal as the camera descends. This follows the hierarchy of a regional network map rather than attempting to show every vehicle equally at every scale.
3. **City — full-fat motion.** Zürich city is deliberately dense: trains, trams, buses and funiculars all remain individually visible. The first compact artifact contains 2,797 scheduled trips in the 06:45–08:45 window, with 404 vehicles moving at 07:45, but is downloaded only when the city study is selected.

The interface now switches between the national rail atlas, ZVV and Genève regional studies, and Zürich city. Both regional home views keep rail movements explicit while local street geometry reads mainly through weighted corridor glow; individual trams appear after the first zoom descent and buses at a closer level. Any explicit category, line, station or vehicle selection overrides the aggregation immediately.

The Genève study retains French source names and uses TPG's operator identity rather than a rectangular local-service crop. Its published network crosses the national boundary, so Annemasse, Saint-Julien, Ferney, Gex and other French stops remain in the same schedule and geometry as their Swiss counterparts. The Swiss outline stays visible as context, not as a clipping mask.

## The rural–urban contrast

PostBus deserves more than being another orange category in a huge map. A later **contrast study** should run two places against one synchronized 24-hour clock:

- a Zürich core around HB, Central, Bellevue and Stadelhofen, where tram and bus departures read as an almost continuous electrical texture; and
- one rural PostBus territory, where long runs, timed rail connections and quiet gaps become the composition.

The same playback speed, colour key and time axis make the difference in frequency legible. The comparison can begin as a split view, then become an authored crossfade for director mode. Candidate rural studies should be selected from the data after measuring route length, service frequency, rail interchange timing and terrain character—not from a picturesque guess.

That selection is now complete: Kiental–Griesalp route 220 provides 20 trips between 06:13 and 18:42 on the study date, an 11 km scheduled stop chain, a compact terrain footprint and the officially documented 28% final climb. The decision and alternatives are recorded in [POSTBUS-CORRIDOR.md](./POSTBUS-CORRIDOR.md).

## Data architecture

The official national GTFS remains the baseline because it contains all Swiss public transport and gives every study the same service date and identifiers. Preprocessing produces independent web artifacts:

```text
data/
  swiss-rail-morning.json
  zurich-city-morning.json
  zvv-region-morning.json
  geneva-tpg-morning.json
  zurich-tram-day-manifest.json
  zurich-tram-day-chunks/
    <three-hour-window>.json
  kiental-postbus-day-manifest.json
  kiental-postbus-day-chunks/
    <three-hour-window>.json
```

Only the selected artifact is fetched. The full-day Kiental and Zürich tram studies use topology manifests and three-hour movement chunks, so the contrast mode can follow one clock without imposing either dataset on the initial page. Zürich's shared, shape-aware topology compresses to about 42 KB; its busiest three-hour movement block is about 112 KB compressed. A later shared study catalogue can expose bounds, modes, time windows, source versions and byte sizes before any study loads.

Zürich's separate ZVV/VBZ GTFS now supplies shape geometry for the city study. It covers ZVV tram and bus services, includes `shapes.txt`, is published weekly, and is licensed CC0. The national GTFS remains the timetable baseline; the regional feed is joined by published line and directed Swiss stop identifier after service-date validation. The committed artifact matches 98.6% of tram and bus segment occurrences and falls back to direct stop interpolation for the remainder.

Genève uses the same national timetable baseline and the official TPG line layer published by SITG. Because this source is a labelled route graph rather than a timetable feed, the offline join follows the shortest credible line-specific path between each scheduled stop pair. The committed artifact matches 96.6% of local segment occurrences and preserves TPG's cross-border geometry.

## Visual grammar

- Rail remains the structural layer; tram, bus and funicular routes have distinct colours and light textures.
- At regional zoom, buses appear first as corridor energy rather than thousands of labels.
- At city zoom, individual vehicles, stop labels and transfer pulses become available.
- Search, category isolation, pan/zoom, timeline speeds and follow-camera behaviour stay consistent between scales.
- “Live” continues to mean scheduled interpolation unless a compatible realtime source is explicitly joined and labelled.

## Delivery sequence

1. Zürich city from the national GTFS, using the existing scheduled interpolation renderer.
2. ✓ Shape-aware Zürich tram and bus geometry from the official ZVV/VBZ regional feed.
3. ✓ ZVV overview with zoom-dependent aggregation and regional line hierarchy.
4. ✓ Genève/TPG as the second regional system, including French labels and cross-border edges.
5. ✓ Select Kiental–Griesalp as the measured rural PostBus study.
6. ✓ Build shape-aware, progressively loaded 24-hour datasets for both sides of the contrast.
7. Build the synchronized rural–urban contrast interface.
