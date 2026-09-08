import type { StudyLink } from './explore.ts'
export function studyLinkUrl(href: string, state: StudyLink) {
  const url = new URL(href)
  // Never include browser coordinates or other transient query parameters.
  url.search = ''
  url.hash = ''
  url.searchParams.set('study', state.study)
  url.searchParams.set('range', state.range)
  if (state.date) url.searchParams.set('date', state.date)
  if (state.time !== undefined) url.searchParams.set('time', String(Math.floor(state.time)))
  if (state.station) url.searchParams.set('station', state.station)
  if (state.train) url.searchParams.set('train', state.train)
  return url.href
}
