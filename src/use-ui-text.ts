import { useEffect, useState } from 'react'
import type { UiLanguage } from './i18n.ts'
import english, { type UiText } from './locales/en.ts'

const loaders = {
  de: () => import('./locales/de.ts'),
  fr: () => import('./locales/fr.ts'),
  it: () => import('./locales/it.ts'),
}
const cache: Partial<Record<UiLanguage, UiText>> = { en: english }
const pending: Partial<Record<UiLanguage, Promise<UiText>>> = {}

export function loadUiText(language: UiLanguage): Promise<UiText> {
  const cached = cache[language]
  if (cached) return Promise.resolve(cached)
  if (pending[language]) return pending[language]
  if (language === 'en') return Promise.resolve(english)
  const request = loaders[language]().then(({ default: text }) => {
    cache[language] = text
    return text
  }).finally(() => { delete pending[language] })
  pending[language] = request
  return request
}

/** Keep English available while the selected translation loads. */
export function useUiText(language: UiLanguage): UiText {
  const [loaded, setLoaded] = useState(() => ({ language, text: cache[language] ?? english }))
  useEffect(() => {
    if (language === 'en') return
    let current = true
    void loadUiText(language).then(text => {
      if (current) setLoaded({ language, text })
    }).catch(() => { /* Retain the readable English fallback if loading fails. */ })
    return () => { current = false }
  }, [language])
  return cache[language] ?? (loaded.language === language ? loaded.text : english)
}
