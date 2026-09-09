import { useUiLanguage } from '../use-ui-language.ts'
import { LANGUAGE_LOCALES } from '../i18n.ts'
import { useLocalPerformance } from '@motionstudies/web/use-local-performance'

export default function PerformanceMonitor() {
  const [language] = useUiLanguage()
  const labels = {
    en: ['Local performance monitor', 'Local only · no analytics', 'measuring…', '{percent}% slow frames', '1 second sample'],
    de: ['Lokale Leistungsmessung', 'Nur lokal · keine Analyseübertragung', 'Messung läuft…', '{percent}% langsame Bilder', 'Messfenster: 1 Sekunde'],
    fr: ['Mesure locale des performances', 'Local uniquement · aucune analyse transmise', 'mesure…', '{percent}% d’images lentes', 'Échantillon d’une seconde'],
    it: ['Monitoraggio locale delle prestazioni', 'Solo locale · nessuna analisi trasmessa', 'misurazione…', '{percent}% di fotogrammi lenti', 'Campione di un secondo'],
  }[language]
  const numbers = new Intl.NumberFormat(LANGUAGE_LOCALES[language])
  const performanceSample = useLocalPerformance(true)
  return (
        <aside className="performance-monitor" aria-label={labels[0]}>
          <span>{labels[1]}</span>
          <strong>{performanceSample ? `${performanceSample.fps} FPS` : labels[2]}</strong>
          <small>
            {performanceSample
              ? labels[3].replace('{percent}', numbers.format(performanceSample.slowFramePercent))
              : labels[4]}
          </small>
        </aside>
  )
}
