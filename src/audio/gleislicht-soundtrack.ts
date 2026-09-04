import {
  chillwaveSong,
  cloudsSong,
  defaultFx,
  DriftboxEngine,
  transmissionSong,
  type Song,
} from '@driftbox/engine'

export type SoundtrackMode = 'network' | 'hub' | 'journey'

export const SOUNDTRACK_TITLES: Record<SoundtrackMode, string> = {
  network: 'Night Grid',
  hub: 'Taktwerk',
  journey: 'Valley Signal',
}

const CROSSFADE_SECONDS = 4.8
const ENGINE_GAIN = 0.74

function networkSong(): Song {
  const song = cloudsSong()
  return {
    ...song,
    bpm: 108,
    swing: 0.36,
    visual: 'gleislicht-network',
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

export function buildGleislichtSong(mode: SoundtrackMode): Song {
  if (mode === 'hub') return hubSong()
  if (mode === 'journey') return journeySong()
  return networkSong()
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
  private activeDeck = 0
  private desiredMode: SoundtrackMode = 'network'
  private volume: number
  private playing = false
  private transitionPromise: Promise<void> | null = null
  private generation = 0

  constructor(volume = 0.56) {
    this.context = new AudioContext()
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

  private loadDeck(deck: Deck, mode: SoundtrackMode): void {
    deck.engine?.dispose()
    deck.engine = new DriftboxEngine(buildGleislichtSong(mode), {
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
