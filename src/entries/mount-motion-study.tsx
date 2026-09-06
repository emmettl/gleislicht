import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { MotionStudyEdition } from '../editions/edition.ts'
import { applyVisualTheme } from '../theme/visual-language.ts'

export function mountMotionStudy(
  edition: MotionStudyEdition,
  application: ReactNode,
): void {
  const root = document.getElementById('root')
  if (!root) throw new Error('Motion Studies entry point requires #root')

  document.documentElement.dataset.edition = edition.id
  applyVisualTheme(edition.theme)
  createRoot(root).render(<StrictMode>{application}</StrictMode>)
}
