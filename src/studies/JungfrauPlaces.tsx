import type { UiLanguage } from '../i18n.ts'
import { JUNGFRAU_COPY } from './jungfrau-copy.ts'
import './jungfrau.css'
export default function JungfrauPlaces({ language, onSelect }: { language: UiLanguage; onSelect: (name: string) => void }) {
  const copy = JUNGFRAU_COPY[language]
  return <div className="jungfrau-places"><details><summary>{copy.places}</summary><nav aria-label={copy.places}>{['Interlaken Ost', 'Lauterbrunnen', 'Grindelwald', 'Grindelwald Terminal', 'Kleine Scheidegg', 'Jungfraujoch'].map(name => <button key={name} type="button" onClick={() => onSelect(name)}>{name} ↗</button>)}</nav></details><p>{copy.scope}</p><p>{copy.cable}</p><a href="./methodology.html#jungfrau">{copy.sources} ↗</a></div>
}
