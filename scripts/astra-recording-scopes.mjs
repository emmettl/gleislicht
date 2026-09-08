import { validateMeasuredData } from './astra-measured-data.mjs'

export const RECORDING_OUTPUTS = {
  'a1-zurich': 'recordings/astra',
  national: 'recordings/astra-national',
  'zurich-cantonal': 'recordings/astra-zurich-cantonal',
}

export function validateRecordingScope(scope) {
  if (!Object.hasOwn(RECORDING_OUTPUTS, scope)) throw new Error(`Unknown recording scope: ${scope}`)
  return scope
}

export function cantonalSiteReferences(catalog) {
  if (catalog?.metadata?.supplier !== 'ZH.CH' || catalog.metadata.recordingScope !== 'zurich-cantonal') {
    throw new Error('Expected a Zürich cantonal counter catalog')
  }
  const ids = catalog.stations.map(({ id }) => id)
  if (!ids.length || ids.some((id) => !/^ZH\.CH:[\w-]+$/.test(id))) {
    throw new Error('Cantonal catalog contains no stations or invalid station IDs')
  }
  return [...new Set(ids)].sort().map((id) => `${id}/#`)
}

// Split a combined upstream response before archiving: a fresh federal minute must
// never make an old cantonal minute appear current, or leak into its archive.
export function scopedRecordedSnapshot(snapshot, scope, siteReferences, catalog) {
  validateRecordingScope(scope)
  const stationIds = new Set(siteReferences.map((id) => id.replace(/\/#$/, '')))
  const measurements = snapshot.measurements.filter(({ siteId }) => stationIds.has(siteId.replace(/[./]\d+$/, '')))
  if (!measurements.length) throw new Error(`No requested detector measurements for ${scope}`)
  const newestTime = measurements.map(({ measurementTime }) => measurementTime).sort().at(-1)
  const current = measurements.filter(({ measurementTime }) => measurementTime === newestTime)
  const currentStations = new Set(current.map(({ siteId }) => siteId.replace(/[./]\d+$/, '')))
  const complete = current.filter((measurement) =>
    ['light', 'heavy'].every((kind) => Number.isFinite(measurement[`${kind}FlowPerHour`]) &&
      (measurement[`${kind}FlowPerHour`] === 0 || Number.isFinite(measurement[`${kind}SpeedKmh`]))),
  )
  const isCantonal = scope === 'zurich-cantonal'
  if (isCantonal) cantonalSiteReferences(catalog)
  return validateMeasuredData({
    metadata: {
      ...snapshot.metadata,
      ...(isCantonal ? { publisher: catalog.metadata.publisher, supplier: catalog.metadata.supplier } : {}),
      recordingScope: scope,
      requestedStationCount: stationIds.size,
      coverage: {
        measurementTime: newestTime,
        reportingStations: currentStations.size,
        reportingStationFraction: currentStations.size / stationIds.size,
        reportingDetectors: current.length,
        completeDetectors: complete.length,
        olderDetectorMeasurements: measurements.length - current.length,
      },
      ...(isCantonal ? {
        counterCatalogSha256: catalog.metadata.sourceSha256,
        counterCatalogTableVersion: catalog.metadata.measurementSiteTableVersion,
        counterCatalogVersionMatches: catalog.metadata.measurementSiteTableVersion === snapshot.metadata.measurementSiteTableVersion,
        requestedDetectorCount: catalog.detectors.length,
        unlistedDetectorIds: measurements.filter(({ siteId }) => !catalog.detectors.some(({ id }) => id === siteId)).map(({ siteId }) => siteId),
      } : {}),
    },
    measurements,
  })
}
