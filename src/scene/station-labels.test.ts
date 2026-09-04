import { describe, expect, it } from 'vitest'
import type { StationIndexEntry } from '../domain/network.ts'
import { rankStationsForLabels, stationLabelBudget } from './station-labels.ts'

const station = (
  name: string,
  calls: number,
  routes: number,
): StationIndexEntry => ({
  name,
  stopIndexes: [0],
  trainIds: Array.from({ length: calls }, (_, index) => `train-${index}`),
  routes: Array.from({ length: routes }, (_, index) => ({
    name: `route-${index}`,
    category: 'regional',
  })),
})

describe('station labels', () => {
  it('reveals more labels as the camera gets closer', () => {
    expect(stationLabelBudget(37)).toBe(8)
    expect(stationLabelBudget(25)).toBe(20)
    expect(stationLabelBudget(18)).toBe(48)
    expect(stationLabelBudget(11)).toBe(96)
  })

  it('prioritises busy and well-connected stations', () => {
    const ranked = rankStationsForLabels([
      station('Small', 3, 2),
      station('Hub', 12, 5),
      station('Interchange', 3, 4),
    ])

    expect(ranked.map(({ name }) => name)).toEqual([
      'Hub',
      'Interchange',
      'Small',
    ])
  })
})
