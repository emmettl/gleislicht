import { readStudyLink, type StudyLink } from './explore.ts'
export function studyLinkUrl(href: string, state: StudyLink) {
  const url = new URL(href)
  // Never include browser coordinates or other transient query parameters.
  url.search = ''
  url.hash = ''
  if (state.recording) {
    const query = new URLSearchParams({ recording: state.recording })
    if (state.date !== undefined) query.set('date', state.date)
    if (state.time !== undefined) query.set('time', String(state.time))
    state = readStudyLink(query.toString())
    if (state.invalidRecording) throw new Error('Invalid recording link')
    url.searchParams.set('recording', state.recording!)
  }
  url.searchParams.set('study', state.study)
  url.searchParams.set('range', state.range)
  if (state.date) url.searchParams.set('date', state.date)
  if (state.time !== undefined) url.searchParams.set('time', String(Math.floor(state.time)))
  if (state.study === 'territet' && state.glion) url.searchParams.set('glion', state.glion)
  if (state.station) url.searchParams.set('station', state.station)
  if (state.train) url.searchParams.set('train', state.train)
  return url.href
}
