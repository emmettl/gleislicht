// Completeness is per lane and vehicle class, before aggregating directions.
// A zero flow may legitimately have no mean speed; a positive flow may not.
export function cantonalMeasurementIssues(measurement) {
  if (!measurement) return ['missing-detector']
  return ['light', 'heavy'].flatMap(kind => {
    const flow = measurement[`${kind}FlowPerHour`]
    const speed = measurement[`${kind}SpeedKmh`]
    if (!Number.isFinite(flow) || flow < 0) return [`${kind}-flow-missing-or-invalid`]
    if (flow === 0 && speed === undefined) return []
    if (!Number.isFinite(speed) || speed < 0 || (flow > 0 && speed === 0)) return [`${kind}-speed-missing-or-invalid`]
    return []
  })
}
