import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import '@motionstudies/web/tokens.css'
import '@motionstudies/web/mobile-picker.css'
import './lab.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
