import type { HubDefinition } from '../domain/hub.ts'

export type LondonHubId = 'kings-cross' | 'bank' | 'waterloo' | 'stratford'

/** Contrasting interchanges, chosen for network character rather than rank. */
export const LONDON_HUBS: readonly HubDefinition<LondonHubId>[] = [
  {
    id: 'kings-cross',
    name: "King's Cross St. Pancras",
    displayName: "King's Cross",
    character: 'national gateway / radial interchange',
  },
  {
    id: 'bank',
    name: 'Bank',
    displayName: 'Bank',
    character: 'deep interchange / City pressure',
  },
  {
    id: 'waterloo',
    name: 'Waterloo',
    displayName: 'Waterloo',
    character: 'terminus / south-bank exchange',
  },
  {
    id: 'stratford',
    name: 'Stratford',
    displayName: 'Stratford',
    character: 'orbital meeting radial',
  },
]
