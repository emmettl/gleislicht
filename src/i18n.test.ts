import { describe, expect, it } from 'vitest'
import { resolveUiLanguage, serviceCategoryLabel } from './i18n.ts'

describe('Gleislicht localization', () => {
  it('uses the first supported Swiss language and understands regional tags', () => {
    expect(resolveUiLanguage(['en-GB', 'fr-CH', 'de-CH'])).toBe('fr')
    expect(resolveUiLanguage(['it_CH'])).toBe('it')
  })

  it('falls back to German when no supported language is present', () => {
    expect(resolveUiLanguage(['rm-CH', 'en'])).toBe('de')
  })

  it('localizes transport categories', () => {
    expect(serviceCategoryLabel('de', 'ferry')).toBe('Schiff')
    expect(serviceCategoryLabel('fr', 's-bahn')).toBe('RER')
    expect(serviceCategoryLabel('it', 'funicular')).toBe('Funicolare')
  })
})
