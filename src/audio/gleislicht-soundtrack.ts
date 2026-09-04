import {
  chillwaveSong,
  cloudsSong,
  defaultFx,
  DriftboxEngine,
  emptyBassLine,
  transmissionSong,
  type BassStep,
  type Song,
} from '@driftbox/engine'

export type SoundtrackMode = 'network' | 'hub' | 'journey'
export type SoundtrackPerformanceProfile = 'full' | 'mobile'

export const SOUNDTRACK_TITLES: Record<SoundtrackMode, string> = {
  network: 'Night Grid',
  hub: 'Taktwerk',
  journey: 'Valley Signal',
}

const CROSSFADE_SECONDS = 4.8
const MOBILE_FADE_SECONDS = 0.32
const ENGINE_GAIN = 0.74

function groundedBassLine(length: number): BassStep[] {
  const line = emptyBassLine(length)
  line[0] = { note: 0, accent: false, slide: false }
  return line
}

function networkSong(): Song {
  const song = cloudsSong()
  const patterns = song.patterns.map((pattern) => ({
    ...pattern,
    // Night Grid needs a horizon, not a lead bass. Clouds' 303.a line skips and slides
    // through a pentatonic melody; keep only one soft root pulse at the start of each bar.
    bass:
      pattern.id === 'gap' ? undefined : { '303.b': groundedBassLine(pattern.length) },
  }))
  const kit = {
    ...song.kit,
    bass: song.kit.bass
      ? {
          ...song.kit.bass,
          '303.b': {
            ...song.kit.bass['303.b'],
            cutoff: 0.12,
            resonance: 0.12,
            envMod: 0.08,
            decay: 0.86,
            accent: 0.12,
            level: 0.34,
          },
        }
      : undefined,
    sends: {
      ...song.kit.sends,
      '303.a': { delay: 0, reverb: 0 },
      '303.b': { delay: 0.08, reverb: 0.16 },
    },
  }

  return {
    ...song,
    bpm: 108,
    swing: 0.2,
    visual: 'gleislicht-network',
    patterns,
    kit,
    chain: [
      { pattern: 'clear', repeat: 4 },
      { pattern: 'drift', repeat: 8 },
      { pattern: 'cumulus', repeat: 6 },
      { pattern: 'gap', repeat: 2 },
      { pattern: 'sunshine', repeat: 4 },
      { pattern: 'drift', repeat: 8 },
      { pattern: 'clear', repeat: 4 },
    ],
    fx: {
      ...(song.fx ?? defaultFx()),
      delayTime: 0.72,
      delayFeedback: 0.58,
      delayTone: 0.25,
      reverbSize: 0.72,
      reverbDamping: 0.56,
    },
  }
}

function hubSong(): Song {
  const song = chillwaveSong()
  return {
    ...song,
    bpm: 116,
    swing: 0.22,
    visual: 'gleislicht-hub',
    chain: [
      { pattern: 'pulse', repeat: 8 },
      { pattern: 'drift', repeat: 4 },
      { pattern: 'lift', repeat: 4 },
      { pattern: 'surge', repeat: 8 },
      { pattern: 'hush', repeat: 2 },
      { pattern: 'pulse', repeat: 8 },
      { pattern: 'neon', repeat: 4 },
      { pattern: 'hush', repeat: 2 },
    ],
    fx: {
      ...(song.fx ?? defaultFx()),
      delayTime: 0.5,
      delayFeedback: 0.46,
      delayTone: 0.44,
      reverbSize: 0.6,
      reverbDamping: 0.48,
    },
  }
}

function journeySong(): Song {
  const song = transmissionSong()
  return {
    ...song,
    bpm: 88,
    swing: 0.2,
    visual: 'gleislicht-journey',
    chain: [
      { pattern: 'carrier', repeat: 6 },
      { pattern: 'static', repeat: 4 },
      { pattern: 'interference', repeat: 5 },
      { pattern: 'dropout', repeat: 2 },
      { pattern: 'signal', repeat: 6 },
      { pattern: 'interference', repeat: 5 },
      { pattern: 'carrier', repeat: 6 },
    ],
    fx: {
      ...(song.fx ?? defaultFx()),
      delayTime: 0.9,
      delayFeedback: 0.66,
      delayTone: 0.18,
      reverbSize: 0.94,
      reverbDamping: 0.72,
    },
  }
}

function mobileMix(song: Song): Song {
  return {
    ...song,
    kit: {
      ...song.kit,
      sends: song.kit.sends
        ? Object.fromEntries(
            Object.entries(song.kit.sends).map(([voice, sends]) => [
              voice,
              { ...sends, reverb: sends.reverb * 0.58 },
            ]),
          )
        : undefined,
    },
    fx: song.fx
      ? {
          ...song.fx,
          // Long convolution tails are the most expensive part of the mix on phones.
          // Keep the delay intact so the atmosphere survives the shorter room.
          reverbSize: Math.min(0.46, song.fx.reverbSize * 0.62),
        }
      : undefined,
  }
}

export function buildGleislichtSong(
  mode: SoundtrackMode,
  profile: SoundtrackPerformanceProfile = 'full',
): Song {
  const song =
    mode === 'hub' ? hubSong() : mode === 'journey' ? journeySong() : networkSong()
  return profile === 'mobile' ? mobileMix(song) : song
}

interface Deck {
  engine: DriftboxEngine | null
  gain: GainNode
  mode: SoundtrackMode | null
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

/**
 * Two Driftbox transports sharing one AudioContext. The inactive deck starts the next
 * composition silently, then the Web Audio graph crossfades the complete mastered mixes.
 */
export class GleislichtSoundtrack {
  private readonly context: AudioContext
  private readonly master: GainNode
  private readonly decks: [Deck, Deck]
  private readonly profile: SoundtrackPerformanceProfile
  private activeDeck = 0
  private desiredMode: SoundtrackMode = 'network'
  private volume: number
  private playing = false
  private transitionPromise: Promise<void> | null = null
  private generation = 0

