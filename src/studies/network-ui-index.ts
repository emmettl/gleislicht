import type { NetworkTrain } from '@motionstudies/core/domain/network'

/** Count inclusive timetable intervals without scanning every trip per clock tick. */
export function createActiveTrainCounter(trains: readonly NetworkTrain[]) {
  const starts: number[] = [], ends: number[] = []
  for (const train of trains) {
    if (train.realtime?.status === 'cancelled' || !(train.start <= train.end)) continue
    starts.push(train.start)
    ends.push(train.end)
  }
  starts.sort((a, b) => a - b)
  ends.sort((a, b) => a - b)
  const before = (values: number[], time: number, inclusive: boolean) => {
    let low = 0, high = values.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (values[middle] < time || inclusive && values[middle] === time) low = middle + 1
      else high = middle
    }
    return low
  }
  return (time: number) => before(starts, time, true) - before(ends, time, false)
}

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
