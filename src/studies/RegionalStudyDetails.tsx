import type { UiLanguage } from '../i18n.ts'
import { REGIONAL_FIXTURE_DATES, type AdditionalRegionId } from './additional-regions.ts'
import { additionalRegionCopy, ADDITIONAL_REGION_DETAILS } from './additional-regions-copy.ts'

export function RegionalDatePicker({ label, date, onDate }: { label: string; date: string; onDate: (date: string) => void }) {
  return <select aria-label={label} value={date} onChange={event => onDate(event.target.value)}>
    {REGIONAL_FIXTURE_DATES.map(value => <option key={value} value={value}>{value}</option>)}
  </select>
}

export function RegionalStudyDetails({ id, language, date, serviceDate, headway, sourcesUrl, onDate }: {
  id: AdditionalRegionId; language: UiLanguage; date: string; serviceDate?: string; headway: boolean; sourcesUrl: string; onDate: (date: string) => void
}) {
  const copy = additionalRegionCopy(language, id), region = ADDITIONAL_REGION_DETAILS[id]
  return <>
    <div className="explore-actions"><RegionalDatePicker label={`${region.name} ${copy.date}`} date={date} onDate={onDate} /></div>
    <p className="explore-status">{copy.scope} · {serviceDate}{headway ? ` · ${copy.frequency}` : ''}</p>
    <a className="explore-status" href={sourcesUrl} target="_blank" rel="noreferrer">{copy.sources} · {region.credit}</a>
  </>
}
