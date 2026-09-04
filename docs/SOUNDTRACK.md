# Adaptive soundtrack

Gleislicht uses [`@driftbox/engine`](https://github.com/emmettl/driftbox), a Web Audio groovebox that synthesises every sound in the browser from an 808, a 909 and two 303-style voices. There are no audio files to stream and no recorded samples.

## The three cues

- **Night Grid — national network.** A restrained 108 BPM ambient-house arrangement. One rounded sub pulse grounds each bar while the mobile, sliding 303 line stays silent; long dub echoes make individual hits feel like signals crossing the country.
- **Taktwerk — station hubs.** A brighter 116 BPM pattern whose regular kick and accumulating hats mirror arrivals contracting into a hub and departures radiating outward.
- **Valley Signal — corridor and train follow.** An 88 BPM, deliberately unmoored piece built from uneven phrases, dark delay and a low carrier tone. It is the slowest and most spacious cue for the camera-led valley view.

The pieces reuse Driftbox's synthesised instrument voices and source motifs but have Gleislicht-specific tempi, effect settings and arrangements.

## Adaptive transitions

Two Driftbox engines share a single `AudioContext`. Only one deck is normally audible. When the visual mode changes, the next composition begins on the silent deck and the complete mastered mixes crossfade over 4.8 seconds. The old transport is stopped and its delay/reverb tails are cleared only after the transition.

This keeps transitions musical without coupling visual playback speed to musical tempo. The 1×–64× timeline control changes the data animation, while each cue retains its intended groove.

## Playback policy

Sound is off by default and starts only from the listener's explicit button press, as required by browser autoplay policies. The engine is loaded lazily on first use, so silent visits do not download the audio code. Volume is local to the session; no preference or analytics data is stored.

## Next musical iterations

- React to service-category focus with restrained filter and send changes rather than switching songs.
- Derive percussion density from the active-train or station-call rate.
- Quantise transitions to phrase boundaries while keeping the existing crossfade as a safety net.
- Add an analyser-driven visual response so light bloom breathes with the score.
