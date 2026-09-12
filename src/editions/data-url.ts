import calendar from './timetable-calendar.json'
import { selectTimetableDay, swissDate, timetableFile } from './timetable-calendar.ts'
import { createDataUrlResolver } from '@motionstudies/web/data-url'
// Vite validates and embeds the root at build time; isolated unit tests use fixtures.
const baseDataUrl = createDataUrlResolver(
  import.meta.env.VITE_GLEISLICHT_RESOLVED_DATA_URL ?? `${import.meta.env.BASE_URL}data/`,
)

const sessionDate = typeof window === 'undefined' ? swissDate() : new URLSearchParams(window.location.search).get('date') ?? swissDate()
const day = selectTimetableDay(calendar, sessionDate)
if (typeof document !== 'undefined') document.documentElement.dataset.timetableDate = sessionDate
export const editionDataUrl = (fileName: string) => baseDataUrl(day && timetableFile(fileName) ? day.prefix + fileName : fileName)
