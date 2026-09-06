import { describe, expect, it } from 'vitest'
import { adjacentUtcPartitions, previousZurichDate } from './export-astra-r2.mjs'

describe('ASTRA R2 export dates', () => {
  it('covers both UTC partitions that can contain a Swiss civil day', () => {
    expect(adjacentUtcPartitions('2026-09-06')).toEqual([
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
    ])
  })

  it('defaults to the last complete date in Zürich', () => {
    expect(previousZurichDate(new Date('2026-09-07T00:30:00Z'))).toBe('2026-09-06')
  })
})
