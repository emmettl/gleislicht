import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { ACTIVE_EDITION } from './editions/index.ts'
import { applyVisualTheme } from './theme/visual-language.ts'
import './styles.css'

applyVisualTheme(ACTIVE_EDITION.theme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App edition={ACTIVE_EDITION} />
  </StrictMode>,
)
