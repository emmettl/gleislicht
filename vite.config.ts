import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { gleislichtOrbitalRenderer } from './scripts/gleislicht-orbital-renderer.ts'
import { gleislichtSelectionRenderer } from './scripts/gleislicht-selection-renderer.ts'
import { gleislichtRoadRenderer } from './scripts/gleislicht-road-renderer.ts'
import { gleislichtAirportRenderer } from './scripts/gleislicht-airport-renderer.ts'
import { gleislichtSurfaceRenderer } from './scripts/gleislicht-surface-renderer.ts'
import { gleislichtPostbusRenderer } from './scripts/gleislicht-postbus-renderer.ts'
import { gleislichtPerformanceRenderer } from './scripts/gleislicht-performance-renderer.ts'
import { gleislichtRoadCatalogue } from './scripts/gleislicht-road-catalogue.ts'
export default defineConfig({
  plugins: [gleislichtRoadCatalogue(), gleislichtSelectionRenderer(), gleislichtRoadRenderer(), gleislichtAirportRenderer(), gleislichtSurfaceRenderer(), gleislichtPostbusRenderer(), gleislichtPerformanceRenderer(), gleislichtOrbitalRenderer(), react()],
  optimizeDeps: {
    // Archived source HTML under data/ is evidence, not an application entry.
    entries: ['index.html'],
    exclude: ['@motionstudies/three'],
    include: ['@react-three/fiber', 'three'],
  },
  base: './',
  build: { manifest: true, target: 'es2022' },
})
