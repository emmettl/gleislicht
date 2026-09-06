export interface CorridorTerrain {
  readonly columns: number
  readonly rows: number
  readonly widthMetres: number
  readonly depthMetres: number
  readonly minElevation: number
  readonly maxElevation: number
  readonly elevations: readonly number[]
}

export interface CorridorRouteStop {
  readonly name: string
  readonly progress: number
  readonly departure: number
}

export interface CorridorLake {
  readonly id: string
  readonly name: string
  readonly elevation: number
  readonly rings: readonly (readonly (readonly [number, number])[])[]
}

export interface CorridorTunnel {
  readonly id: string
  readonly name: string
  readonly lengthMetres: number
  readonly line: string
  readonly startProgress: number
  readonly endProgress: number
}

export interface CorridorSnapshot {
  readonly id: string
  readonly metadata: {
    readonly source: string
    readonly releaseDate: string
    readonly sourceUrl: string
    readonly productUrl: string
    readonly attribution: string
    readonly sourceCrs: string
    readonly model: string
    readonly railSource: unknown
    readonly profileSourceUrl: string
    readonly routeSource?: string
    readonly routeAttribution?: string
    readonly routeProductUrl?: string
    readonly tunnelSource?: string
    readonly tunnelSourceUrl?: string
    readonly tunnelProductUrl?: string
  }
  readonly origin: {
    readonly easting: number
    readonly northing: number
  }
  readonly terrain: CorridorTerrain
  readonly route: {
    readonly service: string
    readonly destination: string
    readonly operator: string
    readonly representativeTrain: string
    readonly distanceMetres: number
    readonly points: readonly (readonly [number, number, number])[]
    readonly stops: readonly CorridorRouteStop[]
    readonly tunnels?: readonly CorridorTunnel[]
  }
  readonly lakes: readonly CorridorLake[]
}
