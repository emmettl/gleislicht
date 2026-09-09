import { useCallback, useEffect, useState } from 'react'
import { resolveUiLanguage, type UiLanguage } from './i18n.ts'

const eventName = 'gleislicht-language-change'
const sessionLanguages = new Map<string, UiLanguage>()
export function useUiLanguage(storageKey = 'gleislicht-language') {
  const [language, update] = useState<UiLanguage>(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem(storageKey) } catch { saved = sessionLanguages.get(storageKey) ?? null }
    return resolveUiLanguage([saved, ...navigator.languages])
  })
  useEffect(() => {
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; language: UiLanguage }>).detail
      if (detail.key === storageKey) update(detail.language)
    }
    const stored = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) update(resolveUiLanguage([event.newValue, ...navigator.languages]))
    }
    window.addEventListener(eventName, changed)
    window.addEventListener('storage', stored)
    return () => { window.removeEventListener(eventName, changed); window.removeEventListener('storage', stored) }
  }, [storageKey])
  const setLanguage = useCallback((next: UiLanguage) => {
    update(next)
    sessionLanguages.set(storageKey, next)
    try { localStorage.setItem(storageKey, next) } catch { /* Keep the selection in this session. */ }
    window.dispatchEvent(new CustomEvent(eventName, { detail: { key: storageKey, language: next } }))
  }, [storageKey])
  return [language, setLanguage] as const
}
