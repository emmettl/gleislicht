export interface AstraMeasurement {
  siteId: string
  measurementTime: string
  lightFlowPerHour?: number
  lightSpeedKmh?: number
  heavyFlowPerHour?: number
  heavySpeedKmh?: number
}

export interface AstraSnapshot {
  metadata: {
    publisher: string
    publicationTime: string
    receivedAt: string
    measurementSiteTableVersion?: number
    measurementKind: 'recorded'
    sourceUrl: string
    recordingScope?: string
    requestedStationCount?: number
    invalidMeasurementValues?: number
  }
  measurements: AstraMeasurement[]
}

export function pullMeasuredData(options: {
  apiKey: string
  siteReferences: readonly string[]
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  now?: Date
}): Promise<{ xml: string; snapshot: AstraSnapshot }>
