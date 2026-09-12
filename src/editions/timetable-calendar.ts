export interface TimetableDay { date: string; feedVersion: string; prefix: string; indexSha256: string }
export interface TimetableCalendar { schemaVersion: number; days: readonly TimetableDay[] }
export const swissDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
export function selectTimetableDay(calendar: TimetableCalendar, date: string) {
  return calendar.days.find(day => day.date === date)
}
export function timetableFile(path: string) {
  return /^(?:swiss-(?:rail|hub|cogwheel)|postbus-national|zurich-city|zvv-region|geneva-tpg|lausanne-region)(?:[-/]|\.)/.test(path)
}
export function rolloverUrl(current: string, study: string) {
  const url = new URL(current)
  url.search = ''
  url.searchParams.set('study', study)
  url.searchParams.set('range', 'day')
  url.searchParams.set('now', '1')
  url.hash = ''
  return url.toString()
}
