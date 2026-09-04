import { describe, expect, it } from 'vitest'
import { foldSearchText } from './search-text.ts'

describe('foldSearchText', () => {
  it('treats umlauts, plain vowels and Swiss digraphs alike', () => {
    expect(foldSearchText('Zürich')).toBe('zurich')
    expect(foldSearchText('Zurich')).toBe('zurich')
    expect(foldSearchText('Zuerich')).toBe('zurich')
    expect(foldSearchText('Bözberg')).toBe(foldSearchText('Boezberg'))
  })

  it('removes other combining accents and normalises sharp s', () => {
    expect(foldSearchText('  Genève  ')).toBe('geneve')
    expect(foldSearchText('Straße')).toBe('strasse')
  })
})
