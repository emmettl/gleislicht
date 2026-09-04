import { describe, expect, it } from 'vitest'
import { resolveUiLanguage, serviceCategoryLabel } from './i18n.ts'

describe('Gleislicht localization', () => {
  it('uses the first supported language and understands regional tags', () => {
    expect(resolveUiLanguage(['rm-CH', 'fr-CH', 'de-CH'])).toBe('fr')
    expect(resolveUiLanguage(['it_CH'])).toBe('it')
  })

  it('supports English and uses it as the fallback language', () => {
    expect(resolveUiLanguage(['en-GB', 'fr-CH'])).toBe('en')
    expect(resolveUiLanguage(['rm-CH', 'pt'])).toBe('en')
  })

  it('localizes transport categories', () => {
    expect(serviceCategoryLabel('de', 'ferry')).toBe('Schiff')
    expect(serviceCategoryLabel('fr', 's-bahn')).toBe('RER')
    expect(serviceCategoryLabel('it', 'funicular')).toBe('Funicolare')
  })
})
