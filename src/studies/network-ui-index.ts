import type { NetworkTrain } from '@motionstudies/core/domain/network'

export { createActiveTimetableVehicleCounter as createActiveTrainCounter } from '@motionstudies/core/domain/vehicle-counts'

/** This order depends on query/data/language; only active priority depends on time. */
export function orderTrainSearchMatches(trains: readonly NetworkTrain[], locale: string) {
  const collator = new Intl.Collator(locale)
  return [...trains].sort((a, b) => a.start - b.start || collator.compare(a.route, b.route))
}

export function trainSearchResults(ordered: readonly NetworkTrain[], time: number) {
  const active: NetworkTrain[] = [], inactive: NetworkTrain[] = []
  for (const train of ordered) {
    if (train.start <= time && train.end >= time) {
      active.push(train)
      if (active.length === 8) return active
    } else if (inactive.length < 8) inactive.push(train)
  }
  return active.concat(inactive.slice(0, 8 - active.length))
}
