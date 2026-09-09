import { TICINO_COPY } from './ticino-copy.ts'

export function TicinoDatePicker({language,date,onDate}: {language: keyof typeof TICINO_COPY; date: string; onDate: (date: string) => void}) {
  return <select aria-label={TICINO_COPY[language].date} value={date} onChange={event => onDate(event.target.value)}>
    {['2026-09-04','2026-09-06'].map(value => <option key={value} value={value}>{value}</option>)}
  </select>
}
