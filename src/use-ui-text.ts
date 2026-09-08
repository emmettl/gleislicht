import { useEffect, useState } from 'react'
import type { UiLanguage } from './i18n.ts'
import english, { type UiText } from './locales/en.ts'

const loaders = {
  de: () => import('./locales/de.ts'),
  fr: () => import('./locales/fr.ts'),
  it: () => import('./locales/it.ts'),
}
const cache: Partial<Record<UiLanguage, UiText>> = { en: english }

/** Keep English available while the selected translation loads. */
export function useUiText(language: UiLanguage): UiText {
  const [loaded, setLoaded] = useState(() => ({ language, text: cache[language] ?? english }))
  useEffect(() => {
    if (language === 'en') return
    let current = true
    void loaders[language]().then(({ default: text }) => {
      cache[language] = text
      if (current) setLoaded({ language, text })
    }).catch(() => { /* Retain the readable English fallback if loading fails. */ })
    return () => { current = false }
  }, [language])
  return cache[language] ?? (loaded.language === language ? loaded.text : english)
}
