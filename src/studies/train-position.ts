import { positionForTrain as linearPositionForTrain, type NetworkTrain, type TrainPosition } from '@motionstudies/core/domain/network'

// Timetables are immutable. A replacement stop array (including realtime edits)
// gets its own validation; old schedules can be garbage collected.
const chronologicalSchedules = new WeakMap<NetworkTrain['stops'], boolean>()

export function positionForTrain(train: NetworkTrain, time: number): TrainPosition | undefined {
  if (train.realtime?.status === 'cancelled' || time < train.start || time > train.end || train.stops.length < 2) return
  const stops = train.stops
  let chronological = chronologicalSchedules.get(stops)
  if (chronological === undefined) {
    chronological = stops.every((stop, index) => Number.isFinite(stop[1]) && Number.isFinite(stop[2]) &&
      stop[2] >= stop[1] && (index === 0 || stop[1] >= stops[index - 1][2]))
    chronologicalSchedules.set(stops, chronological)
  }
  // Preserve the pinned renderer's handling of unusual source timetables.
  if (!chronological || !Number.isFinite(time)) return linearPositionForTrain(train, time)
  let lower = 0
  let upper = stops.length
  while (lower < upper) {
    const middle = (lower + upper) >>> 1
    if (stops[middle][2] < time) lower = middle + 1
    else upper = middle
  }
  const next = stops[Math.min(lower, stops.length - 1)]
  if (lower === 0 || lower === stops.length || time > next[1]) {
    return { fromStop: next[0], toStop: next[0], progress: 0 }
  }
  const previous = stops[lower - 1]
  return {
    fromStop: previous[0], toStop: next[0],
    progress: Math.min(1, Math.max(0, (time - previous[2]) / Math.max(1, next[1] - previous[2]))),
    segmentIndex: lower - 1,
  }
}
