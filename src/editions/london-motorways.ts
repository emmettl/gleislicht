import motorwayCatalogue from '../../fixtures/tfl/all-change-motorways.json'
import type { RoadSearchCorridor } from '../road-search.ts'

export interface LondonMotorway extends RoadSearchCorridor {
  readonly bounds: {
    readonly minLongitude: number
    readonly maxLongitude: number
    readonly minLatitude: number
    readonly maxLatitude: number
  }
  readonly sampleSpacingChainage: number
  readonly maximumChainage?: number
  readonly closed: boolean
}

export const LONDON_MOTORWAYS: readonly LondonMotorway[] =
  motorwayCatalogue.map((motorway) => ({
    ...motorway,
    focus: [motorway.focus[0], motorway.focus[1]] as const,
  }))
