import type {
  BoundaryCoordinate,
  MapBoundary,
} from '../domain/boundary.ts'
import type { MapWaterBodies } from '../domain/lakes.ts'
import type { MapReferencePaths } from '../domain/map-reference.ts'

interface ParisGeographyLayer {
  readonly publisher: string
  readonly sourceUrl: string
  readonly productUrl: string
  readonly attribution: string
  readonly license?: string
  readonly licenseUrl?: string
}

export interface ParisGeographySnapshot {
  readonly metadata: {
    readonly retrievedAt: string
    readonly model: string
    readonly toleranceMetres: number
    readonly layers: {
      readonly boundary: ParisGeographyLayer
      readonly water: ParisGeographyLayer
      readonly peripherique: ParisGeographyLayer
    }
  }
  readonly boundary: readonly (readonly (readonly BoundaryCoordinate[])[])[]
  readonly water: readonly {
    readonly id: string
    readonly name: string
    readonly polygons: readonly (readonly (readonly BoundaryCoordinate[])[])[]
  }[]
  readonly references: readonly {
    readonly id: string
    readonly name: string
    readonly color?: string
    readonly paths: readonly (readonly BoundaryCoordinate[])[]
  }[]
}

export function parisReferences(
  snapshot: ParisGeographySnapshot,
): MapReferencePaths {
  const layer = snapshot.metadata.layers.peripherique
  return {
    metadata: {
      source: layer.publisher,
      sourceUrl: layer.sourceUrl,
      productUrl: layer.productUrl,
      edition: 'Correspondances · Paris',
      attribution: `${layer.attribution} · ${layer.license ?? 'ODbL'}`,
      sourceCrs: 'EPSG:4326',
      outputCrs: 'EPSG:4326',
      simplificationToleranceMetres: snapshot.metadata.toleranceMetres,
    },
    references: snapshot.references,
  }
}

export function parisBoundary(snapshot: ParisGeographySnapshot): MapBoundary {
  const layer = snapshot.metadata.layers.boundary
  return {
    metadata: {
      source: layer.publisher,
      sourceUrl: layer.sourceUrl,
      productUrl: layer.productUrl,
      edition: 'Correspondances · Paris',
      attribution: layer.attribution,
      sourceCrs: 'EPSG:4326',
      outputCrs: 'EPSG:4326',
      simplificationToleranceMetres: snapshot.metadata.toleranceMetres,
    },
    rings: snapshot.boundary.flatMap((polygon) => polygon.slice(0, 1)),
  }
}

export function parisWater(snapshot: ParisGeographySnapshot): MapWaterBodies {
  const layer = snapshot.metadata.layers.water
  return {
    metadata: {
      source: layer.publisher,
      sourceUrl: layer.sourceUrl,
      productUrl: layer.productUrl,
      edition: 'Correspondances · Paris',
      attribution: `${layer.attribution} · ${layer.license ?? 'ODbL'}`,
      sourceCrs: 'EPSG:4326',
      outputCrs: 'EPSG:4326',
      simplificationToleranceMetres: snapshot.metadata.toleranceMetres,
      minimumAreaSquareKilometres: 0,
    },
    lakes: snapshot.water.map((body) => ({
      ...body,
      areaSquareKilometres: 0,
    })),
  }
}
