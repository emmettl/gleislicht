import type { NetworkSnapshot, NetworkTrain } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'

export interface ServiceFrequency {
  readonly sourceTripId: string
  readonly startTime: number
  readonly endTime: number
  readonly headwaySeconds: number
  readonly exactTimes: 0 | 1
}

export function serviceFrequency(train?: NetworkTrain): ServiceFrequency | undefined {
  return (train as (NetworkTrain & { frequency?: ServiceFrequency }) | undefined)?.frequency
}

export function isHeadwayTrain(train: NetworkTrain): boolean {
  return serviceFrequency(train)?.exactTimes === 0
}

/** Frequency ferries use disclosed straight stop interpolation, not the renderer's
 * land-transport shoreline detour. Supplied paths always take precedence.
 */
export function withFrequencyFerryPaths(snapshot: NetworkSnapshot): NetworkSnapshot {
  if (!snapshot.trains.some(train => train.category === 'ferry' && serviceFrequency(train))) return snapshot
  const paths = [...(snapshot.paths ?? [])]
  const byPair = new Map<string, number>()
  const pair = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`
  const trains = snapshot.trains.map(train => {
    if (train.category !== 'ferry' || !serviceFrequency(train)) return train
    const pathSegments = train.stops.slice(1).map(([to], index) => {
      const supplied = train.pathSegments?.[index]
      if (supplied !== undefined && supplied !== null) return supplied
      const from = train.stops[index][0], key = pair(from, to)
      const existing = byPair.get(key)
      if (existing !== undefined) return existing
      const pathIndex = paths.length
      paths.push([snapshot.stops[from].slice(0, 2) as [number, number], snapshot.stops[to].slice(0, 2) as [number, number]])
      byPair.set(key, pathIndex)
      return pathIndex
    })
    return { ...train, pathSegments }
  })
  return { ...snapshot, trains, paths, edgePaths: snapshot.edges.map(([a, b], i) => snapshot.edgePaths?.[i] ?? byPair.get(pair(a, b)) ?? null) }
}

export const FREQUENCY_COPY: Record<UiLanguage, { label: string; mixed: string; arrival: string; note: string; interpolation: string }> = {
  en: { label: 'Headway model', mixed: 'Includes illustrative headway motion.', arrival: 'Illustrated arrival', note: 'Illustrative motion · published interval', interpolation: 'Schedule + headway model / no GPS' },
  de: { label: 'Taktmodell', mixed: 'Enthält beispielhafte Bewegung nach Takt.', arrival: 'Modellierte Ankunft', note: 'Beispielhafte Bewegung · veröffentlichtes Intervall', interpolation: 'Fahrplan + Taktmodell / kein GPS' },
  fr: { label: 'Modèle de fréquence', mixed: 'Inclut des mouvements illustratifs selon la fréquence.', arrival: 'Arrivée modélisée', note: 'Mouvement illustratif · intervalle publié', interpolation: 'Horaire + modèle de fréquence / sans GPS' },
  it: { label: 'Modello di frequenza', mixed: 'Include movimenti illustrativi basati sulla frequenza.', arrival: 'Arrivo illustrativo', note: 'Movimento illustrativo · intervallo pubblicato', interpolation: 'Orario + modello di frequenza / senza GPS' },
}
