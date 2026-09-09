import type { ServiceCategory } from '@motionstudies/core/domain/network'

export type UiLanguage = 'en' | 'de' | 'fr' | 'it'

export const UI_LANGUAGES: ReadonlyArray<{
  readonly id: UiLanguage
  readonly label: string
  readonly name: string
}> = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'de', label: 'DE', name: 'Deutsch' },
  { id: 'fr', label: 'FR', name: 'Français' },
  { id: 'it', label: 'IT', name: 'Italiano' },
]

export const LANGUAGE_LOCALES: Readonly<Record<UiLanguage, string>> = {
  en: 'en-CH',
  de: 'de-CH',
  fr: 'fr-CH',
  it: 'it-CH',
}

const CATEGORY_LABELS: Readonly<
  Record<UiLanguage, Readonly<Record<ServiceCategory, string>>>
> = {
  en: {
    international: 'International',
    intercity: 'IC',
    interregio: 'IR',
    'regional-express': 'RE',
    's-bahn': 'S-Bahn',
    regional: 'Regional',
    tram: 'Tram',
    metro: 'Metro',
    bus: 'Bus',
    ferry: 'Ferry',
    cableway: 'Cableway',
    funicular: 'Funicular',
    other: 'Other',
  },
  de: {
    international: 'International',
    intercity: 'IC',
    interregio: 'IR',
    'regional-express': 'RE',
    's-bahn': 'S-Bahn',
    regional: 'Regional',
    tram: 'Tram',
    metro: 'Metro',
    bus: 'Bus',
    ferry: 'Schiff',
    cableway: 'Seilbahn',
    funicular: 'Standseilbahn',
    other: 'Andere',
  },
  fr: {
    international: 'International',
    intercity: 'IC',
    interregio: 'IR',
    'regional-express': 'RE',
    's-bahn': 'RER',
    regional: 'Régional',
    tram: 'Tram',
    metro: 'Métro',
    bus: 'Bus',
    ferry: 'Bateau',
    cableway: 'Téléphérique',
    funicular: 'Funiculaire',
    other: 'Autres',
  },
  it: {
    international: 'Internazionale',
    intercity: 'IC',
    interregio: 'IR',
    'regional-express': 'RE',
    's-bahn': 'Rete celere',
    regional: 'Regionale',
    tram: 'Tram',
    metro: 'Metro',
    bus: 'Bus',
    ferry: 'Battello',
    cableway: 'Funivia',
    funicular: 'Funicolare',
    other: 'Altro',
  },
}

export function resolveUiLanguage(candidates: readonly (string | null | undefined)[]): UiLanguage {
  for (const candidate of candidates) {
    const language = candidate?.trim().toLowerCase().split(/[-_]/)[0]
    if (
      language === 'en' ||
      language === 'de' ||
      language === 'fr' ||
      language === 'it'
    ) {
      return language
    }
  }
  return 'en'
}

export function serviceCategoryLabel(
  language: UiLanguage,
  category: ServiceCategory,
): string {
  return CATEGORY_LABELS[language][category]
}

/** Translate attribution wording without modifying official product or agency names. */
export function sourceCredit(language: UiLanguage, credit: string): string {
  const words = {
    en: ['OpenStreetMap contributors', 'FOT', 'FOEN', 'Source:'],
    de: ['OpenStreetMap-Mitwirkende', 'BAV', 'BAFU', 'Quelle:'],
    fr: ['contributeurs OpenStreetMap', 'OFT', 'OFEV', 'Source :'],
    it: ['collaboratori OpenStreetMap', 'UFT', 'UFAM', 'Fonte:'],
  }[language]
  return credit.replaceAll('OpenStreetMap contributors', words[0]).replace(/\bFOT\b/g, words[1])
    .replace(/\bFOEN\b/g, words[2]).replace(/(?:Quelle|Source):/g, words[3])
}
