# Regional and urban studies

The national rail study should remain spacious. Multimodal detail belongs in separately generated, lazily loaded studies with their own camera scale, label density and visual hierarchy.

## The three scales

1. **Switzerland — rail atlas.** The existing national view keeps rail only. It shows the long-distance timetable, the national silhouette and the cadence between cities without several thousand local bus movements obscuring it.
2. **Regional network — connective tissue.** ZVV and later TPG studies show the relationship between S-Bahn or regional rail and the tram, bus, boat and funicular services that feed it. At the widest zoom, frequent urban services are aggregated into luminous corridors; individual vehicles and stops reveal as the camera descends. This follows the hierarchy of a regional network map rather than attempting to show every vehicle equally at every scale.
3. **City — full-fat motion.** Zürich city is deliberately dense: trains, trams, buses and funiculars all remain individually visible. The first compact artifact contains 2,797 scheduled trips in the 06:45–08:45 window, with 404 vehicles moving at 07:45, but is downloaded only when the city study is selected.

The first implementation now switches between the national rail atlas and Zürich city. ZVV-wide and Genève/TPG studies come after the zoom-dependent aggregation model is ready.

## The rural–urban contrast

PostBus deserves more than being another orange category in a huge map. A later **contrast study** should run two places against one synchronized 24-hour clock:

- a Zürich core around HB, Central, Bellevue and Stadelhofen, where tram and bus departures read as an almost continuous electrical texture; and
- one rural PostBus territory, where long runs, timed rail connections and quiet gaps become the composition.

The same playback speed, colour key and time axis make the difference in frequency legible. The comparison can begin as a split view, then become an authored crossfade for director mode. Candidate rural studies should be selected from the data after measuring route length, service frequency, rail interchange timing and terrain character—not from a picturesque guess.

## Data architecture

The official national GTFS remains the baseline because it contains all Swiss public transport and gives every study the same service date and identifiers. Preprocessing produces independent web artifacts:

```text
data/
  swiss-rail-morning.json
  zurich-city-morning.json
  regions/
    zvv-overview-<window>.json
    geneva-tpg-<window>.json
    postbus-<corridor>-<window>.json
```

Only the selected artifact is fetched. A future small manifest will expose bounds, modes, time windows, source versions and byte sizes before a study loads. Full-day regional studies should be split into time chunks so a 24-hour pulse does not impose a large first download.

Zürich's separate ZVV/VBZ GTFS now supplies shape geometry for the city study. It covers ZVV tram and bus services, includes `shapes.txt`, is published weekly, and is licensed CC0. The national GTFS remains the timetable baseline; the regional feed is joined by published line and directed Swiss stop identifier after service-date validation. The committed artifact matches 98.6% of tram and bus segment occurrences and falls back to direct stop interpolation for the remainder.

## Visual grammar

- Rail remains the structural layer; tram, bus and funicular routes have distinct colours and light textures.
- At regional zoom, buses appear first as corridor energy rather than thousands of labels.
- At city zoom, individual vehicles, stop labels and transfer pulses become available.
- Search, category isolation, pan/zoom, timeline speeds and follow-camera behaviour stay consistent between scales.
- “Live” continues to mean scheduled interpolation unless a compatible realtime source is explicitly joined and labelled.

## Delivery sequence

1. Zürich city from the national GTFS, using the existing scheduled interpolation renderer.
2. ✓ Shape-aware Zürich tram and bus geometry from the official ZVV/VBZ regional feed.
3. ZVV overview with zoom-dependent aggregation and regional line hierarchy.
4. Genève/TPG as the second city system, including French labels and cross-border edges.
5. One measured rural PostBus study and the synchronized rural–urban contrast mode.
