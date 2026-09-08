import type { NetworkSnapshot, NetworkTrain } from '@motionstudies/core/domain/network'

export type RigiRhythmGroup = 'boats' | 'vitznau' | 'arth' | 'cable'
export type RigiRhythmLane = { id: RigiRhythmGroup; trains: NetworkTrain[]; intervals: [number, number][] }

// Audited route identities from the dated Rigi fixture; route 88 includes the
// early partial Vitznau–Staffelhöhe services, which must not disappear overnight.
type SourceTrain = NetworkTrain & { agencyId?: string; routeType?: number; routeId?: string; frequency?: unknown }
const groups: Record<RigiRhythmGroup, (train: SourceTrain) => boolean> = {
  boats: t => t.agencyId === '185' && t.routeType === 1000,
  vitznau: t => t.agencyId === '137' && t.routeType === 116 && ['93-82-j26-1', '93-88-j26-1'].includes(t.routeId ?? ''),
  arth: t => t.agencyId === '137' && t.routeType === 116 && t.routeId === '93-81-j26-1',
  cable: t => t.agencyId === '13700' && t.routeType === 1300,
}
export function rigiDayRhythm(network: NetworkSnapshot): RigiRhythmLane[] {
  const { windowStart, windowEnd } = network.metadata
  return (Object.keys(groups) as RigiRhythmGroup[]).map(id => {
    const trains = network.trains.filter(t => groups[id](t) && !(t as SourceTrain).frequency && Number.isFinite(t.start) && Number.isFinite(t.end) && t.end > t.start && t.end > windowStart && t.start < windowEnd).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
    const intervals: [number, number][] = []
    for (const train of trains) {
      const start = Math.max(windowStart, train.start), end = Math.min(windowEnd, train.end), previous = intervals.at(-1)
      if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end)
      else intervals.push([start, end])
    }
    return { id, trains, intervals }
  })
}
export function rigiRhythmAt(lane: RigiRhythmLane, time: number, windowEnd: number) {
  return {
    active: time < windowEnd ? lane.trains.filter(t => t.start <= time && time < t.end).length : 0,
    next: lane.trains.find(t => t.start > time && t.start < windowEnd),
  }
}
