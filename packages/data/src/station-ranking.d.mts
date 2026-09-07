import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
export interface StationRank {
  name: string
  labelRank: number
  modeCount: number
  routeCount: number
  movementCount: number
  neighbourCount: number
  score: number
}
export interface RankingOptions {
  catalogue?: { lines?: readonly {
    mode: string
    name: string
    directions?: readonly { branches: readonly { stopIds?: readonly string[] }[] }[]
  }[] }
}
export function rankNetworkStations(snapshot: NetworkSnapshot, options?: RankingOptions): StationRank[]
export function applyStationLabelRanks(snapshot: NetworkSnapshot, options?: RankingOptions): NetworkSnapshot
