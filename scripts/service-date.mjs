import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

export function serviceDate(input, now = new Date()) {
  const date = input || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Invalid service date')
  const year = Number(date.slice(0, 4))
  const december = new Date(Date.UTC(year, 11, 1))
  const changeDay = 8 + (7 - december.getUTCDay()) % 7
  const changeDate = `${year}-12-${String(changeDay).padStart(2, '0')}`
  return { date, timetableYear: year + (date >= changeDate ? 1 : 0) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { date, timetableYear } = serviceDate(process.argv[2])
  console.log(`service_date=${date}\ntimetable_year=${timetableYear}`)
}
