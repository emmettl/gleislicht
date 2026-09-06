import type { BoundaryCoordinate } from './boundary.ts'

export interface MapReferencePath {
  readonly id: string
  readonly name: string
  readonly color?: string
  readonly paths: readonly (readonly BoundaryCoordinate[])[]
}

export interface MapReferencePaths {
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
  readonly references: readonly MapReferencePath[]
}
