import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'
import type { AdditionalRegionId } from './additional-regions.ts'

const COPY = {
  en: {
    names: ['Luzern · city, lake and valleys', 'Zug · lake and regional connections', 'Thurgau · rail, buses and lake', 'Fribourg · city and regional connections'],
    modes: ['Selected trains, buses, boats and mountain services', 'Selected trains, buses, boats and funicular journeys', 'Selected trains, buses and boats', 'Selected trains and buses'],
    scope: 'Partial canton coverage · archival timetable', date: 'Timetable date',
    model: 'Timetable movements on mapped and inferred paths. Coverage and geometry are partial; these are not observed vehicle positions.',
    frequency: 'Headway services show representative movements, not exact departures.',
    search: 'Search stations, lines or destinations…', sources: 'Sources and coverage',
  },
  de: {
    names: ['Luzern · Stadt, See und Täler', 'Zug · See und regionale Verbindungen', 'Thurgau · Bahn, Bus und See', 'Fribourg · Stadt und regionale Verbindungen'],
    modes: ['Ausgewählte Bahn-, Bus-, Schiffs- und Bergbahnfahrten', 'Ausgewählte Bahn-, Bus-, Schiffs- und Standseilbahnfahrten', 'Ausgewählte Bahn-, Bus- und Schiffsfahrten', 'Ausgewählte Bahn- und Busfahrten'],
    scope: 'Teilweise Kantonsabdeckung · archivierter Fahrplan', date: 'Fahrplandatum',
    model: 'Fahrplanbewegungen auf kartierten und abgeleiteten Wegen. Abdeckung und Geometrie sind teilweise; keine beobachteten Fahrzeugpositionen.',
    frequency: 'Taktangebote zeigen repräsentative Bewegungen, keine exakten Abfahrten.',
    search: 'Stationen, Linien oder Ziele suchen…', sources: 'Quellen und Abdeckung',
  },
  fr: {
    names: ['Lucerne · ville, lac et vallées', 'Zoug · lac et liaisons régionales', 'Thurgovie · trains, bus et lac', 'Fribourg · ville et liaisons régionales'],
    modes: ['Sélection de trains, bus, bateaux et transports de montagne', 'Sélection de trains, bus, bateaux et funiculaires', 'Sélection de trains, bus et bateaux', 'Sélection de trains et de bus'],
    scope: 'Couverture cantonale partielle · horaire archivé', date: 'Date de l’horaire',
    model: 'Mouvements horaires sur des parcours cartographiés et estimés. Couverture et géométrie partielles ; aucune position de véhicule observée.',
    frequency: 'Les services cadencés montrent des mouvements représentatifs, pas des départs exacts.',
    search: 'Rechercher gares, lignes ou destinations…', sources: 'Sources et couverture',
  },
  it: {
    names: ['Lucerna · città, lago e valli', 'Zugo · lago e collegamenti regionali', 'Turgovia · treni, autobus e lago', 'Friburgo · città e collegamenti regionali'],
    modes: ['Treni, autobus, battelli e trasporti di montagna selezionati', 'Treni, autobus, battelli e funicolari selezionati', 'Treni, autobus e battelli selezionati', 'Treni e autobus selezionati'],
    scope: 'Copertura cantonale parziale · orario archiviato', date: 'Data dell’orario',
    model: 'Movimenti da orario su percorsi cartografati e stimati. Copertura e geometria parziali; nessuna posizione osservata dei veicoli.',
    frequency: 'I servizi a frequenza mostrano movimenti rappresentativi, non partenze esatte.',
    search: 'Cerca stazioni, linee o destinazioni…', sources: 'Fonti e copertura',
  },
} as const

export function additionalRegionCopy(language: UiLanguage, id: AdditionalRegionId) {
  const index = ['luzern-region', 'zug-region', 'thurgau-region', 'fribourg-region'].indexOf(id)
  const copy = COPY[language]
  return { ...copy, name: copy.names[index], modes: copy.modes[index] }
}

// Editorial home framing only. Complete cross-canton journeys remain in the feed.
export const ADDITIONAL_REGION_DETAILS = {
  'luzern-region': { name: 'Luzern', code: 'LU', scale: 0.28, bounds: { minLongitude: 7.82, maxLongitude: 8.60, minLatitude: 46.76, maxLatitude: 47.30 }, credit: 'SBB · © rawi Kanton Luzern · © Verkehrsverbund Luzern · FOT · swisstopo · FOEN · OpenStreetMap contributors · ODbL' },
  'zug-region': { name: 'Zug', code: 'ZG', scale: 0.15, bounds: { minLongitude: 8.38, maxLongitude: 8.72, minLatitude: 47.07, maxLatitude: 47.26 }, credit: 'SBB · Quelle: GIS Kanton Zug · Luzern · FOT · swisstopo · OpenStreetMap contributors · ODbL' },
  'thurgau-region': { name: 'Thurgau', code: 'TG', scale: 0.22, bounds: { minLongitude: 8.66, maxLongitude: 9.57, minLatitude: 47.36, maxLatitude: 47.72 }, credit: 'SBB · Kanton Thurgau · FOT · swisstopo · OpenStreetMap contributors · ODbL' },
  'fribourg-region': { name: 'Fribourg', code: 'FR', scale: 0.28, bounds: { minLongitude: 6.72, maxLongitude: 7.40, minLatitude: 46.42, maxLatitude: 47.01 }, credit: 'SBB · Source: Etat de Fribourg · FOT · swisstopo · OpenStreetMap contributors · ODbL' },
} as const satisfies Record<AdditionalRegionId, { name: string; code: string; scale: number; bounds: NetworkSnapshot['bounds']; credit: string }>
