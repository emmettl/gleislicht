export interface ObservedStopPrediction {
  readonly stopId: string
  readonly stopName: string
  readonly platformName?: string
  readonly expectedArrival: string
  readonly secondsToStop: number
}

export interface ObservedTransitVehicle {
  readonly id: string
  readonly lineId: string
  readonly lineName: string
  readonly modeName?: string
  readonly destinationStopId?: string
  readonly destinationName?: string
  readonly direction?: string
  readonly currentLocation?: string
  readonly towards?: string
  readonly observedAt: string
  readonly predictions: readonly ObservedStopPrediction[]
}

export interface ObservedLineStatus {
  readonly lineId: string
  readonly lineName: string
  readonly severity: number
  readonly severityDescription: string
  readonly reason?: string
}

export interface TransitOperationsSnapshot {
  readonly metadata: {
    readonly kind: 'observed-operations'
    readonly publisher: string
    readonly sourceUrl: string
    readonly collectedAt: string
    readonly scheduledAt: string
    readonly lineIds: readonly string[]
    readonly model: string
  }
  readonly vehicles: readonly ObservedTransitVehicle[]
  readonly lineStatuses: readonly ObservedLineStatus[]
}
