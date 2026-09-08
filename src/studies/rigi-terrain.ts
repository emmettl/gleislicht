import type { UiLanguage } from '../i18n.ts'

const RIGI_TERRAIN_COPY: Record<UiLanguage, { enter: string; unavailable: string }> = {
  en: { unavailable: 'Rigi terrain unavailable. Select the ascent again to retry, or choose another journey.', enter: 'Climb {origin} → Rigi Kulm' },
  de: { unavailable: 'Rigi-Gelände nicht verfügbar. Aufstieg erneut wählen oder eine andere Reise öffnen.', enter: 'Aufstieg {origin} → Rigi Kulm' },
  fr: { unavailable: 'Relief du Rigi indisponible. Sélectionnez à nouveau la montée pour réessayer ou un autre parcours.', enter: 'Monter de {origin} → Rigi Kulm' },
  it: { unavailable: 'Terreno del Rigi non disponibile. Seleziona di nuovo la salita per riprovare o un altro percorso.', enter: 'Salita {origin} → Rigi Kulm' },
}

export function rigiTerrainCopy(language: UiLanguage, origin = 'Vitznau') {
  const copy = RIGI_TERRAIN_COPY[language]
  return { ...copy, enter: copy.enter.replace('{origin}', origin) }
}
