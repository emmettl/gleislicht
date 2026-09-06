export type BoundaryCoordinate = readonly [longitude: number, latitude: number]

export interface MapBoundary {
  readonly metadata: {
    readonly source: string
    readonly sourceUrl: string
    readonly productUrl: string
    readonly edition: string
    readonly attribution: string
    readonly sourceCrs: string
    readonly outputCrs: string
    readonly simplificationToleranceMetres: number
  }
  readonly rings: readonly (readonly BoundaryCoordinate[])[]
}
