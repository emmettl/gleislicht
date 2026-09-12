import calendar from './timetable-calendar.json'
import { rolloverUrl, selectTimetableDay, swissDate } from './timetable-calendar.ts'

// An open historical study stays pinned. Only an active Now clock requests a
// new session, preventing a mixture of old topology and new movement chunks.
export function watchTimetableRollover(study: string, active: () => boolean) {
  if (!calendar.days.length || !['national', 'postbus', 'zurich-city', 'zvv-region', 'geneva-tpg', 'lausanne-region'].includes(study)) return
  const openedDate = new URL(location.href).searchParams.get('date') ?? document.documentElement.dataset.timetableDate ?? swissDate()
  const check = () => {
    const date = swissDate()
    if (active() && date !== openedDate && selectTimetableDay(calendar, date)) location.replace(rolloverUrl(location.href, study))
  }
  const timer = window.setInterval(check, 15_000)
  document.addEventListener('visibilitychange', check)
  check()
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check) }
}