  constructor(volume = 0.56, profile = preferredPerformanceProfile()) {
    this.profile = profile
    this.context = createSoundtrackContext()
    this.master = this.context.createGain()
    this.master.gain.value = 0
    this.master.connect(this.context.destination)
    this.volume = volume

    this.decks = [0, 1].map(() => {
      const gain = this.context.createGain()
      gain.gain.value = 0
      gain.connect(this.master)
      return { engine: null, gain, mode: null }
    }) as [Deck, Deck]
  }

  async start(mode: SoundtrackMode): Promise<void> {
    this.desiredMode = mode
    this.playing = true
    const generation = ++this.generation
    const deck = this.decks[this.activeDeck]

    if (!deck.engine || deck.mode !== mode) this.loadDeck(deck, mode)
    await deck.engine?.start()
    if (!this.playing || generation !== this.generation) return

    const now = this.context.currentTime
    deck.gain.gain.cancelScheduledValues(now)
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, now)
    deck.gain.gain.linearRampToValueAtTime(1, now + 0.8)
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(this.volume, now + 1.2)
  }

  async transition(mode: SoundtrackMode): Promise<void> {
    this.desiredMode = mode
    if (!this.playing || this.decks[this.activeDeck].mode === mode) return
    if (this.transitionPromise) return this.transitionPromise

    this.transitionPromise = this.runTransitions().finally(() => {
      this.transitionPromise = null
    })
    return this.transitionPromise
  }

  private async runTransitions(): Promise<void> {
    while (this.playing && this.decks[this.activeDeck].mode !== this.desiredMode) {
      const nextMode = this.desiredMode
      if (this.profile === 'mobile') {
        await this.runMobileTransition(nextMode)
        continue
      }
      const previousIndex = this.activeDeck
      const nextIndex = previousIndex === 0 ? 1 : 0
      const previous = this.decks[previousIndex]
      const next = this.decks[nextIndex]
      const generation = this.generation

      this.loadDeck(next, nextMode)
      await next.engine?.start()
      if (!this.playing || generation !== this.generation) return

      const now = this.context.currentTime
      previous.gain.gain.cancelScheduledValues(now)
      next.gain.gain.cancelScheduledValues(now)
      previous.gain.gain.setValueAtTime(previous.gain.gain.value, now)
      next.gain.gain.setValueAtTime(0, now)
      previous.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS)
      next.gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS)

      await wait(CROSSFADE_SECONDS * 1000)
      if (!this.playing || generation !== this.generation) return
      previous.engine?.stop()
      previous.engine?.silenceTails()
      this.activeDeck = nextIndex
    }
  }

  private async runMobileTransition(nextMode: SoundtrackMode): Promise<void> {
    const deck = this.decks[this.activeDeck]
    const generation = this.generation
    const now = this.context.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(0, now + MOBILE_FADE_SECONDS)

    await wait(MOBILE_FADE_SECONDS * 1000)
    if (!this.playing || generation !== this.generation) return

    deck.engine?.stop()
    this.loadDeck(deck, nextMode)
    await deck.engine?.start()
    if (!this.playing || generation !== this.generation) return

    const resumeAt = this.context.currentTime
    deck.gain.gain.cancelScheduledValues(resumeAt)
    deck.gain.gain.setValueAtTime(1, resumeAt)
    this.master.gain.cancelScheduledValues(resumeAt)
    this.master.gain.setValueAtTime(0, resumeAt)
    this.master.gain.linearRampToValueAtTime(
      this.volume,
      resumeAt + MOBILE_FADE_SECONDS,
    )
  }

  private loadDeck(deck: Deck, mode: SoundtrackMode): void {
    deck.engine?.dispose()
    deck.engine = new DriftboxEngine(buildGleislichtSong(mode, this.profile), {
      context: this.context,
      destination: deck.gain,
      gain: ENGINE_GAIN,
    })
    deck.mode = mode
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume))
    if (!this.playing) return
    const now = this.context.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(this.volume, now, 0.08)
  }

  async resume(): Promise<void> {
    if (this.playing && this.context.state !== 'running') {
      await this.context.resume()
    }
  }

  stop(): void {
    this.playing = false
    ++this.generation
    const now = this.context.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(0, now, 0.08)
    for (const [index, deck] of this.decks.entries()) {
      deck.gain.gain.cancelScheduledValues(now)
      deck.gain.gain.setTargetAtTime(index === this.activeDeck ? 1 : 0, now, 0.08)
      if (index !== this.activeDeck) {
        deck.engine?.stop()
        deck.engine?.silenceTails()
      }
    }
    window.setTimeout(() => {
      if (this.playing) return
      for (const deck of this.decks) deck.engine?.stop()
    }, 500)
  }

  dispose(): void {
    this.stop()
    for (const deck of this.decks) deck.engine?.dispose()
    this.master.disconnect()
    void this.context.close()
  }
}

function preferredPerformanceProfile(): SoundtrackPerformanceProfile {
  return window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(max-width: 900px)').matches
    ? 'mobile'
    : 'full'
}

function createSoundtrackContext(): AudioContext {
  const options: AudioContextOptions = {
    // This is an authored soundtrack, not an instrument being played from the UI.
    // A larger output buffer is inaudible as latency but valuable protection against
    // iOS dropping render blocks while WebGL and JSON parsing share the device.
    latencyHint: 'playback',
  }
  try {
    return new AudioContext(options)
  } catch {
    // Older WebKit builds may reject constructor hints even though Web Audio works.
    return new AudioContext()
  }
}
