import { describe, expect, it } from 'vitest'
import {
  buildGleislichtSong,
  SOUNDTRACK_TITLES,
  type SoundtrackMode,
} from './gleislicht-soundtrack.ts'

const modes: SoundtrackMode[] = ['network', 'hub', 'journey']

describe('Gleislicht soundtrack', () => {
  it('provides a distinct named arrangement for each visual mode', () => {
    const songs = modes.map(buildGleislichtSong)

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
})
