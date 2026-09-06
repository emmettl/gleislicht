import type { BoundaryCoordinate } from './boundary.ts'

export interface MapWaterBody {
  readonly id: string
  readonly name: string
  readonly areaSquareKilometres: number
  readonly polygons: readonly (readonly (readonly BoundaryCoordinate[])[])[]
}

export interface MapWaterBodies {
  readonly metadata: {
    readonly source: string
    readonly sourceUrl: string
    readonly productUrl: string
    readonly edition: string
    readonly attribution: string
    readonly sourceCrs: string
    readonly outputCrs: string
    readonly simplificationToleranceMetres: number
    readonly minimumAreaSquareKilometres: number
  }
  readonly lakes: readonly MapWaterBody[]
}
