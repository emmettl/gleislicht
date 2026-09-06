import { describe, expect, it } from 'vitest'
import { nextSearchResultIndex } from './search-navigation.ts'

describe('nextSearchResultIndex', () => {
  it('enters the list in the direction of travel', () => {
    expect(nextSearchResultIndex(-1, 4, 'ArrowDown')).toBe(0)
    expect(nextSearchResultIndex(-1, 4, 'ArrowUp')).toBe(3)
  })

  it('wraps at either end', () => {
    expect(nextSearchResultIndex(3, 4, 'ArrowDown')).toBe(0)
    expect(nextSearchResultIndex(0, 4, 'ArrowUp')).toBe(3)
  })

  it('supports home, end, and empty result sets', () => {
    expect(nextSearchResultIndex(2, 4, 'Home')).toBe(0)
    expect(nextSearchResultIndex(1, 4, 'End')).toBe(3)
    expect(nextSearchResultIndex(0, 0, 'ArrowDown')).toBe(-1)
  })
})
