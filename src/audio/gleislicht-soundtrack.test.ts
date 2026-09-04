import { describe, expect, it } from 'vitest'
import {
  buildGleislichtSong,
  SOUNDTRACK_TITLES,
  type SoundtrackMode,
} from './gleislicht-soundtrack.ts'

const modes: SoundtrackMode[] = ['network', 'hub', 'journey']

describe('Gleislicht soundtrack', () => {
  it('provides a distinct named arrangement for each visual mode', () => {
    const songs = modes.map((mode) => buildGleislichtSong(mode))

    expect(new Set(Object.values(SOUNDTRACK_TITLES)).size).toBe(3)
    expect(new Set(songs.map((song) => song.bpm)).size).toBe(3)
    expect(songs.map((song) => song.visual)).toEqual([
      'gleislicht-network',
      'gleislicht-hub',
      'gleislicht-journey',
    ])
  })

  it('builds fresh song documents so the live engines cannot share mutations', () => {
    const first = buildGleislichtSong('network')
    const second = buildGleislichtSong('network')

    expect(first).not.toBe(second)
    expect(first.patterns).not.toBe(second.patterns)
    expect(first.kit).not.toBe(second.kit)
  })

  it('keeps Night Grid grounded without the skipping 303 line', () => {
    const song = buildGleislichtSong('network')

    for (const pattern of song.patterns) {
      expect(pattern.bass?.['303.a']).toBeUndefined()

      const audibleSteps = pattern.bass?.['303.b']?.filter(
        (step) => step.note !== null && step.gate !== false,
      )
      expect(audibleSteps?.length ?? 0).toBeLessThanOrEqual(1)
      expect(audibleSteps?.every((step) => !step.slide) ?? true).toBe(true)
    }
  })

  it('keeps the mobile arrangements atmospheric with shorter reverb tails', () => {
    for (const mode of modes) {
      const full = buildGleislichtSong(mode)
      const mobile = buildGleislichtSong(mode, 'mobile')

      expect(mobile.fx?.delayTime).toBe(full.fx?.delayTime)
      expect(mobile.fx?.reverbSize).toBeLessThanOrEqual(0.46)
      expect(mobile.fx?.reverbSize).toBeLessThan(full.fx?.reverbSize ?? 1)
      expect(mobile.patterns).toEqual(full.patterns)
      for (const [voice, sends] of Object.entries(mobile.kit.sends ?? {})) {
        expect(sends.delay).toBe(full.kit.sends?.[voice]?.delay)
        expect(sends.reverb).toBeLessThanOrEqual(
          full.kit.sends?.[voice]?.reverb ?? 1,
        )
      }
    }
  })
})
