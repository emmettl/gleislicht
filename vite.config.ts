import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { gleislichtSelectionRenderer } from './scripts/gleislicht-selection-renderer.ts'
import { gleislichtRoadRenderer } from './scripts/gleislicht-road-renderer.ts'
import { gleislichtAirportRenderer } from './scripts/gleislicht-airport-renderer.ts'
export default defineConfig({
  plugins: [gleislichtSelectionRenderer(), gleislichtRoadRenderer(), gleislichtAirportRenderer(), react()],
  optimizeDeps: {
    exclude: ['@motionstudies/three'],
    include: ['@react-three/fiber', 'three'],
  },
  base: './',
  build: { manifest: true, target: 'es2022' },
})
