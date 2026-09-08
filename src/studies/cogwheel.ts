import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'

export const COGWHEEL_ROUTE_COLORS = { 'category:other': '#fff3a6' } as const

export interface CogwheelCatalogue {
  readonly metadata: { readonly feedVersion: string; readonly serviceDate: string }
  readonly routes: Readonly<Record<string, { readonly id: string; readonly name: string; readonly operator: string; readonly agencyId: string; readonly routeType: number; readonly routeDescription: string }>>
  readonly trips: Readonly<Record<string, string>>
}

export const COGWHEEL_COPY: Record<UiLanguage, { label: string; description: string; loading: string; unavailable: string; placeholder: string }> = {
  en: { label: 'Cogwheel', description: 'Cogwheel railways · scheduled services. Choose 24H for the full day.', loading: 'Loading cogwheel railways…', unavailable: 'Cogwheel catalogue unavailable for this timetable. Clear the filter to explore all trains.', placeholder: 'Find Rigi, Gornergrat or an operator…' },
  de: { label: 'Zahnrad', description: 'Zahnradbahnen · Fahrplanfahrten. Für den ganzen Tag 24H wählen.', loading: 'Zahnradbahnen werden geladen…', unavailable: 'Zahnradbahn-Katalog für diesen Fahrplan nicht verfügbar. Filter aufheben, um alle Züge zu erkunden.', placeholder: 'Rigi, Gornergrat oder Betreiber suchen…' },
  fr: { label: 'Crémaillère', description: 'Chemins de fer à crémaillère · services prévus. Choisir 24H pour la journée entière.', loading: 'Chargement des chemins de fer à crémaillère…', unavailable: 'Catalogue à crémaillère indisponible pour cet horaire. Retirer le filtre pour explorer tous les trains.', placeholder: 'Rechercher Rigi, Gornergrat ou un opérateur…' },
  it: { label: 'Cremagliera', description: 'Ferrovie a cremagliera · corse previste. Scegliere 24H per la giornata intera.', loading: 'Caricamento delle ferrovie a cremagliera…', unavailable: 'Catalogo delle cremagliere non disponibile per questo orario. Rimuovere il filtro per esplorare tutti i treni.', placeholder: 'Cerca Rigi, Gornergrat o un operatore…' },
}

export function compatibleCogwheelCatalogue(value: unknown, metadata: Pick<NetworkSnapshot['metadata'], 'feedVersion' | 'serviceDate'>): value is CogwheelCatalogue {
  if (!value || typeof value !== 'object') return false
  const catalogue = value as CogwheelCatalogue
  return catalogue.metadata?.feedVersion === metadata.feedVersion &&
    catalogue.metadata?.serviceDate === metadata.serviceDate &&
    Boolean(catalogue.routes && typeof catalogue.routes === 'object' && !Array.isArray(catalogue.routes) && catalogue.trips && typeof catalogue.trips === 'object' && !Array.isArray(catalogue.trips)) &&
    Object.entries(catalogue.routes).every(([id, route]) => route?.id === id && route.routeType === 116 && typeof route.operator === 'string' && typeof route.name === 'string') &&
    Object.values(catalogue.trips).every(id => typeof id === 'string' && Object.hasOwn(catalogue.routes, id))
}

/** Compact stops so unrelated station lights disappear; retain shared path indices. */
export function cogwheelNetwork(snapshot: NetworkSnapshot, catalogue?: CogwheelCatalogue): NetworkSnapshot {
  const trains = catalogue ? snapshot.trains.filter(train => Object.hasOwn(catalogue.trips, train.id)) : []
  const pairs = new Set<string>()
  for (const train of trains) for (let i = 1; i < train.stops.length; i++) {
    const a = train.stops[i - 1][0], b = train.stops[i][0]
    pairs.add(a < b ? `${a}:${b}` : `${b}:${a}`)
  }
  const indexes = snapshot.edges.flatMap(([a, b], i) => pairs.has(a < b ? `${a}:${b}` : `${b}:${a}`) ? [i] : [])
  const stopIds = [...new Set(trains.flatMap(train => train.stops.map(([index]) => index)))].sort((a, b) => a - b)
  const remap = new Map(stopIds.map((index, i) => [index, i]))
  return {
    ...snapshot,
    stops: stopIds.map(index => snapshot.stops[index]),
    trains: trains.map(train => ({ ...train, stops: train.stops.map(([index, arrival, departure]) => [remap.get(index)!, arrival, departure] as const) })),
    edges: indexes.map(i => [remap.get(snapshot.edges[i][0])!, remap.get(snapshot.edges[i][1])!] as const),
    edgePaths: snapshot.edgePaths ? indexes.map(i => snapshot.edgePaths![i]) : undefined,
  }
}
