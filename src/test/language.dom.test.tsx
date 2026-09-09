// @vitest-environment jsdom
import './dom.ts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useUiText } from '../use-ui-text.ts'
import type { UiLanguage } from '../i18n.ts'

const german = vi.hoisted(() => {
  let release!: () => void
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
})
vi.mock('../locales/de.ts', async importOriginal => { await german.promise; return importOriginal() })
vi.mock('../locales/it.ts', () => { throw new Error('Translation unavailable') })

it('ignores a fully settled older language, caches it, and keeps readable fallback on failure', async () => {
  const hook = renderHook(({ language }) => useUiText(language), { initialProps: { language: 'en' as UiLanguage } })
  expect(hook.result.current.pageTitle).toBe('Gleislicht — Switzerland in motion')
  hook.rerender({ language: 'de' })
  expect(hook.result.current.pageTitle).toBe('Gleislicht — Switzerland in motion')
  hook.rerender({ language: 'fr' })
  await waitFor(() => expect(hook.result.current.pageTitle).toBe('Gleislicht — La Suisse en mouvement'))
  await act(async () => { german.release(); await import('../locales/de.ts') })
  expect(hook.result.current.pageTitle).toBe('Gleislicht — La Suisse en mouvement')
  hook.rerender({ language: 'de' })
  expect(hook.result.current.pageTitle).toBe('Gleislicht — Schweiz in Bewegung')
  hook.rerender({ language: 'it' })
  await act(async () => { await import('../locales/it.ts').catch(() => {}) })
  expect(hook.result.current.pageTitle).toBe('Gleislicht — Switzerland in motion')
})
