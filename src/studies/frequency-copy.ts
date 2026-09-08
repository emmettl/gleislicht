import type { UiLanguage } from '../i18n.ts'
export const FREQUENCY_COPY: Record<UiLanguage, { label: string; mixed: string; arrival: string; note: string; interpolation: string }> = {
  en: { label: 'Headway model', mixed: 'Includes illustrative headway motion.', arrival: 'Illustrated arrival', note: 'Illustrative motion · published interval', interpolation: 'Schedule + headway model / no GPS' },
  de: { label: 'Taktmodell', mixed: 'Enthält beispielhafte Bewegung nach Takt.', arrival: 'Modellierte Ankunft', note: 'Beispielhafte Bewegung · veröffentlichtes Intervall', interpolation: 'Fahrplan + Taktmodell / kein GPS' },
  fr: { label: 'Modèle de fréquence', mixed: 'Inclut des mouvements illustratifs selon la fréquence.', arrival: 'Arrivée modélisée', note: 'Mouvement illustratif · intervalle publié', interpolation: 'Horaire + modèle de fréquence / sans GPS' },
  it: { label: 'Modello di frequenza', mixed: 'Include movimenti illustrativi basati sulla frequenza.', arrival: 'Arrivo illustrativo', note: 'Movimento illustrativo · intervallo pubblicato', interpolation: 'Orario + modello di frequenza / senza GPS' },
}
