import type { NetworkSnapshot } from '../domain/network.ts'

export interface EdgeTrafficWeights {
  readonly counts: readonly number[]
  readonly strengths: readonly number[]
  readonly referenceCount: number
}

function sectionKey(
  snapshot: NetworkSnapshot,
  firstStopIndex: number,
  secondStopIndex: number,
): string | undefined {
  const firstName = snapshot.stops[firstStopIndex]?.[2]
  const secondName = snapshot.stops[secondStopIndex]?.[2]
  if (!firstName || !secondName) return undefined
  return firstName < secondName
    ? `${firstName}\u0000${secondName}`
    : `${secondName}\u0000${firstName}`
}

export function edgeTrafficWeights(
  snapshot: NetworkSnapshot,
): EdgeTrafficWeights {
  const sectionCounts = new Map<string, number>()

  for (const train of snapshot.trains) {
    for (let index = 1; index < train.stops.length; index += 1) {
      const key = sectionKey(
        snapshot,
        train.stops[index - 1][0],
        train.stops[index][0],
      )
      if (key) sectionCounts.set(key, (sectionCounts.get(key) ?? 0) + 1)
    }
  }

  const counts = snapshot.edges.map(([fromIndex, toIndex]) => {
    const key = sectionKey(snapshot, fromIndex, toIndex)
    return key ? (sectionCounts.get(key) ?? 0) : 0
  })
  const positiveCounts = counts.filter((count) => count > 0).sort((a, b) => a - b)
  const referenceCount = positiveCounts.length
    ? positiveCounts[Math.ceil((positiveCounts.length - 1) * 0.95)]
    : 0
  const denominator = Math.log1p(referenceCount)
  const strengths = counts.map((count) =>
    count && denominator
      ? Math.min(1, Math.log1p(count) / denominator)
      : 0,
  )

  return { counts, strengths, referenceCount }
}
