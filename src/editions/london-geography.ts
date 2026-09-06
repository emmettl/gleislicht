import type {
  BoundaryCoordinate,
  MapBoundary,
} from '../domain/boundary.ts'
import type { MapWaterBodies } from '../domain/lakes.ts'

interface LondonGeographyMetadata {
  readonly publisher: string
  readonly sourceUrl: string
  readonly license: string
  readonly licenseUrl: string
  readonly toleranceMetres: number
}

interface PolygonGeometry {
  readonly type: 'Polygon'
  readonly coordinates: readonly (readonly BoundaryCoordinate[])[]
}

interface MultiPolygonGeometry {
  readonly type: 'MultiPolygon'
  readonly coordinates: readonly (readonly (readonly BoundaryCoordinate[])[])[]
}

type AreaGeometry = PolygonGeometry | MultiPolygonGeometry

export interface LondonGeographySnapshot {
  readonly metadata: LondonGeographyMetadata
  readonly boundary: AreaGeometry
  readonly thames: AreaGeometry
}

function polygons(
  geometry: AreaGeometry,
): readonly (readonly (readonly BoundaryCoordinate[])[])[] {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates
}

function sharedMetadata(snapshot: LondonGeographySnapshot) {
  return {
    source: snapshot.metadata.publisher,
    sourceUrl: snapshot.metadata.sourceUrl,
    productUrl: snapshot.metadata.sourceUrl,
    edition: 'All Change · London',
    attribution: `${snapshot.metadata.publisher} · ${snapshot.metadata.license}`,
    sourceCrs: 'EPSG:27700',
    outputCrs: 'EPSG:4326',
    simplificationToleranceMetres: snapshot.metadata.toleranceMetres,
  } as const
}

export function londonBoundary(
  snapshot: LondonGeographySnapshot,
): MapBoundary {
  return {
    metadata: sharedMetadata(snapshot),
    rings: polygons(snapshot.boundary).flat(),
  }
}

export function londonWater(
  snapshot: LondonGeographySnapshot,
): MapWaterBodies {
  return {
    metadata: {
      ...sharedMetadata(snapshot),
      minimumAreaSquareKilometres: 0,
    },
    lakes: [
      {
        id: 'river-thames',
        name: 'River Thames',
        areaSquareKilometres: 0,
        polygons: polygons(snapshot.thames),
      },
    ],
  }
}
