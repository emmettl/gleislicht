export type SearchNavigationKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'

export function nextSearchResultIndex(
  currentIndex: number,
  resultCount: number,
  key: SearchNavigationKey,
): number {
  if (resultCount <= 0) return -1
  if (key === 'Home') return 0
  if (key === 'End') return resultCount - 1
  if (key === 'ArrowDown') {
    return currentIndex < 0 ? 0 : (currentIndex + 1) % resultCount
  }
  return currentIndex < 0
    ? resultCount - 1
    : (currentIndex - 1 + resultCount) % resultCount
}
