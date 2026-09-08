import { createHash } from 'node:crypto'

// An explicit, pinned station review can use one fully resolved direction to
// confirm its opposing lane. This never changes the general settlement gates.
export function reviewCantonalDirection(station, audit, catalogDetectors, review) {
  if (station.id !== review.stationId || station.match.pathId !== review.pathId || station.match.road !== review.road ||
      createHash('sha256').update(JSON.stringify(audit)).digest('hex') !== review.detectorAuditSha256) throw new Error('Direction review evidence has changed')
  if (review.method !== 'opposing-main-carriageway-lanes' || audit.length !== 2) throw new Error('Unsupported direction review')
  const anchor = audit.find(d => d.id === review.anchorDetectorId)
  const pending = audit.find(d => d.id === review.reviewedDetectorId)
  const records = audit.map(d => catalogDetectors.get(d.id))
  if (!anchor || !pending || anchor.status !== 'validated' || !['positive', 'negative'].includes(anchor.direction) || pending.status !== 'destination-extent-conflict' ||
      !records.every(d => d?.carriageway === 'mainCarriageway' && d.lane === 'lane1') ||
      new Set(records.map(d => d.direction)).size !== 2 || records.some(d => !['positive', 'negative'].includes(d.direction)) ||
      audit.some(d => !d.description?.startsWith('Normalspur Richtung '))) throw new Error('Review requires a validated anchor and two opposing normal lanes')
  const direction = anchor.direction === 'positive' ? 'negative' : 'positive'
  const sign = direction === 'positive' ? 1 : -1
  if (![pending.bearingAgreement, pending.offsetSeparationMetres, pending.destinationDistanceMetres, pending.destinationRoadDistanceMetres].every(Number.isFinite) || pending.bearingAgreement * sign < 0.75 || pending.offsetSeparationMetres * sign < 750 ||
      pending.destinationDistanceMetres < 1500 || pending.destinationRoadDistanceMetres > 1500) throw new Error('Reviewed direction conflicts with road geometry')
  return audit.map(d => d === pending ? {
    ...d, status: 'validated', direction, originalStatus: d.status,
    review: { id: review.id, method: review.method, anchorDetectorId: anchor.id, note: review.rationale },
  } : d)
}
