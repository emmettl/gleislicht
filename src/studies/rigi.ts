import type { NetworkTrain } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'

export const rigiOperator = (train: NetworkTrain) => (train as NetworkTrain & { operator?: string }).operator ?? ''

export const RIGI_COPY: Record<UiLanguage, { title: string; select: string; placeholder: string; modes: string; loading: string; unavailable: string; water: string; cable: string }> = {
  en: { title: 'Lake → Rigi', select: 'Explore Lake Lucerne and Rigi', placeholder: 'Rigi Kulm, Vitznau, boats…', modes: '24 hours · boats, cogwheel railways and cableway.', loading: 'Loading Lake Lucerne–Rigi…', unavailable: 'Lake Lucerne–Rigi is unavailable. Choose another study or retry.', water: 'Boat paths modelled within the lake · no GPS', cable: 'Mapped cableway alignment · 2D view' },
  de: { title: 'See → Rigi', select: 'Vierwaldstättersee und Rigi entdecken', placeholder: 'Rigi Kulm, Vitznau, Schiffe…', modes: '24 Stunden · Schiffe, Zahnradbahnen und Luftseilbahn.', loading: 'Vierwaldstättersee–Rigi wird geladen…', unavailable: 'Vierwaldstättersee–Rigi nicht verfügbar. Andere Studie wählen oder erneut versuchen.', water: 'Schiffswege im See modelliert · kein GPS', cable: 'Kartierte Seilbahntrasse · 2D-Ansicht' },
  fr: { title: 'Lac → Rigi', select: 'Explorer le lac des Quatre-Cantons et le Rigi', placeholder: 'Rigi Kulm, Vitznau, bateaux…', modes: '24 heures · bateaux, trains à crémaillère et téléphérique.', loading: 'Chargement du lac et du Rigi…', unavailable: 'Étude lac–Rigi indisponible. Choisissez une autre étude ou réessayez.', water: 'Trajets des bateaux modélisés dans le lac · sans GPS', cable: 'Tracé cartographié du téléphérique · vue 2D' },
  it: { title: 'Lago → Rigi', select: 'Esplora il Lago dei Quattro Cantoni e il Rigi', placeholder: 'Rigi Kulm, Vitznau, battelli…', modes: '24 ore · battelli, ferrovie a cremagliera e funivia.', loading: 'Caricamento del lago e del Rigi…', unavailable: 'Studio lago–Rigi non disponibile. Scegli un altro studio o riprova.', water: 'Percorsi dei battelli modellati nel lago · senza GPS', cable: 'Tracciato cartografato della funivia · vista 2D' },
}
