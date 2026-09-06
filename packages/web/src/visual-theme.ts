import type { VisualTheme } from '@motionstudies/core/theme.ts'

export function applyVisualTheme(
  theme: VisualTheme,
  root: HTMLElement = document.documentElement,
): void {
  root.style.setProperty('--background', theme.background)
  root.style.setProperty('--ink', theme.ink)
  root.style.setProperty('--muted', theme.muted)
  root.style.setProperty('--line', theme.line)
  root.style.setProperty('--cyan', theme.primary)
  root.style.setProperty('--pink', theme.secondary)
  root.style.setProperty('--panel', theme.panel)
  root.style.setProperty('--air', theme.air)
  root.style.setProperty('--road-light', theme.roadLight)
  root.style.setProperty('--road-heavy', theme.roadHeavy)
}
