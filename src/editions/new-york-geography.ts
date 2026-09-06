import type {
  BoundaryCoordinate,
  MapBoundary,
} from '../domain/boundary.ts'
import type { MapWaterBodies } from '../domain/lakes.ts'

export interface NewYorkGeographySnapshot {
  readonly metadata: {
    readonly publisher: string
    readonly sourceUrl: string
    readonly license: string
    readonly licenseUrl: string
    readonly retrievedAt: string
    readonly model: string
    readonly simplificationToleranceMetres: number
  }
  readonly boundary: readonly (readonly BoundaryCoordinate[])[]
  readonly water: readonly {
    readonly id: string
    readonly name: string
    readonly polygons: readonly (readonly (readonly BoundaryCoordinate[])[])[]
  }[]
}

function sharedMetadata(snapshot: NewYorkGeographySnapshot) {
  return {
    source: snapshot.metadata.publisher,
    sourceUrl: snapshot.metadata.sourceUrl,
    productUrl: snapshot.metadata.sourceUrl,
    edition: 'Local / Express · New York',
    attribution: `${snapshot.metadata.publisher} · ${snapshot.metadata.license}`,
    sourceCrs: 'EPSG:4326',
    outputCrs: 'EPSG:4326',
    simplificationToleranceMetres:
      snapshot.metadata.simplificationToleranceMetres,
  } as const
}

export function newYorkBoundary(
  snapshot: NewYorkGeographySnapshot,
): MapBoundary {
  return {
    metadata: sharedMetadata(snapshot),
    rings: snapshot.boundary,
  }
}

export function newYorkWater(
  snapshot: NewYorkGeographySnapshot,
): MapWaterBodies {
  return {
    metadata: {
      ...sharedMetadata(snapshot),
      minimumAreaSquareKilometres: 0,
    },
    lakes: snapshot.water.map((water) => ({
      ...water,
      areaSquareKilometres: 0,
    })),
  }
}
