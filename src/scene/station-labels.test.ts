import { describe, expect, it } from 'vitest'
import type { StationIndexEntry } from '../domain/network.ts'
import {
  rankStationsForLabels,
  stationLabelCameraHeight,
  stationLabelBudget,
  stationLabelRankLimit,
  stationLabelText,
} from './station-labels.ts'

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

  it('starts Zürich with a denser but still progressive label hierarchy', () => {
    const homeHeight = stationLabelCameraHeight(37 * 0.06, 'zurich')
    const closeHeight = stationLabelCameraHeight(37 * 0.022, 'zurich')

    expect(stationLabelBudget(homeHeight)).toBe(20)
    expect(stationLabelBudget(closeHeight)).toBe(96)
    expect(stationLabelRankLimit(closeHeight)).toBe(Number.POSITIVE_INFINITY)
  })

  it('removes redundant Zürich prefixes from local labels', () => {
    expect(stationLabelText('Zürich, Bellevue', 'zurich')).toBe('Bellevue')
    expect(stationLabelText('Zürich Altstetten, Bahnhof', 'zurich')).toBe(
      'Altstetten, Bahnhof',
    )
    expect(stationLabelText('Zürich HB', 'zurich')).toBe('Zürich HB')
    expect(stationLabelText('Zürich, Bellevue', 'switzerland')).toBe(
      'Zürich, Bellevue',
    )
  })

  it('admits every local station at the new close zoom levels', () => {
    expect(stationLabelRankLimit(14)).toBe(96)
    expect(stationLabelRankLimit(13)).toBe(Number.POSITIVE_INFINITY)
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
